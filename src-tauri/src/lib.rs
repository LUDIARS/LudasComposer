pub mod commands;
pub mod models;
pub mod services;

use commands::assembly::AssemblyState;
use commands::module_registry::RegistryState;
use services::{AssemblyManagerService, ModuleRegistryService};
use std::sync::Mutex;

/// Tauriアプリケーションの実行
pub fn run() {
    let registry_service = ModuleRegistryService::with_defaults()
        .unwrap_or_else(|_| {
            let cache_dir = std::env::temp_dir().join("ars").join("module-cache");
            ModuleRegistryService::new(cache_dir)
        });

    // アセンブリ管理サービスの初期化（プロジェクトルートはカレントディレクトリ）
    let assembly_service = AssemblyManagerService::load(
        std::env::current_dir().unwrap_or_else(|_| std::env::temp_dir().join("ars"))
    ).unwrap_or_else(|_| {
        AssemblyManagerService::new(
            std::env::current_dir().unwrap_or_else(|_| std::env::temp_dir().join("ars"))
        )
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(RegistryState(Mutex::new(registry_service)))
        .manage(AssemblyState(Mutex::new(assembly_service)))
        .invoke_handler(tauri::generate_handler![
            // モジュールレジストリコマンド
            commands::add_registry_source,
            commands::remove_registry_source,
            commands::sync_registry_source,
            commands::sync_all_sources,
            commands::get_all_modules,
            commands::get_modules_by_category,
            commands::search_modules,
            commands::get_registry_sources,
            commands::get_module_by_id,
            // アセンブリ管理コマンド
            commands::get_assembly_config,
            commands::add_release_depot,
            commands::remove_release_depot,
            commands::get_release_depots,
            commands::add_core_assembly,
            commands::update_core_assembly,
            commands::remove_core_assembly,
            commands::get_core_assemblies,
            commands::get_core_assembly,
            commands::add_app_assembly,
            commands::update_app_assembly,
            commands::remove_app_assembly,
            commands::get_app_assemblies,
            commands::get_app_assembly,
            commands::get_app_assemblies_by_scene,
            commands::set_resource_depot_ref,
            commands::set_data_organizer_ref,
            commands::resolve_core_dependencies,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
