/// Setup module — secrets provider initial configuration API.
///
/// Provides endpoints for the GUI setup wizard when `secrets.toml` is not found:
///   - GET  /api/setup/status   — check whether setup is needed
///   - POST /api/setup/validate — validate credentials (attempt auth)
///   - POST /api/setup/save     — write secrets.toml and signal restart
use axum::{
    extract::{ConnectInfo, State},
    http::StatusCode,
    middleware,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::{watch, Mutex};

use ars_secrets::{InfisicalConfig, SecretsConfig, SecretsProvider};

/// Shared state for the setup-mode server.
#[derive(Clone)]
pub struct SetupState {
    /// Sends `true` when setup is completed and the server should reinitialize.
    pub setup_done_tx: Arc<watch::Sender<bool>>,
    /// IP ベースの簡易レート制限（IP → 直近リクエスト時刻リスト）
    rate_limiter: Arc<Mutex<HashMap<String, Vec<std::time::Instant>>>>,
}

impl SetupState {
    pub fn new(setup_done_tx: Arc<watch::Sender<bool>>) -> Self {
        Self {
            setup_done_tx,
            rate_limiter: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// 1分あたり MAX_REQUESTS_PER_MINUTE 回に制限。超過時は Err を返す。
    async fn check_rate_limit(&self, ip: &str) -> Result<(), (StatusCode, String)> {
        const MAX_REQUESTS_PER_MINUTE: usize = 10;
        let now = std::time::Instant::now();
        let one_minute_ago = now - std::time::Duration::from_secs(60);

        let mut limiter = self.rate_limiter.lock().await;
        let timestamps = limiter.entry(ip.to_string()).or_default();

        // 1分以前のエントリを削除
        timestamps.retain(|t| *t > one_minute_ago);

        if timestamps.len() >= MAX_REQUESTS_PER_MINUTE {
            return Err((StatusCode::TOO_MANY_REQUESTS, "Rate limit exceeded. Try again later.".to_string()));
        }

        timestamps.push(now);
        Ok(())
    }
}

// ─── Request / Response types ─────────────────────────────────────────────────

#[derive(Serialize)]
struct StatusResponse {
    needs_setup: bool,
}

#[derive(Deserialize)]
#[serde(tag = "provider")]
enum SetupRequest {
    #[serde(rename = "infisical")]
    Infisical {
        host: String,
        client_id: String,
        client_secret: String,
        project_id: String,
        environment: String,
    },
}

#[derive(Serialize)]
struct ValidateResponse {
    valid: bool,
    error: Option<String>,
}

#[derive(Serialize)]
struct SaveResponse {
    success: bool,
    path: String,
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/// GET /api/setup/status
async fn setup_status() -> Json<StatusResponse> {
    Json(StatusResponse {
        needs_setup: !SecretsConfig::exists(),
    })
}

/// Build a SecretsConfig from the setup request.
fn build_config(req: &SetupRequest) -> SecretsConfig {
    match req {
        SetupRequest::Infisical {
            host,
            client_id,
            client_secret,
            project_id,
            environment,
        } => SecretsConfig {
            provider: SecretsProvider::Infisical,
            infisical: Some(InfisicalConfig {
                host: host.clone(),
                client_id: client_id.clone(),
                client_secret: client_secret.clone(),
                project_id: project_id.clone(),
                environment: environment.clone(),
                shared_path: "/shared".to_string(),
                personal_path_prefix: "/personal".to_string(),
                cache_ttl_secs: 300,
            }),
        },
    }
}

/// POST /api/setup/validate — try to authenticate with the provided credentials.
async fn setup_validate(
    State(state): State<SetupState>,
    axum::extract::ConnectInfo(addr): axum::extract::ConnectInfo<SocketAddr>,
    Json(req): Json<SetupRequest>,
) -> Result<Json<ValidateResponse>, (StatusCode, String)> {
    state.check_rate_limit(&addr.ip().to_string()).await?;
    let config = build_config(&req);

    match ars_secrets::SecretsManager::from_config(&config).await {
        Ok(_) => Ok(Json(ValidateResponse {
            valid: true,
            error: None,
        })),
        Err(e) => Ok(Json(ValidateResponse {
            valid: false,
            error: Some(e.to_string()),
        })),
    }
}

/// POST /api/setup/save — write the config to disk and signal completion.
async fn setup_save(
    State(state): State<SetupState>,
    axum::extract::ConnectInfo(addr): axum::extract::ConnectInfo<SocketAddr>,
    Json(req): Json<SetupRequest>,
) -> Result<Json<SaveResponse>, (StatusCode, String)> {
    state.check_rate_limit(&addr.ip().to_string()).await?;
    let config = build_config(&req);

    let path = SecretsConfig::default_config_path();
    config
        .save_to_file(&path)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Signal that setup is done — the server loop will reinitialize.
    let _ = state.setup_done_tx.send(true);

    Ok(Json(SaveResponse {
        success: true,
        path: path.to_string_lossy().to_string(),
    }))
}

/// Build the setup-mode router.
pub fn router(state: SetupState) -> Router {
    Router::new()
        .route("/api/setup/status", get(setup_status))
        .route("/api/setup/validate", post(setup_validate))
        .route("/api/setup/save", post(setup_save))
        .with_state(state)
}

/// ConnectInfo 対応の setup-mode router（セットアップサーバーから呼び出す場合用）
pub fn router_with_connect_info(state: SetupState) -> Router {
    router(state)
}
