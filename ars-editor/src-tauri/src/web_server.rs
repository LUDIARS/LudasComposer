use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use axum_extra::extract::cookie::CookieJar;
use serde::Deserialize;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

use crate::app_state::AppState;
use crate::auth;
use crate::commands::project::{
    get_default_project_path_impl, list_projects_impl, load_project_impl, save_project_impl,
};
use crate::git_ops;
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

// ========== Local file-based APIs (backward-compatible) ==========

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

// ========== DynamoDB-backed cloud project APIs ==========

#[derive(Deserialize)]
struct CloudSaveRequest {
    #[serde(rename = "projectId")]
    project_id: String,
    project: Project,
}

async fn api_cloud_save_project(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<CloudSaveRequest>,
) -> Result<Json<()>, (StatusCode, String)> {
    let user = auth::extract_user(&state, &jar).await?;
    state
        .dynamo
        .save_project(&user.id, &req.project_id, &req.project)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))
}

#[derive(Deserialize)]
struct CloudLoadQuery {
    #[serde(rename = "projectId")]
    project_id: String,
}

async fn api_cloud_load_project(
    State(state): State<AppState>,
    jar: CookieJar,
    Query(q): Query<CloudLoadQuery>,
) -> Result<Json<Project>, (StatusCode, String)> {
    let user = auth::extract_user(&state, &jar).await?;
    state
        .dynamo
        .load_project(&user.id, &q.project_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?
        .map(Json)
        .ok_or((StatusCode::NOT_FOUND, "Project not found".to_string()))
}

async fn api_cloud_list_projects(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<crate::dynamo::ProjectSummary>>, (StatusCode, String)> {
    let user = auth::extract_user(&state, &jar).await?;
    state
        .dynamo
        .list_user_projects(&user.id)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))
}

async fn api_cloud_delete_project(
    State(state): State<AppState>,
    jar: CookieJar,
    Path(project_id): Path<String>,
) -> Result<Json<()>, (StatusCode, String)> {
    let user = auth::extract_user(&state, &jar).await?;
    state
        .dynamo
        .delete_project(&user.id, &project_id)
        .await
        .map(|_| Json(()))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))
}

// ========== Git project management APIs ==========

/// GET /api/git/repos - List user's GitHub repositories
async fn api_git_list_repos(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<git_ops::GitRepo>>, (StatusCode, String)> {
    let session = auth::extract_session(&state, &jar).await?;
    let repos = git_ops::list_repos(&session.access_token)
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e))?;
    Ok(Json(repos))
}

#[derive(Deserialize)]
struct CreateRepoRequest {
    name: String,
    description: Option<String>,
    private: Option<bool>,
}

/// POST /api/git/repos - Create a new GitHub repository
async fn api_git_create_repo(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<CreateRepoRequest>,
) -> Result<Json<git_ops::GitRepo>, (StatusCode, String)> {
    let session = auth::extract_session(&state, &jar).await?;
    let repo = git_ops::create_repo(
        &session.access_token,
        &req.name,
        req.description.as_deref(),
        req.private.unwrap_or(true),
    )
    .await
    .map_err(|e| (StatusCode::BAD_GATEWAY, e))?;
    Ok(Json(repo))
}

#[derive(Deserialize)]
struct CloneRequest {
    #[serde(rename = "cloneUrl")]
    clone_url: String,
    #[serde(rename = "fullName")]
    full_name: String,
}

/// POST /api/git/clone - Clone a repository
async fn api_git_clone(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<CloneRequest>,
) -> Result<Json<git_ops::GitProjectInfo>, (StatusCode, String)> {
    let session = auth::extract_session(&state, &jar).await?;
    let token = session.access_token.clone();
    let clone_url = req.clone_url.clone();
    let full_name = req.full_name.clone();

    // Clone is blocking (git2), run in a blocking task
    let result = tokio::task::spawn_blocking(move || {
        git_ops::clone_repo(&token, &clone_url, &full_name)
    })
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Task failed: {}", e)))?
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    let has_project = result.join("project.json").exists();

    Ok(Json(git_ops::GitProjectInfo {
        repo_full_name: req.full_name,
        branch: "main".to_string(),
        has_project,
        local_path: result.to_string_lossy().to_string(),
    }))
}

/// GET /api/git/project/load?repo=owner/name - Load project from cloned repo
async fn api_git_load_project(
    State(state): State<AppState>,
    jar: CookieJar,
    Query(q): Query<GitLoadQuery>,
) -> Result<Json<Option<Project>>, (StatusCode, String)> {
    let _session = auth::extract_session(&state, &jar).await?;
    let repo = q.repo.clone();

    let project = tokio::task::spawn_blocking(move || git_ops::load_project_from_repo(&repo))
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Task failed: {}", e)))?
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    Ok(Json(project))
}

#[derive(Deserialize)]
struct GitLoadQuery {
    repo: String,
}

#[derive(Deserialize)]
struct GitPushRequest {
    #[serde(rename = "fullName")]
    full_name: String,
    project: Project,
    message: Option<String>,
}

/// POST /api/git/push - Save project and push to GitHub
async fn api_git_push(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<GitPushRequest>,
) -> Result<Json<()>, (StatusCode, String)> {
    let session = auth::extract_session(&state, &jar).await?;
    let token = session.access_token.clone();
    let full_name = req.full_name.clone();
    let project = req.project.clone();
    let message = req.message.unwrap_or_else(|| "Update project via Ars Editor".to_string());

    tokio::task::spawn_blocking(move || {
        git_ops::save_and_push(&token, &full_name, &project, &message)
    })
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Task failed: {}", e)))?
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    Ok(Json(()))
}

/// GET /api/git/projects - List locally cloned projects
async fn api_git_list_local_projects(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<git_ops::GitProjectInfo>>, (StatusCode, String)> {
    let _session = auth::extract_session(&state, &jar).await?;

    let projects = tokio::task::spawn_blocking(git_ops::list_local_projects)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Task failed: {}", e)))?
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    Ok(Json(projects))
}

pub fn api_router(state: AppState) -> Router {
    Router::new()
        // Local file-based APIs (no auth required)
        .route("/api/project/save", post(api_save_project))
        .route("/api/project/load", get(api_load_project))
        .route("/api/project/default-path", get(api_default_path))
        .route("/api/project/list", get(api_list_projects))
        // Auth routes
        .route("/auth/github/login", get(auth::github_login))
        .route("/auth/github/callback", get(auth::github_callback))
        .route("/auth/me", get(auth::get_me))
        .route("/auth/logout", post(auth::logout))
        // Cloud project APIs (auth required)
        .route("/api/cloud/project/save", post(api_cloud_save_project))
        .route("/api/cloud/project/load", get(api_cloud_load_project))
        .route("/api/cloud/project/list", get(api_cloud_list_projects))
        .route("/api/cloud/project/:project_id", delete(api_cloud_delete_project))
        // Git project management APIs (auth required)
        .route("/api/git/repos", get(api_git_list_repos).post(api_git_create_repo))
        .route("/api/git/clone", post(api_git_clone))
        .route("/api/git/project/load", get(api_git_load_project))
        .route("/api/git/push", post(api_git_push))
        .route("/api/git/projects", get(api_git_list_local_projects))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

pub async fn serve(port: u16, static_dir: Option<String>) {
    let state = AppState::from_env().await;
    let app = if let Some(dir) = static_dir {
        api_router(state).fallback_service(ServeDir::new(dir))
    } else {
        api_router(state)
    };

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    println!("Ars Editor web server listening on http://localhost:{}", port);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
