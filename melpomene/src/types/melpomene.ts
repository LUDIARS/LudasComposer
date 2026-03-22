export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type Category = 'bug' | 'feature' | 'improvement' | 'question';

export interface Ticket {
  id: string;
  github_issue_number: number | null;
  title: string;
  description: string;
  priority: Priority;
  category: Category;
  labels: string[];
  milestone_id: number | null;
  scene_name: string | null;
  object_path: string | null;
  world_position: [number, number, number] | null;
  screen_position: [number, number] | null;
  created_at: string;
  updated_at: string;
  state: string;
  author: string | null;
  assignees: string[];
  comments: Comment[];
}

export interface Comment {
  id: number;
  body: string;
  user: string;
  created_at: string;
  updated_at: string;
}

export interface MelpomeneConfig {
  repository_owner: string;
  repository_name: string;
  default_labels: string[];
  default_priority: string;
  default_category: string;
  cache_duration_minutes: number;
  github_token?: string;
}

export interface Milestone {
  number: number;
  title: string;
  description: string | null;
  state: string;
  open_issues: number;
  closed_issues: number;
  due_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface PullRequest {
  number: number;
  title: string;
  state: string;
  html_url: string;
  head_ref: string;
  base_ref: string;
  mergeable: boolean | null;
  user: string;
  created_at: string;
  updated_at: string;
  review_count: number;
  reviews: Review[];
}

export interface Review {
  id: number;
  state: string;
  body: string | null;
  user: string;
  submitted_at: string;
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  head_branch: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationState {
  pull_requests: PullRequest[];
  workflow_runs: WorkflowRun[];
  new_review_detected: boolean;
  workflow_status_changed: boolean;
}

export interface CacheStats {
  total: number;
  open: number;
  closed: number;
  is_expired: boolean;
}
