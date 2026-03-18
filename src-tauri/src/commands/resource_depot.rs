use crate::models::resource_depot::*;
use crate::services::ResourceDepotService;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

/// Tauriが管理するリソースデポサービスの状態
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

// ─── リソース登録パラメータ ───

#[derive(Debug, Deserialize)]
pub struct RegisterResourceParams {
    pub filename: String,
    pub role: String,
    pub category: ResourceCategory,
    pub file_path: String,
    pub metadata: ResourceMetadata,
}

#[derive(Debug, Deserialize)]
pub struct CreateMotionGroupParams {
    pub name: String,
    pub motion_ids: Vec<String>,
    pub bone_pattern_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTextureGroupParams {
    pub name: String,
    pub texture_ids: Vec<String>,
    pub atlas_config: Option<AtlasConfig>,
}

#[derive(Debug, Deserialize)]
pub struct AssignMotionsParams {
    pub model_id: String,
    pub motion_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct SetCloudReferenceParams {
    pub resource_id: String,
    pub cloud_ref: CloudReference,
}

// ─── リソース管理コマンド ───

/// リソースを登録
#[tauri::command]
pub fn register_resource(
    state: State<'_, ResourceDepotState>,
    params: RegisterResourceParams,
) -> DepotCommandResult<Resource> {
    let mut depot = state.0.lock().unwrap();
    match depot.register_resource(
        params.filename,
        params.role,
        params.category,
        &params.file_path,
        params.metadata,
    ) {
        Ok(resource) => DepotCommandResult::ok(resource),
        Err(e) => DepotCommandResult::err(e.to_string()),
    }
}

/// リソースを削除
#[tauri::command]
pub fn remove_resource(
    state: State<'_, ResourceDepotState>,
    resource_id: String,
) -> DepotCommandResult<()> {
    let mut depot = state.0.lock().unwrap();
    match depot.remove_resource(&resource_id) {
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

// ─── ボーンパターンコマンド ───

/// ボーンパターン登録
#[tauri::command]
pub fn register_bone_pattern(
    state: State<'_, ResourceDepotState>,
    pattern: BonePattern,
) -> DepotCommandResult<BonePattern> {
    let mut depot = state.0.lock().unwrap();
    match depot.register_bone_pattern(pattern) {
        Ok(p) => DepotCommandResult::ok(p),
        Err(e) => DepotCommandResult::err(e.to_string()),
    }
}

/// ボーンパターン削除
#[tauri::command]
pub fn remove_bone_pattern(
    state: State<'_, ResourceDepotState>,
    pattern_id: String,
) -> DepotCommandResult<()> {
    let mut depot = state.0.lock().unwrap();
    match depot.remove_bone_pattern(&pattern_id) {
        Ok(()) => DepotCommandResult::ok(()),
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

/// モデルのボーンパターンを自動検出
#[tauri::command]
pub fn detect_bone_pattern(
    state: State<'_, ResourceDepotState>,
    model_id: String,
) -> DepotCommandResult<Option<String>> {
    let mut depot = state.0.lock().unwrap();
    match depot.detect_bone_pattern(&model_id) {
        Ok(pattern_id) => DepotCommandResult::ok(pattern_id),
        Err(e) => DepotCommandResult::err(e.to_string()),
    }
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

// ─── モーションアサイン・グループコマンド ───

/// モデルにモーションをアサイン
#[tauri::command]
pub fn assign_motions_to_model(
    state: State<'_, ResourceDepotState>,
    params: AssignMotionsParams,
) -> DepotCommandResult<()> {
    let mut depot = state.0.lock().unwrap();
    match depot.assign_motions_to_model(&params.model_id, &params.motion_ids) {
        Ok(()) => DepotCommandResult::ok(()),
        Err(e) => DepotCommandResult::err(e.to_string()),
    }
}

/// モーショングループ作成
#[tauri::command]
pub fn create_motion_group(
    state: State<'_, ResourceDepotState>,
    params: CreateMotionGroupParams,
) -> DepotCommandResult<MotionGroup> {
    let mut depot = state.0.lock().unwrap();
    match depot.create_motion_group(params.name, params.motion_ids, params.bone_pattern_id) {
        Ok(group) => DepotCommandResult::ok(group),
        Err(e) => DepotCommandResult::err(e.to_string()),
    }
}

/// モーショングループ更新
#[tauri::command]
pub fn update_motion_group(
    state: State<'_, ResourceDepotState>,
    group: MotionGroup,
) -> DepotCommandResult<MotionGroup> {
    let mut depot = state.0.lock().unwrap();
    match depot.update_motion_group(group) {
        Ok(g) => DepotCommandResult::ok(g),
        Err(e) => DepotCommandResult::err(e.to_string()),
    }
}

/// モーショングループ削除
#[tauri::command]
pub fn remove_motion_group(
    state: State<'_, ResourceDepotState>,
    group_id: String,
) -> DepotCommandResult<()> {
    let mut depot = state.0.lock().unwrap();
    match depot.remove_motion_group(&group_id) {
        Ok(()) => DepotCommandResult::ok(()),
        Err(e) => DepotCommandResult::err(e.to_string()),
    }
}

/// 全モーショングループ取得
#[tauri::command]
pub fn get_motion_groups(
    state: State<'_, ResourceDepotState>,
) -> DepotCommandResult<Vec<MotionGroup>> {
    let depot = state.0.lock().unwrap();
    DepotCommandResult::ok(depot.get_motion_groups())
}

// ─── テクスチャグループコマンド ───

/// テクスチャグループ作成
#[tauri::command]
pub fn create_texture_group(
    state: State<'_, ResourceDepotState>,
    params: CreateTextureGroupParams,
) -> DepotCommandResult<TextureGroup> {
    let mut depot = state.0.lock().unwrap();
    match depot.create_texture_group(params.name, params.texture_ids, params.atlas_config) {
        Ok(group) => DepotCommandResult::ok(group),
        Err(e) => DepotCommandResult::err(e.to_string()),
    }
}

/// テクスチャグループ更新
#[tauri::command]
pub fn update_texture_group(
    state: State<'_, ResourceDepotState>,
    group: TextureGroup,
) -> DepotCommandResult<TextureGroup> {
    let mut depot = state.0.lock().unwrap();
    match depot.update_texture_group(group) {
        Ok(g) => DepotCommandResult::ok(g),
        Err(e) => DepotCommandResult::err(e.to_string()),
    }
}

/// テクスチャグループ削除
#[tauri::command]
pub fn remove_texture_group(
    state: State<'_, ResourceDepotState>,
    group_id: String,
) -> DepotCommandResult<()> {
    let mut depot = state.0.lock().unwrap();
    match depot.remove_texture_group(&group_id) {
        Ok(()) => DepotCommandResult::ok(()),
        Err(e) => DepotCommandResult::err(e.to_string()),
    }
}

/// 全テクスチャグループ取得
#[tauri::command]
pub fn get_texture_groups(
    state: State<'_, ResourceDepotState>,
) -> DepotCommandResult<Vec<TextureGroup>> {
    let depot = state.0.lock().unwrap();
    DepotCommandResult::ok(depot.get_texture_groups())
}

// ─── クラウドストレージコマンド ───

/// クラウドストレージ設定追加
#[tauri::command]
pub fn add_cloud_config(
    state: State<'_, ResourceDepotState>,
    config: CloudStorageConfig,
) -> DepotCommandResult<()> {
    let mut depot = state.0.lock().unwrap();
    match depot.add_cloud_config(config) {
        Ok(()) => DepotCommandResult::ok(()),
        Err(e) => DepotCommandResult::err(e.to_string()),
    }
}

/// リソースにクラウド参照を設定
#[tauri::command]
pub fn set_cloud_reference(
    state: State<'_, ResourceDepotState>,
    params: SetCloudReferenceParams,
) -> DepotCommandResult<()> {
    let mut depot = state.0.lock().unwrap();
    match depot.set_cloud_reference(&params.resource_id, params.cloud_ref) {
        Ok(()) => DepotCommandResult::ok(()),
        Err(e) => DepotCommandResult::err(e.to_string()),
    }
}

// ─── 共通リソース発見コマンド ───

/// 重複リソースを検出
#[tauri::command]
pub fn find_duplicate_resources(
    state: State<'_, ResourceDepotState>,
) -> DepotCommandResult<std::collections::HashMap<String, Vec<String>>> {
    let depot = state.0.lock().unwrap();
    DepotCommandResult::ok(depot.find_duplicate_resources())
}

/// デポ全体の状態を取得
#[tauri::command]
pub fn get_depot_state(
    state: State<'_, ResourceDepotState>,
) -> DepotCommandResult<ResourceDepot> {
    let depot = state.0.lock().unwrap();
    DepotCommandResult::ok(depot.get_depot().clone())
}
