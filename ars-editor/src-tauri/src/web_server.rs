/// Ars 統合Webサーバー
///
/// 以下のモジュールを単一のサーバーに統合する：
/// - Editor: プロジェクト管理、認証（Cernere プロキシ）、クラウド保存、Git操作
/// - Collaboration: WebSocketによるリアルタイム共同編集（カーソル共有・ファイルロック）
///
/// 認証・ユーザー管理・プロジェクト管理は Cernere サーバーに委譲する。
use axum::routing::get;
use axum::Router;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

use crate::app_state::AppState;
use crate::collab::{self, CollabState};
use crate::web_modules;

pub async fn serve(port: u16, static_dir: Option<String>) -> Result<(), Box<dyn std::error::Error>> {
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));

    let state = AppState::new();
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
    println!("  Auth backend:  Cernere ({})", std::env::var("CERNERE_URL").unwrap_or_else(|_| "http://localhost:8080".into()));

    let listener = tokio::net::TcpListener::bind(addr).await
        .map_err(|e| format!("Failed to bind {}: {}", addr, e))?;
    axum::serve(listener, app).await?;
    Ok(())
}
