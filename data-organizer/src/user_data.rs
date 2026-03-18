use std::collections::HashMap;
use std::path::Path;
use serde::{Deserialize, Serialize};

use crate::error::DataOrganizerError;

/// 永続化マーカー [P]
///
/// 変数宣言やクラスに `[P]` を付与することで永続化対象となる。
/// プログラムから生成されたアクター（ランダム生成等）も、
/// このマーカーがあればシーン復帰時に状態を復元する。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PersistenceMarker {
    /// 永続化対象 [P]
    Persistent,
    /// 永続化しない（デフォルト）
    Transient,
}

impl Default for PersistenceMarker {
    fn default() -> Self {
        PersistenceMarker::Transient
    }
}

/// ユーザーデータ変数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserVariable {
    /// 変数名
    pub name: String,
    /// 型名
    pub var_type: String,
    /// 現在の値 (JSON)
    pub value: serde_json::Value,
    /// 永続化マーカー
    pub persistence: PersistenceMarker,
    /// 所属アクターID（オプション）
    pub actor_id: Option<String>,
    /// 説明
    #[serde(default)]
    pub description: String,
}

/// プログラム生成アクターの状態スナップショット
///
/// ランダム生成されたアクター等、動的に生成されたアクターの
/// 状態を永続化するためのスナップショット。
/// シーン復帰時にこのスナップショットから状態を復元する。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActorSnapshot {
    /// 元のアクターID
    pub actor_id: String,
    /// アクターの生成元情報 (e.g., prefab_id, generator_id)
    pub origin: ActorOrigin,
    /// 永続化された変数群
    pub variables: HashMap<String, serde_json::Value>,
    /// スナップショット取得時のメタデータ
    pub metadata: HashMap<String, serde_json::Value>,
}

/// アクターの生成元情報
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ActorOrigin {
    /// シーンに配置済み
    ScenePlaced { scene_id: String },
    /// プレハブからインスタンス化
    PrefabInstanced { prefab_id: String },
    /// プログラムから動的生成
    DynamicGenerated { generator_id: String, seed: Option<u64> },
}

/// ユーザーデータストア
///
/// 永続化される変数群を管理する。
/// ゲームの外部（開発ツール）から調整可能。
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UserDataStore {
    /// 変数名 → ユーザー変数
    variables: HashMap<String, UserVariable>,
    /// アクターID → スナップショット
    actor_snapshots: HashMap<String, ActorSnapshot>,
}

impl UserDataStore {
    pub fn new() -> Self {
        Self::default()
    }

    // --- 変数操作 ---

    /// 変数を登録
    pub fn register_variable(&mut self, var: UserVariable) -> Result<(), DataOrganizerError> {
        let key = var_key(&var.name, var.actor_id.as_deref());
        if self.variables.contains_key(&key) {
            return Err(DataOrganizerError::DuplicateId(key));
        }
        self.variables.insert(key, var);
        Ok(())
    }

    /// 変数の値を更新
    pub fn set_variable(
        &mut self,
        name: &str,
        actor_id: Option<&str>,
        value: serde_json::Value,
    ) -> Result<(), DataOrganizerError> {
        let key = var_key(name, actor_id);
        let var = self.variables.get_mut(&key).ok_or_else(|| {
            DataOrganizerError::EntryNotFound {
                schema_id: "user_data".into(),
                entry_id: key,
            }
        })?;
        var.value = value;
        Ok(())
    }

    /// 変数を取得
    pub fn get_variable(
        &self,
        name: &str,
        actor_id: Option<&str>,
    ) -> Option<&UserVariable> {
        let key = var_key(name, actor_id);
        self.variables.get(&key)
    }

    /// 永続化対象の変数のみ取得
    pub fn persistent_variables(&self) -> Vec<&UserVariable> {
        self.variables
            .values()
            .filter(|v| v.persistence == PersistenceMarker::Persistent)
            .collect()
    }

    /// 特定アクターの変数をすべて取得
    pub fn variables_for_actor(&self, actor_id: &str) -> Vec<&UserVariable> {
        self.variables
            .values()
            .filter(|v| v.actor_id.as_deref() == Some(actor_id))
            .collect()
    }

    // --- アクタースナップショット ---

    /// アクターの状態をスナップショットとして保存
    pub fn save_actor_snapshot(&mut self, snapshot: ActorSnapshot) {
        self.actor_snapshots
            .insert(snapshot.actor_id.clone(), snapshot);
    }

    /// アクターのスナップショットを取得（シーン復帰時の復元用）
    pub fn get_actor_snapshot(&self, actor_id: &str) -> Option<&ActorSnapshot> {
        self.actor_snapshots.get(actor_id)
    }

    /// アクターのスナップショットを削除
    pub fn remove_actor_snapshot(&mut self, actor_id: &str) -> Option<ActorSnapshot> {
        self.actor_snapshots.remove(actor_id)
    }

    // --- 永続化 ---

    /// ファイルに保存
    pub fn save_to_file(&self, path: &Path) -> Result<(), DataOrganizerError> {
        let json = serde_json::to_string_pretty(self)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    /// ファイルから読み込み
    pub fn load_from_file(path: &Path) -> Result<Self, DataOrganizerError> {
        let json = std::fs::read_to_string(path)?;
        Ok(serde_json::from_str(&json)?)
    }

    /// 永続化対象データのみを抽出して保存用構造を返す
    pub fn extract_persistent(&self) -> UserDataStore {
        let variables: HashMap<String, UserVariable> = self
            .variables
            .iter()
            .filter(|(_, v)| v.persistence == PersistenceMarker::Persistent)
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();

        UserDataStore {
            variables,
            actor_snapshots: self.actor_snapshots.clone(),
        }
    }
}

/// 変数のユニークキーを生成
fn var_key(name: &str, actor_id: Option<&str>) -> String {
    match actor_id {
        Some(id) => format!("{id}:{name}"),
        None => name.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_and_get_variable() {
        let mut store = UserDataStore::new();
        store
            .register_variable(UserVariable {
                name: "score".into(),
                var_type: "int".into(),
                value: serde_json::json!(0),
                persistence: PersistenceMarker::Persistent,
                actor_id: None,
                description: "プレイヤースコア".into(),
            })
            .unwrap();

        let var = store.get_variable("score", None).unwrap();
        assert_eq!(var.value, serde_json::json!(0));
        assert_eq!(var.persistence, PersistenceMarker::Persistent);
    }

    #[test]
    fn test_persistent_variables_filter() {
        let mut store = UserDataStore::new();
        store
            .register_variable(UserVariable {
                name: "score".into(),
                var_type: "int".into(),
                value: serde_json::json!(0),
                persistence: PersistenceMarker::Persistent,
                actor_id: None,
                description: "".into(),
            })
            .unwrap();
        store
            .register_variable(UserVariable {
                name: "temp_timer".into(),
                var_type: "float".into(),
                value: serde_json::json!(0.0),
                persistence: PersistenceMarker::Transient,
                actor_id: None,
                description: "".into(),
            })
            .unwrap();

        let persistent = store.persistent_variables();
        assert_eq!(persistent.len(), 1);
        assert_eq!(persistent[0].name, "score");
    }

    #[test]
    fn test_actor_snapshot() {
        let mut store = UserDataStore::new();
        let mut vars = HashMap::new();
        vars.insert("hp".into(), serde_json::json!(50));
        vars.insert("position_x".into(), serde_json::json!(123.4));

        store.save_actor_snapshot(ActorSnapshot {
            actor_id: "random_enemy_01".into(),
            origin: ActorOrigin::DynamicGenerated {
                generator_id: "enemy_spawner".into(),
                seed: Some(42),
            },
            variables: vars,
            metadata: HashMap::new(),
        });

        let snapshot = store.get_actor_snapshot("random_enemy_01").unwrap();
        assert_eq!(snapshot.variables.get("hp"), Some(&serde_json::json!(50)));
    }

    #[test]
    fn test_extract_persistent() {
        let mut store = UserDataStore::new();
        store
            .register_variable(UserVariable {
                name: "persistent_var".into(),
                var_type: "int".into(),
                value: serde_json::json!(42),
                persistence: PersistenceMarker::Persistent,
                actor_id: None,
                description: "".into(),
            })
            .unwrap();
        store
            .register_variable(UserVariable {
                name: "transient_var".into(),
                var_type: "int".into(),
                value: serde_json::json!(0),
                persistence: PersistenceMarker::Transient,
                actor_id: None,
                description: "".into(),
            })
            .unwrap();

        let extracted = store.extract_persistent();
        assert_eq!(extracted.variables.len(), 1);
        assert!(extracted.variables.values().next().unwrap().name == "persistent_var");
    }
}
