pub mod commands;
pub mod models;
pub mod services;

use commands::module_registry::RegistryState;
use commands::resource_depot::ResourceDepotState;
use services::ModuleRegistryService;
use services::ResourceDepotService;
use std::sync::Mutex;

/// Tauriアプリケーションの実行
pub fn run() {
    let registry_service = ModuleRegistryService::with_defaults()
        .unwrap_or_else(|_| {
            let cache_dir = std::env::temp_dir().join("ars").join("module-cache");
            ModuleRegistryService::new(cache_dir)
        });

    let depot_service = ResourceDepotService::with_defaults()
        .unwrap_or_else(|e| {
            eprintln!("Warning: Failed to initialize resource depot with defaults: {}", e);
            let cache_dir = std::env::temp_dir().join("ars").join("resource-depot");
            ResourceDepotService::new(cache_dir)
                .expect("Failed to initialize resource depot")
        });

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(RegistryState(Mutex::new(registry_service)))
        .manage(ResourceDepotState(Mutex::new(depot_service)))
        .invoke_handler(tauri::generate_handler![
            // モジュールレジストリ
            commands::add_registry_source,
            commands::remove_registry_source,
            commands::sync_registry_source,
            commands::sync_all_sources,
            commands::get_all_modules,
            commands::get_modules_by_category,
            commands::search_modules,
            commands::get_registry_sources,
            commands::get_module_by_id,
            // リソースデポ
            commands::resource_depot::register_resource,
            commands::resource_depot::remove_resource,
            commands::resource_depot::get_all_resources,
            commands::resource_depot::get_resources_by_category,
            commands::resource_depot::search_resources,
            commands::resource_depot::get_resource_by_id,
            commands::resource_depot::register_bone_pattern,
            commands::resource_depot::remove_bone_pattern,
            commands::resource_depot::get_bone_patterns,
            commands::resource_depot::detect_bone_pattern,
            commands::resource_depot::find_compatible_motions,
            commands::resource_depot::assign_motions_to_model,
            commands::resource_depot::create_motion_group,
            commands::resource_depot::update_motion_group,
            commands::resource_depot::remove_motion_group,
            commands::resource_depot::get_motion_groups,
            commands::resource_depot::create_texture_group,
            commands::resource_depot::update_texture_group,
            commands::resource_depot::remove_texture_group,
            commands::resource_depot::get_texture_groups,
            commands::resource_depot::add_cloud_config,
            commands::resource_depot::set_cloud_reference,
            commands::resource_depot::find_duplicate_resources,
            commands::resource_depot::get_depot_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
