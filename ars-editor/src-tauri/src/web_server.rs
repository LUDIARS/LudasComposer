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
use tower_http::services::{ServeDir, ServeFile};

use crate::app_state::AppState;
use crate::collab::{self, CollabState};
use crate::web_modules;

/// Infisical の ALLOWED_ORIGINS から許可オリジンを取得し、CorsLayer を構築する。
/// 未設定時はローカル開発用のデフォルトを使用。
fn build_cors(allowed_origins: &[String]) -> CorsLayer {
    let origins: Vec<axum::http::HeaderValue> = allowed_origins
        .iter()
        .filter_map(|o| o.parse::<axum::http::HeaderValue>().ok())
        .collect();

    CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([axum::http::Method::GET, axum::http::Method::POST, axum::http::Method::PUT, axum::http::Method::DELETE, axum::http::Method::OPTIONS])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
            axum::http::header::COOKIE,
        ])
        .allow_credentials(true)
}

pub async fn serve(addr: std::net::SocketAddr, static_dir: Option<String>) -> Result<(), Box<dyn std::error::Error>> {

    let state = AppState::new();
    let collab_state = CollabState::new();

    // CORS: デフォルトはローカル開発用
    let allowed_origins = vec!["http://localhost:5173".to_string()];
    let cors = build_cors(&allowed_origins);

    let editor_router = web_modules::editor::router(state.clone());
    let module_router = web_modules::module_manager::router(state);

    // コラボレーションWebSocketルート
    let collab_router = Router::new()
        .route("/ws/collab", get(collab::ws_handler))
        .with_state(collab_state);

    let health_router = Router::new()
        .route("/api/health", get(|| async { "ok" }));

    let app = editor_router
        .merge(module_router)
        .merge(collab_router)
        .merge(health_router)
        .layer(cors);

    let app = if let Some(ref dir) = static_dir {
        let index_path = format!("{}/index.html", dir);
        app.fallback_service(
            ServeDir::new(dir)
                .not_found_service(ServeFile::new(index_path))
        )
    } else {
        app
    };

    println!("Ars web server listening on http://{}", addr);
    println!("  Editor:        /api/project/*, /api/cloud/*, /api/git/*");
    println!("  Modules:       /api/modules/*");
    println!("  Collaboration: /ws/collab (WebSocket)");
    println!("  Auth backend:  Cernere ({})", std::env::var("CERNERE_URL").unwrap_or_else(|_| "http://localhost:8080".into()));

    let listener = tokio::net::TcpListener::bind(addr).await
        .map_err(|e| format!("Failed to bind {}: {}", addr, e))?;
    axum::serve(listener, app).await?;
    Ok(())
}
