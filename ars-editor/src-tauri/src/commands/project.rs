use crate::models::Project;
use std::fs;
use std::path::{Path, PathBuf};

/// 許可されたディレクトリ内のパスであることを検証する。
/// パストラバーサル (`../../etc/passwd` 等) を防止。
fn validate_path_within_allowed_dir(path: &str) -> Result<PathBuf, String> {
    let allowed_base = get_default_project_path_impl()?;
    let allowed_dir = fs::canonicalize(&allowed_base)
        .map_err(|e| format!("Failed to resolve allowed directory: {}", e))?;

    // 親ディレクトリが存在しない場合は先に作成（新規保存時）
    if let Some(parent) = Path::new(path).parent() {
        let _ = fs::create_dir_all(parent);
    }

    let resolved = fs::canonicalize(path)
        .or_else(|_| {
            // ファイルがまだ存在しない場合、親ディレクトリを解決してファイル名を付加
            let parent = Path::new(path)
                .parent()
                .ok_or_else(|| "Invalid path".to_string())?;
            let file_name = Path::new(path)
                .file_name()
                .ok_or_else(|| "Invalid path: no filename".to_string())?;
            let resolved_parent = fs::canonicalize(parent)
                .map_err(|e| format!("Failed to resolve path: {}", e))?;
            Ok::<PathBuf, String>(resolved_parent.join(file_name))
        })?;

    if !resolved.starts_with(&allowed_dir) {
        return Err(format!(
            "Access denied: path must be within {}",
            allowed_dir.display()
        ));
    }

    Ok(resolved)
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn save_project(path: String, project: Project) -> Result<(), String> {
    save_project_impl(path, project)
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn load_project(path: String) -> Result<Project, String> {
    load_project_impl(path)
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn get_default_project_path() -> Result<String, String> {
    get_default_project_path_impl()
}

pub fn save_project_impl(path: String, project: Project) -> Result<(), String> {
    let safe_path = validate_path_within_allowed_dir(&path)?;
    let json = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;
    if let Some(parent) = safe_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(&safe_path, json)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

pub fn load_project_impl(path: String) -> Result<Project, String> {
    let safe_path = validate_path_within_allowed_dir(&path)?;
    let content = fs::read_to_string(&safe_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    let project: Project = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse project: {}", e))?;
    Ok(project)
}

pub fn get_default_project_path_impl() -> Result<String, String> {
    // ARS_PROJECT_DIR > cwd を基準に ./ars-projects
    let base = std::env::var("ARS_PROJECT_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
    let path: PathBuf = base.join("ars-projects");
    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}

pub fn list_projects_impl() -> Result<Vec<String>, String> {
    let dir = get_default_project_path_impl()?;
    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    let mut files = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        if path.extension().map(|e| e == "json").unwrap_or(false) {
            if let Some(name) = path.file_name() {
                files.push(name.to_string_lossy().to_string());
            }
        }
    }
    Ok(files)
}
