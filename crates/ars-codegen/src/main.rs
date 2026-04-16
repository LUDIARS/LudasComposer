use clap::{Parser, Subcommand};
use std::path::PathBuf;

use ars_codegen::feedback::{detect_changes, ChangeKind, FeedbackInputs};
use ars_codegen::manifest::{CodegenManifest, FileKind};
use ars_codegen::project_loader::{find_project_files, load_project};
use ars_codegen::prompt_generator::PromptGenerator;
use ars_codegen::session_runner::{
    build_manifest, CodegenConfig, SessionRunner,
};
use ars_core::models::Project;

#[derive(Parser)]
#[command(name = "ars-codegen", about = "Arsの設計フローからコードを生成するCLIツール")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Claude Codeセッションを起動してコードを生成
    Generate {
        /// .ars.json プロジェクトファイル
        #[arg(short, long)]
        project: Option<String>,
        /// 出力ディレクトリ (デフォルト: ./generated)
        #[arg(short, long, default_value = "./generated")]
        output: String,
        /// 対象シーンID (複数指定可)
        #[arg(short, long)]
        scene: Vec<String>,
        /// 対象コンポーネントID (複数指定可)
        #[arg(short, long)]
        component: Vec<String>,
        /// 実行せずプロンプトファイルのみ生成
        #[arg(long)]
        dry_run: bool,
        /// 最大同時実行数
        #[arg(long, default_value = "1")]
        max_concurrent: usize,
        /// Claude Codeのモデル指定
        #[arg(short, long)]
        model: Option<String>,
        /// パーミッションモード (auto/default/plan)
        #[arg(long)]
        permission_mode: Option<String>,
    },
    /// プロジェクト内のシーン・コンポーネントを一覧表示
    List {
        /// .ars.json プロジェクトファイル
        #[arg(short, long)]
        project: Option<String>,
    },
    /// 生成されるプロンプトをプレビュー（実行しない）
    Preview {
        /// .ars.json プロジェクトファイル
        #[arg(short, long)]
        project: Option<String>,
        /// 出力ディレクトリ
        #[arg(short, long, default_value = "./generated")]
        output: String,
        /// 対象シーンID
        #[arg(short, long)]
        scene: Vec<String>,
        /// 対象コンポーネントID
        #[arg(short, long)]
        component: Vec<String>,
    },
    /// 生成済みコード/コード詳細設計の差分を Ars 側へフィードバック
    ///
    /// `.ars-cache/codegen-manifest.json` を基準点として、最後の同期以降に
    /// 編集されたファイル (Added / Modified / Removed) を一覧表示する。
    Feedback {
        /// .ars.json プロジェクトファイル
        #[arg(short, long)]
        project: Option<String>,
        /// 出力ディレクトリ (デフォルト: ./generated)
        #[arg(short, long, default_value = "./generated")]
        output: String,
        /// codedesign ディレクトリ (デフォルト: {project_dir}/codedesign)
        #[arg(long)]
        codedesign: Option<String>,
    },
    /// 現在の codegen-manifest.json を表示
    Manifest {
        /// .ars.json プロジェクトファイル
        #[arg(short, long)]
        project: Option<String>,
    },
}

fn resolve_project_file(specified: Option<&str>) -> Result<PathBuf, String> {
    if let Some(path) = specified {
        let p = PathBuf::from(path);
        if !p.exists() {
            return Err(format!("プロジェクトファイルが見つかりません: {}", p.display()));
        }
        return Ok(p.canonicalize().unwrap_or(p));
    }
    let cwd = std::env::current_dir().map_err(|e| format!("cwd取得失敗: {e}"))?;
    let files = find_project_files(&cwd, 2);
    match files.len() {
        0 => Err("プロジェクトファイル (.ars.json) が見つかりません。--project で指定してください。".into()),
        1 => Ok(files.into_iter().next().unwrap()),
        _ => {
            let list: Vec<_> = files.iter().map(|f| format!("  - {}", f.display())).collect();
            Err(format!("複数のプロジェクトファイルが見つかりました:\n{}\n--project でプロジェクトファイルを指定してください。", list.join("\n")))
        }
    }
}

fn command_list(project_file: &std::path::Path, project: &Project) {
    println!("\nプロジェクト: {}", project.name);
    println!("ファイル: {}\n", project_file.display());

    let scenes: Vec<_> = project.scenes.values().collect();
    println!("シーン ({}個):", scenes.len());
    for scene in &scenes {
        let actor_count = scene.actors.len();
        let active = if project.active_scene_id.as_deref() == Some(&scene.id) { " ★" } else { "" };
        println!("  [{}] {}{} - ドメイン: {}個, メッセージ: {}個", scene.id, scene.name, active, actor_count, scene.messages.len());
    }

    let components: Vec<_> = project.components.values().collect();
    println!("\nコンポーネント ({}個):", components.len());
    let mut by_category: std::collections::HashMap<&str, Vec<_>> = std::collections::HashMap::new();
    for comp in &components {
        by_category.entry(&comp.category).or_default().push(comp);
    }
    for (category, comps) in &by_category {
        println!("  [{}]", category);
        for comp in comps {
            println!("    [{}] {} ({}) - タスク: {}個", comp.id, comp.name, comp.domain, comp.tasks.len());
        }
    }
}

async fn run(cli: Cli) -> Result<(), String> {
    match cli.command {
        Commands::List { project } => {
            let pf = resolve_project_file(project.as_deref())?;
            let proj = load_project(&pf)?;
            command_list(&pf, &proj);
            Ok(())
        }
        Commands::Preview { project, output, scene, component } => {
            let pf = resolve_project_file(project.as_deref())?;
            let proj = load_project(&pf)?;
            let gen = PromptGenerator::new(&proj, "ars-native");
            let tasks = gen.generate_tasks(&output, if scene.is_empty() { None } else { Some(&scene) }, if component.is_empty() { None } else { Some(&component) });
            println!("\nプロジェクト: {}", proj.name);
            println!("生成タスク数: {}\n", tasks.len());
            for task in &tasks {
                println!("━━━ {}: {} ━━━", task.task_type.to_uppercase(), task.name);
                println!("出力先: {}", task.output_dir);
                if !task.dependencies.is_empty() {
                    println!("依存: {}", task.dependencies.join(", "));
                }
                println!();
                println!("{}", task.prompt);
                println!();
            }
            Ok(())
        }
        Commands::Generate { project, output, scene, component, dry_run, max_concurrent, model, permission_mode } => {
            let pf = resolve_project_file(project.as_deref())?;
            let proj = load_project(&pf)?;
            let output = std::path::Path::new(&output).canonicalize().unwrap_or_else(|_| PathBuf::from(&output));

            let config = CodegenConfig {
                project_file: pf.to_string_lossy().to_string(),
                output_dir: output.to_string_lossy().to_string(),
                dry_run,
                max_concurrent,
                claude_model: model,
                claude_permission_mode: permission_mode,
            };

            println!("\n=== Ars Code Generator ===");
            println!("プロジェクト: {}", proj.name);
            println!("出力先: {}", output.display());
            if dry_run { println!("モード: ドライラン（プロンプトのみ生成）"); }
            println!();

            let gen = PromptGenerator::new(&proj, "ars-native");
            let tasks = gen.generate_tasks(&output.to_string_lossy(), if scene.is_empty() { None } else { Some(&scene) }, if component.is_empty() { None } else { Some(&component) });
            println!("生成タスク: {}個", tasks.len());
            for task in &tasks {
                println!("  - [{}] {}", task.task_type, task.name);
            }

            let runner = SessionRunner::new(config);
            // tasks を消費する前にメタ情報をキャプチャしておく（manifest 構築用）
            let task_meta: Vec<_> = tasks
                .iter()
                .map(|t| (t.id.clone(), t.layout_category, t.entity_id.clone(), t.name.clone(), t.class_name.clone()))
                .collect();
            let results = runner.run_tasks(tasks).await;

            let succeeded = results.iter().filter(|r| r.success).count();
            let failed = results.iter().filter(|r| !r.success).count();
            let total_duration: u64 = results.iter().map(|r| r.duration_ms).sum();

            println!("\n=== 結果 ===");
            println!("成功: {}/{}", succeeded, results.len());
            if failed > 0 {
                println!("失敗: {}", failed);
                for r in results.iter().filter(|r| !r.success) {
                    println!("  - {}: {}", r.task_id, r.error.as_deref().unwrap_or("unknown"));
                }
            }
            println!("合計時間: {:.1}s", total_duration as f64 / 1000.0);

            // Manifest 更新（成功タスクのみ集計）
            let project_dir = pf.parent().map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."));
            let codedesign_root = project_dir.join("codedesign");
            let cd = if codedesign_root.exists() { Some(codedesign_root.as_path()) } else { None };

            // task メタを CodegenTask っぽい雛形に詰め直して build_manifest に渡す
            let synthetic_tasks: Vec<ars_codegen::prompt_generator::CodegenTask> = task_meta
                .into_iter()
                .map(|(id, cat, eid, name, class_name)| ars_codegen::prompt_generator::CodegenTask {
                    id,
                    task_type: cat.as_str().to_string(),
                    name,
                    prompt: String::new(),
                    dependencies: vec![],
                    output_dir: String::new(),
                    layout_category: cat,
                    entity_id: eid,
                    class_name,
                })
                .collect();

            let manifest = build_manifest(
                &synthetic_tasks,
                &results,
                &pf,
                &output,
                cd,
                &proj.name,
                "ars-native",
            );
            let manifest_path = CodegenManifest::default_path(&project_dir);
            if let Err(e) = manifest.save_to(&manifest_path) {
                eprintln!("manifest 保存に失敗: {e}");
            } else {
                println!("\nmanifest を保存しました: {}", manifest_path.display());
            }
            Ok(())
        }
        Commands::Feedback { project, output, codedesign } => {
            let pf = resolve_project_file(project.as_deref())?;
            let project_dir = pf
                .parent()
                .ok_or_else(|| "project_file の親ディレクトリが取得できません".to_string())?;
            let output_root = std::path::Path::new(&output)
                .canonicalize()
                .unwrap_or_else(|_| PathBuf::from(&output));
            let cd_path = codedesign
                .map(PathBuf::from)
                .unwrap_or_else(|| project_dir.join("codedesign"));
            let manifest_path = CodegenManifest::default_path(project_dir);

            let report = detect_changes(&FeedbackInputs {
                project_file: &pf,
                output_root: &output_root,
                codedesign_root: Some(&cd_path),
                manifest_path: &manifest_path,
            })?;

            println!("\n=== Codegen Feedback ===");
            println!("プロジェクト: {}", pf.display());
            println!("出力ルート: {}", output_root.display());
            println!("codedesign: {}", cd_path.display());
            println!("manifest: {}", manifest_path.display());

            if report.manifest_missing {
                println!("\n[INFO] manifest が存在しません。`generate` を一度実行すると基準点が記録されます。");
            }

            if report.is_empty() && !report.manifest_missing {
                println!("\n変更はありません。");
                return Ok(());
            }

            let added = report.count(ChangeKind::Added);
            let modified = report.count(ChangeKind::Modified);
            let removed = report.count(ChangeKind::Removed);
            let project_n = report.count_kind(FileKind::Project);
            let cd_n = report.count_kind(FileKind::CodeDesign);
            let code_n = report.count_kind(FileKind::Code);

            println!("\n--- サマリー ---");
            println!("プロジェクト変更: {}", if report.project_changed { "あり" } else { "なし" });
            println!("変更数: Added={} / Modified={} / Removed={}", added, modified, removed);
            println!("種別:   project={} / codedesign={} / code={}", project_n, cd_n, code_n);

            println!("\n--- 詳細 ---");
            for c in &report.changes {
                let entity = c
                    .entity_name
                    .as_deref()
                    .map(|n| format!(" [{}]", n))
                    .unwrap_or_default();
                let kind = match c.kind {
                    FileKind::Project => "project",
                    FileKind::CodeDesign => "codedesign",
                    FileKind::Code => "code",
                };
                let change = match c.change {
                    ChangeKind::Added => "ADD",
                    ChangeKind::Modified => "MOD",
                    ChangeKind::Removed => "DEL",
                };
                println!("  {} [{}] {}{}", change, kind, c.path, entity);
            }
            Ok(())
        }
        Commands::Manifest { project } => {
            let pf = resolve_project_file(project.as_deref())?;
            let project_dir = pf
                .parent()
                .ok_or_else(|| "project_file の親ディレクトリが取得できません".to_string())?;
            let manifest_path = CodegenManifest::default_path(project_dir);
            match CodegenManifest::load_from(&manifest_path)? {
                Some(m) => {
                    println!("{}", serde_json::to_string_pretty(&m).map_err(|e| format!("シリアライズ失敗: {e}"))?);
                    Ok(())
                }
                None => {
                    println!("manifest が存在しません: {}", manifest_path.display());
                    Ok(())
                }
            }
        }
    }
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    if let Err(e) = run(cli).await {
        eprintln!("\nエラー: {}", e);
        std::process::exit(1);
    }
}
