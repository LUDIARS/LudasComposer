use thiserror::Error;

#[derive(Error, Debug)]
pub enum DataOrganizerError {
    #[error("Schema not found: {0}")]
    SchemaNotFound(String),

    #[error("Entry not found: schema={schema_id}, entry={entry_id}")]
    EntryNotFound { schema_id: String, entry_id: String },

    #[error("Field not found: {field} in schema {schema_id}")]
    FieldNotFound { schema_id: String, field: String },

    #[error("Type mismatch: field '{field}' expects {expected}, got {actual}")]
    TypeMismatch {
        field: String,
        expected: String,
        actual: String,
    },

    #[error("Field '{0}' is not exposed (not in whitelist)")]
    FieldNotExposed(String),

    #[error("Cannot write to read-only blackboard")]
    ReadOnly,

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Duplicate ID: {0}")]
    DuplicateId(String),
}
