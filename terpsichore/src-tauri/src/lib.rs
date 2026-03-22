pub mod models;
pub mod services;

#[cfg(feature = "tauri-app")]
pub mod commands;

#[cfg(feature = "tauri-app")]
pub fn run() {
    use commands::server::{TerpsichoreManageState, TerpsichoreState};
    use models::config::TerpsichoreConfig;
    use std::sync::Mutex;

    let config = TerpsichoreConfig::load();

    tauri::Builder::default()
        .manage(TerpsichoreManageState(Mutex::new(TerpsichoreState {
            config,
            server_running: false,
            started_at: None,
        })))
        .invoke_handler(tauri::generate_handler![
            commands::server::get_server_config,
            commands::server::update_server_config,
            commands::server::get_server_status,
            commands::server::start_server,
            commands::server::stop_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running terpsichore");
}
