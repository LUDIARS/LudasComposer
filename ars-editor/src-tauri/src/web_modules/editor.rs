/// Editor モジュール
///
/// プロジェクト管理、認証（Cernere プロキシ）、クラウド保存、Git操作、
/// コード生成ブリッジのAPIルートを提供する。
/// 認証・ユーザー・プロジェクト管理は Cernere サーバーに委譲する。
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{Json, Redirect},
    routing::{delete, get, post},
    Router,
};
use axum_extra::extract::cookie::CookieJar;
use serde::Deserialize;

use crate::app_state::AppState;
use crate::commands::project::{
    get_default_project_path_impl, list_projects_impl, load_project_impl, save_project_impl,
};
use crate::git_ops;
use crate::models::{GitProjectInfo, GitRepo, Project};

// コード生成ブリッジ
use ars_codegen::bridge::{
    CodegenBridge, CodegenBridgeConfig, CodegenPreviewResult,
    OutputFormat, TargetPlatform,
};

const SESSION_COOKIE: &str = "ars_session";

/// Cookie からセッションID を取得
fn get_session_cookie(jar: &CookieJar) -> Result<String, (StatusCode, String)> {
    jar.get(SESSION_COOKIE)
        .map(|c| c.value().to_string())
        .ok_or((StatusCode::UNAUTHORIZED, "Not authenticated".to_string()))
}

// ========== Local file-based APIs ==========

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

// ========== Auth routes (proxy to Cernere) ==========

/// GET /auth/github/login — Cernere にリダイレクト
async fn auth_github_login(
    State(state): State<AppState>,
) -> Redirect {
    Redirect::temporary(&state.cernere.login_url())
}

/// GET /auth/github/callback — Cernere にリダイレクト
async fn auth_github_callback(
    State(state): State<AppState>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Redirect {
    let query_string: String = params
        .iter()
        .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
        .collect::<Vec<_>>()
        .join("&");
    let url = format!("{}?{}", state.cernere.callback_url(), query_string);
    Redirect::temporary(&url)
}

/// GET /auth/me — Cernere からユーザー情報を取得
async fn auth_get_me(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<ars_core::models::User>, (StatusCode, String)> {
    let cookie = get_session_cookie(&jar)?;
    let user = state.cernere.get_me(&cookie).await
        .map_err(|e| (StatusCode::UNAUTHORIZED, e))?;
    Ok(Json(user))
}

/// POST /auth/logout — Cernere にログアウトをプロキシ
async fn auth_logout(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<()>, (StatusCode, String)> {
    if let Ok(cookie) = get_session_cookie(&jar) {
        // Best-effort: notify Cernere
        let _ = state.cernere.get_me(&cookie).await;
    }
    Ok(Json(()))
}

// ========== Cloud project APIs (via Cernere) ==========

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
    let cookie = get_session_cookie(&jar)?;
    state
        .cernere
        .save_project(&cookie, &req.project_id, &req.project)
        .await
        .map(|_| Json(()))
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
    let cookie = get_session_cookie(&jar)?;
    state
        .cernere
        .load_project(&cookie, &q.project_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?
        .map(Json)
        .ok_or((StatusCode::NOT_FOUND, "Project not found".to_string()))
}

async fn api_cloud_list_projects(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<crate::models::ProjectSummary>>, (StatusCode, String)> {
    let cookie = get_session_cookie(&jar)?;
    let summaries = state
        .cernere
        .list_projects(&cookie)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    // Convert ars_core::models::ProjectSummary to crate::models::ProjectSummary
    let result: Vec<crate::models::ProjectSummary> = summaries
        .into_iter()
        .map(|s| crate::models::ProjectSummary {
            id: s.id,
            name: s.name,
            updated_at: s.updated_at,
        })
        .collect();
    Ok(Json(result))
}

async fn api_cloud_delete_project(
    State(state): State<AppState>,
    jar: CookieJar,
    Path(project_id): Path<String>,
) -> Result<Json<()>, (StatusCode, String)> {
    let cookie = get_session_cookie(&jar)?;
    state
        .cernere
        .delete_project(&cookie, &project_id)
        .await
        .map(|_| Json(()))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))
}

// ========== Git project management APIs ==========

async fn api_git_list_repos(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<GitRepo>>, (StatusCode, String)> {
    let cookie = get_session_cookie(&jar)?;
    let session = state.cernere.get_session(&cookie).await
        .map_err(|e| (StatusCode::UNAUTHORIZED, e))?;
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

async fn api_git_create_repo(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<CreateRepoRequest>,
) -> Result<Json<GitRepo>, (StatusCode, String)> {
    let cookie = get_session_cookie(&jar)?;
    let session = state.cernere.get_session(&cookie).await
        .map_err(|e| (StatusCode::UNAUTHORIZED, e))?;
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

async fn api_git_clone(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<CloneRequest>,
) -> Result<Json<GitProjectInfo>, (StatusCode, String)> {
    let cookie = get_session_cookie(&jar)?;
    let session = state.cernere.get_session(&cookie).await
        .map_err(|e| (StatusCode::UNAUTHORIZED, e))?;
    let token = session.access_token.clone();
    let clone_url = req.clone_url.clone();
    let full_name = req.full_name.clone();

    let result = tokio::task::spawn_blocking(move || {
        git_ops::clone_repo(&token, &clone_url, &full_name)
    })
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Task failed: {}", e)))?
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    let has_project = result.join("project.json").exists();

    Ok(Json(GitProjectInfo {
        repo_full_name: req.full_name,
        branch: "main".to_string(),
        has_project,
        local_path: result.to_string_lossy().to_string(),
    }))
}

#[derive(Deserialize)]
struct GitLoadQuery {
    repo: String,
}

async fn api_git_load_project(
    State(state): State<AppState>,
    jar: CookieJar,
    Query(q): Query<GitLoadQuery>,
) -> Result<Json<Option<Project>>, (StatusCode, String)> {
    let cookie = get_session_cookie(&jar)?;
    let _session = state.cernere.get_session(&cookie).await
        .map_err(|e| (StatusCode::UNAUTHORIZED, e))?;
    let repo = q.repo.clone();

    let project = tokio::task::spawn_blocking(move || git_ops::load_project_from_repo(&repo))
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Task failed: {}", e)))?
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    Ok(Json(project))
}

#[derive(Deserialize)]
struct GitPushRequest {
    #[serde(rename = "fullName")]
    full_name: String,
    project: Project,
    message: Option<String>,
}

async fn api_git_push(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<GitPushRequest>,
) -> Result<Json<()>, (StatusCode, String)> {
    let cookie = get_session_cookie(&jar)?;
    let session = state.cernere.get_session(&cookie).await
        .map_err(|e| (StatusCode::UNAUTHORIZED, e))?;
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

async fn api_git_list_local_projects(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<GitProjectInfo>>, (StatusCode, String)> {
    let cookie = get_session_cookie(&jar)?;
    let _session = state.cernere.get_session(&cookie).await
        .map_err(|e| (StatusCode::UNAUTHORIZED, e))?;

    let projects = tokio::task::spawn_blocking(git_ops::list_local_projects)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Task failed: {}", e)))?
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    Ok(Json(projects))
}

// ========== Code Generation Bridge APIs ==========

/// 対応プラットフォーム一覧を返す
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PlatformInfo {
    id: TargetPlatform,
    label: String,
    language: String,
    file_extension: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct OutputFormatInfo {
    id: OutputFormat,
    label: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CodegenOptionsResponse {
    platforms: Vec<PlatformInfo>,
    output_formats: Vec<OutputFormatInfo>,
}

async fn api_codegen_options() -> Json<CodegenOptionsResponse> {
    let platforms = vec![
        PlatformInfo {
            id: TargetPlatform::Unity,
            label: TargetPlatform::Unity.label().to_string(),
            language: TargetPlatform::Unity.language().to_string(),
            file_extension: TargetPlatform::Unity.file_extension().to_string(),
        },
        PlatformInfo {
            id: TargetPlatform::Godot,
            label: TargetPlatform::Godot.label().to_string(),
            language: TargetPlatform::Godot.language().to_string(),
            file_extension: TargetPlatform::Godot.file_extension().to_string(),
        },
        PlatformInfo {
            id: TargetPlatform::Unreal,
            label: TargetPlatform::Unreal.label().to_string(),
            language: TargetPlatform::Unreal.language().to_string(),
            file_extension: TargetPlatform::Unreal.file_extension().to_string(),
        },
        PlatformInfo {
            id: TargetPlatform::Ergo,
            label: TargetPlatform::Ergo.label().to_string(),
            language: TargetPlatform::Ergo.language().to_string(),
            file_extension: TargetPlatform::Ergo.file_extension().to_string(),
        },
    ];

    let output_formats = vec![
        OutputFormatInfo {
            id: OutputFormat::SourceOnly,
            label: OutputFormat::SourceOnly.label().to_string(),
        },
        OutputFormatInfo {
            id: OutputFormat::WithTests,
            label: OutputFormat::WithTests.label().to_string(),
        },
        OutputFormatInfo {
            id: OutputFormat::Full,
            label: OutputFormat::Full.label().to_string(),
        },
    ];

    Json(CodegenOptionsResponse {
        platforms,
        output_formats,
    })
}

/// コード生成プレビュー
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CodegenPreviewRequest {
    project: Project,
    config: CodegenBridgeConfig,
}

async fn api_codegen_preview(
    Json(req): Json<CodegenPreviewRequest>,
) -> Result<Json<CodegenPreviewResult>, (StatusCode, String)> {
    let result = CodegenBridge::preview(&req.project, &req.config);
    Ok(Json(result))
}

/// エディタモジュールのルーターを構築
pub fn router(state: AppState) -> Router {
    Router::new()
        // Local file-based APIs
        .route("/api/project/save", post(api_save_project))
        .route("/api/project/load", get(api_load_project))
        .route("/api/project/default-path", get(api_default_path))
        .route("/api/project/list", get(api_list_projects))
        // Auth routes (proxy to Cernere)
        .route("/auth/github/login", get(auth_github_login))
        .route("/auth/github/callback", get(auth_github_callback))
        .route("/auth/me", get(auth_get_me))
        .route("/auth/logout", post(auth_logout))
        // Cloud project APIs (via Cernere)
        .route("/api/cloud/project/save", post(api_cloud_save_project))
        .route("/api/cloud/project/load", get(api_cloud_load_project))
        .route("/api/cloud/project/list", get(api_cloud_list_projects))
        .route("/api/cloud/project/:project_id", delete(api_cloud_delete_project))
        // Git project management APIs
        .route("/api/git/repos", get(api_git_list_repos).post(api_git_create_repo))
        .route("/api/git/clone", post(api_git_clone))
        .route("/api/git/project/load", get(api_git_load_project))
        .route("/api/git/push", post(api_git_push))
        .route("/api/git/projects", get(api_git_list_local_projects))
        // Code generation bridge APIs
        .route("/api/codegen/options", get(api_codegen_options))
        .route("/api/codegen/preview", post(api_codegen_preview))
        .with_state(state)
}
