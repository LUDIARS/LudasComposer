//! ドメイン型: Genre / Feature / Preset / Term + ID newtype
//!
//! Layer 1 — 純粋データ。 I/O や永続化を持たない。

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

macro_rules! id_newtype {
    ($name:ident) => {
        #[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
        #[serde(transparent)]
        pub struct $name(pub String);

        impl $name {
            pub fn new(s: impl Into<String>) -> Self {
                Self(s.into())
            }
            pub fn as_str(&self) -> &str {
                &self.0
            }
        }

        impl From<&str> for $name {
            fn from(s: &str) -> Self {
                Self(s.to_string())
            }
        }

        impl From<String> for $name {
            fn from(s: String) -> Self {
                Self(s)
            }
        }

        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                f.write_str(&self.0)
            }
        }
    };
}

id_newtype!(GenreId);
id_newtype!(FeatureId);
id_newtype!(PresetId);
id_newtype!(TermId);
id_newtype!(TagId);

/// 日本語 / 英語の表示名ペア
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct I18nName {
    pub ja: String,
    pub en: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ParameterType {
    Int,
    Float,
    Bool,
    String,
    /// `values` が必須
    Enum,
}

/// Feature が宣言するパラメータ (ウィザード入力フォームを駆動する)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureParameter {
    pub id: String,
    pub kind: ParameterType,
    /// JSON-like default (TOML から serde_json::Value にする)
    #[serde(default)]
    pub default: Option<serde_json::Value>,
    #[serde(default)]
    pub range: Option<(f64, f64)>,
    #[serde(default)]
    pub values: Vec<String>,
    #[serde(default)]
    pub description_ja: String,
    #[serde(default)]
    pub description_en: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Genre {
    pub id: GenreId,
    pub names: I18nName,
    pub summary: String,
    #[serde(default)]
    pub tags: Vec<TagId>,
    #[serde(default)]
    pub default_preset: Option<PresetId>,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Feature {
    pub id: FeatureId,
    pub names: I18nName,
    pub summary: String,
    #[serde(default)]
    pub tags: Vec<TagId>,
    #[serde(default)]
    pub genres: Vec<GenreId>,
    #[serde(default)]
    pub depends_on: Vec<FeatureId>,
    #[serde(default)]
    pub conflicts_with: Vec<FeatureId>,
    #[serde(default)]
    pub parameters: Vec<FeatureParameter>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preset {
    pub id: PresetId,
    pub names: I18nName,
    pub genre: GenreId,
    pub summary: String,
    pub features: Vec<FeatureId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Term {
    pub id: TermId,
    pub names: I18nName,
    #[serde(default)]
    pub aliases: Vec<String>,
    pub definition: String,
    #[serde(default)]
    pub tags: Vec<TagId>,
    #[serde(default)]
    pub related_terms: Vec<TermId>,
}

/// ロード結果の root。 ID 引きを提供する。
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Lexicon {
    pub genres: Vec<Genre>,
    pub features: Vec<Feature>,
    pub presets: Vec<Preset>,
    pub terms: Vec<Term>,
}

impl Lexicon {
    pub fn get_genre(&self, id: &GenreId) -> Option<&Genre> {
        self.genres.iter().find(|g| &g.id == id)
    }
    pub fn get_feature(&self, id: &FeatureId) -> Option<&Feature> {
        self.features.iter().find(|f| &f.id == id)
    }
    pub fn get_preset(&self, id: &PresetId) -> Option<&Preset> {
        self.presets.iter().find(|p| &p.id == id)
    }
    pub fn get_term(&self, id: &TermId) -> Option<&Term> {
        self.terms.iter().find(|t| &t.id == id)
    }

    /// Preset を Feature 集合に展開 (depends_on を再帰的に解決)
    ///
    /// 戻り値は **依存ソート済み** (依存先が先に来る) の Feature 配列。
    /// 循環や未知 ID は `LexiconError` で返される。
    pub fn expand_preset(
        &self,
        preset_id: &PresetId,
    ) -> crate::Result<Vec<&Feature>> {
        let preset = self
            .get_preset(preset_id)
            .ok_or_else(|| crate::LexiconError::UnknownPreset(preset_id.clone()))?;

        let mut order: Vec<FeatureId> = Vec::new();
        let mut visiting: HashMap<FeatureId, bool> = HashMap::new();

        for fid in &preset.features {
            self.visit_feature(fid, &mut order, &mut visiting)?;
        }

        Ok(order
            .into_iter()
            .filter_map(|fid| self.get_feature(&fid))
            .collect())
    }

    fn visit_feature(
        &self,
        fid: &FeatureId,
        order: &mut Vec<FeatureId>,
        visiting: &mut HashMap<FeatureId, bool>,
    ) -> crate::Result<()> {
        if let Some(&done) = visiting.get(fid) {
            if !done {
                return Err(crate::LexiconError::CircularDependency(fid.clone()));
            }
            return Ok(());
        }
        visiting.insert(fid.clone(), false);
        let feat = self
            .get_feature(fid)
            .ok_or_else(|| crate::LexiconError::UnknownFeature(fid.clone()))?;
        for dep in &feat.depends_on {
            self.visit_feature(dep, order, visiting)?;
        }
        visiting.insert(fid.clone(), true);
        if !order.iter().any(|x| x == fid) {
            order.push(fid.clone());
        }
        Ok(())
    }
}
