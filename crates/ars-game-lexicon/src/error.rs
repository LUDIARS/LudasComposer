use thiserror::Error;

use crate::domain::{FeatureId, GenreId, PresetId, TermId};

pub type Result<T> = std::result::Result<T, LexiconError>;

#[derive(Debug, Error)]
pub enum LexiconError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("toml parse error in {path}: {source}")]
    TomlParse {
        path: String,
        #[source]
        source: toml::de::Error,
    },

    #[error("duplicate id: {kind} '{id}'")]
    DuplicateId { kind: &'static str, id: String },

    #[error("unknown genre: {0}")]
    UnknownGenre(GenreId),

    #[error("unknown feature: {0}")]
    UnknownFeature(FeatureId),

    #[error("unknown preset: {0}")]
    UnknownPreset(PresetId),

    #[error("unknown term: {0}")]
    UnknownTerm(TermId),

    #[error("circular dependency at feature: {0}")]
    CircularDependency(FeatureId),

    #[error("invalid parameter range for '{0}': min must be <= max")]
    InvalidRange(String),

    #[error("enum parameter '{0}' has no `values`")]
    EnumWithoutValues(String),

    #[error("validation: {0}")]
    Validation(String),
}
