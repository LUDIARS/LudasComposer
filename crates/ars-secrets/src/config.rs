use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::SecretsError;

/// Bootstrap configuration for Infisical connection.
///
/// Loaded from a TOML file (e.g., `secrets.toml`) — never from environment variables.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct InfisicalConfig {
    /// Infisical API host (e.g., "https://app.infisical.com")
    pub host: String,

    /// Universal Auth — Machine Identity Client ID
    pub client_id: String,

    /// Universal Auth — Machine Identity Client Secret
    pub client_secret: String,

    /// Infisical project (workspace) ID
    pub project_id: String,

    /// Environment slug (e.g., "dev", "production")
    pub environment: String,

    /// Secret path for project-global (shared) secrets (default: "/shared")
    #[serde(default = "default_shared_path")]
    pub shared_path: String,

    /// Secret path prefix for personal secrets (default: "/personal")
    /// Actual path will be `{personal_path_prefix}/{user_id}`
    #[serde(default = "default_personal_prefix")]
    pub personal_path_prefix: String,

    /// Cache TTL in seconds (default: 300 = 5 minutes)
    #[serde(default = "default_cache_ttl")]
    pub cache_ttl_secs: u64,
}

fn default_shared_path() -> String {
    "/shared".to_string()
}

fn default_personal_prefix() -> String {
    "/personal".to_string()
}

fn default_cache_ttl() -> u64 {
    300
}

/// Wrapper that contains the infisical section of the TOML file.
#[derive(Debug, Deserialize, Serialize)]
struct ConfigFile {
    infisical: InfisicalConfig,
}

impl InfisicalConfig {
    /// Load configuration from a TOML file.
    pub fn from_file(path: &Path) -> Result<Self, SecretsError> {
        if !path.exists() {
            return Err(SecretsError::ConfigNotFound(path.to_path_buf()));
        }
        let content = std::fs::read_to_string(path)?;
        let file: ConfigFile = toml::from_str(&content)?;
        Ok(file.infisical)
    }

    /// Search for `secrets.toml` in standard locations:
    /// 1. Current directory
    /// 2. `~/.config/ars/secrets.toml`
    pub fn discover() -> Result<Self, SecretsError> {
        let candidates: Vec<PathBuf> = vec![
            PathBuf::from("secrets.toml"),
            dirs_home().join("secrets.toml"),
        ];

        for path in &candidates {
            if path.exists() {
                log::info!("Loading secrets config from: {}", path.display());
                return Self::from_file(path);
            }
        }

        Err(SecretsError::ConfigNotFound(PathBuf::from(
            "secrets.toml (searched CWD and ~/.config/ars/)",
        )))
    }

    /// Return the default config file path: `~/.config/ars/secrets.toml`
    pub fn default_config_path() -> PathBuf {
        dirs_home().join("secrets.toml")
    }

    /// Check whether a config file exists in any standard location.
    pub fn exists() -> bool {
        let candidates: Vec<PathBuf> = vec![
            PathBuf::from("secrets.toml"),
            dirs_home().join("secrets.toml"),
        ];
        candidates.iter().any(|p| p.exists())
    }

    /// Save configuration to a TOML file.
    pub fn save_to_file(&self, path: &Path) -> Result<(), SecretsError> {
        let wrapper = ConfigFile {
            infisical: self.clone(),
        };
        let content = toml::to_string_pretty(&wrapper)
            .map_err(|e| SecretsError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, content)?;
        Ok(())
    }
}

fn dirs_home() -> PathBuf {
    dirs_next_config_dir().join("ars")
}

fn dirs_next_config_dir() -> PathBuf {
    #[cfg(target_os = "linux")]
    {
        std::env::var("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
                PathBuf::from(home).join(".config")
            })
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home).join(".config")
    }
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."))
    }
}
