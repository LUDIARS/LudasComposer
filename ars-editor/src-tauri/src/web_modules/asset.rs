//! Asset import の Axum ハンドラ (P6)
//!
//! ブラウザからの multipart アップロードを受け取り、ars-asset-importer
//! 経由で `data/<id>/` 配下に Tier 1 成果物を生成する。
//!
//! 共通実装は `commands::asset::{import_assets_impl, list_imported_assets_impl}`。

use axum::{
    extract::{Multipart, Query},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::Deserialize;
use tempfile::TempDir;

use crate::commands::asset::{
    import_assets_impl, list_imported_assets_impl, ImportedAsset,
};

#[derive(Deserialize)]
struct ImportQuery {
    project_dir: String,
}

#[derive(Deserialize)]
struct ListQuery {
    project_dir: String,
}

/// `multipart/form-data` で 1 つ以上のファイルを受け取り、
/// 一時ディレクトリに書き出した上で import_assets_impl を呼ぶ。
async fn api_import_assets(
    Query(q): Query<ImportQuery>,
    mut multipart: Multipart,
) -> Result<Json<Vec<ImportedAsset>>, (StatusCode, String)> {
    let tmp = TempDir::new()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("tmpdir: {e}")))?;

    let mut paths = Vec::new();
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("multipart: {e}")))?
    {
        // file_name() を String 化 (field consume 前に取得)
        let filename = field
            .file_name()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "uploaded.bin".to_string());

        // パストラバーサル対策: basename のみ
        let safe_name = std::path::Path::new(&filename)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("uploaded.bin")
            .to_string();

        let bytes = field
            .bytes()
            .await
            .map_err(|e| (StatusCode::BAD_REQUEST, format!("read field: {e}")))?;

        let path = tmp.path().join(&safe_name);
        std::fs::write(&path, &bytes)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("write tmp: {e}")))?;
        paths.push(path.to_string_lossy().to_string());
    }

    if paths.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "no files in multipart".to_string()));
    }

    let result = import_assets_impl(q.project_dir, paths)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    // tmp はここで Drop され、一時ファイルは削除される
    drop(tmp);
    Ok(Json(result))
}

async fn api_list_assets(
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<ImportedAsset>>, (StatusCode, String)> {
    list_imported_assets_impl(q.project_dir)
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))
}

pub fn router() -> Router {
    Router::new()
        .route("/api/assets/import", post(api_import_assets))
        .route("/api/assets/list", get(api_list_assets))
}
