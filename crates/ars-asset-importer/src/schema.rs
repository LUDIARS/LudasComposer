//! アセットメタデータとキャッシュレイアウトの型定義
//!
//! `data/<asset-id>/` 配下の物理レイアウト:
//!
//! ```text
//! data/<asset-id>/
//! ├ source.<ext>    原アセット (コピー)
//! ├ proxy.glb       簡略メッシュ (P2 以降)
//! ├ hull.bin        凸包 (P3 以降)
//! ├ meta.toml       AABB / OBB / pivot / source_hash
//! └ thumb.webp      4 方向サムネ (Pictor#37 P1 連携)
//! ```

use std::path::{Path, PathBuf};

use glam::{Mat3, Vec3};
use serde::{Deserialize, Serialize};

/// アセット一意識別子。UUID v4 を基底とするが、ビュー上は短縮表示可能。
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct AssetId(String);

impl AssetId {
    pub fn new() -> Self {
        Self(uuid::Uuid::new_v4().to_string())
    }

    pub fn from_string(s: impl Into<String>) -> Self {
        Self(s.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for AssetId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

/// 軸整列バウンディングボックス (AABB)。`min <= max` を保つ。
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Bounds {
    pub min: [f32; 3],
    pub max: [f32; 3],
}

impl Bounds {
    pub fn from_points(points: impl IntoIterator<Item = Vec3>) -> Option<Self> {
        let mut iter = points.into_iter();
        let first = iter.next()?;
        let mut min = first;
        let mut max = first;
        for p in iter {
            min = min.min(p);
            max = max.max(p);
        }
        Some(Self {
            min: min.to_array(),
            max: max.to_array(),
        })
    }

    pub fn center(&self) -> Vec3 {
        (Vec3::from(self.min) + Vec3::from(self.max)) * 0.5
    }

    pub fn extent(&self) -> Vec3 {
        Vec3::from(self.max) - Vec3::from(self.min)
    }
}

/// 向き付きバウンディングボックス (OBB)。
///
/// `center` から `axes` (正規直交) と `half_extents` で定義される。
/// 3 つの軸は列ベクトル: `axes.col(i)` が第 i 軸。
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct OrientedBox {
    pub center: [f32; 3],
    /// 列優先 3x3: `[col0.xyz, col1.xyz, col2.xyz]`
    pub axes: [[f32; 3]; 3],
    pub half_extents: [f32; 3],
}

impl OrientedBox {
    pub fn axes_mat(&self) -> Mat3 {
        Mat3::from_cols_array_2d(&self.axes)
    }
}

/// `meta.toml` にシリアライズされるアセットメタデータ。
///
/// フォーマットバージョンは breaking change 時に上げる。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetMeta {
    /// Schema version. 互換性のない変更時にインクリメント。
    pub version: u32,
    pub id: AssetId,
    pub name: String,
    /// 原ファイルの拡張子 (例: "glb", "gltf")
    pub source_ext: String,
    /// 原ファイルの BLAKE3 hash (hex)。キャッシュヒット判定に使用。
    pub source_hash: String,
    pub aabb: Bounds,
    pub obb: OrientedBox,
    /// ピボット位置 (ローカル座標系)。現在は AABB 中心を使用。
    pub pivot: [f32; 3],
    /// 三角形数 (原メッシュ)
    pub triangle_count: u32,
    /// 頂点数 (原メッシュ)
    pub vertex_count: u32,
    /// `proxy.glb` の三角形数 (P2 以降で書き込まれる)。
    ///
    /// P1 で生成された meta は本フィールドを持たないため、`#[serde(default)]`
    /// で `None` として読み込まれる。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub proxy_triangle_count: Option<u32>,
    /// `hull.bin` の頂点数 (P3 以降で書き込まれる)。
    ///
    /// 共面/退化メッシュ等で凸包生成に失敗した場合は `None`。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hull_vertex_count: Option<u32>,
    /// `hull.bin` の三角形数 (P3 以降で書き込まれる)。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hull_triangle_count: Option<u32>,
}

impl AssetMeta {
    pub const CURRENT_VERSION: u32 = 1;
}

/// `data/<id>/` のパスを組み立てる小さなヘルパ。
///
/// `root` はプロジェクトの `data/` ディレクトリを指す。
pub struct CacheLayout<'a> {
    pub root: &'a Path,
    pub id: &'a AssetId,
}

impl<'a> CacheLayout<'a> {
    pub fn new(root: &'a Path, id: &'a AssetId) -> Self {
        Self { root, id }
    }

    pub fn dir(&self) -> PathBuf {
        self.root.join(self.id.as_str())
    }

    pub fn meta_path(&self) -> PathBuf {
        self.dir().join("meta.toml")
    }

    pub fn source_path(&self, ext: &str) -> PathBuf {
        self.dir().join(format!("source.{ext}"))
    }

    pub fn proxy_path(&self) -> PathBuf {
        self.dir().join("proxy.glb")
    }

    pub fn hull_path(&self) -> PathBuf {
        self.dir().join("hull.bin")
    }

    pub fn thumb_path(&self) -> PathBuf {
        self.dir().join("thumb.webp")
    }
}
