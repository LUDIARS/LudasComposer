// === リソースデポ型定義（ツール用・フルアクセス） ===
// src/types/resource-depot.ts の共有型に加え、ツール固有の型を含む

/** リソースカテゴリ */
export type ResourceCategory = 'font' | 'model' | 'texture' | 'motion' | 'sound';

export type ResourceStatus = 'available' | 'downloading' | 'cached' | 'error';

export type CloudProvider = 'google_drive' | 'local';

export interface CloudReference {
  provider: CloudProvider;
  file_id: string;
  share_url?: string;
  last_synced?: string;
}

export type ResourceMetadata =
  | FontMetadata
  | ModelMetadata
  | TextureMetadata
  | MotionMetadata
  | SoundMetadata;

export interface FontMetadata {
  type: 'font';
  family: string;
  style: string;
}

export interface BonePattern {
  id: string;
  name: string;
  required_bones: string[];
  optional_bones: string[];
}

export interface ModelMetadata {
  type: 'model';
  format: string;
  bones: string[];
  bone_pattern_id?: string;
  assigned_motions: string[];
}

export interface TextureGroup {
  id: string;
  name: string;
  texture_ids: string[];
  atlas_config: AtlasConfig;
}

export interface AtlasConfig {
  max_width: number;
  max_height: number;
  padding: number;
}

export interface TextureMetadata {
  type: 'texture';
  format: string;
  width: number;
  height: number;
  group_id?: string;
}

export interface MotionGroup {
  id: string;
  name: string;
  motion_ids: string[];
  random_config?: RandomMotionConfig;
  ik_config?: IKConfig;
  rig_config?: RigConfig;
  bone_pattern_id?: string;
}

export interface RandomMotionConfig {
  weights: number[];
  loop: boolean;
}

export interface IKConfig {
  targets: IKTarget[];
}

export interface IKTarget {
  name: string;
  effector_bone: string;
  chain_length: number;
}

export interface RigConfig {
  mappings: Record<string, string>;
}

export interface MotionMetadata {
  type: 'motion';
  format: string;
  duration: number;
  target_bones: string[];
  bone_pattern_id?: string;
  group_id?: string;
}

export type SoundCategory = 'bgm' | 'se' | 'voice' | 'ambient';

export interface SoundMetadata {
  type: 'sound';
  format: string;
  duration: number;
  sound_id: string;
  sound_category: SoundCategory;
}

export interface Resource {
  id: string;
  filename: string;
  /** 元の日本語ファイル名 */
  original_filename: string;
  role: string;
  category: ResourceCategory;
  size: number;
  hash: string;
  local_path?: string;
  cloud_ref?: CloudReference;
  status: ResourceStatus;
  metadata: ResourceMetadata;
}

export interface CloudStorageConfig {
  provider: CloudProvider;
  credentials?: Record<string, string>;
  root_folder_id?: string;
}

export interface ResourceDepotConfig {
  cache_dir: string;
  cloud_configs: CloudStorageConfig[];
}

export interface ResourceDepot {
  resources: Record<string, Resource>;
  bone_patterns: Record<string, BonePattern>;
  texture_groups: Record<string, TextureGroup>;
  motion_groups: Record<string, MotionGroup>;
  config: ResourceDepotConfig;
}
