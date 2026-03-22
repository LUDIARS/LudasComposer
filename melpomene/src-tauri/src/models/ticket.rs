use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    Medium,
    High,
    Critical,
}

impl Default for Priority {
    fn default() -> Self {
        Self::Medium
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Category {
    Bug,
    Feature,
    Improvement,
    Question,
}

impl Default for Category {
    fn default() -> Self {
        Self::Bug
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ticket {
    pub id: String,
    pub github_issue_number: Option<u64>,
    pub title: String,
    pub description: String,
    pub priority: Priority,
    pub category: Category,
    pub labels: Vec<String>,
    pub milestone_id: Option<u64>,
    pub scene_name: Option<String>,
    pub object_path: Option<String>,
    pub world_position: Option<[f64; 3]>,
    pub screen_position: Option<[f64; 2]>,
    pub created_at: String,
    pub updated_at: String,
    pub state: String,
    pub author: Option<String>,
    pub assignees: Vec<String>,
    pub comments: Vec<Comment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Comment {
    pub id: u64,
    pub body: String,
    pub user: String,
    pub created_at: String,
    pub updated_at: String,
}

impl Ticket {
    pub fn to_github_body(&self) -> String {
        let mut body = String::new();

        body.push_str(&self.description);
        body.push_str("\n\n---\n");

        if let Some(ref scene) = self.scene_name {
            body.push_str(&format!("**Scene:** {}\n", scene));
        }
        if let Some(ref path) = self.object_path {
            body.push_str(&format!("**Object Path:** {}\n", path));
        }
        if let Some(ref pos) = self.world_position {
            body.push_str(&format!(
                "**World Position:** ({:.2}, {:.2}, {:.2})\n",
                pos[0], pos[1], pos[2]
            ));
        }

        body.push_str(&format!("**Priority:** {:?}\n", self.priority));
        body.push_str(&format!("**Category:** {:?}\n", self.category));

        body
    }

    pub fn from_github_issue(issue: &serde_json::Value) -> Option<Self> {
        let number = issue.get("number")?.as_u64()?;
        let title = issue.get("title")?.as_str()?.to_string();
        let body = issue
            .get("body")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let state = issue
            .get("state")
            .and_then(|v| v.as_str())
            .unwrap_or("open")
            .to_string();
        let created_at = issue
            .get("created_at")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let updated_at = issue
            .get("updated_at")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let author = issue
            .get("user")
            .and_then(|u| u.get("login"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let labels = issue
            .get("labels")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|l| l.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        let assignees = issue
            .get("assignees")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|a| {
                        a.get("login")
                            .and_then(|n| n.as_str())
                            .map(|s| s.to_string())
                    })
                    .collect()
            })
            .unwrap_or_default();

        let milestone_id = issue
            .get("milestone")
            .and_then(|m| m.get("number"))
            .and_then(|n| n.as_u64());

        let (priority, category, scene_name, object_path, world_position) =
            Self::parse_metadata_from_body(&body);

        Some(Ticket {
            id: format!("github-{}", number),
            github_issue_number: Some(number),
            title,
            description: body,
            priority,
            category,
            labels,
            milestone_id,
            scene_name,
            object_path,
            world_position,
            screen_position: None,
            created_at,
            updated_at,
            state,
            author,
            assignees,
            comments: Vec::new(),
        })
    }

    fn parse_metadata_from_body(
        body: &str,
    ) -> (
        Priority,
        Category,
        Option<String>,
        Option<String>,
        Option<[f64; 3]>,
    ) {
        let mut priority = Priority::default();
        let mut category = Category::default();
        let mut scene_name = None;
        let mut object_path = None;
        let mut world_position = None;

        for line in body.lines() {
            let line = line.trim();
            if let Some(val) = line.strip_prefix("**Priority:**") {
                let val = val.trim();
                priority = match val.to_lowercase().as_str() {
                    "low" => Priority::Low,
                    "high" => Priority::High,
                    "critical" => Priority::Critical,
                    _ => Priority::Medium,
                };
            } else if let Some(val) = line.strip_prefix("**Category:**") {
                let val = val.trim();
                category = match val.to_lowercase().as_str() {
                    "feature" => Category::Feature,
                    "improvement" => Category::Improvement,
                    "question" => Category::Question,
                    _ => Category::Bug,
                };
            } else if let Some(val) = line.strip_prefix("**Scene:**") {
                scene_name = Some(val.trim().to_string());
            } else if let Some(val) = line.strip_prefix("**Object Path:**") {
                object_path = Some(val.trim().to_string());
            } else if let Some(val) = line.strip_prefix("**World Position:**") {
                let val = val.trim().trim_start_matches('(').trim_end_matches(')');
                let parts: Vec<f64> = val
                    .split(',')
                    .filter_map(|s| s.trim().parse().ok())
                    .collect();
                if parts.len() == 3 {
                    world_position = Some([parts[0], parts[1], parts[2]]);
                }
            }
        }

        (priority, category, scene_name, object_path, world_position)
    }
}
