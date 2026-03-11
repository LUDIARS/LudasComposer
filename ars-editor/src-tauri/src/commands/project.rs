use crate::models::Project;
use std::fs;
use std::path::PathBuf;

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
    let json = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;
    if let Some(parent) = std::path::Path::new(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(&path, json)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

pub fn load_project_impl(path: String) -> Result<Project, String> {
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    let project: Project = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse project: {}", e))?;
    Ok(project)
}

pub fn get_default_project_path_impl() -> Result<String, String> {
    let home = dirs_next::document_dir()
        .or_else(dirs_next::home_dir)
        .ok_or_else(|| "Cannot determine home directory".to_string())?;
    let path: PathBuf = home.join("ars-projects");
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
