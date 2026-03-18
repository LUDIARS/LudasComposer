use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

use crate::blackboard::Blackboard;
use crate::error::DataOrganizerError;
use crate::master_data::MasterDataRegistry;
use crate::user_data::UserDataStore;

/// データオーガナイザー
///
/// マスターデータとユーザーデータを統合管理するトップレベルコーディネーター。
///
/// ```text
/// ┌──────────────────────────────────────────────────┐
/// │              DataOrganizer                        │
/// │                                                  │
/// │  ┌────────────────┐   ┌──────────────────┐       │
/// │  │ MasterData     │   │ UserData         │       │
/// │  │ Registry       │   │ Store            │       │
/// │  │                │   │                  │       │
/// │  │ schemas[]      │   │ variables[] [P]  │       │
/// │  │ entries[]      │   │ snapshots[]      │       │
/// │  └───────┬────────┘   └──────────────────┘       │
/// │          │                                       │
/// │          ▼                                       │
/// │  ┌────────────────┐                              │
/// │  │ Blackboard     │  ← ランタイム用ビュー         │
/// │  │ (RO constants  │                              │
/// │  │  + RW runtime) │                              │
/// │  └────────────────┘                              │
/// └──────────────────────────────────────────────────┘
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataOrganizer {
    /// マスターデータレジストリ
    master_data: MasterDataRegistry,
    /// ユーザーデータストア
    user_data: UserDataStore,
}

/// ファイル永続化時の構造
#[derive(Debug, Serialize, Deserialize)]
struct DataOrganizerFile {
    master_data: MasterDataRegistry,
    user_data: UserDataStore,
}

impl DataOrganizer {
    pub fn new() -> Self {
        DataOrganizer {
            master_data: MasterDataRegistry::new(),
            user_data: UserDataStore::new(),
        }
    }

    /// マスターデータレジストリへの参照
    pub fn master_data(&self) -> &MasterDataRegistry {
        &self.master_data
    }

    /// マスターデータレジストリへの可変参照（エディタ用）
    pub fn master_data_mut(&mut self) -> &mut MasterDataRegistry {
        &mut self.master_data
    }

    /// ユーザーデータストアへの参照
    pub fn user_data(&self) -> &UserDataStore {
        &self.user_data
    }

    /// ユーザーデータストアへの可変参照
    pub fn user_data_mut(&mut self) -> &mut UserDataStore {
        &mut self.user_data
    }

    /// ブラックボードを構築（ランタイム用）
    ///
    /// マスターデータのスナップショットからリードオンリーの
    /// ブラックボードを生成する。ランタイムパラメータの
    /// オーバーライドレイヤーを持つ。
    pub fn create_blackboard(&self) -> Blackboard {
        Blackboard::from_registry(&self.master_data)
    }

    // --- ファイル永続化 ---

    /// プロジェクトディレクトリに保存
    pub fn save(&self, project_dir: &Path) -> Result<(), DataOrganizerError> {
        let dir = project_dir.join("data-organizer");
        std::fs::create_dir_all(&dir)?;

        // マスターデータ
        let master_path = dir.join("master-data.json");
        let master_json = serde_json::to_string_pretty(&self.master_data)?;
        std::fs::write(&master_path, master_json)?;

        // ユーザーデータ（永続化対象のみ）
        let user_path = dir.join("user-data.json");
        let persistent = self.user_data.extract_persistent();
        let user_json = serde_json::to_string_pretty(&persistent)?;
        std::fs::write(&user_path, user_json)?;

        Ok(())
    }

    /// プロジェクトディレクトリから読み込み
    pub fn load(project_dir: &Path) -> Result<Self, DataOrganizerError> {
        let dir = project_dir.join("data-organizer");

        let master_path = dir.join("master-data.json");
        let master_json = std::fs::read_to_string(&master_path)?;
        let master_data: MasterDataRegistry = serde_json::from_str(&master_json)?;

        let user_path = dir.join("user-data.json");
        let user_data = if user_path.exists() {
            let user_json = std::fs::read_to_string(&user_path)?;
            serde_json::from_str(&user_json)?
        } else {
            UserDataStore::new()
        };

        Ok(DataOrganizer {
            master_data,
            user_data,
        })
    }

    /// 全データをJSONとしてエクスポート（開発用）
    pub fn export_json(&self) -> Result<String, DataOrganizerError> {
        let file = DataOrganizerFile {
            master_data: self.master_data.clone(),
            user_data: self.user_data.clone(),
        };
        Ok(serde_json::to_string_pretty(&file)?)
    }

    /// JSONからインポート（開発用）
    pub fn import_json(json: &str) -> Result<Self, DataOrganizerError> {
        let file: DataOrganizerFile = serde_json::from_str(json)?;
        Ok(DataOrganizer {
            master_data: file.master_data,
            user_data: file.user_data,
        })
    }

    /// マスターデータとユーザーデータの保存先パスを返す
    pub fn data_paths(project_dir: &Path) -> (PathBuf, PathBuf) {
        let dir = project_dir.join("data-organizer");
        (dir.join("master-data.json"), dir.join("user-data.json"))
    }
}

impl Default for DataOrganizer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::*;
    use crate::user_data::*;

    #[test]
    fn test_full_workflow() {
        let mut organizer = DataOrganizer::new();

        // 1. スキーマ登録
        let schema = DataSchema {
            id: "character_stats".into(),
            name: "Character Stats".into(),
            domain: "character".into(),
            description: "キャラクターステータス".into(),
            fields: vec![
                FieldDefinition {
                    name: "max_hp".into(),
                    field_type: FieldType::Int,
                    default_value: Some(serde_json::json!(100)),
                    visibility: FieldVisibility::Exposed,
                    description: "最大HP".into(),
                    update_frequency: UpdateFrequency::Frequent,
                },
                FieldDefinition {
                    name: "speed".into(),
                    field_type: FieldType::Float,
                    default_value: Some(serde_json::json!(5.0)),
                    visibility: FieldVisibility::Exposed,
                    description: "移動速度".into(),
                    update_frequency: UpdateFrequency::Frequent,
                },
            ],
        };
        organizer.master_data_mut().register_schema(schema).unwrap();

        // 2. アクター別エントリ追加
        organizer
            .master_data_mut()
            .add_entry("character_stats", "hero_01".into(), Some("actor_hero".into()))
            .unwrap();
        organizer
            .master_data_mut()
            .add_entry("character_stats", "enemy_01".into(), Some("actor_goblin".into()))
            .unwrap();

        // 3. パラメータ調整
        organizer
            .master_data_mut()
            .update_entry_field("character_stats", "hero_01", "max_hp", serde_json::json!(150))
            .unwrap();

        // 4. ブラックボード構築
        let mut bb = organizer.create_blackboard();
        assert_eq!(
            bb.read("character_stats", "hero_01", "max_hp").unwrap(),
            &serde_json::json!(150)
        );

        // 5. ランタイムオーバーライド
        bb.write_runtime("character_stats", "hero_01", "speed", serde_json::json!(10.0))
            .unwrap();
        assert_eq!(
            bb.read("character_stats", "hero_01", "speed").unwrap(),
            &serde_json::json!(10.0)
        );

        // 6. ユーザーデータ登録
        organizer
            .user_data_mut()
            .register_variable(UserVariable {
                name: "current_hp".into(),
                var_type: "int".into(),
                value: serde_json::json!(150),
                persistence: PersistenceMarker::Persistent,
                actor_id: Some("actor_hero".into()),
                description: "現在HP".into(),
            })
            .unwrap();

        // 7. JSON エクスポート/インポートの往復
        let json = organizer.export_json().unwrap();
        let restored = DataOrganizer::import_json(&json).unwrap();
        let entry = restored
            .master_data()
            .get_entry("character_stats", "hero_01")
            .unwrap();
        assert_eq!(entry.get("max_hp"), Some(&serde_json::json!(150)));

        let var = restored
            .user_data()
            .get_variable("current_hp", Some("actor_hero"))
            .unwrap();
        assert_eq!(var.persistence, PersistenceMarker::Persistent);
    }
}
