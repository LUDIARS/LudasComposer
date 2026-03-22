use crate::models::github::{PullRequest, Review, WorkflowRun};
use crate::services::github_client::GitHubClient;
use crate::services::notification::{NotificationService, NotificationState};
use std::sync::Mutex;

pub struct NotificationManagerState {
    pub client: GitHubClient,
    pub service: NotificationService,
}

pub struct MelpomeneNotificationState(pub Mutex<NotificationManagerState>);

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub async fn poll_notifications(
    state: tauri::State<'_, MelpomeneNotificationState>,
) -> Result<NotificationState, String> {
    let mut s = state.0.lock().map_err(|e| e.to_string())?;
    s.service.poll(&s.client).await
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub async fn fetch_pull_requests(
    state: tauri::State<'_, MelpomeneNotificationState>,
) -> Result<Vec<PullRequest>, String> {
    let s = state.0.lock().map_err(|e| e.to_string())?;
    s.client
        .fetch_pull_requests(Some("open"))
        .await
        .map_err(|e| e.to_string())
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub async fn fetch_reviews(
    state: tauri::State<'_, MelpomeneNotificationState>,
    pr_number: u64,
) -> Result<Vec<Review>, String> {
    let s = state.0.lock().map_err(|e| e.to_string())?;
    s.client
        .fetch_reviews(pr_number)
        .await
        .map_err(|e| e.to_string())
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub async fn fetch_workflow_runs(
    state: tauri::State<'_, MelpomeneNotificationState>,
) -> Result<Vec<WorkflowRun>, String> {
    let s = state.0.lock().map_err(|e| e.to_string())?;
    s.client
        .fetch_workflow_runs()
        .await
        .map_err(|e| e.to_string())
}
