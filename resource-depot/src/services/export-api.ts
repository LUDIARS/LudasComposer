/**
 * MB→FBXエクスポート Tauri コマンドバインディング
 */
import { invoke } from '@tauri-apps/api/core';
import type { ExportJob, MbExportConfig } from '../types/export';

interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** MB→FBXエクスポート実行 */
export async function exportMbToFbx(
  inputPath: string,
  outputDir?: string
): Promise<CommandResult<ExportJob>> {
  return invoke('export_mb_to_fbx', { inputPath, outputDir });
}

/** ファイルがMayaバイナリか判定 */
export async function isMayaBinary(
  path: string
): Promise<CommandResult<boolean>> {
  return invoke('is_maya_binary', { path });
}

/** エクスポート設定を更新 */
export async function updateExportConfig(
  config: MbExportConfig
): Promise<CommandResult<void>> {
  return invoke('update_export_config', { config });
}

/** エクスポート設定を取得 */
export async function getExportConfig(): Promise<CommandResult<MbExportConfig>> {
  return invoke('get_export_config');
}

/** エクスポートジョブ履歴を取得 */
export async function getExportJobs(): Promise<CommandResult<ExportJob[]>> {
  return invoke('get_export_jobs');
}

/** ジョブをIDで取得 */
export async function getExportJob(
  jobId: string
): Promise<CommandResult<ExportJob>> {
  return invoke('get_export_job', { jobId });
}
