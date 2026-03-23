/// DynamoDB を使った Repository trait 実装
///
/// 既存の DynamoClient をラップし、ars-core の Repository trait に適合させる。
use async_trait::async_trait;

use ars_core::error::{ArsError, Result};
use ars_core::models as core_models;
use ars_core::repository::{ProjectRepository, SessionRepository, UserRepository};

use crate::dynamo::DynamoClient;

// ── Project ─────────────────────────────────────────

pub struct DynamoProjectRepository {
    client: DynamoClient,
}

impl DynamoProjectRepository {
    pub fn new(client: DynamoClient) -> Self {
        Self { client }
    }
}

#[async_trait]
impl ProjectRepository for DynamoProjectRepository {
    async fn save(&self, user_id: &str, project_id: &str, project: &core_models::Project) -> Result<()> {
        // core_models::Project → crate::models::Project 変換
        let local_project = to_local_project(project);
        self.client
            .save_project(user_id, project_id, &local_project)
            .await
            .map_err(ArsError::Storage)
    }

    async fn load(&self, user_id: &str, project_id: &str) -> Result<Option<core_models::Project>> {
        let result = self.client
            .load_project(user_id, project_id)
            .await
            .map_err(ArsError::Storage)?;
        Ok(result.map(|p| to_core_project(&p)))
    }

    async fn list(&self, user_id: &str) -> Result<Vec<core_models::ProjectSummary>> {
        let summaries = self.client
            .list_user_projects(user_id)
            .await
            .map_err(ArsError::Storage)?;
        Ok(summaries
            .into_iter()
            .map(|s| core_models::ProjectSummary {
                id: s.id,
                name: s.name,
                updated_at: s.updated_at,
            })
            .collect())
    }

    async fn delete(&self, user_id: &str, project_id: &str) -> Result<()> {
        self.client
            .delete_project(user_id, project_id)
            .await
            .map_err(ArsError::Storage)
    }
}

// ── User ────────────────────────────────────────────

pub struct DynamoUserRepository {
    client: DynamoClient,
}

impl DynamoUserRepository {
    pub fn new(client: DynamoClient) -> Self {
        Self { client }
    }
}

#[async_trait]
impl UserRepository for DynamoUserRepository {
    async fn put(&self, user: &core_models::User) -> Result<()> {
        let local_user = to_local_user(user);
        self.client
            .put_user(&local_user)
            .await
            .map_err(ArsError::Storage)
    }

    async fn get(&self, user_id: &str) -> Result<Option<core_models::User>> {
        let result = self.client
            .get_user(user_id)
            .await
            .map_err(ArsError::Storage)?;
        Ok(result.map(|u| to_core_user(&u)))
    }

    async fn get_by_provider_id(&self, provider: &str, provider_id: &str) -> Result<Option<core_models::User>> {
        if provider != "github" {
            return Ok(None);
        }
        let github_id: i64 = provider_id
            .parse()
            .map_err(|_| ArsError::Validation("Invalid GitHub ID".into()))?;
        let result = self.client
            .get_user_by_github_id(github_id)
            .await
            .map_err(ArsError::Storage)?;
        Ok(result.map(|u| to_core_user(&u)))
    }
}

// ── Session ─────────────────────────────────────────

pub struct DynamoSessionRepository {
    client: DynamoClient,
}

impl DynamoSessionRepository {
    pub fn new(client: DynamoClient) -> Self {
        Self { client }
    }
}

#[async_trait]
impl SessionRepository for DynamoSessionRepository {
    async fn put(&self, session: &core_models::Session) -> Result<()> {
        let local_session = to_local_session(session);
        self.client
            .put_session(&local_session)
            .await
            .map_err(ArsError::Storage)
    }

    async fn get(&self, session_id: &str) -> Result<Option<core_models::Session>> {
        let result = self.client
            .get_session(session_id)
            .await
            .map_err(ArsError::Storage)?;
        Ok(result.map(|s| to_core_session(&s)))
    }

    async fn delete(&self, session_id: &str) -> Result<()> {
        self.client
            .delete_session(session_id)
            .await
            .map_err(ArsError::Storage)
    }

    async fn get_active(&self) -> Result<Option<core_models::Session>> {
        // Webモードでは cookie からセッションIDを取るため、
        // この関数は使われない。get() を使う。
        Ok(None)
    }
}

// ── 型変換ヘルパー ──────────────────────────────────
//
// core_models と crate::models / crate::auth の相互変換。
// モジュール分離完了後、crate::models を ars-core に置き換えたら不要になる。

fn to_local_project(p: &core_models::Project) -> crate::models::Project {
    // 同一構造なので JSON 経由で変換（型移行完了まで）
    let json = serde_json::to_value(p).unwrap();
    serde_json::from_value(json).unwrap()
}

fn to_core_project(p: &crate::models::Project) -> core_models::Project {
    let json = serde_json::to_value(p).unwrap();
    serde_json::from_value(json).unwrap()
}

fn to_local_user(u: &core_models::User) -> crate::auth::User {
    crate::auth::User {
        id: u.id.clone(),
        github_id: u.provider_id.parse().unwrap_or(0),
        login: u.login.clone(),
        display_name: u.display_name.clone(),
        avatar_url: u.avatar_url.clone(),
        email: u.email.clone(),
        created_at: u.created_at.clone(),
        updated_at: u.updated_at.clone(),
    }
}

fn to_core_user(u: &crate::auth::User) -> core_models::User {
    core_models::User {
        id: u.id.clone(),
        provider_id: u.github_id.to_string(),
        provider: "github".to_string(),
        login: u.login.clone(),
        display_name: u.display_name.clone(),
        avatar_url: u.avatar_url.clone(),
        email: u.email.clone(),
        created_at: u.created_at.clone(),
        updated_at: u.updated_at.clone(),
    }
}

fn to_local_session(s: &core_models::Session) -> crate::auth::Session {
    crate::auth::Session {
        id: s.id.clone(),
        user_id: s.user_id.clone(),
        expires_at: s.expires_at.clone().unwrap_or_default(),
        created_at: s.created_at.clone(),
        access_token: s.access_token.clone(),
    }
}

fn to_core_session(s: &crate::auth::Session) -> core_models::Session {
    core_models::Session {
        id: s.id.clone(),
        user_id: s.user_id.clone(),
        expires_at: if s.expires_at.is_empty() {
            None
        } else {
            Some(s.expires_at.clone())
        },
        created_at: s.created_at.clone(),
        access_token: s.access_token.clone(),
    }
}
