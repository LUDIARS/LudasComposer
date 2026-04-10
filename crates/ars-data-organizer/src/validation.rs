use ars_core::models::{
    DataCategory, DataField, DataFieldType, DataSchema, FieldConstraint, MasterDataRecord,
    MasterDataTable,
};

/// バリデーションエラー
#[derive(Debug, Clone)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "field '{}': {}", self.field, self.message)
    }
}

/// スキーマ定義自体の妥当性を検証する
pub fn validate_schema(schema: &DataSchema) -> Vec<ValidationError> {
    let mut errors = Vec::new();

    if schema.id.is_empty() {
        errors.push(ValidationError {
            field: "id".to_string(),
            message: "Schema ID must not be empty".to_string(),
        });
    }

    if schema.name.is_empty() {
        errors.push(ValidationError {
            field: "name".to_string(),
            message: "Schema name must not be empty".to_string(),
        });
    }

    if schema.fields.is_empty() {
        errors.push(ValidationError {
            field: "fields".to_string(),
            message: "Schema must have at least one field".to_string(),
        });
    }

    let mut seen_names = std::collections::HashSet::new();
    for field in &schema.fields {
        if field.name.is_empty() {
            errors.push(ValidationError {
                field: "fields".to_string(),
                message: "Field name must not be empty".to_string(),
            });
        } else if !seen_names.insert(&field.name) {
            errors.push(ValidationError {
                field: field.name.clone(),
                message: "Duplicate field name".to_string(),
            });
        }

        if let DataFieldType::Enum { variants } = &field.field_type {
            if variants.is_empty() {
                errors.push(ValidationError {
                    field: field.name.clone(),
                    message: "Enum type must have at least one variant".to_string(),
                });
            }
        }
    }

    errors
}

/// 1レコードの値をスキーマに対して検証する
pub fn validate_record(
    schema: &DataSchema,
    record: &MasterDataRecord,
) -> Vec<ValidationError> {
    let mut errors = Vec::new();

    if record.id.is_empty() {
        errors.push(ValidationError {
            field: "id".to_string(),
            message: "Record ID must not be empty".to_string(),
        });
    }

    for field in &schema.fields {
        match record.values.get(&field.name) {
            Some(value) => {
                errors.extend(validate_field_value(field, value));
            }
            None => {
                if is_required(field) && field.default_value.is_none() {
                    errors.push(ValidationError {
                        field: field.name.clone(),
                        message: "Required field is missing and has no default".to_string(),
                    });
                }
            }
        }
    }

    errors
}

/// テーブル全体を検証する（スキーマとの整合性 + レコード重複チェック）
pub fn validate_table(
    schema: &DataSchema,
    table: &MasterDataTable,
) -> Vec<ValidationError> {
    let mut errors = Vec::new();

    if schema.category != DataCategory::Master {
        errors.push(ValidationError {
            field: "category".to_string(),
            message: "Master data table must reference a master category schema".to_string(),
        });
    }

    if table.schema_id != schema.id {
        errors.push(ValidationError {
            field: "schemaId".to_string(),
            message: format!(
                "Table schema_id '{}' does not match schema id '{}'",
                table.schema_id, schema.id
            ),
        });
    }

    let mut seen_ids = std::collections::HashSet::new();
    for (i, record) in table.records.iter().enumerate() {
        if !seen_ids.insert(&record.id) {
            errors.push(ValidationError {
                field: format!("records[{}].id", i),
                message: format!("Duplicate record ID '{}'", record.id),
            });
        }
        let record_errors = validate_record(schema, record);
        for mut err in record_errors {
            err.field = format!("records[{}].{}", i, err.field);
            errors.push(err);
        }
    }

    errors
}

fn is_required(field: &DataField) -> bool {
    field
        .constraints
        .iter()
        .any(|c| matches!(c, FieldConstraint::Required))
}

fn validate_field_value(field: &DataField, value: &serde_json::Value) -> Vec<ValidationError> {
    let mut errors = Vec::new();

    if value.is_null() {
        if is_required(field) {
            errors.push(ValidationError {
                field: field.name.clone(),
                message: "Required field cannot be null".to_string(),
            });
        }
        return errors;
    }

    // 型チェック
    match &field.field_type {
        DataFieldType::Bool => {
            if !value.is_boolean() {
                errors.push(ValidationError {
                    field: field.name.clone(),
                    message: format!("Expected bool, got {}", value_type_name(value)),
                });
            }
        }
        DataFieldType::Int => {
            if !value.is_i64() && !value.is_u64() {
                // 浮動小数点でも整数値であれば許容
                if let Some(f) = value.as_f64() {
                    if f.fract() != 0.0 {
                        errors.push(ValidationError {
                            field: field.name.clone(),
                            message: format!("Expected int, got float with fraction: {}", f),
                        });
                    }
                } else {
                    errors.push(ValidationError {
                        field: field.name.clone(),
                        message: format!("Expected int, got {}", value_type_name(value)),
                    });
                }
            }
        }
        DataFieldType::Float => {
            if !value.is_number() {
                errors.push(ValidationError {
                    field: field.name.clone(),
                    message: format!("Expected float, got {}", value_type_name(value)),
                });
            }
        }
        DataFieldType::String => {
            if !value.is_string() {
                errors.push(ValidationError {
                    field: field.name.clone(),
                    message: format!("Expected string, got {}", value_type_name(value)),
                });
            }
        }
        DataFieldType::Enum { variants } => {
            if let Some(s) = value.as_str() {
                if !variants.contains(&s.to_string()) {
                    errors.push(ValidationError {
                        field: field.name.clone(),
                        message: format!(
                            "Value '{}' is not a valid enum variant. Expected one of: {:?}",
                            s, variants
                        ),
                    });
                }
            } else {
                errors.push(ValidationError {
                    field: field.name.clone(),
                    message: format!("Expected string for enum, got {}", value_type_name(value)),
                });
            }
        }
        DataFieldType::Reference { .. } => {
            if !value.is_string() {
                errors.push(ValidationError {
                    field: field.name.clone(),
                    message: format!(
                        "Expected string (reference ID), got {}",
                        value_type_name(value)
                    ),
                });
            }
        }
    }

    // 制約チェック
    for constraint in &field.constraints {
        if let Some(err) = check_constraint(&field.name, value, constraint) {
            errors.push(err);
        }
    }

    errors
}

fn check_constraint(
    field_name: &str,
    value: &serde_json::Value,
    constraint: &FieldConstraint,
) -> Option<ValidationError> {
    match constraint {
        FieldConstraint::Required => None, // 上位で処理済み
        FieldConstraint::Min { value: min } => {
            if let Some(n) = value.as_f64() {
                if n < *min {
                    return Some(ValidationError {
                        field: field_name.to_string(),
                        message: format!("Value {} is less than minimum {}", n, min),
                    });
                }
            }
            None
        }
        FieldConstraint::Max { value: max } => {
            if let Some(n) = value.as_f64() {
                if n > *max {
                    return Some(ValidationError {
                        field: field_name.to_string(),
                        message: format!("Value {} exceeds maximum {}", n, max),
                    });
                }
            }
            None
        }
        FieldConstraint::MinLength { value: min_len } => {
            if let Some(s) = value.as_str() {
                if s.len() < *min_len {
                    return Some(ValidationError {
                        field: field_name.to_string(),
                        message: format!(
                            "String length {} is less than minimum {}",
                            s.len(),
                            min_len
                        ),
                    });
                }
            }
            None
        }
        FieldConstraint::MaxLength { value: max_len } => {
            if let Some(s) = value.as_str() {
                if s.len() > *max_len {
                    return Some(ValidationError {
                        field: field_name.to_string(),
                        message: format!(
                            "String length {} exceeds maximum {}",
                            s.len(),
                            max_len
                        ),
                    });
                }
            }
            None
        }
        FieldConstraint::Pattern { regex } => {
            if let Some(s) = value.as_str() {
                match regex_lite::Regex::new(regex) {
                    Ok(re) => {
                        if !re.is_match(s) {
                            return Some(ValidationError {
                                field: field_name.to_string(),
                                message: format!(
                                    "Value '{}' does not match pattern '{}'",
                                    s, regex
                                ),
                            });
                        }
                    }
                    Err(e) => {
                        return Some(ValidationError {
                            field: field_name.to_string(),
                            message: format!("Invalid regex pattern '{}': {}", regex, e),
                        });
                    }
                }
            }
            None
        }
    }
}

fn value_type_name(v: &serde_json::Value) -> &'static str {
    match v {
        serde_json::Value::Null => "null",
        serde_json::Value::Bool(_) => "bool",
        serde_json::Value::Number(_) => "number",
        serde_json::Value::String(_) => "string",
        serde_json::Value::Array(_) => "array",
        serde_json::Value::Object(_) => "object",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn sample_schema() -> DataSchema {
        DataSchema {
            id: "enemy".to_string(),
            name: "Enemy".to_string(),
            description: String::new(),
            fields: vec![
                DataField {
                    name: "name".to_string(),
                    field_type: DataFieldType::String,
                    default_value: None,
                    description: String::new(),
                    constraints: vec![
                        FieldConstraint::Required,
                        FieldConstraint::MinLength { value: 1 },
                    ],
                },
                DataField {
                    name: "hp".to_string(),
                    field_type: DataFieldType::Int,
                    default_value: Some(serde_json::json!(100)),
                    description: String::new(),
                    constraints: vec![
                        FieldConstraint::Required,
                        FieldConstraint::Min { value: 1.0 },
                        FieldConstraint::Max { value: 99999.0 },
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
                    default_value: None,
                    description: String::new(),
                    constraints: vec![],
                },
            ],
            category: DataCategory::Master,
        }
    }

    #[test]
    fn test_validate_valid_record() {
        let schema = sample_schema();
        let record = MasterDataRecord {
            id: "slime".to_string(),
            values: {
                let mut m = HashMap::new();
                m.insert("name".to_string(), serde_json::json!("Slime"));
                m.insert("hp".to_string(), serde_json::json!(10));
                m.insert("element".to_string(), serde_json::json!("water"));
                m
            },
        };
        let errors = validate_record(&schema, &record);
        assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);
    }

    #[test]
    fn test_validate_wrong_type() {
        let schema = sample_schema();
        let record = MasterDataRecord {
            id: "bad".to_string(),
            values: {
                let mut m = HashMap::new();
                m.insert("name".to_string(), serde_json::json!(123)); // wrong type
                m.insert("hp".to_string(), serde_json::json!(10));
                m
            },
        };
        let errors = validate_record(&schema, &record);
        assert!(errors.iter().any(|e| e.field == "name" && e.message.contains("Expected string")));
    }

    #[test]
    fn test_validate_constraint_violation() {
        let schema = sample_schema();
        let record = MasterDataRecord {
            id: "weak".to_string(),
            values: {
                let mut m = HashMap::new();
                m.insert("name".to_string(), serde_json::json!("Weak"));
                m.insert("hp".to_string(), serde_json::json!(0)); // below min
                m
            },
        };
        let errors = validate_record(&schema, &record);
        assert!(errors.iter().any(|e| e.field == "hp" && e.message.contains("less than minimum")));
    }

    #[test]
    fn test_validate_invalid_enum() {
        let schema = sample_schema();
        let record = MasterDataRecord {
            id: "bad_elem".to_string(),
            values: {
                let mut m = HashMap::new();
                m.insert("name".to_string(), serde_json::json!("Test"));
                m.insert("hp".to_string(), serde_json::json!(10));
                m.insert("element".to_string(), serde_json::json!("lightning"));
                m
            },
        };
        let errors = validate_record(&schema, &record);
        assert!(errors
            .iter()
            .any(|e| e.field == "element" && e.message.contains("not a valid enum variant")));
    }

    #[test]
    fn test_validate_missing_required_no_default() {
        let schema = sample_schema();
        let record = MasterDataRecord {
            id: "missing".to_string(),
            values: HashMap::new(), // name is required with no default
        };
        let errors = validate_record(&schema, &record);
        assert!(errors.iter().any(|e| e.field == "name"));
    }

    #[test]
    fn test_validate_schema_empty_fields() {
        let schema = DataSchema {
            id: "empty".to_string(),
            name: "Empty".to_string(),
            description: String::new(),
            fields: vec![],
            category: DataCategory::Master,
        };
        let errors = validate_schema(&schema);
        assert!(errors.iter().any(|e| e.field == "fields"));
    }

    #[test]
    fn test_validate_schema_duplicate_field_names() {
        let schema = DataSchema {
            id: "dup".to_string(),
            name: "Dup".to_string(),
            description: String::new(),
            fields: vec![
                DataField {
                    name: "x".to_string(),
                    field_type: DataFieldType::Int,
                    default_value: None,
                    description: String::new(),
                    constraints: vec![],
                },
                DataField {
                    name: "x".to_string(),
                    field_type: DataFieldType::Float,
                    default_value: None,
                    description: String::new(),
                    constraints: vec![],
                },
            ],
            category: DataCategory::Master,
        };
        let errors = validate_schema(&schema);
        assert!(errors.iter().any(|e| e.message.contains("Duplicate")));
    }

    #[test]
    fn test_validate_table_duplicate_record_ids() {
        let schema = sample_schema();
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
                        m
                    },
                },
                MasterDataRecord {
                    id: "slime".to_string(), // duplicate
                    values: {
                        let mut m = HashMap::new();
                        m.insert("name".to_string(), serde_json::json!("Slime2"));
                        m.insert("hp".to_string(), serde_json::json!(20));
                        m
                    },
                },
            ],
        };
        let errors = validate_table(&schema, &table);
        assert!(errors.iter().any(|e| e.message.contains("Duplicate record ID")));
    }
}
