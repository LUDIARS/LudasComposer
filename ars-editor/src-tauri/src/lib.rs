pub mod commands;
pub mod models;
#[cfg(feature = "web-server")]
pub mod app_state;
#[cfg(feature = "web-server")]
pub mod auth;
#[cfg(feature = "web-server")]
pub mod git_ops;
#[cfg(feature = "web-server")]
pub mod web_server;
#[cfg(feature = "web-server")]
pub mod web_modules;
#[cfg(feature = "web-server")]
pub mod collab;
#[cfg(feature = "web-server")]
pub mod surrealdb_client;
#[cfg(feature = "web-server")]
pub mod redis_client;

#[cfg(feature = "tauri-app")]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::save_project,
            commands::load_project,
            commands::get_default_project_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
