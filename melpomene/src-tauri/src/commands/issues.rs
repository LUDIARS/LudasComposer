use crate::models::ticket::Ticket;
use crate::services::cache::{CacheStats, TicketCache};
use crate::services::github_client::GitHubClient;
use std::sync::Mutex;

pub struct IssuesState {
    pub client: GitHubClient,
    pub cache: TicketCache,
}

pub struct MelpomeneState(pub Mutex<IssuesState>);

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub async fn fetch_issues(
    state: tauri::State<'_, MelpomeneState>,
    force_refresh: bool,
) -> Result<Vec<Ticket>, String> {
    let (needs_refresh, cached) = {
        let s = state.0.lock().map_err(|e| e.to_string())?;
        let needs = force_refresh || s.cache.is_expired();
        let cached = if !needs {
            Some(s.cache.get_all().to_vec())
        } else {
            None
        };
        (needs, cached)
    };

    if let Some(tickets) = cached {
        return Ok(tickets);
    }

    if !needs_refresh {
        let s = state.0.lock().map_err(|e| e.to_string())?;
        return Ok(s.cache.get_all().to_vec());
    }

    let tickets = {
        let s = state.0.lock().map_err(|e| e.to_string())?;
        s.client
            .fetch_issues(Some("all"), None, 1, 100)
    };
    let tickets = tickets.await.map_err(|e| e.to_string())?;

    let mut s = state.0.lock().map_err(|e| e.to_string())?;
    s.cache.update(tickets.clone());
    Ok(tickets)
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub async fn fetch_issue(
    state: tauri::State<'_, MelpomeneState>,
    number: u64,
) -> Result<Ticket, String> {
    let s = state.0.lock().map_err(|e| e.to_string())?;
    s.client
        .fetch_issue(number)
        .await
        .map_err(|e| e.to_string())
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub async fn create_issue(
    state: tauri::State<'_, MelpomeneState>,
    title: String,
    body: String,
    labels: Vec<String>,
    milestone: Option<u64>,
) -> Result<Ticket, String> {
    let s = state.0.lock().map_err(|e| e.to_string())?;
    s.client
        .create_issue(&title, &body, &labels, milestone)
        .await
        .map_err(|e| e.to_string())
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub async fn update_issue(
    state: tauri::State<'_, MelpomeneState>,
    number: u64,
    title: Option<String>,
    body: Option<String>,
    state_val: Option<String>,
    labels: Option<Vec<String>>,
) -> Result<Ticket, String> {
    let s = state.0.lock().map_err(|e| e.to_string())?;
    s.client
        .update_issue(
            number,
            title.as_deref(),
            body.as_deref(),
            state_val.as_deref(),
            labels.as_deref(),
        )
        .await
        .map_err(|e| e.to_string())
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub async fn close_issue(
    state: tauri::State<'_, MelpomeneState>,
    number: u64,
) -> Result<Ticket, String> {
    let s = state.0.lock().map_err(|e| e.to_string())?;
    s.client
        .close_issue(number)
        .await
        .map_err(|e| e.to_string())
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub async fn post_comment(
    state: tauri::State<'_, MelpomeneState>,
    issue_number: u64,
    body: String,
) -> Result<crate::models::ticket::Comment, String> {
    let s = state.0.lock().map_err(|e| e.to_string())?;
    s.client
        .post_comment(issue_number, &body)
        .await
        .map_err(|e| e.to_string())
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub async fn fetch_comments(
    state: tauri::State<'_, MelpomeneState>,
    issue_number: u64,
) -> Result<Vec<crate::models::ticket::Comment>, String> {
    let s = state.0.lock().map_err(|e| e.to_string())?;
    s.client
        .fetch_comments(issue_number)
        .await
        .map_err(|e| e.to_string())
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn get_issues_by_scene(
    state: tauri::State<'_, MelpomeneState>,
    scene_name: String,
) -> Result<Vec<Ticket>, String> {
    let s = state.0.lock().map_err(|e| e.to_string())?;
    Ok(s.cache
        .get_by_scene(&scene_name)
        .into_iter()
        .cloned()
        .collect())
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn get_issues_near_position(
    state: tauri::State<'_, MelpomeneState>,
    position: [f64; 3],
    radius: f64,
) -> Result<Vec<Ticket>, String> {
    let s = state.0.lock().map_err(|e| e.to_string())?;
    Ok(s.cache
        .get_near_position(position, radius)
        .into_iter()
        .cloned()
        .collect())
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn get_cache_stats(
    state: tauri::State<'_, MelpomeneState>,
) -> Result<CacheStats, String> {
    let s = state.0.lock().map_err(|e| e.to_string())?;
    Ok(s.cache.stats())
}
