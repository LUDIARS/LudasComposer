//! ars-data-organizer: データ管理モジュール
//!
//! マスターデータとユーザーデータを統合的に管理する Layer 2 クレート。
//!
//! ## 概要
//!
//! - **DataSchema**: データの構造を定義する。フィールド名・型・制約を持つ。
//! - **マスターデータ**: スキーマに基づくバリエーション（レコード群）。読み取り専用。
//! - **ユーザーデータ**: スキーマのフィールドがクラスのメンバ変数として宣言される。
//!   SaveDataProvider を注入してデータの復元/保存を行う。
//! - **インポート**: CSV / Excel からマスターデータを流し込む。
//!
//! ## アーキテクチャ
//!
//! ```text
//! Layer 3 (App/Web) ─ EventBus発火、Tauri Commands、Axum Handlers
//!     │
//!     ▼
//! Layer 2 (use_cases) ─ 純粋 async 関数。&dyn Repository を引数に取る。
//!     │
//!     ▼
//! Layer 1 (ars-core) ─ DataSchema, MasterDataTable, UserDataDefinition, Repository traits
//! ```

pub mod import;
pub mod use_cases;
pub mod validation;
