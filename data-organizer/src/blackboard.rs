use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use crate::error::DataOrganizerError;
use crate::master_data::MasterDataRegistry;

/// ブラックボードアーキテクチャ
///
/// ゲームランタイム中のデータアクセスレイヤー。
/// マスターデータ（定数）はリードオンリーで公開し、
/// ランタイムパラメータ（ゲームプレイ中に変更可能な値）は
/// 別レイヤーで管理する。
///
/// ```text
/// ┌─────────────────────────────┐
/// │       Blackboard            │
/// │  ┌───────────────────────┐  │
/// │  │  Constants (RO)       │  │  ← MasterDataRegistryのスナップショット
/// │  │  schema/entry/field   │  │
/// │  └───────────────────────┘  │
/// │  ┌───────────────────────┐  │
/// │  │  Runtime Params (RW)  │  │  ← ゲームプレイ中に変更可能
/// │  │  key → value          │  │
/// │  └───────────────────────┘  │
/// └─────────────────────────────┘
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Blackboard {
    /// マスターデータのスナップショット（リードオンリー）
    constants: MasterDataRegistry,
    /// ランタイムパラメータ（ゲームプレイ中に変更可能）
    /// キーは "schema_id:entry_id:field" 形式
    runtime_overrides: HashMap<String, serde_json::Value>,
}

impl Blackboard {
    /// マスターデータレジストリからブラックボードを構築
    pub fn from_registry(registry: &MasterDataRegistry) -> Self {
        Blackboard {
            constants: registry.clone(),
            runtime_overrides: HashMap::new(),
        }
    }

    /// 定数値を読み取る（リードオンリー）
    ///
    /// ランタイムオーバーライドがあればそちらを優先する
    pub fn read(
        &self,
        schema_id: &str,
        entry_id: &str,
        field: &str,
    ) -> Result<&serde_json::Value, DataOrganizerError> {
        let key = format!("{schema_id}:{entry_id}:{field}");

        // ランタイムオーバーライドを優先
        if let Some(value) = self.runtime_overrides.get(&key) {
            return Ok(value);
        }

        // 定数値から読み取り
        let entry = self.constants.get_entry(schema_id, entry_id)?;
        entry.get(field).ok_or_else(|| DataOrganizerError::FieldNotFound {
            schema_id: schema_id.into(),
            field: field.into(),
        })
    }

    /// ランタイムパラメータを設定（ゲームプレイ中の変更）
    pub fn write_runtime(
        &mut self,
        schema_id: &str,
        entry_id: &str,
        field: &str,
        value: serde_json::Value,
    ) -> Result<(), DataOrganizerError> {
        // スキーマとエントリの存在確認
        let schema = self.constants.get_schema(schema_id)?;
        self.constants.get_entry(schema_id, entry_id)?;

        // フィールドの存在確認
        if schema.find_field(field).is_none() {
            return Err(DataOrganizerError::FieldNotFound {
                schema_id: schema_id.into(),
                field: field.into(),
            });
        }

        let key = format!("{schema_id}:{entry_id}:{field}");
        self.runtime_overrides.insert(key, value);
        Ok(())
    }

    /// ランタイムオーバーライドをクリア（定数値に戻す）
    pub fn reset_runtime(
        &mut self,
        schema_id: &str,
        entry_id: &str,
        field: &str,
    ) {
        let key = format!("{schema_id}:{entry_id}:{field}");
        self.runtime_overrides.remove(&key);
    }

    /// 全ランタイムオーバーライドをクリア
    pub fn reset_all_runtime(&mut self) {
        self.runtime_overrides.clear();
    }

    /// ランタイムオーバーライドの一覧を取得
    pub fn runtime_overrides(&self) -> &HashMap<String, serde_json::Value> {
        &self.runtime_overrides
    }

    /// 定数レジストリへの読み取り専用アクセス
    pub fn constants(&self) -> &MasterDataRegistry {
        &self.constants
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::*;

    fn setup_blackboard() -> Blackboard {
        let mut registry = MasterDataRegistry::new();
        let schema = DataSchema {
            id: "physics".into(),
            name: "Physics".into(),
            domain: "world".into(),
            description: "物理パラメータ".into(),
            fields: vec![
                FieldDefinition {
                    name: "gravity".into(),
                    field_type: FieldType::Float,
                    default_value: Some(serde_json::json!(9.81)),
                    visibility: FieldVisibility::Exposed,
                    description: "重力".into(),
                    update_frequency: UpdateFrequency::Rare,
                },
            ],
        };
        registry.register_schema(schema).unwrap();
        registry.add_entry("physics", "default".into(), None).unwrap();
        Blackboard::from_registry(&registry)
    }

    #[test]
    fn test_read_constant() {
        let bb = setup_blackboard();
        let val = bb.read("physics", "default", "gravity").unwrap();
        assert_eq!(val, &serde_json::json!(9.81));
    }

    #[test]
    fn test_runtime_override() {
        let mut bb = setup_blackboard();

        // ランタイムで重力を変更
        bb.write_runtime("physics", "default", "gravity", serde_json::json!(0.0))
            .unwrap();
        let val = bb.read("physics", "default", "gravity").unwrap();
        assert_eq!(val, &serde_json::json!(0.0));

        // リセットで元に戻る
        bb.reset_runtime("physics", "default", "gravity");
        let val = bb.read("physics", "default", "gravity").unwrap();
        assert_eq!(val, &serde_json::json!(9.81));
    }
}
