// === Emscripten C++↔TypeScript ブリッジ型定義 ===
// C++コアエンジンをEmscriptenでWASMにコンパイルし、TypeScriptゲームロジックと連携

/** WASMモジュールの状態 */
export type WasmModuleState = 'unloaded' | 'loading' | 'ready' | 'error';

/** Emscriptenモジュール定義 */
export interface EmscriptenModule {
  /** モジュール一意識別子 */
  id: string;
  /** モジュール名 */
  name: string;
  /** WASMバイナリのパス */
  wasmPath: string;
  /** Emscripten生成JSグルーコードのパス */
  gluePath: string;
  /** モジュールの現在の状態 */
  state: WasmModuleState;
  /** エクスポートされたC++関数一覧 */
  exportedFunctions: NativeFunction[];
  /** メモリ設定 */
  memoryConfig: WasmMemoryConfig;
}

/** C++からエクスポートされた関数の定義 */
export interface NativeFunction {
  /** 関数名 (C++側の名前) */
  name: string;
  /** TypeScript側のバインディング名 */
  bindingName: string;
  /** 引数型定義 */
  params: NativeParam[];
  /** 戻り値型 */
  returnType: NativeType;
  /** 関数の説明 */
  description?: string;
}

/** ネイティブ関数パラメータ */
export interface NativeParam {
  /** パラメータ名 */
  name: string;
  /** 型 */
  type: NativeType;
}

/** C++↔TypeScript間の型マッピング */
export type NativeType =
  | 'void'
  | 'i32'
  | 'i64'
  | 'f32'
  | 'f64'
  | 'bool'
  | 'string'
  | 'pointer'
  | 'array_buffer';

/** WASMメモリ設定 */
export interface WasmMemoryConfig {
  /** 初期メモリサイズ (ページ数, 1ページ = 64KB) */
  initialPages: number;
  /** 最大メモリサイズ (ページ数) */
  maximumPages: number;
  /** SharedArrayBuffer使用 (マルチスレッド対応) */
  shared: boolean;
}

/** Emscriptenブリッジ設定 */
export interface EmscriptenBridgeConfig {
  /** WASMモジュール一覧 */
  modules: EmscriptenModule[];
  /** TypeScript→C++ コールバック登録 */
  callbackBindings: CallbackBinding[];
  /** デバッグモード (C++デバッグシンボル含むWASM使用) */
  debugMode: boolean;
}

/** TypeScript→C++ コールバックバインディング */
export interface CallbackBinding {
  /** コールバック名 */
  name: string;
  /** 対応するTypeScript関数のモジュールID */
  scriptModuleId: string;
  /** 対応するTypeScript関数名 */
  scriptFunctionName: string;
  /** C++側の関数ポインタ型シグネチャ */
  signature: string;
}

/** TypeScript↔C++ 型マッピングテーブル */
export const TYPE_MAPPING: Record<NativeType, string> = {
  void: 'void',
  i32: 'number',
  i64: 'bigint',
  f32: 'number',
  f64: 'number',
  bool: 'boolean',
  string: 'string',
  pointer: 'number',
  array_buffer: 'ArrayBuffer',
};

/** デフォルトメモリ設定 */
export function createDefaultMemoryConfig(): WasmMemoryConfig {
  return {
    initialPages: 256,   // 16MB
    maximumPages: 16384, // 1GB
    shared: false,
  };
}

/** デフォルトブリッジ設定 */
export function createDefaultBridgeConfig(): EmscriptenBridgeConfig {
  return {
    modules: [],
    callbackBindings: [],
    debugMode: false,
  };
}
