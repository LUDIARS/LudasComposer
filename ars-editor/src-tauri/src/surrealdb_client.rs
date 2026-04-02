/// SurrealDB HTTP クライアント
///
/// 外部 SurrealDB インスタンスに HTTP 経由で接続し、SurrealQL クエリを実行する。
/// 組み込み DB ドライバー（RocksDB）を使わないため、C++ コンパイルが不要になり
/// ビルド時間を大幅に短縮する。
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

use ars_core::models::{Project, ProjectSummary, User};

#[derive(Clone)]
pub struct SurrealClient {
    http: reqwest::Client,
    endpoint: String,
    username: String,
    password: String,
}

#[derive(Debug, Deserialize)]
struct QueryResult {
    #[serde(default)]
    result: Value,
    status: String,
}

impl SurrealClient {
    pub async fn new(url: &str, username: &str, password: &str) -> Result<Self, String> {
        let client = Self {
            http: reqwest::Client::new(),
            endpoint: url.trim_end_matches('/').to_string(),
            username: username.to_string(),
            password: password.to_string(),
        };
        client.init_schema().await?;
        Ok(client)
    }

    /// Execute one or more SurrealQL statements and return results per statement.
    async fn execute(&self, sql: &str) -> Result<Vec<Value>, String> {
        self.execute_with_params(sql, None).await
    }

    /// Execute SurrealQL with bound parameters to prevent injection attacks.
    async fn execute_with_params(
        &self,
        sql: &str,
        params: Option<&HashMap<String, Value>>,
    ) -> Result<Vec<Value>, String> {
        let body = if let Some(params) = params {
            serde_json::json!({
                "query": sql,
                "params": params,
            })
            .to_string()
        } else {
            sql.to_string()
        };

        let mut req = self
            .http
            .post(if params.is_some() {
                format!("{}/sql", self.endpoint)
            } else {
                format!("{}/sql", self.endpoint)
            })
            .basic_auth(&self.username, Some(&self.password))
            .header("surreal-ns", "ars")
            .header("surreal-db", "main")
            .header("Accept", "application/json");

        if params.is_some() {
            req = req.header("Content-Type", "application/json").body(body);
        } else {
            req = req.body(body);
        }

        let resp = req
            .send()
            .await
            .map_err(|e| format!("SurrealDB request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("SurrealDB HTTP error ({}): {}", status, body));
        }

        let results: Vec<QueryResult> = resp
            .json()
            .await
            .map_err(|e| format!("SurrealDB response parse failed: {}", e))?;

        let mut outputs = Vec::with_capacity(results.len());
        for qr in results {
            if qr.status != "OK" {
                return Err(format!("SurrealDB query error: {}", qr.status));
            }
            outputs.push(qr.result);
        }
        Ok(outputs)
    }

    /// Execute a query and deserialize the first statement's results as `Vec<T>`.
    async fn query_vec<T: serde::de::DeserializeOwned>(&self, sql: &str, params: Option<&HashMap<String, Value>>) -> Result<Vec<T>, String> {
        let results = self.execute_with_params(sql, params).await?;
        let first = results.into_iter().next().unwrap_or(Value::Array(vec![]));
        serde_json::from_value(first)
            .map_err(|e| format!("SurrealDB deserialize failed: {}", e))
    }

    async fn init_schema(&self) -> Result<(), String> {
        self.execute(
            "DEFINE INDEX IF NOT EXISTS idx_setting_lookup ON project_setting FIELDS project_id, setting_key UNIQUE;\
             DEFINE INDEX IF NOT EXISTS idx_user_github ON user FIELDS github_id UNIQUE;\
             DEFINE INDEX IF NOT EXISTS idx_cloud_project_user ON cloud_project FIELDS user_id;\
             DEFINE TABLE IF NOT EXISTS owns_project SCHEMAFULL TYPE RELATION IN user OUT cloud_project;\
             DEFINE FIELD IF NOT EXISTS in ON owns_project TYPE record<user>;\
             DEFINE FIELD IF NOT EXISTS out ON owns_project TYPE record<cloud_project>;\
             DEFINE FIELD IF NOT EXISTS created_at ON owns_project TYPE string;",
        )
        .await?;
        Ok(())
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
        let sql = "INSERT INTO project_setting (project_id, setting_key, value, updated_at) \
                   VALUES ($pid, $key, $val, $now) \
                   ON DUPLICATE KEY UPDATE value = $val, updated_at = $now";
        let params = params![
            "pid" => project_id,
            "key" => key,
            "val" => value,
            "now" => &now,
        ];
        self.execute_with_params(sql, Some(&params)).await?;
        Ok(())
    }

    /// 個別設定を取得
    pub async fn get_setting(
        &self,
        project_id: &str,
        key: &str,
    ) -> Result<Option<String>, String> {
        let sql = "SELECT value FROM project_setting WHERE project_id = $pid AND setting_key = $key LIMIT 1";
        let params = params![
            "pid" => project_id,
            "key" => key,
        ];
        let rows: Vec<ValueRecord> = self.query_vec(sql, Some(&params)).await?;
        Ok(rows.into_iter().next().map(|r| r.value))
    }

    /// プロジェクトの全設定を取得
    pub async fn get_all_settings(
        &self,
        project_id: &str,
    ) -> Result<HashMap<String, String>, String> {
        let sql = "SELECT setting_key, value FROM project_setting WHERE project_id = $pid";
        let params = params!["pid" => project_id];
        let rows: Vec<SettingKvRecord> = self.query_vec(sql, Some(&params)).await?;
        Ok(rows
            .into_iter()
            .map(|r| (r.setting_key, r.value))
            .collect())
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
    pub async fn delete_setting(&self, project_id: &str, key: &str) -> Result<(), String> {
        let sql = "DELETE FROM project_setting WHERE project_id = $pid AND setting_key = $key";
        let params = params!["pid" => project_id, "key" => key];
        self.execute_with_params(sql, Some(&params)).await?;
        Ok(())
    }

    // ========== User operations (Graph node) ==========

    pub async fn put_user(&self, user: &User) -> Result<(), String> {
        let email_val: Value = user
            .email
            .as_deref()
            .map(|e| Value::String(e.to_string()))
            .unwrap_or(Value::Null);
        let sql = "INSERT INTO user (id, github_id, login, display_name, avatar_url, email, created_at, updated_at) \
                   VALUES ($id, $gid, $login, $dn, $av, $email, $ca, $ua) \
                   ON DUPLICATE KEY UPDATE login = $login, display_name = $dn, avatar_url = $av, email = $email, updated_at = $ua";
        let mut params = HashMap::new();
        params.insert("id".to_string(), Value::String(user.id.clone()));
        params.insert("gid".to_string(), Value::Number(user.github_id.into()));
        params.insert("login".to_string(), Value::String(user.login.clone()));
        params.insert("dn".to_string(), Value::String(user.display_name.clone()));
        params.insert("av".to_string(), Value::String(user.avatar_url.clone()));
        params.insert("email".to_string(), email_val);
        params.insert("ca".to_string(), Value::String(user.created_at.clone()));
        params.insert("ua".to_string(), Value::String(user.updated_at.clone()));
        self.execute_with_params(sql, Some(&params)).await?;
        Ok(())
    }

    pub async fn get_user(&self, user_id: &str) -> Result<Option<User>, String> {
        let sql = "SELECT * FROM user WHERE id = type::thing('user', $uid) LIMIT 1";
        let params = params!["uid" => user_id];
        let rows: Vec<UserRecord> = self.query_vec(sql, Some(&params)).await?;
        Ok(rows.into_iter().next().map(|r| r.into_user()))
    }

    pub async fn get_user_by_github_id(&self, github_id: i64) -> Result<Option<User>, String> {
        let sql = "SELECT * FROM user WHERE github_id = $gid LIMIT 1";
        let mut params = HashMap::new();
        params.insert("gid".to_string(), Value::Number(github_id.into()));
        let rows: Vec<UserRecord> = self.query_vec(sql, Some(&params)).await?;
        Ok(rows.into_iter().next().map(|r| r.into_user()))
    }

    // ========== Cloud project operations (Graph: user -[owns_project]-> cloud_project) ==========

    pub async fn save_project(
        &self,
        user_id: &str,
        project_id: &str,
        project: &Project,
    ) -> Result<(), String> {
        let project_json = serde_json::to_string(project)
            .map_err(|e| format!("Failed to serialize project: {}", e))?;
        let now = chrono::Utc::now().to_rfc3339();

        // プロジェクトレコードを upsert + グラフ関係を作成（既存なら無視）
        let sql = "INSERT INTO cloud_project (id, user_id, name, data, updated_at) \
                   VALUES ($id, $uid, $name, $data, $now) \
                   ON DUPLICATE KEY UPDATE name = $name, data = $data, updated_at = $now;\
                   IF (SELECT count() FROM owns_project \
                       WHERE in = type::thing('user', $uid) \
                         AND out = type::thing('cloud_project', $id) GROUP ALL)[0].count = 0 \
                   THEN \
                       (RELATE type::thing('user', $uid)->owns_project->type::thing('cloud_project', $id) \
                        SET created_at = $now) \
                   END";
        let mut params = HashMap::new();
        params.insert("id".to_string(), Value::String(project_id.to_string()));
        params.insert("uid".to_string(), Value::String(user_id.to_string()));
        params.insert("name".to_string(), Value::String(project.name.clone()));
        params.insert("data".to_string(), Value::String(project_json));
        params.insert("now".to_string(), Value::String(now));
        self.execute_with_params(sql, Some(&params)).await?;
        Ok(())
    }

    pub async fn load_project(
        &self,
        user_id: &str,
        project_id: &str,
    ) -> Result<Option<Project>, String> {
        // グラフ走査でユーザーが所有するプロジェクトを取得
        let sql = "SELECT data FROM cloud_project \
                   WHERE id = type::thing('cloud_project', $pid) \
                     AND id IN (SELECT VALUE out FROM owns_project \
                                WHERE in = type::thing('user', $uid)) LIMIT 1";
        let params = params!["pid" => project_id, "uid" => user_id];
        let rows: Vec<CloudProjectRecord> = self.query_vec(sql, Some(&params)).await?;
        match rows.into_iter().next() {
            Some(record) => {
                let project: Project = serde_json::from_str(&record.data)
                    .map_err(|e| format!("Failed to parse project: {}", e))?;
                Ok(Some(project))
            }
            None => Ok(None),
        }
    }

    pub async fn list_user_projects(
        &self,
        user_id: &str,
    ) -> Result<Vec<ProjectSummary>, String> {
        // グラフ走査でユーザーの全プロジェクトを取得
        let sql = "SELECT id, name, updated_at FROM cloud_project \
                   WHERE id IN (SELECT VALUE out FROM owns_project \
                                WHERE in = type::thing('user', $uid)) \
                   ORDER BY updated_at DESC";
        let params = params!["uid" => user_id];
        let rows: Vec<ProjectSummaryRecord> = self.query_vec(sql, Some(&params)).await?;
        Ok(rows
            .into_iter()
            .map(|r| ProjectSummary {
                id: parse_record_id(&r.id),
                name: r.name,
                updated_at: r.updated_at,
            })
            .collect())
    }

    pub async fn delete_project(
        &self,
        user_id: &str,
        project_id: &str,
    ) -> Result<(), String> {
        // グラフ走査で所有権を確認
        let check_sql = "SELECT count() FROM owns_project \
                         WHERE in = type::thing('user', $uid) \
                           AND out = type::thing('cloud_project', $pid) GROUP ALL";
        let params = params!["uid" => user_id, "pid" => project_id];
        let rows: Vec<CountRecord> = self.query_vec(check_sql, Some(&params)).await?;
        let count = rows.into_iter().next().map(|r| r.count).unwrap_or(0);
        if count == 0 {
            return Err("Access denied or project not found".to_string());
        }

        // 関係とプロジェクトを削除
        let delete_sql = "DELETE FROM owns_project \
                          WHERE in = type::thing('user', $uid) \
                            AND out = type::thing('cloud_project', $pid);\
                          DELETE FROM cloud_project \
                          WHERE id = type::thing('cloud_project', $pid)";
        self.execute_with_params(delete_sql, Some(&params)).await?;
        Ok(())
    }
}

// ========== Internal helpers ==========

/// Convenience macro for building parameter maps.
macro_rules! params {
    ($($key:expr => $val:expr),* $(,)?) => {{
        let mut map = std::collections::HashMap::new();
        $(
            map.insert($key.to_string(), serde_json::Value::String($val.to_string()));
        )*
        map
    }};
}
use params;

// ========== Internal record types for deserialization ==========

#[derive(Debug, Deserialize)]
struct ValueRecord {
    value: String,
}

#[derive(Debug, Deserialize)]
struct SettingKvRecord {
    setting_key: String,
    value: String,
}

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
            id: parse_record_id(&self.id),
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

/// Parse a SurrealDB record ID to extract the plain ID string.
/// Handles `"table:id"`, `"table:⟨id⟩"`, or plain `"id"` formats.
fn parse_record_id(raw: &str) -> String {
    let s = match raw.split_once(':') {
        Some((_, id)) => id,
        None => return raw.to_string(),
    };
    s.trim_start_matches('\u{27E8}')
        .trim_end_matches('\u{27E9}')
        .trim_start_matches('`')
        .trim_end_matches('`')
        .to_string()
}
