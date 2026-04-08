use ars_core::models::{
    Actor, Component, Message, Position, Prefab, PrefabActor, Project,
    Requirements, Scene, Task, Variable,
};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug)]
pub struct ProjectManager {
    project_dir: PathBuf,
}

impl ProjectManager {
    pub fn new(project_dir: PathBuf) -> Self {
        Self { project_dir }
    }

    pub fn project_dir(&self) -> &Path {
        &self.project_dir
    }

    /// プロジェクトファイル(.ars.json)を検索
    pub fn find_project_files(&self) -> Vec<PathBuf> {
        let mut files = Vec::new();
        scan_dir(&self.project_dir, &mut files, 3);
        files
    }

    /// プロジェクトを読み込み
    pub fn load_project(&self, path: &Path) -> Result<Project, String> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read project: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse project: {}", e))
    }

    /// プロジェクトを保存
    pub fn save_project(&self, path: &Path, project: &Project) -> Result<(), String> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| format!("Failed to create dir: {}", e))?;
        }
        let content = serde_json::to_string_pretty(project)
            .map_err(|e| format!("Failed to serialize: {}", e))?;
        std::fs::write(path, content)
            .map_err(|e| format!("Failed to write: {}", e))
    }

    /// 新規プロジェクト
    pub fn create_project(&self, name: &str) -> Project {
        Project {
            name: name.to_string(),
            scenes: HashMap::new(),
            components: HashMap::new(),
            prefabs: HashMap::new(),
            active_scene_id: None,
        }
    }

    /// シーン追加
    pub fn create_scene(&self, project: &mut Project, name: &str) -> Scene {
        let scene_id = uuid::Uuid::new_v4().to_string();
        let root_actor_id = uuid::Uuid::new_v4().to_string();

        let root_actor = Actor {
            id: root_actor_id.clone(),
            name: name.to_string(),
            role: "scene".to_string(),
            actor_type: "simple".to_string(),
            requirements: Requirements::default(),
            actor_states: vec![],
            flexible_content: String::new(),
            position: Position { x: 0.0, y: 0.0 },
            sub_scene_id: None,
        };

        let mut actors = HashMap::new();
        actors.insert(root_actor_id.clone(), root_actor);

        let scene = Scene {
            id: scene_id.clone(),
            name: name.to_string(),
            root_actor_id,
            actors,
            messages: vec![],
        };

        project.scenes.insert(scene_id, scene.clone());
        if project.active_scene_id.is_none() {
            project.active_scene_id = Some(scene.id.clone());
        }
        scene
    }

    /// アクター追加
    pub fn add_actor(&self, project: &mut Project, scene_id: &str, name: &str, role: &str, x: f64, y: f64) -> Result<Actor, String> {
        let scene = project.scenes.get_mut(scene_id)
            .ok_or_else(|| format!("Scene not found: {}", scene_id))?;

        let actor = Actor {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.to_string(),
            role: role.to_string(),
            actor_type: "simple".to_string(),
            requirements: Requirements::default(),
            actor_states: vec![],
            flexible_content: String::new(),
            position: Position { x, y },
            sub_scene_id: None,
        };

        scene.actors.insert(actor.id.clone(), actor.clone());
        Ok(actor)
    }

    /// コンポーネント作成
    pub fn create_component(&self, project: &mut Project, name: &str, category: &str, domain: &str, variables: Vec<Variable>, tasks: Vec<Task>, dependencies: Vec<String>) -> Component {
        let component = Component {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.to_string(),
            category: category.to_string(),
            domain: domain.to_string(),
            variables,
            tasks,
            dependencies,
            source_module_id: None,
        };

        project.components.insert(component.id.clone(), component.clone());
        component
    }

    /// メッセージ追加
    pub fn add_message(&self, project: &mut Project, scene_id: &str, source_domain_id: &str, target_domain_id: &str, name: &str, description: &str) -> Result<Message, String> {
        let scene = project.scenes.get_mut(scene_id)
            .ok_or_else(|| format!("Scene not found: {}", scene_id))?;

        if !scene.actors.contains_key(source_domain_id) {
            return Err(format!("Source domain not found: {}", source_domain_id));
        }
        if !scene.actors.contains_key(target_domain_id) {
            return Err(format!("Target domain not found: {}", target_domain_id));
        }

        let message = Message {
            id: uuid::Uuid::new_v4().to_string(),
            source_domain_id: source_domain_id.to_string(),
            target_domain_id: target_domain_id.to_string(),
            name: name.to_string(),
            description: description.to_string(),
        };

        scene.messages.push(message.clone());
        Ok(message)
    }

    /// プロジェクト概要
    pub fn summarize_project(&self, project: &Project) -> String {
        let scene_count = project.scenes.len();
        let component_count = project.components.len();
        let mut actor_count = 0;
        let mut message_count = 0;
        for scene in project.scenes.values() {
            actor_count += scene.actors.len();
            message_count += scene.messages.len();
        }

        let mut lines = vec![
            format!("# プロジェクト: {}", project.name),
            String::new(),
            "## 統計".into(),
            format!("- シーン数: {}", scene_count),
            format!("- コンポーネント数: {}", component_count),
            format!("- ドメイン数（全シーン合計）: {}", actor_count),
            format!("- メッセージ数（全シーン合計）: {}", message_count),
        ];

        if scene_count > 0 {
            lines.push(String::new());
            lines.push("## シーン一覧".into());
            for scene in project.scenes.values() {
                let actors: Vec<_> = scene.actors.values().collect();
                let active = if project.active_scene_id.as_deref() == Some(&scene.id) { " (アクティブ)" } else { "" };
                lines.push(format!("- **{}**{}: ドメイン {}個, メッセージ {}個", scene.name, active, actors.len(), scene.messages.len()));
                for actor in &actors {
                    lines.push(format!("  - {} [{}:{}]", actor.name, actor.role, actor.actor_type));
                }
            }
        }

        if component_count > 0 {
            lines.push(String::new());
            lines.push("## コンポーネント一覧".into());
            let mut by_cat: HashMap<&str, Vec<&Component>> = HashMap::new();
            for comp in project.components.values() {
                by_cat.entry(&comp.category).or_default().push(comp);
            }
            for (cat, comps) in &by_cat {
                lines.push(format!("### {}", cat));
                for comp in comps {
                    lines.push(format!("- **{}** ({}): タスク {}個, 変数 {}個", comp.name, comp.domain, comp.tasks.len(), comp.variables.len()));
                }
            }
        }

        lines.join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ars_test_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn test_create_and_save_load_project() {
        let dir = temp_dir();
        let pm = ProjectManager::new(dir.clone());
        let project = pm.create_project("TestProject");
        assert_eq!(project.name, "TestProject");
        assert!(project.scenes.is_empty());
        assert!(project.components.is_empty());

        let path = dir.join("test.ars.json");
        pm.save_project(&path, &project).unwrap();
        let loaded = pm.load_project(&path).unwrap();
        assert_eq!(loaded.name, "TestProject");

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_create_scene_and_add_actor() {
        let dir = temp_dir();
        let pm = ProjectManager::new(dir.clone());
        let mut project = pm.create_project("TestProject");

        let scene = pm.create_scene(&mut project, "MainScene");
        assert_eq!(scene.name, "MainScene");
        assert!(project.scenes.contains_key(&scene.id));
        assert_eq!(project.active_scene_id.as_deref(), Some(scene.id.as_str()));

        // Root actor should exist
        assert!(scene.actors.contains_key(&scene.root_actor_id));

        // Add a new actor
        let actor = pm.add_actor(&mut project, &scene.id, "Player", "actor", 100.0, 200.0).unwrap();
        assert_eq!(actor.name, "Player");
        assert_eq!(actor.role, "actor");
        assert_eq!(actor.position.x, 100.0);
        assert_eq!(actor.position.y, 200.0);

        let scene = project.scenes.get(&scene.id).unwrap();
        assert_eq!(scene.actors.len(), 2);

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_add_actor_nonexistent_scene() {
        let dir = temp_dir();
        let pm = ProjectManager::new(dir.clone());
        let mut project = pm.create_project("TestProject");

        let result = pm.add_actor(&mut project, "nonexistent", "Actor", "actor", 0.0, 0.0);
        assert!(result.is_err());

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_add_message() {
        let dir = temp_dir();
        let pm = ProjectManager::new(dir.clone());
        let mut project = pm.create_project("TestProject");
        let scene = pm.create_scene(&mut project, "Scene1");

        let a1 = pm.add_actor(&mut project, &scene.id, "A", "actor", 0.0, 0.0).unwrap();
        let a2 = pm.add_actor(&mut project, &scene.id, "B", "actor", 200.0, 0.0).unwrap();

        let msg = pm.add_message(&mut project, &scene.id, &a1.id, &a2.id, "Attack", "ダメージを与える").unwrap();
        assert_eq!(msg.source_domain_id, a1.id);
        assert_eq!(msg.target_domain_id, a2.id);
        assert_eq!(msg.name, "Attack");

        let scene = project.scenes.get(&scene.id).unwrap();
        assert_eq!(scene.messages.len(), 1);

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_message_nonexistent_actor() {
        let dir = temp_dir();
        let pm = ProjectManager::new(dir.clone());
        let mut project = pm.create_project("TestProject");
        let scene = pm.create_scene(&mut project, "Scene1");
        let a1 = pm.add_actor(&mut project, &scene.id, "A", "actor", 0.0, 0.0).unwrap();

        let result = pm.add_message(&mut project, &scene.id, &a1.id, "nonexistent", "Msg", "");
        assert!(result.is_err());

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_summarize_project() {
        let dir = temp_dir();
        let pm = ProjectManager::new(dir.clone());
        let mut project = pm.create_project("Summary Test");
        let scene = pm.create_scene(&mut project, "MainScene");
        pm.add_actor(&mut project, &scene.id, "Player", "actor", 0.0, 0.0).unwrap();
        pm.create_component(&mut project, "HP", "Logic", "core", vec![], vec![], vec![]);

        let summary = pm.summarize_project(&project);
        assert!(summary.contains("Summary Test"));
        assert!(summary.contains("MainScene"));
        assert!(summary.contains("Player"));
        assert!(summary.contains("HP"));

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_find_project_files() {
        let dir = temp_dir();
        let pm = ProjectManager::new(dir.clone());
        let project = pm.create_project("Test");

        // Save to .ars.json file
        let path = dir.join("test.ars.json");
        pm.save_project(&path, &project).unwrap();

        let files = pm.find_project_files();
        assert_eq!(files.len(), 1);
        assert!(files[0].ends_with("test.ars.json"));

        fs::remove_dir_all(&dir).ok();
    }
}

fn scan_dir(dir: &Path, results: &mut Vec<PathBuf>, depth: usize) {
    if depth == 0 { return; }
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if name_str.starts_with('.') || name_str == "node_modules" || name_str == "dist" || name_str == "target" {
            continue;
        }
        let path = entry.path();
        if path.is_dir() {
            scan_dir(&path, results, depth - 1);
        } else if name_str.ends_with(".ars.json") {
            results.push(path);
        }
    }
}
