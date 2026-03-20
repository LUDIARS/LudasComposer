use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::Deserialize;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

use crate::organizer::DataOrganizer;
use crate::schema::DataSchema;
use crate::master_data::MasterDataEntry;
use crate::user_data::UserVariable;
use std::sync::Mutex;

/// 読み書き可能なアプリケーション状態
pub struct AppState {
    pub organizer: Mutex<DataOrganizer>,
    pub data_dir: std::path::PathBuf,
}

impl AppState {
    fn save_organizer(&self, organizer: &DataOrganizer) -> Result<(), (StatusCode, String)> {
        organizer
            .save(&self.data_dir)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
    }
}

// ========== スキーマ API ==========

/// GET /api/schemas - 全スキーマ一覧
async fn api_get_schemas(
    State(state): State<std::sync::Arc<AppState>>,
) -> Json<Vec<DataSchema>> {
    let org = state.organizer.lock().unwrap();
    let schemas: Vec<DataSchema> = org.master_data().schemas().cloned().collect();
    Json(schemas)
}

/// GET /api/schemas/:schema_id - スキーマ詳細
async fn api_get_schema(
    State(state): State<std::sync::Arc<AppState>>,
    Path(schema_id): Path<String>,
) -> Result<Json<DataSchema>, (StatusCode, String)> {
    let org = state.organizer.lock().unwrap();
    org.master_data()
        .get_schema(&schema_id)
        .map(|s| Json(s.clone()))
        .map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))
}

/// POST /api/schemas - スキーマ登録
async fn api_create_schema(
    State(state): State<std::sync::Arc<AppState>>,
    Json(schema): Json<DataSchema>,
) -> Result<Json<DataSchema>, (StatusCode, String)> {
    let mut org = state.organizer.lock().unwrap();
    let schema_clone = schema.clone();
    org.master_data_mut()
        .register_schema(schema)
        .map_err(|e| (StatusCode::CONFLICT, e.to_string()))?;
    state.save_organizer(&org)?;
    Ok(Json(schema_clone))
}

// ========== エントリ API ==========

/// GET /api/schemas/:schema_id/entries - エントリ一覧
async fn api_get_entries(
    State(state): State<std::sync::Arc<AppState>>,
    Path(schema_id): Path<String>,
) -> Result<Json<Vec<MasterDataEntry>>, (StatusCode, String)> {
    let org = state.organizer.lock().unwrap();
    org.master_data()
        .get_entries(&schema_id)
        .map(|entries| Json(entries.into_iter().cloned().collect()))
        .map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))
}

/// GET /api/schemas/:schema_id/entries/:entry_id - エントリ詳細
async fn api_get_entry(
    State(state): State<std::sync::Arc<AppState>>,
    Path((schema_id, entry_id)): Path<(String, String)>,
) -> Result<Json<MasterDataEntry>, (StatusCode, String)> {
    let org = state.organizer.lock().unwrap();
    org.master_data()
        .get_entry(&schema_id, &entry_id)
        .map(|e| Json(e.clone()))
        .map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))
}

#[derive(Deserialize)]
struct CreateEntryRequest {
    entry_id: String,
    actor_id: Option<String>,
}

/// POST /api/schemas/:schema_id/entries - エントリ追加
async fn api_create_entry(
    State(state): State<std::sync::Arc<AppState>>,
    Path(schema_id): Path<String>,
    Json(req): Json<CreateEntryRequest>,
) -> Result<Json<MasterDataEntry>, (StatusCode, String)> {
    let mut org = state.organizer.lock().unwrap();
    let entry = org
        .master_data_mut()
        .add_entry(&schema_id, req.entry_id, req.actor_id)
        .map(|e| e.clone())
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    state.save_organizer(&org)?;
    Ok(Json(entry))
}

#[derive(Deserialize)]
struct UpdateFieldRequest {
    field: String,
    value: serde_json::Value,
}

/// PUT /api/schemas/:schema_id/entries/:entry_id - フィールド値更新
async fn api_update_entry_field(
    State(state): State<std::sync::Arc<AppState>>,
    Path((schema_id, entry_id)): Path<(String, String)>,
    Json(req): Json<UpdateFieldRequest>,
) -> Result<Json<MasterDataEntry>, (StatusCode, String)> {
    let mut org = state.organizer.lock().unwrap();
    org.master_data_mut()
        .update_entry_field(&schema_id, &entry_id, &req.field, req.value)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    let entry = org
        .master_data()
        .get_entry(&schema_id, &entry_id)
        .map(|e| Json(e.clone()))
        .map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))?;
    state.save_organizer(&org)?;
    Ok(entry)
}

// ========== ユーザーデータ API ==========

/// GET /api/user-data/variables - 全変数一覧
async fn api_get_variables(
    State(state): State<std::sync::Arc<AppState>>,
) -> Json<Vec<UserVariable>> {
    let org = state.organizer.lock().unwrap();
    let vars: Vec<UserVariable> = org
        .user_data()
        .persistent_variables()
        .into_iter()
        .cloned()
        .collect();
    Json(vars)
}

#[derive(Deserialize)]
struct ActorQuery {
    actor_id: Option<String>,
}

/// GET /api/user-data/variables/by-actor - アクター別変数一覧
async fn api_get_variables_by_actor(
    State(state): State<std::sync::Arc<AppState>>,
    Query(q): Query<ActorQuery>,
) -> Json<Vec<UserVariable>> {
    let org = state.organizer.lock().unwrap();
    if let Some(actor_id) = &q.actor_id {
        Json(org.user_data().variables_for_actor(actor_id).into_iter().cloned().collect())
    } else {
        Json(vec![])
    }
}

/// POST /api/user-data/variables - 変数登録
async fn api_register_variable(
    State(state): State<std::sync::Arc<AppState>>,
    Json(var): Json<UserVariable>,
) -> Result<Json<UserVariable>, (StatusCode, String)> {
    let mut org = state.organizer.lock().unwrap();
    let var_clone = var.clone();
    org.user_data_mut()
        .register_variable(var)
        .map_err(|e| (StatusCode::CONFLICT, e.to_string()))?;
    state.save_organizer(&org)?;
    Ok(Json(var_clone))
}

#[derive(Deserialize)]
struct SetVariableRequest {
    name: String,
    actor_id: Option<String>,
    value: serde_json::Value,
}

/// PUT /api/user-data/variables - 変数値更新
async fn api_set_variable(
    State(state): State<std::sync::Arc<AppState>>,
    Json(req): Json<SetVariableRequest>,
) -> Result<Json<()>, (StatusCode, String)> {
    let mut org = state.organizer.lock().unwrap();
    org.user_data_mut()
        .set_variable(&req.name, req.actor_id.as_deref(), req.value)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    state.save_organizer(&org)?;
    Ok(Json(()))
}

// ========== エクスポート / インポート API ==========

/// GET /api/export - 全データをJSONエクスポート
async fn api_export(
    State(state): State<std::sync::Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let org = state.organizer.lock().unwrap();
    let json_str = org
        .export_json()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let value: serde_json::Value = serde_json::from_str(&json_str)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(value))
}

/// POST /api/import - JSONからインポート
async fn api_import(
    State(state): State<std::sync::Arc<AppState>>,
    Json(data): Json<serde_json::Value>,
) -> Result<Json<()>, (StatusCode, String)> {
    let json_str = serde_json::to_string(&data)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    let new_org = DataOrganizer::import_json(&json_str)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    let mut org = state.organizer.lock().unwrap();
    *org = new_org;
    state.save_organizer(&org)?;
    Ok(Json(()))
}

pub fn api_router(state: std::sync::Arc<AppState>) -> Router {
    Router::new()
        // スキーマ
        .route("/api/schemas", get(api_get_schemas).post(api_create_schema))
        .route("/api/schemas/:schema_id", get(api_get_schema))
        // エントリ
        .route(
            "/api/schemas/:schema_id/entries",
            get(api_get_entries).post(api_create_entry),
        )
        .route(
            "/api/schemas/:schema_id/entries/:entry_id",
            get(api_get_entry).post(api_update_entry_field),
        )
        // ユーザーデータ
        .route("/api/user-data/variables", get(api_get_variables).post(api_register_variable))
        .route("/api/user-data/variables/update", post(api_set_variable))
        .route("/api/user-data/variables/by-actor", get(api_get_variables_by_actor))
        // エクスポート / インポート
        .route("/api/export", get(api_export))
        .route("/api/import", post(api_import))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

pub async fn serve(port: u16, static_dir: Option<String>) -> Result<(), Box<dyn std::error::Error>> {
    let data_dir = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(".ars")
        .join("data-organizer");

    std::fs::create_dir_all(&data_dir).ok();

    let organizer = DataOrganizer::load(&data_dir).unwrap_or_else(|_| {
        println!("No existing data found, starting fresh.");
        DataOrganizer::new()
    });

    let state = std::sync::Arc::new(AppState {
        organizer: Mutex::new(organizer),
        data_dir,
    });

    let app = if let Some(dir) = static_dir {
        api_router(state).fallback_service(ServeDir::new(dir))
    } else {
        api_router(state)
    };

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    println!("Data Organizer web server listening on http://localhost:{}", port);

    let listener = tokio::net::TcpListener::bind(addr).await
        .map_err(|e| format!("Failed to bind {}: {}", addr, e))?;
    axum::serve(listener, app).await?;
    Ok(())
}
