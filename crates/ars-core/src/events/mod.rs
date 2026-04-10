//! コアイベント定義
//!
//! ars-core が定義するイベント。全モジュールが depends_on 宣言なしで購読可能。
//! プラグインは自身のクレート内に独自イベントを定義する。

pub mod project;
pub mod scene;
pub mod assembly;
pub mod resource;
pub mod auth;
pub mod data;

pub use project::*;
pub use scene::*;
pub use assembly::*;
pub use resource::*;
pub use auth::*;
pub use data::*;
