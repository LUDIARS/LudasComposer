// === リソースデポ型定義 ===
// リソース（フォント、モデル、テクスチャ、モーション、サウンド）の管理

/** リソースカテゴリ */
export type ResourceCategory = 'font' | 'model' | 'texture' | 'motion' | 'sound';

/** リソースの状態 */
export type ResourceStatus = 'available' | 'downloading' | 'cached' | 'error';

/** クラウドストレージプロバイダ */
export type CloudProvider = 'google_drive' | 'local';

// ─── 基本リソース定義 ───

/** リソース基本情報 */
export interface Resource {
  id: string;
  /** ファイル名 */
  filename: string;
  /** 役割（用途の説明） */
  role: string;
  /** リソースカテゴリ */
  category: ResourceCategory;
  /** ファイルサイズ（バイト） */
  size: number;
  /** ファイルハッシュ（SHA-256） */
  hash: string;
  /** ローカルキャッシュパス */
  local_path?: string;
  /** クラウドストレージ参照 */
  cloud_ref?: CloudReference;
  /** 状態 */
  status: ResourceStatus;
  /** メタデータ */
  metadata: ResourceMetadata;
}

/** クラウドストレージ参照 */
export interface CloudReference {
  provider: CloudProvider;
  /** プロバイダ固有のファイルID */
  file_id: string;
  /** 共有URL */
  share_url?: string;
  /** 最終同期日時 */
  last_synced?: string;
}

/** リソースメタデータ（カテゴリ固有情報のユニオン） */
export type ResourceMetadata =
  | FontMetadata
  | ModelMetadata
  | TextureMetadata
  | MotionMetadata
  | SoundMetadata;

// ─── フォント ───

export interface FontMetadata {
  type: 'font';
  /** フォントファミリー名 */
  family: string;
  /** スタイル (Regular, Bold, Italic等) */
  style: string;
}

// ─── モデル ───

/** ボーンパターン: モデルのボーン構造に基づく分類 */
export interface BonePattern {
  id: string;
  name: string;
  /** パターンに含まれるボーン名リスト */
  required_bones: string[];
  /** オプションのボーン名リスト */
  optional_bones: string[];
}

export interface ModelMetadata {
  type: 'model';
  /** モデルフォーマット (glTF, VRM, PMX等) */
  format: string;
  /** ボーンリスト */
  bones: string[];
  /** 適合するボーンパターンID */
  bone_pattern_id?: string;
  /** アサイン済みモーションID */
  assigned_motions: string[];
}

// ─── テクスチャ ───

/** テクスチャグループ（アトラス化の単位） */
export interface TextureGroup {
  id: string;
  name: string;
  /** グループ内テクスチャリソースID */
  texture_ids: string[];
  /** アトラス設定 */
  atlas_config: AtlasConfig;
}

export interface AtlasConfig {
  /** 最大アトラスサイズ */
  max_width: number;
  max_height: number;
  /** パディング */
  padding: number;
}

export interface TextureMetadata {
  type: 'texture';
  /** 画像フォーマット (PNG, JPEG, WebP等) */
  format: string;
  /** 幅 */
  width: number;
  /** 高さ */
  height: number;
  /** 所属テクスチャグループID */
  group_id?: string;
}

// ─── モーション ───

/** モーショングループ: ランダムパターン呼び出しやIK/リグ設定の共通化 */
export interface MotionGroup {
  id: string;
  name: string;
  /** グループ内モーションリソースID */
  motion_ids: string[];
  /** ランダム再生設定 */
  random_config?: RandomMotionConfig;
  /** IK設定 */
  ik_config?: IKConfig;
  /** リグ設定 */
  rig_config?: RigConfig;
  /** 適合するボーンパターンID */
  bone_pattern_id?: string;
}

export interface RandomMotionConfig {
  /** 各モーションの重み（motion_idsと同じ順序） */
  weights: number[];
  /** ループ再生するか */
  loop: boolean;
}

export interface IKConfig {
  /** IKターゲット定義 */
  targets: IKTarget[];
}

export interface IKTarget {
  /** ターゲット名 */
  name: string;
  /** エフェクタボーン名 */
  effector_bone: string;
  /** チェーン長 */
  chain_length: number;
}

export interface RigConfig {
  /** リグマッピング（ボーン名 → コントロール名） */
  mappings: Record<string, string>;
}

export interface MotionMetadata {
  type: 'motion';
  /** モーションフォーマット (BVH, VMD, glTF等) */
  format: string;
  /** 再生時間（秒） */
  duration: number;
  /** 使用ボーン名リスト */
  target_bones: string[];
  /** 適合するボーンパターンID */
  bone_pattern_id?: string;
  /** 所属モーショングループID */
  group_id?: string;
}

// ─── サウンド ───

/** サウンドカテゴリ */
export type SoundCategory = 'bgm' | 'se' | 'voice' | 'ambient';

export interface SoundMetadata {
  type: 'sound';
  /** サウンドフォーマット (WAV, OGG, MP3等) */
  format: string;
  /** 再生時間（秒） */
  duration: number;
  /** サウンドID（プロジェクト内のユニーク識別子） */
  sound_id: string;
  /** サウンドカテゴリ */
  sound_category: SoundCategory;
}

// ─── リソースデポ全体 ───

/** リソースデポ設定 */
export interface ResourceDepotConfig {
  /** ローカルキャッシュディレクトリ */
  cache_dir: string;
  /** クラウドストレージ設定 */
  cloud_configs: CloudStorageConfig[];
}

/** クラウドストレージ設定 */
export interface CloudStorageConfig {
  provider: CloudProvider;
  /** 認証情報（プロバイダ固有） */
  credentials?: Record<string, string>;
  /** 同期ルートフォルダID */
  root_folder_id?: string;
}

/** リソースデポ全体の状態 */
export interface ResourceDepot {
  /** 全リソース */
  resources: Record<string, Resource>;
  /** ボーンパターン定義 */
  bone_patterns: Record<string, BonePattern>;
  /** テクスチャグループ */
  texture_groups: Record<string, TextureGroup>;
  /** モーショングループ */
  motion_groups: Record<string, MotionGroup>;
  /** デポ設定 */
  config: ResourceDepotConfig;
}

// ─── コマンドパラメータ ───

export interface RegisterResourceParams {
  filename: string;
  role: string;
  category: ResourceCategory;
  file_path: string;
}

export interface SyncCloudParams {
  provider: CloudProvider;
  resource_id?: string;
}

export interface AssignMotionParams {
  model_id: string;
  motion_ids: string[];
}

export interface CreateMotionGroupParams {
  name: string;
  motion_ids: string[];
  bone_pattern_id?: string;
}

export interface CreateTextureGroupParams {
  name: string;
  texture_ids: string[];
  atlas_config?: AtlasConfig;
}
