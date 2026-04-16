use ars_core::models::Project;
use std::path::{Path, PathBuf};

pub fn load_project(path: &Path) -> Result<Project, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("プロジェクトファイルが読めません: {}: {}", path.display(), e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("プロジェクトファイルのパースに失敗: {}", e))
}

/// Project を pretty JSON でファイルに保存する。
pub fn save_project(path: &Path, project: &Project) -> Result<(), String> {
    let text = serde_json::to_string_pretty(project)
        .map_err(|e| format!("プロジェクトのシリアライズに失敗: {e}"))?;
    std::fs::write(path, text)
        .map_err(|e| format!("プロジェクトファイル書き込みに失敗: {}: {e}", path.display()))
}

pub fn find_project_files(dir: &Path, max_depth: usize) -> Vec<PathBuf> {
    let mut files = Vec::new();
    scan_dir(dir, &mut files, max_depth);
    files
}

fn scan_dir(dir: &Path, results: &mut Vec<PathBuf>, depth: usize) {
    if depth == 0 { return; }
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if name_str.starts_with('.') || name_str == "node_modules" || name_str == "dist" || name_str == "target" {
            continue;
        }
        let path = entry.path();
        if path.is_dir() {
            scan_dir(&path, results, depth - 1);
        } else if name_str.ends_with(".ars.json") {
            results.push(path);
        }
    }
}
