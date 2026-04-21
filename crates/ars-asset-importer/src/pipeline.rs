//! インポートパイプラインの統合エントリポイント。
//!
//! ```text
//! src ──► hash ──► cache check ──┬─► HIT: skip
//!                                 └─► MISS: load → AABB/OBB → write meta.toml + source copy
//! ```
//!
//! P1 スコープでは proxy.glb / hull.bin / thumb.webp は生成しない。
//! P2 以降で段階的に追加する。

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use crate::loaders::{self, MeshData};
use crate::schema::{AssetId, AssetMeta, Bounds, CacheLayout};
use crate::{hull, hull_writer, obb, proxy_writer, simplify, AssetImporterError, Result};

/// `process` の結果。キャッシュヒットかどうかを呼び出し側に伝える。
#[derive(Debug, Clone)]
pub struct ProcessOutcome {
    pub id: AssetId,
    pub dir: PathBuf,
    pub cache_hit: bool,
    pub meta: AssetMeta,
}

/// 原アセット `src` をインポートし、`out_root/<id>/` に Tier 1 成果物を書き出す。
///
/// - `id` が `Some` なら既存アセットの再インポート、`None` なら新規に UUID を発行する。
/// - 同一 `source_hash` がキャッシュ済みなら何もせず既存 meta を返す。
pub fn process(src: &Path, out_root: &Path, id: Option<AssetId>) -> Result<ProcessOutcome> {
    let source_hash = hash_file(src)?;
    let source_ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin")
        .to_ascii_lowercase();

    let id = id.unwrap_or_else(AssetId::new);
    let layout = CacheLayout::new(out_root, &id);
    let dir = layout.dir();

    // キャッシュヒット判定
    if layout.meta_path().exists() {
        let existing = read_meta(&layout.meta_path())?;
        if existing.source_hash == source_hash && existing.version == AssetMeta::CURRENT_VERSION {
            return Ok(ProcessOutcome {
                id: existing.id.clone(),
                dir,
                cache_hit: true,
                meta: existing,
            });
        }
    }

    // キャッシュミス: メッシュ読み込み + 解析
    let mesh = loaders::load(src)?;
    if mesh.is_empty() {
        return Err(AssetImporterError::EmptyGeometry);
    }

    let aabb = Bounds::from_points(mesh.positions.iter().copied())
        .ok_or(AssetImporterError::EmptyGeometry)?;
    let obb = obb::compute(&mesh.positions).ok_or(AssetImporterError::EmptyGeometry)?;
    let pivot = aabb.center().to_array();

    // 書き出し (アトミックではないがローカル前提)
    fs::create_dir_all(&dir).map_err(|e| AssetImporterError::io(&dir, e))?;

    // 原アセットをコピー
    let dst_src = layout.source_path(&source_ext);
    fs::copy(src, &dst_src).map_err(|e| AssetImporterError::io(&dst_src, e))?;

    // proxy.glb (P2): meshopt で decimate → 最小 GLB を書き出し
    let proxy_mesh = simplify::simplify(&mesh, simplify::DEFAULT_TARGET_TRIANGLES);
    proxy_writer::write_glb(&proxy_mesh, &layout.proxy_path())?;
    let proxy_triangle_count = Some(proxy_mesh.triangle_count());

    // hull.bin (P3): 3D 凸包を独自バイナリで書き出し
    // 共面/退化メッシュは凸包不可なので Option として扱う
    let (hull_vertex_count, hull_triangle_count) = match hull::compute(&mesh.positions) {
        Some(h) => {
            hull_writer::write(&h, &layout.hull_path())?;
            (Some(h.vertex_count()), Some(h.triangle_count()))
        }
        None => (None, None),
    };

    let meta = AssetMeta {
        version: AssetMeta::CURRENT_VERSION,
        id: id.clone(),
        name: mesh_display_name(&mesh),
        source_ext: source_ext.clone(),
        source_hash: source_hash.clone(),
        aabb,
        obb,
        pivot,
        triangle_count: mesh.triangle_count(),
        vertex_count: mesh.vertex_count(),
        proxy_triangle_count,
        hull_vertex_count,
        hull_triangle_count,
    };

    // meta.toml
    write_meta(&layout.meta_path(), &meta)?;

    Ok(ProcessOutcome {
        id,
        dir,
        cache_hit: false,
        meta,
    })
}

fn mesh_display_name(mesh: &MeshData) -> String {
    if mesh.name.is_empty() {
        "asset".to_string()
    } else {
        mesh.name.clone()
    }
}

fn hash_file(path: &Path) -> Result<String> {
    let mut hasher = blake3::Hasher::new();
    let mut f = fs::File::open(path).map_err(|e| AssetImporterError::io(path, e))?;
    let mut buf = [0u8; 64 * 1024];
    loop {
        let n = f.read(&mut buf).map_err(|e| AssetImporterError::io(path, e))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hasher.finalize().to_hex().to_string())
}

fn read_meta(path: &Path) -> Result<AssetMeta> {
    let text = fs::read_to_string(path).map_err(|e| AssetImporterError::io(path, e))?;
    let meta: AssetMeta = toml::from_str(&text)?;
    Ok(meta)
}

fn write_meta(path: &Path, meta: &AssetMeta) -> Result<()> {
    let text = toml::to_string_pretty(meta)?;
    fs::write(path, text).map_err(|e| AssetImporterError::io(path, e))
}
