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
use crate::codedesign_parser::{parse as parse_codedesign, ParsedCodedesign};
use crate::crc32::crc32_hex;
use crate::manifest::{
    relative_path, system_time_to_rfc3339, CodegenManifest, FileKind, FileRecord, ManifestEntry,
};
use ars_core::models::Project;

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

// ── 適用 (Apply) ────────────────────────────────────────────────
//
// `detect_changes` で得た差分を **書き込み側** へ反映するエントリポイント。
// 適用内容は次の 2 種類:
//
// 1. codedesign → Project (`*.ars.json`)
//    - 編集された MD ファイルを `codedesign_parser` でパースし、
//      対応する Actor/Action/Component に「概要 / 達成目標 / 役割 / 挙動」等を上書きする。
// 2. code → codedesign (stale マーカー)
//    - 生成後にコードが書き換わったエンティティの MD 末尾に
//      `<!-- code-feedback: stale ... -->` を追記し、設計が遅れていることを通知する。
//
// 適用は **冪等** を志向する: 同一差分を二度適用しても結果が変わらないようにする。
// プロジェクトファイルの上書きはしないため、呼び出し側で `Project::save` を行う。

/// `apply_feedback` の挙動オプション
#[derive(Debug, Clone)]
pub struct FeedbackApplyOptions {
    /// codedesign の編集を Project に反映する
    pub apply_codedesign_to_project: bool,
    /// code 変更時に対応する codedesign に stale マーカーを追記する
    pub mark_code_stale: bool,
    /// バックアップを作成する（`.ars-cache/feedback-backup-*.json`）
    pub backup_project: bool,
}

impl Default for FeedbackApplyOptions {
    fn default() -> Self {
        Self {
            apply_codedesign_to_project: true,
            mark_code_stale: true,
            backup_project: true,
        }
    }
}

/// 1 件の適用結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppliedChange {
    pub path: String,
    pub kind: FileKind,
    pub entity_id: Option<String>,
    pub entity_name: Option<String>,
    /// 適用内容のサマリ（"requirements.overview を 3 件更新" 等）
    pub summary: String,
}

/// `apply_feedback` の戻り値
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ApplyResult {
    /// codedesign → Project に反映された変更
    pub applied: Vec<AppliedChange>,
    /// stale マーカーを追記した codedesign ファイル
    pub stale_marked: Vec<String>,
    /// 対応エンティティ不明等で人手レビューが必要な変更
    pub requires_review: Vec<AppliedChange>,
    /// バックアップ先パス（作成した場合）
    pub backup_path: Option<String>,
}

/// stale マーカー本文。複数回適用しても重複追記しないように検出キーに使う。
const STALE_MARKER_PREFIX: &str = "<!-- code-feedback: stale";

/// `detect_changes` の結果と現状ファイルから、Project と codedesign に変更を適用する。
///
/// 戻り値の `Project` は変異後のもの（呼び出し側で save する想定）。
///
/// `mark_code_stale = true` のときは、変更された code エントリに対応する
/// codedesign MD の末尾に stale コメントを追記する（既に同等のマーカーがあれば追記しない）。
pub fn apply_feedback(
    project: &mut Project,
    report: &FeedbackReport,
    inputs: &FeedbackInputs<'_>,
    opts: &FeedbackApplyOptions,
) -> Result<ApplyResult, String> {
    let project_dir = inputs
        .project_file
        .parent()
        .map(|p| p.to_path_buf())
        .ok_or_else(|| "project_file の親ディレクトリが取得できません".to_string())?;

    let mut result = ApplyResult::default();

    // ── 0. プロジェクトファイルのバックアップ ────
    if opts.backup_project && inputs.project_file.exists() {
        if let Some(backup) = backup_project_file(inputs.project_file, &project_dir)? {
            result.backup_path = Some(relative_path(&backup, &project_dir));
        }
    }

    // ── 1. codedesign → Project ────
    if opts.apply_codedesign_to_project {
        for change in &report.changes {
            if change.kind != FileKind::CodeDesign {
                continue;
            }
            if matches!(change.change, ChangeKind::Removed) {
                // 削除に対しては自動反映しない（Project の意図的な変更可能性）
                result.requires_review.push(AppliedChange {
                    path: change.path.clone(),
                    kind: change.kind,
                    entity_id: change.entity_id.clone(),
                    entity_name: change.entity_name.clone(),
                    summary: "codedesign 削除（手動レビュー要）".into(),
                });
                continue;
            }
            let abs = project_dir.join(&change.path);
            let text = match std::fs::read_to_string(&abs) {
                Ok(t) => t,
                Err(e) => {
                    result.requires_review.push(AppliedChange {
                        path: change.path.clone(),
                        kind: change.kind,
                        entity_id: change.entity_id.clone(),
                        entity_name: change.entity_name.clone(),
                        summary: format!("読み込み失敗: {e}"),
                    });
                    continue;
                }
            };
            let parsed = parse_codedesign(&text);
            match apply_parsed_codedesign(project, &parsed, change.entity_id.as_deref()) {
                Ok(summary) => result.applied.push(AppliedChange {
                    path: change.path.clone(),
                    kind: change.kind,
                    entity_id: change.entity_id.clone().or_else(|| parsed.entity_id.clone()),
                    entity_name: change
                        .entity_name
                        .clone()
                        .or_else(|| parsed.title.clone()),
                    summary,
                }),
                Err(reason) => result.requires_review.push(AppliedChange {
                    path: change.path.clone(),
                    kind: change.kind,
                    entity_id: change.entity_id.clone().or_else(|| parsed.entity_id.clone()),
                    entity_name: change
                        .entity_name
                        .clone()
                        .or_else(|| parsed.title.clone()),
                    summary: reason,
                }),
            }
        }
    }

    // ── 2. code → codedesign (stale マーカー) ────
    if opts.mark_code_stale {
        if let Some(cd_root) = inputs.codedesign_root {
            // entity_id → codedesign パス候補のマップ
            let cd_index = build_codedesign_index(cd_root);
            for change in &report.changes {
                if change.kind != FileKind::Code {
                    continue;
                }
                if !matches!(change.change, ChangeKind::Modified | ChangeKind::Added) {
                    continue;
                }
                let Some(entity_id) = change.entity_id.as_deref() else {
                    // entity_id 不明（_unassigned 等）のものはスキップ
                    continue;
                };
                let Some(cd_paths) = cd_index.get(entity_id) else {
                    continue;
                };
                for path in cd_paths {
                    if append_stale_marker(path, &change.path)? {
                        result
                            .stale_marked
                            .push(relative_path(path, &project_dir));
                    }
                }
            }
        }
    }

    Ok(result)
}

/// パース済み codedesign を Project 内の対応エンティティへ適用する
///
/// `hint_entity_id` は manifest 由来のヒント（あればそちらを優先）
fn apply_parsed_codedesign(
    project: &mut Project,
    parsed: &ParsedCodedesign,
    hint_entity_id: Option<&str>,
) -> Result<String, String> {
    let entity_id = hint_entity_id
        .map(|s| s.to_string())
        .or_else(|| parsed.entity_id.clone())
        .ok_or_else(|| "対応する entity_id が特定できません".to_string())?;

    // Actor 探索
    for scene in project.scenes.values_mut() {
        if let Some(actor) = scene.actors.get_mut(&entity_id) {
            return Ok(apply_to_actor(actor, parsed));
        }
        // Action 探索
        if let Some(action) = scene.actions.get_mut(&entity_id) {
            return Ok(apply_to_action(action, parsed));
        }
    }
    // Component 探索
    if let Some(comp) = project.components.get_mut(&entity_id) {
        return Ok(apply_to_component(comp, parsed));
    }

    Err(format!("entity_id={entity_id} に対応するエンティティが見つかりません"))
}

fn apply_to_actor(actor: &mut ars_core::models::Actor, parsed: &ParsedCodedesign) -> String {
    let mut updates: Vec<String> = Vec::new();

    if let Some(role) = parsed.role.as_deref() {
        if !role.is_empty() && actor.role != role {
            actor.role = role.to_string();
            updates.push("role".into());
        }
    }
    if let Some(t) = parsed.actor_type.as_deref() {
        if !t.is_empty() && actor.actor_type != t {
            actor.actor_type = t.to_string();
            updates.push("actor_type".into());
        }
    }

    if let Some(items) = parsed.overview() {
        if !items.is_empty() && actor.requirements.overview != items {
            actor.requirements.overview = items.to_vec();
            updates.push(format!("requirements.overview ({}件)", items.len()));
        }
    }
    if let Some(items) = parsed.goals() {
        if !items.is_empty() && actor.requirements.goals != items {
            actor.requirements.goals = items.to_vec();
            updates.push(format!("requirements.goals ({}件)", items.len()));
        }
    }
    if let Some(items) = parsed.role_items() {
        if !items.is_empty() && actor.requirements.role != items {
            actor.requirements.role = items.to_vec();
            updates.push(format!("requirements.role ({}件)", items.len()));
        }
    }
    if let Some(items) = parsed.behavior() {
        if !items.is_empty() && actor.requirements.behavior != items {
            actor.requirements.behavior = items.to_vec();
            updates.push(format!("requirements.behavior ({}件)", items.len()));
        }
    }

    if updates.is_empty() {
        "actor: 変更なし".into()
    } else {
        format!("actor[{}]: {}", actor.id, updates.join(", "))
    }
}

fn apply_to_action(action: &mut ars_core::models::Action, parsed: &ParsedCodedesign) -> String {
    let mut updates: Vec<String> = Vec::new();
    if let Some(items) = parsed.behaviors() {
        if !items.is_empty() && action.behaviors != items {
            action.behaviors = items.to_vec();
            updates.push(format!("behaviors ({}件)", items.len()));
        }
    }
    // 概要があれば description に転写（複数行は改行で結合）
    if let Some(items) = parsed.overview() {
        if !items.is_empty() {
            let joined = items.join("\n");
            if action.description != joined {
                action.description = joined;
                updates.push("description".into());
            }
        }
    }
    if updates.is_empty() {
        "action: 変更なし".into()
    } else {
        format!("action[{}]: {}", action.id, updates.join(", "))
    }
}

fn apply_to_component(
    component: &mut ars_core::models::Component,
    parsed: &ParsedCodedesign,
) -> String {
    // Component には自由テキスト系フィールドが少ないため、現状は domain/role 相当の
    // ドメインロール指定だけを反映する。タスク本体の編集はしない。
    let mut updates: Vec<String> = Vec::new();
    if let Some(role) = parsed.role.as_deref() {
        if !role.is_empty() && component.domain != role {
            component.domain = role.to_string();
            updates.push("domain".into());
        }
    }
    if updates.is_empty() {
        "component: 変更なし".into()
    } else {
        format!("component[{}]: {}", component.id, updates.join(", "))
    }
}

/// codedesign ルート配下を走査し、`entity_id` → 該当 MD パスのマップを構築する。
///
/// MD の `## メタ情報` セクションから `- **ID**: ...` 行を読み取って index 化する。
fn build_codedesign_index(root: &Path) -> BTreeMap<String, Vec<PathBuf>> {
    let mut index: BTreeMap<String, Vec<PathBuf>> = BTreeMap::new();
    visit_files(root, &mut |path| {
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            return;
        }
        let Ok(text) = std::fs::read_to_string(path) else {
            return;
        };
        let parsed = parse_codedesign(&text);
        if let Some(eid) = parsed.entity_id {
            index.entry(eid).or_default().push(path.to_path_buf());
        }
    });
    index
}

/// stale マーカーをファイル末尾に追記する。既に同 file_path に対する
/// マーカーが存在する場合は何もしない。
///
/// 追記した場合は `Ok(true)`、既存のためスキップした場合は `Ok(false)`。
fn append_stale_marker(path: &Path, code_path: &str) -> Result<bool, String> {
    let mut text = std::fs::read_to_string(path)
        .map_err(|e| format!("codedesign 読み込み失敗: {}: {e}", path.display()))?;

    // 既に同 code_path に対するマーカーが立っているならスキップ
    let needle = format!("file=\"{}\"", code_path);
    if text.contains(STALE_MARKER_PREFIX) && text.contains(&needle) {
        return Ok(false);
    }

    if !text.ends_with('\n') {
        text.push('\n');
    }
    let stamp = crate::manifest::now_rfc3339();
    text.push_str(&format!(
        "\n{} at=\"{stamp}\" file=\"{code_path}\" -->\n",
        STALE_MARKER_PREFIX
    ));
    std::fs::write(path, text)
        .map_err(|e| format!("codedesign 書き込み失敗: {}: {e}", path.display()))?;
    Ok(true)
}

/// プロジェクトファイルを `.ars-cache/feedback-backup-{ts}.json` にコピー
fn backup_project_file(project_file: &Path, project_dir: &Path) -> Result<Option<PathBuf>, String> {
    let bytes = std::fs::read(project_file)
        .map_err(|e| format!("プロジェクトファイル読み込み失敗: {e}"))?;
    let cache_dir = project_dir.join(crate::manifest::CACHE_DIR);
    std::fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("バックアップディレクトリ作成失敗: {e}"))?;
    // 安全なファイル名にタイムスタンプを埋め込む（":" を含めない）
    let stamp = crate::manifest::now_rfc3339()
        .replace([':', '-', 'Z'], "");
    let backup_path = cache_dir.join(format!("feedback-backup-{stamp}.json"));
    std::fs::write(&backup_path, bytes)
        .map_err(|e| format!("バックアップ書き込み失敗: {e}"))?;
    Ok(Some(backup_path))
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

    // ── Apply 系テスト ────────────────────────────────────────

    use ars_core::models::{
        Action, ActionType, Actor, Component, Position, Project as ArsProject, Requirements, Scene,
    };
    use std::collections::HashMap;

    fn empty_project() -> ArsProject {
        ArsProject {
            name: "Demo".into(),
            scenes: HashMap::new(),
            components: HashMap::new(),
            prefabs: HashMap::new(),
            active_scene_id: None,
        }
    }

    fn actor(id: &str, name: &str) -> Actor {
        Actor {
            id: id.into(),
            name: name.into(),
            role: "actor".into(),
            actor_type: "simple".into(),
            requirements: Requirements::default(),
            actor_states: vec![],
            flexible_content: String::new(),
            displays: vec![],
            position: Position { x: 0.0, y: 0.0 },
            sub_scene_id: None,
        }
    }

    fn action(id: &str, name: &str) -> Action {
        Action {
            id: id.into(),
            name: name.into(),
            action_type: ActionType::default(),
            description: String::new(),
            behaviors: vec![],
            concretes: vec![],
        }
    }

    fn component(id: &str, name: &str) -> Component {
        Component {
            id: id.into(),
            name: name.into(),
            category: "Logic".into(),
            domain: "core".into(),
            variables: vec![],
            tasks: vec![],
            dependencies: vec![],
            source_module_id: None,
        }
    }

    #[test]
    fn apply_codedesign_updates_actor_requirements() {
        let h = Harness::new("apply-actor");
        h.write("demo.ars.json", b"{}");
        let md_path = h.write(
            "codedesign/actors/player.md",
            r#"# Player

## メタ情報
- **ID**: actor-player
- **タイプ**: state
- **ドメインロール**: protagonist

## 概要
- プレイヤーキャラクター
- 主操作の対象

## 達成目標
- 入力に従う

## 役割
- 主人公

## 挙動
- 移動する
"#
            .as_bytes(),
        );

        // 初期 Project: Actor "actor-player" を内包する Scene を作成
        let mut project = empty_project();
        let mut scene = Scene {
            id: "scene-1".into(),
            name: "Main".into(),
            root_actor_id: "actor-player".into(),
            actors: HashMap::new(),
            messages: vec![],
            actions: HashMap::new(),
        };
        scene
            .actors
            .insert("actor-player".into(), actor("actor-player", "Player"));
        project.scenes.insert(scene.id.clone(), scene);

        // manifest を作って codedesign を Modified 扱いに見せかける
        let mut m = fake_manifest(&h);
        let cd_rel = relative_path(&md_path, &h.dir);
        m.entries.push(ManifestEntry {
            category: LayoutCategory::Actor,
            entity_id: "actor-player".into(),
            entity_name: "Player".into(),
            class_name: "PlayerActor".into(),
            parent_id: Some("scene-1".into()),
            files: vec![FileRecord {
                path: cd_rel,
                // 元 CRC をわざと別物にして Modified 検出させる
                crc32: "00000000".into(),
                size: 0,
                modified_at: "2026-01-01T00:00:00Z".into(),
                kind: FileKind::CodeDesign,
            }],
        });
        m.save_to(&h.manifest_path()).unwrap();

        let inputs = FeedbackInputs {
            project_file: &h.project_file(),
            output_root: &h.output_root(),
            codedesign_root: Some(&h.codedesign_root()),
            manifest_path: &h.manifest_path(),
        };
        let report = detect_changes(&inputs).unwrap();
        assert!(report.changes.iter().any(|c| c.kind == FileKind::CodeDesign));

        let opts = FeedbackApplyOptions {
            apply_codedesign_to_project: true,
            mark_code_stale: false,
            backup_project: false,
        };
        let result = apply_feedback(&mut project, &report, &inputs, &opts).unwrap();

        assert_eq!(result.applied.len(), 1, "1 件適用される");
        let updated_actor = project
            .scenes
            .get("scene-1")
            .and_then(|s| s.actors.get("actor-player"))
            .unwrap();
        assert_eq!(updated_actor.actor_type, "state");
        assert_eq!(updated_actor.role, "protagonist");
        assert_eq!(
            updated_actor.requirements.overview,
            vec!["プレイヤーキャラクター", "主操作の対象"]
        );
        assert_eq!(updated_actor.requirements.goals, vec!["入力に従う"]);
        assert_eq!(updated_actor.requirements.role, vec!["主人公"]);
        assert_eq!(updated_actor.requirements.behavior, vec!["移動する"]);
    }

    #[test]
    fn apply_codedesign_updates_action_behaviors() {
        let h = Harness::new("apply-action");
        h.write("demo.ars.json", b"{}");
        let md_path = h.write(
            "codedesign/actions/attack.md",
            r#"# Attack

## メタ情報
- **ID**: action-attack

## 概要
- 攻撃アクション

## 振る舞い
- ダメージを計算する
- 命中判定を行う
"#
            .as_bytes(),
        );

        let mut project = empty_project();
        let mut scene = Scene {
            id: "scene-1".into(),
            name: "Main".into(),
            root_actor_id: "x".into(),
            actors: HashMap::new(),
            messages: vec![],
            actions: HashMap::new(),
        };
        scene
            .actions
            .insert("action-attack".into(), action("action-attack", "Attack"));
        project.scenes.insert(scene.id.clone(), scene);

        let mut m = fake_manifest(&h);
        let cd_rel = relative_path(&md_path, &h.dir);
        m.entries.push(ManifestEntry {
            category: LayoutCategory::Action,
            entity_id: "action-attack".into(),
            entity_name: "Attack".into(),
            class_name: "Attack".into(),
            parent_id: Some("scene-1".into()),
            files: vec![FileRecord {
                path: cd_rel,
                crc32: "00000000".into(),
                size: 0,
                modified_at: "2026-01-01T00:00:00Z".into(),
                kind: FileKind::CodeDesign,
            }],
        });
        m.save_to(&h.manifest_path()).unwrap();

        let inputs = FeedbackInputs {
            project_file: &h.project_file(),
            output_root: &h.output_root(),
            codedesign_root: Some(&h.codedesign_root()),
            manifest_path: &h.manifest_path(),
        };
        let report = detect_changes(&inputs).unwrap();
        let opts = FeedbackApplyOptions {
            apply_codedesign_to_project: true,
            mark_code_stale: false,
            backup_project: false,
        };
        let _ = apply_feedback(&mut project, &report, &inputs, &opts).unwrap();

        let upd = project
            .scenes
            .get("scene-1")
            .and_then(|s| s.actions.get("action-attack"))
            .unwrap();
        assert_eq!(upd.behaviors, vec!["ダメージを計算する", "命中判定を行う"]);
        assert_eq!(upd.description, "攻撃アクション");
    }

    #[test]
    fn stale_marker_is_appended_idempotently() {
        let h = Harness::new("stale");
        h.write("demo.ars.json", b"{}");

        // entity_id を持つ codedesign を用意
        let cd_path = h.write(
            "codedesign/components/health.md",
            b"# Health\n\n## \xe3\x83\xa1\xe3\x82\xbf\xe6\x83\x85\xe5\xa0\xb1\n- **ID**: comp-health\n",
        );
        let code_rel = "generated/Module/Health/Health.ts";
        let code_abs = h.write(code_rel, b"class Health {}");

        let mut project = empty_project();
        project
            .components
            .insert("comp-health".into(), component("comp-health", "Health"));

        let mut m = fake_manifest(&h);
        m.entries.push(ManifestEntry {
            category: LayoutCategory::Module,
            entity_id: "comp-health".into(),
            entity_name: "Health".into(),
            class_name: "Health".into(),
            parent_id: None,
            files: vec![FileRecord {
                path: code_rel.into(),
                crc32: crc32_hex(&fs::read(&code_abs).unwrap()),
                size: 0,
                modified_at: "2026-01-01T00:00:00Z".into(),
                kind: FileKind::Code,
            }],
        });
        m.save_to(&h.manifest_path()).unwrap();

        // コードを書き換え
        h.write(code_rel, b"class Health { hp = 100; }");

        let inputs = FeedbackInputs {
            project_file: &h.project_file(),
            output_root: &h.output_root(),
            codedesign_root: Some(&h.codedesign_root()),
            manifest_path: &h.manifest_path(),
        };
        let report = detect_changes(&inputs).unwrap();
        assert_eq!(report.count(ChangeKind::Modified), 1);

        let opts = FeedbackApplyOptions {
            apply_codedesign_to_project: false,
            mark_code_stale: true,
            backup_project: false,
        };

        // 1 回目: マーカーが追記される
        let result = apply_feedback(&mut project, &report, &inputs, &opts).unwrap();
        assert_eq!(result.stale_marked.len(), 1);
        let after = std::fs::read_to_string(&cd_path).unwrap();
        assert!(after.contains(STALE_MARKER_PREFIX));
        assert!(after.contains(code_rel));

        // 2 回目: 既存マーカー検出でスキップされる
        let result2 = apply_feedback(&mut project, &report, &inputs, &opts).unwrap();
        assert_eq!(result2.stale_marked.len(), 0);
        let after2 = std::fs::read_to_string(&cd_path).unwrap();
        let count = after2.matches(STALE_MARKER_PREFIX).count();
        assert_eq!(count, 1, "stale マーカーは 1 つだけ");
    }

    #[test]
    fn apply_creates_backup() {
        let h = Harness::new("backup");
        h.write("demo.ars.json", b"{\"name\":\"Demo\"}");
        let m = fake_manifest(&h);
        m.save_to(&h.manifest_path()).unwrap();

        let mut project = empty_project();
        let report = FeedbackReport::default();
        let inputs = FeedbackInputs {
            project_file: &h.project_file(),
            output_root: &h.output_root(),
            codedesign_root: Some(&h.codedesign_root()),
            manifest_path: &h.manifest_path(),
        };
        let opts = FeedbackApplyOptions {
            apply_codedesign_to_project: false,
            mark_code_stale: false,
            backup_project: true,
        };
        let result = apply_feedback(&mut project, &report, &inputs, &opts).unwrap();
        let backup = result.backup_path.expect("バックアップが作成される");
        assert!(backup.starts_with(".ars-cache/feedback-backup-"));
        let abs = h.dir.join(&backup);
        assert!(abs.exists());
    }

    #[test]
    fn unknown_entity_id_goes_to_requires_review() {
        let h = Harness::new("unknown-entity");
        h.write("demo.ars.json", b"{}");
        let md_path = h.write(
            "codedesign/actors/ghost.md",
            b"# Ghost\n\n## \xe3\x83\xa1\xe3\x82\xbf\xe6\x83\x85\xe5\xa0\xb1\n- **ID**: actor-ghost\n\n## \xe6\xa6\x82\xe8\xa6\x81\n- foo\n",
        );

        let mut project = empty_project();
        let mut m = fake_manifest(&h);
        let cd_rel = relative_path(&md_path, &h.dir);
        m.entries.push(ManifestEntry {
            category: LayoutCategory::Actor,
            entity_id: "actor-ghost".into(),
            entity_name: "Ghost".into(),
            class_name: "GhostActor".into(),
            parent_id: None,
            files: vec![FileRecord {
                path: cd_rel,
                crc32: "00000000".into(),
                size: 0,
                modified_at: "2026-01-01T00:00:00Z".into(),
                kind: FileKind::CodeDesign,
            }],
        });
        m.save_to(&h.manifest_path()).unwrap();

        let inputs = FeedbackInputs {
            project_file: &h.project_file(),
            output_root: &h.output_root(),
            codedesign_root: Some(&h.codedesign_root()),
            manifest_path: &h.manifest_path(),
        };
        let report = detect_changes(&inputs).unwrap();
        let opts = FeedbackApplyOptions {
            apply_codedesign_to_project: true,
            mark_code_stale: false,
            backup_project: false,
        };
        let result = apply_feedback(&mut project, &report, &inputs, &opts).unwrap();
        assert!(result.applied.is_empty());
        assert_eq!(result.requires_review.len(), 1);
        assert!(result.requires_review[0].summary.contains("見つかりません"));
    }
}
