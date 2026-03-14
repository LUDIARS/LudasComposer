use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client;
use std::collections::HashMap;

use crate::auth::{Session, User};
use crate::models::Project;

#[derive(Clone)]
pub struct DynamoClient {
    client: Client,
    users_table: String,
    sessions_table: String,
    projects_table: String,
}

impl DynamoClient {
    pub async fn new() -> Self {
        let config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
        let client = Client::new(&config);
        Self {
            client,
            users_table: std::env::var("DYNAMODB_USERS_TABLE")
                .unwrap_or_else(|_| "ars-users".to_string()),
            sessions_table: std::env::var("DYNAMODB_SESSIONS_TABLE")
                .unwrap_or_else(|_| "ars-sessions".to_string()),
            projects_table: std::env::var("DYNAMODB_PROJECTS_TABLE")
                .unwrap_or_else(|_| "ars-projects".to_string()),
        }
    }

    // ========== User operations ==========

    pub async fn put_user(&self, user: &User) -> Result<(), String> {
        let mut item = HashMap::new();
        item.insert("id".to_string(), AttributeValue::S(user.id.clone()));
        item.insert("githubId".to_string(), AttributeValue::N(user.github_id.to_string()));
        item.insert("login".to_string(), AttributeValue::S(user.login.clone()));
        item.insert("displayName".to_string(), AttributeValue::S(user.display_name.clone()));
        item.insert("avatarUrl".to_string(), AttributeValue::S(user.avatar_url.clone()));
        if let Some(ref email) = user.email {
            item.insert("email".to_string(), AttributeValue::S(email.clone()));
        }
        item.insert("createdAt".to_string(), AttributeValue::S(user.created_at.clone()));
        item.insert("updatedAt".to_string(), AttributeValue::S(user.updated_at.clone()));

        self.client
            .put_item()
            .table_name(&self.users_table)
            .set_item(Some(item))
            .send()
            .await
            .map_err(|e| format!("DynamoDB put_user failed: {}", e))?;
        Ok(())
    }

    pub async fn get_user(&self, user_id: &str) -> Result<Option<User>, String> {
        let result = self.client
            .get_item()
            .table_name(&self.users_table)
            .key("id", AttributeValue::S(user_id.to_string()))
            .send()
            .await
            .map_err(|e| format!("DynamoDB get_user failed: {}", e))?;

        match result.item {
            Some(item) => Ok(Some(item_to_user(&item)?)),
            None => Ok(None),
        }
    }

    pub async fn get_user_by_github_id(&self, github_id: i64) -> Result<Option<User>, String> {
        // Use a scan with filter since we're querying by a non-key attribute.
        // For production, use a GSI on githubId.
        let result = self.client
            .scan()
            .table_name(&self.users_table)
            .filter_expression("githubId = :gid")
            .expression_attribute_values(":gid", AttributeValue::N(github_id.to_string()))
            .send()
            .await
            .map_err(|e| format!("DynamoDB scan users failed: {}", e))?;

        if let Some(items) = result.items {
            if let Some(item) = items.first() {
                return Ok(Some(item_to_user(item)?));
            }
        }
        Ok(None)
    }

    // ========== Session operations ==========

    pub async fn put_session(&self, session: &Session) -> Result<(), String> {
        let mut item = HashMap::new();
        item.insert("id".to_string(), AttributeValue::S(session.id.clone()));
        item.insert("userId".to_string(), AttributeValue::S(session.user_id.clone()));
        item.insert("expiresAt".to_string(), AttributeValue::S(session.expires_at.clone()));
        item.insert("createdAt".to_string(), AttributeValue::S(session.created_at.clone()));
        item.insert("accessToken".to_string(), AttributeValue::S(session.access_token.clone()));

        self.client
            .put_item()
            .table_name(&self.sessions_table)
            .set_item(Some(item))
            .send()
            .await
            .map_err(|e| format!("DynamoDB put_session failed: {}", e))?;
        Ok(())
    }

    pub async fn get_session(&self, session_id: &str) -> Result<Option<Session>, String> {
        let result = self.client
            .get_item()
            .table_name(&self.sessions_table)
            .key("id", AttributeValue::S(session_id.to_string()))
            .send()
            .await
            .map_err(|e| format!("DynamoDB get_session failed: {}", e))?;

        match result.item {
            Some(item) => {
                let session = Session {
                    id: get_s(&item, "id")?,
                    user_id: get_s(&item, "userId")?,
                    expires_at: get_s(&item, "expiresAt")?,
                    created_at: get_s(&item, "createdAt")?,
                    access_token: get_s(&item, "accessToken").unwrap_or_default(),
                };
                Ok(Some(session))
            }
            None => Ok(None),
        }
    }

    pub async fn delete_session(&self, session_id: &str) -> Result<(), String> {
        self.client
            .delete_item()
            .table_name(&self.sessions_table)
            .key("id", AttributeValue::S(session_id.to_string()))
            .send()
            .await
            .map_err(|e| format!("DynamoDB delete_session failed: {}", e))?;
        Ok(())
    }

    // ========== Project operations ==========

    pub async fn save_project(&self, user_id: &str, project_id: &str, project: &Project) -> Result<(), String> {
        let project_json = serde_json::to_string(project)
            .map_err(|e| format!("Failed to serialize project: {}", e))?;
        let now = chrono::Utc::now().to_rfc3339();

        let mut item = HashMap::new();
        item.insert("id".to_string(), AttributeValue::S(project_id.to_string()));
        item.insert("userId".to_string(), AttributeValue::S(user_id.to_string()));
        item.insert("name".to_string(), AttributeValue::S(project.name.clone()));
        item.insert("data".to_string(), AttributeValue::S(project_json));
        item.insert("updatedAt".to_string(), AttributeValue::S(now));

        self.client
            .put_item()
            .table_name(&self.projects_table)
            .set_item(Some(item))
            .send()
            .await
            .map_err(|e| format!("DynamoDB save_project failed: {}", e))?;
        Ok(())
    }

    pub async fn load_project(&self, user_id: &str, project_id: &str) -> Result<Option<Project>, String> {
        let result = self.client
            .get_item()
            .table_name(&self.projects_table)
            .key("id", AttributeValue::S(project_id.to_string()))
            .send()
            .await
            .map_err(|e| format!("DynamoDB load_project failed: {}", e))?;

        match result.item {
            Some(item) => {
                // Verify ownership
                let owner = get_s(&item, "userId")?;
                if owner != user_id {
                    return Err("Access denied".to_string());
                }
                let data = get_s(&item, "data")?;
                let project: Project = serde_json::from_str(&data)
                    .map_err(|e| format!("Failed to parse project: {}", e))?;
                Ok(Some(project))
            }
            None => Ok(None),
        }
    }

    pub async fn list_user_projects(&self, user_id: &str) -> Result<Vec<ProjectSummary>, String> {
        let result = self.client
            .scan()
            .table_name(&self.projects_table)
            .filter_expression("userId = :uid")
            .expression_attribute_values(":uid", AttributeValue::S(user_id.to_string()))
            .projection_expression("id, #n, updatedAt")
            .expression_attribute_names("#n", "name")
            .send()
            .await
            .map_err(|e| format!("DynamoDB list_projects failed: {}", e))?;

        let mut projects = Vec::new();
        if let Some(items) = result.items {
            for item in &items {
                projects.push(ProjectSummary {
                    id: get_s(item, "id")?,
                    name: get_s(item, "name")?,
                    updated_at: get_s(item, "updatedAt").unwrap_or_default(),
                });
            }
        }
        projects.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        Ok(projects)
    }

    pub async fn delete_project(&self, user_id: &str, project_id: &str) -> Result<(), String> {
        // Verify ownership first
        let result = self.client
            .get_item()
            .table_name(&self.projects_table)
            .key("id", AttributeValue::S(project_id.to_string()))
            .projection_expression("userId")
            .send()
            .await
            .map_err(|e| format!("DynamoDB get_project failed: {}", e))?;

        if let Some(item) = result.item {
            let owner = get_s(&item, "userId")?;
            if owner != user_id {
                return Err("Access denied".to_string());
            }
        } else {
            return Err("Project not found".to_string());
        }

        self.client
            .delete_item()
            .table_name(&self.projects_table)
            .key("id", AttributeValue::S(project_id.to_string()))
            .send()
            .await
            .map_err(|e| format!("DynamoDB delete_project failed: {}", e))?;
        Ok(())
    }
}

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

// Helper functions for DynamoDB attribute extraction

fn get_s(item: &HashMap<String, AttributeValue>, key: &str) -> Result<String, String> {
    item.get(key)
        .and_then(|v| v.as_s().ok())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("Missing or invalid field: {}", key))
}

fn item_to_user(item: &HashMap<String, AttributeValue>) -> Result<User, String> {
    let github_id_str = item
        .get("githubId")
        .and_then(|v| v.as_n().ok())
        .ok_or_else(|| "Missing githubId".to_string())?;

    Ok(User {
        id: get_s(item, "id")?,
        github_id: github_id_str.parse::<i64>().map_err(|e| format!("Invalid githubId: {}", e))?,
        login: get_s(item, "login")?,
        display_name: get_s(item, "displayName")?,
        avatar_url: get_s(item, "avatarUrl")?,
        email: item.get("email").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
        created_at: get_s(item, "createdAt")?,
        updated_at: get_s(item, "updatedAt")?,
    })
}
