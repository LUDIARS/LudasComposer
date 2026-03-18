/**
 * リソースデポ Zustand ストア
 * リソース（フォント、モデル、テクスチャ、モーション、サウンド）の管理を担当
 */
import { create } from 'zustand';
import type {
  Resource,
  ResourceCategory,
  BonePattern,
  MotionGroup,
  TextureGroup,
  ResourceMetadata,
  AtlasConfig,
  CloudStorageConfig,
  CloudReference,
} from '../types/resource-depot';
import * as api from '../services/resource-depot-api';

interface ResourceDepotState {
  // === データ ===
  resources: Resource[];
  bonePatterns: BonePattern[];
  motionGroups: MotionGroup[];
  textureGroups: TextureGroup[];

  // === UI状態 ===
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  categoryFilter: ResourceCategory | null;

  // === アクション: リソース管理 ===
  /** デポの初期ロード */
  loadDepot: () => Promise<void>;
  /** リソースを登録 */
  registerResource: (
    filename: string,
    role: string,
    category: ResourceCategory,
    filePath: string,
    metadata: ResourceMetadata
  ) => Promise<Resource | null>;
  /** リソースを削除 */
  removeResource: (resourceId: string) => Promise<void>;
  /** リソース検索 */
  searchResources: (query: string) => Promise<void>;

  // === アクション: ボーンパターン ===
  /** ボーンパターン登録 */
  registerBonePattern: (pattern: BonePattern) => Promise<void>;
  /** ボーンパターン削除 */
  removeBonePattern: (patternId: string) => Promise<void>;
  /** モデルのボーンパターン自動検出 */
  detectBonePattern: (modelId: string) => Promise<string | null>;

  // === アクション: モーション ===
  /** モデルにモーションをアサイン */
  assignMotions: (modelId: string, motionIds: string[]) => Promise<void>;
  /** モーショングループ作成 */
  createMotionGroup: (
    name: string,
    motionIds: string[],
    bonePatternId?: string
  ) => Promise<MotionGroup | null>;
  /** モーショングループ更新 */
  updateMotionGroup: (group: MotionGroup) => Promise<void>;
  /** モーショングループ削除 */
  removeMotionGroup: (groupId: string) => Promise<void>;

  // === アクション: テクスチャ ===
  /** テクスチャグループ作成 */
  createTextureGroup: (
    name: string,
    textureIds: string[],
    atlasConfig?: AtlasConfig
  ) => Promise<TextureGroup | null>;
  /** テクスチャグループ更新 */
  updateTextureGroup: (group: TextureGroup) => Promise<void>;
  /** テクスチャグループ削除 */
  removeTextureGroup: (groupId: string) => Promise<void>;

  // === アクション: クラウドストレージ ===
  /** クラウドストレージ設定追加 */
  addCloudConfig: (config: CloudStorageConfig) => Promise<void>;
  /** リソースにクラウド参照を設定 */
  setCloudReference: (resourceId: string, cloudRef: CloudReference) => Promise<void>;

  // === フィルタ ===
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category: ResourceCategory | null) => void;

  // === 算出値 ===
  /** フィルタ済みリソース一覧 */
  filteredResources: () => Resource[];
}

export const useResourceDepotStore = create<ResourceDepotState>(
  (set, get) => ({
    // 初期状態
    resources: [],
    bonePatterns: [],
    motionGroups: [],
    textureGroups: [],
    isLoading: false,
    error: null,
    searchQuery: '',
    categoryFilter: null,

    // デポ読み込み
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

    // リソース登録
    registerResource: async (filename, role, category, filePath, metadata) => {
      set({ isLoading: true, error: null });
      try {
        const result = await api.registerResource({
          filename,
          role,
          category,
          file_path: filePath,
          metadata,
        });
        if (result.success && result.data) {
          set((state) => ({
            resources: [...state.resources, result.data!],
            isLoading: false,
          }));
          return result.data;
        } else {
          set({ error: result.error ?? 'Failed to register resource', isLoading: false });
          return null;
        }
      } catch (e) {
        set({ error: String(e), isLoading: false });
        return null;
      }
    },

    // リソース削除
    removeResource: async (resourceId) => {
      set({ isLoading: true, error: null });
      try {
        const result = await api.removeResource(resourceId);
        if (result.success) {
          set((state) => ({
            resources: state.resources.filter((r) => r.id !== resourceId),
            isLoading: false,
          }));
        } else {
          set({ error: result.error ?? 'Failed to remove resource', isLoading: false });
        }
      } catch (e) {
        set({ error: String(e), isLoading: false });
      }
    },

    // リソース検索
    searchResources: async (query) => {
      set({ isLoading: true, error: null });
      try {
        const result = await api.searchResources(query);
        if (result.success && result.data) {
          set({ resources: result.data, isLoading: false });
        } else {
          set({ error: result.error ?? 'Search failed', isLoading: false });
        }
      } catch (e) {
        set({ error: String(e), isLoading: false });
      }
    },

    // ボーンパターン登録
    registerBonePattern: async (pattern) => {
      set({ error: null });
      try {
        const result = await api.registerBonePattern(pattern);
        if (result.success && result.data) {
          set((state) => ({
            bonePatterns: [...state.bonePatterns.filter((p) => p.id !== result.data!.id), result.data!],
          }));
        } else {
          set({ error: result.error ?? 'Failed to register bone pattern' });
        }
      } catch (e) {
        set({ error: String(e) });
      }
    },

    // ボーンパターン削除
    removeBonePattern: async (patternId) => {
      set({ error: null });
      try {
        const result = await api.removeBonePattern(patternId);
        if (result.success) {
          set((state) => ({
            bonePatterns: state.bonePatterns.filter((p) => p.id !== patternId),
          }));
        } else {
          set({ error: result.error ?? 'Failed to remove bone pattern' });
        }
      } catch (e) {
        set({ error: String(e) });
      }
    },

    // ボーンパターン自動検出
    detectBonePattern: async (modelId) => {
      set({ error: null });
      try {
        const result = await api.detectBonePattern(modelId);
        if (result.success) {
          // リロードしてリソースのメタデータを更新
          await get().loadDepot();
          return result.data ?? null;
        } else {
          set({ error: result.error ?? 'Failed to detect bone pattern' });
          return null;
        }
      } catch (e) {
        set({ error: String(e) });
        return null;
      }
    },

    // モーションアサイン
    assignMotions: async (modelId, motionIds) => {
      set({ error: null });
      try {
        const result = await api.assignMotionsToModel({
          model_id: modelId,
          motion_ids: motionIds,
        });
        if (result.success) {
          await get().loadDepot();
        } else {
          set({ error: result.error ?? 'Failed to assign motions' });
        }
      } catch (e) {
        set({ error: String(e) });
      }
    },

    // モーショングループ作成
    createMotionGroup: async (name, motionIds, bonePatternId) => {
      set({ error: null });
      try {
        const result = await api.createMotionGroup({
          name,
          motion_ids: motionIds,
          bone_pattern_id: bonePatternId,
        });
        if (result.success && result.data) {
          set((state) => ({
            motionGroups: [...state.motionGroups, result.data!],
          }));
          return result.data;
        } else {
          set({ error: result.error ?? 'Failed to create motion group' });
          return null;
        }
      } catch (e) {
        set({ error: String(e) });
        return null;
      }
    },

    // モーショングループ更新
    updateMotionGroup: async (group) => {
      set({ error: null });
      try {
        const result = await api.updateMotionGroup(group);
        if (result.success && result.data) {
          set((state) => ({
            motionGroups: state.motionGroups.map((g) =>
              g.id === result.data!.id ? result.data! : g
            ),
          }));
        } else {
          set({ error: result.error ?? 'Failed to update motion group' });
        }
      } catch (e) {
        set({ error: String(e) });
      }
    },

    // モーショングループ削除
    removeMotionGroup: async (groupId) => {
      set({ error: null });
      try {
        const result = await api.removeMotionGroup(groupId);
        if (result.success) {
          set((state) => ({
            motionGroups: state.motionGroups.filter((g) => g.id !== groupId),
          }));
        } else {
          set({ error: result.error ?? 'Failed to remove motion group' });
        }
      } catch (e) {
        set({ error: String(e) });
      }
    },

    // テクスチャグループ作成
    createTextureGroup: async (name, textureIds, atlasConfig) => {
      set({ error: null });
      try {
        const result = await api.createTextureGroup({
          name,
          texture_ids: textureIds,
          atlas_config: atlasConfig,
        });
        if (result.success && result.data) {
          set((state) => ({
            textureGroups: [...state.textureGroups, result.data!],
          }));
          return result.data;
        } else {
          set({ error: result.error ?? 'Failed to create texture group' });
          return null;
        }
      } catch (e) {
        set({ error: String(e) });
        return null;
      }
    },

    // テクスチャグループ更新
    updateTextureGroup: async (group) => {
      set({ error: null });
      try {
        const result = await api.updateTextureGroup(group);
        if (result.success && result.data) {
          set((state) => ({
            textureGroups: state.textureGroups.map((g) =>
              g.id === result.data!.id ? result.data! : g
            ),
          }));
        } else {
          set({ error: result.error ?? 'Failed to update texture group' });
        }
      } catch (e) {
        set({ error: String(e) });
      }
    },

    // テクスチャグループ削除
    removeTextureGroup: async (groupId) => {
      set({ error: null });
      try {
        const result = await api.removeTextureGroup(groupId);
        if (result.success) {
          set((state) => ({
            textureGroups: state.textureGroups.filter((g) => g.id !== groupId),
          }));
        } else {
          set({ error: result.error ?? 'Failed to remove texture group' });
        }
      } catch (e) {
        set({ error: String(e) });
      }
    },

    // クラウドストレージ設定追加
    addCloudConfig: async (config) => {
      set({ error: null });
      try {
        const result = await api.addCloudConfig(config);
        if (!result.success) {
          set({ error: result.error ?? 'Failed to add cloud config' });
        }
      } catch (e) {
        set({ error: String(e) });
      }
    },

    // クラウド参照設定
    setCloudReference: async (resourceId, cloudRef) => {
      set({ error: null });
      try {
        const result = await api.setCloudReference({
          resource_id: resourceId,
          cloud_ref: cloudRef,
        });
        if (result.success) {
          await get().loadDepot();
        } else {
          set({ error: result.error ?? 'Failed to set cloud reference' });
        }
      } catch (e) {
        set({ error: String(e) });
      }
    },

    // フィルタ
    setSearchQuery: (query) => set({ searchQuery: query }),
    setCategoryFilter: (category) => set({ categoryFilter: category }),

    // フィルタ済みリソース
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
