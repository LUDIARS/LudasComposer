use crate::models::command::ServerStatus;
use crate::models::config::TerpsichoreConfig;
use crate::services::command_server::CommandServer;
use std::sync::Mutex;
use std::time::Instant;

pub struct TerpsichoreState {
    pub config: TerpsichoreConfig,
    pub server_running: bool,
    pub started_at: Option<Instant>,
}

pub struct TerpsichoreManageState(pub Mutex<TerpsichoreState>);

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn get_server_config(
    state: tauri::State<'_, TerpsichoreManageState>,
) -> Result<TerpsichoreConfig, String> {
    let s = state.0.lock().map_err(|e| e.to_string())?;
    Ok(s.config.clone())
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn update_server_config(
    state: tauri::State<'_, TerpsichoreManageState>,
    config: TerpsichoreConfig,
) -> Result<(), String> {
    config.save().map_err(|e| e.to_string())?;
    let mut s = state.0.lock().map_err(|e| e.to_string())?;
    s.config = config;
    Ok(())
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn get_server_status(
    state: tauri::State<'_, TerpsichoreManageState>,
) -> Result<ServerStatus, String> {
    let s = state.0.lock().map_err(|e| e.to_string())?;
    Ok(ServerStatus {
        running: s.server_running,
        port: s.config.port,
        role: format!("{:?}", s.config.role).to_lowercase(),
        uptime_seconds: s
            .started_at
            .map(|t| t.elapsed().as_secs())
            .unwrap_or(0),
        request_count: 0,
    })
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub async fn start_server(
    state: tauri::State<'_, TerpsichoreManageState>,
) -> Result<(), String> {
    let config = {
        let mut s = state.0.lock().map_err(|e| e.to_string())?;
        if s.server_running {
            return Err("Server already running".to_string());
        }
        s.server_running = true;
        s.started_at = Some(Instant::now());
        s.config.clone()
    };

    tokio::spawn(async move {
        let server = CommandServer::new(config);
        if let Err(e) = server.start().await {
            eprintln!("Terpsichore server error: {}", e);
        }
    });

    Ok(())
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn stop_server(
    state: tauri::State<'_, TerpsichoreManageState>,
) -> Result<(), String> {
    let mut s = state.0.lock().map_err(|e| e.to_string())?;
    s.server_running = false;
    s.started_at = None;
    Ok(())
}
