//! 組織プロファイル管理
//!
//! 組織ごとに Cernere URL や Infisical 設定を切り替えるための仕組み。
//!
//! ```
//! ~/.config/ars/
//! ├── active_profile        # 現在選択中のプロファイル名
//! └── profiles/
//!     ├── ludiars.toml
//!     ├── client-a.toml
//!     └── local.toml
//! ```

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::config::InfisicalConfig;
use crate::error::SecretsError;

// ── Profile config ───────────────────────────────────────────

/// 組織プロファイル設定
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ProfileConfig {
    /// プロファイル表示名
    pub name: String,

    /// Cernere 接続設定
    pub cernere: CernereConfig,

    /// シークレット管理設定
    #[serde(default)]
    pub secrets: SecretsSection,
}

/// Cernere サーバー接続設定
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CernereConfig {
    /// Cernere サーバー URL
    pub url: String,
}

/// シークレット管理設定
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SecretsSection {
    /// プロバイダー: "infisical" | "none"
    #[serde(default = "default_provider")]
    pub provider: String,

    /// Infisical 設定 (provider = "infisical" 時のみ使用)
    #[serde(default)]
    pub infisical: Option<InfisicalConfig>,
}

impl Default for SecretsSection {
    fn default() -> Self {
        Self {
            provider: "none".to_string(),
            infisical: None,
        }
    }
}

fn default_provider() -> String {
    "none".to_string()
}

// ── Profile manager ──────────────────────────────────────────

/// プロファイルの読み込み・切り替えを管理
pub struct ProfileManager {
    profiles_dir: PathBuf,
    active_profile_path: PathBuf,
}

impl ProfileManager {
    /// デフォルトのプロファイルディレクトリで初期化
    pub fn new() -> Self {
        let base = config_dir().join("ars");
        Self {
            profiles_dir: base.join("profiles"),
            active_profile_path: base.join("active_profile"),
        }
    }

    /// カスタムディレクトリで初期化
    pub fn with_dir(base: &Path) -> Self {
        Self {
            profiles_dir: base.join("profiles"),
            active_profile_path: base.join("active_profile"),
        }
    }

    /// 利用可能なプロファイル名一覧
    pub fn list(&self) -> Vec<String> {
        let mut profiles = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&self.profiles_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map(|e| e == "toml").unwrap_or(false) {
                    if let Some(stem) = path.file_stem() {
                        profiles.push(stem.to_string_lossy().to_string());
                    }
                }
            }
        }
        profiles.sort();
        profiles
    }

    /// 現在アクティブなプロファイル名を取得
    pub fn active_name(&self) -> Option<String> {
        std::fs::read_to_string(&self.active_profile_path)
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    }

    /// アクティブなプロファイルを切り替え
    pub fn set_active(&self, name: &str) -> Result<(), SecretsError> {
        // プロファイルが存在するか確認
        let path = self.profile_path(name);
        if !path.exists() {
            return Err(SecretsError::ConfigNotFound(path));
        }
        if let Some(parent) = self.active_profile_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&self.active_profile_path, name)?;
        log::info!("Active profile set to: {}", name);
        Ok(())
    }

    /// プロファイルを読み込む
    pub fn load(&self, name: &str) -> Result<ProfileConfig, SecretsError> {
        let path = self.profile_path(name);
        if !path.exists() {
            return Err(SecretsError::ConfigNotFound(path));
        }
        let content = std::fs::read_to_string(&path)?;
        let config: ProfileConfig = toml::from_str(&content)
            .map_err(|e| SecretsError::Io(std::io::Error::other(e.to_string())))?;
        Ok(config)
    }

    /// アクティブなプロファイルを読み込む
    pub fn load_active(&self) -> Result<ProfileConfig, SecretsError> {
        let name = self.active_name().ok_or_else(|| {
            SecretsError::ConfigNotFound(self.active_profile_path.clone())
        })?;
        self.load(&name)
    }

    /// アクティブなプロファイルを読み込む。未設定の場合はデフォルトを返す。
    pub fn load_active_or_default(&self) -> ProfileConfig {
        match self.load_active() {
            Ok(config) => config,
            Err(_) => {
                log::info!("No active profile found, using default (local)");
                ProfileConfig {
                    name: "local".to_string(),
                    cernere: CernereConfig {
                        url: "http://localhost:8080".to_string(),
                    },
                    secrets: SecretsSection::default(),
                }
            }
        }
    }

    /// プロファイルを保存
    pub fn save(&self, name: &str, config: &ProfileConfig) -> Result<(), SecretsError> {
        let path = self.profile_path(name);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = toml::to_string_pretty(config)
            .map_err(|e| SecretsError::Io(std::io::Error::other(e.to_string())))?;
        std::fs::write(&path, content)?;
        log::info!("Profile saved: {} ({})", name, path.display());
        Ok(())
    }

    /// プロファイルを削除
    pub fn delete(&self, name: &str) -> Result<(), SecretsError> {
        let path = self.profile_path(name);
        if path.exists() {
            std::fs::remove_file(&path)?;
        }
        // アクティブプロファイルだった場合はクリア
        if self.active_name().as_deref() == Some(name) {
            let _ = std::fs::remove_file(&self.active_profile_path);
        }
        Ok(())
    }

    fn profile_path(&self, name: &str) -> PathBuf {
        self.profiles_dir.join(format!("{}.toml", name))
    }
}

impl Default for ProfileManager {
    fn default() -> Self {
        Self::new()
    }
}

// ── Helpers ──────────────────────────────────────────────────

fn config_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."))
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home).join(".config")
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
                PathBuf::from(home).join(".config")
            })
    }
}
