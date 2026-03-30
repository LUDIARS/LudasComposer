pub mod commands;
pub mod models;
#[cfg(feature = "web-server")]
pub mod app_state;
#[cfg(feature = "web-server")]
pub mod cernere_client;
#[cfg(feature = "web-server")]
pub mod git_ops;
#[cfg(feature = "web-server")]
pub mod git_module_ops;
#[cfg(feature = "web-server")]
pub mod web_server;
#[cfg(feature = "web-server")]
pub mod web_modules;
#[cfg(feature = "web-server")]
pub mod collab;

#[cfg(feature = "tauri-app")]
pub fn run() {
    use std::sync::Arc;
    use ars_core::repository::{ProjectRepository, SessionRepository, UserRepository};

    // ローカルファイルベースのRepository実装を注入
    let project_repo: Arc<dyn ProjectRepository> = match ars_project::LocalProjectRepository::with_defaults() {
        Ok(repo) => Arc::new(repo),
        Err(e) => {
            eprintln!("Failed to initialize project repository: {}", e);
            std::process::exit(1);
        }
    };
    let user_repo: Arc<dyn UserRepository> = match ars_project::LocalUserRepository::with_defaults() {
        Ok(repo) => Arc::new(repo),
        Err(e) => {
            eprintln!("Failed to initialize user repository: {}", e);
            std::process::exit(1);
        }
    };
    let session_repo: Arc<dyn SessionRepository> = match ars_project::LocalSessionRepository::with_defaults() {
        Ok(repo) => Arc::new(repo),
        Err(e) => {
            eprintln!("Failed to initialize session repository: {}", e);
            std::process::exit(1);
        }
    };

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
        .manage(project_repo)
        .manage(user_repo)
        .manage(session_repo)
        .invoke_handler(tauri::generate_handler![
            commands::save_project,
            commands::load_project,
            commands::get_default_project_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
