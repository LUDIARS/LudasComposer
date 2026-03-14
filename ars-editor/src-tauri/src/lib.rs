pub mod commands;
pub mod models;
#[cfg(feature = "web-server")]
pub mod app_state;
#[cfg(feature = "web-server")]
pub mod auth;
#[cfg(feature = "web-server")]
pub mod dynamo;
#[cfg(feature = "web-server")]
pub mod git_ops;
#[cfg(feature = "web-server")]
pub mod web_server;

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
