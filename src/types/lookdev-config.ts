// === ルックデヴ用グローバル設定型定義 ===
// UnityのVolume概念に類似したライティング・ポストプロセス設定
// アクター単位で影響範囲を個別に定義可能

// ---------------------------------------------------------------------------
// 共通型
// ---------------------------------------------------------------------------

/** 3次元ベクトル (方向・位置・色など汎用) */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 線形カラー (HDR対応、0〜∞) */
export interface LinearColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

// ---------------------------------------------------------------------------
// ボリューム影響範囲
// ---------------------------------------------------------------------------

/** ボリュームの影響範囲モード */
export type VolumeBlendMode = 'global' | 'local';

/** ボリューム影響範囲の形状 */
export type VolumeShape = 'sphere' | 'box';

/** ボリューム影響範囲の定義 */
export interface VolumeInfluence {
  /** global: シーン全体に影響 / local: 形状内のみ */
  mode: VolumeBlendMode;
  /** local時の影響形状 */
  shape: VolumeShape;
  /** 影響範囲の半径またはハーフエクステント */
  extent: Vec3;
  /** 影響の減衰開始距離（0〜1、1で境界まで均一） */
  falloff: number;
  /** ボリュームの優先度（高いほど優先的に合成される） */
  priority: number;
  /** ボリュームの合成ウェイト (0〜1) */
  weight: number;
}

// ---------------------------------------------------------------------------
// 光源設定 (Pictor Light Module)
// ---------------------------------------------------------------------------

/** 光源の種類 */
export type LightType = 'directional' | 'point' | 'spot' | 'area';

/** 光の単位系（物理ベース） */
export type LightUnit = 'lux' | 'lumen' | 'candela' | 'nit';

/** 影のフィルタリング方式 */
export type ShadowFilter = 'hard' | 'pcf' | 'pcss' | 'vsm';

/** 影の設定 */
export interface ShadowConfig {
  /** 影を生成するか */
  enabled: boolean;
  /** シャドウマップ解像度 */
  resolution: number;
  /** フィルタリング方式 */
  filter: ShadowFilter;
  /** シャドウバイアス */
  bias: number;
  /** 法線バイアス */
  normalBias: number;
  /** 影の最大描画距離 */
  maxDistance: number;
}

/** 光源設定 (Pictorライトモジュールに対応) */
export interface LightConfig {
  /** 光源タイプ */
  type: LightType;
  /** 光の色 (線形、色温度ベースの変換も可能) */
  color: LinearColor;
  /** 光の強度 */
  intensity: number;
  /** 強度の単位系 */
  unit: LightUnit;
  /** 色温度 (ケルビン、0で無効=colorを直接使用) */
  colorTemperature: number;
  /** 光源の到達距離 (point/spot、0で自動減衰) */
  range: number;
  /** 光の方向 (directional/spot用、正規化ベクトル) */
  direction: Vec3;
  /** スポットライトの内角 (度) */
  innerAngle: number;
  /** スポットライトの外角 (度) */
  outerAngle: number;
  /** エリアライトのサイズ */
  areaSize: Vec3;
  /** 影の設定 */
  shadow: ShadowConfig;
  /** IESプロファイルのリソースID (配光特性、nullで均一配光) */
  iesProfileId: string | null;
}

// ---------------------------------------------------------------------------
// グローバルイルミネーション (GI) 設定
// ---------------------------------------------------------------------------

/** GIの計算方式 */
export type GIMethod = 'none' | 'ssgi' | 'lumen' | 'lightmap' | 'irradiance-volume';

/** GI設定 — 光がどこまで反射するかを制御 */
export interface GIConfig {
  /** GI有効フラグ */
  enabled: boolean;
  /** GI計算方式 */
  method: GIMethod;
  /** 間接光の強度倍率 */
  indirectIntensity: number;
  /** 最大バウンス回数 (光の反射回数上限) */
  maxBounces: number;
  /** GIの更新距離 (この距離内のオブジェクトのみGI計算対象) */
  updateRange: number;
  /** アンビエントオクルージョン強度 (0〜1) */
  aoIntensity: number;
  /** アンビエントオクルージョン半径 */
  aoRadius: number;
}

// ---------------------------------------------------------------------------
// 透過・減衰設定 (マテリアルオーバーライド)
// ---------------------------------------------------------------------------

/** 透過モデル */
export type TransmissionModel = 'none' | 'thin' | 'refraction';

/** 減衰プロファイル (ビアランベルトの法則ベース) */
export interface AttenuationProfile {
  /** 減衰色 (光がこの色に吸収される) */
  color: LinearColor;
  /** 減衰距離 (この距離で色が完全に吸収される、メートル単位) */
  distance: number;
}

/** 透過・減衰設定 — 光がモデルをどう通過するかを制御 */
export interface TransmissionConfig {
  /** 透過モデル */
  model: TransmissionModel;
  /** 透過率 (0〜1) */
  transmittance: number;
  /** 屈折率 (IOR: 1.0=空気、1.5=ガラス、1.33=水) */
  ior: number;
  /** 減衰プロファイル */
  attenuation: AttenuationProfile;
  /** サブサーフェイススキャタリング有効化 */
  subsurfaceScattering: boolean;
  /** スキャタリング半径 (SSSの拡散距離) */
  scatteringRadius: Vec3;
  /** スキャタリング色 */
  scatteringColor: LinearColor;
}

// ---------------------------------------------------------------------------
// ポストプロセス設定
// ---------------------------------------------------------------------------

/** トーンマッピング方式 */
export type ToneMappingMode = 'none' | 'reinhard' | 'aces' | 'filmic' | 'agx';

/** トーンマッピング設定 */
export interface ToneMappingConfig {
  mode: ToneMappingMode;
  /** 露出補正 (EV) */
  exposureCompensation: number;
  /** 自動露出の有効化 */
  autoExposure: boolean;
  /** 自動露出の最小EV */
  autoExposureMin: number;
  /** 自動露出の最大EV */
  autoExposureMax: number;
}

/** ブルーム設定 */
export interface BloomConfig {
  enabled: boolean;
  /** ブルームの強度 */
  intensity: number;
  /** ブルームの閾値 */
  threshold: number;
  /** 拡散半径 */
  radius: number;
}

/** 色収差設定 */
export interface ChromaticAberrationConfig {
  enabled: boolean;
  intensity: number;
}

/** ビネット設定 */
export interface VignetteConfig {
  enabled: boolean;
  intensity: number;
  smoothness: number;
}

/** カラーグレーディング設定 */
export interface ColorGradingConfig {
  /** コントラスト (0〜2、1がデフォルト) */
  contrast: number;
  /** 彩度 (0〜2、1がデフォルト) */
  saturation: number;
  /** ガンマ補正 */
  gamma: Vec3;
  /** ゲイン */
  gain: Vec3;
  /** リフト */
  lift: Vec3;
  /** LUTテクスチャのリソースID (nullで無効) */
  lutResourceId: string | null;
  /** LUTの適用強度 (0〜1) */
  lutIntensity: number;
}

/** ポストプロセス設定 */
export interface PostProcessConfig {
  toneMapping: ToneMappingConfig;
  bloom: BloomConfig;
  chromaticAberration: ChromaticAberrationConfig;
  vignette: VignetteConfig;
  colorGrading: ColorGradingConfig;
}

// ---------------------------------------------------------------------------
// ルックデヴボリューム (アクターにアタッチする単位)
// ---------------------------------------------------------------------------

/** ルックデヴボリューム — アクターに設定するライティング・ポストプロセス設定の単位 */
export interface LookdevVolume {
  /** 一意識別子 */
  id: string;
  /** 表示名 */
  name: string;
  /** アタッチ先のアクターID */
  actorId: string;
  /** 有効フラグ */
  enabled: boolean;
  /** 影響範囲設定 */
  influence: VolumeInfluence;
  /** 光源設定一覧 (複数光源を保持可能) */
  lights: LightConfig[];
  /** グローバルイルミネーション設定 */
  gi: GIConfig;
  /** 透過・減衰設定 (マテリアルオーバーライド) */
  transmission: TransmissionConfig;
  /** ポストプロセス設定 */
  postProcess: PostProcessConfig;
}

// ---------------------------------------------------------------------------
// グローバルルックデヴ設定 (プロジェクトレベル)
// ---------------------------------------------------------------------------

/** ルックデヴのグローバル設定 */
export interface LookdevGlobalConfig {
  /** デフォルトのボリューム設定 (シーン全体のフォールバック) */
  defaultVolume: LookdevVolume;
  /** シーン内のボリューム一覧 (アクター別オーバーライド) */
  volumes: LookdevVolume[];
}

// ---------------------------------------------------------------------------
// デフォルト値ファクトリ
// ---------------------------------------------------------------------------

/** デフォルトの影設定 */
export function createDefaultShadowConfig(): ShadowConfig {
  return {
    enabled: true,
    resolution: 2048,
    filter: 'pcss',
    bias: 0.005,
    normalBias: 0.02,
    maxDistance: 100,
  };
}

/** デフォルトの光源設定 (ディレクショナルライト) */
export function createDefaultLightConfig(): LightConfig {
  return {
    type: 'directional',
    color: { r: 1, g: 1, b: 1, a: 1 },
    intensity: 100000,
    unit: 'lux',
    colorTemperature: 6500,
    range: 0,
    direction: { x: 0, y: -1, z: 0.5 },
    innerAngle: 0,
    outerAngle: 0,
    areaSize: { x: 0, y: 0, z: 0 },
    shadow: createDefaultShadowConfig(),
    iesProfileId: null,
  };
}

/** デフォルトのGI設定 */
export function createDefaultGIConfig(): GIConfig {
  return {
    enabled: true,
    method: 'ssgi',
    indirectIntensity: 1.0,
    maxBounces: 2,
    updateRange: 50,
    aoIntensity: 0.5,
    aoRadius: 1.0,
  };
}

/** デフォルトの透過・減衰設定 */
export function createDefaultTransmissionConfig(): TransmissionConfig {
  return {
    model: 'none',
    transmittance: 0,
    ior: 1.5,
    attenuation: {
      color: { r: 1, g: 1, b: 1, a: 1 },
      distance: 1.0,
    },
    subsurfaceScattering: false,
    scatteringRadius: { x: 1, y: 0.2, z: 0.1 },
    scatteringColor: { r: 0.8, g: 0.2, b: 0.1, a: 1 },
  };
}

/** デフォルトのポストプロセス設定 */
export function createDefaultPostProcessConfig(): PostProcessConfig {
  return {
    toneMapping: {
      mode: 'aces',
      exposureCompensation: 0,
      autoExposure: true,
      autoExposureMin: -4,
      autoExposureMax: 16,
    },
    bloom: {
      enabled: true,
      intensity: 0.5,
      threshold: 1.0,
      radius: 4.0,
    },
    chromaticAberration: {
      enabled: false,
      intensity: 0,
    },
    vignette: {
      enabled: false,
      intensity: 0,
      smoothness: 0.3,
    },
    colorGrading: {
      contrast: 1.0,
      saturation: 1.0,
      gamma: { x: 1, y: 1, z: 1 },
      gain: { x: 1, y: 1, z: 1 },
      lift: { x: 0, y: 0, z: 0 },
      lutResourceId: null,
      lutIntensity: 1.0,
    },
  };
}

/** デフォルトのボリューム影響範囲 */
export function createDefaultVolumeInfluence(): VolumeInfluence {
  return {
    mode: 'global',
    shape: 'sphere',
    extent: { x: 10, y: 10, z: 10 },
    falloff: 0.5,
    priority: 0,
    weight: 1.0,
  };
}

/** デフォルトのルックデヴボリュームを生成 */
export function createDefaultLookdevVolume(actorId: string): LookdevVolume {
  return {
    id: crypto.randomUUID(),
    name: 'Default Volume',
    actorId,
    enabled: true,
    influence: createDefaultVolumeInfluence(),
    lights: [createDefaultLightConfig()],
    gi: createDefaultGIConfig(),
    transmission: createDefaultTransmissionConfig(),
    postProcess: createDefaultPostProcessConfig(),
  };
}

/** デフォルトのグローバルルックデヴ設定を生成 */
export function createDefaultLookdevGlobalConfig(rootActorId: string): LookdevGlobalConfig {
  return {
    defaultVolume: createDefaultLookdevVolume(rootActorId),
    volumes: [],
  };
}
