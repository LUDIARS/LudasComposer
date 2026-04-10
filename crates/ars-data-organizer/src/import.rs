//! CSV / Excel インポート機能
//!
//! 外部スプレッドシート（CSV, Excel）からマスターデータを読み込む。
//! カラムマッピングに従い、スキーマのフィールドに値を変換する。

use std::collections::HashMap;
use std::path::Path;

use calamine::Reader;

use ars_core::error::{ArsError, Result};
use ars_core::models::{
    ColumnMapping, DataFieldType, DataSchema, ImportConfig, ImportError, ImportSource,
    MasterDataRecord,
};

/// インポート設定に従い、外部ファイルを解析してレコードを生成する
///
/// 戻り値: (正常レコード一覧, パースエラー一覧)
pub fn parse_import(
    config: &ImportConfig,
    schema: &DataSchema,
) -> Result<(Vec<MasterDataRecord>, Vec<ImportError>)> {
    let raw_rows = match &config.source {
        ImportSource::Csv { path } => parse_csv(path)?,
        ImportSource::Excel { path, sheet } => parse_excel(path, sheet.as_deref())?,
    };

    if raw_rows.is_empty() {
        return Ok((Vec::new(), Vec::new()));
    }

    let headers = &raw_rows[0];
    let mapping = build_column_mapping(headers, &config.column_mappings, schema);

    let mut records = Vec::new();
    let mut errors = Vec::new();

    for (row_idx, row) in raw_rows.iter().skip(1).enumerate() {
        let row_num = row_idx + 2; // 1-indexed, skip header

        let id = if let Some(id_col) = &config.id_column {
            if let Some(col_idx) = headers.iter().position(|h| h == id_col) {
                row.get(col_idx)
                    .filter(|v| !v.is_empty())
                    .cloned()
                    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string())
            } else {
                errors.push(ImportError {
                    row: row_num,
                    column: Some(id_col.clone()),
                    message: format!("ID column '{}' not found in headers", id_col),
                });
                continue;
            }
        } else {
            uuid::Uuid::new_v4().to_string()
        };

        let mut values = HashMap::new();
        let mut row_has_error = false;

        for (col_idx, field_name) in &mapping {
            let raw_value = row.get(*col_idx).map(|s| s.as_str()).unwrap_or("");

            if let Some(field) = schema.fields.iter().find(|f| &f.name == field_name) {
                match parse_value(raw_value, &field.field_type) {
                    Ok(v) => {
                        values.insert(field_name.clone(), v);
                    }
                    Err(msg) => {
                        errors.push(ImportError {
                            row: row_num,
                            column: Some(field_name.clone()),
                            message: msg,
                        });
                        row_has_error = true;
                    }
                }
            }
        }

        if !row_has_error {
            records.push(MasterDataRecord { id, values });
        }
    }

    Ok((records, errors))
}

/// ヘッダー行とカラムマッピング設定からマッピングを構築する
///
/// column_mappings が空の場合、ヘッダー名 == フィールド名で自動マッピング
fn build_column_mapping(
    headers: &[String],
    explicit_mappings: &[ColumnMapping],
    schema: &DataSchema,
) -> Vec<(usize, String)> {
    let mut result = Vec::new();

    if explicit_mappings.is_empty() {
        // 自動マッピング: ヘッダー名がフィールド名と一致するものをマッピング
        for (idx, header) in headers.iter().enumerate() {
            if schema.fields.iter().any(|f| f.name == *header) {
                result.push((idx, header.clone()));
            }
        }
    } else {
        for mapping in explicit_mappings {
            if let Some(idx) = headers.iter().position(|h| h == &mapping.source_column) {
                result.push((idx, mapping.field_name.clone()));
            }
        }
    }

    result
}

/// 文字列値をフィールド型に応じたJSON値に変換する
fn parse_value(raw: &str, field_type: &DataFieldType) -> std::result::Result<serde_json::Value, String> {
    if raw.is_empty() {
        return Ok(serde_json::Value::Null);
    }

    match field_type {
        DataFieldType::Bool => {
            match raw.to_lowercase().as_str() {
                "true" | "1" | "yes" | "on" => Ok(serde_json::Value::Bool(true)),
                "false" | "0" | "no" | "off" => Ok(serde_json::Value::Bool(false)),
                _ => Err(format!("Cannot parse '{}' as bool", raw)),
            }
        }
        DataFieldType::Int => {
            // 浮動小数点表記 "100.0" も整数として許容
            if let Ok(i) = raw.parse::<i64>() {
                Ok(serde_json::json!(i))
            } else if let Ok(f) = raw.parse::<f64>() {
                if f.fract() == 0.0 {
                    Ok(serde_json::json!(f as i64))
                } else {
                    Err(format!("Cannot parse '{}' as int (has fractional part)", raw))
                }
            } else {
                Err(format!("Cannot parse '{}' as int", raw))
            }
        }
        DataFieldType::Float => {
            raw.parse::<f64>()
                .map(|f| serde_json::json!(f))
                .map_err(|_| format!("Cannot parse '{}' as float", raw))
        }
        DataFieldType::String => Ok(serde_json::Value::String(raw.to_string())),
        DataFieldType::Enum { variants } => {
            if variants.contains(&raw.to_string()) {
                Ok(serde_json::Value::String(raw.to_string()))
            } else {
                Err(format!(
                    "Value '{}' is not a valid enum variant. Expected: {:?}",
                    raw, variants
                ))
            }
        }
        DataFieldType::Reference { .. } => {
            Ok(serde_json::Value::String(raw.to_string()))
        }
    }
}

// ── CSV Parser ─────────────────────────────────────

fn parse_csv(path: &str) -> Result<Vec<Vec<String>>> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(ArsError::NotFound(format!("File not found: {}", path)));
    }

    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .from_path(p)
        .map_err(|e| ArsError::Io(std::io::Error::other(e)))?;

    let mut rows = Vec::new();
    for result in reader.records() {
        let record =
            result.map_err(|e| ArsError::Io(std::io::Error::other(e)))?;
        rows.push(record.iter().map(|s| s.to_string()).collect());
    }

    Ok(rows)
}

// ── Excel Parser ───────────────────────────────────

fn parse_excel(path: &str, sheet: Option<&str>) -> Result<Vec<Vec<String>>> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(ArsError::NotFound(format!("File not found: {}", path)));
    }

    let mut workbook: calamine::Xlsx<_> = calamine::open_workbook(p)
        .map_err(|e| ArsError::Storage(format!("Failed to open Excel file: {}", e)))?;

    let sheet_name = if let Some(name) = sheet {
        name.to_string()
    } else {
        workbook
            .sheet_names()
            .first()
            .cloned()
            .ok_or_else(|| ArsError::Storage("Excel file has no sheets".to_string()))?
    };

    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| ArsError::Storage(format!("Failed to read sheet '{}': {}", sheet_name, e)))?;

    let mut rows = Vec::new();
    for row in range.rows() {
        let string_row: Vec<String> = row.iter().map(|c: &calamine::Data| cell_to_string(c)).collect();
        // 空行をスキップ
        if string_row.iter().all(|s: &String| s.is_empty()) {
            continue;
        }
        rows.push(string_row);
    }

    Ok(rows)
}

fn cell_to_string(cell: &calamine::Data) -> String {
    match cell {
        calamine::Data::Empty => String::new(),
        calamine::Data::String(s) => s.clone(),
        calamine::Data::Int(i) => i.to_string(),
        calamine::Data::Float(f) => {
            // 整数値は小数点なしで表示
            if f.fract() == 0.0 {
                (*f as i64).to_string()
            } else {
                f.to_string()
            }
        }
        calamine::Data::Bool(b) => b.to_string(),
        calamine::Data::Error(e) => format!("#ERR:{:?}", e),
        calamine::Data::DateTime(dt) => dt.to_string(),
        calamine::Data::DateTimeIso(s) => s.clone(),
        calamine::Data::DurationIso(s) => s.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ars_core::models::{DataCategory, DataField, FieldConstraint};
    use std::io::Write;

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
                    constraints: vec![FieldConstraint::Required],
                },
                DataField {
                    name: "hp".to_string(),
                    field_type: DataFieldType::Int,
                    default_value: None,
                    description: String::new(),
                    constraints: vec![],
                },
                DataField {
                    name: "speed".to_string(),
                    field_type: DataFieldType::Float,
                    default_value: None,
                    description: String::new(),
                    constraints: vec![],
                },
                DataField {
                    name: "is_boss".to_string(),
                    field_type: DataFieldType::Bool,
                    default_value: None,
                    description: String::new(),
                    constraints: vec![],
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
    fn test_parse_value_bool() {
        let ft = DataFieldType::Bool;
        assert_eq!(parse_value("true", &ft).unwrap(), serde_json::json!(true));
        assert_eq!(parse_value("1", &ft).unwrap(), serde_json::json!(true));
        assert_eq!(parse_value("false", &ft).unwrap(), serde_json::json!(false));
        assert_eq!(parse_value("0", &ft).unwrap(), serde_json::json!(false));
        assert!(parse_value("maybe", &ft).is_err());
    }

    #[test]
    fn test_parse_value_int() {
        let ft = DataFieldType::Int;
        assert_eq!(parse_value("42", &ft).unwrap(), serde_json::json!(42));
        assert_eq!(parse_value("100.0", &ft).unwrap(), serde_json::json!(100));
        assert!(parse_value("3.14", &ft).is_err());
        assert!(parse_value("abc", &ft).is_err());
    }

    #[test]
    fn test_parse_value_float() {
        let ft = DataFieldType::Float;
        assert_eq!(parse_value("3.14", &ft).unwrap(), serde_json::json!(3.14));
        assert_eq!(parse_value("100", &ft).unwrap(), serde_json::json!(100.0));
        assert!(parse_value("abc", &ft).is_err());
    }

    #[test]
    fn test_parse_value_enum() {
        let ft = DataFieldType::Enum {
            variants: vec!["fire".to_string(), "water".to_string()],
        };
        assert_eq!(
            parse_value("fire", &ft).unwrap(),
            serde_json::json!("fire")
        );
        assert!(parse_value("lightning", &ft).is_err());
    }

    #[test]
    fn test_parse_value_empty() {
        let ft = DataFieldType::String;
        assert_eq!(parse_value("", &ft).unwrap(), serde_json::Value::Null);
    }

    #[test]
    fn test_csv_import() {
        let dir = std::env::temp_dir().join("ars_test_csv_import");
        std::fs::create_dir_all(&dir).unwrap();
        let csv_path = dir.join("enemies.csv");

        let mut file = std::fs::File::create(&csv_path).unwrap();
        writeln!(file, "name,hp,speed,is_boss,element").unwrap();
        writeln!(file, "Slime,10,1.5,false,water").unwrap();
        writeln!(file, "Dragon,1000,5.0,true,fire").unwrap();
        writeln!(file, "Golem,500,0.5,false,earth").unwrap();
        drop(file);

        let schema = sample_schema();
        let config = ImportConfig {
            source: ImportSource::Csv {
                path: csv_path.to_string_lossy().to_string(),
            },
            schema_id: "enemy".to_string(),
            column_mappings: vec![], // auto-mapping
            id_column: None,
        };

        let (records, errors) = parse_import(&config, &schema).unwrap();
        assert!(errors.is_empty(), "Errors: {:?}", errors);
        assert_eq!(records.len(), 3);

        assert_eq!(records[0].values["name"], serde_json::json!("Slime"));
        assert_eq!(records[0].values["hp"], serde_json::json!(10));
        assert_eq!(records[0].values["speed"], serde_json::json!(1.5));
        assert_eq!(records[0].values["is_boss"], serde_json::json!(false));
        assert_eq!(records[0].values["element"], serde_json::json!("water"));

        assert_eq!(records[1].values["name"], serde_json::json!("Dragon"));
        assert_eq!(records[1].values["is_boss"], serde_json::json!(true));

        // cleanup
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_csv_import_with_column_mapping() {
        let dir = std::env::temp_dir().join("ars_test_csv_mapping");
        std::fs::create_dir_all(&dir).unwrap();
        let csv_path = dir.join("enemies_jp.csv");

        let mut file = std::fs::File::create(&csv_path).unwrap();
        writeln!(file, "ID,名前,体力,属性").unwrap();
        writeln!(file, "slime,スライム,10,water").unwrap();
        writeln!(file, "dragon,ドラゴン,1000,fire").unwrap();
        drop(file);

        let schema = sample_schema();
        let config = ImportConfig {
            source: ImportSource::Csv {
                path: csv_path.to_string_lossy().to_string(),
            },
            schema_id: "enemy".to_string(),
            column_mappings: vec![
                ColumnMapping {
                    source_column: "名前".to_string(),
                    field_name: "name".to_string(),
                },
                ColumnMapping {
                    source_column: "体力".to_string(),
                    field_name: "hp".to_string(),
                },
                ColumnMapping {
                    source_column: "属性".to_string(),
                    field_name: "element".to_string(),
                },
            ],
            id_column: Some("ID".to_string()),
        };

        let (records, errors) = parse_import(&config, &schema).unwrap();
        assert!(errors.is_empty(), "Errors: {:?}", errors);
        assert_eq!(records.len(), 2);

        assert_eq!(records[0].id, "slime");
        assert_eq!(records[0].values["name"], serde_json::json!("スライム"));
        assert_eq!(records[0].values["hp"], serde_json::json!(10));

        assert_eq!(records[1].id, "dragon");
        assert_eq!(records[1].values["name"], serde_json::json!("ドラゴン"));

        // cleanup
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_csv_import_with_errors() {
        let dir = std::env::temp_dir().join("ars_test_csv_errors");
        std::fs::create_dir_all(&dir).unwrap();
        let csv_path = dir.join("bad_enemies.csv");

        let mut file = std::fs::File::create(&csv_path).unwrap();
        writeln!(file, "name,hp,element").unwrap();
        writeln!(file, "Slime,abc,water").unwrap(); // bad hp
        writeln!(file, "Dragon,1000,fire").unwrap(); // OK
        drop(file);

        let schema = sample_schema();
        let config = ImportConfig {
            source: ImportSource::Csv {
                path: csv_path.to_string_lossy().to_string(),
            },
            schema_id: "enemy".to_string(),
            column_mappings: vec![],
            id_column: None,
        };

        let (records, errors) = parse_import(&config, &schema).unwrap();
        assert_eq!(records.len(), 1); // Dragon only
        assert_eq!(errors.len(), 1); // Slime's hp error
        assert_eq!(errors[0].row, 2); // row 2 (1-indexed, skip header)
        assert_eq!(errors[0].column.as_deref(), Some("hp"));

        // cleanup
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_file_not_found() {
        let schema = sample_schema();
        let config = ImportConfig {
            source: ImportSource::Csv {
                path: "/nonexistent/file.csv".to_string(),
            },
            schema_id: "enemy".to_string(),
            column_mappings: vec![],
            id_column: None,
        };

        let result = parse_import(&config, &schema);
        assert!(result.is_err());
    }
}
