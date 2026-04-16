/// コード生成ブリッジの型定義

/** 対象プラットフォーム */
export type TargetPlatform = 'unity' | 'godot' | 'unreal' | 'ergo';

/** 出力フォーマット */
export type OutputFormat = 'source-only' | 'with-tests' | 'full';

/** プラットフォーム情報 */
export interface PlatformInfo {
  id: TargetPlatform;
  label: string;
  language: string;
  fileExtension: string;
}

/** 出力フォーマット情報 */
export interface OutputFormatInfo {
  id: OutputFormat;
  label: string;
}

/** コード生成オプション一覧 (バックエンドから返却) */
export interface CodegenOptions {
  platforms: PlatformInfo[];
  outputFormats: OutputFormatInfo[];
}

/** コード生成ブリッジ設定 (UIから送信) */
export interface CodegenBridgeConfig {
  platform: TargetPlatform;
  outputFormat: OutputFormat;
  outputDir: string;
  sceneIds: string[];
  componentIds: string[];
  dryRun: boolean;
  maxConcurrent: number;
  model?: string;
  permissionMode?: string;
  codedesignRoot?: string;
}

/** プレビュータスク */
export interface CodegenPreviewTask {
  id: string;
  taskType: string;
  name: string;
  outputDir: string;
  dependencies: string[];
  promptPreview: string;
}

/** プレビュー結果 */
export interface CodegenPreviewResult {
  platform: TargetPlatform;
  outputFormat: OutputFormat;
  language: string;
  fileExtension: string;
  tasks: CodegenPreviewTask[];
  totalTasks: number;
}

// ========== Feedback / Apply ==========

/** 変更種別 */
export type ChangeKind = 'added' | 'modified' | 'removed';

/** ファイル種別 */
export type FileKind = 'code' | 'codedesign' | 'project';

/** レイアウトカテゴリ */
export type LayoutCategory = 'scene' | 'actor' | 'module' | 'action' | 'ui' | 'data';

/** 個別ファイルの変更レコード */
export interface FileChange {
  change: ChangeKind;
  kind: FileKind;
  path: string;
  category?: LayoutCategory;
  entityId?: string;
  entityName?: string;
  previousCrc32?: string;
  currentCrc32?: string;
}

/** フィードバック差分レポート */
export interface FeedbackReport {
  projectChanged: boolean;
  manifestMissing: boolean;
  changes: FileChange[];
}

/** 適用済み変更の 1 件 */
export interface AppliedChange {
  path: string;
  kind: FileKind;
  entityId?: string;
  entityName?: string;
  summary: string;
}

/** apply_feedback の結果 */
export interface ApplyResult {
  applied: AppliedChange[];
  staleMarked: string[];
  requiresReview: AppliedChange[];
  backupPath?: string;
}

/** apply レスポンス (バックエンドから返却) */
export interface CodegenApplyResponse {
  result: ApplyResult;
  project: import('./domain').Project;
}
