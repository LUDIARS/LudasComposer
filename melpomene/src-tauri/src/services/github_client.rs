use crate::models::config::MelpomeneConfig;
use crate::models::github::{PullRequest, Review, WorkflowRun};
use crate::models::milestone::Milestone;
use crate::models::ticket::{Comment, Ticket};
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GitHubError {
    #[error("HTTP request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("JSON parse error: {0}")]
    JsonParse(#[from] serde_json::Error),
    #[error("API error: {status} - {message}")]
    Api { status: u16, message: String },
    #[error("Not configured: {0}")]
    NotConfigured(String),
}

pub struct GitHubClient {
    client: reqwest::Client,
    config: MelpomeneConfig,
}

impl GitHubClient {
    pub fn new(config: MelpomeneConfig) -> Result<Self, GitHubError> {
        if !config.is_configured() {
            return Err(GitHubError::NotConfigured(
                "Repository owner and name must be set".to_string(),
            ));
        }

        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, HeaderValue::from_static("ars-melpomene"));
        headers.insert(
            ACCEPT,
            HeaderValue::from_static("application/vnd.github.v3+json"),
        );

        if let Some(ref token) = config.github_token {
            if !token.is_empty() {
                let auth_value = format!("Bearer {}", token);
                headers.insert(
                    AUTHORIZATION,
                    HeaderValue::from_str(&auth_value)
                        .map_err(|e| GitHubError::NotConfigured(e.to_string()))?,
                );
            }
        }

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .build()?;

        Ok(Self { client, config })
    }

    fn base_url(&self) -> String {
        self.config.api_base_url()
    }

    pub async fn fetch_issues(
        &self,
        state: Option<&str>,
        labels: Option<&[String]>,
        page: u32,
        per_page: u32,
    ) -> Result<Vec<Ticket>, GitHubError> {
        let mut url = format!(
            "{}/issues?page={}&per_page={}",
            self.base_url(),
            page,
            per_page
        );

        if let Some(s) = state {
            url.push_str(&format!("&state={}", s));
        }
        if let Some(l) = labels {
            if !l.is_empty() {
                url.push_str(&format!("&labels={}", l.join(",")));
            }
        }

        let resp = self.client.get(&url).send().await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(GitHubError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let body: serde_json::Value = resp.json().await?;
        let issues = body
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| Ticket::from_github_issue(v))
                    .collect()
            })
            .unwrap_or_default();

        Ok(issues)
    }

    pub async fn fetch_issue(&self, number: u64) -> Result<Ticket, GitHubError> {
        let url = format!("{}/issues/{}", self.base_url(), number);
        let resp = self.client.get(&url).send().await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(GitHubError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let body: serde_json::Value = resp.json().await?;
        Ticket::from_github_issue(&body).ok_or_else(|| GitHubError::Api {
            status: 500,
            message: "Failed to parse issue".to_string(),
        })
    }

    pub async fn create_issue(
        &self,
        title: &str,
        body: &str,
        labels: &[String],
        milestone: Option<u64>,
    ) -> Result<Ticket, GitHubError> {
        let url = format!("{}/issues", self.base_url());

        let mut payload = serde_json::json!({
            "title": title,
            "body": body,
            "labels": labels,
        });

        if let Some(m) = milestone {
            payload["milestone"] = serde_json::json!(m);
        }

        let resp = self.client.post(&url).json(&payload).send().await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(GitHubError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let body: serde_json::Value = resp.json().await?;
        Ticket::from_github_issue(&body).ok_or_else(|| GitHubError::Api {
            status: 500,
            message: "Failed to parse created issue".to_string(),
        })
    }

    pub async fn update_issue(
        &self,
        number: u64,
        title: Option<&str>,
        body: Option<&str>,
        state: Option<&str>,
        labels: Option<&[String]>,
    ) -> Result<Ticket, GitHubError> {
        let url = format!("{}/issues/{}", self.base_url(), number);

        let mut payload = serde_json::Map::new();
        if let Some(t) = title {
            payload.insert("title".to_string(), serde_json::json!(t));
        }
        if let Some(b) = body {
            payload.insert("body".to_string(), serde_json::json!(b));
        }
        if let Some(s) = state {
            payload.insert("state".to_string(), serde_json::json!(s));
        }
        if let Some(l) = labels {
            payload.insert("labels".to_string(), serde_json::json!(l));
        }

        let resp = self
            .client
            .patch(&url)
            .json(&serde_json::Value::Object(payload))
            .send()
            .await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(GitHubError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let body: serde_json::Value = resp.json().await?;
        Ticket::from_github_issue(&body).ok_or_else(|| GitHubError::Api {
            status: 500,
            message: "Failed to parse updated issue".to_string(),
        })
    }

    pub async fn close_issue(&self, number: u64) -> Result<Ticket, GitHubError> {
        self.update_issue(number, None, None, Some("closed"), None)
            .await
    }

    pub async fn fetch_comments(&self, issue_number: u64) -> Result<Vec<Comment>, GitHubError> {
        let url = format!(
            "{}/issues/{}/comments",
            self.base_url(),
            issue_number
        );
        let resp = self.client.get(&url).send().await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(GitHubError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let body: serde_json::Value = resp.json().await?;
        let comments = body
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| {
                        Some(Comment {
                            id: v.get("id")?.as_u64()?,
                            body: v.get("body")?.as_str()?.to_string(),
                            user: v
                                .get("user")
                                .and_then(|u| u.get("login"))
                                .and_then(|l| l.as_str())
                                .unwrap_or("")
                                .to_string(),
                            created_at: v
                                .get("created_at")
                                .and_then(|c| c.as_str())
                                .unwrap_or("")
                                .to_string(),
                            updated_at: v
                                .get("updated_at")
                                .and_then(|u| u.as_str())
                                .unwrap_or("")
                                .to_string(),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(comments)
    }

    pub async fn post_comment(
        &self,
        issue_number: u64,
        body: &str,
    ) -> Result<Comment, GitHubError> {
        let url = format!(
            "{}/issues/{}/comments",
            self.base_url(),
            issue_number
        );
        let payload = serde_json::json!({ "body": body });
        let resp = self.client.post(&url).json(&payload).send().await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(GitHubError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let v: serde_json::Value = resp.json().await?;
        Ok(Comment {
            id: v.get("id").and_then(|i| i.as_u64()).unwrap_or(0),
            body: v
                .get("body")
                .and_then(|b| b.as_str())
                .unwrap_or("")
                .to_string(),
            user: v
                .get("user")
                .and_then(|u| u.get("login"))
                .and_then(|l| l.as_str())
                .unwrap_or("")
                .to_string(),
            created_at: v
                .get("created_at")
                .and_then(|c| c.as_str())
                .unwrap_or("")
                .to_string(),
            updated_at: v
                .get("updated_at")
                .and_then(|u| u.as_str())
                .unwrap_or("")
                .to_string(),
        })
    }

    pub async fn fetch_milestones(&self) -> Result<Vec<Milestone>, GitHubError> {
        let url = format!("{}/milestones?state=all", self.base_url());
        let resp = self.client.get(&url).send().await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(GitHubError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let body: serde_json::Value = resp.json().await?;
        let milestones = body
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| Milestone::from_github_json(v))
                    .collect()
            })
            .unwrap_or_default();

        Ok(milestones)
    }

    pub async fn create_milestone(
        &self,
        title: &str,
        description: Option<&str>,
        due_on: Option<&str>,
    ) -> Result<Milestone, GitHubError> {
        let url = format!("{}/milestones", self.base_url());
        let mut payload = serde_json::json!({ "title": title });
        if let Some(d) = description {
            payload["description"] = serde_json::json!(d);
        }
        if let Some(due) = due_on {
            payload["due_on"] = serde_json::json!(due);
        }

        let resp = self.client.post(&url).json(&payload).send().await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(GitHubError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let body: serde_json::Value = resp.json().await?;
        Milestone::from_github_json(&body).ok_or_else(|| GitHubError::Api {
            status: 500,
            message: "Failed to parse milestone".to_string(),
        })
    }

    pub async fn fetch_pull_requests(
        &self,
        state: Option<&str>,
    ) -> Result<Vec<PullRequest>, GitHubError> {
        let state = state.unwrap_or("open");
        let url = format!("{}/pulls?state={}", self.base_url(), state);
        let resp = self.client.get(&url).send().await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(GitHubError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let body: serde_json::Value = resp.json().await?;
        let prs = body
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| PullRequest::from_github_json(v))
                    .collect()
            })
            .unwrap_or_default();

        Ok(prs)
    }

    pub async fn fetch_reviews(&self, pr_number: u64) -> Result<Vec<Review>, GitHubError> {
        let url = format!("{}/pulls/{}/reviews", self.base_url(), pr_number);
        let resp = self.client.get(&url).send().await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(GitHubError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let body: serde_json::Value = resp.json().await?;
        let reviews = body
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| Review::from_github_json(v))
                    .collect()
            })
            .unwrap_or_default();

        Ok(reviews)
    }

    pub async fn fetch_workflow_runs(&self) -> Result<Vec<WorkflowRun>, GitHubError> {
        let url = format!("{}/actions/runs?per_page=10", self.base_url());
        let resp = self.client.get(&url).send().await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(GitHubError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let body: serde_json::Value = resp.json().await?;
        let runs = body
            .get("workflow_runs")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| WorkflowRun::from_github_json(v))
                    .collect()
            })
            .unwrap_or_default();

        Ok(runs)
    }

    pub async fn fetch_authenticated_user(&self) -> Result<String, GitHubError> {
        let url = "https://api.github.com/user";
        let resp = self.client.get(url).send().await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(GitHubError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let body: serde_json::Value = resp.json().await?;
        body.get("login")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| GitHubError::Api {
                status: 500,
                message: "Failed to get user login".to_string(),
            })
    }
}
