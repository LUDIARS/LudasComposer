use crate::redis_client::RedisClient;
use crate::surrealdb_client::SurrealClient;

#[derive(Clone)]
pub struct AppState {
    pub github_client_id: String,
    pub github_client_secret: String,
    pub github_redirect_uri: String,
    pub surreal: SurrealClient,
    pub redis: RedisClient,
}

impl AppState {
    pub async fn from_env() -> Self {
        let surreal_data_dir = std::env::var("SURREALDB_DATA_DIR")
            .unwrap_or_else(|_| {
                let base = dirs_next::data_dir()
                    .unwrap_or_else(|| std::path::PathBuf::from("."))
                    .join("ars")
                    .join("surrealdb");
                base.to_string_lossy().to_string()
            });
        let surreal = SurrealClient::new(&surreal_data_dir)
            .await
            .expect("Failed to initialize SurrealDB");

        let redis_url = std::env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
        let redis = RedisClient::new(&redis_url)
            .await
            .expect("Failed to initialize Redis");

        Self {
            github_client_id: std::env::var("GITHUB_CLIENT_ID")
                .expect("GITHUB_CLIENT_ID must be set"),
            github_client_secret: std::env::var("GITHUB_CLIENT_SECRET")
                .expect("GITHUB_CLIENT_SECRET must be set"),
            github_redirect_uri: std::env::var("GITHUB_REDIRECT_URI")
                .unwrap_or_else(|_| "http://localhost:5173/auth/github/callback".to_string()),
            surreal,
            redis,
        }
    }
}
