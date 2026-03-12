use serde::{Deserialize, Serialize};

/// Arsモジュール定義のカテゴリ
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ModuleCategory {
    UI,
    Logic,
    System,
    GameObject,
}

impl ModuleCategory {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.trim() {
            "UI" => Some(Self::UI),
            "Logic" => Some(Self::Logic),
            "System" => Some(Self::System),
            "GameObject" => Some(Self::GameObject),
            _ => None,
        }
    }
}

/// ポート定義（タスクの入出力）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortDefinition {
    pub name: String,
    #[serde(rename = "type")]
    pub port_type: String,
}

/// 変数定義
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VariableDefinition {
    pub name: String,
    #[serde(rename = "type")]
    pub var_type: String,
    pub description: Option<String>,
}

/// タスク定義
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDefinition {
    pub name: String,
    pub description: String,
    pub inputs: Vec<PortDefinition>,
    pub outputs: Vec<PortDefinition>,
}

/// テストケース定義
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestCase {
    pub description: String,
}

/// Arsモジュール定義（markdownから解析）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleDefinition {
    pub id: String,
    pub name: String,
    pub summary: String,
    pub category: ModuleCategory,
    pub domain: String,
    pub required_data: Vec<String>,
    pub variables: Vec<VariableDefinition>,
    pub dependencies: Vec<String>,
    pub tasks: Vec<TaskDefinition>,
    pub tests: Vec<TestCase>,
    /// 定義ファイルの元パス
    pub source_path: Option<String>,
    /// 取得元リポジトリURL
    pub source_repo: Option<String>,
}

/// モジュールレジストリソース（GitHubリポジトリ）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleRegistrySource {
    pub id: String,
    pub name: String,
    pub repo_url: String,
    /// ローカルにクローンされたパス
    pub local_path: Option<String>,
    /// 定義ファイルを探すディレクトリパターン (e.g., "modules/*.md")
    pub definition_glob: String,
    /// 最後に同期した日時
    pub last_synced: Option<String>,
}

/// レジストリ全体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleRegistry {
    pub sources: Vec<ModuleRegistrySource>,
    pub modules: Vec<ModuleDefinition>,
}

impl Default for ModuleRegistry {
    fn default() -> Self {
        Self {
            sources: Vec::new(),
            modules: Vec::new(),
        }
    }
}
