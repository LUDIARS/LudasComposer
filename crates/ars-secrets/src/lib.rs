//! Secrets management for Ars.
//!
//! Currently supports **Infisical** as the secrets provider.
//! AWS SSM Parameter Store support has been removed from this crate —
//! SSM communication is handled by the dedicated ArsServer package.
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
//! let manager = SecretsManager::discover().await?;
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
pub use crate::config::{InfisicalConfig, SecretsConfig, SecretsProvider};
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
    client: Box<InfisicalClient>,
    config: InfisicalConfig,
    cache: Arc<SecretCache>,
}

impl SecretsManager {
    /// Create from an Infisical config.
    pub async fn from_infisical(config: InfisicalConfig) -> Result<Self, SecretsError> {
        let client = InfisicalClient::new(config.clone());
        client.authenticate().await?;

        let cache = Arc::new(SecretCache::new(config.cache_ttl_secs));

        Ok(Self {
            client: Box::new(client),
            config,
            cache,
        })
    }

    /// Create from a unified SecretsConfig.
    pub async fn from_config(config: &SecretsConfig) -> Result<Self, SecretsError> {
        match config.provider {
            SecretsProvider::Infisical => {
                let infisical = config.infisical.clone().ok_or_else(|| {
                    SecretsError::ProviderConfigMissing(
                        "[infisical] section required when provider = \"infisical\"".to_string(),
                    )
                })?;
                Self::from_infisical(infisical).await
            }
            SecretsProvider::AwsSsm => {
                Err(SecretsError::ProviderConfigMissing(
                    "AWS SSM provider is no longer supported in this crate. \
                     SSM communication is handled by the ArsServer package."
                        .to_string(),
                ))
            }
        }
    }

    /// Create by loading config from a TOML file.
    pub async fn from_config_file(path: &Path) -> Result<Self, SecretsError> {
        let config = SecretsConfig::from_file(path)?;
        Self::from_config(&config).await
    }

    /// Create by auto-discovering `secrets.toml`.
    pub async fn discover() -> Result<Self, SecretsError> {
        let config = SecretsConfig::discover()?;
        Self::from_config(&config).await
    }

    /// Resolve the secret path for a scope.
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
    /// Returns a cached value if available; otherwise fetches from the provider.
    pub async fn get(&self, key: &str, scope: SecretScope<'_>) -> Result<String, SecretsError> {
        let cache_key = format!("{}:{}", scope.label(), key);

        // Check cache first
        if let Some(value) = self.cache.get(&cache_key).await {
            return Ok(value);
        }

        // Fetch from provider
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

    /// Re-authenticate with Infisical.
    pub async fn reauthenticate(&self) -> Result<(), SecretsError> {
        self.client.authenticate().await
    }
}
