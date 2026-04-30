//! TOML ローダ
//!
//! `spec/game-lexicon/` 配下のディレクトリを再帰的に読み、
//! `Lexicon` を構築 + 検証する純粋関数。 I/O 以外の状態を持たない。

use serde::Deserialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use crate::domain::{
    Feature, FeatureId, FeatureParameter, Genre, GenreId, I18nName, Lexicon, ParameterType,
    Preset, PresetId, TagId, Term, TermId,
};
use crate::error::{LexiconError, Result};

// ── 中間 (TOML 形) 型 ─────────────────────────
//
// TOML 側はフラットなフィールド名 (`name_ja` / `name_en`) なので、
// 一度 raw 構造体で受けてからドメインに変換する。

#[derive(Debug, Deserialize)]
struct RawGenre {
    id: String,
    name_ja: String,
    name_en: String,
    summary: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    default_preset: Option<String>,
    #[serde(default)]
    description: String,
}

#[derive(Debug, Deserialize)]
struct RawFeature {
    id: String,
    name_ja: String,
    name_en: String,
    summary: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    genres: Vec<String>,
    #[serde(default)]
    depends_on: Vec<String>,
    #[serde(default)]
    conflicts_with: Vec<String>,
    #[serde(default, rename = "parameter")]
    parameters: Vec<RawParameter>,
}

#[derive(Debug, Deserialize)]
struct RawParameter {
    id: String,
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    default: Option<toml::Value>,
    #[serde(default)]
    range: Option<(f64, f64)>,
    #[serde(default)]
    values: Vec<String>,
    #[serde(default)]
    description_ja: String,
    #[serde(default)]
    description_en: String,
}

#[derive(Debug, Deserialize)]
struct RawPreset {
    id: String,
    name_ja: String,
    name_en: String,
    genre: String,
    summary: String,
    features: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct RawTermsFile {
    #[serde(default, rename = "term")]
    terms: Vec<RawTerm>,
}

#[derive(Debug, Deserialize)]
struct RawTerm {
    id: String,
    name_ja: String,
    name_en: String,
    #[serde(default)]
    aliases: Vec<String>,
    definition: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    related_terms: Vec<String>,
}

// ── パブリック API ────────────────────────────

/// `<root>/{genres,features,presets,terms}` を走査して `Lexicon` を構築する。
pub fn load_from_dir(root: &Path) -> Result<Lexicon> {
    let genres_dir = root.join("genres");
    let features_dir = root.join("features");
    let presets_dir = root.join("presets");
    let terms_dir = root.join("terms");

    let mut lexicon = Lexicon::default();

    // genres
    for path in toml_files_in(&genres_dir)? {
        let raw: RawGenre = parse_toml(&path)?;
        lexicon.genres.push(Genre {
            id: GenreId::new(raw.id),
            names: I18nName {
                ja: raw.name_ja,
                en: raw.name_en,
            },
            summary: raw.summary,
            tags: raw.tags.into_iter().map(TagId::new).collect(),
            default_preset: raw.default_preset.map(PresetId::new),
            description: raw.description,
        });
    }

    // features (ネストしたサブディレクトリを再帰)
    for path in toml_files_in_recursive(&features_dir)? {
        let raw: RawFeature = parse_toml(&path)?;
        let parameters = raw
            .parameters
            .into_iter()
            .map(|p| convert_parameter(&path, p))
            .collect::<Result<Vec<_>>>()?;
        lexicon.features.push(Feature {
            id: FeatureId::new(raw.id),
            names: I18nName {
                ja: raw.name_ja,
                en: raw.name_en,
            },
            summary: raw.summary,
            tags: raw.tags.into_iter().map(TagId::new).collect(),
            genres: raw.genres.into_iter().map(GenreId::new).collect(),
            depends_on: raw.depends_on.into_iter().map(FeatureId::new).collect(),
            conflicts_with: raw.conflicts_with.into_iter().map(FeatureId::new).collect(),
            parameters,
        });
    }

    // presets
    for path in toml_files_in(&presets_dir)? {
        let raw: RawPreset = parse_toml(&path)?;
        lexicon.presets.push(Preset {
            id: PresetId::new(raw.id),
            names: I18nName {
                ja: raw.name_ja,
                en: raw.name_en,
            },
            genre: GenreId::new(raw.genre),
            summary: raw.summary,
            features: raw.features.into_iter().map(FeatureId::new).collect(),
        });
    }

    // terms (1 ファイルに `[[term]]` 複数)
    for path in toml_files_in(&terms_dir)? {
        let raw: RawTermsFile = parse_toml(&path)?;
        for t in raw.terms {
            lexicon.terms.push(Term {
                id: TermId::new(t.id),
                names: I18nName {
                    ja: t.name_ja,
                    en: t.name_en,
                },
                aliases: t.aliases,
                definition: t.definition,
                tags: t.tags.into_iter().map(TagId::new).collect(),
                related_terms: t.related_terms.into_iter().map(TermId::new).collect(),
            });
        }
    }

    validate(&lexicon)?;
    Ok(lexicon)
}

// ── 内部ヘルパ ────────────────────────────────

fn parse_toml<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<T> {
    let text = fs::read_to_string(path)?;
    toml::from_str(&text).map_err(|source| LexiconError::TomlParse {
        path: path.display().to_string(),
        source,
    })
}

fn toml_files_in(dir: &Path) -> Result<Vec<PathBuf>> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("toml") {
            out.push(path);
        }
    }
    out.sort();
    Ok(out)
}

fn toml_files_in_recursive(dir: &Path) -> Result<Vec<PathBuf>> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    let mut stack = vec![dir.to_path_buf()];
    while let Some(d) = stack.pop() {
        for entry in fs::read_dir(&d)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.extension().and_then(|s| s.to_str()) == Some("toml") {
                out.push(path);
            }
        }
    }
    out.sort();
    Ok(out)
}

fn convert_parameter(path: &Path, p: RawParameter) -> Result<FeatureParameter> {
    let kind = match p.kind.as_str() {
        "int" => ParameterType::Int,
        "float" => ParameterType::Float,
        "bool" => ParameterType::Bool,
        "string" => ParameterType::String,
        "enum" => ParameterType::Enum,
        other => {
            return Err(LexiconError::Validation(format!(
                "{}: unknown parameter type '{}' (id={})",
                path.display(),
                other,
                p.id
            )))
        }
    };
    if matches!(kind, ParameterType::Enum) && p.values.is_empty() {
        return Err(LexiconError::EnumWithoutValues(p.id.clone()));
    }
    if let Some((lo, hi)) = p.range {
        if lo > hi {
            return Err(LexiconError::InvalidRange(p.id.clone()));
        }
    }
    let default = p.default.map(toml_to_json);
    Ok(FeatureParameter {
        id: p.id,
        kind,
        default,
        range: p.range,
        values: p.values,
        description_ja: p.description_ja,
        description_en: p.description_en,
    })
}

fn toml_to_json(v: toml::Value) -> serde_json::Value {
    match v {
        toml::Value::String(s) => serde_json::Value::String(s),
        toml::Value::Integer(i) => serde_json::Value::Number(i.into()),
        toml::Value::Float(f) => serde_json::Number::from_f64(f)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        toml::Value::Boolean(b) => serde_json::Value::Bool(b),
        toml::Value::Array(arr) => {
            serde_json::Value::Array(arr.into_iter().map(toml_to_json).collect())
        }
        toml::Value::Table(t) => serde_json::Value::Object(
            t.into_iter().map(|(k, v)| (k, toml_to_json(v))).collect(),
        ),
        toml::Value::Datetime(dt) => serde_json::Value::String(dt.to_string()),
    }
}

// ── 検証 ──────────────────────────────────────

fn validate(lex: &Lexicon) -> Result<()> {
    // V01: 重複 ID
    check_unique(lex.genres.iter().map(|g| g.id.as_str()), "genre")?;
    check_unique(lex.features.iter().map(|f| f.id.as_str()), "feature")?;
    check_unique(lex.presets.iter().map(|p| p.id.as_str()), "preset")?;
    check_unique(lex.terms.iter().map(|t| t.id.as_str()), "term")?;

    // V02: 参照整合性
    let genre_ids: HashSet<&str> =
        lex.genres.iter().map(|g| g.id.as_str()).collect();
    let feature_ids: HashSet<&str> =
        lex.features.iter().map(|f| f.id.as_str()).collect();
    let preset_ids: HashSet<&str> =
        lex.presets.iter().map(|p| p.id.as_str()).collect();
    let term_ids: HashSet<&str> = lex.terms.iter().map(|t| t.id.as_str()).collect();

    for g in &lex.genres {
        if let Some(p) = &g.default_preset {
            if !preset_ids.contains(p.as_str()) {
                return Err(LexiconError::UnknownPreset(p.clone()));
            }
        }
    }
    for f in &lex.features {
        for gid in &f.genres {
            if !genre_ids.contains(gid.as_str()) {
                return Err(LexiconError::UnknownGenre(gid.clone()));
            }
        }
        for dep in &f.depends_on {
            if !feature_ids.contains(dep.as_str()) {
                return Err(LexiconError::UnknownFeature(dep.clone()));
            }
        }
        for c in &f.conflicts_with {
            if !feature_ids.contains(c.as_str()) {
                return Err(LexiconError::UnknownFeature(c.clone()));
            }
        }
    }
    for p in &lex.presets {
        if !genre_ids.contains(p.genre.as_str()) {
            return Err(LexiconError::UnknownGenre(p.genre.clone()));
        }
        for fid in &p.features {
            if !feature_ids.contains(fid.as_str()) {
                return Err(LexiconError::UnknownFeature(fid.clone()));
            }
        }
    }
    for t in &lex.terms {
        for r in &t.related_terms {
            if !term_ids.contains(r.as_str()) {
                return Err(LexiconError::UnknownTerm(r.clone()));
            }
        }
    }

    // V03: 循環依存 — Lexicon::expand_preset と同じ DFS で全 preset を試す
    for p in &lex.presets {
        let _ = lex.expand_preset(&p.id)?;
    }

    Ok(())
}

fn check_unique<'a>(
    iter: impl IntoIterator<Item = &'a str>,
    kind: &'static str,
) -> Result<()> {
    let mut seen: HashSet<&str> = HashSet::new();
    for id in iter {
        if !seen.insert(id) {
            return Err(LexiconError::DuplicateId {
                kind,
                id: id.to_string(),
            });
        }
    }
    Ok(())
}

// ── tests ─────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// 同梱 `spec/game-lexicon/` をロードできること
    #[test]
    fn load_builtin_seed() {
        // crates/ars-game-lexicon/ から見て `../../spec/game-lexicon`
        let manifest = env!("CARGO_MANIFEST_DIR");
        let root = Path::new(manifest).join("../../spec/game-lexicon");
        let lex = load_from_dir(&root).expect("load builtin");

        // 期待: 9 ジャンル / 9 プリセット / Feature 多数 / 用語多数
        assert_eq!(lex.genres.len(), 9, "9 genres expected");
        assert_eq!(lex.presets.len(), 9, "9 presets expected");
        assert!(lex.features.len() >= 30, "≥30 features");
        assert!(lex.terms.len() >= 10, "≥10 terms");

        // 既定プリセットが解決できる
        for g in &lex.genres {
            let p = g
                .default_preset
                .as_ref()
                .expect("each genre has default_preset");
            assert!(lex.get_preset(p).is_some(), "preset {p} found");
        }

        // action-basic を expand できる
        let expanded = lex
            .expand_preset(&PresetId::new("action-basic"))
            .expect("expand action-basic");
        let ids: Vec<&str> = expanded.iter().map(|f| f.id.as_str()).collect();
        // 依存は順序的に被依存より前にいる
        let pos_ib = ids.iter().position(|s| *s == "input-buffer").unwrap();
        let pos_combo = ids.iter().position(|s| *s == "combo-system").unwrap();
        assert!(pos_ib < pos_combo, "input-buffer before combo-system");
    }
}
