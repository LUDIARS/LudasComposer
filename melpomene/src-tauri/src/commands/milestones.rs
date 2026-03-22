use crate::commands::issues::MelpomeneState;
use crate::models::milestone::Milestone;

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub async fn fetch_milestones(
    state: tauri::State<'_, MelpomeneState>,
) -> Result<Vec<Milestone>, String> {
    let s = state.0.lock().map_err(|e| e.to_string())?;
    s.client
        .fetch_milestones()
        .await
        .map_err(|e| e.to_string())
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub async fn create_milestone(
    state: tauri::State<'_, MelpomeneState>,
    title: String,
    description: Option<String>,
    due_on: Option<String>,
) -> Result<Milestone, String> {
    let s = state.0.lock().map_err(|e| e.to_string())?;
    s.client
        .create_milestone(&title, description.as_deref(), due_on.as_deref())
        .await
        .map_err(|e| e.to_string())
}
