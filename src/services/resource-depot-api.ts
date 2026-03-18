/**
 * リソースデポ Tauri コマンドバインディング
 * Rust側の commands/resource_depot.rs と対応
 */
import { invoke } from '@tauri-apps/api/core';
import type {
  Resource,
  ResourceCategory,
  ResourceDepot,
  BonePattern,
  MotionGroup,
  TextureGroup,
  CloudStorageConfig,
  CloudReference,
  ResourceMetadata,
  AtlasConfig,
} from '../types/resource-depot';

/** コマンド結果 */
interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── リソース管理 ───

/** リソースを登録 */
export async function registerResource(params: {
  filename: string;
  role: string;
  category: ResourceCategory;
  file_path: string;
  metadata: ResourceMetadata;
}): Promise<CommandResult<Resource>> {
  return invoke('register_resource', { params });
}

/** リソースを削除 */
export async function removeResource(
  resourceId: string
): Promise<CommandResult<void>> {
  return invoke('remove_resource', { resourceId });
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

// ─── ボーンパターン ───

/** ボーンパターン登録 */
export async function registerBonePattern(
  pattern: BonePattern
): Promise<CommandResult<BonePattern>> {
  return invoke('register_bone_pattern', { pattern });
}

/** ボーンパターン削除 */
export async function removeBonePattern(
  patternId: string
): Promise<CommandResult<void>> {
  return invoke('remove_bone_pattern', { patternId });
}

/** 全ボーンパターン取得 */
export async function getBonePatterns(): Promise<CommandResult<BonePattern[]>> {
  return invoke('get_bone_patterns');
}

/** モデルのボーンパターンを自動検出 */
export async function detectBonePattern(
  modelId: string
): Promise<CommandResult<string | null>> {
  return invoke('detect_bone_pattern', { modelId });
}

/** ボーンパターンに適合するモーション検索 */
export async function findCompatibleMotions(
  bonePatternId: string
): Promise<CommandResult<Resource[]>> {
  return invoke('find_compatible_motions', { bonePatternId });
}

// ─── モーション管理 ───

/** モデルにモーションをアサイン */
export async function assignMotionsToModel(params: {
  model_id: string;
  motion_ids: string[];
}): Promise<CommandResult<void>> {
  return invoke('assign_motions_to_model', { params });
}

/** モーショングループ作成 */
export async function createMotionGroup(params: {
  name: string;
  motion_ids: string[];
  bone_pattern_id?: string;
}): Promise<CommandResult<MotionGroup>> {
  return invoke('create_motion_group', { params });
}

/** モーショングループ更新 */
export async function updateMotionGroup(
  group: MotionGroup
): Promise<CommandResult<MotionGroup>> {
  return invoke('update_motion_group', { group });
}

/** モーショングループ削除 */
export async function removeMotionGroup(
  groupId: string
): Promise<CommandResult<void>> {
  return invoke('remove_motion_group', { groupId });
}

/** 全モーショングループ取得 */
export async function getMotionGroups(): Promise<CommandResult<MotionGroup[]>> {
  return invoke('get_motion_groups');
}

// ─── テクスチャ管理 ───

/** テクスチャグループ作成 */
export async function createTextureGroup(params: {
  name: string;
  texture_ids: string[];
  atlas_config?: AtlasConfig;
}): Promise<CommandResult<TextureGroup>> {
  return invoke('create_texture_group', { params });
}

/** テクスチャグループ更新 */
export async function updateTextureGroup(
  group: TextureGroup
): Promise<CommandResult<TextureGroup>> {
  return invoke('update_texture_group', { group });
}

/** テクスチャグループ削除 */
export async function removeTextureGroup(
  groupId: string
): Promise<CommandResult<void>> {
  return invoke('remove_texture_group', { groupId });
}

/** 全テクスチャグループ取得 */
export async function getTextureGroups(): Promise<CommandResult<TextureGroup[]>> {
  return invoke('get_texture_groups');
}

// ─── クラウドストレージ ───

/** クラウドストレージ設定追加 */
export async function addCloudConfig(
  config: CloudStorageConfig
): Promise<CommandResult<void>> {
  return invoke('add_cloud_config', { config });
}

/** リソースにクラウド参照を設定 */
export async function setCloudReference(params: {
  resource_id: string;
  cloud_ref: CloudReference;
}): Promise<CommandResult<void>> {
  return invoke('set_cloud_reference', { params });
}

// ─── 共通リソース発見 ───

/** 重複リソースを検出 */
export async function findDuplicateResources(): Promise<
  CommandResult<Record<string, string[]>>
> {
  return invoke('find_duplicate_resources');
}

/** デポ全体の状態を取得 */
export async function getDepotState(): Promise<CommandResult<ResourceDepot>> {
  return invoke('get_depot_state');
}
