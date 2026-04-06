import type { User, ProjectSummary, GitRepo, GitProjectInfo } from '@/types/auth';
import type { Project } from '@/types/domain';

const CERNERE_URL = import.meta.env.VITE_CERNERE_URL ?? 'http://localhost:8080';

// ── Token Management ──────────────────────────────────────

function getAccessToken(): string | null {
  return localStorage.getItem('accessToken');
}

function getRefreshToken(): string | null {
  return localStorage.getItem('refreshToken');
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
}

export function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

// ── API Client ────────────────────────────────────────────

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(url, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getAccessToken()}`;
      res = await fetch(url, { ...options, headers });
    }
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${CERNERE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const data = await res.json() as { accessToken: string; refreshToken: string };
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

// ── Auth API (Cernere) ────────────────────────────────────

export async function getMe(): Promise<User> {
  return fetchJson<User>('/auth/me');
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    await fetch(`${CERNERE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch { /* best-effort */ }
  clearTokens();
}

export function getLoginUrl(): string {
  const redirect = encodeURIComponent(window.location.origin);
  return `${CERNERE_URL}/auth/github/login?redirect=${redirect}`;
}

export function getGoogleAuthUrl(): string {
  const redirect = encodeURIComponent(window.location.origin);
  return `${CERNERE_URL}/auth/google/login?redirect=${redirect}`;
}

// ── Cloud Project APIs ────────────────────────────────────

export async function saveCloudProject(projectId: string, project: Project): Promise<void> {
  await fetchJson('/api/cloud/project/save', {
    method: 'POST',
    body: JSON.stringify({ projectId, project }),
  });
}

export async function loadCloudProject(projectId: string): Promise<Project> {
  return fetchJson<Project>(`/api/cloud/project/load?projectId=${encodeURIComponent(projectId)}`);
}

export async function listCloudProjects(): Promise<ProjectSummary[]> {
  return fetchJson<ProjectSummary[]>('/api/cloud/project/list');
}

export async function deleteCloudProject(projectId: string): Promise<void> {
  await fetchJson(`/api/cloud/project/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
}

// ── Git Project APIs ──────────────────────────────────────

export async function listGitRepos(): Promise<GitRepo[]> {
  return fetchJson<GitRepo[]>('/api/git/repos');
}

export async function createGitRepo(
  name: string,
  description?: string,
  isPrivate?: boolean,
): Promise<GitRepo> {
  return fetchJson<GitRepo>('/api/git/repos', {
    method: 'POST',
    body: JSON.stringify({ name, description, private: isPrivate ?? true }),
  });
}

export async function cloneGitRepo(
  cloneUrl: string,
  fullName: string,
): Promise<GitProjectInfo> {
  return fetchJson<GitProjectInfo>('/api/git/clone', {
    method: 'POST',
    body: JSON.stringify({ cloneUrl, fullName }),
  });
}

export async function loadGitProject(repo: string): Promise<Project | null> {
  return fetchJson<Project | null>(
    `/api/git/project/load?repo=${encodeURIComponent(repo)}`,
  );
}

export async function pushGitProject(
  fullName: string,
  project: Project,
  message?: string,
): Promise<void> {
  await fetchJson('/api/git/push', {
    method: 'POST',
    body: JSON.stringify({ fullName, project, message }),
  });
}

export async function listLocalGitProjects(): Promise<GitProjectInfo[]> {
  return fetchJson<GitProjectInfo[]>('/api/git/projects');
}
