/**
 * ファイル名変換 Tauri コマンドバインディング
 */
import { invoke } from '@tauri-apps/api/core';
import type { DroppedFile, NamingRule, NamingConfig } from '../types/naming';

interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** D&Dで受け取ったファイルを解析 */
export async function analyzeDroppedFiles(
  paths: string[]
): Promise<CommandResult<DroppedFile[]>> {
  return invoke('analyze_dropped_files', { paths });
}

/** 英語名を生成 */
export async function generateEnglishName(
  originalName: string,
  category: string
): Promise<CommandResult<string>> {
  return invoke('generate_english_name', { originalName, category });
}

/** ネーミングルールを追加 */
export async function addNamingRule(
  japanesePattern: string,
  englishName: string
): Promise<CommandResult<void>> {
  return invoke('add_naming_rule', { japanesePattern, englishName });
}

/** ネーミングルールを削除 */
export async function removeNamingRule(
  index: number
): Promise<CommandResult<void>> {
  return invoke('remove_naming_rule', { index });
}

/** 全ルールを取得 */
export async function getNamingRules(): Promise<CommandResult<NamingRule[]>> {
  return invoke('get_naming_rules');
}

/** ネーミング設定を取得 */
export async function getNamingConfig(): Promise<CommandResult<NamingConfig>> {
  return invoke('get_naming_config');
}

/** カテゴリプレフィックスを更新 */
export async function setCategoryPrefix(
  category: string,
  prefix: string
): Promise<CommandResult<void>> {
  return invoke('set_category_prefix', { category, prefix });
}
