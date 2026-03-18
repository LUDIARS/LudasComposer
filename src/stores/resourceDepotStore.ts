/**
 * リソースデポ リードオンリー Zustand ストア
 * Resource Depot ツールが管理するデータをリードオンリーで参照する。
 * Ars / Ars-Editor はこのストア経由でリソースデータにアクセスする。
 */
import { create } from 'zustand';
import type {
  Resource,
  ResourceCategory,
  BonePattern,
  MotionGroup,
  TextureGroup,
} from '../types/resource-depot';
import * as api from '../services/resource-depot-api';

interface ResourceDepotState {
  // === データ（リードオンリー） ===
  resources: Resource[];
  bonePatterns: BonePattern[];
  motionGroups: MotionGroup[];
  textureGroups: TextureGroup[];

  // === UI状態 ===
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  categoryFilter: ResourceCategory | null;

  // === アクション ===
  /** デポの初期ロード */
  loadDepot: () => Promise<void>;
  /** デポデータを再読み込み（ツール側の更新を反映） */
  reloadDepot: () => Promise<void>;

  // === フィルタ ===
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category: ResourceCategory | null) => void;

  // === 算出値 ===
  filteredResources: () => Resource[];
}

export const useResourceDepotStore = create<ResourceDepotState>(
  (set, get) => ({
    resources: [],
    bonePatterns: [],
    motionGroups: [],
    textureGroups: [],
    isLoading: false,
    error: null,
    searchQuery: '',
    categoryFilter: null,

    loadDepot: async () => {
      set({ isLoading: true, error: null });
      try {
        const [resourcesResult, patternsResult, motionGroupsResult, textureGroupsResult] =
          await Promise.all([
            api.getAllResources(),
            api.getBonePatterns(),
            api.getMotionGroups(),
            api.getTextureGroups(),
          ]);

        set({
          resources: resourcesResult.success ? (resourcesResult.data ?? []) : [],
          bonePatterns: patternsResult.success ? (patternsResult.data ?? []) : [],
          motionGroups: motionGroupsResult.success ? (motionGroupsResult.data ?? []) : [],
          textureGroups: textureGroupsResult.success ? (textureGroupsResult.data ?? []) : [],
          isLoading: false,
        });
      } catch (e) {
        set({ error: String(e), isLoading: false });
      }
    },

    reloadDepot: async () => {
      set({ isLoading: true, error: null });
      try {
        await api.reloadDepot();
        await get().loadDepot();
      } catch (e) {
        set({ error: String(e), isLoading: false });
      }
    },

    setSearchQuery: (query) => set({ searchQuery: query }),
    setCategoryFilter: (category) => set({ categoryFilter: category }),

    filteredResources: () => {
      const { resources, searchQuery, categoryFilter } = get();
      let filtered = resources;

      if (categoryFilter) {
        filtered = filtered.filter((r) => r.category === categoryFilter);
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.filename.toLowerCase().includes(q) ||
            r.role.toLowerCase().includes(q)
        );
      }

      return filtered;
    },
  })
);
