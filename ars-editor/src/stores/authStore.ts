import { create } from 'zustand';
import type { User, ProjectSummary, GitRepo, GitProjectInfo } from '@/types/auth';
import * as authApi from '@/lib/auth-api';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  cloudProjects: ProjectSummary[];
  cloudProjectsLoading: boolean;
  gitRepos: GitRepo[];
  gitReposLoading: boolean;
  localGitProjects: GitProjectInfo[];
  activeGitRepo: string | null;
}

interface AuthActions {
  initAuth: () => Promise<void>;
  fetchUser: () => Promise<void>;
  logout: () => Promise<void>;
  fetchCloudProjects: () => Promise<void>;
  fetchGitRepos: () => Promise<void>;
  fetchLocalGitProjects: () => Promise<void>;
  setActiveGitRepo: (repo: string | null) => void;
}

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  user: null,
  loading: true,
  error: null,
  cloudProjects: [],
  cloudProjectsLoading: false,
  gitRepos: [],
  gitReposLoading: false,
  localGitProjects: [],
  activeGitRepo: null,

  initAuth: async () => {
    // Cernere OAuth コールバック: URL パラメータからトークンを取得
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (accessToken && refreshToken) {
      authApi.setTokens(accessToken, refreshToken);
      window.history.replaceState({}, '', window.location.pathname);
    }

    // セッション検証
    set({ loading: true, error: null });
    try {
      const user = await authApi.getMe();
      set({ user, loading: false });
    } catch {
      authApi.clearTokens();
      set({ user: null, loading: false });
    }
  },

  fetchUser: async () => {
    set({ loading: true, error: null });
    try {
      const user = await authApi.getMe();
      set({ user, loading: false });
    } catch (e) {
      set({ user: null, loading: false, error: e instanceof Error ? e.message : 'Failed to fetch user' });
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    set({ user: null, gitRepos: [], localGitProjects: [], activeGitRepo: null });
  },

  fetchCloudProjects: async () => {
    set({ cloudProjectsLoading: true, error: null });
    try {
      const projects = await authApi.listCloudProjects();
      set({ cloudProjects: projects, cloudProjectsLoading: false });
    } catch (e) {
      set({ cloudProjectsLoading: false, error: e instanceof Error ? e.message : 'Failed to fetch cloud projects' });
    }
  },

  fetchGitRepos: async () => {
    set({ gitReposLoading: true, error: null });
    try {
      const repos = await authApi.listGitRepos();
      set({ gitRepos: repos, gitReposLoading: false });
    } catch (e) {
      set({ gitReposLoading: false, error: e instanceof Error ? e.message : 'Failed to fetch git repos' });
    }
  },

  fetchLocalGitProjects: async () => {
    try {
      const projects = await authApi.listLocalGitProjects();
      set({ localGitProjects: projects });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to fetch local git projects' });
    }
  },

  setActiveGitRepo: (repo) => set({ activeGitRepo: repo }),
}));
