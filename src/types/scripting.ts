// === TypeScriptスクリプティングランタイム型定義 ===
// ゲームロジックをTypeScriptで記述し、ホットリロード・WebGL実行に対応

/** スクリプトモジュールの状態 */
export type ScriptModuleState = 'unloaded' | 'loading' | 'loaded' | 'error' | 'hot-reloading';

/** スクリプトモジュール定義 */
export interface ScriptModule {
  /** モジュール一意識別子 */
  id: string;
  /** モジュール名 */
  name: string;
  /** TypeScriptソースコードパス */
  sourcePath: string;
  /** コンパイル済みJavaScriptコード (JITコンパイル後) */
  compiledCode?: string;
  /** ソースマップ (デバッグ用) */
  sourceMap?: string;
  /** モジュールの現在の状態 */
  state: ScriptModuleState;
  /** 最終コンパイル時刻 (ISO 8601) */
  lastCompiledAt?: string;
  /** コンパイルエラー情報 */
  error?: ScriptCompileError;
  /** 依存する他のスクリプトモジュールID */
  dependencies: string[];
  /** エクスポートされるシンボル一覧 */
  exports: ScriptExport[];
}

/** スクリプトコンパイルエラー */
export interface ScriptCompileError {
  /** エラーメッセージ */
  message: string;
  /** ファイルパス */
  file?: string;
  /** 行番号 */
  line?: number;
  /** 列番号 */
  column?: number;
  /** エラーコード (TypeScript diagnosticコード) */
  code?: number;
}

/** スクリプトモジュールのエクスポート定義 */
export interface ScriptExport {
  /** エクスポート名 */
  name: string;
  /** エクスポートの種類 */
  kind: 'function' | 'class' | 'variable' | 'interface';
}

/** JITコンパイル設定 */
export interface JitConfig {
  /** TypeScriptコンパイラオプション */
  compilerOptions: TsCompilerOptions;
  /** ホットリロード有効化 */
  hotReloadEnabled: boolean;
  /** ファイル変更監視間隔 (ms) */
  watchIntervalMs: number;
  /** ソースマップ生成 */
  generateSourceMaps: boolean;
  /** インクリメンタルコンパイル */
  incrementalCompilation: boolean;
}

/** TypeScriptコンパイラオプション (主要なもの) */
export interface TsCompilerOptions {
  /** ターゲットECMAScriptバージョン */
  target: 'es2020' | 'es2021' | 'es2022' | 'esnext';
  /** モジュールシステム */
  module: 'es2020' | 'esnext';
  /** strict モード */
  strict: boolean;
  /** デコレータサポート */
  experimentalDecorators: boolean;
}

/** ホットリロードイベント */
export interface HotReloadEvent {
  /** 変更されたモジュールID */
  moduleId: string;
  /** イベント種別 */
  type: 'compiled' | 'reloaded' | 'error';
  /** タイムスタンプ */
  timestamp: string;
  /** エラー情報 (type=error時) */
  error?: ScriptCompileError;
}

/** スクリプトランタイムの実行コンテキスト */
export interface ScriptContext {
  /** コンテキストID */
  id: string;
  /** 紐づくシーンID */
  sceneId: string;
  /** ロード済みモジュール一覧 */
  loadedModules: string[];
  /** グローバル変数バインディング */
  globals: Record<string, unknown>;
  /** Emscriptenブリッジ経由のネイティブバインディング */
  nativeBindings: string[];
}

/** デフォルトJIT設定 */
export function createDefaultJitConfig(): JitConfig {
  return {
    compilerOptions: {
      target: 'es2022',
      module: 'es2020',
      strict: true,
      experimentalDecorators: true,
    },
    hotReloadEnabled: true,
    watchIntervalMs: 500,
    generateSourceMaps: true,
    incrementalCompilation: true,
  };
}
