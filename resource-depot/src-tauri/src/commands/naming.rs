use crate::models::naming::*;
use crate::services::NamingService;
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

pub struct NamingState(pub Mutex<NamingService>);

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

/// D&Dで受け取ったファイルを解析
#[tauri::command]
pub fn analyze_dropped_files(
    state: State<'_, NamingState>,
    paths: Vec<String>,
) -> CmdResult<Vec<DroppedFile>> {
    let service = state.0.lock().unwrap();
    CmdResult::ok(service.analyze_dropped_files(&paths))
}

/// 英語名を生成
#[tauri::command]
pub fn generate_english_name(
    state: State<'_, NamingState>,
    original_name: String,
    category: String,
) -> CmdResult<String> {
    use crate::models::resource::ResourceCategory;

    let cat = match category.to_lowercase().as_str() {
        "font" => ResourceCategory::Font,
        "model" => ResourceCategory::Model,
        "texture" => ResourceCategory::Texture,
        "motion" => ResourceCategory::Motion,
        "sound" => ResourceCategory::Sound,
        _ => return CmdResult::err(format!("不明なカテゴリ: {}", category)),
    };

    let service = state.0.lock().unwrap();
    CmdResult::ok(service.generate_english_name(&original_name, &cat))
}

/// ネーミングルールを追加
#[tauri::command]
pub fn add_naming_rule(
    state: State<'_, NamingState>,
    japanese_pattern: String,
    english_name: String,
) -> CmdResult<()> {
    let mut service = state.0.lock().unwrap();
    match service.add_rule(japanese_pattern, english_name) {
        Ok(()) => CmdResult::ok(()),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

/// ネーミングルールを削除
#[tauri::command]
pub fn remove_naming_rule(state: State<'_, NamingState>, index: usize) -> CmdResult<()> {
    let mut service = state.0.lock().unwrap();
    match service.remove_rule(index) {
        Ok(()) => CmdResult::ok(()),
        Err(e) => CmdResult::err(e.to_string()),
    }
}

/// 全ルールを取得
#[tauri::command]
pub fn get_naming_rules(state: State<'_, NamingState>) -> CmdResult<Vec<NamingRule>> {
    let service = state.0.lock().unwrap();
    CmdResult::ok(service.get_rules().to_vec())
}

/// ネーミング設定を取得
#[tauri::command]
pub fn get_naming_config(state: State<'_, NamingState>) -> CmdResult<NamingConfig> {
    let service = state.0.lock().unwrap();
    CmdResult::ok(service.get_config().clone())
}

/// カテゴリプレフィックスを更新
#[tauri::command]
pub fn set_category_prefix(
    state: State<'_, NamingState>,
    category: String,
    prefix: String,
) -> CmdResult<()> {
    let mut service = state.0.lock().unwrap();
    match service.set_category_prefix(category, prefix) {
        Ok(()) => CmdResult::ok(()),
        Err(e) => CmdResult::err(e.to_string()),
    }
}
