use crate::models::*;
use once_cell::sync::Lazy;
use regex::Regex;
use uuid::Uuid;

static HEADER_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?m)^###\s+(.+?)(?:\s+モジュール定義)?$").unwrap());
static TASK_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?m)^#####\s+タスク\s*\n([\s\S]*?)(?=\n####|\n###|\n#####|\z)").unwrap());
static VAR_TYPE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^(.+?)\s*\((.+?)\)$").unwrap());

/// Arsモジュール定義のMarkdownをパースする
///
/// plan.md セクション8のフォーマットに準拠:
/// ```markdown
/// ### モジュール名
/// #### 概要
/// #### カテゴリ
/// #### 所属ドメイン
/// #### 必要なデータ
/// #### 変数
/// #### 依存
/// #### 作業
/// ##### 入力
/// ##### 出力
/// ##### タスク
/// #### テスト
/// ```
pub fn parse_module_markdown(content: &str, source_path: Option<&str>) -> Vec<ModuleDefinition> {
    let mut modules = Vec::new();

    // "### " で始まるセクションでモジュールを分割
    // ただし "#### " 以上の深さは除外
    let module_sections = split_by_module_headers(content);

    for (module_name, section_content) in module_sections {
        if let Some(module) = parse_single_module(&module_name, &section_content, source_path) {
            modules.push(module);
        }
    }

    modules
}

/// Markdownを "### " ヘッダーでモジュール単位に分割
fn split_by_module_headers(content: &str) -> Vec<(String, String)> {
    let mut result = Vec::new();

    let matches: Vec<_> = HEADER_RE.find_iter(content).collect();
    let captures: Vec<_> = HEADER_RE.captures_iter(content).collect();

    for (i, cap) in captures.iter().enumerate() {
        let name = cap[1].trim().to_string();
        let start = matches[i].end();
        let end = if i + 1 < matches.len() {
            matches[i + 1].start()
        } else {
            content.len()
        };
        let section = content[start..end].to_string();
        result.push((name, section));
    }

    result
}

/// 単一モジュールのセクションをパースしてModuleDefinitionを生成
fn parse_single_module(
    name: &str,
    content: &str,
    source_path: Option<&str>,
) -> Option<ModuleDefinition> {
    let summary = extract_section(content, "概要").unwrap_or_default();
    let category_str = extract_section(content, "カテゴリ").unwrap_or_default();
    let category = ModuleCategory::from_str(&category_str)?;
    let domain = extract_section(content, "所属ドメイン").unwrap_or_default();
    let required_data = extract_list_items(content, "必要なデータ");
    let variables = parse_variables(content);
    let dependencies = extract_list_items(content, "依存");
    let tasks = parse_tasks(content);
    let tests = extract_list_items(content, "テスト")
        .into_iter()
        .map(|desc| TestCase { description: desc })
        .collect();

    Some(ModuleDefinition {
        id: Uuid::new_v4().to_string(),
        name: name.to_string(),
        summary,
        category,
        domain,
        required_data,
        variables,
        dependencies,
        tasks,
        tests,
        source_path: source_path.map(|s| s.to_string()),
        source_repo: None,
    })
}

/// "#### {header}" セクションのテキスト本文を抽出
fn extract_section(content: &str, header: &str) -> Option<String> {
    let pattern = format!(r"(?m)^####\s+{}\s*\n([\s\S]*?)(?=\n####|\n###|\z)", regex::escape(header));
    let re = Regex::new(&pattern).ok()?;
    let caps = re.captures(content)?;
    let text = caps[1].trim().to_string();
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

/// セクション内のリストアイテム(- で始まる行)を抽出
fn extract_list_items(content: &str, header: &str) -> Vec<String> {
    let section = match extract_section(content, header) {
        Some(s) => s,
        None => return Vec::new(),
    };

    section
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.starts_with("- ") || trimmed.starts_with("* ") {
                Some(trimmed[2..].trim().to_string())
            } else {
                None
            }
        })
        .collect()
}

/// 変数セクションをパースして VariableDefinition のリストに変換
fn parse_variables(content: &str) -> Vec<VariableDefinition> {
    let items = extract_list_items(content, "変数");
    items
        .into_iter()
        .filter_map(|item| {
            // フォーマット: "変数名: 説明" または "変数名 (型): 説明"
            let parts: Vec<&str> = item.splitn(2, ':').collect();
            if parts.len() >= 2 {
                let name_part = parts[0].trim();
                let desc = parts[1].trim().to_string();

                // 型情報があれば抽出 "name (type)"
                let (name, var_type) = if let Some(caps) = VAR_TYPE_RE.captures(name_part) {
                    (caps[1].trim().to_string(), caps[2].trim().to_string())
                } else {
                    (name_part.to_string(), "unknown".to_string())
                };

                Some(VariableDefinition {
                    name,
                    var_type,
                    description: Some(desc),
                })
            } else {
                Some(VariableDefinition {
                    name: item,
                    var_type: "unknown".to_string(),
                    description: None,
                })
            }
        })
        .collect()
}

/// 作業セクション内のタスクをパース
fn parse_tasks(content: &str) -> Vec<TaskDefinition> {
    // "##### タスク" セクションを探す
    let task_section = match TASK_RE.captures(content) {
        Some(caps) => caps[1].to_string(),
        None => return Vec::new(),
    };

    // 入力セクションのパース
    let inputs = parse_port_section(content, "入力");
    // 出力セクションのパース
    let outputs = parse_port_section(content, "出力");

    // 各タスク行をパース: "- タスク名: 説明"
    task_section
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.starts_with("- ") || trimmed.starts_with("* ") {
                let task_text = trimmed[2..].trim();
                let parts: Vec<&str> = task_text.splitn(2, ':').collect();
                if parts.len() >= 2 {
                    Some(TaskDefinition {
                        name: parts[0].trim().to_string(),
                        description: parts[1].trim().to_string(),
                        inputs: inputs.clone(),
                        outputs: outputs.clone(),
                    })
                } else {
                    Some(TaskDefinition {
                        name: task_text.to_string(),
                        description: String::new(),
                        inputs: inputs.clone(),
                        outputs: outputs.clone(),
                    })
                }
            } else {
                None
            }
        })
        .collect()
}

/// 入力/出力セクションからポート定義を抽出
fn parse_port_section(content: &str, header: &str) -> Vec<PortDefinition> {
    let pattern = format!(
        r"(?m)^#####\s+{}\s*\n([\s\S]*?)(?=\n#####|\n####|\n###|\z)",
        regex::escape(header)
    );
    let re = match Regex::new(&pattern) {
        Ok(r) => r,
        Err(_) => return Vec::new(),
    };

    let section = match re.captures(content) {
        Some(caps) => caps[1].to_string(),
        None => return Vec::new(),
    };

    section
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.starts_with("- ") || trimmed.starts_with("* ") {
                let port_text = trimmed[2..].trim().to_string();
                Some(PortDefinition {
                    name: port_text.clone(),
                    port_type: "any".to_string(),
                })
            } else {
                None
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_module_from_plan_format() {
        let markdown = r#"
### シーンマネージャー モジュール定義

#### 概要
プロジェクト内のシーンの作成・選択・削除・名前変更を管理する

#### カテゴリ
UI

#### 所属ドメイン
エディタ

#### 必要なデータ
- プロジェクト内のシーン一覧
- アクティブシーンID

#### 変数
- scenes: シーンオブジェクトのMap
- activeSceneId: 現在選択中のシーンID (null許容)

#### 依存
- ProjectStore

#### 作業
##### 入力
- ユーザーからのシーン名入力
- ユーザーからのシーン選択操作

##### 出力
- 更新されたシーン一覧の描画
- アクティブシーン変更イベント

##### タスク
- シーン作成: 名前を受け取り、新規Scene + ルートActor(role=scene)を生成しストアに追加
- シーン選択: IDを受け取り、activeSceneIdを更新

#### テスト
- シーンを作成すると、一覧に新規シーンが追加されること
- シーンを削除すると、一覧から消えること
"#;

        let modules = parse_module_markdown(markdown, Some("test.md"));
        assert_eq!(modules.len(), 1);

        let m = &modules[0];
        assert_eq!(m.name, "シーンマネージャー");
        assert_eq!(m.category, ModuleCategory::UI);
        assert_eq!(m.domain, "エディタ");
        assert_eq!(m.required_data.len(), 2);
        assert_eq!(m.variables.len(), 2);
        assert_eq!(m.dependencies.len(), 1);
        assert_eq!(m.tasks.len(), 2);
        assert_eq!(m.tests.len(), 2);
    }
}
