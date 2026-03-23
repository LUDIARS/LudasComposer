/// SurrealDB を使った Repository trait 実装
///
/// SurrealClient をラップし、ars-core の UserRepository / ProjectRepository に適合させる。
use async_trait::async_trait;

use ars_core::error::{ArsError, Result};
use ars_core::models as core_models;
use ars_core::repository::{ProjectRepository, UserRepository};

use crate::surrealdb_client::SurrealClient;

// ── Project ─────────────────────────────────────────

pub struct SurrealProjectRepository {
    client: SurrealClient,
}

impl SurrealProjectRepository {
    pub fn new(client: SurrealClient) -> Self {
        Self { client }
    }
}

#[async_trait]
impl ProjectRepository for SurrealProjectRepository {
    async fn save(&self, user_id: &str, project_id: &str, project: &core_models::Project) -> Result<()> {
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

pub struct SurrealUserRepository {
    client: SurrealClient,
}

impl SurrealUserRepository {
    pub fn new(client: SurrealClient) -> Self {
        Self { client }
    }
}

#[async_trait]
impl UserRepository for SurrealUserRepository {
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

// ── 型変換ヘルパー ──────────────────────────────────

fn to_local_project(p: &core_models::Project) -> crate::models::Project {
    crate::models::Project {
        name: p.name.clone(),
        scenes: p.scenes.iter().map(|(k, s)| (k.clone(), to_local_scene(s))).collect(),
        components: p.components.iter().map(|(k, c)| (k.clone(), to_local_component(c))).collect(),
        active_scene_id: p.active_scene_id.clone(),
    }
}

fn to_core_project(p: &crate::models::Project) -> core_models::Project {
    core_models::Project {
        name: p.name.clone(),
        scenes: p.scenes.iter().map(|(k, s)| (k.clone(), to_core_scene(s))).collect(),
        components: p.components.iter().map(|(k, c)| (k.clone(), to_core_component(c))).collect(),
        active_scene_id: p.active_scene_id.clone(),
    }
}

fn to_local_scene(s: &core_models::Scene) -> crate::models::Scene {
    crate::models::Scene {
        id: s.id.clone(),
        name: s.name.clone(),
        root_actor_id: s.root_actor_id.clone(),
        actors: s.actors.iter().map(|(k, a)| (k.clone(), to_local_actor(a))).collect(),
        connections: s.connections.iter().map(|c| crate::models::Connection {
            id: c.id.clone(),
            source_actor_id: c.source_actor_id.clone(),
            source_port: c.source_port.clone(),
            target_actor_id: c.target_actor_id.clone(),
            target_port: c.target_port.clone(),
        }).collect(),
        states: s.states.iter().map(|st| crate::models::SceneState {
            id: st.id.clone(),
            name: st.name.clone(),
            key_bindings: st.key_bindings.iter().map(|kb| crate::models::KeyBinding {
                id: kb.id.clone(),
                key: kb.key.clone(),
                description: kb.description.clone(),
                target_actor_id: kb.target_actor_id.clone(),
            }).collect(),
        }).collect(),
        active_state_id: s.active_state_id.clone(),
    }
}

fn to_core_scene(s: &crate::models::Scene) -> core_models::Scene {
    core_models::Scene {
        id: s.id.clone(),
        name: s.name.clone(),
        root_actor_id: s.root_actor_id.clone(),
        actors: s.actors.iter().map(|(k, a)| (k.clone(), to_core_actor(a))).collect(),
        connections: s.connections.iter().map(|c| core_models::Connection {
            id: c.id.clone(),
            source_actor_id: c.source_actor_id.clone(),
            source_port: c.source_port.clone(),
            target_actor_id: c.target_actor_id.clone(),
            target_port: c.target_port.clone(),
        }).collect(),
        states: s.states.iter().map(|st| core_models::SceneState {
            id: st.id.clone(),
            name: st.name.clone(),
            key_bindings: st.key_bindings.iter().map(|kb| core_models::KeyBinding {
                id: kb.id.clone(),
                key: kb.key.clone(),
                description: kb.description.clone(),
                target_actor_id: kb.target_actor_id.clone(),
            }).collect(),
        }).collect(),
        active_state_id: s.active_state_id.clone(),
    }
}

fn to_local_actor(a: &core_models::Actor) -> crate::models::Actor {
    crate::models::Actor {
        id: a.id.clone(),
        name: a.name.clone(),
        role: a.role.clone(),
        components: a.components.clone(),
        children: a.children.clone(),
        position: crate::models::Position { x: a.position.x, y: a.position.y },
        parent_id: a.parent_id.clone(),
    }
}

fn to_core_actor(a: &crate::models::Actor) -> core_models::Actor {
    core_models::Actor {
        id: a.id.clone(),
        name: a.name.clone(),
        role: a.role.clone(),
        components: a.components.clone(),
        children: a.children.clone(),
        position: core_models::Position { x: a.position.x, y: a.position.y },
        parent_id: a.parent_id.clone(),
    }
}

fn to_local_component(c: &core_models::Component) -> crate::models::Component {
    crate::models::Component {
        id: c.id.clone(),
        name: c.name.clone(),
        category: c.category.clone(),
        domain: c.domain.clone(),
        variables: c.variables.iter().map(|v| crate::models::Variable {
            name: v.name.clone(),
            var_type: v.var_type.clone(),
            default_value: v.default_value.clone(),
        }).collect(),
        tasks: c.tasks.iter().map(|t| crate::models::Task {
            name: t.name.clone(),
            description: t.description.clone(),
            inputs: t.inputs.iter().map(|p| crate::models::PortDefinition {
                name: p.name.clone(),
                port_type: p.port_type.clone(),
            }).collect(),
            outputs: t.outputs.iter().map(|p| crate::models::PortDefinition {
                name: p.name.clone(),
                port_type: p.port_type.clone(),
            }).collect(),
            test_cases: t.test_cases.clone(),
        }).collect(),
        dependencies: c.dependencies.clone(),
    }
}

fn to_core_component(c: &crate::models::Component) -> core_models::Component {
    core_models::Component {
        id: c.id.clone(),
        name: c.name.clone(),
        category: c.category.clone(),
        domain: c.domain.clone(),
        variables: c.variables.iter().map(|v| core_models::Variable {
            name: v.name.clone(),
            var_type: v.var_type.clone(),
            default_value: v.default_value.clone(),
        }).collect(),
        tasks: c.tasks.iter().map(|t| core_models::Task {
            name: t.name.clone(),
            description: t.description.clone(),
            inputs: t.inputs.iter().map(|p| core_models::PortDefinition {
                name: p.name.clone(),
                port_type: p.port_type.clone(),
            }).collect(),
            outputs: t.outputs.iter().map(|p| core_models::PortDefinition {
                name: p.name.clone(),
                port_type: p.port_type.clone(),
            }).collect(),
            test_cases: t.test_cases.clone(),
        }).collect(),
        dependencies: c.dependencies.clone(),
    }
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
