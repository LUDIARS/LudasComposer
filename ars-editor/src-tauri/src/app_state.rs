use ars_secrets::profile::{ProfileConfig, ProfileManager};

use crate::cernere_client::CernereClient;

#[derive(Clone)]
pub struct AppState {
    pub cernere: CernereClient,
    pub profile_name: String,
}

impl AppState {
    /// プロファイルから初期化。
    ///
    /// 解決順序:
    /// 1. 環境変数 `ARS_PROFILE` で指定されたプロファイル
    /// 2. `~/.config/ars/active_profile` に記録されたアクティブプロファイル
    /// 3. 環境変数 `CERNERE_URL` (レガシー互換)
    /// 4. デフォルト (localhost:8080)
    pub fn new() -> Self {
        let manager = ProfileManager::new();

        // 1. 環境変数で指定されたプロファイル
        if let Ok(profile_name) = std::env::var("ARS_PROFILE") {
            if let Ok(config) = manager.load(&profile_name) {
                log::info!("Using profile '{}' ({})", profile_name, config.name);
                return Self::from_profile(&profile_name, &config);
            }
            log::warn!("Profile '{}' not found, falling back", profile_name);
        }

        // 2. アクティブプロファイル
        if let Ok(config) = manager.load_active() {
            let name = manager.active_name().unwrap_or_default();
            log::info!("Using active profile '{}' ({})", name, config.name);
            return Self::from_profile(&name, &config);
        }

        // 3. レガシー: CERNERE_URL 環境変数
        let cernere_url = std::env::var("CERNERE_URL")
            .unwrap_or_else(|_| "http://localhost:8080".to_string());
        log::info!("No profile found, using CERNERE_URL={}", cernere_url);

        Self {
            cernere: CernereClient::new(&cernere_url),
            profile_name: "default".to_string(),
        }
    }

    fn from_profile(name: &str, config: &ProfileConfig) -> Self {
        Self {
            cernere: CernereClient::new(&config.cernere.url),
            profile_name: name.to_string(),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
