use axum::{
    extract::Query,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::Deserialize;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

use crate::commands::project::{
    get_default_project_path_impl, list_projects_impl, load_project_impl, save_project_impl,
};
use crate::models::Project;

#[derive(Deserialize)]
struct SaveRequest {
    path: String,
    project: Project,
}

#[derive(Deserialize)]
struct LoadQuery {
    path: String,
}

async fn api_save_project(
    Json(req): Json<SaveRequest>,
) -> Result<Json<()>, (StatusCode, String)> {
    save_project_impl(req.path, req.project)
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))
}

async fn api_load_project(
    Query(q): Query<LoadQuery>,
) -> Result<Json<Project>, (StatusCode, String)> {
    load_project_impl(q.path)
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))
}

async fn api_default_path() -> Result<Json<String>, (StatusCode, String)> {
    get_default_project_path_impl()
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))
}

async fn api_list_projects() -> Result<Json<Vec<String>>, (StatusCode, String)> {
    list_projects_impl()
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))
}

pub fn api_router() -> Router {
    Router::new()
        .route("/api/project/save", post(api_save_project))
        .route("/api/project/load", get(api_load_project))
        .route("/api/project/default-path", get(api_default_path))
        .route("/api/project/list", get(api_list_projects))
        .layer(CorsLayer::permissive())
}

pub async fn serve(port: u16, static_dir: Option<String>) {
    let app = if let Some(dir) = static_dir {
        api_router().fallback_service(ServeDir::new(dir))
    } else {
        api_router()
    };

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    println!("Ars Editor web server listening on http://localhost:{}", port);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
