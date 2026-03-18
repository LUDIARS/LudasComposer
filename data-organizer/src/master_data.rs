use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use crate::error::DataOrganizerError;
use crate::schema::{DataSchema, FieldVisibility};

/// マスターデータの1エントリ
///
/// ゲーム中に参照される定数データ。各アクターに対するバリエーションを持ち、
/// IDで一意に識別される。ゲーム内ではimmutable。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasterDataEntry {
    /// エントリID（一意）
    pub id: String,
    /// 所属するスキーマID
    pub schema_id: String,
    /// 対象アクターID（オプション。特定アクターに紐づくバリエーション）
    pub actor_id: Option<String>,
    /// フィールド名 → 値のマップ
    pub values: HashMap<String, serde_json::Value>,
}

impl MasterDataEntry {
    /// スキーマのデフォルト値で初期化した新規エントリを作成
    pub fn new_from_schema(id: String, schema: &DataSchema, actor_id: Option<String>) -> Self {
        let mut values = HashMap::new();
        for field in &schema.fields {
            if let Some(default) = &field.default_value {
                values.insert(field.name.clone(), default.clone());
            }
        }
        MasterDataEntry {
            id,
            schema_id: schema.id.clone(),
            actor_id,
            values,
        }
    }

    /// フィールド値を取得
    pub fn get(&self, field: &str) -> Option<&serde_json::Value> {
        self.values.get(field)
    }
}

/// マスターデータレジストリ
///
/// 全スキーマと全エントリを保持する中央レジストリ。
/// Excelのワークブックに相当し、スキーマがシート、エントリが行。
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MasterDataRegistry {
    /// スキーマID → スキーマ
    schemas: HashMap<String, DataSchema>,
    /// スキーマID → (エントリID → エントリ)
    entries: HashMap<String, HashMap<String, MasterDataEntry>>,
}

impl MasterDataRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    // --- スキーマ操作 ---

    pub fn register_schema(&mut self, schema: DataSchema) -> Result<(), DataOrganizerError> {
        if self.schemas.contains_key(&schema.id) {
            return Err(DataOrganizerError::DuplicateId(schema.id));
        }
        let id = schema.id.clone();
        self.schemas.insert(id.clone(), schema);
        self.entries.insert(id, HashMap::new());
        Ok(())
    }

    pub fn get_schema(&self, schema_id: &str) -> Result<&DataSchema, DataOrganizerError> {
        self.schemas
            .get(schema_id)
            .ok_or_else(|| DataOrganizerError::SchemaNotFound(schema_id.into()))
    }

    pub fn schemas(&self) -> impl Iterator<Item = &DataSchema> {
        self.schemas.values()
    }

    // --- エントリ操作 ---

    /// 新規エントリを追加（デフォルト値で初期化）
    pub fn add_entry(
        &mut self,
        schema_id: &str,
        entry_id: String,
        actor_id: Option<String>,
    ) -> Result<&MasterDataEntry, DataOrganizerError> {
        let schema = self
            .schemas
            .get(schema_id)
            .ok_or_else(|| DataOrganizerError::SchemaNotFound(schema_id.into()))?
            .clone();

        let entries = self
            .entries
            .get_mut(schema_id)
            .ok_or_else(|| DataOrganizerError::SchemaNotFound(schema_id.into()))?;

        if entries.contains_key(&entry_id) {
            return Err(DataOrganizerError::DuplicateId(entry_id));
        }

        let entry = MasterDataEntry::new_from_schema(entry_id.clone(), &schema, actor_id);
        entries.insert(entry_id.clone(), entry);
        Ok(&entries[&entry_id])
    }

    /// エントリのフィールド値を更新
    ///
    /// Exposed なフィールドのみ更新可能（ホワイトリスト方式）
    pub fn update_entry_field(
        &mut self,
        schema_id: &str,
        entry_id: &str,
        field: &str,
        value: serde_json::Value,
    ) -> Result<(), DataOrganizerError> {
        let schema = self
            .schemas
            .get(schema_id)
            .ok_or_else(|| DataOrganizerError::SchemaNotFound(schema_id.into()))?;

        let field_def = schema.find_field(field).ok_or_else(|| {
            DataOrganizerError::FieldNotFound {
                schema_id: schema_id.into(),
                field: field.into(),
            }
        })?;

        if field_def.visibility != FieldVisibility::Exposed {
            return Err(DataOrganizerError::FieldNotExposed(field.into()));
        }

        let entries = self
            .entries
            .get_mut(schema_id)
            .ok_or_else(|| DataOrganizerError::SchemaNotFound(schema_id.into()))?;

        let entry = entries.get_mut(entry_id).ok_or_else(|| {
            DataOrganizerError::EntryNotFound {
                schema_id: schema_id.into(),
                entry_id: entry_id.into(),
            }
        })?;

        entry.values.insert(field.into(), value);
        Ok(())
    }

    /// エントリのフィールド値を強制更新（visibility無視、開発用）
    pub fn force_update_entry_field(
        &mut self,
        schema_id: &str,
        entry_id: &str,
        field: &str,
        value: serde_json::Value,
    ) -> Result<(), DataOrganizerError> {
        let schema = self
            .schemas
            .get(schema_id)
            .ok_or_else(|| DataOrganizerError::SchemaNotFound(schema_id.into()))?;

        if schema.find_field(field).is_none() {
            return Err(DataOrganizerError::FieldNotFound {
                schema_id: schema_id.into(),
                field: field.into(),
            });
        }

        let entries = self
            .entries
            .get_mut(schema_id)
            .ok_or_else(|| DataOrganizerError::SchemaNotFound(schema_id.into()))?;

        let entry = entries.get_mut(entry_id).ok_or_else(|| {
            DataOrganizerError::EntryNotFound {
                schema_id: schema_id.into(),
                entry_id: entry_id.into(),
            }
        })?;

        entry.values.insert(field.into(), value);
        Ok(())
    }

    /// エントリを取得
    pub fn get_entry(
        &self,
        schema_id: &str,
        entry_id: &str,
    ) -> Result<&MasterDataEntry, DataOrganizerError> {
        let entries = self
            .entries
            .get(schema_id)
            .ok_or_else(|| DataOrganizerError::SchemaNotFound(schema_id.into()))?;

        entries.get(entry_id).ok_or_else(|| {
            DataOrganizerError::EntryNotFound {
                schema_id: schema_id.into(),
                entry_id: entry_id.into(),
            }
        })
    }

    /// スキーマに属する全エントリを取得
    pub fn get_entries(
        &self,
        schema_id: &str,
    ) -> Result<Vec<&MasterDataEntry>, DataOrganizerError> {
        let entries = self
            .entries
            .get(schema_id)
            .ok_or_else(|| DataOrganizerError::SchemaNotFound(schema_id.into()))?;

        Ok(entries.values().collect())
    }

    /// 特定アクターに紐づくエントリを検索
    pub fn get_entries_for_actor(
        &self,
        schema_id: &str,
        actor_id: &str,
    ) -> Result<Vec<&MasterDataEntry>, DataOrganizerError> {
        let entries = self
            .entries
            .get(schema_id)
            .ok_or_else(|| DataOrganizerError::SchemaNotFound(schema_id.into()))?;

        Ok(entries
            .values()
            .filter(|e| e.actor_id.as_deref() == Some(actor_id))
            .collect())
    }

    /// JSON にシリアライズ
    pub fn to_json(&self) -> Result<String, DataOrganizerError> {
        Ok(serde_json::to_string_pretty(self)?)
    }

    /// JSON からデシリアライズ
    pub fn from_json(json: &str) -> Result<Self, DataOrganizerError> {
        Ok(serde_json::from_str(json)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::*;

    fn setup_registry() -> MasterDataRegistry {
        let mut registry = MasterDataRegistry::new();
        let schema = DataSchema {
            id: "enemy_stats".into(),
            name: "Enemy Stats".into(),
            domain: "character".into(),
            description: "敵キャラクターのステータス".into(),
            fields: vec![
                FieldDefinition {
                    name: "hp".into(),
                    field_type: FieldType::Int,
                    default_value: Some(serde_json::json!(100)),
                    visibility: FieldVisibility::Exposed,
                    description: "体力".into(),
                    update_frequency: UpdateFrequency::Frequent,
                },
                FieldDefinition {
                    name: "internal_flag".into(),
                    field_type: FieldType::Bool,
                    default_value: Some(serde_json::json!(false)),
                    visibility: FieldVisibility::Hidden,
                    description: "内部フラグ".into(),
                    update_frequency: UpdateFrequency::Constant,
                },
            ],
        };
        registry.register_schema(schema).unwrap();
        registry
    }

    #[test]
    fn test_add_and_get_entry() {
        let mut registry = setup_registry();
        registry
            .add_entry("enemy_stats", "slime_01".into(), Some("actor_slime".into()))
            .unwrap();

        let entry = registry.get_entry("enemy_stats", "slime_01").unwrap();
        assert_eq!(entry.get("hp"), Some(&serde_json::json!(100)));
        assert_eq!(entry.actor_id.as_deref(), Some("actor_slime"));
    }

    #[test]
    fn test_update_exposed_field() {
        let mut registry = setup_registry();
        registry
            .add_entry("enemy_stats", "slime_01".into(), None)
            .unwrap();

        registry
            .update_entry_field("enemy_stats", "slime_01", "hp", serde_json::json!(200))
            .unwrap();

        let entry = registry.get_entry("enemy_stats", "slime_01").unwrap();
        assert_eq!(entry.get("hp"), Some(&serde_json::json!(200)));
    }

    #[test]
    fn test_cannot_update_hidden_field() {
        let mut registry = setup_registry();
        registry
            .add_entry("enemy_stats", "slime_01".into(), None)
            .unwrap();

        let result = registry.update_entry_field(
            "enemy_stats",
            "slime_01",
            "internal_flag",
            serde_json::json!(true),
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_serialization_roundtrip() {
        let mut registry = setup_registry();
        registry
            .add_entry("enemy_stats", "slime_01".into(), None)
            .unwrap();

        let json = registry.to_json().unwrap();
        let restored = MasterDataRegistry::from_json(&json).unwrap();
        let entry = restored.get_entry("enemy_stats", "slime_01").unwrap();
        assert_eq!(entry.get("hp"), Some(&serde_json::json!(100)));
    }
}
