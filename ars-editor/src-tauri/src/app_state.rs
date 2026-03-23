use std::sync::Arc;

use ars_core::repository::{ProjectRepository, SessionRepository, UserRepository};

use crate::redis_client::RedisClient;
use crate::redis_repo::RedisSessionRepository;
use crate::surreal_repo::{SurrealProjectRepository, SurrealUserRepository};
use crate::surrealdb_client::SurrealClient;

#[derive(Clone)]
pub struct AppState {
    pub github_client_id: String,
    pub github_client_secret: String,
    pub github_redirect_uri: String,
    pub surreal: SurrealClient,
    pub redis: RedisClient,
    // Repository trait objects
    pub project_repo: Arc<dyn ProjectRepository>,
    pub user_repo: Arc<dyn UserRepository>,
    pub session_repo: Arc<dyn SessionRepository>,
}

impl AppState {
    pub async fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        let github_client_id = std::env::var("GITHUB_CLIENT_ID")
            .map_err(|_| "GITHUB_CLIENT_ID environment variable must be set")?;
        let github_client_secret = std::env::var("GITHUB_CLIENT_SECRET")
            .map_err(|_| "GITHUB_CLIENT_SECRET environment variable must be set")?;
        let github_redirect_uri = std::env::var("GITHUB_REDIRECT_URI")
            .unwrap_or_else(|_| "http://localhost:5173/auth/github/callback".to_string());

        let surreal_data_dir = std::env::var("SURREALDB_DATA_DIR")
            .unwrap_or_else(|_| {
                let base = dirs_next::data_dir()
                    .unwrap_or_else(|| std::path::PathBuf::from("."))
                    .join("ars")
                    .join("surrealdb");
                base.to_string_lossy().to_string()
            });
        let surreal = SurrealClient::new(&surreal_data_dir).await
            .map_err(|e| format!("Failed to initialize SurrealDB: {}", e))?;

        let redis_url = std::env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
        let redis = RedisClient::new(&redis_url).await
            .map_err(|e| format!("Failed to initialize Redis: {}", e))?;

        let project_repo: Arc<dyn ProjectRepository> =
            Arc::new(SurrealProjectRepository::new(surreal.clone()));
        let user_repo: Arc<dyn UserRepository> =
            Arc::new(SurrealUserRepository::new(surreal.clone()));
        let session_repo: Arc<dyn SessionRepository> =
            Arc::new(RedisSessionRepository::new(redis.clone()));

        Ok(Self {
            github_client_id,
            github_client_secret,
            github_redirect_uri,
            surreal,
            redis,
            project_repo,
            user_repo,
            session_repo,
        })
    }

    /// redirect_uri が https:// の場合に true を返す（Cookie Secure フラグ判定用）
    pub fn is_https(&self) -> bool {
        self.github_redirect_uri.starts_with("https://")
    }
}
