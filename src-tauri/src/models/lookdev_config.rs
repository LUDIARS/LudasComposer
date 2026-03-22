use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// 共通型
// ---------------------------------------------------------------------------

/// 3次元ベクトル (方向・位置・色など汎用)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

/// 線形カラー (HDR対応、0〜∞)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinearColor {
    pub r: f64,
    pub g: f64,
    pub b: f64,
    pub a: f64,
}

// ---------------------------------------------------------------------------
// ボリューム影響範囲
// ---------------------------------------------------------------------------

/// ボリュームの影響範囲モード
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum VolumeBlendMode {
    /// シーン全体に影響
    Global,
    /// 形状内のみ影響
    Local,
}

/// ボリューム影響範囲の形状
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum VolumeShape {
    Sphere,
    Box,
}

/// ボリューム影響範囲の定義
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeInfluence {
    /// global: シーン全体に影響 / local: 形状内のみ
    pub mode: VolumeBlendMode,
    /// local時の影響形状
    pub shape: VolumeShape,
    /// 影響範囲の半径またはハーフエクステント
    pub extent: Vec3,
    /// 影響の減衰開始距離（0〜1、1で境界まで均一）
    pub falloff: f64,
    /// ボリュームの優先度（高いほど優先的に合成される）
    pub priority: i32,
    /// ボリュームの合成ウェイト (0〜1)
    pub weight: f64,
}

// ---------------------------------------------------------------------------
// 光源設定 (Pictor Light Module)
// ---------------------------------------------------------------------------

/// 光源の種類
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LightType {
    Directional,
    Point,
    Spot,
    Area,
}

/// 光の単位系（物理ベース）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LightUnit {
    /// ルクス (照度)
    Lux,
    /// ルーメン (光束)
    Lumen,
    /// カンデラ (光度)
    Candela,
    /// ニト (輝度)
    Nit,
}

/// 影のフィルタリング方式
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ShadowFilter {
    Hard,
    Pcf,
    Pcss,
    Vsm,
}

/// 影の設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShadowConfig {
    /// 影を生成するか
    pub enabled: bool,
    /// シャドウマップ解像度
    pub resolution: u32,
    /// フィルタリング方式
    pub filter: ShadowFilter,
    /// シャドウバイアス
    pub bias: f64,
    /// 法線バイアス
    pub normal_bias: f64,
    /// 影の最大描画距離
    pub max_distance: f64,
}

/// 光源設定 (Pictorライトモジュールに対応)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LightConfig {
    /// 光源タイプ
    #[serde(rename = "type")]
    pub light_type: LightType,
    /// 光の色 (線形)
    pub color: LinearColor,
    /// 光の強度
    pub intensity: f64,
    /// 強度の単位系
    pub unit: LightUnit,
    /// 色温度 (ケルビン、0で無効=colorを直接使用)
    pub color_temperature: f64,
    /// 光源の到達距離 (point/spot、0で自動減衰)
    pub range: f64,
    /// 光の方向 (directional/spot用、正規化ベクトル)
    pub direction: Vec3,
    /// スポットライトの内角 (度)
    pub inner_angle: f64,
    /// スポットライトの外角 (度)
    pub outer_angle: f64,
    /// エリアライトのサイズ
    pub area_size: Vec3,
    /// 影の設定
    pub shadow: ShadowConfig,
    /// IESプロファイルのリソースID (配光特性)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ies_profile_id: Option<String>,
}

// ---------------------------------------------------------------------------
// グローバルイルミネーション (GI) 設定
// ---------------------------------------------------------------------------

/// GIの計算方式
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum GIMethod {
    None,
    /// Screen-Space Global Illumination
    Ssgi,
    /// Lumen-style ソフトウェアレイトレーシング
    Lumen,
    /// 焼き込みライトマップ
    Lightmap,
    /// ボリュームベースのイラディアンスキャッシュ
    IrradianceVolume,
}

/// GI設定 — 光がどこまで反射するかを制御
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GIConfig {
    /// GI有効フラグ
    pub enabled: bool,
    /// GI計算方式
    pub method: GIMethod,
    /// 間接光の強度倍率
    pub indirect_intensity: f64,
    /// 最大バウンス回数 (光の反射回数上限)
    pub max_bounces: u32,
    /// GIの更新距離 (この距離内のオブジェクトのみGI計算対象)
    pub update_range: f64,
    /// アンビエントオクルージョン強度 (0〜1)
    pub ao_intensity: f64,
    /// アンビエントオクルージョン半径
    pub ao_radius: f64,
}

// ---------------------------------------------------------------------------
// 透過・減衰設定 (マテリアルオーバーライド)
// ---------------------------------------------------------------------------

/// 透過モデル
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TransmissionModel {
    None,
    /// 薄面透過 (ガラス板など)
    Thin,
    /// 屈折透過 (厚みのあるオブジェクト)
    Refraction,
}

/// 減衰プロファイル (ビアランベルトの法則ベース)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttenuationProfile {
    /// 減衰色 (光がこの色に吸収される)
    pub color: LinearColor,
    /// 減衰距離 (この距離で色が完全に吸収される、メートル単位)
    pub distance: f64,
}

/// 透過・減衰設定 — 光がモデルをどう通過するかを制御
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransmissionConfig {
    /// 透過モデル
    pub model: TransmissionModel,
    /// 透過率 (0〜1)
    pub transmittance: f64,
    /// 屈折率 (IOR: 1.0=空気、1.5=ガラス、1.33=水)
    pub ior: f64,
    /// 減衰プロファイル
    pub attenuation: AttenuationProfile,
    /// サブサーフェイススキャタリング有効化
    pub subsurface_scattering: bool,
    /// スキャタリング半径 (SSSの拡散距離)
    pub scattering_radius: Vec3,
    /// スキャタリング色
    pub scattering_color: LinearColor,
}

// ---------------------------------------------------------------------------
// ポストプロセス設定
// ---------------------------------------------------------------------------

/// トーンマッピング方式
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ToneMappingMode {
    None,
    Reinhard,
    Aces,
    Filmic,
    Agx,
}

/// トーンマッピング設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToneMappingConfig {
    pub mode: ToneMappingMode,
    /// 露出補正 (EV)
    pub exposure_compensation: f64,
    /// 自動露出の有効化
    pub auto_exposure: bool,
    /// 自動露出の最小EV
    pub auto_exposure_min: f64,
    /// 自動露出の最大EV
    pub auto_exposure_max: f64,
}

/// ブルーム設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BloomConfig {
    pub enabled: bool,
    /// ブルームの強度
    pub intensity: f64,
    /// ブルームの閾値
    pub threshold: f64,
    /// 拡散半径
    pub radius: f64,
}

/// 色収差設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChromaticAberrationConfig {
    pub enabled: bool,
    pub intensity: f64,
}

/// ビネット設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VignetteConfig {
    pub enabled: bool,
    pub intensity: f64,
    pub smoothness: f64,
}

/// カラーグレーディング設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorGradingConfig {
    /// コントラスト (0〜2、1がデフォルト)
    pub contrast: f64,
    /// 彩度 (0〜2、1がデフォルト)
    pub saturation: f64,
    /// ガンマ補正
    pub gamma: Vec3,
    /// ゲイン
    pub gain: Vec3,
    /// リフト
    pub lift: Vec3,
    /// LUTテクスチャのリソースID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lut_resource_id: Option<String>,
    /// LUTの適用強度 (0〜1)
    pub lut_intensity: f64,
}

/// ポストプロセス設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostProcessConfig {
    pub tone_mapping: ToneMappingConfig,
    pub bloom: BloomConfig,
    pub chromatic_aberration: ChromaticAberrationConfig,
    pub vignette: VignetteConfig,
    pub color_grading: ColorGradingConfig,
}

// ---------------------------------------------------------------------------
// ルックデヴボリューム (アクターにアタッチする単位)
// ---------------------------------------------------------------------------

/// ルックデヴボリューム — アクターに設定するライティング・ポストプロセス設定の単位
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LookdevVolume {
    /// 一意識別子
    pub id: String,
    /// 表示名
    pub name: String,
    /// アタッチ先のアクターID
    pub actor_id: String,
    /// 有効フラグ
    pub enabled: bool,
    /// 影響範囲設定
    pub influence: VolumeInfluence,
    /// 光源設定一覧 (複数光源を保持可能)
    pub lights: Vec<LightConfig>,
    /// グローバルイルミネーション設定
    pub gi: GIConfig,
    /// 透過・減衰設定 (マテリアルオーバーライド)
    pub transmission: TransmissionConfig,
    /// ポストプロセス設定
    pub post_process: PostProcessConfig,
}

// ---------------------------------------------------------------------------
// グローバルルックデヴ設定 (プロジェクトレベル)
// ---------------------------------------------------------------------------

/// ルックデヴのグローバル設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LookdevGlobalConfig {
    /// デフォルトのボリューム設定 (シーン全体のフォールバック)
    pub default_volume: LookdevVolume,
    /// シーン内のボリューム一覧 (アクター別オーバーライド)
    pub volumes: Vec<LookdevVolume>,
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_volume() -> LookdevVolume {
        LookdevVolume {
            id: "test-volume".to_string(),
            name: "Test Volume".to_string(),
            actor_id: "actor-1".to_string(),
            enabled: true,
            influence: VolumeInfluence {
                mode: VolumeBlendMode::Global,
                shape: VolumeShape::Sphere,
                extent: Vec3 {
                    x: 10.0,
                    y: 10.0,
                    z: 10.0,
                },
                falloff: 0.5,
                priority: 0,
                weight: 1.0,
            },
            lights: vec![LightConfig {
                light_type: LightType::Directional,
                color: LinearColor {
                    r: 1.0,
                    g: 1.0,
                    b: 1.0,
                    a: 1.0,
                },
                intensity: 100000.0,
                unit: LightUnit::Lux,
                color_temperature: 6500.0,
                range: 0.0,
                direction: Vec3 {
                    x: 0.0,
                    y: -1.0,
                    z: 0.5,
                },
                inner_angle: 0.0,
                outer_angle: 0.0,
                area_size: Vec3 {
                    x: 0.0,
                    y: 0.0,
                    z: 0.0,
                },
                shadow: ShadowConfig {
                    enabled: true,
                    resolution: 2048,
                    filter: ShadowFilter::Pcss,
                    bias: 0.005,
                    normal_bias: 0.02,
                    max_distance: 100.0,
                },
                ies_profile_id: None,
            }],
            gi: GIConfig {
                enabled: true,
                method: GIMethod::Ssgi,
                indirect_intensity: 1.0,
                max_bounces: 2,
                update_range: 50.0,
                ao_intensity: 0.5,
                ao_radius: 1.0,
            },
            transmission: TransmissionConfig {
                model: TransmissionModel::None,
                transmittance: 0.0,
                ior: 1.5,
                attenuation: AttenuationProfile {
                    color: LinearColor {
                        r: 1.0,
                        g: 1.0,
                        b: 1.0,
                        a: 1.0,
                    },
                    distance: 1.0,
                },
                subsurface_scattering: false,
                scattering_radius: Vec3 {
                    x: 1.0,
                    y: 0.2,
                    z: 0.1,
                },
                scattering_color: LinearColor {
                    r: 0.8,
                    g: 0.2,
                    b: 0.1,
                    a: 1.0,
                },
            },
            post_process: PostProcessConfig {
                tone_mapping: ToneMappingConfig {
                    mode: ToneMappingMode::Aces,
                    exposure_compensation: 0.0,
                    auto_exposure: true,
                    auto_exposure_min: -4.0,
                    auto_exposure_max: 16.0,
                },
                bloom: BloomConfig {
                    enabled: true,
                    intensity: 0.5,
                    threshold: 1.0,
                    radius: 4.0,
                },
                chromatic_aberration: ChromaticAberrationConfig {
                    enabled: false,
                    intensity: 0.0,
                },
                vignette: VignetteConfig {
                    enabled: false,
                    intensity: 0.0,
                    smoothness: 0.3,
                },
                color_grading: ColorGradingConfig {
                    contrast: 1.0,
                    saturation: 1.0,
                    gamma: Vec3 {
                        x: 1.0,
                        y: 1.0,
                        z: 1.0,
                    },
                    gain: Vec3 {
                        x: 1.0,
                        y: 1.0,
                        z: 1.0,
                    },
                    lift: Vec3 {
                        x: 0.0,
                        y: 0.0,
                        z: 0.0,
                    },
                    lut_resource_id: None,
                    lut_intensity: 1.0,
                },
            },
        }
    }

    #[test]
    fn test_lookdev_volume_serialization() {
        let volume = create_test_volume();
        let json = serde_json::to_string(&volume).unwrap();
        let deserialized: LookdevVolume = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "test-volume");
        assert_eq!(deserialized.actor_id, "actor-1");
        assert!(deserialized.enabled);
    }

    #[test]
    fn test_global_config_serialization() {
        let config = LookdevGlobalConfig {
            default_volume: create_test_volume(),
            volumes: vec![],
        };
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: LookdevGlobalConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.default_volume.name, "Test Volume");
        assert!(deserialized.volumes.is_empty());
    }

    #[test]
    fn test_light_type_serialization() {
        let light_type = LightType::Directional;
        let json = serde_json::to_string(&light_type).unwrap();
        assert_eq!(json, "\"directional\"");
    }

    #[test]
    fn test_gi_method_serialization() {
        let method = GIMethod::IrradianceVolume;
        let json = serde_json::to_string(&method).unwrap();
        assert_eq!(json, "\"irradiance-volume\"");
    }

    #[test]
    fn test_volume_with_multiple_lights() {
        let mut volume = create_test_volume();
        volume.lights.push(LightConfig {
            light_type: LightType::Point,
            color: LinearColor {
                r: 1.0,
                g: 0.9,
                b: 0.8,
                a: 1.0,
            },
            intensity: 800.0,
            unit: LightUnit::Lumen,
            color_temperature: 3200.0,
            range: 10.0,
            direction: Vec3 {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            inner_angle: 0.0,
            outer_angle: 0.0,
            area_size: Vec3 {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            shadow: ShadowConfig {
                enabled: true,
                resolution: 1024,
                filter: ShadowFilter::Pcf,
                bias: 0.005,
                normal_bias: 0.02,
                max_distance: 20.0,
            },
            ies_profile_id: None,
        });
        assert_eq!(volume.lights.len(), 2);
        assert_eq!(volume.lights[1].light_type, LightType::Point);
    }

    #[test]
    fn test_local_volume_influence() {
        let mut volume = create_test_volume();
        volume.influence.mode = VolumeBlendMode::Local;
        volume.influence.shape = VolumeShape::Box;
        volume.influence.extent = Vec3 {
            x: 5.0,
            y: 3.0,
            z: 5.0,
        };
        volume.influence.priority = 10;

        let json = serde_json::to_string(&volume.influence).unwrap();
        let deserialized: VolumeInfluence = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.mode, VolumeBlendMode::Local);
        assert_eq!(deserialized.shape, VolumeShape::Box);
        assert_eq!(deserialized.priority, 10);
    }

    #[test]
    fn test_transmission_refraction() {
        let transmission = TransmissionConfig {
            model: TransmissionModel::Refraction,
            transmittance: 0.95,
            ior: 1.33,
            attenuation: AttenuationProfile {
                color: LinearColor {
                    r: 0.6,
                    g: 0.8,
                    b: 1.0,
                    a: 1.0,
                },
                distance: 2.0,
            },
            subsurface_scattering: false,
            scattering_radius: Vec3 {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            scattering_color: LinearColor {
                r: 1.0,
                g: 1.0,
                b: 1.0,
                a: 1.0,
            },
        };
        assert_eq!(transmission.model, TransmissionModel::Refraction);
        assert_eq!(transmission.ior, 1.33);
    }
}
