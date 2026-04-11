//! コード生成ブリッジ
//!
//! Ars UI からコード生成用 Claude Code セッションを起動する際に渡す設定を定義する。
//! 対象環境・出力フォーマットの選択を UI 側で行い、このモジュールの型を通じて
//! PromptGenerator / SessionRunner に橋渡しする。

use serde::{Deserialize, Serialize};

use crate::prompt_generator::{CodegenTask, PromptGenerator};
use ars_core::models::Project;

// ── 対象プラットフォーム ────────────────────────────────

/// コード生成の対象プラットフォーム
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TargetPlatform {
    /// Unity Engine (C# / MonoBehaviour)
    Unity,
    /// Godot Engine (GDScript / Node)
    Godot,
    /// Unreal Engine (C++ / UObject)
    #[serde(rename = "unreal")]
    Unreal,
    /// Ars 独自ランタイム (TypeScript)
    Ergo,
}

impl TargetPlatform {
    /// `PromptGenerator` に渡すプラットフォーム文字列
    pub fn as_platform_str(&self) -> &'static str {
        match self {
            Self::Unity => "unity",
            Self::Godot => "godot",
            Self::Unreal => "unreal",
            Self::Ergo => "ars-native",
        }
    }

    /// 表示用ラベル
    pub fn label(&self) -> &'static str {
        match self {
            Self::Unity => "Unity (C#)",
            Self::Godot => "Godot (GDScript)",
            Self::Unreal => "Unreal Engine (C++)",
            Self::Ergo => "Ergo (TypeScript)",
        }
    }

    /// 生成されるファイルの拡張子
    pub fn file_extension(&self) -> &'static str {
        match self {
            Self::Unity => ".cs",
            Self::Godot => ".gd",
            Self::Unreal => ".cpp",
            Self::Ergo => ".ts",
        }
    }

    /// 生成される言語名
    pub fn language(&self) -> &'static str {
        match self {
            Self::Unity => "C#",
            Self::Godot => "GDScript",
            Self::Unreal => "C++",
            Self::Ergo => "TypeScript",
        }
    }
}

// ── 出力フォーマット ────────────────────────────────────

/// コード生成の出力フォーマット
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OutputFormat {
    /// ソースコードのみ (実装ファイル)
    SourceOnly,
    /// ソースコード + テスト
    WithTests,
    /// ソースコード + テスト + ドキュメント
    Full,
}

impl OutputFormat {
    pub fn label(&self) -> &'static str {
        match self {
            Self::SourceOnly => "Source Only",
            Self::WithTests => "Source + Tests",
            Self::Full => "Source + Tests + Docs",
        }
    }

    /// プロンプトに追加する生成要件テキスト
    pub fn prompt_requirements(&self) -> &'static str {
        match self {
            Self::SourceOnly => "",
            Self::WithTests => concat!(
                "\n## テスト要件\n",
                "- 各タスクに対するユニットテストを生成すること\n",
                "- エッジケースを含むテストケースを作成すること\n",
            ),
            Self::Full => concat!(
                "\n## テスト要件\n",
                "- 各タスクに対するユニットテストを生成すること\n",
                "- エッジケースを含むテストケースを作成すること\n",
                "\n## ドキュメント要件\n",
                "- 各モジュール・関数にドキュメントコメントを付与すること\n",
                "- README.md を生成し、モジュールの概要・使用方法・API リファレンスを記載すること\n",
            ),
        }
    }
}

// ── ブリッジ設定 ────────────────────────────────────────

/// UI から渡されるコード生成ブリッジ設定
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodegenBridgeConfig {
    /// 対象プラットフォーム
    pub platform: TargetPlatform,
    /// 出力フォーマット
    pub output_format: OutputFormat,
    /// 出力ディレクトリ (デフォルト: "./generated")
    #[serde(default = "default_output_dir")]
    pub output_dir: String,
    /// 対象シーン ID (空の場合は全シーン)
    #[serde(default)]
    pub scene_ids: Vec<String>,
    /// 対象コンポーネント ID (空の場合は全コンポーネント)
    #[serde(default)]
    pub component_ids: Vec<String>,
    /// ドライラン (プロンプトのみ生成、Claude Code は起動しない)
    #[serde(default)]
    pub dry_run: bool,
    /// 最大同時実行数
    #[serde(default = "default_max_concurrent")]
    pub max_concurrent: usize,
    /// Claude Code のモデル指定
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    /// パーミッションモード (auto/default/plan)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permission_mode: Option<String>,
}

fn default_output_dir() -> String {
    "./generated".to_string()
}

fn default_max_concurrent() -> usize {
    1
}

// ── プレビュー結果 ──────────────────────────────────────

/// 生成プレビュー (タスクのリスト)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodegenPreviewTask {
    pub id: String,
    pub task_type: String,
    pub name: String,
    pub output_dir: String,
    pub dependencies: Vec<String>,
    pub prompt_preview: String,
}

/// プレビュー結果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodegenPreviewResult {
    pub platform: TargetPlatform,
    pub output_format: OutputFormat,
    pub language: String,
    pub file_extension: String,
    pub tasks: Vec<CodegenPreviewTask>,
    pub total_tasks: usize,
}

// ── ブリッジ本体 ────────────────────────────────────────

/// コード生成ブリッジ
///
/// UI から受け取った `CodegenBridgeConfig` をもとに、
/// `PromptGenerator` でタスクを生成し、プレビューまたは実行する。
pub struct CodegenBridge;

impl CodegenBridge {
    /// 設定をもとにタスクをプレビュー (実行はしない)
    pub fn preview(project: &Project, config: &CodegenBridgeConfig) -> CodegenPreviewResult {
        let tasks = Self::generate_tasks(project, config);

        let preview_tasks: Vec<CodegenPreviewTask> = tasks
            .into_iter()
            .map(|t| {
                // プロンプトの先頭200文字をプレビューとして返す
                let preview = if t.prompt.len() > 200 {
                    format!("{}...", &t.prompt[..200])
                } else {
                    t.prompt
                };
                CodegenPreviewTask {
                    id: t.id,
                    task_type: t.task_type,
                    name: t.name,
                    output_dir: t.output_dir,
                    dependencies: t.dependencies,
                    prompt_preview: preview,
                }
            })
            .collect();

        let total = preview_tasks.len();

        CodegenPreviewResult {
            platform: config.platform,
            output_format: config.output_format,
            language: config.platform.language().to_string(),
            file_extension: config.platform.file_extension().to_string(),
            tasks: preview_tasks,
            total_tasks: total,
        }
    }

    /// 設定をもとに `CodegenTask` を生成する
    pub fn generate_tasks(project: &Project, config: &CodegenBridgeConfig) -> Vec<CodegenTask> {
        let gen = PromptGenerator::new(project, config.platform.as_platform_str());

        let scene_ids = if config.scene_ids.is_empty() {
            None
        } else {
            Some(config.scene_ids.as_slice())
        };
        let comp_ids = if config.component_ids.is_empty() {
            None
        } else {
            Some(config.component_ids.as_slice())
        };

        let mut tasks = gen.generate_tasks(&config.output_dir, scene_ids, comp_ids);

        // 出力フォーマットに応じてプロンプトに要件を追加
        let extra = config.output_format.prompt_requirements();
        if !extra.is_empty() {
            for task in &mut tasks {
                task.prompt.push_str(extra);
            }
        }

        tasks
    }

    /// `CodegenConfig` を組み立てる (SessionRunner に渡す用)
    pub fn build_session_config(
        config: &CodegenBridgeConfig,
        project_file: &str,
    ) -> crate::session_runner::CodegenConfig {
        crate::session_runner::CodegenConfig {
            project_file: project_file.to_string(),
            output_dir: config.output_dir.clone(),
            dry_run: config.dry_run,
            max_concurrent: config.max_concurrent,
            claude_model: config.model.clone(),
            claude_permission_mode: config.permission_mode.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_platform_as_str() {
        assert_eq!(TargetPlatform::Unity.as_platform_str(), "unity");
        assert_eq!(TargetPlatform::Godot.as_platform_str(), "godot");
        assert_eq!(TargetPlatform::Unreal.as_platform_str(), "unreal");
        assert_eq!(TargetPlatform::Ergo.as_platform_str(), "ars-native");
    }

    #[test]
    fn test_platform_serde() {
        let json = serde_json::to_string(&TargetPlatform::Unity).unwrap();
        assert_eq!(json, "\"unity\"");
        let parsed: TargetPlatform = serde_json::from_str("\"godot\"").unwrap();
        assert_eq!(parsed, TargetPlatform::Godot);
        let parsed: TargetPlatform = serde_json::from_str("\"unreal\"").unwrap();
        assert_eq!(parsed, TargetPlatform::Unreal);
        let parsed: TargetPlatform = serde_json::from_str("\"ergo\"").unwrap();
        assert_eq!(parsed, TargetPlatform::Ergo);
    }

    #[test]
    fn test_output_format_serde() {
        let json = serde_json::to_string(&OutputFormat::WithTests).unwrap();
        assert_eq!(json, "\"with-tests\"");
        let parsed: OutputFormat = serde_json::from_str("\"source-only\"").unwrap();
        assert_eq!(parsed, OutputFormat::SourceOnly);
    }

    #[test]
    fn test_bridge_config_defaults() {
        let json = r#"{"platform":"unity","outputFormat":"source-only"}"#;
        let config: CodegenBridgeConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.platform, TargetPlatform::Unity);
        assert_eq!(config.output_format, OutputFormat::SourceOnly);
        assert_eq!(config.output_dir, "./generated");
        assert!(config.scene_ids.is_empty());
        assert!(config.component_ids.is_empty());
        assert!(!config.dry_run);
        assert_eq!(config.max_concurrent, 1);
    }

    #[test]
    fn test_preview_empty_project() {
        let project = Project {
            name: "Test".to_string(),
            scenes: std::collections::HashMap::new(),
            components: std::collections::HashMap::new(),
            prefabs: std::collections::HashMap::new(),
            active_scene_id: None,
        };
        let config = CodegenBridgeConfig {
            platform: TargetPlatform::Ergo,
            output_format: OutputFormat::SourceOnly,
            output_dir: "./out".to_string(),
            scene_ids: vec![],
            component_ids: vec![],
            dry_run: false,
            max_concurrent: 1,
            model: None,
            permission_mode: None,
        };
        let result = CodegenBridge::preview(&project, &config);
        assert_eq!(result.total_tasks, 0);
        assert_eq!(result.language, "TypeScript");
        assert_eq!(result.file_extension, ".ts");
    }
}
