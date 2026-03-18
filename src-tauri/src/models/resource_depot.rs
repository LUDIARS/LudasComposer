use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// リソースカテゴリ
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ResourceCategory {
    Font,
    Model,
    Texture,
    Motion,
    Sound,
}

/// リソースの状態
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ResourceStatus {
    Available,
    Downloading,
    Cached,
    Error,
}

/// クラウドストレージプロバイダ
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CloudProvider {
    GoogleDrive,
    Local,
}

/// サウンドカテゴリ
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SoundCategory {
    Bgm,
    Se,
    Voice,
    Ambient,
}

// ─── クラウドストレージ参照 ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudReference {
    pub provider: CloudProvider,
    pub file_id: String,
    pub share_url: Option<String>,
    pub last_synced: Option<String>,
}

// ─── メタデータ ───

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ResourceMetadata {
    Font(FontMetadata),
    Model(ModelMetadata),
    Texture(TextureMetadata),
    Motion(MotionMetadata),
    Sound(SoundMetadata),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontMetadata {
    pub family: String,
    pub style: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMetadata {
    /// モデルフォーマット (glTF, VRM, PMX等)
    pub format: String,
    /// ボーンリスト
    pub bones: Vec<String>,
    /// 適合するボーンパターンID
    pub bone_pattern_id: Option<String>,
    /// アサイン済みモーションID
    pub assigned_motions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextureMetadata {
    pub format: String,
    pub width: u32,
    pub height: u32,
    /// 所属テクスチャグループID
    pub group_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MotionMetadata {
    pub format: String,
    /// 再生時間（秒）
    pub duration: f64,
    /// 使用ボーン名リスト
    pub target_bones: Vec<String>,
    /// 適合するボーンパターンID
    pub bone_pattern_id: Option<String>,
    /// 所属モーショングループID
    pub group_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoundMetadata {
    pub format: String,
    /// 再生時間（秒）
    pub duration: f64,
    /// サウンドID
    pub sound_id: String,
    /// サウンドカテゴリ
    pub sound_category: SoundCategory,
}

// ─── リソース ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resource {
    pub id: String,
    pub filename: String,
    pub role: String,
    pub category: ResourceCategory,
    pub size: u64,
    pub hash: String,
    pub local_path: Option<String>,
    pub cloud_ref: Option<CloudReference>,
    pub status: ResourceStatus,
    pub metadata: ResourceMetadata,
}

// ─── ボーンパターン ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BonePattern {
    pub id: String,
    pub name: String,
    pub required_bones: Vec<String>,
    pub optional_bones: Vec<String>,
}

impl BonePattern {
    /// モデルのボーンリストがこのパターンに適合するか判定
    pub fn matches(&self, bones: &[String]) -> bool {
        self.required_bones.iter().all(|rb| bones.contains(rb))
    }
}

// ─── テクスチャグループ ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtlasConfig {
    pub max_width: u32,
    pub max_height: u32,
    pub padding: u32,
}

impl Default for AtlasConfig {
    fn default() -> Self {
        Self {
            max_width: 4096,
            max_height: 4096,
            padding: 2,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextureGroup {
    pub id: String,
    pub name: String,
    pub texture_ids: Vec<String>,
    pub atlas_config: AtlasConfig,
}

// ─── モーショングループ ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RandomMotionConfig {
    pub weights: Vec<f64>,
    #[serde(rename = "loop")]
    pub is_loop: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IKTarget {
    pub name: String,
    pub effector_bone: String,
    pub chain_length: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IKConfig {
    pub targets: Vec<IKTarget>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RigConfig {
    pub mappings: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MotionGroup {
    pub id: String,
    pub name: String,
    pub motion_ids: Vec<String>,
    pub random_config: Option<RandomMotionConfig>,
    pub ik_config: Option<IKConfig>,
    pub rig_config: Option<RigConfig>,
    pub bone_pattern_id: Option<String>,
}

// ─── クラウドストレージ設定 ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudStorageConfig {
    pub provider: CloudProvider,
    pub credentials: Option<HashMap<String, String>>,
    pub root_folder_id: Option<String>,
}

// ─── リソースデポ設定 ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceDepotConfig {
    pub cache_dir: String,
    pub cloud_configs: Vec<CloudStorageConfig>,
}

// ─── リソースデポ全体 ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceDepot {
    pub resources: HashMap<String, Resource>,
    pub bone_patterns: HashMap<String, BonePattern>,
    pub texture_groups: HashMap<String, TextureGroup>,
    pub motion_groups: HashMap<String, MotionGroup>,
    pub config: ResourceDepotConfig,
}

impl Default for ResourceDepot {
    fn default() -> Self {
        Self {
            resources: HashMap::new(),
            bone_patterns: HashMap::new(),
            texture_groups: HashMap::new(),
            motion_groups: HashMap::new(),
            config: ResourceDepotConfig {
                cache_dir: String::new(),
                cloud_configs: Vec::new(),
            },
        }
    }
}
