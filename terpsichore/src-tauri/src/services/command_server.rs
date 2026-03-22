use crate::models::command::{
    BuildRequest, BuildStatus, CommandRequest, CommandResult, CompileStatus, GameStatus,
    ServerStatus,
};
use crate::models::config::TerpsichoreConfig;
use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tower_http::cors::CorsLayer;

pub struct ServerState {
    pub config: TerpsichoreConfig,
    pub started_at: Instant,
    pub request_count: u64,
    pub compile_status: CompileStatus,
    pub build_status: BuildStatus,
    pub game_status: GameStatus,
    pub command_handler: Option<Box<dyn Fn(CommandRequest) -> CommandResult + Send + Sync>>,
}

pub type SharedState = Arc<Mutex<ServerState>>;

pub struct CommandServer {
    config: TerpsichoreConfig,
}

impl CommandServer {
    pub fn new(config: TerpsichoreConfig) -> Self {
        Self { config }
    }

    pub fn from_default_config() -> Self {
        Self::new(TerpsichoreConfig::load())
    }

    pub async fn start(self) -> Result<(), Box<dyn std::error::Error>> {
        if !self.config.enabled {
            println!("Terpsichore command server is disabled");
            return Ok(());
        }

        let state = Arc::new(Mutex::new(ServerState {
            config: self.config.clone(),
            started_at: Instant::now(),
            request_count: 0,
            compile_status: CompileStatus {
                compiling: false,
                errors: Vec::new(),
                warnings: Vec::new(),
            },
            build_status: BuildStatus {
                building: false,
                success: None,
                output_path: None,
                errors: Vec::new(),
            },
            game_status: GameStatus {
                playing: false,
                scene: None,
                custom_data: None,
            },
            command_handler: None,
        }));

        let token = self.config.token.clone();

        let app = Router::new()
            .route("/api/health", get(health_handler))
            .route("/api/status", get(status_handler))
            .route("/api/compile-status", get(compile_status_handler))
            .route("/api/build-status", get(build_status_handler))
            .route("/api/game-status", get(game_status_handler))
            .route("/api/execute-command", post(execute_command_handler))
            .route("/api/recompile", post(recompile_handler))
            .route("/api/build", post(build_handler))
            .route("/api/play-start", post(play_start_handler))
            .route("/api/play-stop", post(play_stop_handler))
            .route("/api/play-status", get(play_status_handler))
            .layer(CorsLayer::permissive())
            .with_state((state, token));

        let bind_addr = self.config.bind_address();
        let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
        println!(
            "Terpsichore command server running on http://{}",
            bind_addr
        );

        axum::serve(listener, app).await?;
        Ok(())
    }
}

type AppState = (SharedState, String);

fn check_auth(token_config: &str, auth_header: Option<&str>) -> Result<(), StatusCode> {
    if token_config.is_empty() {
        return Ok(());
    }
    match auth_header {
        Some(header) if header.strip_prefix("Bearer ").unwrap_or("") == token_config => Ok(()),
        _ => Err(StatusCode::UNAUTHORIZED),
    }
}

async fn health_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok", "service": "terpsichore" }))
}

async fn status_handler(State((state, _)): State<AppState>) -> Json<ServerStatus> {
    let s = state.lock().unwrap();
    Json(ServerStatus {
        running: true,
        port: s.config.port,
        role: format!("{:?}", s.config.role).to_lowercase(),
        uptime_seconds: s.started_at.elapsed().as_secs(),
        request_count: s.request_count,
    })
}

async fn compile_status_handler(State((state, _)): State<AppState>) -> Json<CompileStatus> {
    let s = state.lock().unwrap();
    Json(s.compile_status.clone())
}

async fn build_status_handler(State((state, _)): State<AppState>) -> Json<BuildStatus> {
    let s = state.lock().unwrap();
    Json(s.build_status.clone())
}

async fn game_status_handler(State((state, _)): State<AppState>) -> Json<GameStatus> {
    let s = state.lock().unwrap();
    Json(s.game_status.clone())
}

async fn execute_command_handler(
    State((state, token)): State<AppState>,
    axum::extract::Request(req): axum::extract::Request,
) -> Result<Json<CommandResult>, StatusCode> {
    // Parse the body manually to check auth from headers
    let (parts, body) = req.into_parts();
    let auth_header = parts
        .headers
        .get("authorization")
        .and_then(|v| v.to_str().ok());
    check_auth(&token, auth_header)?;

    let bytes = axum::body::to_bytes(body, 1024 * 1024)
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let cmd_request: CommandRequest =
        serde_json::from_slice(&bytes).map_err(|_| StatusCode::BAD_REQUEST)?;

    let mut s = state.lock().unwrap();
    s.request_count += 1;

    let result = if let Some(ref handler) = s.command_handler {
        handler(cmd_request)
    } else {
        CommandResult::ok_with_data(
            "Command received",
            serde_json::json!({
                "command": cmd_request.command,
                "args": cmd_request.args,
                "note": "No command handler registered"
            }),
        )
    };

    Ok(Json(result))
}

async fn recompile_handler(
    State((state, _)): State<AppState>,
) -> Json<CommandResult> {
    let mut s = state.lock().unwrap();
    s.request_count += 1;
    s.compile_status.compiling = true;
    s.compile_status.errors.clear();
    s.compile_status.warnings.clear();
    Json(CommandResult::ok("Recompilation triggered"))
}

async fn build_handler(
    State((state, _)): State<AppState>,
    Json(request): Json<BuildRequest>,
) -> Json<CommandResult> {
    let mut s = state.lock().unwrap();
    s.request_count += 1;
    s.build_status.building = true;
    s.build_status.success = None;
    s.build_status.errors.clear();
    s.build_status.output_path = request.output_path;
    Json(CommandResult::ok(format!(
        "Build started for target: {}",
        request.target
    )))
}

async fn play_start_handler(
    State((state, _)): State<AppState>,
) -> Json<CommandResult> {
    let mut s = state.lock().unwrap();
    s.request_count += 1;
    s.game_status.playing = true;
    Json(CommandResult::ok("Play mode started"))
}

async fn play_stop_handler(
    State((state, _)): State<AppState>,
) -> Json<CommandResult> {
    let mut s = state.lock().unwrap();
    s.request_count += 1;
    s.game_status.playing = false;
    Json(CommandResult::ok("Play mode stopped"))
}

async fn play_status_handler(State((state, _)): State<AppState>) -> Json<GameStatus> {
    let s = state.lock().unwrap();
    Json(s.game_status.clone())
}
