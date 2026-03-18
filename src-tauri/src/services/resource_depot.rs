use crate::models::resource_depot::*;
use std::fs;
use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ResourceDepotError {
    #[error("リソースが見つかりません: {0}")]
    ResourceNotFound(String),
    #[error("デポデータが見つかりません: {0}")]
    DepotNotFound(String),
    #[error("ファイルI/Oエラー: {0}")]
    IoError(#[from] std::io::Error),
    #[error("JSONエラー: {0}")]
    JsonError(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, ResourceDepotError>;

/// リソースデポ リードオンリークライアント
///
/// Resource Depotツールが管理するdepot.jsonを読み取り専用で参照する。
/// Ars / Ars-Editor はこのクライアント経由でリソースデータにアクセスする。
pub struct ResourceDepotService {
    depot: ResourceDepot,
    depot_file: PathBuf,
}

impl ResourceDepotService {
    /// デフォルトパスで初期化（~/.ars/resource-depot/depot.json）
    pub fn with_defaults() -> Result<Self> {
        let depot_file = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".ars")
            .join("resource-depot")
            .join("depot.json");
        Self::new(depot_file)
    }

    /// depot.jsonファイルパスを指定して初期化
    pub fn new(depot_file: PathBuf) -> Result<Self> {
        let depot = if depot_file.exists() {
            let content = fs::read_to_string(&depot_file)?;
            serde_json::from_str(&content)?
        } else {
            ResourceDepot::default()
        };

        Ok(Self { depot, depot_file })
    }

    /// depot.jsonを再読み込み（ツール側で更新された場合）
    pub fn reload(&mut self) -> Result<()> {
        if self.depot_file.exists() {
            let content = fs::read_to_string(&self.depot_file)?;
            self.depot = serde_json::from_str(&content)?;
        }
        Ok(())
    }

    // ─── リードオンリーアクセス ───

    /// リソース取得
    pub fn get_resource(&self, resource_id: &str) -> Result<&Resource> {
        self.depot
            .resources
            .get(resource_id)
            .ok_or_else(|| ResourceDepotError::ResourceNotFound(resource_id.to_string()))
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

    /// ファイル名と役割でリソース検索
    pub fn find_resources(&self, query: &str) -> Vec<Resource> {
        let query_lower = query.to_lowercase();
        self.depot
            .resources
            .values()
            .filter(|r| {
                r.filename.to_lowercase().contains(&query_lower)
                    || r.role.to_lowercase().contains(&query_lower)
            })
            .cloned()
            .collect()
    }

    /// 全ボーンパターン取得
    pub fn get_bone_patterns(&self) -> Vec<BonePattern> {
        self.depot.bone_patterns.values().cloned().collect()
    }

    /// ボーンパターンに適合するモーションを検索
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

    /// 全モーショングループ取得
    pub fn get_motion_groups(&self) -> Vec<MotionGroup> {
        self.depot.motion_groups.values().cloned().collect()
    }

    /// 全テクスチャグループ取得
    pub fn get_texture_groups(&self) -> Vec<TextureGroup> {
        self.depot.texture_groups.values().cloned().collect()
    }

    /// デポ全体を取得
    pub fn get_depot(&self) -> &ResourceDepot {
        &self.depot
    }
}
