/// Setup module — Infisical initial configuration API.
///
/// Provides endpoints for the GUI setup wizard when `secrets.toml` is not found:
///   - GET  /api/setup/status   — check whether setup is needed
///   - POST /api/setup/validate — validate Infisical credentials (attempt auth)
///   - POST /api/setup/save     — write secrets.toml and signal restart
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::watch;

use ars_secrets::InfisicalConfig;

/// Shared state for the setup-mode server.
#[derive(Clone)]
pub struct SetupState {
    /// Sends `true` when setup is completed and the server should reinitialize.
    pub setup_done_tx: Arc<watch::Sender<bool>>,
}

#[derive(Serialize)]
struct StatusResponse {
    /// `true` means setup is required (no valid config found).
    needs_setup: bool,
}

#[derive(Deserialize)]
struct SetupRequest {
    host: String,
    client_id: String,
    client_secret: String,
    project_id: String,
    environment: String,
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

/// GET /api/setup/status
async fn setup_status() -> Json<StatusResponse> {
    Json(StatusResponse {
        needs_setup: !InfisicalConfig::exists(),
    })
}

/// POST /api/setup/validate — try to authenticate with the provided credentials.
async fn setup_validate(
    Json(req): Json<SetupRequest>,
) -> Json<ValidateResponse> {
    let config = InfisicalConfig {
        host: req.host,
        client_id: req.client_id,
        client_secret: req.client_secret,
        project_id: req.project_id,
        environment: req.environment,
        shared_path: "/shared".to_string(),
        personal_path_prefix: "/personal".to_string(),
        cache_ttl_secs: 300,
    };

    match ars_secrets::SecretsManager::new(config).await {
        Ok(_) => Json(ValidateResponse {
            valid: true,
            error: None,
        }),
        Err(e) => Json(ValidateResponse {
            valid: false,
            error: Some(e.to_string()),
        }),
    }
}

/// POST /api/setup/save — write the config to disk and signal completion.
async fn setup_save(
    State(state): State<SetupState>,
    Json(req): Json<SetupRequest>,
) -> Result<Json<SaveResponse>, (StatusCode, String)> {
    let config = InfisicalConfig {
        host: req.host,
        client_id: req.client_id,
        client_secret: req.client_secret,
        project_id: req.project_id,
        environment: req.environment,
        shared_path: "/shared".to_string(),
        personal_path_prefix: "/personal".to_string(),
        cache_ttl_secs: 300,
    };

    let path = InfisicalConfig::default_config_path();
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
