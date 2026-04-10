use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_rs::TS;

// ── DataFieldType ──────────────────────────────────

/// データフィールドの型定義
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "kind")]
pub enum DataFieldType {
    /// 真偽値
    #[serde(rename = "bool")]
    Bool,
    /// 整数
    #[serde(rename = "int")]
    Int,
    /// 浮動小数点
    #[serde(rename = "float")]
    Float,
    /// 文字列
    #[serde(rename = "string")]
    String,
    /// 列挙型（選択肢リスト）
    #[serde(rename = "enum")]
    Enum { variants: Vec<std::string::String> },
    /// 他スキーマへの参照（外部キー）
    #[serde(rename = "reference")]
    Reference {
        #[serde(rename = "schemaId")]
        schema_id: std::string::String,
    },
}

// ── FieldConstraint ────────────────────────────────

/// フィールドに対する制約
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type")]
pub enum FieldConstraint {
    /// 必須フィールド
    #[serde(rename = "required")]
    Required,
    /// 数値の最小値
    #[serde(rename = "min")]
    Min { value: f64 },
    /// 数値の最大値
    #[serde(rename = "max")]
    Max { value: f64 },
    /// 文字列の最小文字数
    #[serde(rename = "minLength")]
    MinLength { value: usize },
    /// 文字列の最大文字数
    #[serde(rename = "maxLength")]
    MaxLength { value: usize },
    /// 正規表現パターン
    #[serde(rename = "pattern")]
    Pattern { regex: std::string::String },
}

// ── DataField ──────────────────────────────────────

/// スキーマ内の1フィールド定義
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DataField {
    /// フィールド名（変数名として使用される）
    pub name: std::string::String,
    /// フィールドの型
    #[serde(rename = "fieldType")]
    pub field_type: DataFieldType,
    /// デフォルト値（JSON表現）
    #[serde(rename = "defaultValue")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<serde_json::Value>,
    /// フィールドの説明
    #[serde(default)]
    pub description: std::string::String,
    /// 制約条件
    #[serde(default)]
    pub constraints: Vec<FieldConstraint>,
}

// ── DataCategory ───────────────────────────────────

/// データの分類
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub enum DataCategory {
    /// マスターデータ: 読み取り専用、設計時に定義
    #[serde(rename = "master")]
    Master,
    /// ユーザーデータ: ランタイムで変更可能、セーブ対象
    #[serde(rename = "user")]
    User,
}

// ── DataSchema ─────────────────────────────────────

/// データスキーマ定義
///
/// マスターデータとユーザーデータの両方で共通のスキーマ構造。
/// category で用途を区別する。
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DataSchema {
    pub id: std::string::String,
    pub name: std::string::String,
    #[serde(default)]
    pub description: std::string::String,
    /// フィールド定義
    pub fields: Vec<DataField>,
    /// マスター / ユーザーの区分
    pub category: DataCategory,
}

// ── MasterData ─────────────────────────────────────

/// マスターデータの1レコード（バリエーション）
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct MasterDataRecord {
    /// レコードの一意識別子
    pub id: std::string::String,
    /// フィールド名 → 値 のマップ
    #[ts(type = "Record<string, any>")]
    pub values: HashMap<std::string::String, serde_json::Value>,
}

/// マスターデータテーブル
///
/// 1つのスキーマに対して複数のレコード（バリエーション）を保持する。
/// 例: "Enemy" スキーマに対して "Slime", "Dragon" 等のバリエーション。
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct MasterDataTable {
    /// テーブルの一意識別子
    pub id: std::string::String,
    /// 参照するスキーマID
    #[serde(rename = "schemaId")]
    pub schema_id: std::string::String,
    /// テーブル名
    pub name: std::string::String,
    /// レコード一覧
    pub records: Vec<MasterDataRecord>,
}

// ── UserData ───────────────────────────────────────

/// ユーザーデータのスコープ
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub enum UserDataScope {
    /// アクター単位（各インスタンスごと）
    #[serde(rename = "actor")]
    Actor,
    /// シーン単位
    #[serde(rename = "scene")]
    Scene,
    /// グローバル（セーブデータ全体で1つ）
    #[serde(rename = "global")]
    Global,
}

/// ユーザーデータ定義
///
/// スキーマの各フィールドがクラスのメンバ変数として宣言される。
/// SaveDataProvider を注入してデータの復元/保存を行う。
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct UserDataDefinition {
    /// 定義の一意識別子
    pub id: std::string::String,
    /// 参照するスキーマID
    #[serde(rename = "schemaId")]
    pub schema_id: std::string::String,
    /// データのスコープ
    pub scope: UserDataScope,
    /// セーブデータに含めるかどうか（false = 揮発性）
    #[serde(default = "default_true")]
    pub persistent: bool,
}

fn default_true() -> bool {
    true
}

// ── ImportSource ───────────────────────────────────

/// インポート元の種別
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type")]
pub enum ImportSource {
    /// CSVファイル
    #[serde(rename = "csv")]
    Csv { path: std::string::String },
    /// Excelファイル (.xlsx / .xls)
    #[serde(rename = "excel")]
    Excel {
        path: std::string::String,
        /// シート名（省略時は最初のシート）
        #[serde(skip_serializing_if = "Option::is_none")]
        sheet: Option<std::string::String>,
    },
}

/// カラムマッピング: インポート元のカラム名 → スキーマのフィールド名
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ColumnMapping {
    /// インポート元のカラム名
    #[serde(rename = "sourceColumn")]
    pub source_column: std::string::String,
    /// マッピング先のフィールド名
    #[serde(rename = "fieldName")]
    pub field_name: std::string::String,
}

/// インポート設定
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ImportConfig {
    /// インポート元
    pub source: ImportSource,
    /// 対象スキーマID
    #[serde(rename = "schemaId")]
    pub schema_id: std::string::String,
    /// カラムマッピング（空の場合はヘッダー名 = フィールド名として自動マッピング）
    #[serde(default)]
    #[serde(rename = "columnMappings")]
    pub column_mappings: Vec<ColumnMapping>,
    /// IDカラム名（省略時は自動生成）
    #[serde(rename = "idColumn")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id_column: Option<std::string::String>,
}

/// インポートエラーの詳細
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ImportError {
    /// 行番号（1始まり）
    pub row: usize,
    /// エラーが発生したカラム名
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column: Option<std::string::String>,
    /// エラーメッセージ
    pub message: std::string::String,
}

/// インポート結果
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ImportResult {
    /// インポートされたレコード数
    #[serde(rename = "recordsImported")]
    pub records_imported: usize,
    /// スキップされたレコード数
    #[serde(rename = "recordsSkipped")]
    pub records_skipped: usize,
    /// エラー一覧
    pub errors: Vec<ImportError>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_data_field_type_serialize() {
        let ft = DataFieldType::Int;
        let json = serde_json::to_string(&ft).unwrap();
        assert_eq!(json, r#"{"kind":"int"}"#);

        let ft = DataFieldType::Enum {
            variants: vec!["fire".to_string(), "water".to_string()],
        };
        let json = serde_json::to_string(&ft).unwrap();
        assert!(json.contains("\"kind\":\"enum\""));
        assert!(json.contains("\"variants\""));

        let ft = DataFieldType::Reference {
            schema_id: "item".to_string(),
        };
        let json = serde_json::to_string(&ft).unwrap();
        assert!(json.contains("\"schemaId\":\"item\""));
    }

    #[test]
    fn test_data_field_type_roundtrip() {
        let types = vec![
            DataFieldType::Bool,
            DataFieldType::Int,
            DataFieldType::Float,
            DataFieldType::String,
            DataFieldType::Enum {
                variants: vec!["a".to_string(), "b".to_string()],
            },
            DataFieldType::Reference {
                schema_id: "enemy".to_string(),
            },
        ];
        for ft in &types {
            let json = serde_json::to_string(ft).unwrap();
            let loaded: DataFieldType = serde_json::from_str(&json).unwrap();
            assert_eq!(&loaded, ft);
        }
    }

    #[test]
    fn test_data_schema_roundtrip() {
        let schema = DataSchema {
            id: "enemy".to_string(),
            name: "Enemy".to_string(),
            description: "Enemy definitions".to_string(),
            fields: vec![
                DataField {
                    name: "name".to_string(),
                    field_type: DataFieldType::String,
                    default_value: None,
                    description: "Enemy name".to_string(),
                    constraints: vec![FieldConstraint::Required],
                },
                DataField {
                    name: "hp".to_string(),
                    field_type: DataFieldType::Int,
                    default_value: Some(serde_json::json!(100)),
                    description: "Hit points".to_string(),
                    constraints: vec![
                        FieldConstraint::Required,
                        FieldConstraint::Min { value: 1.0 },
                    ],
                },
                DataField {
                    name: "element".to_string(),
                    field_type: DataFieldType::Enum {
                        variants: vec![
                            "fire".to_string(),
                            "water".to_string(),
                            "earth".to_string(),
                        ],
                    },
                    default_value: Some(serde_json::json!("fire")),
                    description: "Element type".to_string(),
                    constraints: vec![],
                },
            ],
            category: DataCategory::Master,
        };

        let json = serde_json::to_string_pretty(&schema).unwrap();
        let loaded: DataSchema = serde_json::from_str(&json).unwrap();

        assert_eq!(loaded.id, "enemy");
        assert_eq!(loaded.fields.len(), 3);
        assert_eq!(loaded.category, DataCategory::Master);
    }

    #[test]
    fn test_master_data_table_roundtrip() {
        let table = MasterDataTable {
            id: "enemies".to_string(),
            schema_id: "enemy".to_string(),
            name: "Enemies".to_string(),
            records: vec![
                MasterDataRecord {
                    id: "slime".to_string(),
                    values: {
                        let mut m = HashMap::new();
                        m.insert("name".to_string(), serde_json::json!("Slime"));
                        m.insert("hp".to_string(), serde_json::json!(10));
                        m.insert("element".to_string(), serde_json::json!("water"));
                        m
                    },
                },
                MasterDataRecord {
                    id: "dragon".to_string(),
                    values: {
                        let mut m = HashMap::new();
                        m.insert("name".to_string(), serde_json::json!("Dragon"));
                        m.insert("hp".to_string(), serde_json::json!(1000));
                        m.insert("element".to_string(), serde_json::json!("fire"));
                        m
                    },
                },
            ],
        };

        let json = serde_json::to_string(&table).unwrap();
        let loaded: MasterDataTable = serde_json::from_str(&json).unwrap();

        assert_eq!(loaded.id, "enemies");
        assert_eq!(loaded.records.len(), 2);
        assert_eq!(loaded.records[0].id, "slime");
    }

    #[test]
    fn test_user_data_definition_roundtrip() {
        let def = UserDataDefinition {
            id: "player-stats".to_string(),
            schema_id: "player_stats".to_string(),
            scope: UserDataScope::Global,
            persistent: true,
        };

        let json = serde_json::to_string(&def).unwrap();
        let loaded: UserDataDefinition = serde_json::from_str(&json).unwrap();

        assert_eq!(loaded.id, "player-stats");
        assert_eq!(loaded.scope, UserDataScope::Global);
        assert!(loaded.persistent);
    }

    #[test]
    fn test_user_data_default_persistent() {
        let json = r#"{"id":"test","schemaId":"s1","scope":"actor"}"#;
        let loaded: UserDataDefinition = serde_json::from_str(json).unwrap();
        assert!(loaded.persistent);
    }

    #[test]
    fn test_import_config_roundtrip() {
        let config = ImportConfig {
            source: ImportSource::Excel {
                path: "/data/enemies.xlsx".to_string(),
                sheet: Some("Sheet1".to_string()),
            },
            schema_id: "enemy".to_string(),
            column_mappings: vec![ColumnMapping {
                source_column: "Name".to_string(),
                field_name: "name".to_string(),
            }],
            id_column: Some("ID".to_string()),
        };

        let json = serde_json::to_string(&config).unwrap();
        let loaded: ImportConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(loaded.schema_id, "enemy");
        assert_eq!(loaded.column_mappings.len(), 1);
    }

    #[test]
    fn test_field_constraint_serialize() {
        let constraints = vec![
            FieldConstraint::Required,
            FieldConstraint::Min { value: 0.0 },
            FieldConstraint::Max { value: 9999.0 },
            FieldConstraint::MinLength { value: 1 },
            FieldConstraint::MaxLength { value: 255 },
            FieldConstraint::Pattern {
                regex: r"^[a-z_]+$".to_string(),
            },
        ];
        for c in &constraints {
            let json = serde_json::to_string(c).unwrap();
            let loaded: FieldConstraint = serde_json::from_str(&json).unwrap();
            assert_eq!(&loaded, c);
        }
    }
}
