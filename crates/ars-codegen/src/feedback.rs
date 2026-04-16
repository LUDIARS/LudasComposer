//! コード生成フィードバック
//!
//! `.ars-cache/codegen-manifest.json` (前回同期時のスナップショット) と
//! 現在のファイルシステム状態を突き合わせ、差分を検出する。
//!
//! 検出対象は以下 3 種別:
//!
//! - **project**    : `*.ars.json` 自体（コード「設計」）
//! - **codedesign** : `codedesign/**/*.md`（コード詳細設計）
//! - **code**       : `{output-root}/{Category}/{Entity}/**`（生成ソース）
//!
//! 差分は `FeedbackReport` に集約され、ドライランでの確認や、
//! 後段の "適用" 処理（codedesign → Project 反映、stale マーカー付与など）に渡される。
//!
//! 本モジュールは差分**検出**までを責務とし、適用ロジックは別エントリポイント
//! (`apply_codedesign_feedback` 等) から段階的に拡張する設計。

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use crate::code_layout::LayoutCategory;
use crate::crc32::crc32_hex;
use crate::manifest::{
    relative_path, system_time_to_rfc3339, CodegenManifest, FileKind, FileRecord, ManifestEntry,
};

/// 1 ファイルに発生した変更の種別
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChangeKind {
    /// manifest になく、新規に出現したファイル
    Added,
    /// manifest にあり、CRC32 が変化したファイル
    Modified,
    /// manifest にあるが、ファイルシステムから消えたファイル
    Removed,
}

/// 個別ファイルの変更レコード
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChange {
    pub change: ChangeKind,
    pub kind: FileKind,
    pub path: String,
    /// 紐づくレイアウトカテゴリ（manifest にエントリがある場合）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<LayoutCategory>,
    /// 紐づくエンティティ ID（manifest にエントリがある場合）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entity_id: Option<String>,
    /// 紐づくエンティティ名
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entity_name: Option<String>,
    /// 前回 CRC32（Added の場合 None）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previous_crc32: Option<String>,
    /// 現在 CRC32（Removed の場合 None）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_crc32: Option<String>,
}

/// プロジェクト全体に対する差分レポート
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FeedbackReport {
    /// プロジェクトファイル本体の CRC32 が manifest と異なるか
    pub project_changed: bool,
    /// manifest が存在しなかった（初回 feedback）
    pub manifest_missing: bool,
    /// 全変更（Added / Modified / Removed をまとめて時系列順に並べる）
    pub changes: Vec<FileChange>,
}

impl FeedbackReport {
    pub fn is_empty(&self) -> bool {
        !self.project_changed && self.changes.is_empty()
    }

    pub fn count(&self, change: ChangeKind) -> usize {
        self.changes.iter().filter(|c| c.change == change).count()
    }

    pub fn count_kind(&self, kind: FileKind) -> usize {
        self.changes.iter().filter(|c| c.kind == kind).count()
    }
}

/// `detect_changes` への入力
pub struct FeedbackInputs<'a> {
    /// プロジェクトファイル絶対パス（`*.ars.json`）
    pub project_file: &'a Path,
    /// 出力ルート（生成コード配置先）絶対パス
    pub output_root: &'a Path,
    /// codedesign ルート絶対パス。なければ走査をスキップ
    pub codedesign_root: Option<&'a Path>,
    /// manifest 絶対パス（通常 `{project_dir}/.ars-cache/codegen-manifest.json`）
    pub manifest_path: &'a Path,
}

/// 差分検出
///
/// manifest が存在しない場合は `manifest_missing = true` を返し、
/// すべての既存ファイルを `Added` 扱いで列挙する。
pub fn detect_changes(inputs: &FeedbackInputs<'_>) -> Result<FeedbackReport, String> {
    let project_dir = inputs
        .project_file
        .parent()
        .map(|p| p.to_path_buf())
        .ok_or_else(|| "project_file の親ディレクトリが取得できません".to_string())?;

    let manifest = CodegenManifest::load_from(inputs.manifest_path)?;
    let manifest_missing = manifest.is_none();
    let manifest = manifest.unwrap_or_else(|| CodegenManifest::new("(unknown)", "(unknown)"));

    let mut report = FeedbackReport {
        project_changed: false,
        manifest_missing,
        changes: Vec::new(),
    };

    // ── 1. プロジェクトファイル本体 ──
    if let Ok(bytes) = std::fs::read(inputs.project_file) {
        let current = crc32_hex(&bytes);
        if !manifest.project_crc32.is_empty() && manifest.project_crc32 != current {
            report.project_changed = true;
            report.changes.push(FileChange {
                change: ChangeKind::Modified,
                kind: FileKind::Project,
                path: relative_path(inputs.project_file, &project_dir),
                category: None,
                entity_id: None,
                entity_name: None,
                previous_crc32: Some(manifest.project_crc32.clone()),
                current_crc32: Some(current),
            });
        }
    }

    // ── 2. manifest に登録されたファイルを突き合わせ ──
    let mut visited: BTreeSet<PathBuf> = BTreeSet::new();
    for entry in &manifest.entries {
        for file in &entry.files {
            // project レコードは上で処理済みなのでスキップ
            if file.kind == FileKind::Project {
                continue;
            }
            let abs = project_dir.join(&file.path);
            visited.insert(abs.clone());

            match std::fs::read(&abs) {
                Ok(bytes) => {
                    let current = crc32_hex(&bytes);
                    if current != file.crc32 {
                        report.changes.push(FileChange {
                            change: ChangeKind::Modified,
                            kind: file.kind,
                            path: file.path.clone(),
                            category: Some(entry.category),
                            entity_id: Some(entry.entity_id.clone()),
                            entity_name: Some(entry.entity_name.clone()),
                            previous_crc32: Some(file.crc32.clone()),
                            current_crc32: Some(current),
                        });
                    }
                }
                Err(_) => {
                    // ファイル消失 → Removed
                    report.changes.push(FileChange {
                        change: ChangeKind::Removed,
                        kind: file.kind,
                        path: file.path.clone(),
                        category: Some(entry.category),
                        entity_id: Some(entry.entity_id.clone()),
                        entity_name: Some(entry.entity_name.clone()),
                        previous_crc32: Some(file.crc32.clone()),
                        current_crc32: None,
                    });
                }
            }
        }
    }

    // ── 3. 出力ルートを走査して新規ファイルを検出 ──
    if inputs.output_root.exists() {
        scan_added(inputs.output_root, &project_dir, &visited, FileKind::Code, &mut report);
    }
    if let Some(cd) = inputs.codedesign_root {
        if cd.exists() {
            scan_added(cd, &project_dir, &visited, FileKind::CodeDesign, &mut report);
        }
    }

    Ok(report)
}

/// 出力ディレクトリを再帰走査し、manifest に未登録のファイルを Added で記録する
fn scan_added(
    root: &Path,
    project_dir: &Path,
    visited: &BTreeSet<PathBuf>,
    kind: FileKind,
    report: &mut FeedbackReport,
) {
    visit_files(root, &mut |abs_path| {
        // 内部生成物はフィードバック対象外
        let name = abs_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        if name.starts_with(".codegen-")
            || name == "codegen-manifest.json"
            || abs_path
                .components()
                .any(|c| c.as_os_str() == ".ars-cache")
        {
            return;
        }
        if visited.contains(abs_path) {
            return;
        }
        if let Ok(bytes) = std::fs::read(abs_path) {
            let current = crc32_hex(&bytes);
            report.changes.push(FileChange {
                change: ChangeKind::Added,
                kind,
                path: relative_path(abs_path, project_dir),
                category: None,
                entity_id: None,
                entity_name: None,
                previous_crc32: None,
                current_crc32: Some(current),
            });
        }
    });
}

fn visit_files<F: FnMut(&Path)>(dir: &Path, visitor: &mut F) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            visit_files(&path, visitor);
        } else {
            visitor(&path);
        }
    }
}

// ── Manifest 更新ヘルパ ────────────────────────────────────────

/// `feedback --apply` 後に呼ばれ、現状ファイルから新しい manifest を構築する。
///
/// 既存 manifest の `entries` 構造（カテゴリ/エンティティ対応）を流用し、
/// 各ファイルの CRC32 / size / mtime を最新値で上書きする。Added だった
/// ファイルは未分類のまま `_unassigned` エントリにまとめる。
pub fn refresh_manifest(
    previous: &CodegenManifest,
    inputs: &FeedbackInputs<'_>,
) -> Result<CodegenManifest, String> {
    let project_dir = inputs
        .project_file
        .parent()
        .map(|p| p.to_path_buf())
        .ok_or_else(|| "project_file の親ディレクトリが取得できません".to_string())?;

    let mut next = previous.clone();

    // プロジェクトファイル CRC32 更新
    if let Ok(bytes) = std::fs::read(inputs.project_file) {
        next.project_crc32 = crc32_hex(&bytes);
        next.project_file = relative_path(inputs.project_file, &project_dir);
    }

    // 既存エントリの各ファイルを refresh
    let mut visited: BTreeSet<PathBuf> = BTreeSet::new();
    for entry in &mut next.entries {
        let mut updated_files = Vec::with_capacity(entry.files.len());
        for file in &entry.files {
            if file.kind == FileKind::Project {
                continue;
            }
            let abs = project_dir.join(&file.path);
            visited.insert(abs.clone());
            if let Ok(bytes) = std::fs::read(&abs) {
                let metadata = std::fs::metadata(&abs).ok();
                updated_files.push(FileRecord {
                    path: file.path.clone(),
                    crc32: crc32_hex(&bytes),
                    size: metadata.as_ref().map(|m| m.len()).unwrap_or(0),
                    modified_at: metadata
                        .and_then(|m| m.modified().ok())
                        .map(system_time_to_rfc3339)
                        .unwrap_or_default(),
                    kind: file.kind,
                });
            }
            // ファイル消失したものは entry から落とす
        }
        entry.files = updated_files;
    }

    // Added のファイルを `_unassigned` エントリにまとめる
    let mut added: Vec<FileRecord> = Vec::new();
    let walk_targets: Vec<(PathBuf, FileKind)> = std::iter::once((
        inputs.output_root.to_path_buf(),
        FileKind::Code,
    ))
    .chain(inputs.codedesign_root.map(|p| (p.to_path_buf(), FileKind::CodeDesign)))
    .collect();

    for (root, kind) in walk_targets {
        if !root.exists() {
            continue;
        }
        visit_files(&root, &mut |abs| {
            let name = abs
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            if name.starts_with(".codegen-")
                || name == "codegen-manifest.json"
                || abs
                    .components()
                    .any(|c| c.as_os_str() == ".ars-cache")
            {
                return;
            }
            if visited.contains(abs) {
                return;
            }
            if let Ok(bytes) = std::fs::read(abs) {
                let metadata = std::fs::metadata(abs).ok();
                added.push(FileRecord {
                    path: relative_path(abs, &project_dir),
                    crc32: crc32_hex(&bytes),
                    size: metadata.as_ref().map(|m| m.len()).unwrap_or(0),
                    modified_at: metadata
                        .and_then(|m| m.modified().ok())
                        .map(system_time_to_rfc3339)
                        .unwrap_or_default(),
                    kind,
                });
            }
        });
    }

    if !added.is_empty() {
        let mut grouped: BTreeMap<&'static str, Vec<FileRecord>> = BTreeMap::new();
        for rec in added {
            grouped.entry("_unassigned").or_default().push(rec);
        }
        for (_, files) in grouped {
            next.entries.push(ManifestEntry {
                category: LayoutCategory::Module,
                entity_id: "_unassigned".into(),
                entity_name: "_unassigned".into(),
                class_name: "_unassigned".into(),
                parent_id: None,
                files,
            });
        }
    }

    next.last_synced_at = crate::manifest::now_rfc3339();
    Ok(next)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manifest::{CodegenManifest, FileKind, FileRecord, ManifestEntry, MANIFEST_FILE, CACHE_DIR};
    use std::fs;
    use std::io::Write;

    /// 一時ディレクトリ＋プロジェクトファイル＋manifest を組み立てるテストハーネス
    struct Harness {
        dir: PathBuf,
    }

    impl Harness {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir().join(format!(
                "ars-codegen-feedback-{}-{}",
                name,
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_nanos())
                    .unwrap_or(0)
            ));
            let _ = fs::remove_dir_all(&dir);
            fs::create_dir_all(&dir).unwrap();
            Self { dir }
        }

        fn write(&self, rel: &str, content: &[u8]) -> PathBuf {
            let p = self.dir.join(rel);
            if let Some(parent) = p.parent() {
                fs::create_dir_all(parent).unwrap();
            }
            let mut f = fs::File::create(&p).unwrap();
            f.write_all(content).unwrap();
            p
        }

        fn project_file(&self) -> PathBuf {
            self.dir.join("demo.ars.json")
        }

        fn manifest_path(&self) -> PathBuf {
            self.dir.join(CACHE_DIR).join(MANIFEST_FILE)
        }

        fn output_root(&self) -> PathBuf {
            self.dir.join("generated")
        }

        fn codedesign_root(&self) -> PathBuf {
            self.dir.join("codedesign")
        }
    }

    impl Drop for Harness {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.dir);
        }
    }

    fn fake_manifest(harness: &Harness) -> CodegenManifest {
        let mut m = CodegenManifest::new("Demo", "ars-native");
        m.project_file = "demo.ars.json".into();
        m.output_root = "generated".into();
        m.codedesign_root = Some("codedesign".into());
        // プロジェクトファイル CRC を後から記録
        let bytes = std::fs::read(harness.project_file()).unwrap();
        m.project_crc32 = crc32_hex(&bytes);
        m
    }

    #[test]
    fn manifest_missing_returns_flag() {
        let h = Harness::new("missing");
        h.write("demo.ars.json", b"{}");
        let inputs = FeedbackInputs {
            project_file: &h.project_file(),
            output_root: &h.output_root(),
            codedesign_root: Some(&h.codedesign_root()),
            manifest_path: &h.manifest_path(),
        };
        let report = detect_changes(&inputs).unwrap();
        assert!(report.manifest_missing);
        assert!(!report.project_changed);
    }

    #[test]
    fn project_change_detected() {
        let h = Harness::new("project");
        h.write("demo.ars.json", b"{\"name\":\"Demo\"}");
        let m = fake_manifest(&h);
        // manifest 保存後にプロジェクトを書き換える
        m.save_to(&h.manifest_path()).unwrap();
        h.write("demo.ars.json", b"{\"name\":\"Demo!\"}");

        let inputs = FeedbackInputs {
            project_file: &h.project_file(),
            output_root: &h.output_root(),
            codedesign_root: Some(&h.codedesign_root()),
            manifest_path: &h.manifest_path(),
        };
        let report = detect_changes(&inputs).unwrap();
        assert!(report.project_changed);
        assert_eq!(report.count(ChangeKind::Modified), 1);
        assert_eq!(report.count_kind(FileKind::Project), 1);
    }

    #[test]
    fn modified_and_removed_and_added_are_detected() {
        let h = Harness::new("modified");
        h.write("demo.ars.json", b"{}");
        // manifest に登録される 2 ファイルを用意
        let modif = h.write(
            "generated/Scene/MainScene/MainScene.ts",
            b"class MainScene {}",
        );
        let removed_path = h.write("generated/Module/Health/Health.ts", b"class Health {}");

        let mut m = fake_manifest(&h);
        m.entries.push(ManifestEntry {
            category: LayoutCategory::Scene,
            entity_id: "scene-1".into(),
            entity_name: "Main".into(),
            class_name: "MainScene".into(),
            parent_id: None,
            files: vec![FileRecord {
                path: "generated/Scene/MainScene/MainScene.ts".into(),
                crc32: crc32_hex(&fs::read(&modif).unwrap()),
                size: 0,
                modified_at: "2026-01-01T00:00:00Z".into(),
                kind: FileKind::Code,
            }],
        });
        m.entries.push(ManifestEntry {
            category: LayoutCategory::Module,
            entity_id: "comp-1".into(),
            entity_name: "Health".into(),
            class_name: "Health".into(),
            parent_id: None,
            files: vec![FileRecord {
                path: "generated/Module/Health/Health.ts".into(),
                crc32: crc32_hex(&fs::read(&removed_path).unwrap()),
                size: 0,
                modified_at: "2026-01-01T00:00:00Z".into(),
                kind: FileKind::Code,
            }],
        });
        m.save_to(&h.manifest_path()).unwrap();

        // 1) Modify
        h.write(
            "generated/Scene/MainScene/MainScene.ts",
            b"class MainScene { update() {} }",
        );
        // 2) Remove
        fs::remove_file(&removed_path).unwrap();
        // 3) Add (manifest 未登録)
        h.write(
            "generated/Action/Attack/Attack.ts",
            b"class Attack {}",
        );

        let inputs = FeedbackInputs {
            project_file: &h.project_file(),
            output_root: &h.output_root(),
            codedesign_root: Some(&h.codedesign_root()),
            manifest_path: &h.manifest_path(),
        };
        let report = detect_changes(&inputs).unwrap();
        assert!(!report.project_changed);
        assert_eq!(report.count(ChangeKind::Modified), 1);
        assert_eq!(report.count(ChangeKind::Removed), 1);
        assert_eq!(report.count(ChangeKind::Added), 1);

        let added = report
            .changes
            .iter()
            .find(|c| c.change == ChangeKind::Added)
            .unwrap();
        assert!(added.path.contains("Attack"));
        assert_eq!(added.kind, FileKind::Code);

        let removed = report
            .changes
            .iter()
            .find(|c| c.change == ChangeKind::Removed)
            .unwrap();
        assert_eq!(removed.entity_name.as_deref(), Some("Health"));
    }

    #[test]
    fn cache_dir_files_are_ignored_in_added_scan() {
        let h = Harness::new("ignore-cache");
        h.write("demo.ars.json", b"{}");
        let m = fake_manifest(&h);
        m.save_to(&h.manifest_path()).unwrap();
        // .ars-cache 配下や .codegen-* マーカー類は走査対象外
        h.write(".ars-cache/extra.json", b"{}");
        h.write("generated/Scene/MainScene/.codegen-prompt.md", b"prompt");
        h.write("generated/Scene/MainScene/MainScene.ts", b"class MainScene {}");

        let inputs = FeedbackInputs {
            project_file: &h.project_file(),
            output_root: &h.output_root(),
            codedesign_root: Some(&h.codedesign_root()),
            manifest_path: &h.manifest_path(),
        };
        let report = detect_changes(&inputs).unwrap();
        // MainScene.ts のみ Added で検出される
        let added: Vec<_> = report
            .changes
            .iter()
            .filter(|c| c.change == ChangeKind::Added)
            .collect();
        assert_eq!(added.len(), 1);
        assert!(added[0].path.ends_with("MainScene.ts"));
    }

    #[test]
    fn refresh_manifest_updates_crc_and_drops_removed() {
        let h = Harness::new("refresh");
        h.write("demo.ars.json", b"{}");
        let modif = h.write("generated/Module/Health/Health.ts", b"v1");

        let mut m = fake_manifest(&h);
        m.entries.push(ManifestEntry {
            category: LayoutCategory::Module,
            entity_id: "comp-1".into(),
            entity_name: "Health".into(),
            class_name: "Health".into(),
            parent_id: None,
            files: vec![FileRecord {
                path: "generated/Module/Health/Health.ts".into(),
                crc32: crc32_hex(&fs::read(&modif).unwrap()),
                size: 2,
                modified_at: "2026-01-01T00:00:00Z".into(),
                kind: FileKind::Code,
            }],
        });
        m.save_to(&h.manifest_path()).unwrap();

        // 修正 + 新規追加
        h.write("generated/Module/Health/Health.ts", b"v2-updated");
        h.write("generated/Action/Attack/Attack.ts", b"class Attack {}");

        let inputs = FeedbackInputs {
            project_file: &h.project_file(),
            output_root: &h.output_root(),
            codedesign_root: Some(&h.codedesign_root()),
            manifest_path: &h.manifest_path(),
        };
        let next = refresh_manifest(&m, &inputs).unwrap();

        // Health のCRCが新しくなっている
        let health_entry = next
            .entries
            .iter()
            .find(|e| e.entity_name == "Health")
            .unwrap();
        assert_eq!(health_entry.files[0].crc32, crc32_hex(b"v2-updated"));

        // _unassigned に Attack が追加されている
        let unassigned = next
            .entries
            .iter()
            .find(|e| e.entity_id == "_unassigned")
            .expect("Added ファイルが _unassigned に集約される");
        assert!(unassigned.files.iter().any(|f| f.path.ends_with("Attack.ts")));
    }
}
