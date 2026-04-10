//! Layer 2: Use Case 関数群
//!
//! 純粋な async 関数。Repository trait を引数に取り、状態を持たない。
//! App版でもWeb版でも同一コードが動く。

use ars_core::error::{ArsError, Result};
use ars_core::models::{
    DataCategory, DataSchema, ImportConfig, ImportResult, MasterDataTable, UserDataDefinition,
};
use ars_core::repository::{DataSchemaRepository, MasterDataRepository, SaveDataProvider};

use crate::import;
use crate::validation;

// ── Schema Use Cases ───────────────────────────────

/// スキーマを作成する
pub async fn create_schema(
    repo: &dyn DataSchemaRepository,
    project_id: &str,
    schema: DataSchema,
) -> Result<()> {
    let errors = validation::validate_schema(&schema);
    if !errors.is_empty() {
        let msg = errors
            .iter()
            .map(|e| e.to_string())
            .collect::<Vec<_>>()
            .join("; ");
        return Err(ArsError::Validation(msg));
    }

    if repo.load(project_id, &schema.id).await?.is_some() {
        return Err(ArsError::Validation(format!(
            "Schema '{}' already exists",
            schema.id
        )));
    }

    repo.save(project_id, &schema).await
}

/// スキーマを更新する
pub async fn update_schema(
    repo: &dyn DataSchemaRepository,
    project_id: &str,
    schema: DataSchema,
) -> Result<()> {
    let errors = validation::validate_schema(&schema);
    if !errors.is_empty() {
        let msg = errors
            .iter()
            .map(|e| e.to_string())
            .collect::<Vec<_>>()
            .join("; ");
        return Err(ArsError::Validation(msg));
    }

    if repo.load(project_id, &schema.id).await?.is_none() {
        return Err(ArsError::NotFound(format!("Schema '{}'", schema.id)));
    }

    repo.save(project_id, &schema).await
}

/// スキーマを取得する
pub async fn get_schema(
    repo: &dyn DataSchemaRepository,
    project_id: &str,
    schema_id: &str,
) -> Result<DataSchema> {
    repo.load(project_id, schema_id)
        .await?
        .ok_or_else(|| ArsError::NotFound(format!("Schema '{}'", schema_id)))
}

/// プロジェクト内の全スキーマを取得する
pub async fn list_schemas(
    repo: &dyn DataSchemaRepository,
    project_id: &str,
) -> Result<Vec<DataSchema>> {
    repo.list(project_id).await
}

/// スキーマを削除する
pub async fn delete_schema(
    repo: &dyn DataSchemaRepository,
    project_id: &str,
    schema_id: &str,
) -> Result<()> {
    if repo.load(project_id, schema_id).await?.is_none() {
        return Err(ArsError::NotFound(format!("Schema '{}'", schema_id)));
    }
    repo.delete(project_id, schema_id).await
}

// ── Master Data Use Cases ──────────────────────────

/// マスターデータテーブルを保存する（作成 or 更新）
///
/// スキーマとの整合性を検証してから保存する。
pub async fn save_master_data(
    schema_repo: &dyn DataSchemaRepository,
    data_repo: &dyn MasterDataRepository,
    project_id: &str,
    table: MasterDataTable,
) -> Result<()> {
    let schema = schema_repo
        .load(project_id, &table.schema_id)
        .await?
        .ok_or_else(|| ArsError::NotFound(format!("Schema '{}'", table.schema_id)))?;

    let errors = validation::validate_table(&schema, &table);
    if !errors.is_empty() {
        let msg = errors
            .iter()
            .map(|e| e.to_string())
            .collect::<Vec<_>>()
            .join("; ");
        return Err(ArsError::Validation(msg));
    }

    data_repo.save(project_id, &table).await
}

/// マスターデータテーブルを取得する
pub async fn get_master_data(
    repo: &dyn MasterDataRepository,
    project_id: &str,
    table_id: &str,
) -> Result<MasterDataTable> {
    repo.load(project_id, table_id)
        .await?
        .ok_or_else(|| ArsError::NotFound(format!("MasterDataTable '{}'", table_id)))
}

/// プロジェクト内の全マスターデータテーブルを取得する
pub async fn list_master_data(
    repo: &dyn MasterDataRepository,
    project_id: &str,
) -> Result<Vec<MasterDataTable>> {
    repo.list(project_id).await
}

/// マスターデータテーブルを削除する
pub async fn delete_master_data(
    repo: &dyn MasterDataRepository,
    project_id: &str,
    table_id: &str,
) -> Result<()> {
    if repo.load(project_id, table_id).await?.is_none() {
        return Err(ArsError::NotFound(format!(
            "MasterDataTable '{}'",
            table_id
        )));
    }
    repo.delete(project_id, table_id).await
}

// ── Import Use Cases ───────────────────────────────

/// 外部ファイル（CSV/Excel）からマスターデータをインポートする
pub async fn import_master_data(
    schema_repo: &dyn DataSchemaRepository,
    data_repo: &dyn MasterDataRepository,
    project_id: &str,
    table_id: &str,
    table_name: &str,
    config: &ImportConfig,
) -> Result<ImportResult> {
    let schema = schema_repo
        .load(project_id, &config.schema_id)
        .await?
        .ok_or_else(|| ArsError::NotFound(format!("Schema '{}'", config.schema_id)))?;

    if schema.category != DataCategory::Master {
        return Err(ArsError::Validation(
            "Can only import into master data schemas".to_string(),
        ));
    }

    let (records, parse_errors) = import::parse_import(config, &schema)?;

    // 既存テーブルがあればレコードをマージ、なければ新規作成
    let mut table = data_repo
        .load(project_id, table_id)
        .await?
        .unwrap_or_else(|| MasterDataTable {
            id: table_id.to_string(),
            schema_id: config.schema_id.clone(),
            name: table_name.to_string(),
            records: Vec::new(),
        });

    let mut imported = 0usize;
    let mut skipped = 0usize;
    let mut all_errors = parse_errors;

    for record in records {
        let record_errors = validation::validate_record(&schema, &record);
        if record_errors.is_empty() {
            // 同一IDのレコードがあれば上書き
            if let Some(pos) = table.records.iter().position(|r| r.id == record.id) {
                table.records[pos] = record;
            } else {
                table.records.push(record);
            }
            imported += 1;
        } else {
            skipped += 1;
            for err in record_errors {
                all_errors.push(ars_core::models::ImportError {
                    row: 0, // row number is lost at this point
                    column: Some(err.field),
                    message: err.message,
                });
            }
        }
    }

    data_repo.save(project_id, &table).await?;

    Ok(ImportResult {
        records_imported: imported,
        records_skipped: skipped,
        errors: all_errors,
    })
}

// ── User Data Use Cases ────────────────────────────

/// ユーザーデータを保存する
///
/// scope_key の形式:
/// - Actor scope: "actor:{actor_id}"
/// - Scene scope: "scene:{scene_id}"
/// - Global scope: "global"
pub async fn save_user_data(
    provider: &dyn SaveDataProvider,
    definition: &UserDataDefinition,
    scope_key: &str,
    data: &serde_json::Value,
) -> Result<()> {
    if !definition.persistent {
        return Err(ArsError::Validation(
            "Cannot save non-persistent user data".to_string(),
        ));
    }

    let key = format!("userdata:{}:{}", definition.id, scope_key);
    provider.save(&key, data).await
}

/// ユーザーデータを読み込む
pub async fn load_user_data(
    provider: &dyn SaveDataProvider,
    definition: &UserDataDefinition,
    scope_key: &str,
) -> Result<Option<serde_json::Value>> {
    let key = format!("userdata:{}:{}", definition.id, scope_key);
    provider.load(&key).await
}

/// ユーザーデータを削除する
pub async fn delete_user_data(
    provider: &dyn SaveDataProvider,
    definition: &UserDataDefinition,
    scope_key: &str,
) -> Result<()> {
    let key = format!("userdata:{}:{}", definition.id, scope_key);
    provider.delete(&key).await
}

/// 指定定義に属する全ユーザーデータのキー一覧を取得する
pub async fn list_user_data_keys(
    provider: &dyn SaveDataProvider,
    definition: &UserDataDefinition,
) -> Result<Vec<String>> {
    let prefix = format!("userdata:{}:", definition.id);
    provider.list_keys(&prefix).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use ars_core::models::{DataField, DataFieldType, FieldConstraint, UserDataScope};
    use async_trait::async_trait;
    use std::collections::HashMap;
    use std::sync::Mutex;

    // ── Mock Repositories ──────────────────────────

    struct MockSchemaRepo {
        data: Mutex<HashMap<String, DataSchema>>,
    }

    impl MockSchemaRepo {
        fn new() -> Self {
            Self {
                data: Mutex::new(HashMap::new()),
            }
        }
    }

    #[async_trait]
    impl DataSchemaRepository for MockSchemaRepo {
        async fn save(&self, _project_id: &str, schema: &DataSchema) -> Result<()> {
            self.data
                .lock()
                .unwrap()
                .insert(schema.id.clone(), schema.clone());
            Ok(())
        }
        async fn load(&self, _project_id: &str, schema_id: &str) -> Result<Option<DataSchema>> {
            Ok(self.data.lock().unwrap().get(schema_id).cloned())
        }
        async fn list(&self, _project_id: &str) -> Result<Vec<DataSchema>> {
            Ok(self.data.lock().unwrap().values().cloned().collect())
        }
        async fn delete(&self, _project_id: &str, schema_id: &str) -> Result<()> {
            self.data.lock().unwrap().remove(schema_id);
            Ok(())
        }
    }

    struct MockMasterDataRepo {
        data: Mutex<HashMap<String, MasterDataTable>>,
    }

    impl MockMasterDataRepo {
        fn new() -> Self {
            Self {
                data: Mutex::new(HashMap::new()),
            }
        }
    }

    #[async_trait]
    impl MasterDataRepository for MockMasterDataRepo {
        async fn save(&self, _project_id: &str, table: &MasterDataTable) -> Result<()> {
            self.data
                .lock()
                .unwrap()
                .insert(table.id.clone(), table.clone());
            Ok(())
        }
        async fn load(
            &self,
            _project_id: &str,
            table_id: &str,
        ) -> Result<Option<MasterDataTable>> {
            Ok(self.data.lock().unwrap().get(table_id).cloned())
        }
        async fn list(&self, _project_id: &str) -> Result<Vec<MasterDataTable>> {
            Ok(self.data.lock().unwrap().values().cloned().collect())
        }
        async fn delete(&self, _project_id: &str, table_id: &str) -> Result<()> {
            self.data.lock().unwrap().remove(table_id);
            Ok(())
        }
    }

    struct MockSaveDataProvider {
        data: Mutex<HashMap<String, serde_json::Value>>,
    }

    impl MockSaveDataProvider {
        fn new() -> Self {
            Self {
                data: Mutex::new(HashMap::new()),
            }
        }
    }

    #[async_trait]
    impl SaveDataProvider for MockSaveDataProvider {
        async fn save(&self, key: &str, data: &serde_json::Value) -> Result<()> {
            self.data
                .lock()
                .unwrap()
                .insert(key.to_string(), data.clone());
            Ok(())
        }
        async fn load(&self, key: &str) -> Result<Option<serde_json::Value>> {
            Ok(self.data.lock().unwrap().get(key).cloned())
        }
        async fn delete(&self, key: &str) -> Result<()> {
            self.data.lock().unwrap().remove(key);
            Ok(())
        }
        async fn list_keys(&self, prefix: &str) -> Result<Vec<String>> {
            Ok(self
                .data
                .lock()
                .unwrap()
                .keys()
                .filter(|k| k.starts_with(prefix))
                .cloned()
                .collect())
        }
    }

    fn test_schema() -> DataSchema {
        DataSchema {
            id: "item".to_string(),
            name: "Item".to_string(),
            description: String::new(),
            fields: vec![
                DataField {
                    name: "name".to_string(),
                    field_type: DataFieldType::String,
                    default_value: None,
                    description: String::new(),
                    constraints: vec![FieldConstraint::Required],
                },
                DataField {
                    name: "price".to_string(),
                    field_type: DataFieldType::Int,
                    default_value: Some(serde_json::json!(0)),
                    description: String::new(),
                    constraints: vec![FieldConstraint::Min { value: 0.0 }],
                },
            ],
            category: DataCategory::Master,
        }
    }

    #[tokio::test]
    async fn test_schema_crud() {
        let repo = MockSchemaRepo::new();

        // Create
        let schema = test_schema();
        create_schema(&repo, "p1", schema.clone()).await.unwrap();

        // Get
        let loaded = get_schema(&repo, "p1", "item").await.unwrap();
        assert_eq!(loaded.name, "Item");

        // List
        let all = list_schemas(&repo, "p1").await.unwrap();
        assert_eq!(all.len(), 1);

        // Duplicate creation should fail
        let dup_result = create_schema(&repo, "p1", test_schema()).await;
        assert!(dup_result.is_err());

        // Update
        let mut updated = test_schema();
        updated.name = "Updated Item".to_string();
        update_schema(&repo, "p1", updated).await.unwrap();

        let loaded = get_schema(&repo, "p1", "item").await.unwrap();
        assert_eq!(loaded.name, "Updated Item");

        // Delete
        delete_schema(&repo, "p1", "item").await.unwrap();
        let all = list_schemas(&repo, "p1").await.unwrap();
        assert!(all.is_empty());
    }

    #[tokio::test]
    async fn test_master_data_save_with_validation() {
        let schema_repo = MockSchemaRepo::new();
        let data_repo = MockMasterDataRepo::new();

        let schema = test_schema();
        schema_repo
            .save("p1", &schema)
            .await
            .unwrap();

        let table = MasterDataTable {
            id: "items".to_string(),
            schema_id: "item".to_string(),
            name: "Items".to_string(),
            records: vec![ars_core::models::MasterDataRecord {
                id: "potion".to_string(),
                values: {
                    let mut m = HashMap::new();
                    m.insert("name".to_string(), serde_json::json!("Potion"));
                    m.insert("price".to_string(), serde_json::json!(50));
                    m
                },
            }],
        };

        save_master_data(&schema_repo, &data_repo, "p1", table)
            .await
            .unwrap();

        let loaded = get_master_data(&data_repo, "p1", "items").await.unwrap();
        assert_eq!(loaded.records.len(), 1);
    }

    #[tokio::test]
    async fn test_user_data_save_load() {
        let provider = MockSaveDataProvider::new();
        let def = UserDataDefinition {
            id: "player-stats".to_string(),
            schema_id: "player_stats".to_string(),
            scope: UserDataScope::Global,
            persistent: true,
        };

        let data = serde_json::json!({
            "level": 5,
            "exp": 1200,
            "gold": 500
        });

        // Save
        save_user_data(&provider, &def, "global", &data)
            .await
            .unwrap();

        // Load
        let loaded = load_user_data(&provider, &def, "global").await.unwrap();
        assert!(loaded.is_some());
        assert_eq!(loaded.unwrap()["level"], 5);

        // List keys
        let keys = list_user_data_keys(&provider, &def).await.unwrap();
        assert_eq!(keys.len(), 1);

        // Delete
        delete_user_data(&provider, &def, "global").await.unwrap();
        let loaded = load_user_data(&provider, &def, "global").await.unwrap();
        assert!(loaded.is_none());
    }

    #[tokio::test]
    async fn test_non_persistent_data_cannot_save() {
        let provider = MockSaveDataProvider::new();
        let def = UserDataDefinition {
            id: "temp".to_string(),
            schema_id: "temp_schema".to_string(),
            scope: UserDataScope::Actor,
            persistent: false,
        };

        let result = save_user_data(&provider, &def, "actor:a1", &serde_json::json!({})).await;
        assert!(result.is_err());
    }
}
