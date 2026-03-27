use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::SecretsError;

// ─── Provider enum ────────────────────────────────────────────────────────────

/// Which secrets backend to use.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum SecretsProvider {
    Infisical,
    AwsSsm,
}

impl std::fmt::Display for SecretsProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Infisical => write!(f, "infisical"),
            Self::AwsSsm => write!(f, "aws-ssm"),
        }
    }
}

// ─── Top-level config file ────────────────────────────────────────────────────

/// Top-level secrets.toml structure.
///
/// ```toml
/// provider = "aws-ssm"   # or "infisical"
///
/// [infisical]
/// host = "https://app.infisical.com"
/// ...
///
/// [aws_ssm]
/// region = "ap-northeast-1"
/// path_prefix = "/ars"
/// ```
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SecretsConfig {
    /// Which provider to use.
    pub provider: SecretsProvider,

    /// Infisical-specific settings (only used when provider = "infisical").
    #[serde(default)]
    pub infisical: Option<InfisicalConfig>,

    /// AWS SSM Parameter Store settings (only used when provider = "aws-ssm").
    #[serde(default)]
    pub aws_ssm: Option<AwsSsmConfig>,
}

// ─── Infisical config ─────────────────────────────────────────────────────────

/// Bootstrap configuration for Infisical connection.
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
    #[serde(default = "default_personal_prefix")]
    pub personal_path_prefix: String,

    /// Cache TTL in seconds (default: 300 = 5 minutes)
    #[serde(default = "default_cache_ttl")]
    pub cache_ttl_secs: u64,
}

// ─── AWS SSM config ───────────────────────────────────────────────────────────

/// Configuration for AWS SSM Parameter Store.
///
/// AWS credentials are loaded from the standard credential chain:
///   - Environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
///   - Region: `AWS_REGION` or `AWS_DEFAULT_REGION`
///   - Or IAM role / `~/.aws/credentials`
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AwsSsmConfig {
    /// AWS region (e.g., "ap-northeast-1").
    /// Falls back to `AWS_REGION` / `AWS_DEFAULT_REGION` env var if omitted.
    #[serde(default)]
    pub region: Option<String>,

    /// Path prefix for SSM parameters (default: "/ars")
    /// Parameters are stored as: `{path_prefix}/shared/{KEY}` etc.
    #[serde(default = "default_ssm_path_prefix")]
    pub path_prefix: String,

    /// Shared secrets sub-path (default: "/shared")
    #[serde(default = "default_shared_path")]
    pub shared_path: String,

    /// Personal secrets sub-path prefix (default: "/personal")
    #[serde(default = "default_personal_prefix")]
    pub personal_path_prefix: String,

    /// Cache TTL in seconds (default: 300 = 5 minutes)
    #[serde(default = "default_cache_ttl")]
    pub cache_ttl_secs: u64,
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

fn default_shared_path() -> String {
    "/shared".to_string()
}

fn default_personal_prefix() -> String {
    "/personal".to_string()
}

fn default_cache_ttl() -> u64 {
    300
}

fn default_ssm_path_prefix() -> String {
    "/ars".to_string()
}

// ─── SecretsConfig methods ────────────────────────────────────────────────────

impl SecretsConfig {
    /// Load configuration from a TOML file.
    pub fn from_file(path: &Path) -> Result<Self, SecretsError> {
        if !path.exists() {
            return Err(SecretsError::ConfigNotFound(path.to_path_buf()));
        }
        let content = std::fs::read_to_string(path)?;
        let config: Self = toml::from_str(&content)?;
        Ok(config)
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
        let content = toml::to_string_pretty(self)
            .map_err(|e| SecretsError::Io(std::io::Error::other(e)))?;

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, content)?;
        Ok(())
    }

    /// Get the cache TTL from whichever provider is active.
    pub fn cache_ttl_secs(&self) -> u64 {
        match self.provider {
            SecretsProvider::Infisical => {
                self.infisical.as_ref().map(|c| c.cache_ttl_secs).unwrap_or(300)
            }
            SecretsProvider::AwsSsm => {
                self.aws_ssm.as_ref().map(|c| c.cache_ttl_secs).unwrap_or(300)
            }
        }
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
