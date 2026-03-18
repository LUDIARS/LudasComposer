/**
 * アセンブリ管理 Zustand ストア
 * コアアセンブリとアプリケーションアセンブリの管理を担当
 */
import { create } from 'zustand';
import type {
  CoreAssembly,
  ApplicationAssembly,
  ReleaseDepotConfig,
  ProjectAssemblyConfig,
  ResourceDepotRef,
  DataOrganizerRef,
  CoreAssemblyOrigin,
  AssemblyScope,
} from '../types/assembly';
import * as api from '../services/assembly-api';

interface AssemblyState {
  // === データ ===
  config: ProjectAssemblyConfig | null;

  // === UI状態 ===
  isLoading: boolean;
  error: string | null;

  // === アクション: 初期化 ===
  loadConfig: () => Promise<void>;

  // === アクション: リリースデポ ===
  addReleaseDepot: (name: string, url: string, authToken?: string) => Promise<void>;
  removeReleaseDepot: (name: string) => Promise<void>;

  // === アクション: コアアセンブリ ===
  addCoreAssembly: (assembly: CoreAssembly) => Promise<void>;
  updateCoreAssembly: (assembly: CoreAssembly) => Promise<void>;
  removeCoreAssembly: (id: string) => Promise<void>;

  // === アクション: アプリケーションアセンブリ ===
  addAppAssembly: (assembly: ApplicationAssembly) => Promise<void>;
  updateAppAssembly: (assembly: ApplicationAssembly) => Promise<void>;
  removeAppAssembly: (id: string) => Promise<void>;

  // === アクション: 外部システム参照 ===
  setResourceDepotRef: (ref_: ResourceDepotRef | null) => Promise<void>;
  setDataOrganizerRef: (ref_: DataOrganizerRef | null) => Promise<void>;

  // === 算出値 ===
  getCoreAssembliesByOrigin: (origin: CoreAssemblyOrigin) => CoreAssembly[];
  getAppAssembliesByScope: (scope: AssemblyScope) => ApplicationAssembly[];
  getAppAssembliesByScene: (sceneId: string) => ApplicationAssembly[];
}

export const useAssemblyStore = create<AssemblyState>((set, get) => ({
  config: null,
  isLoading: false,
  error: null,

  loadConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.getAssemblyConfig();
      if (result.success && result.data) {
        set({ config: result.data, isLoading: false });
      } else {
        set({ error: result.error ?? 'Failed to load assembly config', isLoading: false });
      }
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  // リリースデポ
  addReleaseDepot: async (name, url, authToken) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.addReleaseDepot({ name, url, auth_token: authToken });
      if (result.success) {
        await get().loadConfig();
      } else {
        set({ error: result.error ?? 'Failed to add depot', isLoading: false });
      }
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  removeReleaseDepot: async (name) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.removeReleaseDepot(name);
      if (result.success) {
        await get().loadConfig();
      } else {
        set({ error: result.error ?? 'Failed to remove depot', isLoading: false });
      }
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  // コアアセンブリ
  addCoreAssembly: async (assembly) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.addCoreAssembly(assembly);
      if (result.success) {
        await get().loadConfig();
      } else {
        set({ error: result.error ?? 'Failed to add core assembly', isLoading: false });
      }
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  updateCoreAssembly: async (assembly) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.updateCoreAssembly(assembly);
      if (result.success) {
        await get().loadConfig();
      } else {
        set({ error: result.error ?? 'Failed to update core assembly', isLoading: false });
      }
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  removeCoreAssembly: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.removeCoreAssembly(id);
      if (result.success) {
        await get().loadConfig();
      } else {
        set({ error: result.error ?? 'Failed to remove core assembly', isLoading: false });
      }
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  // アプリケーションアセンブリ
  addAppAssembly: async (assembly) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.addAppAssembly(assembly);
      if (result.success) {
        await get().loadConfig();
      } else {
        set({ error: result.error ?? 'Failed to add app assembly', isLoading: false });
      }
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  updateAppAssembly: async (assembly) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.updateAppAssembly(assembly);
      if (result.success) {
        await get().loadConfig();
      } else {
        set({ error: result.error ?? 'Failed to update app assembly', isLoading: false });
      }
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  removeAppAssembly: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.removeAppAssembly(id);
      if (result.success) {
        await get().loadConfig();
      } else {
        set({ error: result.error ?? 'Failed to remove app assembly', isLoading: false });
      }
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  // 外部システム参照
  setResourceDepotRef: async (ref_) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.setResourceDepotRef(ref_);
      if (result.success) {
        await get().loadConfig();
      } else {
        set({ error: result.error ?? 'Failed to set resource depot ref', isLoading: false });
      }
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  setDataOrganizerRef: async (ref_) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.setDataOrganizerRef(ref_);
      if (result.success) {
        await get().loadConfig();
      } else {
        set({ error: result.error ?? 'Failed to set data organizer ref', isLoading: false });
      }
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  // 算出値
  getCoreAssembliesByOrigin: (origin) => {
    const { config } = get();
    if (!config) return [];
    return config.coreAssemblies.filter((a) => a.origin === origin);
  },

  getAppAssembliesByScope: (scope) => {
    const { config } = get();
    if (!config) return [];
    return config.applicationAssemblies.filter((a) => a.scope === scope);
  },

  getAppAssembliesByScene: (sceneId) => {
    const { config } = get();
    if (!config) return [];
    return config.applicationAssemblies.filter((a) => a.sceneId === sceneId);
  },
}));
