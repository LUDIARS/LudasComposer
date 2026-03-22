use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Milestone {
    pub number: u64,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    pub open_issues: u64,
    pub closed_issues: u64,
    pub due_on: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl Milestone {
    pub fn total_issues(&self) -> u64 {
        self.open_issues + self.closed_issues
    }

    pub fn progress_percent(&self) -> f64 {
        let total = self.total_issues();
        if total == 0 {
            return 0.0;
        }
        (self.closed_issues as f64 / total as f64) * 100.0
    }

    pub fn from_github_json(value: &serde_json::Value) -> Option<Self> {
        Some(Milestone {
            number: value.get("number")?.as_u64()?,
            title: value.get("title")?.as_str()?.to_string(),
            description: value
                .get("description")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            state: value
                .get("state")
                .and_then(|v| v.as_str())
                .unwrap_or("open")
                .to_string(),
            open_issues: value
                .get("open_issues")
                .and_then(|v| v.as_u64())
                .unwrap_or(0),
            closed_issues: value
                .get("closed_issues")
                .and_then(|v| v.as_u64())
                .unwrap_or(0),
            due_on: value
                .get("due_on")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            created_at: value
                .get("created_at")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            updated_at: value
                .get("updated_at")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        })
    }
}
