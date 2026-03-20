/// Ars 統合Webサーバー
///
/// 以下のモジュールを単一のサーバーに統合する：
/// - Editor: プロジェクト管理、認証、クラウド保存、Git操作
/// - Resource Depot: リソース閲覧（読み取り専用）
/// - Data Organizer: マスターデータ・ユーザーデータ管理（閲覧 + 調整）
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

use crate::app_state::AppState;
use crate::web_modules;

pub async fn serve(port: u16, static_dir: Option<String>) -> Result<(), Box<dyn std::error::Error>> {
    let state = AppState::from_env().await;

    // 各モジュールのルーターを構築・マージ
    let editor_router = web_modules::editor::router(state);
    let depot_router = web_modules::resource_depot::router();
    let data_router = web_modules::data_organizer::router();

    let app = editor_router
        .merge(depot_router)
        .merge(data_router)
        .layer(CorsLayer::permissive());

    let app = if let Some(dir) = static_dir {
        app.fallback_service(ServeDir::new(dir))
    } else {
        app
    };

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    println!("Ars web server listening on http://localhost:{}", port);
    println!("  Editor:         /api/project/*, /api/cloud/*, /api/git/*");
    println!("  Resource Depot: /api/depot/*");
    println!("  Data Organizer: /api/data/*");

    let listener = tokio::net::TcpListener::bind(addr).await
        .map_err(|e| format!("Failed to bind {}: {}", addr, e))?;
    axum::serve(listener, app).await?;
    Ok(())
}
