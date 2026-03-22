use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MelpomeneConfig {
    pub repository_owner: String,
    pub repository_name: String,
    pub default_labels: Vec<String>,
    pub default_priority: String,
    pub default_category: String,
    pub cache_duration_minutes: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub github_token: Option<String>,
}

impl Default for MelpomeneConfig {
    fn default() -> Self {
        Self {
            repository_owner: String::new(),
            repository_name: String::new(),
            default_labels: vec!["melpomene".to_string(), "auto-generated".to_string()],
            default_priority: "Medium".to_string(),
            default_category: "Bug".to_string(),
            cache_duration_minutes: 10,
            github_token: None,
        }
    }
}

impl MelpomeneConfig {
    pub fn config_dir() -> PathBuf {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".ars")
            .join("melpomene")
    }

    pub fn load() -> Self {
        let config_path = Self::config_dir().join("settings.json");
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
        let config_path = config_dir.join("settings.json");
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        std::fs::write(config_path, content)
    }

    pub fn api_base_url(&self) -> String {
        format!(
            "https://api.github.com/repos/{}/{}",
            self.repository_owner, self.repository_name
        )
    }

    pub fn is_configured(&self) -> bool {
        !self.repository_owner.is_empty() && !self.repository_name.is_empty()
    }
}
