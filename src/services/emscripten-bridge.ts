// === Emscripten C++↔TypeScript ブリッジサービス ===
// C++コアエンジン(WASM)とTypeScriptゲームロジックの相互呼び出しを管理

import type {
  EmscriptenModule,
  EmscriptenBridgeConfig,
  NativeFunction,
  CallbackBinding,
  WasmMemoryConfig,
  NativeType,
} from '../types/emscripten-bridge';
import { createDefaultBridgeConfig, createDefaultMemoryConfig, TYPE_MAPPING } from '../types/emscripten-bridge';

/** Emscriptenランタイムモジュールのインターフェース */
interface EmscriptenRuntimeModule {
  /** C関数を直接呼び出す */
  ccall: (name: string, returnType: string, argTypes: string[], args: unknown[]) => unknown;
  /** C関数のラッパーを取得 */
  cwrap: (name: string, returnType: string, argTypes: string[]) => (...args: unknown[]) => unknown;
  /** WASMメモリ */
  HEAPU8: Uint8Array;
  HEAP32: Int32Array;
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;
  /** メモリ確保 */
  _malloc: (size: number) => number;
  /** メモリ解放 */
  _free: (ptr: number) => void;
  /** 文字列変換 */
  stringToUTF8: (str: string, outPtr: number, maxBytesToWrite: number) => void;
  UTF8ToString: (ptr: number) => string;
  /** コールバック登録 */
  addFunction: (func: (...args: unknown[]) => unknown, sig: string) => number;
  removeFunction: (ptr: number) => void;
}

/**
 * Emscriptenブリッジ
 *
 * C++コアエンジンをEmscriptenでWASMにコンパイルし、
 * TypeScriptゲームロジックから呼び出す/呼び出されるブリッジ層。
 *
 * アーキテクチャ:
 * ```
 * TypeScript ゲームロジック (AI生成)
 *     ↕  EmscriptenBridge (このクラス)
 * C++ コアエンジン (Emscripten → WASM)
 *     ↕  WebGL / WebAudio API
 * ブラウザ
 * ```
 */
export class EmscriptenBridge {
  private config: EmscriptenBridgeConfig;
  private runtimeModules: Map<string, EmscriptenRuntimeModule> = new Map();
  private wrappedFunctions: Map<string, Map<string, (...args: unknown[]) => unknown>> = new Map();
  private registeredCallbacks: Map<string, number> = new Map();
  private moduleStates: Map<string, EmscriptenModule> = new Map();

  constructor(config?: Partial<EmscriptenBridgeConfig>) {
    this.config = { ...createDefaultBridgeConfig(), ...config };
  }

  // ─── WASMモジュール管理 ───

  /**
   * EmscriptenコンパイルされたWASMモジュールをロード
   */
  async loadModule(moduleDef: EmscriptenModule): Promise<void> {
    this.updateModuleState(moduleDef.id, { ...moduleDef, state: 'loading' });

    try {
      // Emscriptenグルーコードを動的インポート
      const glueModule = await import(/* @vite-ignore */ moduleDef.gluePath);

      // Emscriptenモジュールを初期化
      const memory = this.createMemory(moduleDef.memoryConfig);
      const runtimeModule: EmscriptenRuntimeModule = await glueModule.default({
        wasmBinary: await this.fetchWasm(moduleDef.wasmPath),
        wasmMemory: memory,
        // デバッグモードではアサーションを有効化
        ASSERTIONS: this.config.debugMode,
      });

      this.runtimeModules.set(moduleDef.id, runtimeModule);

      // エクスポート関数のラッパーを作成
      const wrappers = new Map<string, (...args: unknown[]) => unknown>();
      for (const func of moduleDef.exportedFunctions) {
        const wrapper = this.createFunctionWrapper(runtimeModule, func);
        wrappers.set(func.bindingName, wrapper);
      }
      this.wrappedFunctions.set(moduleDef.id, wrappers);

      this.updateModuleState(moduleDef.id, { ...moduleDef, state: 'ready' });
    } catch (err) {
      this.updateModuleState(moduleDef.id, {
        ...moduleDef,
        state: 'error',
      });
      throw new Error(`Failed to load WASM module ${moduleDef.name}: ${err}`);
    }
  }

  /** WASMモジュールをアンロード */
  unloadModule(moduleId: string): void {
    // 登録済みコールバックを解除
    for (const [key, ptr] of this.registeredCallbacks.entries()) {
      if (key.startsWith(`${moduleId}:`)) {
        const runtime = this.runtimeModules.get(moduleId);
        if (runtime) {
          runtime.removeFunction(ptr);
        }
        this.registeredCallbacks.delete(key);
      }
    }

    this.wrappedFunctions.delete(moduleId);
    this.runtimeModules.delete(moduleId);
    this.moduleStates.delete(moduleId);
  }

  /** ロード済みモジュール一覧を取得 */
  getLoadedModules(): EmscriptenModule[] {
    return Array.from(this.moduleStates.values());
  }

  // ─── TypeScript → C++ 関数呼び出し ───

  /**
   * C++関数をTypeScriptから呼び出す
   * @param moduleId WASMモジュールID
   * @param functionName バインディング名
   * @param args 引数
   */
  call<T = unknown>(moduleId: string, functionName: string, ...args: unknown[]): T {
    const wrappers = this.wrappedFunctions.get(moduleId);
    if (!wrappers) {
      throw new Error(`WASM module not loaded: ${moduleId}`);
    }
    const func = wrappers.get(functionName);
    if (!func) {
      throw new Error(`Function not found: ${functionName} in module ${moduleId}`);
    }
    return func(...args) as T;
  }

  /** モジュールの全バインディング関数を取得 */
  getBindings(moduleId: string): Record<string, (...args: unknown[]) => unknown> {
    const wrappers = this.wrappedFunctions.get(moduleId);
    if (!wrappers) {
      return {};
    }
    return Object.fromEntries(wrappers.entries());
  }

  // ─── C++ → TypeScript コールバック登録 ───

  /**
   * TypeScript関数をC++からのコールバックとして登録
   * C++側からは関数ポインタとして呼び出される
   */
  registerCallback(
    moduleId: string,
    binding: CallbackBinding,
    handler: (...args: unknown[]) => unknown,
  ): void {
    const runtime = this.runtimeModules.get(moduleId);
    if (!runtime) {
      throw new Error(`WASM module not loaded: ${moduleId}`);
    }

    const key = `${moduleId}:${binding.name}`;

    // 既存のコールバックがあれば解除
    const existing = this.registeredCallbacks.get(key);
    if (existing !== undefined) {
      runtime.removeFunction(existing);
    }

    // 新しいコールバックを登録
    const ptr = runtime.addFunction(handler, binding.signature);
    this.registeredCallbacks.set(key, ptr);
  }

  /** コールバックを解除 */
  unregisterCallback(moduleId: string, callbackName: string): void {
    const key = `${moduleId}:${callbackName}`;
    const ptr = this.registeredCallbacks.get(key);
    if (ptr !== undefined) {
      const runtime = this.runtimeModules.get(moduleId);
      if (runtime) {
        runtime.removeFunction(ptr);
      }
      this.registeredCallbacks.delete(key);
    }
  }

  // ─── メモリ操作ユーティリティ ───

  /** C++ヒープに文字列を書き込み、ポインタを返す */
  allocString(moduleId: string, str: string): number {
    const runtime = this.runtimeModules.get(moduleId);
    if (!runtime) throw new Error(`WASM module not loaded: ${moduleId}`);

    const bytes = new TextEncoder().encode(str);
    const ptr = runtime._malloc(bytes.length + 1);
    runtime.stringToUTF8(str, ptr, bytes.length + 1);
    return ptr;
  }

  /** C++ヒープの文字列を読み取る */
  readString(moduleId: string, ptr: number): string {
    const runtime = this.runtimeModules.get(moduleId);
    if (!runtime) throw new Error(`WASM module not loaded: ${moduleId}`);

    return runtime.UTF8ToString(ptr);
  }

  /** C++ヒープのメモリを解放 */
  free(moduleId: string, ptr: number): void {
    const runtime = this.runtimeModules.get(moduleId);
    if (!runtime) throw new Error(`WASM module not loaded: ${moduleId}`);

    runtime._free(ptr);
  }

  /** ArrayBufferをC++ヒープにコピー */
  allocBuffer(moduleId: string, buffer: ArrayBuffer): number {
    const runtime = this.runtimeModules.get(moduleId);
    if (!runtime) throw new Error(`WASM module not loaded: ${moduleId}`);

    const bytes = new Uint8Array(buffer);
    const ptr = runtime._malloc(bytes.length);
    runtime.HEAPU8.set(bytes, ptr);
    return ptr;
  }

  // ─── 型マッピングヘルパー ───

  /** NativeTypeからTypeScriptの型名を取得 */
  static getTypeScriptType(nativeType: NativeType): string {
    return TYPE_MAPPING[nativeType];
  }

  /** NativeTypeからEmscripten ccall用の型名を取得 */
  static getCCallType(nativeType: NativeType): string {
    switch (nativeType) {
      case 'void': return 'null';
      case 'i32': case 'bool': return 'number';
      case 'i64': return 'bigint';
      case 'f32': case 'f64': return 'number';
      case 'string': return 'string';
      case 'pointer': case 'array_buffer': return 'number';
    }
  }

  // ─── 設定 ───

  /** 設定を取得 */
  getConfig(): EmscriptenBridgeConfig {
    return { ...this.config };
  }

  /** 設定を更新 */
  updateConfig(config: Partial<EmscriptenBridgeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ─── 破棄 ───

  /** ブリッジ全体を破棄 */
  dispose(): void {
    for (const moduleId of this.runtimeModules.keys()) {
      this.unloadModule(moduleId);
    }
  }

  // ─── プライベート ───

  private async fetchWasm(wasmPath: string): Promise<ArrayBuffer> {
    const response = await fetch(wasmPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${wasmPath} (${response.status})`);
    }
    return response.arrayBuffer();
  }

  private createMemory(config: WasmMemoryConfig): WebAssembly.Memory {
    return new WebAssembly.Memory({
      initial: config.initialPages,
      maximum: config.maximumPages,
      shared: config.shared,
    });
  }

  private createFunctionWrapper(
    runtime: EmscriptenRuntimeModule,
    func: NativeFunction,
  ): (...args: unknown[]) => unknown {
    const returnType = EmscriptenBridge.getCCallType(func.returnType);
    const argTypes = func.params.map((p) => EmscriptenBridge.getCCallType(p.type));

    return runtime.cwrap(func.name, returnType, argTypes);
  }

  private updateModuleState(moduleId: string, module: EmscriptenModule): void {
    this.moduleStates.set(moduleId, module);
  }
}

/**
 * Emscriptenモジュール定義のファクトリ
 * C++プロジェクトのヘッダーファイルから自動生成されることを想定
 */
export function defineEmscriptenModule(
  partial: Pick<EmscriptenModule, 'id' | 'name' | 'wasmPath' | 'gluePath' | 'exportedFunctions'> &
    Partial<Pick<EmscriptenModule, 'memoryConfig'>>,
): EmscriptenModule {
  return {
    ...partial,
    state: 'unloaded',
    memoryConfig: partial.memoryConfig ?? createDefaultMemoryConfig(),
  };
}
