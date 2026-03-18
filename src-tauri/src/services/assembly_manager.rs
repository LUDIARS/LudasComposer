use std::path::{Path, PathBuf};
use thiserror::Error;

use crate::models::assembly::*;

#[derive(Error, Debug)]
pub enum AssemblyError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Core assembly not found: {0}")]
    CoreAssemblyNotFound(String),
    #[error("Application assembly not found: {0}")]
    AppAssemblyNotFound(String),
    #[error("Release depot not found: {0}")]
    DepotNotFound(String),
    #[error("Duplicate ID: {0}")]
    DuplicateId(String),
}

/// プロジェクト単位でアセンブリを管理するサービス
pub struct AssemblyManagerService {
    /// プロジェクトのルートディレクトリ
    project_root: PathBuf,
    /// アセンブリ設定
    config: ProjectAssemblyConfig,
}

impl AssemblyManagerService {
    /// 新規作成
    pub fn new(project_root: PathBuf) -> Self {
        Self {
            project_root,
            config: ProjectAssemblyConfig::default(),
        }
    }

    /// 設定ファイルから読み込み
    pub fn load(project_root: PathBuf) -> Result<Self, AssemblyError> {
        let config_path = Self::config_path(&project_root);
        if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)?;
            let config: ProjectAssemblyConfig = serde_json::from_str(&content)?;
            Ok(Self {
                project_root,
                config,
            })
        } else {
            Ok(Self::new(project_root))
        }
    }

    /// 設定ファイルに保存
    pub fn save(&self) -> Result<(), AssemblyError> {
        let config_path = Self::config_path(&self.project_root);
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(&self.config)?;
        std::fs::write(&config_path, content)?;
        Ok(())
    }

    fn config_path(project_root: &Path) -> PathBuf {
        project_root.join("assembly.config.json")
    }

    // ─── 設定全体 ───

    /// 現在の設定を取得
    pub fn get_config(&self) -> &ProjectAssemblyConfig {
        &self.config
    }

    // ─── リリースデポ管理 ───

    /// リリースデポを追加
    pub fn add_release_depot(&mut self, depot: ReleaseDepotConfig) -> Result<(), AssemblyError> {
        if self
            .config
            .release_depots
            .iter()
            .any(|d| d.name == depot.name)
        {
            return Err(AssemblyError::DuplicateId(depot.name));
        }
        self.config.release_depots.push(depot);
        self.save()
    }

    /// リリースデポを削除
    pub fn remove_release_depot(&mut self, name: &str) -> Result<(), AssemblyError> {
        let before = self.config.release_depots.len();
        self.config.release_depots.retain(|d| d.name != name);
        if self.config.release_depots.len() == before {
            return Err(AssemblyError::DepotNotFound(name.to_string()));
        }
        self.save()
    }

    /// リリースデポ一覧を取得
    pub fn get_release_depots(&self) -> &[ReleaseDepotConfig] {
        &self.config.release_depots
    }

    // ─── コアアセンブリ管理 ───

    /// コアアセンブリを追加
    pub fn add_core_assembly(&mut self, assembly: CoreAssembly) -> Result<(), AssemblyError> {
        if self
            .config
            .core_assemblies
            .iter()
            .any(|a| a.id == assembly.id)
        {
            return Err(AssemblyError::DuplicateId(assembly.id));
        }
        self.config.core_assemblies.push(assembly);
        self.save()
    }

    /// コアアセンブリを更新
    pub fn update_core_assembly(&mut self, assembly: CoreAssembly) -> Result<(), AssemblyError> {
        let pos = self
            .config
            .core_assemblies
            .iter()
            .position(|a| a.id == assembly.id)
            .ok_or_else(|| AssemblyError::CoreAssemblyNotFound(assembly.id.clone()))?;
        self.config.core_assemblies[pos] = assembly;
        self.save()
    }

    /// コアアセンブリを削除
    pub fn remove_core_assembly(&mut self, id: &str) -> Result<(), AssemblyError> {
        let before = self.config.core_assemblies.len();
        self.config.core_assemblies.retain(|a| a.id != id);
        if self.config.core_assemblies.len() == before {
            return Err(AssemblyError::CoreAssemblyNotFound(id.to_string()));
        }
        self.save()
    }

    /// コアアセンブリを取得
    pub fn get_core_assembly(&self, id: &str) -> Option<&CoreAssembly> {
        self.config.core_assemblies.iter().find(|a| a.id == id)
    }

    /// コアアセンブリ一覧を取得
    pub fn get_core_assemblies(&self) -> &[CoreAssembly] {
        &self.config.core_assemblies
    }

    /// 取得元でフィルタ
    pub fn get_core_assemblies_by_origin(&self, origin: &CoreAssemblyOrigin) -> Vec<&CoreAssembly> {
        self.config
            .core_assemblies
            .iter()
            .filter(|a| &a.origin == origin)
            .collect()
    }

    // ─── アプリケーションアセンブリ管理 ───

    /// アプリケーションアセンブリを追加
    pub fn add_app_assembly(&mut self, assembly: ApplicationAssembly) -> Result<(), AssemblyError> {
        if self
            .config
            .application_assemblies
            .iter()
            .any(|a| a.id == assembly.id)
        {
            return Err(AssemblyError::DuplicateId(assembly.id));
        }
        self.config.application_assemblies.push(assembly);
        self.save()
    }

    /// アプリケーションアセンブリを更新
    pub fn update_app_assembly(
        &mut self,
        assembly: ApplicationAssembly,
    ) -> Result<(), AssemblyError> {
        let pos = self
            .config
            .application_assemblies
            .iter()
            .position(|a| a.id == assembly.id)
            .ok_or_else(|| AssemblyError::AppAssemblyNotFound(assembly.id.clone()))?;
        self.config.application_assemblies[pos] = assembly;
        self.save()
    }

    /// アプリケーションアセンブリを削除
    pub fn remove_app_assembly(&mut self, id: &str) -> Result<(), AssemblyError> {
        let before = self.config.application_assemblies.len();
        self.config.application_assemblies.retain(|a| a.id != id);
        if self.config.application_assemblies.len() == before {
            return Err(AssemblyError::AppAssemblyNotFound(id.to_string()));
        }
        self.save()
    }

    /// アプリケーションアセンブリを取得
    pub fn get_app_assembly(&self, id: &str) -> Option<&ApplicationAssembly> {
        self.config
            .application_assemblies
            .iter()
            .find(|a| a.id == id)
    }

    /// アプリケーションアセンブリ一覧を取得
    pub fn get_app_assemblies(&self) -> &[ApplicationAssembly] {
        &self.config.application_assemblies
    }

    /// シーンに紐づくアプリケーションアセンブリを取得
    pub fn get_app_assemblies_by_scene(&self, scene_id: &str) -> Vec<&ApplicationAssembly> {
        self.config
            .application_assemblies
            .iter()
            .filter(|a| a.scene_id.as_deref() == Some(scene_id))
            .collect()
    }

    /// スコープでフィルタ
    pub fn get_app_assemblies_by_scope(&self, scope: &AssemblyScope) -> Vec<&ApplicationAssembly> {
        self.config
            .application_assemblies
            .iter()
            .filter(|a| &a.scope == scope)
            .collect()
    }

    // ─── 外部システム参照設定 ───

    /// リソースデポ参照を設定
    pub fn set_resource_depot_ref(
        &mut self,
        depot_ref: Option<ResourceDepotRef>,
    ) -> Result<(), AssemblyError> {
        self.config.resource_depot_ref = depot_ref;
        self.save()
    }

    /// データオーガナイザー参照を設定
    pub fn set_data_organizer_ref(
        &mut self,
        org_ref: Option<DataOrganizerRef>,
    ) -> Result<(), AssemblyError> {
        self.config.data_organizer_ref = org_ref;
        self.save()
    }

    // ─── 依存関係解析 ───

    /// アプリケーションアセンブリの依存するコアアセンブリを解決
    pub fn resolve_core_dependencies(
        &self,
        app_assembly_id: &str,
    ) -> Result<Vec<&CoreAssembly>, AssemblyError> {
        let app = self
            .get_app_assembly(app_assembly_id)
            .ok_or_else(|| AssemblyError::AppAssemblyNotFound(app_assembly_id.to_string()))?;
        let deps: Vec<&CoreAssembly> = app
            .core_assembly_dependencies
            .iter()
            .filter_map(|dep_id| self.get_core_assembly(dep_id))
            .collect();
        Ok(deps)
    }

    /// ビルドターゲットごとのアセンブリ一覧を取得
    pub fn get_assemblies_for_target(
        &self,
        target: &BuildTarget,
    ) -> (Vec<&CoreAssembly>, Vec<&ApplicationAssembly>) {
        let cores = self
            .config
            .core_assemblies
            .iter()
            .filter(|a| a.build_targets.contains(target))
            .collect();
        let apps = self
            .config
            .application_assemblies
            .iter()
            .filter(|a| a.build_configs.iter().any(|bc| &bc.target == target))
            .collect();
        (cores, apps)
    }
}
