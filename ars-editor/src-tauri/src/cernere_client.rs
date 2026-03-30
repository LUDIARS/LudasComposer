/// Cernere HTTP クライアント
///
/// 認証・ユーザー管理・プロジェクト管理・設定管理を Cernere サーバーに委譲する。
/// Ars BFF は Cookie をそのまま Cernere に転送してセッション検証を行う。
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use ars_core::models::{Project, ProjectSummary, Session, User};

#[derive(Clone)]
pub struct CernereClient {
    http: reqwest::Client,
    base_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UserResponse {
    id: String,
    github_id: i64,
    login: String,
    display_name: String,
    avatar_url: String,
    email: Option<String>,
    created_at: String,
    updated_at: String,
}

impl From<UserResponse> for User {
    fn from(r: UserResponse) -> Self {
        User {
            id: r.id,
            github_id: r.github_id,
            login: r.login,
            display_name: r.display_name,
            avatar_url: r.avatar_url,
            email: r.email,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionResponse {
    id: String,
    user_id: String,
    expires_at: String,
    created_at: String,
    access_token: String,
}

impl From<SessionResponse> for Session {
    fn from(r: SessionResponse) -> Self {
        Session {
            id: r.id,
            user_id: r.user_id,
            expires_at: Some(r.expires_at),
            created_at: r.created_at,
            access_token: r.access_token,
        }
    }
}

impl CernereClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            http: reqwest::Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }

    /// OAuth ログイン URL を取得（Cernere にリダイレクト）
    pub fn login_url(&self) -> String {
        format!("{}/auth/github/login", self.base_url)
    }

    /// OAuth コールバック URL を取得
    pub fn callback_url(&self) -> String {
        format!("{}/auth/github/callback", self.base_url)
    }

    /// セッション Cookie を使って現在のユーザーを取得
    pub async fn get_me(&self, session_cookie: &str) -> Result<User, String> {
        let resp = self
            .http
            .get(format!("{}/auth/me", self.base_url))
            .header("Cookie", format!("ars_session={}", session_cookie))
            .send()
            .await
            .map_err(|e| format!("Cernere request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Cernere auth/me error ({}): {}", status, body));
        }

        let user: UserResponse = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse user response: {}", e))?;
        Ok(user.into())
    }

    /// セッション Cookie を使ってセッション情報を取得
    pub async fn get_session(&self, session_cookie: &str) -> Result<Session, String> {
        let resp = self
            .http
            .get(format!("{}/auth/session", self.base_url))
            .header("Cookie", format!("ars_session={}", session_cookie))
            .send()
            .await
            .map_err(|e| format!("Cernere request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Cernere auth/session error ({}): {}", status, body));
        }

        let session: SessionResponse = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse session response: {}", e))?;
        Ok(session.into())
    }

    /// プロジェクトを保存
    pub async fn save_project(
        &self,
        session_cookie: &str,
        project_id: &str,
        project: &Project,
    ) -> Result<(), String> {
        #[derive(Serialize)]
        #[serde(rename_all = "camelCase")]
        struct Req<'a> {
            project_id: &'a str,
            name: &'a str,
            data: &'a Project,
        }

        let resp = self
            .http
            .post(format!("{}/api/projects", self.base_url))
            .header("Cookie", format!("ars_session={}", session_cookie))
            .json(&Req {
                project_id,
                name: &project.name,
                data: project,
            })
            .send()
            .await
            .map_err(|e| format!("Cernere save_project failed: {}", e))?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Cernere save_project error: {}", body));
        }
        Ok(())
    }

    /// プロジェクトを読み込み
    pub async fn load_project(
        &self,
        session_cookie: &str,
        project_id: &str,
    ) -> Result<Option<Project>, String> {
        let resp = self
            .http
            .get(format!("{}/api/projects/{}?projectId={}", self.base_url, project_id, project_id))
            .header("Cookie", format!("ars_session={}", session_cookie))
            .send()
            .await
            .map_err(|e| format!("Cernere load_project failed: {}", e))?;

        if resp.status().as_u16() == 404 {
            return Ok(None);
        }
        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Cernere load_project error: {}", body));
        }

        let project: Project = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse project: {}", e))?;
        Ok(Some(project))
    }

    /// ユーザーのプロジェクト一覧を取得
    pub async fn list_projects(
        &self,
        session_cookie: &str,
    ) -> Result<Vec<ProjectSummary>, String> {
        let resp = self
            .http
            .get(format!("{}/api/projects", self.base_url))
            .header("Cookie", format!("ars_session={}", session_cookie))
            .send()
            .await
            .map_err(|e| format!("Cernere list_projects failed: {}", e))?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Cernere list_projects error: {}", body));
        }

        let summaries: Vec<ProjectSummary> = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse project list: {}", e))?;
        Ok(summaries)
    }

    /// プロジェクトを削除
    pub async fn delete_project(
        &self,
        session_cookie: &str,
        project_id: &str,
    ) -> Result<(), String> {
        let resp = self
            .http
            .delete(format!("{}/api/projects/{}", self.base_url, project_id))
            .header("Cookie", format!("ars_session={}", session_cookie))
            .send()
            .await
            .map_err(|e| format!("Cernere delete_project failed: {}", e))?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Cernere delete_project error: {}", body));
        }
        Ok(())
    }

    /// 設定を取得
    pub async fn get_all_settings(
        &self,
        session_cookie: &str,
        project_id: &str,
    ) -> Result<HashMap<String, String>, String> {
        let resp = self
            .http
            .get(format!("{}/api/settings/all?projectId={}", self.base_url, project_id))
            .header("Cookie", format!("ars_session={}", session_cookie))
            .send()
            .await
            .map_err(|e| format!("Cernere get_all_settings failed: {}", e))?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Cernere get_all_settings error: {}", body));
        }

        let settings: HashMap<String, String> = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse settings: {}", e))?;
        Ok(settings)
    }

    /// 個別設定を保存
    pub async fn put_setting(
        &self,
        session_cookie: &str,
        project_id: &str,
        key: &str,
        value: &str,
    ) -> Result<(), String> {
        #[derive(Serialize)]
        #[serde(rename_all = "camelCase")]
        struct Req<'a> {
            project_id: &'a str,
            key: &'a str,
            value: &'a str,
        }

        let resp = self
            .http
            .post(format!("{}/api/settings", self.base_url))
            .header("Cookie", format!("ars_session={}", session_cookie))
            .json(&Req { project_id, key, value })
            .send()
            .await
            .map_err(|e| format!("Cernere put_setting failed: {}", e))?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Cernere put_setting error: {}", body));
        }
        Ok(())
    }

    /// 個別設定を取得
    pub async fn get_setting(
        &self,
        session_cookie: &str,
        project_id: &str,
        key: &str,
    ) -> Result<Option<String>, String> {
        let resp = self
            .http
            .get(format!(
                "{}/api/settings?projectId={}&key={}",
                self.base_url, project_id, key
            ))
            .header("Cookie", format!("ars_session={}", session_cookie))
            .send()
            .await
            .map_err(|e| format!("Cernere get_setting failed: {}", e))?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Cernere get_setting error: {}", body));
        }

        let value: Option<String> = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse setting: {}", e))?;
        Ok(value)
    }

    /// 個別設定を削除
    pub async fn delete_setting(
        &self,
        session_cookie: &str,
        project_id: &str,
        key: &str,
    ) -> Result<(), String> {
        #[derive(Serialize)]
        #[serde(rename_all = "camelCase")]
        struct Req<'a> {
            project_id: &'a str,
            key: &'a str,
        }

        let resp = self
            .http
            .delete(format!("{}/api/settings", self.base_url))
            .header("Cookie", format!("ars_session={}", session_cookie))
            .json(&Req { project_id, key })
            .send()
            .await
            .map_err(|e| format!("Cernere delete_setting failed: {}", e))?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Cernere delete_setting error: {}", body));
        }
        Ok(())
    }
}
