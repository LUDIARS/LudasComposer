use ars_core::models::{Component, Project, Scene};

use crate::code_layout::{
    class_name_for, classify_component_category, entity_dir, LayoutCategory,
};

/// コード生成タスク
pub struct CodegenTask {
    pub id: String,
    pub task_type: String,
    pub name: String,
    pub prompt: String,
    pub dependencies: Vec<String>,
    pub output_dir: String,
    /// レイアウトカテゴリ (Scene/Actor/Module/Action/UI/Data)
    pub layout_category: LayoutCategory,
    /// 元エンティティ ID（manifest 紐付け用）
    pub entity_id: String,
    /// 生成されるクラス名（サフィックス付与済み）
    pub class_name: String,
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

        // 1. コンポーネント単位 (UI / Module の振り分けは category で決定)
        let components = self.get_target_components(component_ids);
        for comp in &components {
            let category = classify_component_category(&comp.category);
            let class_name = class_name_for(category, &comp.name);
            tasks.push(CodegenTask {
                id: format!("comp-{}", comp.id),
                task_type: category.as_str().to_string(),
                name: comp.name.clone(),
                prompt: self.build_component_prompt(comp),
                dependencies: self.resolve_component_deps(comp, &components),
                output_dir: entity_dir(output_dir, category, &comp.name),
                layout_category: category,
                entity_id: comp.id.clone(),
                class_name,
            });
        }

        // 2. アクション単位 (Scene 横断で集約)
        let scenes = self.get_target_scenes(scene_ids);
        for scene in &scenes {
            for action in scene.actions.values() {
                let category = LayoutCategory::Action;
                let class_name = class_name_for(category, &action.name);
                tasks.push(CodegenTask {
                    id: format!("action-{}", action.id),
                    task_type: category.as_str().to_string(),
                    name: action.name.clone(),
                    prompt: self.build_action_prompt(scene, action),
                    dependencies: vec![],
                    output_dir: entity_dir(output_dir, category, &action.name),
                    layout_category: category,
                    entity_id: action.id.clone(),
                    class_name,
                });
            }
        }

        // 3. アクター単位 (各シーン配下のアクターを Actor カテゴリで個別生成)
        for scene in &scenes {
            for actor in scene.actors.values() {
                let category = LayoutCategory::Actor;
                let class_name = class_name_for(category, &actor.name);
                tasks.push(CodegenTask {
                    id: format!("actor-{}", actor.id),
                    task_type: category.as_str().to_string(),
                    name: actor.name.clone(),
                    prompt: self.build_actor_prompt(scene, actor),
                    dependencies: vec![],
                    output_dir: entity_dir(output_dir, category, &actor.name),
                    layout_category: category,
                    entity_id: actor.id.clone(),
                    class_name,
                });
            }
        }

        // 4. シーン単位
        for scene in &scenes {
            let comp_deps = self.get_scene_component_deps(scene, &components);
            let category = LayoutCategory::Scene;
            let class_name = class_name_for(category, &scene.name);
            let mut deps: Vec<String> = comp_deps.iter().map(|c| format!("comp-{}", c.id)).collect();
            for actor in scene.actors.values() {
                deps.push(format!("actor-{}", actor.id));
            }
            for action in scene.actions.values() {
                deps.push(format!("action-{}", action.id));
            }
            tasks.push(CodegenTask {
                id: format!("scene-{}", scene.id),
                task_type: category.as_str().to_string(),
                name: scene.name.clone(),
                prompt: self.build_scene_prompt(scene),
                dependencies: deps,
                output_dir: entity_dir(output_dir, category, &scene.name),
                layout_category: category,
                entity_id: scene.id.clone(),
                class_name,
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
        let category = classify_component_category(&component.category);
        let class_name = class_name_for(category, &component.name);

        let mut lines = vec![
            format!(
                "# コード生成指示: {} ({})",
                component.name,
                category.dir_name()
            ),
            String::new(),
            format!("## ターゲットプラットフォーム: {}", self.platform),
            format!("## 実装言語: {}", lang),
            format!("## 出力カテゴリ: {}", category.dir_name()),
            format!("## クラス名: `{}`", class_name),
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
        lines.push(format!(
            "1. メインモジュールファイル: `{}{}` (クラス名 `{}`)",
            class_name, ext, class_name
        ));
        lines.push(format!(
            "2. このファイルは出力ルート配下の `{}/{}/` に配置すること",
            category.dir_name(),
            class_name
        ));
        lines.push("3. 各タスクの実装".into());
        lines.push("4. エラーハンドリング".into());

        lines.join("\n")
    }

    fn build_actor_prompt(&self, scene: &Scene, actor: &ars_core::models::Actor) -> String {
        let (lang, ext, _pattern) = self.platform_info();
        let category = LayoutCategory::Actor;
        let class_name = class_name_for(category, &actor.name);

        let mut lines = vec![
            format!("# コード生成指示: {} (Actor)", actor.name),
            String::new(),
            format!("## ターゲットプラットフォーム: {}", self.platform),
            format!("## 実装言語: {}", lang),
            format!("## 所属シーン: {}", scene.name),
            format!("## ドメインロール: {}", actor.role),
            format!("## アクタータイプ: {}", actor.actor_type),
            format!("## クラス名: `{}`", class_name),
            String::new(),
        ];

        if !actor.requirements.overview.is_empty() {
            lines.push("## 概要".into());
            for item in &actor.requirements.overview {
                lines.push(format!("- {}", item));
            }
            lines.push(String::new());
        }
        if !actor.requirements.goals.is_empty() {
            lines.push("## 達成目標".into());
            for item in &actor.requirements.goals {
                lines.push(format!("- {}", item));
            }
            lines.push(String::new());
        }
        if !actor.requirements.role.is_empty() {
            lines.push("## 役割".into());
            for item in &actor.requirements.role {
                lines.push(format!("- {}", item));
            }
            lines.push(String::new());
        }
        if !actor.requirements.behavior.is_empty() {
            lines.push("## 挙動".into());
            for item in &actor.requirements.behavior {
                lines.push(format!("- {}", item));
            }
            lines.push(String::new());
        }

        lines.push("## 生成要件".into());
        lines.push(format!(
            "1. アクタークラス: `{}{}` (クラス名 `{}`、Actor サフィックス必須)",
            class_name, ext, class_name
        ));
        lines.push(format!(
            "2. 出力配置: `Actor/{}/`",
            class_name
        ));
        lines.push("3. ドメインロール / 要件定義をクラスのヘッダコメントに反映".into());
        lines.join("\n")
    }

    fn build_action_prompt(&self, scene: &Scene, action: &ars_core::models::Action) -> String {
        let (lang, ext, _pattern) = self.platform_info();
        // Action はサフィックスを付与しない
        let class_name = class_name_for(LayoutCategory::Action, &action.name);

        let mut lines = vec![
            format!("# コード生成指示: {} (Action)", action.name),
            String::new(),
            format!("## ターゲットプラットフォーム: {}", self.platform),
            format!("## 実装言語: {}", lang),
            format!("## 所属シーン: {}", scene.name),
            format!(
                "## アクション種別: {}",
                serde_json::to_string(&action.action_type).unwrap_or("\"interface\"".into())
            ),
            format!("## クラス名: `{}` (サフィックス無し)", class_name),
            String::new(),
        ];

        if !action.description.is_empty() {
            lines.push("## 説明".into());
            lines.push(action.description.clone());
            lines.push(String::new());
        }
        if !action.behaviors.is_empty() {
            lines.push("## 振る舞い".into());
            for b in &action.behaviors {
                lines.push(format!("- {}", b));
            }
            lines.push(String::new());
        }
        if !action.concretes.is_empty() {
            lines.push("## 具体実装".into());
            for c in &action.concretes {
                lines.push(format!("- {}: {}", c.name, c.description));
            }
            lines.push(String::new());
        }

        lines.push("## 生成要件".into());
        lines.push(format!(
            "1. アクション本体: `{}{}` (クラス名 `{}` — サフィックスを付与しない)",
            class_name, ext, class_name
        ));
        lines.push(format!("2. 出力配置: `Action/{}/`", class_name));
        lines.join("\n")
    }

    fn build_scene_prompt(&self, scene: &Scene) -> String {
        let (lang, ext, _pattern) = self.platform_info();
        let category = LayoutCategory::Scene;
        let class_name = class_name_for(category, &scene.name);
        let mut lines = vec![
            format!("# コード生成指示: {} シーン", scene.name),
            String::new(),
            format!("## ターゲットプラットフォーム: {}", self.platform),
            format!("## 実装言語: {}", lang),
            format!("## クラス名: `{}` (Scene サフィックス必須)", class_name),
            format!(
                "## 出力配置: `Scene/{}/{}{}`",
                class_name, class_name, ext
            ),
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
