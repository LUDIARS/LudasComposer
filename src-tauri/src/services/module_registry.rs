use crate::models::*;
use crate::services::git_clone::GitCloneService;
use crate::services::module_parser;
use std::path::{Path, PathBuf};
use thiserror::Error;
use walkdir::WalkDir;

#[derive(Error, Debug)]
pub enum RegistryError {
    #[error("Git clone error: {0}")]
    GitError(#[from] crate::services::git_clone::GitCloneError),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Registry file parse error: {0}")]
    ParseError(String),

    #[error("Source not found: {0}")]
    SourceNotFound(String),
}

/// モジュールレジストリサービス
/// GitHubリポジトリからモジュール定義を取得・管理する
pub struct ModuleRegistryService {
    git_service: GitCloneService,
    registry: ModuleRegistry,
    /// レジストリ設定の保存先パス
    config_path: PathBuf,
}

impl ModuleRegistryService {
    /// 新しいModuleRegistryServiceを作成
    pub fn new(cache_dir: PathBuf) -> Self {
        let config_path = cache_dir.join("registry.json");
        Self {
            git_service: GitCloneService::new(cache_dir),
            registry: ModuleRegistry::default(),
            config_path,
        }
    }

    /// デフォルト設定で作成
    pub fn with_defaults() -> Result<Self, RegistryError> {
        let git_service = GitCloneService::with_default_cache()?;
        let cache_dir = git_service.cache_dir().to_path_buf();
        let config_path = cache_dir.join("registry.json");

        let mut service = Self {
            git_service,
            registry: ModuleRegistry::default(),
            config_path,
        };

        // 既存の設定を読み込む
        service.load_config()?;

        Ok(service)
    }

    /// レジストリソース（GitHubリポジトリ）を追加
    pub fn add_source(
        &mut self,
        name: &str,
        repo_url: &str,
        definition_glob: &str,
    ) -> Result<&ModuleRegistrySource, RegistryError> {
        let id = uuid::Uuid::new_v4().to_string();
        let source = ModuleRegistrySource {
            id: id.clone(),
            name: name.to_string(),
            repo_url: repo_url.to_string(),
            local_path: None,
            definition_glob: definition_glob.to_string(),
            last_synced: None,
        };
        self.registry.sources.push(source);
        self.save_config()?;

        Ok(self.registry.sources.last().unwrap())
    }

    /// レジストリソースを削除
    pub fn remove_source(&mut self, source_id: &str) -> Result<(), RegistryError> {
        let idx = self
            .registry
            .sources
            .iter()
            .position(|s| s.id == source_id)
            .ok_or_else(|| RegistryError::SourceNotFound(source_id.to_string()))?;

        self.registry.sources.remove(idx);

        // このソースからのモジュールも削除
        self.registry
            .modules
            .retain(|m| m.source_repo.as_deref() != Some(source_id));

        self.save_config()?;
        Ok(())
    }

    /// 指定ソースからモジュール定義を同期（clone/pull + parse）
    pub fn sync_source(&mut self, source_id: &str) -> Result<Vec<ModuleDefinition>, RegistryError> {
        let source = self
            .registry
            .sources
            .iter_mut()
            .find(|s| s.id == source_id)
            .ok_or_else(|| RegistryError::SourceNotFound(source_id.to_string()))?;

        // クローンまたはプル
        let local_path = self.git_service.clone_or_pull(&source.repo_url)?;
        source.local_path = Some(local_path.to_string_lossy().to_string());
        source.last_synced = Some(chrono_now());

        let repo_url = source.repo_url.clone();
        let glob_pattern = source.definition_glob.clone();
        let source_id_owned = source_id.to_string();

        // 古いモジュールを削除
        self.registry
            .modules
            .retain(|m| m.source_repo.as_deref() != Some(&source_id_owned));

        // 定義ファイルを検索してパース
        let new_modules = scan_and_parse_definitions(&local_path, &glob_pattern, &repo_url)?;

        let result = new_modules.clone();
        self.registry.modules.extend(new_modules);
        self.save_config()?;

        Ok(result)
    }

    /// 全ソースを同期
    pub fn sync_all(&mut self) -> Result<Vec<ModuleDefinition>, RegistryError> {
        let source_ids: Vec<String> = self.registry.sources.iter().map(|s| s.id.clone()).collect();
        let mut all_modules = Vec::new();

        for source_id in source_ids {
            match self.sync_source(&source_id) {
                Ok(modules) => all_modules.extend(modules),
                Err(e) => {
                    eprintln!("Failed to sync source {}: {}", source_id, e);
                }
            }
        }

        Ok(all_modules)
    }

    /// 全モジュール定義を取得
    pub fn get_all_modules(&self) -> &[ModuleDefinition] {
        &self.registry.modules
    }

    /// カテゴリでフィルタ
    pub fn get_modules_by_category(&self, category: &ModuleCategory) -> Vec<&ModuleDefinition> {
        self.registry
            .modules
            .iter()
            .filter(|m| &m.category == category)
            .collect()
    }

    /// 名前で検索
    pub fn search_modules(&self, query: &str) -> Vec<&ModuleDefinition> {
        let query_lower = query.to_lowercase();
        self.registry
            .modules
            .iter()
            .filter(|m| {
                m.name.to_lowercase().contains(&query_lower)
                    || m.summary.to_lowercase().contains(&query_lower)
                    || m.domain.to_lowercase().contains(&query_lower)
            })
            .collect()
    }

    /// IDでモジュールを取得
    pub fn get_module(&self, module_id: &str) -> Option<&ModuleDefinition> {
        self.registry.modules.iter().find(|m| m.id == module_id)
    }

    /// 全ソースを取得
    pub fn get_sources(&self) -> &[ModuleRegistrySource] {
        &self.registry.sources
    }

    /// レジストリを取得
    pub fn get_registry(&self) -> &ModuleRegistry {
        &self.registry
    }

    /// 設定を保存
    fn save_config(&self) -> Result<(), RegistryError> {
        if let Some(parent) = self.config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(&self.registry)
            .map_err(|e| RegistryError::ParseError(e.to_string()))?;
        std::fs::write(&self.config_path, json)?;
        Ok(())
    }

    /// 設定を読み込み
    fn load_config(&mut self) -> Result<(), RegistryError> {
        if self.config_path.exists() {
            let content = std::fs::read_to_string(&self.config_path)?;
            self.registry = serde_json::from_str(&content)
                .map_err(|e| RegistryError::ParseError(e.to_string()))?;
        }
        Ok(())
    }
}

/// ディレクトリ内のモジュール定義ファイルを検索してパース
fn scan_and_parse_definitions(
    base_path: &Path,
    glob_pattern: &str,
    repo_url: &str,
) -> Result<Vec<ModuleDefinition>, RegistryError> {
    let mut all_modules = Vec::new();

    // globパターンからファイル拡張子を取得
    let extension = if glob_pattern.contains("*.md") {
        Some("md")
    } else if glob_pattern.contains("*.json") {
        Some("json")
    } else {
        None
    };

    // globパターンからサブディレクトリを取得
    let search_dir = if let Some(dir_part) = glob_pattern.split('*').next() {
        let dir_part = dir_part.trim_end_matches('/');
        if dir_part.is_empty() {
            base_path.to_path_buf()
        } else {
            base_path.join(dir_part)
        }
    } else {
        base_path.to_path_buf()
    };

    // ディレクトリが存在しない場合はベースパスから検索
    let search_root = if search_dir.exists() {
        search_dir
    } else {
        base_path.to_path_buf()
    };

    for entry in WalkDir::new(&search_root)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        // 拡張子チェック
        let matches = match extension {
            Some(ext) => path.extension().map_or(false, |e| e == ext),
            None => path.extension().map_or(false, |e| e == "md"),
        };

        if !matches || !path.is_file() {
            continue;
        }

        // .git内のファイルはスキップ
        if path.to_string_lossy().contains("/.git/") {
            continue;
        }

        match std::fs::read_to_string(path) {
            Ok(content) => {
                let relative_path = path
                    .strip_prefix(base_path)
                    .unwrap_or(path)
                    .to_string_lossy()
                    .to_string();

                let mut modules =
                    module_parser::parse_module_markdown(&content, Some(&relative_path));

                // ソースリポジトリ情報を付与
                for module in &mut modules {
                    module.source_repo = Some(repo_url.to_string());
                }

                all_modules.extend(modules);
            }
            Err(e) => {
                eprintln!("Failed to read {}: {}", path.display(), e);
            }
        }
    }

    Ok(all_modules)
}

/// 現在時刻を文字列で返す（簡易実装）
fn chrono_now() -> String {
    // std::time だけで簡易的に
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}", now.as_secs())
}
