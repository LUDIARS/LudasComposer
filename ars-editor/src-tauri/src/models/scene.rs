use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use super::{Actor, Component};

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyBinding {
    pub id: String,
    pub key: String,
    pub description: String,
    #[serde(rename = "targetActorId", skip_serializing_if = "Option::is_none")]
    pub target_actor_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneState {
    pub id: String,
    pub name: String,
    #[serde(rename = "keyBindings")]
    pub key_bindings: Vec<KeyBinding>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scene {
    pub id: String,
    pub name: String,
    #[serde(rename = "rootActorId")]
    pub root_actor_id: String,
    pub actors: HashMap<String, Actor>,
    pub connections: Vec<Connection>,
    #[serde(default)]
    pub states: Vec<SceneState>,
    #[serde(rename = "activeStateId", default)]
    pub active_state_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub name: String,
    pub scenes: HashMap<String, Scene>,
    pub components: HashMap<String, Component>,
    #[serde(rename = "activeSceneId")]
    pub active_scene_id: Option<String>,
}
