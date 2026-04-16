use std::path::{Path, PathBuf};
use tokio::process::Command;

use crate::crc32::crc32_hex;
use crate::manifest::{
    record_for, system_time_to_rfc3339, CodegenManifest, FileKind, ManifestEntry,
};
use crate::prompt_generator::CodegenTask;

pub struct CodegenConfig {
    pub project_file: String,
    pub output_dir: String,
    pub dry_run: bool,
    pub max_concurrent: usize,
    pub claude_model: Option<String>,
    pub claude_permission_mode: Option<String>,
}

pub struct CodegenResult {
    pub task_id: String,
    pub success: bool,
    pub output_files: Vec<String>,
    pub error: Option<String>,
    pub duration_ms: u64,
}

pub struct SessionRunner {
    config: CodegenConfig,
}

impl SessionRunner {
    pub fn new(config: CodegenConfig) -> Self {
        Self { config }
    }

    pub async fn run_tasks(&self, tasks: Vec<CodegenTask>) -> Vec<CodegenResult> {
        let mut results = Vec::new();
        let mut completed = std::collections::HashSet::new();
        let mut remaining: Vec<_> = tasks.into_iter().collect();

        while !remaining.is_empty() {
            let ready: Vec<_> = remaining.iter()
                .enumerate()
                .filter(|(_, t)| t.dependencies.iter().all(|d| completed.contains(d)))
                .map(|(i, _)| i)
                .collect();

            if ready.is_empty() {
                for t in &remaining {
                    results.push(CodegenResult {
                        task_id: t.id.clone(),
                        success: false,
                        output_files: vec![],
                        error: Some(format!("依存関係が解決できません: {:?}", t.dependencies)),
                        duration_ms: 0,
                    });
                }
                break;
            }

            let batch_size = ready.len().min(self.config.max_concurrent);
            let batch_indices: Vec<_> = ready.into_iter().take(batch_size).collect();

            // Extract batch tasks (reverse order to preserve indices)
            let mut batch = Vec::new();
            for &idx in batch_indices.iter().rev() {
                batch.push(remaining.remove(idx));
            }
            batch.reverse();

            println!("\n--- バッチ実行: {} ---", batch.iter().map(|t| t.name.as_str()).collect::<Vec<_>>().join(", "));

            let handles: Vec<_> = batch.into_iter().map(|task| {
                let dry_run = self.config.dry_run;
                let model = self.config.claude_model.clone();
                let perm = self.config.claude_permission_mode.clone();
                let project_dir = Path::new(&self.config.project_file).parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
                tokio::spawn(async move {
                    run_single_task(task, dry_run, model, perm, &project_dir).await
                })
            }).collect();

            for handle in handles {
                match handle.await {
                    Ok(result) => {
                        if result.success {
                            completed.insert(result.task_id.clone());
                        }
                        results.push(result);
                    }
                    Err(e) => {
                        results.push(CodegenResult {
                            task_id: "unknown".into(),
                            success: false,
                            output_files: vec![],
                            error: Some(format!("タスク実行エラー: {e}")),
                            duration_ms: 0,
                        });
                    }
                }
            }
        }

        results
    }
}

async fn run_single_task(
    task: CodegenTask,
    dry_run: bool,
    model: Option<String>,
    permission_mode: Option<String>,
    project_dir: &str,
) -> CodegenResult {
    let start = std::time::Instant::now();

    // 出力ディレクトリ作成
    if let Err(e) = tokio::fs::create_dir_all(&task.output_dir).await {
        return CodegenResult {
            task_id: task.id,
            success: false,
            output_files: vec![],
            error: Some(format!("ディレクトリ作成失敗: {e}")),
            duration_ms: start.elapsed().as_millis() as u64,
        };
    }

    // プロンプトをファイルに保存
    let prompt_file = format!("{}/.codegen-prompt.md", task.output_dir);
    if let Err(e) = tokio::fs::write(&prompt_file, &task.prompt).await {
        return CodegenResult {
            task_id: task.id,
            success: false,
            output_files: vec![],
            error: Some(format!("プロンプト書き込み失敗: {e}")),
            duration_ms: start.elapsed().as_millis() as u64,
        };
    }

    if dry_run {
        println!("[DRY RUN] タスク: {}", task.name);
        println!("  プロンプト保存先: {}", prompt_file);
        return CodegenResult {
            task_id: task.id,
            success: true,
            output_files: vec![prompt_file],
            error: None,
            duration_ms: start.elapsed().as_millis() as u64,
        };
    }

    println!("[開始] {} ({})", task.name, task.task_type);

    let mut args = vec![
        "--print".to_string(),
        "--output-format".to_string(), "text".to_string(),
        "--max-turns".to_string(), "50".to_string(),
    ];
    if let Some(ref m) = model {
        args.extend(["--model".to_string(), m.clone()]);
    }
    if let Some(ref p) = permission_mode {
        args.extend(["--permission-mode".to_string(), p.clone()]);
    }
    args.extend(["--prompt".to_string(), task.prompt.clone()]);

    // セキュリティ: 環境変数をホワイトリストで制限
    let safe_env_keys = [
        "PATH", "HOME", "USER", "SHELL", "LANG", "LC_ALL", "LC_CTYPE",
        "TERM", "TMPDIR", "TMP", "TEMP", "NODE_ENV",
    ];
    let mut cmd = Command::new("claude");
    cmd.args(&args).current_dir(&task.output_dir);
    cmd.env_clear();
    for key in &safe_env_keys {
        if let Ok(val) = std::env::var(key) {
            cmd.env(key, val);
        }
    }
    // CLAUDE_ prefix
    for (key, value) in std::env::vars() {
        if key.starts_with("CLAUDE_") {
            cmd.env(&key, &value);
        }
    }
    cmd.env("ARS_PROJECT_DIR", project_dir);

    match cmd.output().await {
        Ok(output) if output.status.success() => {
            let log_file = format!("{}/.codegen-output.log", task.output_dir);
            let _ = tokio::fs::write(&log_file, &output.stdout).await;
            let generated = find_generated_files(&task.output_dir, &prompt_file);
            println!("[完了] {} - {}ファイル生成 ({:.1}s)", task.name, generated.len(), start.elapsed().as_secs_f64());
            CodegenResult {
                task_id: task.id,
                success: true,
                output_files: generated,
                error: None,
                duration_ms: start.elapsed().as_millis() as u64,
            }
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            println!("[失敗] {}: {}", task.name, stderr);
            CodegenResult {
                task_id: task.id,
                success: false,
                output_files: vec![],
                error: Some(format!("Claude Code exited with code {:?}: {}", output.status.code(), stderr)),
                duration_ms: start.elapsed().as_millis() as u64,
            }
        }
        Err(e) => {
            CodegenResult {
                task_id: task.id,
                success: false,
                output_files: vec![],
                error: Some(format!("Claude Code 起動失敗: {e}\n'claude' コマンドがインストールされているか確認してください。")),
                duration_ms: start.elapsed().as_millis() as u64,
            }
        }
    }
}

fn find_generated_files(dir: &str, exclude: &str) -> Vec<String> {
    let mut files = Vec::new();
    scan_files(Path::new(dir), &mut files);
    files.retain(|f| f != exclude && !f.ends_with(".codegen-prompt.md") && !f.ends_with(".codegen-output.log"));
    files
}

fn scan_files(dir: &Path, results: &mut Vec<String>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            scan_files(&path, results);
        } else {
            results.push(path.to_string_lossy().to_string());
        }
    }
}

// ── Manifest 構築 ─────────────────────────────────────────

/// `run_tasks` の結果から Manifest を構築する。
///
/// - `tasks`              : 実行したタスク一覧（`layout_category` / `entity_id` / `class_name` を保持）
/// - `results`            : `run_tasks` の戻り値（成功・出力ファイル一覧）
/// - `project_file`       : プロジェクトファイル絶対パス
/// - `output_root`        : 生成出力ルート絶対パス
/// - `codedesign_root`    : codedesign ルート絶対パス（任意）
/// - `project_name`       : プロジェクト名
/// - `platform`           : 対象プラットフォーム文字列
///
/// 成功した各タスクの出力ファイルを `code` 種別として記録し、
/// codedesign ルート配下に同じ class_name を持つ MD があれば `codedesign` 種別で
/// 同エントリにまとめる。
pub fn build_manifest(
    tasks: &[CodegenTask],
    results: &[CodegenResult],
    project_file: &Path,
    output_root: &Path,
    codedesign_root: Option<&Path>,
    project_name: &str,
    platform: &str,
) -> CodegenManifest {
    let project_dir: PathBuf = project_file
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));

    let mut manifest = CodegenManifest::new(project_name, platform);
    manifest.project_file = crate::manifest::relative_path(project_file, &project_dir);
    manifest.output_root = crate::manifest::relative_path(output_root, &project_dir);
    manifest.codedesign_root = codedesign_root
        .map(|p| crate::manifest::relative_path(p, &project_dir));
    if let Ok(bytes) = std::fs::read(project_file) {
        manifest.project_crc32 = crc32_hex(&bytes);
    }

    for task in tasks {
        let result = results.iter().find(|r| r.task_id == task.id);
        let success = result.map(|r| r.success).unwrap_or(false);
        if !success {
            continue;
        }
        let mut files = Vec::new();
        if let Some(r) = result {
            for file_path in &r.output_files {
                let abs = Path::new(file_path);
                if let Some(rec) = record_for(abs, &project_dir, FileKind::Code) {
                    files.push(rec);
                }
            }
        }
        // codedesign 側に対応する MD があればまとめる
        if let Some(cd) = codedesign_root {
            for cd_path in find_codedesign_for(cd, task) {
                if let Some(rec) = record_for(&cd_path, &project_dir, FileKind::CodeDesign) {
                    files.push(rec);
                }
            }
        }
        manifest.entries.push(ManifestEntry {
            category: task.layout_category,
            entity_id: task.entity_id.clone(),
            entity_name: task.name.clone(),
            class_name: task.class_name.clone(),
            parent_id: None,
            files,
        });
    }
    manifest.last_synced_at = system_time_to_rfc3339(std::time::SystemTime::now());
    manifest
}

/// codedesign ルート配下から、タスクと一致する MD ファイルを探す。
///
/// 命名は `codedesign-generation-rules.md` に従い kebab-case を採用しているため、
/// `class_name` および raw `name` の両方で検索する。
fn find_codedesign_for(codedesign_root: &Path, task: &CodegenTask) -> Vec<PathBuf> {
    use crate::code_layout::to_kebab_case;
    let candidates = [
        to_kebab_case(&task.class_name),
        to_kebab_case(&task.name),
    ];
    let mut hits = Vec::new();
    visit_md_files(codedesign_root, &mut |path| {
        let stem = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if candidates.iter().any(|c| c == &stem) {
            hits.push(path.to_path_buf());
        }
    });
    hits
}

fn visit_md_files<F: FnMut(&Path)>(dir: &Path, visitor: &mut F) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            visit_md_files(&path, visitor);
        } else if path.extension().map(|e| e == "md").unwrap_or(false) {
            visitor(&path);
        }
    }
}
