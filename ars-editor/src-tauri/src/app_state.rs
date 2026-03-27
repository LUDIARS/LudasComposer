use std::sync::Arc;

use ars_core::repository::{ProjectRepository, SessionRepository, UserRepository};
use ars_secrets::{SecretScope, SecretsManager};

use crate::redis_client::RedisClient;
use crate::redis_repo::RedisSessionRepository;
use crate::surreal_repo::{SurrealProjectRepository, SurrealUserRepository};
use crate::surrealdb_client::SurrealClient;

#[derive(Clone)]
pub struct AppState {
    pub secrets: SecretsManager,
    pub surreal: SurrealClient,
    pub redis: RedisClient,
    // Repository trait objects
    pub project_repo: Arc<dyn ProjectRepository>,
    pub user_repo: Arc<dyn UserRepository>,
    pub session_repo: Arc<dyn SessionRepository>,
}

impl AppState {
    /// Initialize from secrets provider (Infisical or AWS SSM).
    ///
    /// The `secrets.toml` config file is auto-discovered from:
    ///   1. Current working directory
    ///   2. `~/.config/ars/secrets.toml`
    pub async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let secrets = SecretsManager::discover().await
            .map_err(|e| format!("Failed to initialize secrets manager: {}", e))?;

        // Infrastructure secrets — fetched on-demand but needed for DB init
        let surreal_data_dir = secrets
            .get_or_default("SURREALDB_DATA_DIR", SecretScope::Shared, &default_surreal_dir())
            .await;
        let surreal = SurrealClient::new(&surreal_data_dir).await
            .map_err(|e| format!("Failed to initialize SurrealDB: {}", e))?;

        let redis_url = secrets
            .get_or_default("REDIS_URL", SecretScope::Shared, "redis://127.0.0.1:6379")
            .await;
        let redis = RedisClient::new(&redis_url).await
            .map_err(|e| format!("Failed to initialize Redis: {}", e))?;

        let project_repo: Arc<dyn ProjectRepository> =
            Arc::new(SurrealProjectRepository::new(surreal.clone()));
        let user_repo: Arc<dyn UserRepository> =
            Arc::new(SurrealUserRepository::new(surreal.clone()));
        let session_repo: Arc<dyn SessionRepository> =
            Arc::new(RedisSessionRepository::new(redis.clone()));

        Ok(Self {
            secrets,
            surreal,
            redis,
            project_repo,
            user_repo,
            session_repo,
        })
    }

    /// Get GitHub Client ID (fetched from Infisical on-demand).
    pub async fn github_client_id(&self) -> Result<String, ars_secrets::error::SecretsError> {
        self.secrets.get("GITHUB_CLIENT_ID", SecretScope::Shared).await
    }

    /// Get GitHub Client Secret (fetched from Infisical on-demand).
    pub async fn github_client_secret(&self) -> Result<String, ars_secrets::error::SecretsError> {
        self.secrets.get("GITHUB_CLIENT_SECRET", SecretScope::Shared).await
    }

    /// Get GitHub Redirect URI (fetched from Infisical, with default fallback).
    pub async fn github_redirect_uri(&self) -> String {
        self.secrets
            .get_or_default(
                "GITHUB_REDIRECT_URI",
                SecretScope::Shared,
                "http://localhost:5173/auth/github/callback",
            )
            .await
    }

    /// Whether the redirect URI uses HTTPS (for Cookie Secure flag).
    pub async fn is_https(&self) -> bool {
        self.github_redirect_uri().await.starts_with("https://")
    }
}

fn default_surreal_dir() -> String {
    let base = dirs_next::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("ars")
        .join("surrealdb");
    base.to_string_lossy().to_string()
}
