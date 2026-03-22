pub mod models;
pub mod services;

#[cfg(feature = "tauri-app")]
pub mod commands;

#[cfg(feature = "web-server")]
pub mod web_server;

#[cfg(feature = "tauri-app")]
pub fn run() {
    use commands::issues::{IssuesState, MelpomeneState};
    use commands::notifications::{MelpomeneNotificationState, NotificationManagerState};
    use models::config::MelpomeneConfig;
    use services::cache::TicketCache;
    use services::github_client::GitHubClient;
    use services::notification::NotificationService;
    use std::sync::Mutex;

    let config = MelpomeneConfig::load();
    let cache_duration = config.cache_duration_minutes;

    let client = GitHubClient::new(config.clone()).unwrap_or_else(|e| {
        eprintln!("Warning: GitHub client init failed: {}", e);
        // Create with default config - will fail on API calls but won't crash
        GitHubClient::new(MelpomeneConfig {
            repository_owner: "placeholder".to_string(),
            repository_name: "placeholder".to_string(),
            ..config.clone()
        })
        .expect("Failed to create fallback client")
    });

    let notification_client = GitHubClient::new(config).unwrap_or_else(|e| {
        eprintln!("Warning: Notification client init failed: {}", e);
        GitHubClient::new(MelpomeneConfig::default()).expect("Failed to create fallback client")
    });

    tauri::Builder::default()
        .manage(MelpomeneState(Mutex::new(IssuesState {
            client,
            cache: TicketCache::new(cache_duration),
        })))
        .manage(MelpomeneNotificationState(Mutex::new(
            NotificationManagerState {
                client: notification_client,
                service: NotificationService::new(),
            },
        )))
        .invoke_handler(tauri::generate_handler![
            // Issues
            commands::issues::fetch_issues,
            commands::issues::fetch_issue,
            commands::issues::create_issue,
            commands::issues::update_issue,
            commands::issues::close_issue,
            commands::issues::post_comment,
            commands::issues::fetch_comments,
            commands::issues::get_issues_by_scene,
            commands::issues::get_issues_near_position,
            commands::issues::get_cache_stats,
            // Notifications
            commands::notifications::poll_notifications,
            commands::notifications::fetch_pull_requests,
            commands::notifications::fetch_reviews,
            commands::notifications::fetch_workflow_runs,
            // Milestones
            commands::milestones::fetch_milestones,
            commands::milestones::create_milestone,
            // Config
            commands::config::get_config,
            commands::config::update_config,
            commands::config::is_configured,
        ])
        .run(tauri::generate_context!())
        .expect("error while running melpomene");
}
