use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::Deserialize;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

use crate::models::resource::*;
use crate::services::ResourceDepotService;
use std::sync::Mutex;

/// 読み取り専用のアプリケーション状態
pub struct AppState {
    pub depot: Mutex<ResourceDepotService>,
}

// ─── リソース一覧 ───

async fn api_get_all_resources(
    State(state): State<std::sync::Arc<AppState>>,
) -> Result<Json<Vec<Resource>>, (StatusCode, String)> {
    let depot = state.depot.lock().unwrap();
    Ok(Json(depot.get_all_resources()))
}

#[derive(Deserialize)]
struct CategoryQuery {
    category: ResourceCategory,
}

async fn api_get_resources_by_category(
    State(state): State<std::sync::Arc<AppState>>,
    Query(q): Query<CategoryQuery>,
) -> Result<Json<Vec<Resource>>, (StatusCode, String)> {
    let depot = state.depot.lock().unwrap();
    Ok(Json(depot.get_resources_by_category(&q.category)))
}

#[derive(Deserialize)]
struct SearchQuery {
    q: String,
}

async fn api_search_resources(
    State(state): State<std::sync::Arc<AppState>>,
    Query(q): Query<SearchQuery>,
) -> Result<Json<Vec<Resource>>, (StatusCode, String)> {
    let depot = state.depot.lock().unwrap();
    Ok(Json(depot.find_resources(&q.q)))
}

async fn api_get_resource_by_id(
    State(state): State<std::sync::Arc<AppState>>,
    Path(resource_id): Path<String>,
) -> Result<Json<Resource>, (StatusCode, String)> {
    let depot = state.depot.lock().unwrap();
    depot
        .get_resource(&resource_id)
        .map(|r| Json(r.clone()))
        .map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))
}

// ─── ボーンパターン ───

async fn api_get_bone_patterns(
    State(state): State<std::sync::Arc<AppState>>,
) -> Json<Vec<BonePattern>> {
    let depot = state.depot.lock().unwrap();
    Json(depot.get_bone_patterns())
}

// ─── モーショングループ ───

async fn api_get_motion_groups(
    State(state): State<std::sync::Arc<AppState>>,
) -> Json<Vec<MotionGroup>> {
    let depot = state.depot.lock().unwrap();
    Json(depot.get_motion_groups())
}

// ─── テクスチャグループ ───

async fn api_get_texture_groups(
    State(state): State<std::sync::Arc<AppState>>,
) -> Json<Vec<TextureGroup>> {
    let depot = state.depot.lock().unwrap();
    Json(depot.get_texture_groups())
}

// ─── デポ全体状態 ───

async fn api_get_depot_state(
    State(state): State<std::sync::Arc<AppState>>,
) -> Json<ResourceDepot> {
    let depot = state.depot.lock().unwrap();
    Json(depot.get_depot().clone())
}

// ─── 重複検出 ───

async fn api_find_duplicates(
    State(state): State<std::sync::Arc<AppState>>,
) -> Json<std::collections::HashMap<String, Vec<String>>> {
    let depot = state.depot.lock().unwrap();
    Json(depot.find_duplicate_resources())
}

pub fn api_router(state: std::sync::Arc<AppState>) -> Router {
    Router::new()
        // リソース (読み取り専用)
        .route("/api/resources", get(api_get_all_resources))
        .route("/api/resources/search", get(api_search_resources))
        .route("/api/resources/by-category", get(api_get_resources_by_category))
        .route("/api/resources/:resource_id", get(api_get_resource_by_id))
        // グループ・パターン (読み取り専用)
        .route("/api/bone-patterns", get(api_get_bone_patterns))
        .route("/api/motion-groups", get(api_get_motion_groups))
        .route("/api/texture-groups", get(api_get_texture_groups))
        // デポ全体
        .route("/api/depot", get(api_get_depot_state))
        .route("/api/duplicates", get(api_find_duplicates))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

pub async fn serve(port: u16, static_dir: Option<String>) -> Result<(), Box<dyn std::error::Error>> {
    let depot_service = ResourceDepotService::with_defaults()
        .unwrap_or_else(|e| {
            eprintln!("Warning: Failed to init depot: {}", e);
            ResourceDepotService::new(std::env::temp_dir().join("ars").join("resource-depot"))
                .expect("Failed to initialize resource depot")
        });

    let state = std::sync::Arc::new(AppState {
        depot: Mutex::new(depot_service),
    });

    let app = if let Some(dir) = static_dir {
        api_router(state).fallback_service(ServeDir::new(dir))
    } else {
        api_router(state)
    };

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    println!("Resource Depot web server listening on http://localhost:{}", port);

    let listener = tokio::net::TcpListener::bind(addr).await
        .map_err(|e| format!("Failed to bind {}: {}", addr, e))?;
    axum::serve(listener, app).await?;
    Ok(())
}
