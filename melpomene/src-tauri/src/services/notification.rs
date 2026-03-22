use crate::models::github::{PullRequest, WorkflowRun};
use crate::services::github_client::GitHubClient;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct NotificationState {
    pub pull_requests: Vec<PullRequest>,
    pub workflow_runs: Vec<WorkflowRun>,
    pub new_review_detected: bool,
    pub workflow_status_changed: bool,
}

pub struct NotificationService {
    previous_pr_review_counts: std::collections::HashMap<u64, u64>,
    previous_workflow_statuses: std::collections::HashMap<u64, String>,
}

impl NotificationService {
    pub fn new() -> Self {
        Self {
            previous_pr_review_counts: std::collections::HashMap::new(),
            previous_workflow_statuses: std::collections::HashMap::new(),
        }
    }

    pub async fn poll(&mut self, client: &GitHubClient) -> Result<NotificationState, String> {
        let prs = client
            .fetch_pull_requests(Some("open"))
            .await
            .map_err(|e| e.to_string())?;

        let workflows = client
            .fetch_workflow_runs()
            .await
            .map_err(|e| e.to_string())?;

        let mut new_review_detected = false;
        for pr in &prs {
            if let Some(&prev_count) = self.previous_pr_review_counts.get(&pr.number) {
                if pr.review_count > prev_count {
                    new_review_detected = true;
                }
            }
            self.previous_pr_review_counts
                .insert(pr.number, pr.review_count);
        }

        let mut workflow_status_changed = false;
        for run in &workflows {
            if let Some(prev_status) = self.previous_workflow_statuses.get(&run.id) {
                if *prev_status != run.status {
                    workflow_status_changed = true;
                }
            }
            self.previous_workflow_statuses
                .insert(run.id, run.status.clone());
        }

        Ok(NotificationState {
            pull_requests: prs,
            workflow_runs: workflows,
            new_review_detected,
            workflow_status_changed,
        })
    }
}

impl Default for NotificationService {
    fn default() -> Self {
        Self::new()
    }
}
