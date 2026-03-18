pub mod commands;
pub mod models;
pub mod services;

use commands::depot::DepotState;
use commands::naming::NamingState;
use commands::export::ExportState;
use services::{ResourceDepotService, NamingService, ExportService};
use std::sync::Mutex;

pub fn run() {
    let cache_dir = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(".ars")
        .join("resource-depot");

    let depot_service = ResourceDepotService::with_defaults()
        .unwrap_or_else(|e| {
            eprintln!("Warning: Failed to init depot: {}", e);
            ResourceDepotService::new(std::env::temp_dir().join("ars").join("resource-depot"))
                .expect("Failed to initialize resource depot")
        });

    let naming_service = NamingService::new(cache_dir.clone())
        .expect("Failed to initialize naming service");

    let export_service = ExportService::new(cache_dir)
        .expect("Failed to initialize export service");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(DepotState(Mutex::new(depot_service)))
        .manage(NamingState(Mutex::new(naming_service)))
        .manage(ExportState(Mutex::new(export_service)))
        .invoke_handler(tauri::generate_handler![
            // リソース管理
            commands::depot::register_resource,
            commands::depot::remove_resource,
            commands::depot::get_all_resources,
            commands::depot::get_resources_by_category,
            commands::depot::search_resources,
            commands::depot::get_resource_by_id,
            commands::depot::register_bone_pattern,
            commands::depot::remove_bone_pattern,
            commands::depot::get_bone_patterns,
            commands::depot::detect_bone_pattern,
            commands::depot::find_compatible_motions,
            commands::depot::assign_motions_to_model,
            commands::depot::create_motion_group,
            commands::depot::update_motion_group,
            commands::depot::remove_motion_group,
            commands::depot::get_motion_groups,
            commands::depot::create_texture_group,
            commands::depot::update_texture_group,
            commands::depot::remove_texture_group,
            commands::depot::get_texture_groups,
            commands::depot::add_cloud_config,
            commands::depot::set_cloud_reference,
            commands::depot::find_duplicate_resources,
            commands::depot::get_depot_state,
            // ファイル名変換
            commands::naming::analyze_dropped_files,
            commands::naming::generate_english_name,
            commands::naming::add_naming_rule,
            commands::naming::remove_naming_rule,
            commands::naming::get_naming_rules,
            commands::naming::get_naming_config,
            commands::naming::set_category_prefix,
            // MB→FBXエクスポート
            commands::export::export_mb_to_fbx,
            commands::export::is_maya_binary,
            commands::export::update_export_config,
            commands::export::get_export_config,
            commands::export::get_export_jobs,
            commands::export::get_export_job,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
