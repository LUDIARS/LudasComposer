use std::sync::Arc;

use ars_core::repository::{ProjectRepository, SessionRepository, UserRepository};
use ars_secrets::{SecretScope, SecretsManager};
use dashmap::DashMap;

use crate::redis_client::RedisClient;
use crate::redis_repo::RedisSessionRepository;
use crate::surreal_repo::{SurrealProjectRepository, SurrealUserRepository};
use crate::surrealdb_client::SurrealClient;

#[derive(Clone)]
pub struct AppState {
    pub secrets: SecretsManager,
    pub redis: RedisClient,
    // Repository trait objects
    pub project_repo: Arc<dyn ProjectRepository>,
    pub user_repo: Arc<dyn UserRepository>,
    pub session_repo: Arc<dyn SessionRepository>,
    /// アクセストークンはオンメモリで管理（Redis に保存しない）
    pub token_store: Arc<DashMap<String, String>>,
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

        // SurrealDB — connect to external instance via HTTP
        let surreal_url = secrets
            .get_or_default("SURREALDB_URL", SecretScope::Shared, "http://localhost:8000")
            .await;
        let surreal_user = secrets
            .get("SURREALDB_USER", SecretScope::Shared)
            .await
            .map_err(|e| format!("SURREALDB_USER not configured in Infisical: {}", e))?;
        let surreal_pass = secrets
            .get("SURREALDB_PASS", SecretScope::Shared)
            .await
            .map_err(|e| format!("SURREALDB_PASS not configured in Infisical: {}", e))?;
        let surreal = SurrealClient::new(&surreal_url, &surreal_user, &surreal_pass).await
            .map_err(|e| format!("Failed to connect to SurrealDB: {}", e))?;

        let redis_url = secrets
            .get_or_default("REDIS_URL", SecretScope::Shared, "redis://127.0.0.1:6379")
            .await;
        let session_ttl_str = secrets
            .get_or_default("SESSION_TTL_SECS", SecretScope::Shared, "604800")
            .await;
        let session_ttl: u64 = session_ttl_str.parse().unwrap_or(604800);
        let redis = RedisClient::with_ttl(&redis_url, session_ttl).await
            .map_err(|e| format!("Failed to initialize Redis: {}", e))?;

        let project_repo: Arc<dyn ProjectRepository> =
            Arc::new(SurrealProjectRepository::new(surreal.clone()));
        let user_repo: Arc<dyn UserRepository> =
            Arc::new(SurrealUserRepository::new(surreal));
        let session_repo: Arc<dyn SessionRepository> =
            Arc::new(RedisSessionRepository::new(redis.clone()));

        Ok(Self {
            secrets,
            redis,
            project_repo,
            user_repo,
            session_repo,
            token_store: Arc::new(DashMap::new()),
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

    /// セッション TTL（秒）を Infisical から取得（デフォルト 7 日）
    pub async fn session_ttl_secs(&self) -> i64 {
        let val = self.secrets
            .get_or_default("SESSION_TTL_SECS", SecretScope::Shared, "604800")
            .await;
        val.parse().unwrap_or(604800)
    }

    /// Cernere JWT Secret (Infisical から取得)
    pub async fn jwt_secret(&self) -> String {
        self.secrets
            .get_or_default("JWT_SECRET", SecretScope::Shared, "cernere-dev-secret-change-in-production")
            .await
    }

    /// レート制限: 1分あたりのリクエスト上限を Infisical から取得
    pub async fn rate_limit_rpm(&self) -> u64 {
        let val = self.secrets
            .get_or_default("RATE_LIMIT_RPM", SecretScope::Shared, "30")
            .await;
        val.parse().unwrap_or(30)
    }
}
