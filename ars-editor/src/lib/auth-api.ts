import type { User, ProjectSummary, GitRepo, GitProjectInfo } from '@/types/auth';
import type { Project } from '@/types/domain';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export async function getMe(): Promise<User> {
  return fetchJson<User>('/auth/me');
}

export async function logout(): Promise<void> {
  await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
}

export function getLoginUrl(): string {
  return '/auth/github/login';
}

/**
 * OAuth ログインをポップアップウィンドウで開く。
 * メインウィンドウのページ遷移を発生させないため、WebSocket 接続が維持される。
 */
export function openOAuthPopup(): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      '/auth/github/login',
      'ars-oauth',
      `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );

    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'ars-oauth-callback') {
        window.removeEventListener('message', handler);
        clearInterval(timer);
        resolve({ success: event.data.success });
      }
    };
    window.addEventListener('message', handler);

    // ポップアップが閉じられた場合のフォールバック
    const timer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(timer);
        window.removeEventListener('message', handler);
        resolve({ success: false });
      }
    }, 500);
  });
}

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

// ========== Git project management APIs ==========

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
