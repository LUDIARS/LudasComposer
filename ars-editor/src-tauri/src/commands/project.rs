use crate::models::Project;
use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub fn save_project(path: String, project: Project) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;
    fs::write(&path, json)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn load_project(path: String) -> Result<Project, String> {
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    let project: Project = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse project: {}", e))?;
    Ok(project)
}

#[tauri::command]
pub fn get_default_project_path() -> Result<String, String> {
    let home = dirs_next::document_dir()
        .or_else(dirs_next::home_dir)
        .ok_or_else(|| "Cannot determine home directory".to_string())?;
    let path: PathBuf = home.join("ars-projects");
    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}
