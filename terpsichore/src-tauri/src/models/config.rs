use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ServerRole {
    Worker,
    Watcher,
    Debugger,
}

impl Default for ServerRole {
    fn default() -> Self {
        Self::Worker
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerpsichoreConfig {
    pub port: u16,
    pub enabled: bool,
    #[serde(default)]
    pub token: String,
    #[serde(default)]
    pub role: ServerRole,
    #[serde(default = "default_host")]
    pub host: String,
}

fn default_host() -> String {
    "127.0.0.1".to_string()
}

impl Default for TerpsichoreConfig {
    fn default() -> Self {
        Self {
            port: 8686,
            enabled: true,
            token: String::new(),
            role: ServerRole::Worker,
            host: default_host(),
        }
    }
}

impl TerpsichoreConfig {
    pub fn config_dir() -> PathBuf {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".ars")
            .join("terpsichore")
    }

    pub fn load() -> Self {
        let config_path = Self::config_dir().join("config.json");
        Self::load_from(&config_path)
    }

    pub fn load_from(path: &Path) -> Self {
        match std::fs::read_to_string(path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => Self::default(),
        }
    }

    pub fn save(&self) -> Result<(), std::io::Error> {
        let config_dir = Self::config_dir();
        std::fs::create_dir_all(&config_dir)?;
        let config_path = config_dir.join("config.json");
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        std::fs::write(config_path, content)
    }

    pub fn bind_address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }

    pub fn requires_auth(&self) -> bool {
        !self.token.is_empty()
    }
}
