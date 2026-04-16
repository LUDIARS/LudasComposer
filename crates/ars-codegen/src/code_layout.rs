//! コード生成の出力レイアウト
//!
//! Ars プロジェクトの構造（Scene / Actor / Module / Action / UI / Data）と
//! 1:1 で対応するディレクトリ構造とクラス命名規則を提供する。
//!
//! - **Scene / Actor / UI / Data** : クラス名にカテゴリ名のサフィックスを付与する。
//!   - 例: `MainScene`, `PlayerActor`, `HealthBarUI`, `GameStateData`
//! - **Module / Action** : サフィックスを付与しない（バレな名前を使う）。
//!   - 例: `Health`, `Attack`
//!
//! コード詳細設計（codedesign）と生成コードのパスは本モジュールの関数で
//! 一貫した形に揃え、フィードバック処理（manifest との突き合わせ）でも同じ
//! 形を再現する。

use serde::{Deserialize, Serialize};

/// 生成エンティティのカテゴリ
///
/// Ars プロジェクトの主要構造に 1:1 で対応する。
/// `Module` と `Action` のみクラス名にサフィックスを付与しない。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LayoutCategory {
    Scene,
    Actor,
    Module,
    Action,
    Ui,
    Data,
}

impl LayoutCategory {
    /// ディレクトリ名（出力ルート直下のフォルダ名）
    pub fn dir_name(&self) -> &'static str {
        match self {
            Self::Scene => "Scene",
            Self::Actor => "Actor",
            Self::Module => "Module",
            Self::Action => "Action",
            Self::Ui => "UI",
            Self::Data => "Data",
        }
    }

    /// クラス名に付与するサフィックス（ない場合は空文字列）
    ///
    /// Module / Action はサフィックスを付けない。
    pub fn class_suffix(&self) -> &'static str {
        match self {
            Self::Scene => "Scene",
            Self::Actor => "Actor",
            Self::Ui => "UI",
            Self::Data => "Data",
            Self::Module | Self::Action => "",
        }
    }

    /// 文字列名称（manifest や CLI で使う）
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Scene => "scene",
            Self::Actor => "actor",
            Self::Module => "module",
            Self::Action => "action",
            Self::Ui => "ui",
            Self::Data => "data",
        }
    }

    /// 文字列からの復元
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "scene" => Some(Self::Scene),
            "actor" => Some(Self::Actor),
            "module" | "component" => Some(Self::Module),
            "action" => Some(Self::Action),
            "ui" => Some(Self::Ui),
            "data" => Some(Self::Data),
            _ => None,
        }
    }
}

/// コンポーネントカテゴリ ("UI" / "Logic" / ... ) を LayoutCategory に振り分ける。
///
/// `category == "UI"` のみ `LayoutCategory::Ui` に分類し、
/// それ以外は `LayoutCategory::Module` として扱う。
pub fn classify_component_category(component_category: &str) -> LayoutCategory {
    if component_category.eq_ignore_ascii_case("UI") {
        LayoutCategory::Ui
    } else {
        LayoutCategory::Module
    }
}

/// 任意の入力文字列を PascalCase に変換する。
///
/// アルファベットの区切り（空白・ハイフン・アンダースコア・ピリオド）を境界として
/// 各セグメントを連結し、各セグメントの先頭を大文字化する。日本語などの非ASCII文字は
/// そのまま保持し、PascalCase 化はASCII英数字部分にのみ作用する。
pub fn to_pascal_case(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut capitalize_next = true;
    for ch in input.chars() {
        if ch.is_ascii_whitespace() || matches!(ch, '-' | '_' | '.' | '/' | '\\') {
            capitalize_next = true;
            continue;
        }
        if capitalize_next {
            for upper in ch.to_uppercase() {
                out.push(upper);
            }
            capitalize_next = false;
        } else {
            out.push(ch);
        }
    }
    out
}

/// 任意の入力文字列を kebab-case に変換する。
///
/// PascalCase / camelCase の大文字遷移を `-` で区切り、空白・アンダースコアも `-` に
/// 統一して全体を小文字化する。
pub fn to_kebab_case(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut prev_lower_or_digit = false;
    for ch in input.chars() {
        if ch.is_ascii_whitespace() || matches!(ch, '_' | '.' | '/' | '\\') {
            if !out.ends_with('-') {
                out.push('-');
            }
            prev_lower_or_digit = false;
            continue;
        }
        if ch == '-' {
            if !out.ends_with('-') {
                out.push('-');
            }
            prev_lower_or_digit = false;
            continue;
        }
        if ch.is_ascii_uppercase() {
            if prev_lower_or_digit && !out.ends_with('-') {
                out.push('-');
            }
            for lower in ch.to_lowercase() {
                out.push(lower);
            }
            prev_lower_or_digit = false;
        } else {
            out.push(ch);
            prev_lower_or_digit = ch.is_ascii_alphanumeric();
        }
    }
    let trimmed = out.trim_matches('-');
    trimmed.to_string()
}

/// クラス名を組み立てる
///
/// 入力名を PascalCase 化し、`LayoutCategory::class_suffix()` を末尾に付与する。
pub fn class_name_for(category: LayoutCategory, raw_name: &str) -> String {
    let base = to_pascal_case(raw_name);
    let suffix = category.class_suffix();
    if suffix.is_empty() || base.ends_with(suffix) {
        base
    } else {
        format!("{}{}", base, suffix)
    }
}

/// 出力ファイル名（拡張子付き）
pub fn file_name_for(category: LayoutCategory, raw_name: &str, ext: &str) -> String {
    format!("{}{}", class_name_for(category, raw_name), ext)
}

/// エンティティ単位の出力ディレクトリパスを生成する。
///
/// パスは出力ルート直下の `{Category}/{ClassName}/` で構成される。Module / Action は
/// クラス名にサフィックスが付かないため `{Category}/{Name}/` となる。
pub fn entity_dir(output_root: &str, category: LayoutCategory, raw_name: &str) -> String {
    format!(
        "{}/{}/{}",
        trim_trailing_sep(output_root),
        category.dir_name(),
        class_name_for(category, raw_name)
    )
}

/// 単一ファイル配置のエンティティ用ファイルパスを返す（サブディレクトリを作らない）。
pub fn flat_entity_path(
    output_root: &str,
    category: LayoutCategory,
    raw_name: &str,
    ext: &str,
) -> String {
    format!(
        "{}/{}/{}",
        trim_trailing_sep(output_root),
        category.dir_name(),
        file_name_for(category, raw_name, ext)
    )
}

fn trim_trailing_sep(s: &str) -> &str {
    s.trim_end_matches('/').trim_end_matches('\\')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pascal_case_basic() {
        assert_eq!(to_pascal_case("player character"), "PlayerCharacter");
        assert_eq!(to_pascal_case("player-character"), "PlayerCharacter");
        assert_eq!(to_pascal_case("playerCharacter"), "PlayerCharacter");
        assert_eq!(to_pascal_case("PLAYER_character"), "PLAYERCharacter");
    }

    #[test]
    fn kebab_case_basic() {
        assert_eq!(to_kebab_case("PlayerCharacter"), "player-character");
        assert_eq!(to_kebab_case("player_character"), "player-character");
        assert_eq!(to_kebab_case("Player Character"), "player-character");
    }

    #[test]
    fn class_name_with_suffix() {
        assert_eq!(class_name_for(LayoutCategory::Scene, "Main"), "MainScene");
        assert_eq!(
            class_name_for(LayoutCategory::Actor, "player-character"),
            "PlayerCharacterActor"
        );
        assert_eq!(class_name_for(LayoutCategory::Ui, "HealthBar"), "HealthBarUI");
        assert_eq!(class_name_for(LayoutCategory::Data, "GameState"), "GameStateData");
    }

    #[test]
    fn class_name_without_suffix_for_module_and_action() {
        assert_eq!(class_name_for(LayoutCategory::Module, "Health"), "Health");
        assert_eq!(class_name_for(LayoutCategory::Action, "Attack"), "Attack");
    }

    #[test]
    fn duplicate_suffix_is_not_appended() {
        // 既にサフィックスが付いている名前に二重付与しない
        assert_eq!(class_name_for(LayoutCategory::Scene, "MainScene"), "MainScene");
        assert_eq!(class_name_for(LayoutCategory::Actor, "PlayerActor"), "PlayerActor");
    }

    #[test]
    fn entity_dir_layout() {
        assert_eq!(
            entity_dir("./out", LayoutCategory::Scene, "Main"),
            "./out/Scene/MainScene"
        );
        assert_eq!(
            entity_dir("./out/", LayoutCategory::Module, "Health"),
            "./out/Module/Health"
        );
    }

    #[test]
    fn classify_component_category_works() {
        assert_eq!(classify_component_category("UI"), LayoutCategory::Ui);
        assert_eq!(classify_component_category("ui"), LayoutCategory::Ui);
        assert_eq!(classify_component_category("Logic"), LayoutCategory::Module);
        assert_eq!(classify_component_category("System"), LayoutCategory::Module);
        assert_eq!(classify_component_category("GameObject"), LayoutCategory::Module);
    }

    #[test]
    fn category_str_roundtrip() {
        for cat in [
            LayoutCategory::Scene,
            LayoutCategory::Actor,
            LayoutCategory::Module,
            LayoutCategory::Action,
            LayoutCategory::Ui,
            LayoutCategory::Data,
        ] {
            assert_eq!(LayoutCategory::from_str(cat.as_str()), Some(cat));
        }
    }
}
