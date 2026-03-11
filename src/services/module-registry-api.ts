/**
 * モジュールレジストリ Tauri コマンドバインディング
 * Rust側の commands/module_registry.rs と対応
 */
import { invoke } from '@tauri-apps/api/core';
import type {
  AddSourceParams,
  CommandResult,
  ModuleDefinition,
  ModuleRegistrySource,
} from '../types/module-registry';

/** レジストリソース（GitHubリポジトリ）を追加 */
export async function addRegistrySource(
  params: AddSourceParams
): Promise<CommandResult<ModuleRegistrySource>> {
  return invoke('add_registry_source', { params });
}

/** レジストリソースを削除 */
export async function removeRegistrySource(
  sourceId: string
): Promise<CommandResult<void>> {
  return invoke('remove_registry_source', { sourceId });
}

/** 指定ソースを同期（clone/pull + 定義パース） */
export async function syncRegistrySource(
  sourceId: string
): Promise<CommandResult<ModuleDefinition[]>> {
  return invoke('sync_registry_source', { sourceId });
}

/** 全ソースを同期 */
export async function syncAllSources(): Promise<
  CommandResult<ModuleDefinition[]>
> {
  return invoke('sync_all_sources');
}

/** 全モジュール定義を取得 */
export async function getAllModules(): Promise<
  CommandResult<ModuleDefinition[]>
> {
  return invoke('get_all_modules');
}

/** カテゴリでモジュールをフィルタ */
export async function getModulesByCategory(
  category: string
): Promise<CommandResult<ModuleDefinition[]>> {
  return invoke('get_modules_by_category', { category });
}

/** モジュールを検索 */
export async function searchModules(
  query: string
): Promise<CommandResult<ModuleDefinition[]>> {
  return invoke('search_modules', { query });
}

/** 全ソースを取得 */
export async function getRegistrySources(): Promise<
  CommandResult<ModuleRegistrySource[]>
> {
  return invoke('get_registry_sources');
}

/** IDでモジュールを取得 */
export async function getModuleById(
  moduleId: string
): Promise<CommandResult<ModuleDefinition>> {
  return invoke('get_module_by_id', { moduleId });
}
