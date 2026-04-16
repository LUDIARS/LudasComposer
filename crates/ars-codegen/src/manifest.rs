//! コード生成 Manifest
//!
//! `.ars-cache/codegen-manifest.json` に永続化される、生成済みファイルの追跡情報。
//!
//! - **目的**: 直近の生成時点における CRC32 とタイムスタンプを記録し、
//!   後段の `feedback` 処理で差分検出（追加 / 変更 / 削除）の基準とする。
//! - **追跡対象**:
//!   - 生成されたソースコード（`Scene/...`, `Actor/...`, ...）
//!   - 生成されたコード詳細設計（`codedesign/...`）
//!   - プロジェクトファイル自体（`*.ars.json`）
//!
//! Manifest は「直前同期の状態」を表すスナップショットであり、
//! コード／設計を編集した後に `feedback` を実行するとここからの差分が検出される。

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::code_layout::LayoutCategory;
use crate::crc32::crc32_hex;

/// Manifest 形式のバージョン番号。フォーマット変更時にインクリメントする。
pub const MANIFEST_VERSION: u32 = 1;

/// `.ars-cache` ディレクトリ名（プロジェクトファイル直下に作成）
pub const CACHE_DIR: &str = ".ars-cache";

/// Manifest ファイル名
pub const MANIFEST_FILE: &str = "codegen-manifest.json";

/// 追跡対象ファイルの種別
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileKind {
    /// 生成されたソースコード
    Code,
    /// コード詳細設計（codedesign の MD ファイル）
    CodeDesign,
    /// プロジェクトファイル本体（コード「設計」）
    Project,
}

/// Manifest に記録される 1 ファイル分のエントリ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileRecord {
    /// プロジェクトルート（manifest が置かれているディレクトリの親）からの相対パス
    pub path: String,
    /// CRC32 (16進) — 生成時点でのファイル内容
    pub crc32: String,
    /// バイトサイズ
    pub size: u64,
    /// 最終更新時刻 (RFC3339)。OS の mtime を採用。
    pub modified_at: String,
    /// ファイル種別
    pub kind: FileKind,
}

/// エンティティ単位の追跡記録
///
/// 1 つのエンティティ（シーン / アクター / モジュール / アクション / UI / データ）に
/// 紐づく生成ファイル群を 1 エントリとしてまとめる。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestEntry {
    /// レイアウトカテゴリ
    pub category: LayoutCategory,
    /// 元エンティティの ID（プロジェクト内で一意）
    pub entity_id: String,
    /// 元エンティティの名前（生成時のクラス名導出に使用）
    pub entity_name: String,
    /// 生成時の出力クラス名（サフィックス付与済み）
    pub class_name: String,
    /// 親エンティティのID（Actor は所属シーン、Action は所属シーンなど）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    /// 紐づくファイル群（コード・コード詳細設計・プロジェクトファイル）
    pub files: Vec<FileRecord>,
}

/// Manifest 全体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodegenManifest {
    pub version: u32,
    /// プロジェクト名（生成時点）
    pub project_name: String,
    /// プロジェクトファイル相対パス（manifest ディレクトリ起点）
    pub project_file: String,
    /// 出力ルート（manifest ディレクトリ起点の相対パスに正規化）
    pub output_root: String,
    /// codedesign ルート（あれば。manifest ディレクトリ起点の相対パス）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub codedesign_root: Option<String>,
    /// 対象プラットフォーム文字列
    pub platform: String,
    /// 生成または同期時刻 (RFC3339)
    pub last_synced_at: String,
    /// プロジェクトファイル全体の CRC32（差分検出のショートカット用）
    pub project_crc32: String,
    /// エンティティ別の追跡記録
    pub entries: Vec<ManifestEntry>,
}

impl CodegenManifest {
    /// 空 manifest を新規作成する
    pub fn new(project_name: impl Into<String>, platform: impl Into<String>) -> Self {
        Self {
            version: MANIFEST_VERSION,
            project_name: project_name.into(),
            project_file: String::new(),
            output_root: String::new(),
            codedesign_root: None,
            platform: platform.into(),
            last_synced_at: now_rfc3339(),
            project_crc32: String::new(),
            entries: Vec::new(),
        }
    }

    /// プロジェクトディレクトリ直下の `.ars-cache/codegen-manifest.json` パスを返す
    pub fn default_path(project_dir: &Path) -> PathBuf {
        project_dir.join(CACHE_DIR).join(MANIFEST_FILE)
    }

    /// JSON ファイルから読み込む。ファイルが存在しなければ `Ok(None)`。
    pub fn load_from(path: &Path) -> Result<Option<Self>, String> {
        if !path.exists() {
            return Ok(None);
        }
        let text = std::fs::read_to_string(path)
            .map_err(|e| format!("manifestの読み込みに失敗: {}: {e}", path.display()))?;
        let manifest: Self = serde_json::from_str(&text)
            .map_err(|e| format!("manifestのパースに失敗: {}: {e}", path.display()))?;
        Ok(Some(manifest))
    }

    /// JSON ファイルに保存する（親ディレクトリを必要なら作成する）
    pub fn save_to(&self, path: &Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("manifestディレクトリ作成に失敗: {}: {e}", parent.display()))?;
        }
        let text = serde_json::to_string_pretty(self)
            .map_err(|e| format!("manifestのシリアライズに失敗: {e}"))?;
        std::fs::write(path, text)
            .map_err(|e| format!("manifestの書き込みに失敗: {}: {e}", path.display()))?;
        Ok(())
    }

    /// エンティティID → エントリ参照のマップを返す（差分計算用）
    pub fn entries_by_id(&self) -> BTreeMap<String, &ManifestEntry> {
        self.entries
            .iter()
            .map(|e| (e.entity_id.clone(), e))
            .collect()
    }
}

/// パスからファイルレコードを構築する。ファイルが存在しなければ `None`。
///
/// `base_dir` は manifest が記録するパスの基準（通常はプロジェクトディレクトリ）。
/// `abs_path` は実ファイルへの絶対パス。
pub fn record_for(abs_path: &Path, base_dir: &Path, kind: FileKind) -> Option<FileRecord> {
    let bytes = std::fs::read(abs_path).ok()?;
    let metadata = std::fs::metadata(abs_path).ok()?;
    let size = metadata.len();
    let modified_at = system_time_to_rfc3339(metadata.modified().ok()?);
    let rel = relative_path(abs_path, base_dir);
    Some(FileRecord {
        path: rel,
        crc32: crc32_hex(&bytes),
        size,
        modified_at,
        kind,
    })
}

/// 絶対パスを `base_dir` 起点の相対パス文字列に正規化する（前方スラッシュ統一）
pub fn relative_path(abs: &Path, base: &Path) -> String {
    let stripped = abs
        .strip_prefix(base)
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|_| abs.to_path_buf());
    stripped
        .to_string_lossy()
        .replace('\\', "/")
}

/// 現在時刻を RFC3339 (UTC) で返す
///
/// `chrono` を依存に追加せず、`std::time::SystemTime` から手書きで RFC3339 を組み立てる。
pub fn now_rfc3339() -> String {
    system_time_to_rfc3339(std::time::SystemTime::now())
}

/// `SystemTime` を RFC3339 (UTC) に変換する
pub fn system_time_to_rfc3339(t: std::time::SystemTime) -> String {
    let secs = t
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    format_unix_secs_rfc3339(secs)
}

/// UNIX 秒を RFC3339 (UTC, "Z" 表記) に整形する
fn format_unix_secs_rfc3339(unix_secs: i64) -> String {
    // UNIX エポックからの日数と時分秒を計算
    let days = unix_secs.div_euclid(86_400);
    let secs_of_day = unix_secs.rem_euclid(86_400);
    let hour = secs_of_day / 3600;
    let minute = (secs_of_day % 3600) / 60;
    let second = secs_of_day % 60;

    let (year, month, day) = days_from_epoch_to_ymd(days);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, minute, second
    )
}

/// UNIX エポック (1970-01-01) からの日数を (年, 月, 日) に変換する。
///
/// グレゴリオ暦の閏年規則に則った変換。タイムゾーンは UTC 固定。
fn days_from_epoch_to_ymd(days_since_epoch: i64) -> (i32, u32, u32) {
    // Ref: Howard Hinnant のアルゴリズム http://howardhinnant.github.io/date_algorithms.html
    let z = days_since_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = (yoe as i64) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rfc3339_format_known_epoch() {
        assert_eq!(format_unix_secs_rfc3339(0), "1970-01-01T00:00:00Z");
        assert_eq!(format_unix_secs_rfc3339(1_700_000_000), "2023-11-14T22:13:20Z");
    }

    #[test]
    fn rfc3339_handles_leap_year() {
        // 2024-02-29 is a leap day
        let secs = 1_709_164_800; // 2024-02-29T00:00:00Z
        assert_eq!(format_unix_secs_rfc3339(secs), "2024-02-29T00:00:00Z");
    }

    #[test]
    fn manifest_roundtrip() {
        let mut m = CodegenManifest::new("Demo", "ars-native");
        m.entries.push(ManifestEntry {
            category: LayoutCategory::Scene,
            entity_id: "scene-1".into(),
            entity_name: "Main".into(),
            class_name: "MainScene".into(),
            parent_id: None,
            files: vec![FileRecord {
                path: "Scene/MainScene/MainScene.ts".into(),
                crc32: "deadbeef".into(),
                size: 42,
                modified_at: now_rfc3339(),
                kind: FileKind::Code,
            }],
        });
        let json = serde_json::to_string(&m).unwrap();
        let loaded: CodegenManifest = serde_json::from_str(&json).unwrap();
        assert_eq!(loaded.entries.len(), 1);
        assert_eq!(loaded.entries[0].class_name, "MainScene");
        assert_eq!(loaded.entries[0].files[0].crc32, "deadbeef");
    }

    #[test]
    fn relative_path_normalizes_slashes() {
        let base = Path::new("/proj");
        let abs = Path::new("/proj/sub/file.txt");
        assert_eq!(relative_path(abs, base), "sub/file.txt");
    }
}
