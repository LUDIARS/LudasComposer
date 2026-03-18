use crate::models::resource::*;
use crate::services::ResourceDepotService;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

pub struct DepotState(pub Mutex<ResourceDepotService>);

#[derive(Debug, Serialize)]
pub struct CmdResult<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T: Serialize> CmdResult<T> {
    pub fn ok(data: T) -> Self {
        Self { success: true, data: Some(data), error: None }
    }
    pub fn err(msg: String) -> Self {
        Self { success: false, data: None, error: Some(msg) }
    }
}

#[derive(Debug, Deserialize)]
pub struct RegisterResourceParams {
    pub original_filename: String,
    pub english_filename: String,
    pub role: String,
    pub category: ResourceCategory,
    pub file_path: String,
    pub metadata: ResourceMetadata,
}

#[derive(Debug, Deserialize)]
pub struct AssignMotionsParams {
    pub model_id: String,
    pub motion_ids: Vec<String>,
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
pub struct SetCloudReferenceParams {
    pub resource_id: String,
    pub cloud_ref: CloudReference,
}

// ─── リソース管理 ───

#[tauri::command]
pub fn register_resource(
    state: State<'_, DepotState>,
    params: RegisterResourceParams,
) -> CmdResult<Resource> {
    let mut depot = state.0.lock().unwrap();
    match depot.register_resource(
        params.original_filename,
        params.english_filename,
        params.role,
        params.category,
        &params.file_path,
        params.metadata,
    ) {
        Ok(r) => CmdResult::ok(r),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn remove_resource(state: State<'_, DepotState>, resource_id: String) -> CmdResult<()> {
    let mut depot = state.0.lock().unwrap();
    match depot.remove_resource(&resource_id) {
        Ok(()) => CmdResult::ok(()),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_all_resources(state: State<'_, DepotState>) -> CmdResult<Vec<Resource>> {
    let depot = state.0.lock().unwrap();
    CmdResult::ok(depot.get_all_resources())
}

#[tauri::command]
pub fn get_resources_by_category(
    state: State<'_, DepotState>,
    category: ResourceCategory,
) -> CmdResult<Vec<Resource>> {
    let depot = state.0.lock().unwrap();
    CmdResult::ok(depot.get_resources_by_category(&category))
}

#[tauri::command]
pub fn search_resources(state: State<'_, DepotState>, query: String) -> CmdResult<Vec<Resource>> {
    let depot = state.0.lock().unwrap();
    CmdResult::ok(depot.find_resources(&query))
}

#[tauri::command]
pub fn get_resource_by_id(state: State<'_, DepotState>, resource_id: String) -> CmdResult<Resource> {
    let depot = state.0.lock().unwrap();
    match depot.get_resource(&resource_id) {
        Ok(r) => CmdResult::ok(r.clone()),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

// ─── ボーンパターン ───

#[tauri::command]
pub fn register_bone_pattern(state: State<'_, DepotState>, pattern: BonePattern) -> CmdResult<BonePattern> {
    let mut depot = state.0.lock().unwrap();
    match depot.register_bone_pattern(pattern) {
        Ok(p) => CmdResult::ok(p),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn remove_bone_pattern(state: State<'_, DepotState>, pattern_id: String) -> CmdResult<()> {
    let mut depot = state.0.lock().unwrap();
    match depot.remove_bone_pattern(&pattern_id) {
        Ok(()) => CmdResult::ok(()),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_bone_patterns(state: State<'_, DepotState>) -> CmdResult<Vec<BonePattern>> {
    let depot = state.0.lock().unwrap();
    CmdResult::ok(depot.get_bone_patterns())
}

#[tauri::command]
pub fn detect_bone_pattern(state: State<'_, DepotState>, model_id: String) -> CmdResult<Option<String>> {
    let mut depot = state.0.lock().unwrap();
    match depot.detect_bone_pattern(&model_id) {
        Ok(id) => CmdResult::ok(id),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn find_compatible_motions(state: State<'_, DepotState>, bone_pattern_id: String) -> CmdResult<Vec<Resource>> {
    let depot = state.0.lock().unwrap();
    CmdResult::ok(depot.find_compatible_motions(&bone_pattern_id))
}

// ─── モーション ───

#[tauri::command]
pub fn assign_motions_to_model(state: State<'_, DepotState>, params: AssignMotionsParams) -> CmdResult<()> {
    let mut depot = state.0.lock().unwrap();
    match depot.assign_motions_to_model(&params.model_id, &params.motion_ids) {
        Ok(()) => CmdResult::ok(()),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn create_motion_group(state: State<'_, DepotState>, params: CreateMotionGroupParams) -> CmdResult<MotionGroup> {
    let mut depot = state.0.lock().unwrap();
    match depot.create_motion_group(params.name, params.motion_ids, params.bone_pattern_id) {
        Ok(g) => CmdResult::ok(g),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn update_motion_group(state: State<'_, DepotState>, group: MotionGroup) -> CmdResult<MotionGroup> {
    let mut depot = state.0.lock().unwrap();
    match depot.update_motion_group(group) {
        Ok(g) => CmdResult::ok(g),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn remove_motion_group(state: State<'_, DepotState>, group_id: String) -> CmdResult<()> {
    let mut depot = state.0.lock().unwrap();
    match depot.remove_motion_group(&group_id) {
        Ok(()) => CmdResult::ok(()),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_motion_groups(state: State<'_, DepotState>) -> CmdResult<Vec<MotionGroup>> {
    let depot = state.0.lock().unwrap();
    CmdResult::ok(depot.get_motion_groups())
}

// ─── テクスチャ ───

#[tauri::command]
pub fn create_texture_group(state: State<'_, DepotState>, params: CreateTextureGroupParams) -> CmdResult<TextureGroup> {
    let mut depot = state.0.lock().unwrap();
    match depot.create_texture_group(params.name, params.texture_ids, params.atlas_config) {
        Ok(g) => CmdResult::ok(g),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn update_texture_group(state: State<'_, DepotState>, group: TextureGroup) -> CmdResult<TextureGroup> {
    let mut depot = state.0.lock().unwrap();
    match depot.update_texture_group(group) {
        Ok(g) => CmdResult::ok(g),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn remove_texture_group(state: State<'_, DepotState>, group_id: String) -> CmdResult<()> {
    let mut depot = state.0.lock().unwrap();
    match depot.remove_texture_group(&group_id) {
        Ok(()) => CmdResult::ok(()),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_texture_groups(state: State<'_, DepotState>) -> CmdResult<Vec<TextureGroup>> {
    let depot = state.0.lock().unwrap();
    CmdResult::ok(depot.get_texture_groups())
}

// ─── クラウド ───

#[tauri::command]
pub fn add_cloud_config(state: State<'_, DepotState>, config: CloudStorageConfig) -> CmdResult<()> {
    let mut depot = state.0.lock().unwrap();
    match depot.add_cloud_config(config) {
        Ok(()) => CmdResult::ok(()),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn set_cloud_reference(state: State<'_, DepotState>, params: SetCloudReferenceParams) -> CmdResult<()> {
    let mut depot = state.0.lock().unwrap();
    match depot.set_cloud_reference(&params.resource_id, params.cloud_ref) {
        Ok(()) => CmdResult::ok(()),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

#[tauri::command]
pub fn find_duplicate_resources(state: State<'_, DepotState>) -> CmdResult<std::collections::HashMap<String, Vec<String>>> {
    let depot = state.0.lock().unwrap();
    CmdResult::ok(depot.find_duplicate_resources())
}

#[tauri::command]
pub fn get_depot_state(state: State<'_, DepotState>) -> CmdResult<ResourceDepot> {
    let depot = state.0.lock().unwrap();
    CmdResult::ok(depot.get_depot().clone())
}
