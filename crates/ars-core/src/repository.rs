use async_trait::async_trait;

use crate::error::Result;
use crate::models::{
    DataSchema, MasterDataTable, Project, ProjectSummary, Session, User,
};

/// プロジェクト永続化の抽象
#[async_trait]
pub trait ProjectRepository: Send + Sync {
    async fn save(&self, user_id: &str, project_id: &str, project: &Project) -> Result<()>;
    async fn load(&self, user_id: &str, project_id: &str) -> Result<Option<Project>>;
    async fn list(&self, user_id: &str) -> Result<Vec<ProjectSummary>>;
    async fn delete(&self, user_id: &str, project_id: &str) -> Result<()>;
}

/// ユーザー永続化の抽象
#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn put(&self, user: &User) -> Result<()>;
    async fn get(&self, user_id: &str) -> Result<Option<User>>;
    async fn get_by_provider_id(&self, provider: &str, provider_id: &str) -> Result<Option<User>>;
}

/// セッション永続化の抽象
///
/// ネイティブ: ローカルファイルに永続保存（有効期限なし）
/// Web: DynamoDB にTTL付きで保存
#[async_trait]
pub trait SessionRepository: Send + Sync {
    async fn put(&self, session: &Session) -> Result<()>;
    async fn get(&self, session_id: &str) -> Result<Option<Session>>;
    async fn delete(&self, session_id: &str) -> Result<()>;
    /// 現在有効なセッションを取得（ネイティブでは最新の1件を返す）
    async fn get_active(&self) -> Result<Option<Session>>;
}

// ── Data Management Repositories ───────────────────

/// データスキーマ永続化の抽象
#[async_trait]
pub trait DataSchemaRepository: Send + Sync {
    async fn save(&self, project_id: &str, schema: &DataSchema) -> Result<()>;
    async fn load(&self, project_id: &str, schema_id: &str) -> Result<Option<DataSchema>>;
    async fn list(&self, project_id: &str) -> Result<Vec<DataSchema>>;
    async fn delete(&self, project_id: &str, schema_id: &str) -> Result<()>;
}

/// マスターデータ永続化の抽象
#[async_trait]
pub trait MasterDataRepository: Send + Sync {
    async fn save(&self, project_id: &str, table: &MasterDataTable) -> Result<()>;
    async fn load(&self, project_id: &str, table_id: &str) -> Result<Option<MasterDataTable>>;
    async fn list(&self, project_id: &str) -> Result<Vec<MasterDataTable>>;
    async fn delete(&self, project_id: &str, table_id: &str) -> Result<()>;
}

/// セーブデータプロバイダーの抽象
///
/// ユーザーデータの復元/保存インタフェース。
/// 各クラスのメンバ変数に対して注入され、ランタイムでデータを永続化する。
#[async_trait]
pub trait SaveDataProvider: Send + Sync {
    /// データを保存する
    async fn save(&self, key: &str, data: &serde_json::Value) -> Result<()>;
    /// データを読み込む
    async fn load(&self, key: &str) -> Result<Option<serde_json::Value>>;
    /// データを削除する
    async fn delete(&self, key: &str) -> Result<()>;
    /// 指定プレフィクスのキー一覧を取得する
    async fn list_keys(&self, prefix: &str) -> Result<Vec<String>>;
}
