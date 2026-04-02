mod project_manager;
mod module_parser;

use ars_core::models::{self, Variable, Task as ArsTask, Project, Scene, Actor, Component, Connection, Position, SequenceStep, Prefab, PrefabActor, ProjectSummary, GitRepo, GitProjectInfo};
use project_manager::ProjectManager;
use module_parser::parse_module_markdown;
use rmcp::{
    ServerHandler, ServiceExt,
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::*,
    schemars, tool, tool_router,
};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct FilePathParam {
    #[schemars(description = ".ars.json ファイルのパス")]
    file_path: String,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct CreateProjectParam {
    #[schemars(description = "プロジェクト名")]
    name: String,
    #[schemars(description = "保存先ファイルパス")]
    file_path: Option<String>,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct CreateSceneParam {
    #[schemars(description = ".ars.json ファイルのパス")]
    file_path: String,
    #[schemars(description = "シーン名")]
    name: String,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct AddActorParam {
    #[schemars(description = ".ars.json ファイルのパス")]
    file_path: String,
    #[schemars(description = "シーンID")]
    scene_id: String,
    #[schemars(description = "アクター名")]
    name: String,
    #[schemars(description = "ロール (actor/sequence)")]
    role: String,
    #[schemars(description = "X座標")]
    x: Option<f64>,
    #[schemars(description = "Y座標")]
    y: Option<f64>,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct SceneQueryParam {
    #[schemars(description = ".ars.json ファイルのパス")]
    file_path: String,
    #[schemars(description = "シーンID")]
    scene_id: String,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct CreateComponentParam {
    #[schemars(description = ".ars.json ファイルのパス")]
    file_path: String,
    #[schemars(description = "コンポーネント名")]
    name: String,
    #[schemars(description = "カテゴリ (UI/Logic/System/GameObject)")]
    category: String,
    #[schemars(description = "所属ドメイン")]
    domain: String,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct ListComponentsParam {
    #[schemars(description = ".ars.json ファイルのパス")]
    file_path: String,
    #[schemars(description = "フィルタカテゴリ")]
    category: Option<String>,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct AttachComponentParam {
    #[schemars(description = ".ars.json ファイルのパス")]
    file_path: String,
    #[schemars(description = "シーンID")]
    scene_id: String,
    #[schemars(description = "アクターID")]
    actor_id: String,
    #[schemars(description = "コンポーネントID")]
    component_id: String,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct AddConnectionParam {
    #[schemars(description = ".ars.json ファイルのパス")]
    file_path: String,
    #[schemars(description = "シーンID")]
    scene_id: String,
    #[schemars(description = "接続元アクターID")]
    source_actor_id: String,
    #[schemars(description = "接続元ポート名")]
    source_port: String,
    #[schemars(description = "接続先アクターID")]
    target_actor_id: String,
    #[schemars(description = "接続先ポート名")]
    target_port: String,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct ParseModuleParam {
    #[schemars(description = "Markdownファイルパス")]
    file_path: Option<String>,
    #[schemars(description = "Markdown文字列")]
    content: Option<String>,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct ImportModuleParam {
    #[schemars(description = ".ars.json ファイルのパス")]
    project_file: String,
    #[schemars(description = "Markdownファイルパス")]
    module_file: Option<String>,
    #[schemars(description = "Markdown文字列")]
    module_content: Option<String>,
    #[schemars(description = "インポートするモジュール名")]
    module_name: Option<String>,
}

#[derive(Debug)]
struct ArsMcpServer {
    pm: Mutex<ProjectManager>,
    tool_router: ToolRouter<Self>,
}

impl ArsMcpServer {
    fn new(project_dir: PathBuf) -> Self {
        Self {
            pm: Mutex::new(ProjectManager::new(project_dir)),
            tool_router: Self::tool_router(),
        }
    }

    fn resolve_path(&self, file_path: &str) -> Result<PathBuf, String> {
        let pm = self.pm.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
        let p = Path::new(file_path);
        Ok(if p.is_absolute() { p.to_path_buf() } else { pm.project_dir().join(p) })
    }

    fn with_pm<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&ProjectManager) -> T,
    {
        let pm = self.pm.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
        Ok(f(&pm))
    }

    fn with_pm_result<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&ProjectManager) -> Result<T, String>,
    {
        let pm = self.pm.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
        f(&pm)
    }
}

fn ok(text: String) -> String { text }
fn err(text: String) -> String { format!("エラー: {}", text) }

#[tool_router]
impl ArsMcpServer {
    #[tool(description = "プロジェクトディレクトリ内の.ars.jsonファイルを検索して一覧表示する")]
    fn list_projects(&self) -> String {
        match self.with_pm(|pm| {
            let files = pm.find_project_files();
            if files.is_empty() {
                return ok("プロジェクトファイルが見つかりません。create_project で新規作成してください。".into());
            }
            let list: Vec<_> = files.iter().map(|f| {
                let rel = f.strip_prefix(pm.project_dir()).unwrap_or(f);
                format!("- {}", rel.display())
            }).collect();
            ok(format!("発見されたプロジェクト:\n{}", list.join("\n")))
        }) {
            Ok(s) => s,
            Err(e) => err(e),
        }
    }

    #[tool(description = "新しいArsプロジェクトを作成する")]
    fn create_project(&self, Parameters(p): Parameters<CreateProjectParam>) -> String {
        match self.with_pm_result(|pm| {
            let project = pm.create_project(&p.name);
            let save_path = match p.file_path {
                Some(ref fp) => {
                    let path = Path::new(fp);
                    if path.is_absolute() { path.to_path_buf() } else { pm.project_dir().join(path) }
                }
                None => pm.project_dir().join(format!("{}.ars.json", p.name)),
            };
            pm.save_project(&save_path, &project)?;
            Ok(ok(format!("プロジェクト \"{}\" を作成しました: {}", p.name, save_path.display())))
        }) {
            Ok(s) => s,
            Err(e) => err(e),
        }
    }

    #[tool(description = "Arsプロジェクトを読み込んで概要を表示する")]
    fn load_project(&self, Parameters(p): Parameters<FilePathParam>) -> String {
        let full_path = match self.resolve_path(&p.file_path) {
            Ok(p) => p,
            Err(e) => return err(e),
        };
        match self.with_pm_result(|pm| {
            let project = pm.load_project(&full_path)?;
            Ok(ok(pm.summarize_project(&project)))
        }) {
            Ok(s) => s,
            Err(e) => err(e),
        }
    }

    #[tool(description = "ArsプロジェクトのJSON構造を取得する")]
    fn get_project_json(&self, Parameters(p): Parameters<FilePathParam>) -> String {
        let full_path = match self.resolve_path(&p.file_path) {
            Ok(p) => p,
            Err(e) => return err(e),
        };
        match self.with_pm_result(|pm| {
            let project = pm.load_project(&full_path)?;
            serde_json::to_string_pretty(&project).map_err(|e| e.to_string())
        }) {
            Ok(s) => s,
            Err(e) => err(e),
        }
    }

    #[tool(description = "プロジェクトに新しいシーンを追加する")]
    fn create_scene(&self, Parameters(p): Parameters<CreateSceneParam>) -> String {
        let full_path = match self.resolve_path(&p.file_path) {
            Ok(p) => p,
            Err(e) => return err(e),
        };
        match self.with_pm_result(|pm| {
            let mut project = pm.load_project(&full_path)?;
            let scene = pm.create_scene(&mut project, &p.name);
            pm.save_project(&full_path, &project)?;
            Ok(ok(format!("シーン \"{}\" を作成しました (ID: {})\nルートアクター: {}", p.name, scene.id, scene.root_actor_id)))
        }) {
            Ok(s) => s,
            Err(e) => err(e),
        }
    }

    #[tool(description = "プロジェクト内の全シーンを一覧表示する")]
    fn list_scenes(&self, Parameters(p): Parameters<FilePathParam>) -> String {
        let full_path = match self.resolve_path(&p.file_path) {
            Ok(p) => p,
            Err(e) => return err(e),
        };
        match self.with_pm_result(|pm| {
            let project = pm.load_project(&full_path)?;
            let scenes: Vec<_> = project.scenes.values().collect();
            if scenes.is_empty() { return Ok(ok("シーンがありません。".into())); }
            let list: Vec<_> = scenes.iter().map(|s| {
                let active = if project.active_scene_id.as_deref() == Some(&s.id) { " ★" } else { "" };
                format!("- **{}**{} (ID: {}) - アクター: {}個", s.name, active, s.id, s.actors.len())
            }).collect();
            Ok(ok(format!("シーン一覧:\n{}", list.join("\n"))))
        }) {
            Ok(s) => s,
            Err(e) => err(e),
        }
    }

    #[tool(description = "シーンにアクターを追加する")]
    fn add_actor(&self, Parameters(p): Parameters<AddActorParam>) -> String {
        let full_path = match self.resolve_path(&p.file_path) {
            Ok(p) => p,
            Err(e) => return err(e),
        };
        match self.with_pm_result(|pm| {
            let mut project = pm.load_project(&full_path)?;
            let actor = pm.add_actor(&mut project, &p.scene_id, &p.name, &p.role, p.x.unwrap_or(200.0), p.y.unwrap_or(200.0))?;
            pm.save_project(&full_path, &project)?;
            Ok(ok(format!("アクター \"{}\" [{}] を追加しました (ID: {})", p.name, p.role, actor.id)))
        }) {
            Ok(s) => s,
            Err(e) => err(e),
        }
    }

    #[tool(description = "シーン内の全アクターを一覧表示する")]
    fn list_actors(&self, Parameters(p): Parameters<SceneQueryParam>) -> String {
        let full_path = match self.resolve_path(&p.file_path) {
            Ok(p) => p,
            Err(e) => return err(e),
        };
        match self.with_pm_result(|pm| {
            let project = pm.load_project(&full_path)?;
            match project.scenes.get(&p.scene_id) {
                Some(scene) => {
                    let list: Vec<_> = scene.actors.values().map(|a| {
                        let comp_names: Vec<_> = a.components.iter().filter_map(|cid| project.components.get(cid).map(|c| c.name.as_str())).collect();
                        let comps = if comp_names.is_empty() { String::new() } else { format!(" [{}]", comp_names.join(", ")) };
                        format!("- **{}** [{}] (ID: {}){}", a.name, a.role, a.id, comps)
                    }).collect();
                    Ok(ok(format!("シーン \"{}\" のアクター一覧:\n{}", scene.name, list.join("\n"))))
                }
                None => Err(format!("シーンが見つかりません: {}", p.scene_id)),
            }
        }) {
            Ok(s) => s,
            Err(e) => err(e),
        }
    }

    #[tool(description = "プロジェクトに新しいコンポーネントを定義する")]
    fn create_component(&self, Parameters(p): Parameters<CreateComponentParam>) -> String {
        let full_path = match self.resolve_path(&p.file_path) {
            Ok(p) => p,
            Err(e) => return err(e),
        };
        match self.with_pm_result(|pm| {
            let mut project = pm.load_project(&full_path)?;
            let component = pm.create_component(&mut project, &p.name, &p.category, &p.domain, vec![], vec![], vec![]);
            pm.save_project(&full_path, &project)?;
            Ok(ok(format!("コンポーネント \"{}\" [{}] を作成しました (ID: {})", p.name, p.category, component.id)))
        }) {
            Ok(s) => s,
            Err(e) => err(e),
        }
    }

    #[tool(description = "プロジェクト内の全コンポーネントを一覧表示する")]
    fn list_components(&self, Parameters(p): Parameters<ListComponentsParam>) -> String {
        let full_path = match self.resolve_path(&p.file_path) {
            Ok(p) => p,
            Err(e) => return err(e),
        };
        match self.with_pm_result(|pm| {
            let project = pm.load_project(&full_path)?;
            let mut components: Vec<_> = project.components.values().collect();
            if let Some(ref cat) = p.category {
                components.retain(|c| &c.category == cat);
            }
            if components.is_empty() { return Ok(ok("コンポーネントがありません。".into())); }
            let list: Vec<_> = components.iter().map(|c| {
                format!("- **{}** [{}] ({}) ID: {}", c.name, c.category, c.domain, c.id)
            }).collect();
            Ok(ok(format!("コンポーネント一覧:\n{}", list.join("\n"))))
        }) {
            Ok(s) => s,
            Err(e) => err(e),
        }
    }

    #[tool(description = "アクターにコンポーネントをアタッチする")]
    fn attach_component(&self, Parameters(p): Parameters<AttachComponentParam>) -> String {
        let full_path = match self.resolve_path(&p.file_path) {
            Ok(p) => p,
            Err(e) => return err(e),
        };
        match self.with_pm_result(|pm| {
            let mut project = pm.load_project(&full_path)?;
            pm.attach_component(&mut project, &p.scene_id, &p.actor_id, &p.component_id)?;
            pm.save_project(&full_path, &project)?;
            Ok(ok("コンポーネントをアタッチしました。".into()))
        }) {
            Ok(s) => s,
            Err(e) => err(e),
        }
    }

    #[tool(description = "シーン内のアクター間に接続を追加する")]
    fn add_connection(&self, Parameters(p): Parameters<AddConnectionParam>) -> String {
        let full_path = match self.resolve_path(&p.file_path) {
            Ok(p) => p,
            Err(e) => return err(e),
        };
        match self.with_pm_result(|pm| {
            let mut project = pm.load_project(&full_path)?;
            let conn = pm.add_connection(&mut project, &p.scene_id, &p.source_actor_id, &p.source_port, &p.target_actor_id, &p.target_port)?;
            pm.save_project(&full_path, &project)?;
            Ok(ok(format!("接続を追加しました (ID: {})", conn.id)))
        }) {
            Ok(s) => s,
            Err(e) => err(e),
        }
    }

    #[tool(description = "Ars形式のMarkdownからモジュール定義をパースする")]
    fn parse_module_markdown_tool(&self, Parameters(p): Parameters<ParseModuleParam>) -> String {
        let markdown = if let Some(c) = p.content {
            c
        } else if let Some(ref fp) = p.file_path {
            let full = match self.resolve_path(fp) {
                Ok(p) => p,
                Err(e) => return err(e),
            };
            match std::fs::read_to_string(&full) {
                Ok(s) => s,
                Err(e) => return err(e.to_string()),
            }
        } else {
            return err("file_path または content を指定してください。".into());
        };

        let modules = parse_module_markdown(&markdown, p.file_path.as_deref());
        if modules.is_empty() {
            return ok("モジュール定義が見つかりませんでした。".into());
        }

        let summary: Vec<_> = modules.iter().map(|m| {
            format!("## {}\n- カテゴリ: {}\n- ドメイン: {}\n- タスク: {}",
                m.name, m.category, m.domain,
                m.tasks.iter().map(|t| t.name.as_str()).collect::<Vec<_>>().join(", "))
        }).collect();

        ok(format!("{}個のモジュール定義を検出:\n\n{}", modules.len(), summary.join("\n\n")))
    }

    #[tool(description = "パース済みモジュール定義をプロジェクトのコンポーネントとしてインポートする")]
    fn import_module_to_project(&self, Parameters(p): Parameters<ImportModuleParam>) -> String {
        let project_path = match self.resolve_path(&p.project_file) {
            Ok(p) => p,
            Err(e) => return err(e),
        };

        let markdown = if let Some(c) = p.module_content {
            c
        } else if let Some(ref fp) = p.module_file {
            let full = match self.resolve_path(fp) {
                Ok(p) => p,
                Err(e) => return err(e),
            };
            match std::fs::read_to_string(&full) {
                Ok(s) => s,
                Err(e) => return err(e.to_string()),
            }
        } else {
            return err("module_file または module_content を指定してください。".into());
        };

        match self.with_pm_result(|pm| {
            let mut project = pm.load_project(&project_path)?;

            let mut modules = parse_module_markdown(&markdown, p.module_file.as_deref());
            if let Some(ref name) = p.module_name {
                modules.retain(|m| &m.name == name);
            }
            if modules.is_empty() {
                return Err("インポートするモジュールが見つかりませんでした。".into());
            }

            let mut imported = Vec::new();
            for module in &modules {
                let variables = module.variables.iter().map(|v| Variable {
                    name: v.name.clone(),
                    var_type: v.var_type.clone(),
                    default_value: None,
                }).collect();
                let tasks = module.tasks.iter().map(|t| ArsTask {
                    name: t.name.clone(),
                    description: t.description.clone(),
                    inputs: t.inputs.clone(),
                    outputs: t.outputs.clone(),
                    test_cases: None,
                }).collect();
                let comp = pm.create_component(&mut project, &module.name, &module.category, &module.domain, variables, tasks, module.dependencies.clone());
                if let Some(c) = project.components.get_mut(&comp.id) {
                    c.source_module_id = Some(module.id.clone());
                }
                imported.push(format!("{} (ID: {})", module.name, comp.id));
            }

            pm.save_project(&project_path, &project)?;
            Ok(ok(format!("{}個のモジュールをインポートしました:\n{}", imported.len(), imported.iter().map(|n| format!("- {}", n)).collect::<Vec<_>>().join("\n"))))
        }) {
            Ok(s) => s,
            Err(e) => err(e),
        }
    }
}

impl ServerHandler for ArsMcpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_instructions("Ars プロジェクト管理用 MCP サーバー")
    }
}

#[tokio::main]
async fn main() {
    let project_dir = std::env::var("ARS_PROJECT_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

    let server = ArsMcpServer::new(project_dir);
    let transport = rmcp::transport::io::stdio();
    let ct = server.serve(transport).await.expect("MCP server failed to start");
    let _ = ct.waiting().await;
}
