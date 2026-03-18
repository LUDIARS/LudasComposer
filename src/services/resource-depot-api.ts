/**
 * リソースデポ リードオンリー Tauri コマンドバインディング
 * Ars / Ars-Editor がデポデータを参照するための API
 * 書き込み操作は Resource Depot ツール側で行う
 */
import { invoke } from '@tauri-apps/api/core';
import type {
  Resource,
  ResourceCategory,
  ResourceDepot,
  BonePattern,
  MotionGroup,
  TextureGroup,
} from '../types/resource-depot';

interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** デポデータを再読み込み（ツール側の更新を反映） */
export async function reloadDepot(): Promise<CommandResult<void>> {
  return invoke('reload_depot');
}

/** 全リソース取得 */
export async function getAllResources(): Promise<CommandResult<Resource[]>> {
  return invoke('get_all_resources');
}

/** カテゴリ別リソース取得 */
export async function getResourcesByCategory(
  category: ResourceCategory
): Promise<CommandResult<Resource[]>> {
  return invoke('get_resources_by_category', { category });
}

/** リソース検索 */
export async function searchResources(
  query: string
): Promise<CommandResult<Resource[]>> {
  return invoke('search_resources', { query });
}

/** IDでリソース取得 */
export async function getResourceById(
  resourceId: string
): Promise<CommandResult<Resource>> {
  return invoke('get_resource_by_id', { resourceId });
}

/** 全ボーンパターン取得 */
export async function getBonePatterns(): Promise<CommandResult<BonePattern[]>> {
  return invoke('get_bone_patterns');
}

/** ボーンパターンに適合するモーション検索 */
export async function findCompatibleMotions(
  bonePatternId: string
): Promise<CommandResult<Resource[]>> {
  return invoke('find_compatible_motions', { bonePatternId });
}

/** 全モーショングループ取得 */
export async function getMotionGroups(): Promise<CommandResult<MotionGroup[]>> {
  return invoke('get_motion_groups');
}

/** 全テクスチャグループ取得 */
export async function getTextureGroups(): Promise<CommandResult<TextureGroup[]>> {
  return invoke('get_texture_groups');
}

/** デポ全体の状態を取得 */
export async function getDepotState(): Promise<CommandResult<ResourceDepot>> {
  return invoke('get_depot_state');
}
