use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub path: String,
    pub title: String,
    pub content: String,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderedDocument {
    pub path: String,
    pub title: String,
    pub html: String,
    pub toc: Vec<TocEntry>,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TocEntry {
    pub level: u32,
    pub title: String,
    pub anchor: String,
}
