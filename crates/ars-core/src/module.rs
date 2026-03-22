use std::any::Any;

use async_trait::async_trait;

use crate::error::Result;
use crate::event_bus::EventBus;

/// モジュールのスコープ
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ModuleScope {
    /// アプリ起動〜終了まで生存
    App,
    /// プロジェクト Open〜Close まで生存
    Project,
}

/// モジュールのメタ情報
pub struct ModuleInfo {
    /// モジュール識別子（グローバルに一意）
    pub id: &'static str,
    /// 表示名
    pub name: &'static str,
    /// スコープ
    pub scope: ModuleScope,
    /// 初期化順序の依存先モジュールID
    pub depends_on: &'static [&'static str],
    /// このモジュールが発火するイベント型のリスト
    pub emits: fn() -> Vec<TypeId>,
    /// このモジュールが購読するイベント型のリスト
    pub subscribes: fn() -> Vec<TypeId>,
}

/// プロジェクト Open 時に渡されるコンテキスト
pub struct ProjectContext {
    pub project_id: String,
    pub project_root: std::path::PathBuf,
}

/// App-scoped モジュール
///
/// アプリ起動時に initialize、終了時に shutdown が呼ばれる。
#[async_trait]
pub trait AppModule: Send + Sync + 'static {
    fn info(&self) -> ModuleInfo;

    /// アプリ起動時: グローバルリソース初期化 + イベント登録
    async fn initialize(&mut self, event_bus: &EventBus) -> Result<()>;

    /// アプリ終了時: クリーンアップ
    async fn shutdown(&mut self) -> Result<()>;

    fn as_any(&self) -> &dyn Any;
    fn as_any_mut(&mut self) -> &mut dyn Any;
}

/// Project-scoped モジュール
///
/// プロジェクト Open で on_project_open、Close で on_project_close が呼ばれる。
/// depends_on 順に初期化、逆順に破棄される。
#[async_trait]
pub trait ProjectModule: Send + Sync + 'static {
    fn info(&self) -> ModuleInfo;

    /// プロジェクトを開いた時: サービス初期化 + イベント登録
    async fn on_project_open(
        &mut self,
        ctx: &ProjectContext,
        event_bus: &EventBus,
    ) -> Result<()>;

    /// プロジェクト保存時（全モジュール並列OK）
    async fn on_project_save(&mut self) -> Result<()>;

    /// プロジェクトを閉じる時: クリーンアップ
    async fn on_project_close(&mut self) -> Result<()>;

    fn as_any(&self) -> &dyn Any;
    fn as_any_mut(&mut self) -> &mut dyn Any;
}
