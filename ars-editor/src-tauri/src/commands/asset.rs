//! アセットインポート Tauri コマンド (P5)
//!
//! ars-asset-importer クレートを呼び出し、glTF/GLB アセットを Tier 1 成果物
//! (`data/<id>/{source,proxy,hull,meta}`) として書き出す。
//!
//! ## セキュリティ
//!
//! - `path` はユーザーが選択したファイルなのでパス制約は課さない (D&D 由来)
//! - `out_root` はプロジェクトの `data/` ディレクトリに固定 (パストラバーサル防止)
//! - インポート結果は `ImportedAsset` で id / dir / cache_hit を返す

use ars_asset_importer::{process, AssetMeta};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// `import_asset` が返す 1 アセット分の結果。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedAsset {
    pub id: String,
    /// `data/<id>/` の絶対パス。
    pub dir: String,
    /// 既に同一 source_hash がキャッシュ済みだったか。
    pub cache_hit: bool,
    /// 原ファイル名 (拡張子付き)。
    pub source_name: String,
    /// インポート結果 meta (frontend で proxy/hull の有無を判別するため)。
    pub meta: AssetMeta,
}

/// 1 つ以上のアセットファイルを `project_dir/data/` 配下にインポートする。
///
/// 失敗したファイルがあっても他は続行し、エラーはログに残してスキップする。
/// 結果は成功した分のみ返す。
#[cfg(feature = "tauri-app")]
#[tauri::command]
pub async fn import_assets(
    project_dir: String,
    paths: Vec<String>,
) -> Result<Vec<ImportedAsset>, String> {
    import_assets_impl(project_dir, paths)
}

pub fn import_assets_impl(
    project_dir: String,
    paths: Vec<String>,
) -> Result<Vec<ImportedAsset>, String> {
    let project_root = PathBuf::from(&project_dir);
    if !project_root.is_dir() {
        return Err(format!("project_dir does not exist: {project_dir}"));
    }
    let out_root = project_root.join("data");
    std::fs::create_dir_all(&out_root)
        .map_err(|e| format!("failed to create data dir: {e}"))?;

    let mut results = Vec::with_capacity(paths.len());
    for p in paths {
        let src = PathBuf::from(&p);
        match process(&src, &out_root, None) {
            Ok(outcome) => {
                let source_name = src
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                results.push(ImportedAsset {
                    id: outcome.id.to_string(),
                    dir: outcome.dir.to_string_lossy().to_string(),
                    cache_hit: outcome.cache_hit,
                    source_name,
                    meta: outcome.meta,
                });
            }
            Err(e) => {
                log::warn!("import_asset failed for {p}: {e}");
                // continue: don't abort the whole batch on a single failure
            }
        }
    }
    Ok(results)
}

/// 既存のインポート済みアセット一覧を返す (起動時 / D&D 完了後の refresh 用)。
#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn list_imported_assets(project_dir: String) -> Result<Vec<ImportedAsset>, String> {
    list_imported_assets_impl(project_dir)
}

pub fn list_imported_assets_impl(project_dir: String) -> Result<Vec<ImportedAsset>, String> {
    let data_root = PathBuf::from(&project_dir).join("data");
    if !data_root.is_dir() {
        return Ok(Vec::new());
    }

    let mut out = Vec::new();
    let entries = std::fs::read_dir(&data_root)
        .map_err(|e| format!("failed to read data dir: {e}"))?;
    for entry in entries.flatten() {
        let dir = entry.path();
        if !dir.is_dir() {
            continue;
        }
        let meta_path = dir.join("meta.toml");
        if !meta_path.exists() {
            continue;
        }
        match read_meta(&meta_path) {
            Ok(meta) => {
                let source_name = dir
                    .join(format!("source.{}", meta.source_ext))
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                out.push(ImportedAsset {
                    id: meta.id.to_string(),
                    dir: dir.to_string_lossy().to_string(),
                    cache_hit: true,
                    source_name,
                    meta,
                });
            }
            Err(e) => {
                log::warn!("failed to read meta.toml at {}: {e}", meta_path.display());
            }
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

fn read_meta(path: &Path) -> Result<AssetMeta, String> {
    let text = std::fs::read_to_string(path)
        .map_err(|e| format!("read meta: {e}"))?;
    toml::from_str(&text).map_err(|e| format!("parse meta: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn write_minimal_glb(path: &Path) {
        // 1 三角形の最小 GLB (statically embedded test fixture)
        let verts: [[f32; 3]; 3] = [[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]];
        let mut bin = Vec::new();
        for v in &verts {
            for &c in v {
                bin.extend_from_slice(&c.to_le_bytes());
            }
        }
        let idx_off = bin.len();
        for i in [0u16, 1, 2] {
            bin.extend_from_slice(&i.to_le_bytes());
        }
        while bin.len() % 4 != 0 {
            bin.push(0);
        }

        let json = format!(
            r#"{{"asset":{{"version":"2.0"}},"buffers":[{{"byteLength":{}}}],"bufferViews":[{{"buffer":0,"byteOffset":0,"byteLength":36,"target":34962}},{{"buffer":0,"byteOffset":{},"byteLength":6,"target":34963}}],"accessors":[{{"bufferView":0,"componentType":5126,"count":3,"type":"VEC3","min":[0,0,0],"max":[1,1,0]}},{{"bufferView":1,"componentType":5123,"count":3,"type":"SCALAR"}}],"meshes":[{{"primitives":[{{"attributes":{{"POSITION":0}},"indices":1,"mode":4}}]}}],"nodes":[{{"mesh":0}}],"scenes":[{{"nodes":[0]}}],"scene":0}}"#,
            bin.len(), idx_off
        );
        let mut json_bytes = json.into_bytes();
        while json_bytes.len() % 4 != 0 {
            json_bytes.push(0x20);
        }

        let total = 12 + 8 + json_bytes.len() + 8 + bin.len();
        let mut out = Vec::with_capacity(total);
        out.extend_from_slice(&0x46546C67u32.to_le_bytes());
        out.extend_from_slice(&2u32.to_le_bytes());
        out.extend_from_slice(&(total as u32).to_le_bytes());
        out.extend_from_slice(&(json_bytes.len() as u32).to_le_bytes());
        out.extend_from_slice(&0x4E4F534Au32.to_le_bytes());
        out.extend_from_slice(&json_bytes);
        out.extend_from_slice(&(bin.len() as u32).to_le_bytes());
        out.extend_from_slice(&0x004E4942u32.to_le_bytes());
        out.extend_from_slice(&bin);

        fs::write(path, out).unwrap();
    }

    #[test]
    fn import_two_assets_then_list_them() {
        let tmp = tempfile::TempDir::new().unwrap();
        let project = tmp.path().to_path_buf();
        let a = project.join("a.glb");
        let b = project.join("b.glb");
        write_minimal_glb(&a);
        write_minimal_glb(&b);

        let imported = import_assets_impl(
            project.to_string_lossy().to_string(),
            vec![
                a.to_string_lossy().to_string(),
                b.to_string_lossy().to_string(),
            ],
        )
        .unwrap();
        assert_eq!(imported.len(), 2);

        let listed = list_imported_assets_impl(project.to_string_lossy().to_string()).unwrap();
        assert_eq!(listed.len(), 2);
    }

    #[test]
    fn missing_project_dir_errors() {
        let err = import_assets_impl("/nonexistent/path/xyz".into(), vec![]).unwrap_err();
        assert!(err.contains("does not exist"), "got: {err}");
    }

    #[test]
    fn unsupported_format_is_skipped_not_aborted() {
        let tmp = tempfile::TempDir::new().unwrap();
        let project = tmp.path().to_path_buf();
        let bad = project.join("bad.txt");
        let good = project.join("good.glb");
        std::fs::write(&bad, b"not a glb").unwrap();
        write_minimal_glb(&good);

        let imported = import_assets_impl(
            project.to_string_lossy().to_string(),
            vec![
                bad.to_string_lossy().to_string(),
                good.to_string_lossy().to_string(),
            ],
        )
        .unwrap();
        // bad は skip、good のみ成功
        assert_eq!(imported.len(), 1);
        assert_eq!(imported[0].source_name, "good.glb");
    }
}
