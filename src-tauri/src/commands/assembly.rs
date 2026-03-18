use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

use crate::models::assembly::*;
use crate::services::assembly_manager::AssemblyManagerService;

/// アセンブリ管理の共有状態
pub struct AssemblyState(pub Mutex<AssemblyManagerService>);

/// コマンド結果
#[derive(Serialize)]
pub struct AssemblyCommandResult<T: Serialize> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl<T: Serialize> AssemblyCommandResult<T> {
    fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }
    fn err(msg: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(msg),
        }
    }
}

// ─── アセンブリ設定全体 ───

#[tauri::command]
pub fn get_assembly_config(
    state: State<'_, AssemblyState>,
) -> AssemblyCommandResult<ProjectAssemblyConfig> {
    let service = state.0.lock().unwrap();
    AssemblyCommandResult::ok(service.get_config().clone())
}

// ─── リリースデポ ───

#[derive(Deserialize)]
pub struct AddDepotParams {
    pub name: String,
    pub url: String,
    pub auth_token: Option<String>,
}

#[tauri::command]
pub fn add_release_depot(
    state: State<'_, AssemblyState>,
    params: AddDepotParams,
) -> AssemblyCommandResult<()> {
    let mut service = state.0.lock().unwrap();
    let depot = ReleaseDepotConfig {
        name: params.name,
        url: params.url,
        auth_token: params.auth_token,
    };
    match service.add_release_depot(depot) {
        Ok(()) => AssemblyCommandResult::ok(()),
        Err(e) => AssemblyCommandResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn remove_release_depot(
    state: State<'_, AssemblyState>,
    name: String,
) -> AssemblyCommandResult<()> {
    let mut service = state.0.lock().unwrap();
    match service.remove_release_depot(&name) {
        Ok(()) => AssemblyCommandResult::ok(()),
        Err(e) => AssemblyCommandResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_release_depots(
    state: State<'_, AssemblyState>,
) -> AssemblyCommandResult<Vec<ReleaseDepotConfig>> {
    let service = state.0.lock().unwrap();
    AssemblyCommandResult::ok(service.get_release_depots().to_vec())
}

// ─── コアアセンブリ ───

#[tauri::command]
pub fn add_core_assembly(
    state: State<'_, AssemblyState>,
    assembly: CoreAssembly,
) -> AssemblyCommandResult<()> {
    let mut service = state.0.lock().unwrap();
    match service.add_core_assembly(assembly) {
        Ok(()) => AssemblyCommandResult::ok(()),
        Err(e) => AssemblyCommandResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn update_core_assembly(
    state: State<'_, AssemblyState>,
    assembly: CoreAssembly,
) -> AssemblyCommandResult<()> {
    let mut service = state.0.lock().unwrap();
    match service.update_core_assembly(assembly) {
        Ok(()) => AssemblyCommandResult::ok(()),
        Err(e) => AssemblyCommandResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn remove_core_assembly(
    state: State<'_, AssemblyState>,
    id: String,
) -> AssemblyCommandResult<()> {
    let mut service = state.0.lock().unwrap();
    match service.remove_core_assembly(&id) {
        Ok(()) => AssemblyCommandResult::ok(()),
        Err(e) => AssemblyCommandResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_core_assemblies(
    state: State<'_, AssemblyState>,
) -> AssemblyCommandResult<Vec<CoreAssembly>> {
    let service = state.0.lock().unwrap();
    AssemblyCommandResult::ok(service.get_core_assemblies().to_vec())
}

#[tauri::command]
pub fn get_core_assembly(
    state: State<'_, AssemblyState>,
    id: String,
) -> AssemblyCommandResult<CoreAssembly> {
    let service = state.0.lock().unwrap();
    match service.get_core_assembly(&id) {
        Some(a) => AssemblyCommandResult::ok(a.clone()),
        None => AssemblyCommandResult::err(format!("Core assembly not found: {}", id)),
    }
}

// ─── アプリケーションアセンブリ ───

#[tauri::command]
pub fn add_app_assembly(
    state: State<'_, AssemblyState>,
    assembly: ApplicationAssembly,
) -> AssemblyCommandResult<()> {
    let mut service = state.0.lock().unwrap();
    match service.add_app_assembly(assembly) {
        Ok(()) => AssemblyCommandResult::ok(()),
        Err(e) => AssemblyCommandResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn update_app_assembly(
    state: State<'_, AssemblyState>,
    assembly: ApplicationAssembly,
) -> AssemblyCommandResult<()> {
    let mut service = state.0.lock().unwrap();
    match service.update_app_assembly(assembly) {
        Ok(()) => AssemblyCommandResult::ok(()),
        Err(e) => AssemblyCommandResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn remove_app_assembly(
    state: State<'_, AssemblyState>,
    id: String,
) -> AssemblyCommandResult<()> {
    let mut service = state.0.lock().unwrap();
    match service.remove_app_assembly(&id) {
        Ok(()) => AssemblyCommandResult::ok(()),
        Err(e) => AssemblyCommandResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_app_assemblies(
    state: State<'_, AssemblyState>,
) -> AssemblyCommandResult<Vec<ApplicationAssembly>> {
    let service = state.0.lock().unwrap();
    AssemblyCommandResult::ok(service.get_app_assemblies().to_vec())
}

#[tauri::command]
pub fn get_app_assembly(
    state: State<'_, AssemblyState>,
    id: String,
) -> AssemblyCommandResult<ApplicationAssembly> {
    let service = state.0.lock().unwrap();
    match service.get_app_assembly(&id) {
        Some(a) => AssemblyCommandResult::ok(a.clone()),
        None => AssemblyCommandResult::err(format!("Application assembly not found: {}", id)),
    }
}

#[tauri::command]
pub fn get_app_assemblies_by_scene(
    state: State<'_, AssemblyState>,
    scene_id: String,
) -> AssemblyCommandResult<Vec<ApplicationAssembly>> {
    let service = state.0.lock().unwrap();
    let results: Vec<ApplicationAssembly> = service
        .get_app_assemblies_by_scene(&scene_id)
        .into_iter()
        .cloned()
        .collect();
    AssemblyCommandResult::ok(results)
}

// ─── 外部システム参照 ───

#[tauri::command]
pub fn set_resource_depot_ref(
    state: State<'_, AssemblyState>,
    depot_ref: Option<ResourceDepotRef>,
) -> AssemblyCommandResult<()> {
    let mut service = state.0.lock().unwrap();
    match service.set_resource_depot_ref(depot_ref) {
        Ok(()) => AssemblyCommandResult::ok(()),
        Err(e) => AssemblyCommandResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn set_data_organizer_ref(
    state: State<'_, AssemblyState>,
    org_ref: Option<DataOrganizerRef>,
) -> AssemblyCommandResult<()> {
    let mut service = state.0.lock().unwrap();
    match service.set_data_organizer_ref(org_ref) {
        Ok(()) => AssemblyCommandResult::ok(()),
        Err(e) => AssemblyCommandResult::err(e.to_string()),
    }
}

// ─── 依存関係 ───

#[tauri::command]
pub fn resolve_core_dependencies(
    state: State<'_, AssemblyState>,
    app_assembly_id: String,
) -> AssemblyCommandResult<Vec<CoreAssembly>> {
    let service = state.0.lock().unwrap();
    match service.resolve_core_dependencies(&app_assembly_id) {
        Ok(deps) => AssemblyCommandResult::ok(deps.into_iter().cloned().collect()),
        Err(e) => AssemblyCommandResult::err(e.to_string()),
    }
}
