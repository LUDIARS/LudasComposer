/// SurrealDB グラフデータベースサービス
///
/// ユーザー、プロジェクト、設定をSurrealDBのグラフ機能（RELATE）で管理する。
/// セッション管理はRedisに移行済み。
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use surrealdb::engine::local::RocksDb;
use surrealdb::Surreal;

use crate::auth::User;
use crate::models::Project;

#[derive(Clone)]
pub struct SurrealClient {
    db: Surreal<surrealdb::engine::local::Db>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SettingRecord {
    project_id: String,
    setting_key: String,
    value: String,
    updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

impl SurrealClient {
    pub async fn new(data_dir: &str) -> Result<Self, String> {
        let db = Surreal::new::<RocksDb>(data_dir)
            .await
            .map_err(|e| format!("SurrealDB init failed: {}", e))?;

        db.use_ns("ars")
            .use_db("main")
            .await
            .map_err(|e| format!("SurrealDB namespace setup failed: {}", e))?;

        // テーブル・インデックス定義
        db.query("DEFINE INDEX IF NOT EXISTS idx_setting_lookup ON project_setting FIELDS project_id, setting_key UNIQUE")
            .await
            .map_err(|e| format!("SurrealDB index creation failed: {}", e))?;

        db.query("DEFINE INDEX IF NOT EXISTS idx_user_github ON user FIELDS github_id UNIQUE")
            .await
            .map_err(|e| format!("SurrealDB index creation failed: {}", e))?;

        db.query("DEFINE INDEX IF NOT EXISTS idx_cloud_project_user ON cloud_project FIELDS user_id")
            .await
            .map_err(|e| format!("SurrealDB index creation failed: {}", e))?;

        // グラフ関係テーブル定義: user -[owns_project]-> cloud_project
        db.query("DEFINE TABLE IF NOT EXISTS owns_project SCHEMAFULL TYPE RELATION IN user OUT cloud_project")
            .await
            .map_err(|e| format!("SurrealDB relation table creation failed: {}", e))?;

        db.query("DEFINE FIELD IF NOT EXISTS in ON owns_project TYPE record<user>")
            .await
            .map_err(|e| format!("SurrealDB field creation failed: {}", e))?;

        db.query("DEFINE FIELD IF NOT EXISTS out ON owns_project TYPE record<cloud_project>")
            .await
            .map_err(|e| format!("SurrealDB field creation failed: {}", e))?;

        db.query("DEFINE FIELD IF NOT EXISTS created_at ON owns_project TYPE string")
            .await
            .map_err(|e| format!("SurrealDB field creation failed: {}", e))?;

        Ok(Self { db })
    }

    // ========== Project setting operations ==========

    /// 個別設定を保存（upsert）
    pub async fn put_setting(
        &self,
        project_id: &str,
        key: &str,
        value: &str,
    ) -> Result<(), String> {
        let now = chrono::Utc::now().to_rfc3339();
        self.db
            .query("INSERT INTO project_setting (project_id, setting_key, value, updated_at) VALUES ($project_id, $key, $value, $now) ON DUPLICATE KEY UPDATE value = $value, updated_at = $now")
            .bind(("project_id", project_id.to_string()))
            .bind(("key", key.to_string()))
            .bind(("value", value.to_string()))
            .bind(("now", now))
            .await
            .map_err(|e| format!("SurrealDB put_setting failed: {}", e))?;
        Ok(())
    }

    /// 個別設定を取得
    pub async fn get_setting(
        &self,
        project_id: &str,
        key: &str,
    ) -> Result<Option<String>, String> {
        let mut result = self.db
            .query("SELECT value FROM project_setting WHERE project_id = $project_id AND setting_key = $key LIMIT 1")
            .bind(("project_id", project_id.to_string()))
            .bind(("key", key.to_string()))
            .await
            .map_err(|e| format!("SurrealDB get_setting failed: {}", e))?;

        let rows: Vec<SettingRecord> = result
            .take(0)
            .map_err(|e| format!("SurrealDB deserialize failed: {}", e))?;

        Ok(rows.into_iter().next().map(|r| r.value))
    }

    /// プロジェクトの全設定を取得
    pub async fn get_all_settings(
        &self,
        project_id: &str,
    ) -> Result<HashMap<String, String>, String> {
        let mut result = self.db
            .query("SELECT setting_key, value FROM project_setting WHERE project_id = $project_id")
            .bind(("project_id", project_id.to_string()))
            .await
            .map_err(|e| format!("SurrealDB get_all_settings failed: {}", e))?;

        let rows: Vec<SettingRecord> = result
            .take(0)
            .map_err(|e| format!("SurrealDB deserialize failed: {}", e))?;

        let mut settings = HashMap::new();
        for row in rows {
            settings.insert(row.setting_key, row.value);
        }
        Ok(settings)
    }

    /// 複数設定を一括保存
    pub async fn put_settings_batch(
        &self,
        project_id: &str,
        settings: &HashMap<String, String>,
    ) -> Result<(), String> {
        for (key, value) in settings {
            self.put_setting(project_id, key, value).await?;
        }
        Ok(())
    }

    /// 個別設定を削除
    pub async fn delete_setting(
        &self,
        project_id: &str,
        key: &str,
    ) -> Result<(), String> {
        self.db
            .query("DELETE FROM project_setting WHERE project_id = $project_id AND setting_key = $key")
            .bind(("project_id", project_id.to_string()))
            .bind(("key", key.to_string()))
            .await
            .map_err(|e| format!("SurrealDB delete_setting failed: {}", e))?;
        Ok(())
    }

    // ========== User operations (Graph node) ==========

    pub async fn put_user(&self, user: &User) -> Result<(), String> {
        self.db
            .query("INSERT INTO user (id, github_id, login, display_name, avatar_url, email, created_at, updated_at) VALUES ($id, $github_id, $login, $display_name, $avatar_url, $email, $created_at, $updated_at) ON DUPLICATE KEY UPDATE login = $login, display_name = $display_name, avatar_url = $avatar_url, email = $email, updated_at = $updated_at")
            .bind(("id", user.id.clone()))
            .bind(("github_id", user.github_id))
            .bind(("login", user.login.clone()))
            .bind(("display_name", user.display_name.clone()))
            .bind(("avatar_url", user.avatar_url.clone()))
            .bind(("email", user.email.clone()))
            .bind(("created_at", user.created_at.clone()))
            .bind(("updated_at", user.updated_at.clone()))
            .await
            .map_err(|e| format!("SurrealDB put_user failed: {}", e))?;
        Ok(())
    }

    pub async fn get_user(&self, user_id: &str) -> Result<Option<User>, String> {
        let mut result = self.db
            .query("SELECT * FROM user WHERE id = $user_id LIMIT 1")
            .bind(("user_id", user_id.to_string()))
            .await
            .map_err(|e| format!("SurrealDB get_user failed: {}", e))?;

        let rows: Vec<UserRecord> = result
            .take(0)
            .map_err(|e| format!("SurrealDB deserialize failed: {}", e))?;

        Ok(rows.into_iter().next().map(|r| r.into_user()))
    }

    pub async fn get_user_by_github_id(&self, github_id: i64) -> Result<Option<User>, String> {
        let mut result = self.db
            .query("SELECT * FROM user WHERE github_id = $github_id LIMIT 1")
            .bind(("github_id", github_id))
            .await
            .map_err(|e| format!("SurrealDB get_user_by_github_id failed: {}", e))?;

        let rows: Vec<UserRecord> = result
            .take(0)
            .map_err(|e| format!("SurrealDB deserialize failed: {}", e))?;

        Ok(rows.into_iter().next().map(|r| r.into_user()))
    }

    // ========== Cloud project operations (Graph: user -[owns_project]-> cloud_project) ==========

    pub async fn save_project(&self, user_id: &str, project_id: &str, project: &Project) -> Result<(), String> {
        let project_json = serde_json::to_string(project)
            .map_err(|e| format!("Failed to serialize project: {}", e))?;
        let now = chrono::Utc::now().to_rfc3339();

        // プロジェクトレコードをupsert
        self.db
            .query("INSERT INTO cloud_project (id, user_id, name, data, updated_at) VALUES ($id, $user_id, $name, $data, $updated_at) ON DUPLICATE KEY UPDATE name = $name, data = $data, updated_at = $updated_at")
            .bind(("id", project_id.to_string()))
            .bind(("user_id", user_id.to_string()))
            .bind(("name", project.name.clone()))
            .bind(("data", project_json))
            .bind(("updated_at", now.clone()))
            .await
            .map_err(|e| format!("SurrealDB save_project failed: {}", e))?;

        // グラフ関係を作成（既存なら無視）
        self.db
            .query("IF (SELECT count() FROM owns_project WHERE in = type::thing('user', $user_id) AND out = type::thing('cloud_project', $project_id) GROUP ALL)[0].count = 0 THEN (RELATE type::thing('user', $user_id)->owns_project->type::thing('cloud_project', $project_id) SET created_at = $now) END")
            .bind(("user_id", user_id.to_string()))
            .bind(("project_id", project_id.to_string()))
            .bind(("now", now))
            .await
            .map_err(|e| format!("SurrealDB relate owns_project failed: {}", e))?;

        Ok(())
    }

    pub async fn load_project(&self, user_id: &str, project_id: &str) -> Result<Option<Project>, String> {
        // グラフ走査でユーザーが所有するプロジェクトを取得
        let mut result = self.db
            .query("SELECT data FROM cloud_project WHERE id = $project_id AND id IN (SELECT VALUE out FROM owns_project WHERE in = type::thing('user', $user_id)) LIMIT 1")
            .bind(("project_id", project_id.to_string()))
            .bind(("user_id", user_id.to_string()))
            .await
            .map_err(|e| format!("SurrealDB load_project failed: {}", e))?;

        let rows: Vec<CloudProjectRecord> = result
            .take(0)
            .map_err(|e| format!("SurrealDB deserialize failed: {}", e))?;

        match rows.into_iter().next() {
            Some(record) => {
                let project: Project = serde_json::from_str(&record.data)
                    .map_err(|e| format!("Failed to parse project: {}", e))?;
                Ok(Some(project))
            }
            None => Ok(None),
        }
    }

    pub async fn list_user_projects(&self, user_id: &str) -> Result<Vec<ProjectSummary>, String> {
        // グラフ走査でユーザーの全プロジェクトを取得
        let mut result = self.db
            .query("SELECT id, name, updated_at FROM cloud_project WHERE id IN (SELECT VALUE out FROM owns_project WHERE in = type::thing('user', $user_id)) ORDER BY updated_at DESC")
            .bind(("user_id", user_id.to_string()))
            .await
            .map_err(|e| format!("SurrealDB list_user_projects failed: {}", e))?;

        let rows: Vec<ProjectSummaryRecord> = result
            .take(0)
            .map_err(|e| format!("SurrealDB deserialize failed: {}", e))?;

        Ok(rows.into_iter().map(|r| ProjectSummary {
            id: r.id,
            name: r.name,
            updated_at: r.updated_at,
        }).collect())
    }

    pub async fn delete_project(&self, user_id: &str, project_id: &str) -> Result<(), String> {
        // グラフ走査で所有権を確認
        let mut result = self.db
            .query("SELECT count() FROM owns_project WHERE in = type::thing('user', $user_id) AND out = type::thing('cloud_project', $project_id) GROUP ALL")
            .bind(("user_id", user_id.to_string()))
            .bind(("project_id", project_id.to_string()))
            .await
            .map_err(|e| format!("SurrealDB ownership check failed: {}", e))?;

        let rows: Vec<CountRecord> = result
            .take(0)
            .map_err(|e| format!("SurrealDB deserialize failed: {}", e))?;

        let count = rows.into_iter().next().map(|r| r.count).unwrap_or(0);
        if count == 0 {
            return Err("Access denied or project not found".to_string());
        }

        // 関係とプロジェクトを削除
        self.db
            .query("DELETE FROM owns_project WHERE in = type::thing('user', $user_id) AND out = type::thing('cloud_project', $project_id)")
            .bind(("user_id", user_id.to_string()))
            .bind(("project_id", project_id.to_string()))
            .await
            .map_err(|e| format!("SurrealDB delete relation failed: {}", e))?;

        self.db
            .query("DELETE FROM cloud_project WHERE id = $project_id")
            .bind(("project_id", project_id.to_string()))
            .await
            .map_err(|e| format!("SurrealDB delete_project failed: {}", e))?;

        Ok(())
    }
}

// ========== Internal record types for SurrealDB deserialization ==========

#[derive(Debug, Deserialize)]
struct UserRecord {
    id: String,
    github_id: i64,
    login: String,
    display_name: String,
    avatar_url: String,
    email: Option<String>,
    created_at: String,
    updated_at: String,
}

impl UserRecord {
    fn into_user(self) -> User {
        User {
            id: self.id,
            github_id: self.github_id,
            login: self.login,
            display_name: self.display_name,
            avatar_url: self.avatar_url,
            email: self.email,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
struct CloudProjectRecord {
    data: String,
}

#[derive(Debug, Deserialize)]
struct ProjectSummaryRecord {
    id: String,
    name: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct CountRecord {
    count: i64,
}
