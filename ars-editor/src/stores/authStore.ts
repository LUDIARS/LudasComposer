import { create } from 'zustand';
import type { User, ProjectSummary, GitRepo, GitProjectInfo } from '@/types/auth';
import * as authApi from '@/lib/auth-api';

interface AuthState {
  user: User | null;
  loading: boolean;
  cloudProjects: ProjectSummary[];
  cloudProjectsLoading: boolean;
  gitRepos: GitRepo[];
  gitReposLoading: boolean;
  localGitProjects: GitProjectInfo[];
  activeGitRepo: string | null;
}

interface AuthActions {
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
  cloudProjects: [],
  cloudProjectsLoading: false,
  gitRepos: [],
  gitReposLoading: false,
  localGitProjects: [],
  activeGitRepo: null,

  fetchUser: async () => {
    set({ loading: true });
    try {
      const user = await authApi.getMe();
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
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
    set({ cloudProjectsLoading: true });
    try {
      const projects = await authApi.listCloudProjects();
      set({ cloudProjects: projects, cloudProjectsLoading: false });
    } catch {
      set({ cloudProjectsLoading: false });
    }
  },

  fetchGitRepos: async () => {
    set({ gitReposLoading: true });
    try {
      const repos = await authApi.listGitRepos();
      set({ gitRepos: repos, gitReposLoading: false });
    } catch {
      set({ gitReposLoading: false });
    }
  },

  fetchLocalGitProjects: async () => {
    try {
      const projects = await authApi.listLocalGitProjects();
      set({ localGitProjects: projects });
    } catch {
      // ignore
    }
  },

  setActiveGitRepo: (repo) => set({ activeGitRepo: repo }),
}));
