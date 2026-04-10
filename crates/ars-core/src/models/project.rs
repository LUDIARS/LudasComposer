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

/// アクタータイプ: simple / state / flexible
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Requirements {
    /// 概要
    #[serde(default)]
    pub overview: Vec<String>,
    /// 達成する事
    #[serde(default)]
    pub goals: Vec<String>,
    /// 役割
    #[serde(default)]
    pub role: Vec<String>,
    /// 挙動
    #[serde(default)]
    pub behavior: Vec<String>,
}

/// 表示物エンティティ — 外部エンジンのパイプライン依存処理
///
/// アクター内に内包され、要件定義を満たす表示レイヤーを表現する。
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Display {
    pub id: String,
    pub name: String,
    /// この表示物が満たす要件（要件フィールド名 + インデックスの組）
    pub satisfies: Vec<RequirementRef>,
    /// パイプライン設定・説明
    #[serde(rename = "pipelineConfig")]
    #[serde(default)]
    pub pipeline_config: String,
}

/// 要件への参照
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RequirementRef {
    /// 要件フィールド名: "overview" | "goals" | "role" | "behavior"
    pub field: String,
    /// フィールド内のインデックス
    pub index: usize,
}

/// ステートマシン内の1つのステート定義 (State型アクター用)
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ActorState {
    pub id: String,
    pub name: String,
    /// このステート内で実行する処理の説明
    pub processes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Actor {
    pub id: String,
    pub name: String,
    /// ドメインとしての役割
    pub role: String,
    /// アクタータイプ: "simple" | "state" | "flexible"
    #[serde(rename = "actorType")]
    #[serde(default = "default_actor_type")]
    pub actor_type: String,
    /// 要件定義
    #[serde(default)]
    pub requirements: Requirements,
    /// ステートマシン定義 (State型のみ使用)
    #[serde(rename = "actorStates")]
    #[serde(default)]
    pub actor_states: Vec<ActorState>,
    /// 自由記述 (Flexible型のみ使用)
    #[serde(rename = "flexibleContent")]
    #[serde(default)]
    pub flexible_content: String,
    /// 表示物エンティティ（外部エンジンパイプライン依存）
    #[serde(default)]
    pub displays: Vec<Display>,
    pub position: Position,
    #[serde(rename = "subSceneId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub_scene_id: Option<String>,
}

fn default_actor_type() -> String {
    "simple".to_string()
}

// ── Prefab ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PrefabActor {
    pub name: String,
    pub role: String,
    #[serde(rename = "actorType")]
    #[serde(default = "default_actor_type")]
    pub actor_type: String,
    #[serde(default)]
    pub requirements: Requirements,
    #[serde(rename = "actorStates")]
    #[serde(default)]
    pub actor_states: Vec<ActorState>,
    #[serde(rename = "flexibleContent")]
    #[serde(default)]
    pub flexible_content: String,
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

/// メッセージの種別
#[derive(Debug, Clone, Serialize, Deserialize, TS, Default, PartialEq)]
#[ts(export)]
pub enum MessageType {
    /// 単純なメッセージ (実線 + 塗り矢印)
    #[default]
    #[serde(rename = "simple")]
    Simple,
    /// インターフェース (実線 + 白抜き三角)
    #[serde(rename = "interface")]
    Interface,
}

/// ドメイン間のメッセージ定義
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Message {
    pub id: String,
    /// 送信元ドメイン(アクター)ID
    #[serde(rename = "sourceDomainId")]
    pub source_domain_id: String,
    /// 送信先ドメイン(アクター)ID
    #[serde(rename = "targetDomainId")]
    pub target_domain_id: String,
    /// メッセージ名
    pub name: String,
    /// メッセージの説明
    #[serde(default)]
    pub description: String,
    /// メッセージの種別
    #[serde(rename = "messageType", default)]
    pub message_type: MessageType,
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
    /// ドメイン間メッセージ
    #[serde(default)]
    pub messages: Vec<Message>,
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
            messages: vec![],
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
    fn test_actor_with_requirements() {
        let actor = Actor {
            id: "actor-1".to_string(),
            name: "Player".to_string(),
            role: "actor".to_string(),
            actor_type: "state".to_string(),
            requirements: Requirements {
                overview: vec!["プレイヤーキャラクター".to_string()],
                goals: vec!["ユーザーの入力に応じてキャラクターを制御する".to_string()],
                role: vec!["主人公".to_string()],
                behavior: vec!["移動・攻撃・防御".to_string()],
            },
            actor_states: vec![ActorState {
                id: "state-1".to_string(),
                name: "Idle".to_string(),
                processes: vec!["待機アニメーション再生".to_string()],
            }],
            flexible_content: String::new(),
            displays: vec![],
            position: Position { x: 100.0, y: 200.0 },
            sub_scene_id: None,
        };

        let json = serde_json::to_string(&actor).unwrap();
        let loaded: Actor = serde_json::from_str(&json).unwrap();

        assert_eq!(loaded.name, "Player");
        assert_eq!(loaded.actor_type, "state");
        assert_eq!(loaded.requirements.overview, vec!["プレイヤーキャラクター"]);
        assert_eq!(loaded.actor_states.len(), 1);
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
    fn test_message_roundtrip() {
        let msg = Message {
            id: "m1".to_string(),
            source_domain_id: "a1".to_string(),
            target_domain_id: "a2".to_string(),
            name: "TakeDamage".to_string(),
            description: "ダメージを与える".to_string(),
            message_type: MessageType::default(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        let loaded: Message = serde_json::from_str(&json).unwrap();
        assert_eq!(loaded.source_domain_id, "a1");
        assert_eq!(loaded.name, "TakeDamage");
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
