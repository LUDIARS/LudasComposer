use ars_core::models::{Component, Project, Scene};

/// コード生成タスク
pub struct CodegenTask {
    pub id: String,
    pub task_type: String,
    pub name: String,
    pub prompt: String,
    pub dependencies: Vec<String>,
    pub output_dir: String,
}

/// カテゴリの日本語マッピング
fn category_label(cat: &str) -> &str {
    match cat {
        "UI" => "UI",
        "Logic" => "ロジック",
        "System" => "システム",
        "GameObject" => "ゲームオブジェクト",
        _ => cat,
    }
}

/// Pictor連携が必要なドメイン判定
fn is_pictor_domain(domain: &str) -> bool {
    let keywords = ["rendering", "render", "graphics", "visual", "material", "shader", "lighting", "gi", "shadow", "mesh", "texture"];
    let lower = domain.to_lowercase();
    keywords.iter().any(|k| lower.contains(k))
}

fn to_kebab_case(s: &str) -> String {
    let mut result = String::new();
    for (i, c) in s.chars().enumerate() {
        if c.is_uppercase() && i > 0 {
            result.push('-');
        }
        result.push(c.to_ascii_lowercase());
    }
    result.replace(' ', "-")
}

pub struct PromptGenerator<'a> {
    project: &'a Project,
    platform: &'a str,
}

impl<'a> PromptGenerator<'a> {
    pub fn new(project: &'a Project, platform: &'a str) -> Self {
        Self { project, platform }
    }

    pub fn generate_tasks(
        &self,
        output_dir: &str,
        scene_ids: Option<&[String]>,
        component_ids: Option<&[String]>,
    ) -> Vec<CodegenTask> {
        let mut tasks = Vec::new();

        // 1. コンポーネント単位
        let components = self.get_target_components(component_ids);
        for comp in &components {
            tasks.push(CodegenTask {
                id: format!("comp-{}", comp.id),
                task_type: "component".into(),
                name: comp.name.clone(),
                prompt: self.build_component_prompt(comp),
                dependencies: self.resolve_component_deps(comp, &components),
                output_dir: format!("{}/components/{}/{}", output_dir, to_kebab_case(&comp.domain), to_kebab_case(&comp.name)),
            });
        }

        // 2. シーン単位
        let scenes = self.get_target_scenes(scene_ids);
        for scene in &scenes {
            let comp_deps = self.get_scene_component_deps(scene, &components);
            tasks.push(CodegenTask {
                id: format!("scene-{}", scene.id),
                task_type: "scene".into(),
                name: scene.name.clone(),
                prompt: self.build_scene_prompt(scene),
                dependencies: comp_deps.iter().map(|c| format!("comp-{}", c.id)).collect(),
                output_dir: format!("{}/scenes/{}", output_dir, to_kebab_case(&scene.name)),
            });
        }

        tasks
    }

    fn get_target_components(&self, ids: Option<&[String]>) -> Vec<&Component> {
        match ids {
            Some(ids) if !ids.is_empty() => self.project.components.values().filter(|c| ids.contains(&c.id)).collect(),
            _ => self.project.components.values().collect(),
        }
    }

    fn get_target_scenes(&self, ids: Option<&[String]>) -> Vec<&Scene> {
        match ids {
            Some(ids) if !ids.is_empty() => self.project.scenes.values().filter(|s| ids.contains(&s.id)).collect(),
            _ => self.project.scenes.values().collect(),
        }
    }

    fn resolve_component_deps(&self, comp: &Component, all: &[&Component]) -> Vec<String> {
        comp.dependencies.iter()
            .filter(|dep_id| all.iter().any(|c| &c.id == *dep_id))
            .map(|dep_id| format!("comp-{}", dep_id))
            .collect()
    }

    #[allow(clippy::needless_lifetimes)]
    fn get_scene_component_deps<'b>(&self, _scene: &Scene, all: &[&'b Component]) -> Vec<&'b Component> {
        // In the new architecture, actors don't directly reference components.
        // Return all components as potential dependencies for now.
        all.to_vec()
    }

    fn build_component_prompt(&self, component: &Component) -> String {
        let needs_pictor = is_pictor_domain(&component.domain);
        let (lang, ext, module_pattern) = self.platform_info();

        let mut lines = vec![
            format!("# コード生成指示: {} コンポーネント", component.name),
            String::new(),
            format!("## ターゲットプラットフォーム: {}", self.platform),
            format!("## 実装言語: {}", lang),
            String::new(),
            format!("以下のErgoモジュール定義に基づいて、{}として実装コードを生成してください。", module_pattern),
            String::new(),
            "---".into(),
            String::new(),
        ];

        // Ergoモジュール定義
        lines.push(self.build_ergo_module_spec(component));

        if needs_pictor {
            lines.push(String::new());
            lines.push(self.build_pictor_integration(component));
        }

        lines.push(String::new());
        lines.push("---".into());
        lines.push(String::new());
        lines.push("## 生成要件".into());
        lines.push(format!("1. メインモジュールファイル: `{}{}`", to_kebab_case(&component.name), ext));
        lines.push("2. 各タスクの実装".into());
        lines.push("3. エラーハンドリング".into());

        lines.join("\n")
    }

    fn build_scene_prompt(&self, scene: &Scene) -> String {
        let (lang, _ext, _pattern) = self.platform_info();
        let mut lines = vec![
            format!("# コード生成指示: {} シーン", scene.name),
            String::new(),
            format!("## ターゲットプラットフォーム: {}", self.platform),
            format!("## 実装言語: {}", lang),
            String::new(),
            "以下のシーン構造に基づいて、アクター生成・接続配線のコードを生成してください。".into(),
            String::new(),
        ];

        lines.push("## ドメイン構造".into());
        for actor in scene.actors.values() {
            lines.push(format!("- {} [{}:{}]", actor.name, actor.role, actor.actor_type));
            if !actor.requirements.overview.is_empty() {
                for item in &actor.requirements.overview {
                    lines.push(format!("  - 概要: {}", item));
                }
            }
        }

        if !scene.messages.is_empty() {
            lines.push(String::new());
            lines.push("## メッセージ".into());
            for msg in &scene.messages {
                let src = scene.actors.get(&msg.source_domain_id).map(|a| a.name.as_str()).unwrap_or(&msg.source_domain_id);
                let tgt = scene.actors.get(&msg.target_domain_id).map(|a| a.name.as_str()).unwrap_or(&msg.target_domain_id);
                lines.push(format!("- {} → {}: {} ({})", src, tgt, msg.name, msg.description));
            }
        }

        lines.join("\n")
    }

    fn build_ergo_module_spec(&self, component: &Component) -> String {
        let mut lines = vec![
            format!("# {} モジュール定義", component.name),
            String::new(),
            "## 概要".into(),
            self.build_component_summary(component),
            String::new(),
            "## カテゴリ".into(),
            category_label(&component.category).into(),
            String::new(),
            "## 所属ドメイン".into(),
            component.domain.clone(),
        ];

        if !component.variables.is_empty() {
            lines.push(String::new());
            lines.push("## 変数".into());
            for v in &component.variables {
                let default_str = v.default_value.as_ref().map(|d| format!(" (初期値: {})", d)).unwrap_or_default();
                lines.push(format!("- {}{}", v.name, default_str));
            }
        }

        if !component.dependencies.is_empty() {
            lines.push(String::new());
            lines.push("## 依存".into());
            for dep_id in &component.dependencies {
                let name = self.project.components.get(dep_id).map(|c| c.name.as_str()).unwrap_or(dep_id);
                lines.push(format!("- {}", name));
            }
        }

        lines.push(String::new());
        lines.push("## 作業".into());

        let all_inputs: Vec<_> = component.tasks.iter().flat_map(|t| &t.inputs).collect();
        let all_outputs: Vec<_> = component.tasks.iter().flat_map(|t| &t.outputs).collect();

        lines.push("### 入力".into());
        if all_inputs.is_empty() {
            lines.push("なし".into());
        } else {
            for input in &all_inputs {
                lines.push(format!("- {}: {}", input.name, input.port_type));
            }
        }

        lines.push(String::new());
        lines.push("### 出力".into());
        if all_outputs.is_empty() {
            lines.push("なし".into());
        } else {
            for output in &all_outputs {
                lines.push(format!("- {}: {}", output.name, output.port_type));
            }
        }

        lines.push(String::new());
        lines.push("### タスク".into());
        if component.tasks.is_empty() {
            lines.push("なし".into());
        } else {
            for task in &component.tasks {
                lines.push(format!("- {}: {}", task.name, task.description));
            }
        }

        lines.join("\n")
    }

    fn build_component_summary(&self, component: &Component) -> String {
        let task_names: Vec<_> = component.tasks.iter().map(|t| t.name.as_str()).collect();
        let cat = category_label(&component.category);
        if task_names.is_empty() {
            format!("{}ドメインの{}モジュール", component.domain, cat)
        } else {
            format!("{}ドメインにおいて{}を行う{}モジュール", component.domain, task_names.join("・"), cat)
        }
    }

    fn build_pictor_integration(&self, _component: &Component) -> String {
        match self.platform {
            "unity" => "## Pictor連携 (レンダリングパイプライン)\nこのモジュールはUnityのレンダリングパイプライン (URP/HDRP) と連携する。".into(),
            "unreal" => "## Pictor連携 (レンダリングパイプライン)\nこのモジュールはUnreal EngineのNanite/Lumenレンダリングパイプラインと連携する。".into(),
            "godot" => "## Pictor連携 (レンダリングパイプライン)\nこのモジュールはGodotのVulkanレンダリングパイプラインと連携する。".into(),
            _ => "## Pictor連携 (レンダリングパイプライン)\nこのモジュールはPictorレンダリングパイプラインと連携する。".into(),
        }
    }

    fn platform_info(&self) -> (&str, &str, &str) {
        match self.platform {
            "unity" => ("C#", ".cs", "Ergoモジュール (Unity C# MonoBehaviour)"),
            "unreal" => ("C++", ".cpp", "Ergoモジュール (Unreal C++ UObject)"),
            "godot" => ("GDScript", ".gd", "Ergoモジュール (Godot GDScript Node)"),
            _ => ("TypeScript", ".ts", "Ergoモジュール (TypeScript)"),
        }
    }
}
