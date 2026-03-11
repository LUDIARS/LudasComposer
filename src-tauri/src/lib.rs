pub mod commands;
pub mod models;
pub mod services;

use commands::module_registry::RegistryState;
use services::ModuleRegistryService;
use std::sync::Mutex;

/// Tauriアプリケーションの実行
pub fn run() {
    let registry_service = ModuleRegistryService::with_defaults()
        .unwrap_or_else(|_| {
            let cache_dir = std::env::temp_dir().join("ludas-composer").join("module-cache");
            ModuleRegistryService::new(cache_dir)
        });

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(RegistryState(Mutex::new(registry_service)))
        .invoke_handler(tauri::generate_handler![
            commands::add_registry_source,
            commands::remove_registry_source,
            commands::sync_registry_source,
            commands::sync_all_sources,
            commands::get_all_modules,
            commands::get_modules_by_category,
            commands::search_modules,
            commands::get_registry_sources,
            commands::get_module_by_id,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
