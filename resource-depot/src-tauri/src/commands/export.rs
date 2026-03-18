use crate::models::export::*;
use crate::services::ExportService;
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

pub struct ExportState(pub Mutex<ExportService>);

#[derive(Debug, Serialize)]
pub struct CmdResult<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T: Serialize> CmdResult<T> {
    fn ok(data: T) -> Self {
        Self { success: true, data: Some(data), error: None }
    }
    fn err(msg: String) -> Self {
        Self { success: false, data: None, error: Some(msg) }
    }
}

/// MB→FBXエクスポート実行
#[tauri::command]
pub fn export_mb_to_fbx(
    state: State<'_, ExportState>,
    input_path: String,
    output_dir: Option<String>,
) -> CmdResult<ExportJob> {
    let mut service = state.0.lock().unwrap();
    match service.export_mb_to_fbx(&input_path, output_dir.as_deref()) {
        Ok(job) => CmdResult::ok(job),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

/// ファイルがMayaバイナリか判定
#[tauri::command]
pub fn is_maya_binary(path: String) -> CmdResult<bool> {
    CmdResult {
        success: true,
        data: Some(ExportService::is_maya_binary(&path)),
        error: None,
    }
}

/// エクスポート設定を更新
#[tauri::command]
pub fn update_export_config(
    state: State<'_, ExportState>,
    config: MbExportConfig,
) -> CmdResult<()> {
    let mut service = state.0.lock().unwrap();
    match service.update_config(config) {
        Ok(()) => CmdResult::ok(()),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

/// エクスポート設定を取得
#[tauri::command]
pub fn get_export_config(state: State<'_, ExportState>) -> CmdResult<MbExportConfig> {
    let service = state.0.lock().unwrap();
    CmdResult::ok(service.get_config().clone())
}

/// エクスポートジョブ履歴を取得
#[tauri::command]
pub fn get_export_jobs(state: State<'_, ExportState>) -> CmdResult<Vec<ExportJob>> {
    let service = state.0.lock().unwrap();
    CmdResult::ok(service.get_jobs().to_vec())
}

/// ジョブをIDで取得
#[tauri::command]
pub fn get_export_job(state: State<'_, ExportState>, job_id: String) -> CmdResult<ExportJob> {
    let service = state.0.lock().unwrap();
    match service.get_job(&job_id) {
        Some(j) => CmdResult::ok(j.clone()),
        None => CmdResult::err(format!("ジョブが見つかりません: {}", job_id)),
    }
}
