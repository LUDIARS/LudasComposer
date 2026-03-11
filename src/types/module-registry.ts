// === モジュールレジストリ型定義 ===
// Rust側の models/module_definition.rs と対応

/** モジュールカテゴリ */
export type ModuleCategory = 'UI' | 'Logic' | 'System' | 'GameObject';

/** ポート定義（タスクの入出力） */
export interface PortDefinition {
  name: string;
  type: string;
}

/** 変数定義 */
export interface VariableDefinition {
  name: string;
  type: string;
  description?: string;
}

/** タスク定義 */
export interface TaskDefinition {
  name: string;
  description: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
}

/** テストケース */
export interface TestCase {
  description: string;
}

/** Ludusモジュール定義 */
export interface ModuleDefinition {
  id: string;
  name: string;
  summary: string;
  category: ModuleCategory;
  domain: string;
  required_data: string[];
  variables: VariableDefinition[];
  dependencies: string[];
  tasks: TaskDefinition[];
  tests: TestCase[];
  source_path?: string;
  source_repo?: string;
}

/** モジュールレジストリソース（GitHubリポジトリ） */
export interface ModuleRegistrySource {
  id: string;
  name: string;
  repo_url: string;
  local_path?: string;
  definition_glob: string;
  last_synced?: string;
}

/** レジストリ全体 */
export interface ModuleRegistry {
  sources: ModuleRegistrySource[];
  modules: ModuleDefinition[];
}

/** コマンド結果 */
export interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** ソース追加パラメータ */
export interface AddSourceParams {
  name: string;
  repo_url: string;
  definition_glob?: string;
}
