use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 日本語ファイル名 → 英語内部名のマッピングルール
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamingRule {
    /// 日本語パターン（部分一致）
    pub japanese_pattern: String,
    /// 対応する英語名
    pub english_name: String,
}

/// ファイル名変換設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamingConfig {
    /// カスタムマッピングルール
    pub rules: Vec<NamingRule>,
    /// カテゴリ別プレフィックス (例: model -> "mdl_", texture -> "tex_")
    pub category_prefixes: HashMap<String, String>,
    /// 連番の桁数 (デフォルト: 3)
    pub sequence_digits: u32,
}

impl Default for NamingConfig {
    fn default() -> Self {
        let mut prefixes = HashMap::new();
        prefixes.insert("font".to_string(), "fnt_".to_string());
        prefixes.insert("model".to_string(), "mdl_".to_string());
        prefixes.insert("texture".to_string(), "tex_".to_string());
        prefixes.insert("motion".to_string(), "mot_".to_string());
        prefixes.insert("sound".to_string(), "snd_".to_string());

        Self {
            rules: Vec::new(),
            category_prefixes: prefixes,
            sequence_digits: 3,
        }
    }
}

/// ドロップされたファイル情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DroppedFile {
    /// ファイルの元パス
    pub path: String,
    /// 元のファイル名（日本語含む）
    pub original_name: String,
    /// 推定カテゴリ（拡張子ベース）
    pub suggested_category: Option<String>,
    /// 提案される英語名
    pub suggested_english_name: Option<String>,
    /// ファイルサイズ (bytes)
    pub size: u64,
}

/// ファイル登録リクエスト（D&D後にユーザーが確認・編集した結果）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileRegistrationRequest {
    /// ファイルの元パス
    pub source_path: String,
    /// 元の日本語ファイル名
    pub original_name: String,
    /// ユーザーが確定した英語名
    pub english_name: String,
    /// カテゴリ
    pub category: String,
    /// 役割
    pub role: String,
}
