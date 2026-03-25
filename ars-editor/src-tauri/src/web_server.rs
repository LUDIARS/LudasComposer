/// Ars 統合Webサーバー
///
/// 以下のモジュールを単一のサーバーに統合する：
/// - Editor: プロジェクト管理、認証、クラウド保存、Git操作
/// - Collaboration: WebSocketによるリアルタイム共同編集（カーソル共有・ファイルロック）
///
/// 起動時に secrets.toml が見つからない場合は、セットアップモードで起動し、
/// GUI ウィザードを通じて Infisical の初期設定を行う。
use std::sync::Arc;

use axum::routing::get;
use axum::Router;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

use ars_secrets::InfisicalConfig;

use crate::app_state::AppState;
use crate::collab::{self, CollabState};
use crate::web_modules;
use crate::web_modules::setup::SetupState;

pub async fn serve(port: u16, static_dir: Option<String>) -> Result<(), Box<dyn std::error::Error>> {
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));

    // Check if Infisical config exists; if not, start in setup mode first.
    if !InfisicalConfig::exists() {
        println!("Infisical configuration not found — starting setup mode.");
        println!("  Open http://localhost:{} to configure.", port);

        run_setup_server(addr, static_dir.as_deref()).await?;

        println!("Setup completed. Initializing application...");
    }

    // Normal startup — config should now exist.
    let state = AppState::new().await?;
    let collab_state = CollabState::new();

    let editor_router = web_modules::editor::router(state.clone());
    let module_router = web_modules::module_manager::router(state);

    // コラボレーションWebSocketルート
    let collab_router = Router::new()
        .route("/ws/collab", get(collab::ws_handler))
        .with_state(collab_state);

    let app = editor_router
        .merge(module_router)
        .merge(collab_router)
        .layer(CorsLayer::permissive());

    let app = if let Some(dir) = static_dir {
        app.fallback_service(ServeDir::new(dir))
    } else {
        app
    };

    println!("Ars web server listening on http://localhost:{}", port);
    println!("  Editor:        /api/project/*, /api/cloud/*, /api/git/*");
    println!("  Modules:       /api/modules/*");
    println!("  Collaboration: /ws/collab (WebSocket)");

    let listener = tokio::net::TcpListener::bind(addr).await
        .map_err(|e| format!("Failed to bind {}: {}", addr, e))?;
    axum::serve(listener, app).await?;
    Ok(())
}

/// Run a minimal server that only serves the setup API and static files.
/// Blocks until the user completes the setup wizard.
async fn run_setup_server(
    addr: std::net::SocketAddr,
    static_dir: Option<&str>,
) -> Result<(), Box<dyn std::error::Error>> {
    let (done_tx, mut done_rx) = tokio::sync::watch::channel(false);
    let setup_state = SetupState {
        setup_done_tx: Arc::new(done_tx),
    };

    let setup_router = web_modules::setup::router(setup_state);

    let app = setup_router.layer(CorsLayer::permissive());

    let app = if let Some(dir) = static_dir {
        app.fallback_service(ServeDir::new(dir))
    } else {
        app
    };

    let listener = tokio::net::TcpListener::bind(addr).await
        .map_err(|e| format!("Failed to bind {}: {}", addr, e))?;

    // Serve until setup_done signal is received.
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            // Wait until setup_done_tx sends `true`.
            while !*done_rx.borrow_and_update() {
                if done_rx.changed().await.is_err() {
                    break;
                }
            }
            // Give the response a moment to flush back to the client.
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        })
        .await?;

    Ok(())
}
