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
