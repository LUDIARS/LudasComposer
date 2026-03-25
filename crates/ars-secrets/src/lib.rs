//! Infisical-based secrets management for Ars.
//!
//! Provides on-demand secret retrieval with caching, separated into two scopes:
//!
//! - **Shared**: Project-global secrets (e.g., OAuth credentials, DB URLs)
//! - **Personal**: Per-user secrets (e.g., personal API tokens)
//!
//! # Usage
//!
//! ```no_run
//! use ars_secrets::{SecretsManager, SecretScope};
//!
//! # async fn example() -> Result<(), Box<dyn std::error::Error>> {
//! let manager = SecretsManager::from_config_file("secrets.toml".as_ref()).await?;
//!
//! // Fetch a project-global secret
//! let client_id = manager.get("GITHUB_CLIENT_ID", SecretScope::Shared).await?;
//!
//! // Fetch a personal secret
//! let token = manager.get("MY_TOKEN", SecretScope::Personal("user-123")).await?;
//! # Ok(())
//! # }
//! ```

pub mod cache;
pub mod client;
pub mod config;
pub mod error;

use std::path::Path;
use std::sync::Arc;

use crate::cache::SecretCache;
use crate::client::InfisicalClient;
pub use crate::config::InfisicalConfig;
use crate::error::SecretsError;

/// Scope for secret retrieval.
#[derive(Debug, Clone)]
pub enum SecretScope<'a> {
    /// Project-global secrets shared across all users.
    Shared,
    /// Per-user secrets. The inner value is a user identifier.
    Personal(&'a str),
}

impl<'a> SecretScope<'a> {
    fn label(&self) -> String {
        match self {
            Self::Shared => "shared".to_string(),
            Self::Personal(id) => format!("personal/{id}"),
        }
    }
}

/// High-level secrets manager with caching.
///
/// Thread-safe (`Clone` + `Send` + `Sync`). Designed to be stored in `AppState`.
#[derive(Clone)]
pub struct SecretsManager {
    client: InfisicalClient,
    config: InfisicalConfig,
    cache: Arc<SecretCache>,
}

impl SecretsManager {
    /// Create from an explicit config.
    pub async fn new(config: InfisicalConfig) -> Result<Self, SecretsError> {
        let client = InfisicalClient::new(config.clone());
        client.authenticate().await?;

        let cache = Arc::new(SecretCache::new(config.cache_ttl_secs));

        Ok(Self {
            client,
            config,
            cache,
        })
    }

    /// Create by loading config from a TOML file.
    pub async fn from_config_file(path: &Path) -> Result<Self, SecretsError> {
        let config = InfisicalConfig::from_file(path)?;
        Self::new(config).await
    }

    /// Create by auto-discovering `secrets.toml`.
    pub async fn discover() -> Result<Self, SecretsError> {
        let config = InfisicalConfig::discover()?;
        Self::new(config).await
    }

    /// Resolve the Infisical secret path for a scope.
    fn secret_path(&self, scope: &SecretScope) -> String {
        match scope {
            SecretScope::Shared => self.config.shared_path.clone(),
            SecretScope::Personal(user_id) => {
                format!("{}/{}", self.config.personal_path_prefix, user_id)
            }
        }
    }

    /// Get a secret value by key and scope.
    ///
    /// Returns a cached value if available; otherwise fetches from Infisical.
    pub async fn get(&self, key: &str, scope: SecretScope<'_>) -> Result<String, SecretsError> {
        let cache_key = format!("{}:{}", scope.label(), key);

        // Check cache first
        if let Some(value) = self.cache.get(&cache_key).await {
            return Ok(value);
        }

        // Fetch from Infisical
        let path = self.secret_path(&scope);
        let value = self.client.get_secret(key, &path).await?;

        // Cache it
        self.cache.set(cache_key, value.clone()).await;

        Ok(value)
    }

    /// Get a secret with a fallback default if not found.
    pub async fn get_or_default(
        &self,
        key: &str,
        scope: SecretScope<'_>,
        default: &str,
    ) -> String {
        match self.get(key, scope).await {
            Ok(value) => value,
            Err(SecretsError::SecretNotFound { .. }) => {
                log::debug!("Secret '{key}' not found, using default");
                default.to_string()
            }
            Err(e) => {
                log::warn!("Failed to fetch secret '{key}': {e}, using default");
                default.to_string()
            }
        }
    }

    /// Invalidate a specific cached secret.
    pub async fn invalidate(&self, key: &str, scope: SecretScope<'_>) {
        let cache_key = format!("{}:{}", scope.label(), key);
        self.cache.invalidate(&cache_key).await;
    }

    /// Invalidate all cached secrets.
    pub async fn invalidate_all(&self) {
        self.cache.invalidate_all().await;
    }

    /// Re-authenticate with Infisical (e.g., after token expiry).
    pub async fn reauthenticate(&self) -> Result<(), SecretsError> {
        self.client.authenticate().await
    }
}
