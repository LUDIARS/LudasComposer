//! `GameLexiconRepository` trait
//!
//! Layer 2 の use case (将来追加) はこの trait 越しにロード / 保存する。
//! Layer 3 (App / Web) で具体実装を注入する。

use async_trait::async_trait;

use crate::domain::Lexicon;
use crate::error::Result;

#[async_trait]
pub trait GameLexiconRepository: Send + Sync {
    /// 組込みデータ (`spec/game-lexicon/` に同梱) をロード
    async fn load_builtin(&self) -> Result<Lexicon>;

    /// プロジェクト固有のオーバーレイをロード (未指定なら空 Lexicon)
    async fn load_project_overlay(&self, project_id: &str) -> Result<Lexicon>;

    /// プロジェクト固有のオーバーレイを保存
    async fn save_project_overlay(&self, project_id: &str, overlay: &Lexicon) -> Result<()>;
}
