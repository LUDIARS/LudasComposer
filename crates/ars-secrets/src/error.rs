use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum SecretsError {
    #[error("Config file not found: {0}")]
    ConfigNotFound(PathBuf),

    #[error("Config parse error: {0}")]
    ConfigParse(#[from] toml::de::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Authentication failed: {0}")]
    AuthFailed(String),

    #[error("Secret not found: {key} (scope={scope})")]
    SecretNotFound { key: String, scope: String },

    #[error("API error: {status} {message}")]
    ApiError { status: u16, message: String },

    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Provider configuration missing: {0}")]
    ProviderConfigMissing(String),
}
