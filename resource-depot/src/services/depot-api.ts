/**
 * リソースデポ Tauri コマンドバインディング（ツール用・フルアクセス）
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

interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── リソース管理 ───

export async function registerResource(params: {
  original_filename: string;
  english_filename: string;
  role: string;
  category: ResourceCategory;
  file_path: string;
  metadata: ResourceMetadata;
}): Promise<CommandResult<Resource>> {
  return invoke('register_resource', { params });
}

export async function removeResource(resourceId: string): Promise<CommandResult<void>> {
  return invoke('remove_resource', { resourceId });
}

export async function getAllResources(): Promise<CommandResult<Resource[]>> {
  return invoke('get_all_resources');
}

export async function getResourcesByCategory(category: ResourceCategory): Promise<CommandResult<Resource[]>> {
  return invoke('get_resources_by_category', { category });
}

export async function searchResources(query: string): Promise<CommandResult<Resource[]>> {
  return invoke('search_resources', { query });
}

export async function getResourceById(resourceId: string): Promise<CommandResult<Resource>> {
  return invoke('get_resource_by_id', { resourceId });
}

// ─── ボーンパターン ───

export async function registerBonePattern(pattern: BonePattern): Promise<CommandResult<BonePattern>> {
  return invoke('register_bone_pattern', { pattern });
}

export async function removeBonePattern(patternId: string): Promise<CommandResult<void>> {
  return invoke('remove_bone_pattern', { patternId });
}

export async function getBonePatterns(): Promise<CommandResult<BonePattern[]>> {
  return invoke('get_bone_patterns');
}

export async function detectBonePattern(modelId: string): Promise<CommandResult<string | null>> {
  return invoke('detect_bone_pattern', { modelId });
}

export async function findCompatibleMotions(bonePatternId: string): Promise<CommandResult<Resource[]>> {
  return invoke('find_compatible_motions', { bonePatternId });
}

// ─── モーション ───

export async function assignMotionsToModel(params: {
  model_id: string;
  motion_ids: string[];
}): Promise<CommandResult<void>> {
  return invoke('assign_motions_to_model', { params });
}

export async function createMotionGroup(params: {
  name: string;
  motion_ids: string[];
  bone_pattern_id?: string;
}): Promise<CommandResult<MotionGroup>> {
  return invoke('create_motion_group', { params });
}

export async function updateMotionGroup(group: MotionGroup): Promise<CommandResult<MotionGroup>> {
  return invoke('update_motion_group', { group });
}

export async function removeMotionGroup(groupId: string): Promise<CommandResult<void>> {
  return invoke('remove_motion_group', { groupId });
}

export async function getMotionGroups(): Promise<CommandResult<MotionGroup[]>> {
  return invoke('get_motion_groups');
}

// ─── テクスチャ ───

export async function createTextureGroup(params: {
  name: string;
  texture_ids: string[];
  atlas_config?: AtlasConfig;
}): Promise<CommandResult<TextureGroup>> {
  return invoke('create_texture_group', { params });
}

export async function updateTextureGroup(group: TextureGroup): Promise<CommandResult<TextureGroup>> {
  return invoke('update_texture_group', { group });
}

export async function removeTextureGroup(groupId: string): Promise<CommandResult<void>> {
  return invoke('remove_texture_group', { groupId });
}

export async function getTextureGroups(): Promise<CommandResult<TextureGroup[]>> {
  return invoke('get_texture_groups');
}

// ─── クラウド ───

export async function addCloudConfig(config: CloudStorageConfig): Promise<CommandResult<void>> {
  return invoke('add_cloud_config', { config });
}

export async function setCloudReference(params: {
  resource_id: string;
  cloud_ref: CloudReference;
}): Promise<CommandResult<void>> {
  return invoke('set_cloud_reference', { params });
}

// ─── その他 ───

export async function findDuplicateResources(): Promise<CommandResult<Record<string, string[]>>> {
  return invoke('find_duplicate_resources');
}

export async function getDepotState(): Promise<CommandResult<ResourceDepot>> {
  return invoke('get_depot_state');
}
