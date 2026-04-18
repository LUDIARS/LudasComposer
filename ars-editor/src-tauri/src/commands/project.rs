use crate::models::{Message, MessageType, Project};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

/// 許可ディレクトリを取得（パストラバーサル防止用のベース）
fn allowed_base_dir() -> Result<PathBuf, String> {
    let base = get_default_project_path_impl()?;
    fs::canonicalize(&base).map_err(|e| format!("Failed to resolve allowed directory: {}", e))
}

/// 与えられた `target` が `allowed` 配下であることを検証する
fn ensure_within_allowed(target: &Path, allowed: &Path) -> Result<(), String> {
    if !target.starts_with(allowed) {
        return Err(format!(
            "Access denied: path must be within {}",
            allowed.display()
        ));
    }
    Ok(())
}

/// path を解決して「プロジェクトディレクトリ」と、旧式 JSON パス（該当時）を返す
///
/// * `path` が `.json` で終わる場合: 旧式。親ディレクトリをプロジェクトディレクトリとし、
///   同時にレガシー単一 JSON ファイルのパスも返す。
/// * それ以外: `path` 自体をプロジェクトディレクトリとして扱う。
fn resolve_project_dir(path: &str) -> Result<(PathBuf, Option<PathBuf>), String> {
    let allowed = allowed_base_dir()?;
    let p = Path::new(path);
    let (project_dir, legacy_file) = if p.extension().and_then(|e| e.to_str()) == Some("json") {
        let parent = p
            .parent()
            .ok_or_else(|| "Invalid path: no parent".to_string())?;
        (parent.to_path_buf(), Some(p.to_path_buf()))
    } else {
        (p.to_path_buf(), None)
    };

    fs::create_dir_all(&project_dir)
        .map_err(|e| format!("Failed to create project directory: {}", e))?;
    let resolved_dir = fs::canonicalize(&project_dir)
        .map_err(|e| format!("Failed to resolve project directory: {}", e))?;
    ensure_within_allowed(&resolved_dir, &allowed)?;

    let resolved_legacy = match legacy_file {
        Some(f) => {
            let file_name = f
                .file_name()
                .ok_or_else(|| "Invalid path: no filename".to_string())?;
            Some(resolved_dir.join(file_name))
        }
        None => None,
    };

    Ok((resolved_dir, resolved_legacy))
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn save_project(path: String, project: Project) -> Result<(), String> {
    save_project_impl(path, project)
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn load_project(path: String) -> Result<Project, String> {
    load_project_impl(path)
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn get_default_project_path() -> Result<String, String> {
    get_default_project_path_impl()
}

pub fn save_project_impl(path: String, project: Project) -> Result<(), String> {
    let (project_dir, legacy_file) = resolve_project_dir(&path)?;

    ensure_project_layout(&project_dir)?;

    write_project_manifest(&project_dir, &project)?;
    write_codedesign(&project_dir, &project)?;
    write_gamedesign(&project_dir, &project)?;
    write_uidesign(&project_dir, &project)?;

    // 旧式 JSON パスを指定された場合は、互換性のため同じ JSON もそこに書く
    if let Some(file) = legacy_file {
        let json = serde_json::to_string_pretty(&project)
            .map_err(|e| format!("Failed to serialize project: {}", e))?;
        fs::write(&file, json).map_err(|e| format!("Failed to write legacy file: {}", e))?;
    }

    Ok(())
}

pub fn load_project_impl(path: String) -> Result<Project, String> {
    let (project_dir, legacy_file) = resolve_project_dir(&path)?;

    // 旧式 JSON 指定 or プロジェクト直下の project.json のどちらかから読む
    let manifest = legacy_file
        .filter(|f| f.exists())
        .unwrap_or_else(|| project_dir.join("project.json"));

    let content = fs::read_to_string(&manifest)
        .map_err(|e| format!("Failed to read project file '{}': {}", manifest.display(), e))?;
    let project: Project = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse project: {}", e))?;
    Ok(project)
}

pub fn get_default_project_path_impl() -> Result<String, String> {
    // ARS_PROJECT_DIR > cwd を基準に ./ars-projects
    let base = std::env::var("ARS_PROJECT_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
    let path: PathBuf = base.join("ars-projects");
    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}

pub fn list_projects_impl() -> Result<Vec<String>, String> {
    let dir = get_default_project_path_impl()?;
    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    let mut results = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        if path.is_dir() && path.join("project.json").exists() {
            if let Some(name) = path.file_name() {
                results.push(name.to_string_lossy().to_string());
            }
        } else if path.extension().map(|e| e == "json").unwrap_or(false) {
            if let Some(name) = path.file_name() {
                results.push(name.to_string_lossy().to_string());
            }
        }
    }
    Ok(results)
}

// ── プロジェクト保存レイアウト ──────────────────────

/// 保存ルールで定義されたトップレベルフォルダを全て作成する
fn ensure_project_layout(project_dir: &Path) -> Result<(), String> {
    const FOLDERS: &[&str] = &[
        "codedesign",
        "codedesign/interfaces",
        "codedesign/_components",
        "codedesign/_prefabs",
        "datadesign/user_data_scheme",
        "datadesign/master_data_scheme",
        "data_asset/master_data",
        "uidesign",
        "gamedesign/action",
        "gamedesign/level",
        "editor/users",
        "editor/global",
        "test",
    ];
    for rel in FOLDERS {
        let dir = project_dir.join(rel);
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create {}: {}", dir.display(), e))?;
    }
    Ok(())
}

/// プロジェクト全体の単一 JSON マニフェスト（正）を書き出す
fn write_project_manifest(project_dir: &Path, project: &Project) -> Result<(), String> {
    let json = serde_json::to_string_pretty(project)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;
    let path = project_dir.join("project.json");
    fs::write(&path, json)
        .map_err(|e| format!("Failed to write project.json: {}", e))?;
    Ok(())
}

// ── codedesign 出力 ────────────────────────────────

#[derive(Debug, Serialize)]
struct CodedesignProjectMeta<'a> {
    name: &'a str,
    #[serde(rename = "activeSceneId", skip_serializing_if = "Option::is_none")]
    active_scene_id: Option<&'a str>,
    scenes: Vec<SceneIndexEntry<'a>>,
}

#[derive(Debug, Serialize)]
struct SceneIndexEntry<'a> {
    id: &'a str,
    name: &'a str,
    dir: String,
}

#[derive(Debug, Serialize)]
struct CodedesignSceneMeta<'a> {
    id: &'a str,
    name: &'a str,
    #[serde(rename = "rootActorId")]
    root_actor_id: &'a str,
    actors: Vec<String>,
}

fn write_codedesign(project_dir: &Path, project: &Project) -> Result<(), String> {
    let base = project_dir.join("codedesign");

    // プロジェクト直下のメタ（シーン一覧）
    let scene_entries: Vec<SceneIndexEntry> = project
        .scenes
        .values()
        .map(|s| SceneIndexEntry {
            id: &s.id,
            name: &s.name,
            dir: sanitize_filename(&s.name),
        })
        .collect();
    let meta = CodedesignProjectMeta {
        name: &project.name,
        active_scene_id: project.active_scene_id.as_deref(),
        scenes: scene_entries,
    };
    write_json(&base.join("_project.json"), &meta)?;

    // シーンごとに _scene.json + アクター別ファイル
    for scene in project.scenes.values() {
        let scene_dir = base.join(sanitize_filename(&scene.name));
        fs::create_dir_all(&scene_dir)
            .map_err(|e| format!("Failed to create {}: {}", scene_dir.display(), e))?;
        let actor_files: Vec<String> = scene
            .actors
            .values()
            .map(|a| sanitize_filename(&a.name))
            .collect();
        let scene_meta = CodedesignSceneMeta {
            id: &scene.id,
            name: &scene.name,
            root_actor_id: &scene.root_actor_id,
            actors: actor_files,
        };
        write_json(&scene_dir.join("_scene.json"), &scene_meta)?;

        for actor in scene.actors.values() {
            let fname = format!("{}.json", sanitize_filename(&actor.name));
            write_json(&scene_dir.join(fname), actor)?;
        }
    }

    // コンポーネント・プレハブ
    let comp_dir = base.join("_components");
    for component in project.components.values() {
        let fname = format!("{}.json", sanitize_filename(&component.name));
        write_json(&comp_dir.join(fname), component)?;
    }
    let pref_dir = base.join("_prefabs");
    for prefab in project.prefabs.values() {
        let fname = format!("{}.json", sanitize_filename(&prefab.name));
        write_json(&pref_dir.join(fname), prefab)?;
    }

    // インタフェース（interface 型メッセージ）
    let iface_dir = base.join("interfaces");
    for scene in project.scenes.values() {
        for message in scene.messages.iter() {
            if matches!(message.message_type, MessageType::Interface) {
                let fname = format!(
                    "{}__{}.json",
                    sanitize_filename(&scene.name),
                    sanitize_filename(&message.name)
                );
                write_json(&iface_dir.join(fname), message)?;
            }
        }
    }

    prune_stale_scene_dirs(&base, project)?;
    Ok(())
}

/// シーン名が変わった際に古いシーンディレクトリが codedesign/ に残らないよう掃除する
fn prune_stale_scene_dirs(codedesign_dir: &Path, project: &Project) -> Result<(), String> {
    const RESERVED: &[&str] = &["interfaces", "_components", "_prefabs"];
    let keep: std::collections::HashSet<String> = project
        .scenes
        .values()
        .map(|s| sanitize_filename(&s.name))
        .collect();
    let entries = match fs::read_dir(codedesign_dir) {
        Ok(e) => e,
        Err(_) => return Ok(()),
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if RESERVED.contains(&name) || keep.contains(name) {
            continue;
        }
        let _ = fs::remove_dir_all(&path);
    }
    Ok(())
}

// ── gamedesign 出力 ────────────────────────────────

#[derive(Debug, Serialize)]
struct LevelData<'a> {
    id: &'a str,
    name: &'a str,
    #[serde(rename = "rootActorId")]
    root_actor_id: &'a str,
    messages: &'a [Message],
    #[serde(rename = "actorIds")]
    actor_ids: Vec<&'a str>,
}

fn write_gamedesign(project_dir: &Path, project: &Project) -> Result<(), String> {
    let action_base = project_dir.join("gamedesign").join("action");
    let level_base = project_dir.join("gamedesign").join("level");

    for scene in project.scenes.values() {
        // レベル（シーン）
        let level = LevelData {
            id: &scene.id,
            name: &scene.name,
            root_actor_id: &scene.root_actor_id,
            messages: &scene.messages,
            actor_ids: scene.actors.keys().map(|k| k.as_str()).collect(),
        };
        let fname = format!("{}.json", sanitize_filename(&scene.name));
        write_json(&level_base.join(fname), &level)?;

        // アクション（シーンごとにサブディレクトリ）
        let scene_action_dir = action_base.join(sanitize_filename(&scene.name));
        fs::create_dir_all(&scene_action_dir)
            .map_err(|e| format!("Failed to create {}: {}", scene_action_dir.display(), e))?;
        for action in scene.actions.values() {
            let fname = format!("{}.json", sanitize_filename(&action.name));
            write_json(&scene_action_dir.join(fname), action)?;
        }
    }

    Ok(())
}

// ── uidesign 出力（アクターの位置情報） ────────────

#[derive(Debug, Serialize)]
struct UiDesignEntry<'a> {
    #[serde(rename = "actorId")]
    actor_id: &'a str,
    #[serde(rename = "actorName")]
    actor_name: &'a str,
    x: f64,
    y: f64,
}

#[derive(Debug, Serialize)]
struct UiDesignScene<'a> {
    #[serde(rename = "sceneId")]
    scene_id: &'a str,
    #[serde(rename = "sceneName")]
    scene_name: &'a str,
    actors: Vec<UiDesignEntry<'a>>,
}

fn write_uidesign(project_dir: &Path, project: &Project) -> Result<(), String> {
    let base = project_dir.join("uidesign");
    for scene in project.scenes.values() {
        let entries: Vec<UiDesignEntry> = scene
            .actors
            .values()
            .map(|a| UiDesignEntry {
                actor_id: &a.id,
                actor_name: &a.name,
                x: a.position.x,
                y: a.position.y,
            })
            .collect();
        let doc = UiDesignScene {
            scene_id: &scene.id,
            scene_name: &scene.name,
            actors: entries,
        };
        let fname = format!("{}.json", sanitize_filename(&scene.name));
        write_json(&base.join(fname), &doc)?;
    }
    Ok(())
}

// ── ヘルパ ─────────────────────────────────────────

fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let json = serde_json::to_string_pretty(value)
        .map_err(|e| format!("Failed to serialize {}: {}", path.display(), e))?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create {}: {}", parent.display(), e))?;
    }
    fs::write(path, json)
        .map_err(|e| format!("Failed to write {}: {}", path.display(), e))
}

/// ファイル名に使えない文字を安全な文字に置き換える
fn sanitize_filename(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    for ch in name.chars() {
        match ch {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0' => out.push('_'),
            c if c.is_control() => out.push('_'),
            c => out.push(c),
        }
    }
    let trimmed = out.trim_matches(|c: char| c == ' ' || c == '.');
    if trimmed.is_empty() {
        "_".to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        Action, ActionType, Actor, Component, Message, MessageType, Position, Prefab, PrefabActor,
        Project, Requirements, Scene,
    };
    use std::collections::HashMap;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn with_env_dir<F: FnOnce(&Path)>(f: F) {
        let _guard = ENV_LOCK.lock().unwrap();
        let tmp = std::env::temp_dir().join(format!(
            "ars-save-test-{}-{}",
            std::process::id(),
            rand_suffix()
        ));
        fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("ARS_PROJECT_DIR", &tmp);
        f(&tmp);
        std::env::remove_var("ARS_PROJECT_DIR");
        let _ = fs::remove_dir_all(&tmp);
    }

    fn rand_suffix() -> String {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.subsec_nanos())
            .unwrap_or(0);
        format!("{:x}", nanos)
    }

    fn make_project() -> Project {
        let mut actors = HashMap::new();
        actors.insert(
            "a1".into(),
            Actor {
                id: "a1".into(),
                name: "Player".into(),
                role: "actor".into(),
                actor_type: "state".into(),
                requirements: Requirements::default(),
                actor_states: vec![],
                flexible_content: String::new(),
                displays: vec![],
                position: Position { x: 10.0, y: 20.0 },
                sub_scene_id: None,
            },
        );
        let mut actions = HashMap::new();
        actions.insert(
            "act1".into(),
            Action {
                id: "act1".into(),
                name: "Attack".into(),
                action_type: ActionType::UseCase,
                description: "攻撃".into(),
                behaviors: vec!["damage".into()],
                concretes: vec![],
            },
        );
        let scene = Scene {
            id: "s1".into(),
            name: "Main".into(),
            root_actor_id: "a1".into(),
            actors,
            messages: vec![Message {
                id: "m1".into(),
                source_domain_id: "a1".into(),
                target_domain_id: "a1".into(),
                name: "Hit".into(),
                description: String::new(),
                message_type: MessageType::Interface,
                action_ids: vec![],
            }],
            actions,
        };
        let mut scenes = HashMap::new();
        scenes.insert(scene.id.clone(), scene);

        let mut components = HashMap::new();
        components.insert(
            "c1".into(),
            Component {
                id: "c1".into(),
                name: "Health".into(),
                category: "Logic".into(),
                domain: "core".into(),
                variables: vec![],
                tasks: vec![],
                dependencies: vec![],
                source_module_id: None,
            },
        );

        let mut prefabs = HashMap::new();
        prefabs.insert(
            "p1".into(),
            Prefab {
                id: "p1".into(),
                name: "Enemy".into(),
                actor: PrefabActor {
                    name: "Enemy".into(),
                    role: "actor".into(),
                    actor_type: "simple".into(),
                    requirements: Requirements::default(),
                    actor_states: vec![],
                    flexible_content: String::new(),
                    sub_scene_id: None,
                },
            },
        );

        Project {
            name: "Demo".into(),
            scenes,
            components,
            prefabs,
            active_scene_id: Some("s1".into()),
        }
    }

    #[test]
    fn save_creates_expected_layout() {
        with_env_dir(|tmp| {
            let proj_dir = tmp.join("ars-projects").join("Demo");
            let project = make_project();
            save_project_impl(proj_dir.to_string_lossy().to_string(), project).unwrap();

            // 各トップレベルフォルダが作成されている
            for rel in &[
                "codedesign",
                "codedesign/interfaces",
                "codedesign/_components",
                "codedesign/_prefabs",
                "datadesign/user_data_scheme",
                "datadesign/master_data_scheme",
                "data_asset/master_data",
                "uidesign",
                "gamedesign/action",
                "gamedesign/level",
                "editor/users",
                "editor/global",
                "test",
            ] {
                assert!(
                    proj_dir.join(rel).is_dir(),
                    "missing directory: {}",
                    rel
                );
            }

            // 単一マニフェスト
            assert!(proj_dir.join("project.json").exists());

            // codedesign: シーン・アクター・コンポーネント・プレハブ
            assert!(proj_dir.join("codedesign/_project.json").exists());
            assert!(proj_dir.join("codedesign/Main/_scene.json").exists());
            assert!(proj_dir.join("codedesign/Main/Player.json").exists());
            assert!(proj_dir.join("codedesign/_components/Health.json").exists());
            assert!(proj_dir.join("codedesign/_prefabs/Enemy.json").exists());
            assert!(proj_dir.join("codedesign/interfaces/Main__Hit.json").exists());

            // gamedesign: action / level
            assert!(proj_dir.join("gamedesign/level/Main.json").exists());
            assert!(proj_dir
                .join("gamedesign/action/Main/Attack.json")
                .exists());

            // uidesign: シーン位置
            assert!(proj_dir.join("uidesign/Main.json").exists());
        });
    }

    #[test]
    fn roundtrip_via_directory_path() {
        with_env_dir(|tmp| {
            let proj_dir = tmp.join("ars-projects").join("Demo");
            let project = make_project();
            save_project_impl(proj_dir.to_string_lossy().to_string(), project.clone()).unwrap();
            let loaded =
                load_project_impl(proj_dir.to_string_lossy().to_string()).unwrap();
            assert_eq!(loaded.name, project.name);
            assert_eq!(loaded.scenes.len(), 1);
            assert_eq!(loaded.components.len(), 1);
            assert_eq!(loaded.prefabs.len(), 1);
        });
    }

    #[test]
    fn roundtrip_via_legacy_json_path() {
        with_env_dir(|tmp| {
            let proj_file = tmp
                .join("ars-projects")
                .join("Demo")
                .join("Demo.ars.json");
            let project = make_project();
            save_project_impl(proj_file.to_string_lossy().to_string(), project.clone()).unwrap();

            // 旧式 JSON と split レイアウト両方が存在する
            assert!(proj_file.exists());
            assert!(proj_file
                .parent()
                .unwrap()
                .join("codedesign/Main/_scene.json")
                .exists());

            let loaded =
                load_project_impl(proj_file.to_string_lossy().to_string()).unwrap();
            assert_eq!(loaded.name, project.name);
        });
    }

    #[test]
    fn rejects_path_outside_allowed_dir() {
        with_env_dir(|_| {
            let result = save_project_impl(
                "/tmp/ars-attack/evil".into(),
                make_project(),
            );
            assert!(result.is_err(), "must reject outside path");
        });
    }

    #[test]
    fn prunes_removed_scene_dirs() {
        with_env_dir(|tmp| {
            let proj_dir = tmp.join("ars-projects").join("Demo");
            let mut project = make_project();
            save_project_impl(proj_dir.to_string_lossy().to_string(), project.clone()).unwrap();
            assert!(proj_dir.join("codedesign/Main").exists());

            // Main → Renamed に変更して保存
            let mut new_scenes = HashMap::new();
            for (id, mut scene) in project.scenes.drain() {
                scene.name = "Renamed".into();
                new_scenes.insert(id, scene);
            }
            project.scenes = new_scenes;
            save_project_impl(proj_dir.to_string_lossy().to_string(), project).unwrap();

            assert!(proj_dir.join("codedesign/Renamed").exists());
            assert!(!proj_dir.join("codedesign/Main").exists());
        });
    }

    #[test]
    fn sanitize_filename_handles_special_chars() {
        assert_eq!(sanitize_filename("a/b"), "a_b");
        assert_eq!(sanitize_filename("a:b*c"), "a_b_c");
        assert_eq!(sanitize_filename("  . "), "_");
        assert_eq!(sanitize_filename("正常な名前"), "正常な名前");
    }
}
