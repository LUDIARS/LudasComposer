use crate::models::resource_depot::*;
use crate::services::ResourceDepotService;
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

/// Tauriが管理するリソースデポの状態（リードオンリー）
pub struct ResourceDepotState(pub Mutex<ResourceDepotService>);

/// コマンド結果
#[derive(Debug, Serialize)]
pub struct DepotCommandResult<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T: Serialize> DepotCommandResult<T> {
    fn ok(data: T) -> Self {
        Self { success: true, data: Some(data), error: None }
    }
    fn err(msg: String) -> Self {
        Self { success: false, data: None, error: Some(msg) }
    }
}

// ─── リードオンリーコマンド ───

/// デポデータを再読み込み（ツール側の更新を反映）
#[tauri::command]
pub fn reload_depot(state: State<'_, ResourceDepotState>) -> DepotCommandResult<()> {
    let mut depot = state.0.lock().unwrap();
    match depot.reload() {
        Ok(()) => DepotCommandResult::ok(()),
        Err(e) => DepotCommandResult::err(e.to_string()),
    }
}

/// 全リソース取得
#[tauri::command]
pub fn get_all_resources(
    state: State<'_, ResourceDepotState>,
) -> DepotCommandResult<Vec<Resource>> {
    let depot = state.0.lock().unwrap();
    DepotCommandResult::ok(depot.get_all_resources())
}

/// カテゴリ別リソース取得
#[tauri::command]
pub fn get_resources_by_category(
    state: State<'_, ResourceDepotState>,
    category: ResourceCategory,
) -> DepotCommandResult<Vec<Resource>> {
    let depot = state.0.lock().unwrap();
    DepotCommandResult::ok(depot.get_resources_by_category(&category))
}

/// リソース検索
#[tauri::command]
pub fn search_resources(
    state: State<'_, ResourceDepotState>,
    query: String,
) -> DepotCommandResult<Vec<Resource>> {
    let depot = state.0.lock().unwrap();
    DepotCommandResult::ok(depot.find_resources(&query))
}

/// IDでリソース取得
#[tauri::command]
pub fn get_resource_by_id(
    state: State<'_, ResourceDepotState>,
    resource_id: String,
) -> DepotCommandResult<Resource> {
    let depot = state.0.lock().unwrap();
    match depot.get_resource(&resource_id) {
        Ok(r) => DepotCommandResult::ok(r.clone()),
        Err(e) => DepotCommandResult::err(e.to_string()),
    }
}

/// 全ボーンパターン取得
#[tauri::command]
pub fn get_bone_patterns(
    state: State<'_, ResourceDepotState>,
) -> DepotCommandResult<Vec<BonePattern>> {
    let depot = state.0.lock().unwrap();
    DepotCommandResult::ok(depot.get_bone_patterns())
}

/// ボーンパターンに適合するモーション検索
#[tauri::command]
pub fn find_compatible_motions(
    state: State<'_, ResourceDepotState>,
    bone_pattern_id: String,
) -> DepotCommandResult<Vec<Resource>> {
    let depot = state.0.lock().unwrap();
    DepotCommandResult::ok(depot.find_compatible_motions(&bone_pattern_id))
}

/// 全モーショングループ取得
#[tauri::command]
pub fn get_motion_groups(
    state: State<'_, ResourceDepotState>,
) -> DepotCommandResult<Vec<MotionGroup>> {
    let depot = state.0.lock().unwrap();
    DepotCommandResult::ok(depot.get_motion_groups())
}

/// 全テクスチャグループ取得
#[tauri::command]
pub fn get_texture_groups(
    state: State<'_, ResourceDepotState>,
) -> DepotCommandResult<Vec<TextureGroup>> {
    let depot = state.0.lock().unwrap();
    DepotCommandResult::ok(depot.get_texture_groups())
}

/// デポ全体の状態を取得
#[tauri::command]
pub fn get_depot_state(
    state: State<'_, ResourceDepotState>,
) -> DepotCommandResult<ResourceDepot> {
    let depot = state.0.lock().unwrap();
    DepotCommandResult::ok(depot.get_depot().clone())
}
