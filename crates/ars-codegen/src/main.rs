use clap::{Parser, Subcommand};
use std::path::PathBuf;

use ars_codegen::project_loader::{find_project_files, load_project};
use ars_codegen::prompt_generator::PromptGenerator;
use ars_codegen::session_runner::{CodegenConfig, SessionRunner};
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
            Ok(())
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
