/**
 * モジュールレジストリ Zustand ストア
 * GitHubリポジトリからのモジュール定義の取得・管理・アクターへのアタッチを担当
 */
import { create } from 'zustand';
import type {
  ModuleCategory,
  ModuleDefinition,
  ModuleRegistrySource,
} from '../types/module-registry';
import * as api from '../services/module-registry-api';

interface ModuleRegistryState {
  // === データ ===
  sources: ModuleRegistrySource[];
  modules: ModuleDefinition[];

  // === UI状態 ===
  isLoading: boolean;
  isSyncing: Record<string, boolean>; // sourceId -> syncing status
  error: string | null;
  searchQuery: string;
  categoryFilter: ModuleCategory | null;

  // === アクション: ソース管理 ===
  /** GitHubリポジトリをソースとして追加 */
  addSource: (
    name: string,
    repoUrl: string,
    definitionGlob?: string
  ) => Promise<void>;
  /** ソースを削除 */
  removeSource: (sourceId: string) => Promise<void>;
  /** 指定ソースを同期（clone/pull + パース） */
  syncSource: (sourceId: string) => Promise<void>;
  /** 全ソースを同期 */
  syncAll: () => Promise<void>;

  // === アクション: モジュール取得 ===
  /** 初期ロード（保存済みレジストリを読み込み） */
  loadRegistry: () => Promise<void>;
  /** 検索クエリを設定 */
  setSearchQuery: (query: string) => void;
  /** カテゴリフィルタを設定 */
  setCategoryFilter: (category: ModuleCategory | null) => void;

  // === 算出値 ===
  /** フィルタ済みモジュール一覧 */
  filteredModules: () => ModuleDefinition[];
}

export const useModuleRegistryStore = create<ModuleRegistryState>(
  (set, get) => ({
    // 初期状態
    sources: [],
    modules: [],
    isLoading: false,
    isSyncing: {},
    error: null,
    searchQuery: '',
    categoryFilter: null,

    // ソース追加
    addSource: async (name, repoUrl, definitionGlob) => {
      set({ isLoading: true, error: null });
      try {
        const result = await api.addRegistrySource({
          name,
          repo_url: repoUrl,
          definition_glob: definitionGlob,
        });
        if (result.success && result.data) {
          set((state) => ({
            sources: [...state.sources, result.data!],
            isLoading: false,
          }));
        } else {
          set({ error: result.error ?? 'Failed to add source', isLoading: false });
        }
      } catch (e) {
        set({ error: String(e), isLoading: false });
      }
    },

    // ソース削除
    removeSource: async (sourceId) => {
      set({ isLoading: true, error: null });
      try {
        const result = await api.removeRegistrySource(sourceId);
        if (result.success) {
          set((state) => ({
            sources: state.sources.filter((s) => s.id !== sourceId),
            modules: state.modules.filter((m) => m.source_repo !== sourceId),
            isLoading: false,
          }));
        } else {
          set({ error: result.error ?? 'Failed to remove source', isLoading: false });
        }
      } catch (e) {
        set({ error: String(e), isLoading: false });
      }
    },

    // ソース同期
    syncSource: async (sourceId) => {
      set((state) => ({
        isSyncing: { ...state.isSyncing, [sourceId]: true },
        error: null,
      }));
      try {
        const result = await api.syncRegistrySource(sourceId);
        if (result.success && result.data) {
          set((state) => ({
            modules: [
              ...state.modules.filter((m) => m.source_repo !== sourceId),
              ...result.data!,
            ],
            isSyncing: { ...state.isSyncing, [sourceId]: false },
          }));
        } else {
          set((state) => ({
            error: result.error ?? 'Failed to sync source',
            isSyncing: { ...state.isSyncing, [sourceId]: false },
          }));
        }
      } catch (e) {
        set((state) => ({
          error: String(e),
          isSyncing: { ...state.isSyncing, [sourceId]: false },
        }));
      }
    },

    // 全ソース同期
    syncAll: async () => {
      set({ isLoading: true, error: null });
      try {
        const result = await api.syncAllSources();
        if (result.success && result.data) {
          set({ modules: result.data, isLoading: false });
        } else {
          set({ error: result.error ?? 'Failed to sync', isLoading: false });
        }
      } catch (e) {
        set({ error: String(e), isLoading: false });
      }
    },

    // レジストリ読み込み
    loadRegistry: async () => {
      set({ isLoading: true, error: null });
      try {
        const [sourcesResult, modulesResult] = await Promise.all([
          api.getRegistrySources(),
          api.getAllModules(),
        ]);

        set({
          sources: sourcesResult.success ? (sourcesResult.data ?? []) : [],
          modules: modulesResult.success ? (modulesResult.data ?? []) : [],
          isLoading: false,
        });
      } catch (e) {
        set({ error: String(e), isLoading: false });
      }
    },

    // 検索
    setSearchQuery: (query) => set({ searchQuery: query }),
    setCategoryFilter: (category) => set({ categoryFilter: category }),

    // フィルタ済みモジュール
    filteredModules: () => {
      const { modules, searchQuery, categoryFilter } = get();
      let filtered = modules;

      if (categoryFilter) {
        filtered = filtered.filter((m) => m.category === categoryFilter);
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.summary.toLowerCase().includes(q) ||
            m.domain.toLowerCase().includes(q)
        );
      }

      return filtered;
    },
  })
);
