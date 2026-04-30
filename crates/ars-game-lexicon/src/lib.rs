//! ars-game-lexicon: ゲーム辞書モジュール
//!
//! ゲーム制作の用語 (Term) ・ 機能 (Feature) ・ ジャンル (Genre) ・
//! プリセット (Preset) を **仕様駆動 (spec-driven)** で集約する。
//!
//! データは `spec/game-lexicon/` 配下の TOML を真とし、 このクレートは
//! ロード / 検証 / ID 引きを提供する Layer 1 + Layer 2 (純粋ローダ)。
//!
//! ## アーキテクチャ
//!
//! ```text
//! Layer 3 (App/Web): Tauri Commands / Axum Handlers が `Lexicon` を呼ぶ
//!     │
//!     ▼
//! Layer 2 (loader, この crate): TOML をパース → 検証 → `Lexicon`
//!     │
//!     ▼
//! Layer 1 (domain, この crate): Genre / Feature / Preset / Term の純粋型
//! ```
//!
//! 設計原則は [`spec/modules/game-lexicon.md`](../../../spec/modules/game-lexicon.md)、
//! TOML スキーマは [`spec/game-lexicon/README.md`](../../../spec/game-lexicon/README.md)。

pub mod domain;
pub mod error;
pub mod loader;
pub mod repository;

pub use domain::{
    Feature, FeatureId, FeatureParameter, Genre, GenreId, I18nName, Lexicon, ParameterType,
    Preset, PresetId, TagId, Term, TermId,
};
pub use error::{LexiconError, Result};
pub use loader::load_from_dir;
pub use repository::GameLexiconRepository;
