use git2::{FetchOptions, Repository};
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GitCloneError {
    #[error("Git operation failed: {0}")]
    GitError(#[from] git2::Error),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Invalid repository URL: {0}")]
    InvalidUrl(String),

    #[error("Cache directory not found")]
    CacheDirectoryNotFound,
}

/// GitHubリポジトリをローカルにクローン/プルするサービス
pub struct GitCloneService {
    /// クローンしたリポジトリを保存するベースディレクトリ
    cache_dir: PathBuf,
}

impl GitCloneService {
    /// 新しいGitCloneServiceを作成
    /// cache_dir: リポジトリキャッシュ用ディレクトリ
    pub fn new(cache_dir: PathBuf) -> Self {
        Self { cache_dir }
    }

    /// デフォルトのキャッシュディレクトリを使って作成
    /// $HOME/.ars/module-cache/
    pub fn with_default_cache() -> Result<Self, GitCloneError> {
        let home = dirs::data_local_dir().ok_or(GitCloneError::CacheDirectoryNotFound)?;
        let cache_dir = home.join("ars").join("module-cache");
        Ok(Self { cache_dir })
    }

    /// リポジトリURLからローカルパスを決定
    /// e.g., "https://github.com/user/repo" -> "{cache_dir}/github.com/user/repo"
    pub fn repo_local_path(&self, repo_url: &str) -> Result<PathBuf, GitCloneError> {
        let url = repo_url
            .trim_end_matches('/')
            .trim_end_matches(".git");

        // URLからホスト/ユーザー/リポジトリを抽出
        let parts: Vec<&str> = url.split("://").collect();
        let path_part = if parts.len() == 2 {
            parts[1]
        } else if url.starts_with("git@") {
            // git@github.com:user/repo 形式
            &url[4..].replace(':', "/")
                .leak() // 簡易的な処理
        } else {
            return Err(GitCloneError::InvalidUrl(repo_url.to_string()));
        };

        Ok(self.cache_dir.join(path_part))
    }

    /// リポジトリをクローンまたは既存なら最新をプル
    pub fn clone_or_pull(&self, repo_url: &str) -> Result<PathBuf, GitCloneError> {
        let local_path = self.repo_local_path(repo_url)?;

        if local_path.exists() && local_path.join(".git").exists() {
            // 既にクローン済み → プルで最新化
            self.pull_latest(&local_path)?;
        } else {
            // 新規クローン
            self.clone_repo(repo_url, &local_path)?;
        }

        Ok(local_path)
    }

    /// リポジトリを新規クローン
    fn clone_repo(&self, repo_url: &str, local_path: &Path) -> Result<(), GitCloneError> {
        // 親ディレクトリを作成
        if let Some(parent) = local_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        Repository::clone(repo_url, local_path)?;
        Ok(())
    }

    /// 既存リポジトリのデフォルトブランチをプル
    fn pull_latest(&self, local_path: &Path) -> Result<(), GitCloneError> {
        let repo = Repository::open(local_path)?;

        // originからfetch
        let mut remote = repo.find_remote("origin")?;
        let mut fetch_opts = FetchOptions::new();
        remote.fetch(&["refs/heads/*:refs/remotes/origin/*"], Some(&mut fetch_opts), None)?;

        // デフォルトブランチを検出 (main or master)
        let default_branch = self.detect_default_branch(&repo)?;

        // fast-forward merge
        let fetch_head = repo.find_reference(&format!("refs/remotes/origin/{}", default_branch))?;
        let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)?;

        let (analysis, _) = repo.merge_analysis(&[&fetch_commit])?;

        if analysis.is_fast_forward() {
            let refname = format!("refs/heads/{}", default_branch);
            if let Ok(mut reference) = repo.find_reference(&refname) {
                reference.set_target(fetch_commit.id(), "fast-forward pull")?;
            }
            repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;
        }
        // up-to-date or diverged: skip (don't force overwrite)

        Ok(())
    }

    /// デフォルトブランチ名を検出
    fn detect_default_branch(&self, repo: &Repository) -> Result<String, GitCloneError> {
        // HEAD参照からデフォルトブランチを特定
        if let Ok(head) = repo.head() {
            if let Some(name) = head.shorthand() {
                return Ok(name.to_string());
            }
        }

        // フォールバック: main → master の順で試行
        for branch in &["main", "master"] {
            let refname = format!("refs/remotes/origin/{}", branch);
            if repo.find_reference(&refname).is_ok() {
                return Ok(branch.to_string());
            }
        }

        Ok("main".to_string())
    }

    /// キャッシュディレクトリのパスを返す
    pub fn cache_dir(&self) -> &Path {
        &self.cache_dir
    }
}
