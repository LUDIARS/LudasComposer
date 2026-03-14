use git2::{Cred, FetchOptions, PushOptions, RemoteCallbacks, Repository, Signature};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::models::Project;

const PROJECTS_DIR: &str = "ars-projects";
const PROJECT_FILE: &str = "project.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitRepo {
    pub name: String,
    pub full_name: String,
    pub description: Option<String>,
    pub html_url: String,
    pub clone_url: String,
    #[serde(rename = "private")]
    pub is_private: bool,
    #[serde(rename = "updated_at")]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitProjectInfo {
    pub repo_full_name: String,
    pub branch: String,
    pub has_project: bool,
    pub local_path: String,
}

fn get_projects_base_dir() -> PathBuf {
    let home = dirs_next::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(PROJECTS_DIR)
}

fn get_repo_local_path(full_name: &str) -> PathBuf {
    get_projects_base_dir().join(full_name.replace('/', "_"))
}

fn make_callbacks(token: &str) -> RemoteCallbacks<'_> {
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |_url, _username_from_url, _allowed_types| {
        Cred::userpass_plaintext("x-access-token", token)
    });
    callbacks
}

/// List user's GitHub repositories via the API
pub async fn list_repos(access_token: &str) -> Result<Vec<GitRepo>, String> {
    let client = reqwest::Client::new();
    let mut all_repos = Vec::new();
    let mut page = 1u32;

    loop {
        let repos: Vec<GitRepo> = client
            .get("https://api.github.com/user/repos")
            .query(&[
                ("per_page", "100"),
                ("page", &page.to_string()),
                ("sort", "updated"),
                ("affiliation", "owner"),
            ])
            .header("Authorization", format!("Bearer {}", access_token))
            .header("User-Agent", "ArsEditor")
            .header("Accept", "application/vnd.github+json")
            .send()
            .await
            .map_err(|e| format!("Failed to fetch repos: {}", e))?
            .json()
            .await
            .map_err(|e| format!("Failed to parse repos: {}", e))?;

        if repos.is_empty() {
            break;
        }
        all_repos.extend(repos);
        page += 1;

        // Safety limit
        if page > 10 {
            break;
        }
    }

    Ok(all_repos)
}

/// Create a new GitHub repository
pub async fn create_repo(
    access_token: &str,
    name: &str,
    description: Option<&str>,
    private: bool,
) -> Result<GitRepo, String> {
    let client = reqwest::Client::new();
    let mut body = serde_json::json!({
        "name": name,
        "private": private,
        "auto_init": true,
    });
    if let Some(desc) = description {
        body["description"] = serde_json::Value::String(desc.to_string());
    }

    let repo: GitRepo = client
        .post("https://api.github.com/user/repos")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "ArsEditor")
        .header("Accept", "application/vnd.github+json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to create repo: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse created repo: {}", e))?;

    Ok(repo)
}

/// Clone a GitHub repository to local storage
pub fn clone_repo(access_token: &str, clone_url: &str, full_name: &str) -> Result<PathBuf, String> {
    let local_path = get_repo_local_path(full_name);

    // If already cloned, pull instead
    if local_path.exists() {
        return pull_repo(access_token, &local_path).map(|_| local_path);
    }

    std::fs::create_dir_all(&local_path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    let callbacks = make_callbacks(access_token);
    let mut fo = FetchOptions::new();
    fo.remote_callbacks(callbacks);

    let mut builder = git2::build::RepoBuilder::new();
    builder.fetch_options(fo);

    builder
        .clone(clone_url, &local_path)
        .map_err(|e| format!("Failed to clone repository: {}", e))?;

    Ok(local_path)
}

/// Pull latest changes from remote
fn pull_repo(access_token: &str, local_path: &Path) -> Result<(), String> {
    let repo = Repository::open(local_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut remote = repo
        .find_remote("origin")
        .map_err(|e| format!("Failed to find remote: {}", e))?;

    let callbacks = make_callbacks(access_token);
    let mut fo = FetchOptions::new();
    fo.remote_callbacks(callbacks);

    let branch = get_default_branch(&repo)?;

    remote
        .fetch(&[&branch], Some(&mut fo), None)
        .map_err(|e| format!("Failed to fetch: {}", e))?;

    // Fast-forward merge
    let fetch_head = repo
        .find_reference("FETCH_HEAD")
        .map_err(|e| format!("Failed to find FETCH_HEAD: {}", e))?;
    let fetch_commit = repo
        .reference_to_annotated_commit(&fetch_head)
        .map_err(|e| format!("Failed to get commit: {}", e))?;

    let (analysis, _) = repo
        .merge_analysis(&[&fetch_commit])
        .map_err(|e| format!("Merge analysis failed: {}", e))?;

    if analysis.is_up_to_date() {
        return Ok(());
    }

    if analysis.is_fast_forward() {
        let refname = format!("refs/heads/{}", branch);
        let mut reference = repo
            .find_reference(&refname)
            .map_err(|e| format!("Failed to find reference: {}", e))?;
        reference
            .set_target(fetch_commit.id(), "Fast-forward")
            .map_err(|e| format!("Failed to set target: {}", e))?;
        repo.set_head(&refname)
            .map_err(|e| format!("Failed to set HEAD: {}", e))?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))
            .map_err(|e| format!("Failed to checkout: {}", e))?;
    }

    Ok(())
}

fn get_default_branch(repo: &Repository) -> Result<String, String> {
    // Try to get branch from HEAD
    if let Ok(head) = repo.head() {
        if let Some(name) = head.shorthand() {
            return Ok(name.to_string());
        }
    }
    Ok("main".to_string())
}

/// Load project from a cloned repository
pub fn load_project_from_repo(full_name: &str) -> Result<Option<Project>, String> {
    let local_path = get_repo_local_path(full_name);
    let project_file = local_path.join(PROJECT_FILE);

    if !project_file.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(&project_file)
        .map_err(|e| format!("Failed to read project file: {}", e))?;
    let project: Project = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse project: {}", e))?;

    Ok(Some(project))
}

/// Save project to a cloned repository and push
pub fn save_and_push(
    access_token: &str,
    full_name: &str,
    project: &Project,
    commit_message: &str,
) -> Result<(), String> {
    let local_path = get_repo_local_path(full_name);
    let project_file = local_path.join(PROJECT_FILE);

    // Ensure directory exists
    if !local_path.exists() {
        return Err("Repository not cloned locally. Clone it first.".to_string());
    }

    // Write project file
    let content = serde_json::to_string_pretty(project)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;
    std::fs::write(&project_file, content)
        .map_err(|e| format!("Failed to write project file: {}", e))?;

    // Git add, commit, push
    let repo = Repository::open(&local_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    // Stage the file
    let mut index = repo.index()
        .map_err(|e| format!("Failed to get index: {}", e))?;
    index
        .add_path(Path::new(PROJECT_FILE))
        .map_err(|e| format!("Failed to stage file: {}", e))?;
    index.write()
        .map_err(|e| format!("Failed to write index: {}", e))?;

    let oid = index
        .write_tree()
        .map_err(|e| format!("Failed to write tree: {}", e))?;
    let tree = repo
        .find_tree(oid)
        .map_err(|e| format!("Failed to find tree: {}", e))?;

    let signature = Signature::now("Ars Editor", "ars@editor.local")
        .map_err(|e| format!("Failed to create signature: {}", e))?;

    let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    let parents: Vec<&git2::Commit> = parent.as_ref().map(|c| vec![c]).unwrap_or_default();

    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        commit_message,
        &tree,
        &parents,
    )
    .map_err(|e| format!("Failed to commit: {}", e))?;

    // Push
    let mut remote = repo
        .find_remote("origin")
        .map_err(|e| format!("Failed to find remote: {}", e))?;

    let branch = get_default_branch(&repo)?;
    let callbacks = make_callbacks(access_token);
    let mut push_options = PushOptions::new();
    push_options.remote_callbacks(callbacks);

    remote
        .push(
            &[format!("refs/heads/{}:refs/heads/{}", branch, branch)],
            Some(&mut push_options),
        )
        .map_err(|e| format!("Failed to push: {}", e))?;

    Ok(())
}

/// List locally cloned projects
pub fn list_local_projects() -> Result<Vec<GitProjectInfo>, String> {
    let base_dir = get_projects_base_dir();
    if !base_dir.exists() {
        return Ok(Vec::new());
    }

    let mut projects = Vec::new();
    let entries = std::fs::read_dir(&base_dir)
        .map_err(|e| format!("Failed to read projects directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        // Check if it's a git repo
        if let Ok(repo) = Repository::open(&path) {
            let branch = get_default_branch(&repo).unwrap_or_else(|_| "main".to_string());
            let full_name = path
                .file_name()
                .map(|n| n.to_string_lossy().replace('_', "/"))
                .unwrap_or_default();

            // Replace only the first underscore (owner/repo)
            let full_name = if let Some(pos) = full_name.find('/') {
                full_name[..pos].to_string() + "/" + &full_name[pos + 1..]
            } else {
                full_name
            };

            let has_project = path.join(PROJECT_FILE).exists();

            projects.push(GitProjectInfo {
                repo_full_name: full_name,
                branch,
                has_project,
                local_path: path.to_string_lossy().to_string(),
            });
        }
    }

    Ok(projects)
}
