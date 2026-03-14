export interface User {
  id: string;
  githubId: number;
  login: string;
  displayName: string;
  avatarUrl: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface GitRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  private: boolean;
  updated_at: string;
}

export interface GitProjectInfo {
  repo_full_name: string;
  branch: string;
  has_project: boolean;
  local_path: string;
}
