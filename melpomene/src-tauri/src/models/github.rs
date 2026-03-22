use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequest {
    pub number: u64,
    pub title: String,
    pub state: String,
    pub html_url: String,
    pub head_ref: String,
    pub base_ref: String,
    pub mergeable: Option<bool>,
    pub user: String,
    pub created_at: String,
    pub updated_at: String,
    pub review_count: u64,
    pub reviews: Vec<Review>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Review {
    pub id: u64,
    pub state: String,
    pub body: Option<String>,
    pub user: String,
    pub submitted_at: String,
}

impl Review {
    pub fn is_approved(&self) -> bool {
        self.state == "APPROVED"
    }

    pub fn is_changes_requested(&self) -> bool {
        self.state == "CHANGES_REQUESTED"
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowRun {
    pub id: u64,
    pub name: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub html_url: String,
    pub head_branch: String,
    pub created_at: String,
    pub updated_at: String,
}

impl WorkflowRun {
    pub fn is_completed(&self) -> bool {
        self.status == "completed"
    }

    pub fn is_success(&self) -> bool {
        self.conclusion.as_deref() == Some("success")
    }

    pub fn is_failed(&self) -> bool {
        self.conclusion.as_deref() == Some("failure")
    }

    pub fn is_running(&self) -> bool {
        self.status == "in_progress"
    }
}

impl PullRequest {
    pub fn from_github_json(value: &serde_json::Value) -> Option<Self> {
        Some(PullRequest {
            number: value.get("number")?.as_u64()?,
            title: value.get("title")?.as_str()?.to_string(),
            state: value
                .get("state")
                .and_then(|v| v.as_str())
                .unwrap_or("open")
                .to_string(),
            html_url: value
                .get("html_url")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            head_ref: value
                .get("head")
                .and_then(|h| h.get("ref"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            base_ref: value
                .get("base")
                .and_then(|b| b.get("ref"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            mergeable: value.get("mergeable").and_then(|v| v.as_bool()),
            user: value
                .get("user")
                .and_then(|u| u.get("login"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
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
            review_count: 0,
            reviews: Vec::new(),
        })
    }
}

impl Review {
    pub fn from_github_json(value: &serde_json::Value) -> Option<Self> {
        Some(Review {
            id: value.get("id")?.as_u64()?,
            state: value
                .get("state")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            body: value
                .get("body")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            user: value
                .get("user")
                .and_then(|u| u.get("login"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            submitted_at: value
                .get("submitted_at")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        })
    }
}

impl WorkflowRun {
    pub fn from_github_json(value: &serde_json::Value) -> Option<Self> {
        Some(WorkflowRun {
            id: value.get("id")?.as_u64()?,
            name: value.get("name")?.as_str()?.to_string(),
            status: value
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            conclusion: value
                .get("conclusion")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            html_url: value
                .get("html_url")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            head_branch: value
                .get("head_branch")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
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
