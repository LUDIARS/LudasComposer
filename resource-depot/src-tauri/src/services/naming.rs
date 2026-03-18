use crate::models::naming::*;
use crate::models::resource::ResourceCategory;
use regex::Regex;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum NamingError {
    #[error("ファイルが見つかりません: {0}")]
    FileNotFound(String),
    #[error("I/Oエラー: {0}")]
    IoError(#[from] std::io::Error),
    #[error("JSONエラー: {0}")]
    JsonError(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, NamingError>;

/// ファイル名変換サービス
pub struct NamingService {
    config: NamingConfig,
    config_path: PathBuf,
}

impl NamingService {
    pub fn new(config_dir: PathBuf) -> Result<Self> {
        fs::create_dir_all(&config_dir)?;
        let config_path = config_dir.join("naming-config.json");

        let config = if config_path.exists() {
            let content = fs::read_to_string(&config_path)?;
            serde_json::from_str(&content)?
        } else {
            NamingConfig::default()
        };

        Ok(Self {
            config,
            config_path,
        })
    }

    fn save(&self) -> Result<()> {
        let json = serde_json::to_string_pretty(&self.config)?;
        fs::write(&self.config_path, json)?;
        Ok(())
    }

    /// 拡張子からカテゴリを推定
    pub fn detect_category(filename: &str) -> Option<ResourceCategory> {
        let ext = Path::new(filename)
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())?;

        match ext.as_str() {
            // フォント
            "ttf" | "otf" | "woff" | "woff2" => Some(ResourceCategory::Font),
            // モデル
            "fbx" | "glb" | "gltf" | "vrm" | "pmx" | "pmd" | "obj" | "mb" | "ma" => {
                Some(ResourceCategory::Model)
            }
            // テクスチャ
            "png" | "jpg" | "jpeg" | "webp" | "tga" | "bmp" | "psd" | "tiff" | "dds" => {
                Some(ResourceCategory::Texture)
            }
            // モーション
            "bvh" | "vmd" | "anim" => Some(ResourceCategory::Motion),
            // サウンド
            "wav" | "ogg" | "mp3" | "flac" | "aac" => Some(ResourceCategory::Sound),
            _ => None,
        }
    }

    /// 日本語ファイル名から英語名を生成
    pub fn generate_english_name(
        &self,
        original_name: &str,
        category: &ResourceCategory,
    ) -> String {
        let stem = Path::new(original_name)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(original_name);

        let ext = Path::new(original_name)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        // カスタムルールを先にチェック
        for rule in &self.config.rules {
            if stem.contains(&rule.japanese_pattern) {
                let name = if ext.is_empty() {
                    rule.english_name.clone()
                } else {
                    format!("{}.{}", rule.english_name, ext)
                };
                return name;
            }
        }

        // カテゴリプレフィックスを取得
        let category_key = format!("{:?}", category).to_lowercase();
        let prefix = self
            .config
            .category_prefixes
            .get(&category_key)
            .map(|s| s.as_str())
            .unwrap_or("");

        // 日本語文字をローマ字/ASCII化（簡易版: 非ASCII文字を除去）
        let ascii_stem = Self::to_ascii_name(stem);

        if ext.is_empty() {
            format!("{}{}", prefix, ascii_stem)
        } else {
            format!("{}{}.{}", prefix, ascii_stem, ext)
        }
    }

    /// 日本語文字列をASCII安全な名前に変換（簡易版）
    fn to_ascii_name(input: &str) -> String {
        let re = Regex::new(r"[^\x20-\x7E]").unwrap();
        let ascii = re.replace_all(input, "");
        let cleaned = ascii
            .trim()
            .to_lowercase()
            .replace(' ', "_")
            .replace('-', "_");

        if cleaned.is_empty() {
            format!("resource_{:08x}", fxhash(input))
        } else {
            cleaned
        }
    }

    /// D&Dで受け取ったファイルパスのリストを解析
    pub fn analyze_dropped_files(&self, paths: &[String]) -> Vec<DroppedFile> {
        paths
            .iter()
            .filter_map(|path_str| {
                let path = Path::new(path_str);
                if !path.exists() {
                    return None;
                }

                let original_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                let size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
                let suggested_category = Self::detect_category(&original_name)
                    .map(|c| format!("{:?}", c).to_lowercase());

                let suggested_english_name = suggested_category.as_ref().and_then(|cat_str| {
                    let category = match cat_str.as_str() {
                        "font" => Some(ResourceCategory::Font),
                        "model" => Some(ResourceCategory::Model),
                        "texture" => Some(ResourceCategory::Texture),
                        "motion" => Some(ResourceCategory::Motion),
                        "sound" => Some(ResourceCategory::Sound),
                        _ => None,
                    };
                    category.map(|c| self.generate_english_name(&original_name, &c))
                });

                Some(DroppedFile {
                    path: path_str.clone(),
                    original_name,
                    suggested_category,
                    suggested_english_name,
                    size,
                })
            })
            .collect()
    }

    /// カスタムルールを追加
    pub fn add_rule(&mut self, japanese_pattern: String, english_name: String) -> Result<()> {
        self.config.rules.push(NamingRule {
            japanese_pattern,
            english_name,
        });
        self.save()?;
        Ok(())
    }

    /// カスタムルールを削除
    pub fn remove_rule(&mut self, index: usize) -> Result<()> {
        if index < self.config.rules.len() {
            self.config.rules.remove(index);
            self.save()?;
        }
        Ok(())
    }

    /// 全ルールを取得
    pub fn get_rules(&self) -> &[NamingRule] {
        &self.config.rules
    }

    /// 設定を取得
    pub fn get_config(&self) -> &NamingConfig {
        &self.config
    }

    /// カテゴリプレフィックスを更新
    pub fn set_category_prefix(&mut self, category: String, prefix: String) -> Result<()> {
        self.config.category_prefixes.insert(category, prefix);
        self.save()?;
        Ok(())
    }
}

/// 簡易ハッシュ（ファイル名生成用）
fn fxhash(s: &str) -> u32 {
    let mut hash: u32 = 0;
    for byte in s.bytes() {
        hash = hash.wrapping_mul(16777619).wrapping_add(byte as u32);
    }
    hash
}
