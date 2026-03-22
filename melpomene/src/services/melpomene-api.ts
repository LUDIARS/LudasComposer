import type {
  Ticket,
  Comment,
  MelpomeneConfig,
  Milestone,
  PullRequest,
  Review,
  WorkflowRun,
  NotificationState,
  CacheStats,
} from '../types';

type CommandResult<T> = T;

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<CommandResult<T>> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(command, args);
}

// Issues
export async function fetchIssues(forceRefresh = false): Promise<Ticket[]> {
  return invoke<Ticket[]>('fetch_issues', { forceRefresh });
}

export async function fetchIssue(number: number): Promise<Ticket> {
  return invoke<Ticket>('fetch_issue', { number });
}

export async function createIssue(
  title: string,
  body: string,
  labels: string[],
  milestone?: number,
): Promise<Ticket> {
  return invoke<Ticket>('create_issue', { title, body, labels, milestone });
}

export async function updateIssue(
  number: number,
  title?: string,
  body?: string,
  stateVal?: string,
  labels?: string[],
): Promise<Ticket> {
  return invoke<Ticket>('update_issue', { number, title, body, stateVal, labels });
}

export async function closeIssue(number: number): Promise<Ticket> {
  return invoke<Ticket>('close_issue', { number });
}

export async function postComment(issueNumber: number, body: string): Promise<Comment> {
  return invoke<Comment>('post_comment', { issueNumber, body });
}

export async function fetchComments(issueNumber: number): Promise<Comment[]> {
  return invoke<Comment[]>('fetch_comments', { issueNumber });
}

export async function getIssuesByScene(sceneName: string): Promise<Ticket[]> {
  return invoke<Ticket[]>('get_issues_by_scene', { sceneName });
}

export async function getIssuesNearPosition(
  position: [number, number, number],
  radius: number,
): Promise<Ticket[]> {
  return invoke<Ticket[]>('get_issues_near_position', { position, radius });
}

export async function getCacheStats(): Promise<CacheStats> {
  return invoke<CacheStats>('get_cache_stats');
}

// Notifications
export async function pollNotifications(): Promise<NotificationState> {
  return invoke<NotificationState>('poll_notifications');
}

export async function fetchPullRequests(): Promise<PullRequest[]> {
  return invoke<PullRequest[]>('fetch_pull_requests');
}

export async function fetchReviews(prNumber: number): Promise<Review[]> {
  return invoke<Review[]>('fetch_reviews', { prNumber });
}

export async function fetchWorkflowRuns(): Promise<WorkflowRun[]> {
  return invoke<WorkflowRun[]>('fetch_workflow_runs');
}

// Milestones
export async function fetchMilestones(): Promise<Milestone[]> {
  return invoke<Milestone[]>('fetch_milestones');
}

export async function createMilestone(
  title: string,
  description?: string,
  dueOn?: string,
): Promise<Milestone> {
  return invoke<Milestone>('create_milestone', { title, description, dueOn });
}

// Config
export async function getConfig(): Promise<MelpomeneConfig> {
  return invoke<MelpomeneConfig>('get_config');
}

export async function updateConfig(config: MelpomeneConfig): Promise<void> {
  return invoke<void>('update_config', { config });
}

export async function isConfigured(): Promise<boolean> {
  return invoke<boolean>('is_configured');
}
