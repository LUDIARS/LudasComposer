use serde::{Deserialize, Serialize};

/// フィールドの型定義
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum FieldType {
    Int,
    Float,
    String,
    Bool,
    /// 他のスキーマへの参照 (ID)
    Reference { schema_id: String },
    /// 配列型
    Array { element_type: Box<FieldType> },
    /// ベクトル型 (2D/3D)
    Vec2,
    Vec3,
    /// 列挙型
    Enum { variants: Vec<String> },
}

/// フィールドの可視性（ホワイトリスト方式）
///
/// デフォルトは Hidden。`Exposed` に設定されたフィールドのみ
/// データオーガナイザーのUIに表示され、外部から注入可能になる。
/// UnityのSerializeFieldと等価の概念。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FieldVisibility {
    /// UIに表示され、外部から値を注入可能
    Exposed,
    /// UIに表示されない（デフォルト）
    Hidden,
}

impl Default for FieldVisibility {
    fn default() -> Self {
        FieldVisibility::Hidden
    }
}

/// スキーマ内の1フィールド定義
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldDefinition {
    /// フィールド名
    pub name: String,
    /// フィールドの型
    pub field_type: FieldType,
    /// デフォルト値 (JSON)
    pub default_value: Option<serde_json::Value>,
    /// 可視性（ホワイトリスト方式）
    #[serde(default)]
    pub visibility: FieldVisibility,
    /// フィールドの説明
    #[serde(default)]
    pub description: String,
    /// 更新頻度ヒント (低頻度の設定は隠しやすくする)
    #[serde(default)]
    pub update_frequency: UpdateFrequency,
}

/// 更新頻度ヒント
/// 更新頻度に応じて設定を隠せるようにする
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub enum UpdateFrequency {
    /// ほぼ変更しない定数
    #[default]
    Constant,
    /// たまに調整する
    Rare,
    /// 頻繁に調整する
    Frequent,
}

/// データスキーマ定義
///
/// マスターデータのテーブル構造を定義する。
/// Excelのシート1枚に相当し、各エントリはIDで管理される。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataSchema {
    /// スキーマID（一意）
    pub id: String,
    /// 表示名
    pub name: String,
    /// 対象ドメイン (e.g., "physics", "character", "world")
    pub domain: String,
    /// フィールド定義のリスト
    pub fields: Vec<FieldDefinition>,
    /// スキーマの説明
    #[serde(default)]
    pub description: String,
}

impl DataSchema {
    /// Exposed なフィールドのみ返す
    pub fn exposed_fields(&self) -> Vec<&FieldDefinition> {
        self.fields
            .iter()
            .filter(|f| f.visibility == FieldVisibility::Exposed)
            .collect()
    }

    /// 指定した更新頻度以上のフィールドのみ返す
    pub fn fields_by_frequency(&self, min_frequency: &UpdateFrequency) -> Vec<&FieldDefinition> {
        let min_ord = frequency_order(min_frequency);
        self.fields
            .iter()
            .filter(|f| frequency_order(&f.update_frequency) >= min_ord)
            .collect()
    }

    /// フィールド名で検索
    pub fn find_field(&self, name: &str) -> Option<&FieldDefinition> {
        self.fields.iter().find(|f| f.name == name)
    }
}

fn frequency_order(freq: &UpdateFrequency) -> u8 {
    match freq {
        UpdateFrequency::Constant => 0,
        UpdateFrequency::Rare => 1,
        UpdateFrequency::Frequent => 2,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_schema() -> DataSchema {
        DataSchema {
            id: "world_params".into(),
            name: "World Parameters".into(),
            domain: "world".into(),
            description: "ワールド全体のパラメータ".into(),
            fields: vec![
                FieldDefinition {
                    name: "gravity".into(),
                    field_type: FieldType::Float,
                    default_value: Some(serde_json::json!(9.81)),
                    visibility: FieldVisibility::Exposed,
                    description: "重力加速度".into(),
                    update_frequency: UpdateFrequency::Rare,
                },
                FieldDefinition {
                    name: "air_resistance".into(),
                    field_type: FieldType::Float,
                    default_value: Some(serde_json::json!(0.01)),
                    visibility: FieldVisibility::Hidden,
                    description: "空気抵抗係数".into(),
                    update_frequency: UpdateFrequency::Constant,
                },
                FieldDefinition {
                    name: "time_scale".into(),
                    field_type: FieldType::Float,
                    default_value: Some(serde_json::json!(1.0)),
                    visibility: FieldVisibility::Exposed,
                    description: "時間スケール".into(),
                    update_frequency: UpdateFrequency::Frequent,
                },
            ],
        }
    }

    #[test]
    fn test_exposed_fields() {
        let schema = sample_schema();
        let exposed = schema.exposed_fields();
        assert_eq!(exposed.len(), 2);
        assert_eq!(exposed[0].name, "gravity");
        assert_eq!(exposed[1].name, "time_scale");
    }

    #[test]
    fn test_fields_by_frequency() {
        let schema = sample_schema();
        let frequent = schema.fields_by_frequency(&UpdateFrequency::Frequent);
        assert_eq!(frequent.len(), 1);
        assert_eq!(frequent[0].name, "time_scale");

        let rare_and_up = schema.fields_by_frequency(&UpdateFrequency::Rare);
        assert_eq!(rare_and_up.len(), 2);
    }
}
