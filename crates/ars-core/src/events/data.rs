use crate::event::ArsEvent;

/// データスキーマが変更された
#[derive(Debug, Clone)]
pub struct DataSchemaChanged {
    pub project_id: String,
    pub schema_id: String,
}

impl ArsEvent for DataSchemaChanged {
    fn source_module(&self) -> &'static str { "data-organizer" }
    fn category(&self) -> &'static str { "data.schema" }
}

/// マスターデータが更新された
#[derive(Debug, Clone)]
pub struct MasterDataUpdated {
    pub project_id: String,
    pub table_id: String,
}

impl ArsEvent for MasterDataUpdated {
    fn source_module(&self) -> &'static str { "data-organizer" }
    fn category(&self) -> &'static str { "data.master" }
}

/// マスターデータがインポートされた
#[derive(Debug, Clone)]
pub struct MasterDataImported {
    pub project_id: String,
    pub table_id: String,
    pub records_imported: usize,
}

impl ArsEvent for MasterDataImported {
    fn source_module(&self) -> &'static str { "data-organizer" }
    fn category(&self) -> &'static str { "data.import" }
}
