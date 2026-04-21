//! ars-asset-importer: Tier 1 プロキシ生成パイプライン
//!
//! Ars レベルエディタ向けアセット 2-Tier 戦略の ars 側実装。
//! インポート時に決定的に Tier 1 成果物を生成し、`data/<id>/` 配下へ保存する。
//!
//! ## Tier 構成
//!
//! - Tier 0: Manifest (起動時にロード)
//! - Tier 1: Preview Proxy — 簡略メッシュ + 凸包 + OBB + サムネ (配置時)
//! - Tier 2: Full Asset — 原メッシュ + PBR + GI (接近時/ビルド時)
//!
//! 本クレートは **Tier 1 の生成**を担当する。描画側の対応は Pictor#37 を参照。
//!
//! ## P1 (`#92` の Phase 1)
//!
//! - glTF ローダー
//! - AABB / OBB 算出
//! - source hash によるキャッシュ判定
//! - `data/<id>/` レイアウト書き出し
//!
//! ## P2 (`#92` の Phase 2)
//!
//! - meshopt による mesh simplification
//! - `proxy.glb` (positions + indices のみの最小 GLB) 書き出し
//!
//! ## P3 (`#92` の Phase 3)
//!
//! - chull (pure Rust QuickHull 系) で 3D 凸包を生成
//! - 独自バイナリ `hull.bin` (HULL magic + 頂点 + 三角形) で書き出し

pub mod error;
pub mod hull;
pub mod hull_writer;
pub mod loaders;
pub mod obb;
pub mod pipeline;
pub mod proxy_writer;
pub mod schema;
pub mod simplify;
pub mod thumbnail;

pub use error::{AssetImporterError, Result};
pub use pipeline::{process, ProcessOutcome};
pub use schema::{AssetId, AssetMeta, Bounds, OrientedBox};
