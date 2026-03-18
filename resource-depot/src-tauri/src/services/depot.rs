use crate::models::resource::*;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DepotError {
    #[error("リソースが見つかりません: {0}")]
    ResourceNotFound(String),
    #[error("ボーンパターンが見つかりません: {0}")]
    BonePatternNotFound(String),
    #[error("テクスチャグループが見つかりません: {0}")]
    TextureGroupNotFound(String),
    #[error("モーショングループが見つかりません: {0}")]
    MotionGroupNotFound(String),
    #[error("カテゴリ不一致: 期待={expected}, 実際={actual}")]
    CategoryMismatch { expected: String, actual: String },
    #[error("ファイルI/Oエラー: {0}")]
    IoError(#[from] std::io::Error),
    #[error("JSONエラー: {0}")]
    JsonError(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, DepotError>;

/// リソースデポサービス（フル書き込み権限）
pub struct ResourceDepotService {
    depot: ResourceDepot,
    depot_file: PathBuf,
}

impl ResourceDepotService {
    pub fn with_defaults() -> Result<Self> {
        let cache_dir = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".ars")
            .join("resource-depot");
        Self::new(cache_dir)
    }

    pub fn new(cache_dir: PathBuf) -> Result<Self> {
        fs::create_dir_all(&cache_dir)?;
        let depot_file = cache_dir.join("depot.json");

        let depot = if depot_file.exists() {
            let content = fs::read_to_string(&depot_file)?;
            serde_json::from_str(&content)?
        } else {
            ResourceDepot {
                config: ResourceDepotConfig {
                    cache_dir: cache_dir.to_string_lossy().to_string(),
                    cloud_configs: Vec::new(),
                },
                ..Default::default()
            }
        };

        Ok(Self { depot, depot_file })
    }

    fn save(&self) -> Result<()> {
        let json = serde_json::to_string_pretty(&self.depot)?;
        fs::write(&self.depot_file, json)?;
        Ok(())
    }

    /// デポデータのファイルパスを取得（リードオンリーモジュールが参照する）
    pub fn depot_file_path(&self) -> &Path {
        &self.depot_file
    }

    // ─── リソース登録（D&D対応） ───

    /// ファイルからリソースを登録（日本語→英語名の変換済み）
    pub fn register_resource(
        &mut self,
        original_filename: String,
        english_filename: String,
        role: String,
        category: ResourceCategory,
        file_path: &str,
        metadata: ResourceMetadata,
    ) -> Result<Resource> {
        let path = Path::new(file_path);
        let file_meta = fs::metadata(path)?;
        let size = file_meta.len();

        let content = fs::read(path)?;
        let mut hasher = Sha256::new();
        hasher.update(&content);
        let hash = format!("{:x}", hasher.finalize());

        // カテゴリ別ディレクトリにキャッシュ
        let cache_dir = Path::new(&self.depot.config.cache_dir);
        let category_dir = cache_dir.join(format!("{:?}", category).to_lowercase());
        fs::create_dir_all(&category_dir)?;
        let cache_path = category_dir.join(&english_filename);
        fs::copy(path, &cache_path)?;

        let resource = Resource {
            id: uuid::Uuid::new_v4().to_string(),
            filename: english_filename,
            original_filename,
            role,
            category,
            size,
            hash,
            local_path: Some(cache_path.to_string_lossy().to_string()),
            cloud_ref: None,
            status: ResourceStatus::Cached,
            metadata,
        };

        self.depot
            .resources
            .insert(resource.id.clone(), resource.clone());
        self.save()?;
        Ok(resource)
    }

    /// リソース削除
    pub fn remove_resource(&mut self, resource_id: &str) -> Result<()> {
        let resource = self
            .depot
            .resources
            .remove(resource_id)
            .ok_or_else(|| DepotError::ResourceNotFound(resource_id.to_string()))?;

        if let Some(local_path) = &resource.local_path {
            let _ = fs::remove_file(local_path);
        }

        self.save()?;
        Ok(())
    }

    /// リソース取得
    pub fn get_resource(&self, resource_id: &str) -> Result<&Resource> {
        self.depot
            .resources
            .get(resource_id)
            .ok_or_else(|| DepotError::ResourceNotFound(resource_id.to_string()))
    }

    /// 全リソース取得
    pub fn get_all_resources(&self) -> Vec<Resource> {
        self.depot.resources.values().cloned().collect()
    }

    /// カテゴリ別リソース取得
    pub fn get_resources_by_category(&self, category: &ResourceCategory) -> Vec<Resource> {
        self.depot
            .resources
            .values()
            .filter(|r| &r.category == category)
            .cloned()
            .collect()
    }

    /// 検索
    pub fn find_resources(&self, query: &str) -> Vec<Resource> {
        let q = query.to_lowercase();
        self.depot
            .resources
            .values()
            .filter(|r| {
                r.filename.to_lowercase().contains(&q)
                    || r.original_filename.to_lowercase().contains(&q)
                    || r.role.to_lowercase().contains(&q)
            })
            .cloned()
            .collect()
    }

    // ─── ボーンパターン ───

    pub fn register_bone_pattern(&mut self, pattern: BonePattern) -> Result<BonePattern> {
        self.depot
            .bone_patterns
            .insert(pattern.id.clone(), pattern.clone());
        self.save()?;
        Ok(pattern)
    }

    pub fn remove_bone_pattern(&mut self, pattern_id: &str) -> Result<()> {
        self.depot
            .bone_patterns
            .remove(pattern_id)
            .ok_or_else(|| DepotError::BonePatternNotFound(pattern_id.to_string()))?;
        self.save()?;
        Ok(())
    }

    pub fn get_bone_patterns(&self) -> Vec<BonePattern> {
        self.depot.bone_patterns.values().cloned().collect()
    }

    pub fn find_matching_patterns(&self, bones: &[String]) -> Vec<BonePattern> {
        self.depot
            .bone_patterns
            .values()
            .filter(|p| p.matches(bones))
            .cloned()
            .collect()
    }

    pub fn detect_bone_pattern(&mut self, model_id: &str) -> Result<Option<String>> {
        let bones = {
            let resource = self.get_resource(model_id)?;
            match &resource.metadata {
                ResourceMetadata::Model(m) => m.bones.clone(),
                _ => {
                    return Err(DepotError::CategoryMismatch {
                        expected: "model".to_string(),
                        actual: format!("{:?}", resource.category),
                    })
                }
            }
        };

        let matching = self.find_matching_patterns(&bones);
        let pattern_id = matching.first().map(|p| p.id.clone());

        if let Some(ref pid) = pattern_id {
            if let Some(resource) = self.depot.resources.get_mut(model_id) {
                if let ResourceMetadata::Model(ref mut m) = resource.metadata {
                    m.bone_pattern_id = Some(pid.clone());
                }
            }
            self.save()?;
        }

        Ok(pattern_id)
    }

    // ─── モーション ───

    pub fn assign_motions_to_model(
        &mut self,
        model_id: &str,
        motion_ids: &[String],
    ) -> Result<()> {
        let model_pattern_id = {
            let resource = self.get_resource(model_id)?;
            match &resource.metadata {
                ResourceMetadata::Model(m) => m.bone_pattern_id.clone(),
                _ => {
                    return Err(DepotError::CategoryMismatch {
                        expected: "model".to_string(),
                        actual: format!("{:?}", resource.category),
                    })
                }
            }
        };

        let valid_motion_ids: Vec<String> = motion_ids
            .iter()
            .filter(|mid| {
                if let Some(r) = self.depot.resources.get(mid.as_str()) {
                    if let ResourceMetadata::Motion(m) = &r.metadata {
                        return model_pattern_id.is_none()
                            || m.bone_pattern_id.is_none()
                            || model_pattern_id == m.bone_pattern_id;
                    }
                }
                false
            })
            .cloned()
            .collect();

        if let Some(resource) = self.depot.resources.get_mut(model_id) {
            if let ResourceMetadata::Model(ref mut m) = resource.metadata {
                m.assigned_motions = valid_motion_ids;
            }
        }
        self.save()?;
        Ok(())
    }

    pub fn find_compatible_motions(&self, bone_pattern_id: &str) -> Vec<Resource> {
        self.depot
            .resources
            .values()
            .filter(|r| {
                if let ResourceMetadata::Motion(m) = &r.metadata {
                    m.bone_pattern_id.as_deref() == Some(bone_pattern_id)
                } else {
                    false
                }
            })
            .cloned()
            .collect()
    }

    // ─── モーショングループ ───

    pub fn create_motion_group(
        &mut self,
        name: String,
        motion_ids: Vec<String>,
        bone_pattern_id: Option<String>,
    ) -> Result<MotionGroup> {
        let group = MotionGroup {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            motion_ids: motion_ids.clone(),
            random_config: None,
            ik_config: None,
            rig_config: None,
            bone_pattern_id,
        };

        for mid in &motion_ids {
            if let Some(resource) = self.depot.resources.get_mut(mid) {
                if let ResourceMetadata::Motion(ref mut m) = resource.metadata {
                    m.group_id = Some(group.id.clone());
                }
            }
        }

        self.depot
            .motion_groups
            .insert(group.id.clone(), group.clone());
        self.save()?;
        Ok(group)
    }

    pub fn update_motion_group(&mut self, group: MotionGroup) -> Result<MotionGroup> {
        if !self.depot.motion_groups.contains_key(&group.id) {
            return Err(DepotError::MotionGroupNotFound(group.id.clone()));
        }
        self.depot
            .motion_groups
            .insert(group.id.clone(), group.clone());
        self.save()?;
        Ok(group)
    }

    pub fn remove_motion_group(&mut self, group_id: &str) -> Result<()> {
        let group = self
            .depot
            .motion_groups
            .remove(group_id)
            .ok_or_else(|| DepotError::MotionGroupNotFound(group_id.to_string()))?;

        for mid in &group.motion_ids {
            if let Some(resource) = self.depot.resources.get_mut(mid) {
                if let ResourceMetadata::Motion(ref mut m) = resource.metadata {
                    if m.group_id.as_deref() == Some(group_id) {
                        m.group_id = None;
                    }
                }
            }
        }
        self.save()?;
        Ok(())
    }

    pub fn get_motion_groups(&self) -> Vec<MotionGroup> {
        self.depot.motion_groups.values().cloned().collect()
    }

    // ─── テクスチャグループ ───

    pub fn create_texture_group(
        &mut self,
        name: String,
        texture_ids: Vec<String>,
        atlas_config: Option<AtlasConfig>,
    ) -> Result<TextureGroup> {
        let group = TextureGroup {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            texture_ids: texture_ids.clone(),
            atlas_config: atlas_config.unwrap_or_default(),
        };

        for tid in &texture_ids {
            if let Some(resource) = self.depot.resources.get_mut(tid) {
                if let ResourceMetadata::Texture(ref mut t) = resource.metadata {
                    t.group_id = Some(group.id.clone());
                }
            }
        }

        self.depot
            .texture_groups
            .insert(group.id.clone(), group.clone());
        self.save()?;
        Ok(group)
    }

    pub fn update_texture_group(&mut self, group: TextureGroup) -> Result<TextureGroup> {
        if !self.depot.texture_groups.contains_key(&group.id) {
            return Err(DepotError::TextureGroupNotFound(group.id.clone()));
        }
        self.depot
            .texture_groups
            .insert(group.id.clone(), group.clone());
        self.save()?;
        Ok(group)
    }

    pub fn remove_texture_group(&mut self, group_id: &str) -> Result<()> {
        let group = self
            .depot
            .texture_groups
            .remove(group_id)
            .ok_or_else(|| DepotError::TextureGroupNotFound(group_id.to_string()))?;

        for tid in &group.texture_ids {
            if let Some(resource) = self.depot.resources.get_mut(tid) {
                if let ResourceMetadata::Texture(ref mut t) = resource.metadata {
                    if t.group_id.as_deref() == Some(group_id) {
                        t.group_id = None;
                    }
                }
            }
        }
        self.save()?;
        Ok(())
    }

    pub fn get_texture_groups(&self) -> Vec<TextureGroup> {
        self.depot.texture_groups.values().cloned().collect()
    }

    // ─── 共通リソース発見 ───

    pub fn find_duplicate_resources(&self) -> HashMap<String, Vec<String>> {
        let mut hash_map: HashMap<String, Vec<String>> = HashMap::new();
        for resource in self.depot.resources.values() {
            hash_map
                .entry(resource.hash.clone())
                .or_default()
                .push(resource.id.clone());
        }
        hash_map.retain(|_, ids| ids.len() > 1);
        hash_map
    }

    // ─── クラウドストレージ ───

    pub fn add_cloud_config(&mut self, config: CloudStorageConfig) -> Result<()> {
        self.depot.config.cloud_configs.push(config);
        self.save()?;
        Ok(())
    }

    pub fn set_cloud_reference(
        &mut self,
        resource_id: &str,
        cloud_ref: CloudReference,
    ) -> Result<()> {
        let resource = self
            .depot
            .resources
            .get_mut(resource_id)
            .ok_or_else(|| DepotError::ResourceNotFound(resource_id.to_string()))?;
        resource.cloud_ref = Some(cloud_ref);
        resource.status = ResourceStatus::Available;
        self.save()?;
        Ok(())
    }

    pub fn get_depot(&self) -> &ResourceDepot {
        &self.depot
    }
}
