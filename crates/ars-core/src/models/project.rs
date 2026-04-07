use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_rs::TS;

// ── Component ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Variable {
    pub name: String,
    #[serde(rename = "type")]
    pub var_type: String,
    #[serde(rename = "defaultValue")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PortDefinition {
    pub name: String,
    #[serde(rename = "type")]
    pub port_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Task {
    pub name: String,
    pub description: String,
    pub inputs: Vec<PortDefinition>,
    pub outputs: Vec<PortDefinition>,
    #[serde(rename = "testCases")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub test_cases: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Component {
    pub id: String,
    pub name: String,
    pub category: String,
    pub domain: String,
    pub variables: Vec<Variable>,
    pub tasks: Vec<Task>,
    pub dependencies: Vec<String>,
    /// MCP server 用: インポート元モジュールID
    #[serde(rename = "sourceModuleId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_module_id: Option<String>,
}

// ── Actor ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SequenceStep {
    pub id: String,
    pub name: String,
    pub description: String,
    pub order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Actor {
    pub id: String,
    pub name: String,
    pub role: String,
    pub components: Vec<String>,
    pub children: Vec<String>,
    pub position: Position,
    #[serde(rename = "parentId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub sequences: Vec<SequenceStep>,
    #[serde(rename = "subSceneId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub_scene_id: Option<String>,
    #[serde(rename = "prefabId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prefab_id: Option<String>,
}

// ── Prefab ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PrefabActor {
    pub name: String,
    pub role: String,
    pub components: Vec<String>,
    pub children: Vec<String>,
    #[serde(default)]
    pub sequences: Vec<SequenceStep>,
    #[serde(rename = "subSceneId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub_scene_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Prefab {
    pub id: String,
    pub name: String,
    pub actor: PrefabActor,
}

// ── Scene ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Connection {
    pub id: String,
    #[serde(rename = "sourceActorId")]
    pub source_actor_id: String,
    #[serde(rename = "sourcePort")]
    pub source_port: String,
    #[serde(rename = "targetActorId")]
    pub target_actor_id: String,
    #[serde(rename = "targetPort")]
    pub target_port: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct KeyBinding {
    pub id: String,
    pub key: String,
    pub description: String,
    #[serde(rename = "targetActorId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_actor_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SceneState {
    pub id: String,
    pub name: String,
    #[serde(rename = "keyBindings")]
    pub key_bindings: Vec<KeyBinding>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Scene {
    pub id: String,
    pub name: String,
    #[serde(rename = "rootActorId")]
    pub root_actor_id: String,
    #[ts(type = "Record<string, Actor>")]
    pub actors: HashMap<String, Actor>,
    pub connections: Vec<Connection>,
    #[serde(default)]
    pub states: Vec<SceneState>,
    #[serde(rename = "activeStateId")]
    #[serde(default)]
    pub active_state_id: Option<String>,
}

// ── Project ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Project {
    pub name: String,
    #[ts(type = "Record<string, Scene>")]
    pub scenes: HashMap<String, Scene>,
    #[ts(type = "Record<string, Component>")]
    pub components: HashMap<String, Component>,
    #[serde(default)]
    #[ts(type = "Record<string, Prefab>")]
    pub prefabs: HashMap<String, Prefab>,
    #[serde(rename = "activeSceneId")]
    pub active_scene_id: Option<String>,
}

// ── Summary (for listing) ───────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

// ── Installed Module ────────────────────────────────

/// Gitリポジトリからインストールされたモジュールの管理情報
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct InstalledModule {
    pub id: String,
    /// モジュール名
    pub name: String,
    /// Git clone URL
    #[serde(rename = "gitUrl")]
    pub git_url: String,
    /// ブランチまたはタグ
    #[serde(rename = "gitRef")]
    #[serde(default = "default_git_ref")]
    pub git_ref: String,
    /// ローカルのクローン先パス
    #[serde(rename = "localPath")]
    pub local_path: String,
    /// インストール日時 (RFC3339)
    #[serde(rename = "installedAt")]
    pub installed_at: String,
    /// 最終更新日時 (RFC3339)
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    /// 有効/無効
    pub enabled: bool,
    /// リポジトリの説明
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

fn default_git_ref() -> String {
    "main".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_project_serialize_deserialize() {
        let mut project = Project {
            name: "Test".to_string(),
            scenes: HashMap::new(),
            components: HashMap::new(),
            prefabs: HashMap::new(),
            active_scene_id: None,
        };

        let scene = Scene {
            id: "scene-1".to_string(),
            name: "Main".to_string(),
            root_actor_id: "actor-root".to_string(),
            actors: HashMap::new(),
            connections: vec![],
            states: vec![],
            active_state_id: None,
        };
        project.scenes.insert(scene.id.clone(), scene);
        project.active_scene_id = Some("scene-1".to_string());

        let json = serde_json::to_string(&project).unwrap();
        let loaded: Project = serde_json::from_str(&json).unwrap();

        assert_eq!(loaded.name, "Test");
        assert_eq!(loaded.scenes.len(), 1);
        assert_eq!(loaded.active_scene_id.as_deref(), Some("scene-1"));
    }

    #[test]
    fn test_component_with_tasks() {
        let comp = Component {
            id: "comp-1".to_string(),
            name: "Health".to_string(),
            category: "Logic".to_string(),
            domain: "core".to_string(),
            variables: vec![Variable {
                name: "hp".to_string(),
                var_type: "int".to_string(),
                default_value: Some(serde_json::json!(100)),
            }],
            tasks: vec![Task {
                name: "TakeDamage".to_string(),
                description: "Apply damage".to_string(),
                inputs: vec![PortDefinition { name: "amount".to_string(), port_type: "int".to_string() }],
                outputs: vec![PortDefinition { name: "isDead".to_string(), port_type: "bool".to_string() }],
                test_cases: None,
            }],
            dependencies: vec![],
            source_module_id: None,
        };

        let json = serde_json::to_string(&comp).unwrap();
        let loaded: Component = serde_json::from_str(&json).unwrap();

        assert_eq!(loaded.name, "Health");
        assert_eq!(loaded.variables.len(), 1);
        assert_eq!(loaded.tasks.len(), 1);
        assert_eq!(loaded.tasks[0].inputs.len(), 1);
    }

    #[test]
    fn test_actor_with_sequences() {
        let actor = Actor {
            id: "actor-1".to_string(),
            name: "Player".to_string(),
            role: "actor".to_string(),
            components: vec!["comp-1".to_string()],
            children: vec![],
            position: Position { x: 100.0, y: 200.0 },
            parent_id: None,
            sequences: vec![SequenceStep {
                id: "step-1".to_string(),
                name: "Init".to_string(),
                description: "Initialize".to_string(),
                order: 0,
            }],
            sub_scene_id: None,
            prefab_id: Some("prefab-1".to_string()),
        };

        let json = serde_json::to_string(&actor).unwrap();
        let loaded: Actor = serde_json::from_str(&json).unwrap();

        assert_eq!(loaded.name, "Player");
        assert_eq!(loaded.sequences.len(), 1);
        assert_eq!(loaded.prefab_id.as_deref(), Some("prefab-1"));
    }

    #[test]
    fn test_project_default_fields() {
        // Ensure deserialization works with missing optional fields
        let json = r#"{"name":"Minimal","scenes":{},"components":{},"activeSceneId":null}"#;
        let project: Project = serde_json::from_str(json).unwrap();
        assert_eq!(project.name, "Minimal");
        assert!(project.prefabs.is_empty());
    }

    #[test]
    fn test_connection_roundtrip() {
        let conn = Connection {
            id: "c1".to_string(),
            source_actor_id: "a1".to_string(),
            source_port: "output".to_string(),
            target_actor_id: "a2".to_string(),
            target_port: "input".to_string(),
        };
        let json = serde_json::to_string(&conn).unwrap();
        let loaded: Connection = serde_json::from_str(&json).unwrap();
        assert_eq!(loaded.source_actor_id, "a1");
        assert_eq!(loaded.target_port, "input");
    }
}

/// インストール済みモジュール一覧を管理する設定ファイル
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ModuleRegistry {
    pub modules: Vec<InstalledModule>,
}

// ── Git ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct GitRepo {
    pub name: String,
    pub full_name: String,
    pub description: Option<String>,
    pub html_url: String,
    pub clone_url: String,
    #[serde(rename = "private")]
    pub is_private: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct GitProjectInfo {
    pub repo_full_name: String,
    pub branch: String,
    pub has_project: bool,
    pub local_path: String,
}
