use crate::models::config::MelpomeneConfig;

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn get_config() -> Result<MelpomeneConfig, String> {
    Ok(MelpomeneConfig::load())
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn update_config(config: MelpomeneConfig) -> Result<(), String> {
    config.save().map_err(|e| e.to_string())
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn is_configured() -> Result<bool, String> {
    let config = MelpomeneConfig::load();
    Ok(config.is_configured())
}
