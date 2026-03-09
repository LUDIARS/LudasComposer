use crate::models::*;
use crate::services::ModuleRegistryService;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

/// Tauriが管理するレジストリサービスの状態
pub struct RegistryState(pub Mutex<ModuleRegistryService>);

/// レジストリソース追加のパラメータ
#[derive(Debug, Deserialize)]
pub struct AddSourceParams {
    pub name: String,
    pub repo_url: String,
    pub definition_glob: Option<String>,
}

/// コマンド結果
#[derive(Debug, Serialize)]
pub struct CommandResult<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T: Serialize> CommandResult<T> {
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

/// レジストリソース（GitHubリポジトリ）を追加
#[tauri::command]
pub fn add_registry_source(
    state: State<'_, RegistryState>,
    params: AddSourceParams,
) -> CommandResult<ModuleRegistrySource> {
    let mut registry = state.0.lock().unwrap();
    let glob = params.definition_glob.unwrap_or_else(|| "**/*.md".to_string());

    match registry.add_source(&params.name, &params.repo_url, &glob) {
        Ok(source) => CommandResult::ok(source.clone()),
        Err(e) => CommandResult::err(e.to_string()),
    }
}

/// レジストリソースを削除
#[tauri::command]
pub fn remove_registry_source(
    state: State<'_, RegistryState>,
    source_id: String,
) -> CommandResult<()> {
    let mut registry = state.0.lock().unwrap();
    match registry.remove_source(&source_id) {
        Ok(()) => CommandResult::ok(()),
        Err(e) => CommandResult::err(e.to_string()),
    }
}

/// 指定ソースを同期（clone/pull + 定義パース）
#[tauri::command]
pub fn sync_registry_source(
    state: State<'_, RegistryState>,
    source_id: String,
) -> CommandResult<Vec<ModuleDefinition>> {
    let mut registry = state.0.lock().unwrap();
    match registry.sync_source(&source_id) {
        Ok(modules) => CommandResult::ok(modules),
        Err(e) => CommandResult::err(e.to_string()),
    }
}

/// 全ソースを同期
#[tauri::command]
pub fn sync_all_sources(
    state: State<'_, RegistryState>,
) -> CommandResult<Vec<ModuleDefinition>> {
    let mut registry = state.0.lock().unwrap();
    match registry.sync_all() {
        Ok(modules) => CommandResult::ok(modules),
        Err(e) => CommandResult::err(e.to_string()),
    }
}

/// 全モジュール定義を取得
#[tauri::command]
pub fn get_all_modules(
    state: State<'_, RegistryState>,
) -> CommandResult<Vec<ModuleDefinition>> {
    let registry = state.0.lock().unwrap();
    CommandResult::ok(registry.get_all_modules().to_vec())
}

/// カテゴリでモジュールをフィルタ
#[tauri::command]
pub fn get_modules_by_category(
    state: State<'_, RegistryState>,
    category: String,
) -> CommandResult<Vec<ModuleDefinition>> {
    let registry = state.0.lock().unwrap();
    let cat = match ModuleCategory::from_str(&category) {
        Some(c) => c,
        None => return CommandResult::err(format!("Invalid category: {}", category)),
    };
    let modules: Vec<ModuleDefinition> = registry
        .get_modules_by_category(&cat)
        .into_iter()
        .cloned()
        .collect();
    CommandResult::ok(modules)
}

/// モジュールを検索
#[tauri::command]
pub fn search_modules(
    state: State<'_, RegistryState>,
    query: String,
) -> CommandResult<Vec<ModuleDefinition>> {
    let registry = state.0.lock().unwrap();
    let modules: Vec<ModuleDefinition> = registry
        .search_modules(&query)
        .into_iter()
        .cloned()
        .collect();
    CommandResult::ok(modules)
}

/// 全ソースを取得
#[tauri::command]
pub fn get_registry_sources(
    state: State<'_, RegistryState>,
) -> CommandResult<Vec<ModuleRegistrySource>> {
    let registry = state.0.lock().unwrap();
    CommandResult::ok(registry.get_sources().to_vec())
}

/// IDでモジュールを取得
#[tauri::command]
pub fn get_module_by_id(
    state: State<'_, RegistryState>,
    module_id: String,
) -> CommandResult<ModuleDefinition> {
    let registry = state.0.lock().unwrap();
    match registry.get_module(&module_id) {
        Some(m) => CommandResult::ok(m.clone()),
        None => CommandResult::err(format!("Module not found: {}", module_id)),
    }
}
