//! codedesign Markdown パーサ
//!
//! `codedesign-generation-rules.md` のテンプレートに準拠する MD ファイルから、
//! Ars プロジェクトに反映する候補となる軽量フィールドを抽出する。
//!
//! 抽出対象（フェーズ2 適用範囲）:
//!
//! - `# {見出し}` から `entity_name`
//! - `## メタ情報` セクションの `- **ID**: {id}` から `entity_id`
//! - `## 概要 / 達成目標 / 役割 / 挙動` セクションの箇条書き
//! - `## アクション定義` テーブル / `## 振る舞い` セクションのアクション情報
//!
//! 厳格な Markdown パーサではなく、生成テンプレートが固定的であることを前提とした
//! 行ベースの軽量抽出器。テンプレートから外れた手書き MD では空に近い結果を返す。

use std::collections::BTreeMap;

/// 1 ファイル分の抽出結果
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ParsedCodedesign {
    /// `# {見出し}` から取得したエンティティ表示名
    pub title: Option<String>,
    /// `## メタ情報` の `- **ID**: ...` から取得した ID
    pub entity_id: Option<String>,
    /// `## メタ情報` の `- **タイプ**: ...`
    pub actor_type: Option<String>,
    /// `## メタ情報` の `- **ドメインロール**: ...`
    pub role: Option<String>,
    /// 見出し → 箇条書き行のマップ
    /// キーは見出しテキスト（`概要` / `達成目標` / `役割` / `挙動` / `振る舞い` 等）
    pub bullet_sections: BTreeMap<String, Vec<String>>,
}

impl ParsedCodedesign {
    pub fn overview(&self) -> Option<&[String]> {
        self.bullet_sections.get("概要").map(|v| v.as_slice())
    }
    pub fn goals(&self) -> Option<&[String]> {
        self.bullet_sections.get("達成目標").map(|v| v.as_slice())
    }
    pub fn role_items(&self) -> Option<&[String]> {
        self.bullet_sections.get("役割").map(|v| v.as_slice())
    }
    pub fn behavior(&self) -> Option<&[String]> {
        self.bullet_sections.get("挙動").map(|v| v.as_slice())
    }
    pub fn behaviors(&self) -> Option<&[String]> {
        // アクションファイル用: `## 振る舞い`
        self.bullet_sections.get("振る舞い").map(|v| v.as_slice())
    }
}

/// MD テキストを解析する。
pub fn parse(text: &str) -> ParsedCodedesign {
    let mut out = ParsedCodedesign::default();
    let mut current_h2: Option<String> = None;
    let mut in_meta = false;

    for line in text.lines() {
        let trimmed = line.trim();

        // タイトル (# heading)
        if let Some(rest) = trimmed.strip_prefix("# ") {
            if out.title.is_none() {
                out.title = Some(strip_inline_marks(rest.trim()));
            }
            continue;
        }

        // セクション境界
        if let Some(rest) = trimmed.strip_prefix("## ") {
            let heading = strip_inline_marks(rest.trim());
            in_meta = heading == "メタ情報";
            current_h2 = Some(heading.clone());
            // 既知見出しならば空 Vec を用意（重複登場時にもマージ可能）
            if matches!(
                heading.as_str(),
                "概要" | "達成目標" | "役割" | "挙動" | "振る舞い"
            ) {
                out.bullet_sections.entry(heading).or_default();
            }
            continue;
        }

        // メタ情報セクション内: `- **ID**: ...` 形式
        if in_meta {
            if let Some(rest) = trimmed.strip_prefix("- ") {
                if let Some((label, value)) = split_meta_line(rest) {
                    match label.as_str() {
                        "ID" => out.entity_id = Some(value),
                        "タイプ" => out.actor_type = Some(value),
                        "ドメインロール" => out.role = Some(value),
                        _ => {}
                    }
                }
                continue;
            }
        }

        // 既知の箇条書きセクション内
        if let Some(h) = &current_h2 {
            if !matches!(
                h.as_str(),
                "概要" | "達成目標" | "役割" | "挙動" | "振る舞い"
            ) {
                continue;
            }
            if let Some(rest) = trimmed.strip_prefix("- ") {
                let item = strip_inline_marks(rest.trim()).trim().to_string();
                if !item.is_empty() {
                    out.bullet_sections
                        .entry(h.clone())
                        .or_default()
                        .push(item);
                }
            }
        }
    }

    out
}

/// `**ID**: value` のような行を `(label, value)` に分割する
fn split_meta_line(s: &str) -> Option<(String, String)> {
    // `**LABEL**: value` を想定
    let stripped = s.strip_prefix("**")?;
    let close = stripped.find("**")?;
    let label = stripped[..close].trim().to_string();
    let after = stripped[close + 2..].trim_start();
    let after = after.strip_prefix(':').unwrap_or(after).trim();
    Some((label, after.to_string()))
}

/// `**bold**` / `` `code` `` といった軽量装飾を削除して中身だけを残す。
///
/// 完全な Markdown 解析ではなく、抽出した値を Project へ書き戻す前に
/// 飾り付けを除去する用途。
fn strip_inline_marks(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '*' => {
                // **bold** / *italic* どちらも単純に外す
                continue;
            }
            '`' => {
                continue;
            }
            _ => out.push(ch),
        }
    }
    out.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_ACTOR: &str = r#"# Player

## メタ情報
- **ID**: actor-player
- **タイプ**: state
- **ドメインロール**: protagonist
- **対象プラットフォーム**: ars-native

## 概要
- プレイヤーキャラクター
- ユーザーの主操作を受け取る

## 達成目標
- 入力に基づくキャラクター制御

## 役割
- 主人公

## 挙動
- 移動・攻撃・防御
"#;

    #[test]
    fn parses_actor_template() {
        let p = parse(SAMPLE_ACTOR);
        assert_eq!(p.title.as_deref(), Some("Player"));
        assert_eq!(p.entity_id.as_deref(), Some("actor-player"));
        assert_eq!(p.actor_type.as_deref(), Some("state"));
        assert_eq!(p.role.as_deref(), Some("protagonist"));
        assert_eq!(
            p.overview(),
            Some(["プレイヤーキャラクター", "ユーザーの主操作を受け取る"]
                .map(String::from)
                .as_slice())
        );
        assert_eq!(
            p.goals(),
            Some([String::from("入力に基づくキャラクター制御")].as_slice())
        );
        assert_eq!(p.role_items(), Some([String::from("主人公")].as_slice()));
        assert_eq!(
            p.behavior(),
            Some([String::from("移動・攻撃・防御")].as_slice())
        );
    }

    #[test]
    fn empty_sections_are_handled() {
        let md = "# Empty\n\n## メタ情報\n- **ID**: x\n\n## 概要\n";
        let p = parse(md);
        assert_eq!(p.entity_id.as_deref(), Some("x"));
        // 概要セクションは登場しているが空
        assert_eq!(p.overview(), Some(&[][..]));
    }

    #[test]
    fn ignores_unknown_sections() {
        let md = "# X\n\n## ランダム\n- foo\n- bar\n";
        let p = parse(md);
        assert_eq!(p.title.as_deref(), Some("X"));
        assert!(p.bullet_sections.is_empty() || !p.bullet_sections.contains_key("ランダム"));
    }

    #[test]
    fn parses_action_behaviors() {
        let md = r#"# Attack

## メタ情報
- **ID**: action-attack

## 振る舞い
- ダメージを計算する
- 命中判定を行う
"#;
        let p = parse(md);
        assert_eq!(p.entity_id.as_deref(), Some("action-attack"));
        assert_eq!(
            p.behaviors(),
            Some([
                String::from("ダメージを計算する"),
                String::from("命中判定を行う"),
            ]
            .as_slice())
        );
    }

    #[test]
    fn strip_inline_marks_works() {
        assert_eq!(strip_inline_marks("**Bold**"), "Bold");
        assert_eq!(strip_inline_marks("`code` value"), "code value");
        assert_eq!(strip_inline_marks("plain"), "plain");
    }

    #[test]
    fn split_meta_line_works() {
        let (label, value) = split_meta_line("**ID**: x-1").unwrap();
        assert_eq!(label, "ID");
        assert_eq!(value, "x-1");
    }
}
