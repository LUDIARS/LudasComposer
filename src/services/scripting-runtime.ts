// === TypeScriptスクリプティングランタイムサービス ===
// ゲームロジックのTypeScript組み込み実行とJITコンパイルを管理

import type {
  ScriptModule,
  ScriptModuleState,
  ScriptContext,
  ScriptCompileError,
  ScriptExport,
  JitConfig,
  HotReloadEvent,
} from '../types/scripting';
import { createDefaultJitConfig } from '../types/scripting';

/** モジュール変更リスナー */
type ModuleChangeListener = (event: HotReloadEvent) => void;

/**
 * TypeScriptスクリプティングランタイム
 *
 * ゲームロジックをTypeScriptで記述し、ブラウザ/Tauri webview内で直接実行する。
 * - 組み込み: ESモジュールとしてTypeScriptをトランスパイル→eval実行
 * - JIT: ファイル変更を監視し、インクリメンタルにリコンパイル→ホットリロード
 * - WebGL対応: ブラウザネイティブのES modules実行
 */
export class ScriptingRuntime {
  private modules: Map<string, ScriptModule> = new Map();
  private contexts: Map<string, ScriptContext> = new Map();
  private moduleInstances: Map<string, Record<string, unknown>> = new Map();
  private config: JitConfig;
  private listeners: ModuleChangeListener[] = [];
  private watchTimers: Map<string, number> = new Map();

  constructor(config?: Partial<JitConfig>) {
    this.config = { ...createDefaultJitConfig(), ...config };
  }

  // ─── モジュール登録 ───

  /** スクリプトモジュールを登録 */
  registerModule(module: Omit<ScriptModule, 'state' | 'exports'>): ScriptModule {
    const fullModule: ScriptModule = {
      ...module,
      state: 'unloaded',
      exports: [],
    };
    this.modules.set(module.id, fullModule);
    return fullModule;
  }

  /** モジュールを登録解除 */
  unregisterModule(moduleId: string): void {
    this.unloadModule(moduleId);
    this.modules.delete(moduleId);
  }

  /** 登録済みモジュール一覧を取得 */
  getModules(): ScriptModule[] {
    return Array.from(this.modules.values());
  }

  /** モジュールを取得 */
  getModule(moduleId: string): ScriptModule | undefined {
    return this.modules.get(moduleId);
  }

  // ─── JITコンパイル ───

  /**
   * TypeScriptソースコードをJITコンパイル
   * ブラウザ内でTypeScriptをJavaScriptにトランスパイルする
   */
  async compileModule(moduleId: string, sourceCode: string): Promise<ScriptModule> {
    const module = this.modules.get(moduleId);
    if (!module) {
      throw new Error(`Module not found: ${moduleId}`);
    }

    this.updateModuleState(moduleId, 'loading');

    try {
      // TypeScript → JavaScript トランスパイル
      const result = await this.transpileTypeScript(sourceCode, module.sourcePath);

      const updatedModule: ScriptModule = {
        ...module,
        compiledCode: result.code,
        sourceMap: result.sourceMap,
        state: 'loaded',
        lastCompiledAt: new Date().toISOString(),
        error: undefined,
        exports: result.exports,
      };
      this.modules.set(moduleId, updatedModule);

      this.notifyListeners({
        moduleId,
        type: 'compiled',
        timestamp: new Date().toISOString(),
      });

      return updatedModule;
    } catch (err) {
      const compileError = this.toCompileError(err);
      const errorModule: ScriptModule = {
        ...module,
        state: 'error',
        error: compileError,
      };
      this.modules.set(moduleId, errorModule);

      this.notifyListeners({
        moduleId,
        type: 'error',
        timestamp: new Date().toISOString(),
        error: compileError,
      });

      throw err;
    }
  }

  // ─── モジュール実行 (組み込み) ───

  /**
   * コンパイル済みモジュールを実行し、エクスポートされたシンボルを取得
   * ESモジュールとしてブラウザ内で動的にロード
   */
  async loadModule(moduleId: string): Promise<Record<string, unknown>> {
    const module = this.modules.get(moduleId);
    if (!module || !module.compiledCode) {
      throw new Error(`Module not compiled: ${moduleId}`);
    }

    // 依存モジュールを先にロード
    for (const depId of module.dependencies) {
      if (!this.moduleInstances.has(depId)) {
        await this.loadModule(depId);
      }
    }

    // Blob URLを使ったES Module動的ロード
    const blob = new Blob([module.compiledCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    try {
      const moduleExports = await import(/* @vite-ignore */ url);
      this.moduleInstances.set(moduleId, moduleExports);
      this.updateModuleState(moduleId, 'loaded');
      return moduleExports;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /** モジュールのエクスポートされた関数を取得 */
  getModuleExports(moduleId: string): Record<string, unknown> | undefined {
    return this.moduleInstances.get(moduleId);
  }

  /** モジュールをアンロード */
  unloadModule(moduleId: string): void {
    this.moduleInstances.delete(moduleId);
    this.stopWatching(moduleId);
    const module = this.modules.get(moduleId);
    if (module) {
      this.updateModuleState(moduleId, 'unloaded');
    }
  }

  // ─── ホットリロード ───

  /**
   * モジュールのホットリロードを実行
   * 実行中のモジュールを新しいコードで差し替える
   */
  async hotReload(moduleId: string, newSourceCode: string): Promise<void> {
    const module = this.modules.get(moduleId);
    if (!module) {
      throw new Error(`Module not found: ${moduleId}`);
    }

    this.updateModuleState(moduleId, 'hot-reloading');

    // 旧モジュールのエクスポートを退避
    const oldExports = this.moduleInstances.get(moduleId);

    try {
      // リコンパイル
      await this.compileModule(moduleId, newSourceCode);

      // リロード
      const newExports = await this.loadModule(moduleId);

      // dispose関数があれば旧モジュールのクリーンアップを実行
      if (oldExports && typeof (oldExports as Record<string, unknown>)['dispose'] === 'function') {
        (oldExports as Record<string, (...args: unknown[]) => unknown>)['dispose']();
      }

      // init関数があれば新モジュールの初期化を実行
      if (typeof (newExports as Record<string, unknown>)['init'] === 'function') {
        (newExports as Record<string, (...args: unknown[]) => unknown>)['init']();
      }

      this.notifyListeners({
        moduleId,
        type: 'reloaded',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      // ホットリロード失敗時は旧モジュールを維持
      if (oldExports) {
        this.moduleInstances.set(moduleId, oldExports);
      }
      throw err;
    }
  }

  /** ファイル変更監視を開始 */
  startWatching(moduleId: string, getSource: () => Promise<string>): void {
    if (!this.config.hotReloadEnabled) return;
    this.stopWatching(moduleId);

    const timer = window.setInterval(async () => {
      try {
        const source = await getSource();
        const module = this.modules.get(moduleId);
        if (module?.compiledCode !== undefined) {
          // ソースが変更されていればホットリロード
          const result = await this.transpileTypeScript(source, module.sourcePath);
          if (result.code !== module.compiledCode) {
            await this.hotReload(moduleId, source);
          }
        }
      } catch {
        // 監視中のエラーはログのみ
      }
    }, this.config.watchIntervalMs);

    this.watchTimers.set(moduleId, timer);
  }

  /** ファイル変更監視を停止 */
  stopWatching(moduleId: string): void {
    const timer = this.watchTimers.get(moduleId);
    if (timer !== undefined) {
      window.clearInterval(timer);
      this.watchTimers.delete(moduleId);
    }
  }

  // ─── 実行コンテキスト ───

  /** シーンに紐づく実行コンテキストを作成 */
  createContext(sceneId: string, globals?: Record<string, unknown>): ScriptContext {
    const context: ScriptContext = {
      id: crypto.randomUUID(),
      sceneId,
      loadedModules: [],
      globals: globals ?? {},
      nativeBindings: [],
    };
    this.contexts.set(context.id, context);
    return context;
  }

  /** コンテキストを破棄 */
  destroyContext(contextId: string): void {
    const context = this.contexts.get(contextId);
    if (context) {
      // コンテキスト内のモジュールをアンロード
      for (const moduleId of context.loadedModules) {
        this.unloadModule(moduleId);
      }
      this.contexts.delete(contextId);
    }
  }

  /** コンテキストにモジュールをロード */
  async loadModuleInContext(contextId: string, moduleId: string): Promise<Record<string, unknown>> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context not found: ${contextId}`);
    }

    const exports = await this.loadModule(moduleId);
    if (!context.loadedModules.includes(moduleId)) {
      context.loadedModules.push(moduleId);
    }
    return exports;
  }

  // ─── イベントリスナー ───

  /** モジュール変更リスナーを登録 */
  onModuleChange(listener: ModuleChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // ─── 設定 ───

  /** JIT設定を取得 */
  getConfig(): JitConfig {
    return { ...this.config };
  }

  /** JIT設定を更新 */
  updateConfig(config: Partial<JitConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ─── ランタイム破棄 ───

  /** ランタイム全体を破棄 */
  dispose(): void {
    // 全監視を停止
    for (const moduleId of this.watchTimers.keys()) {
      this.stopWatching(moduleId);
    }
    // 全コンテキストを破棄
    for (const contextId of this.contexts.keys()) {
      this.destroyContext(contextId);
    }
    // 全モジュールをクリア
    this.modules.clear();
    this.moduleInstances.clear();
    this.listeners = [];
  }

  // ─── プライベート ───

  private updateModuleState(moduleId: string, state: ScriptModuleState): void {
    const module = this.modules.get(moduleId);
    if (module) {
      this.modules.set(moduleId, { ...module, state });
    }
  }

  private notifyListeners(event: HotReloadEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * TypeScript → JavaScript トランスパイル
   * ブラウザ内で実行可能なJavaScriptに変換
   */
  private async transpileTypeScript(
    source: string,
    _fileName: string,
  ): Promise<{ code: string; sourceMap?: string; exports: ScriptExport[] }> {
    // TypeScript Compiler API を動的にロード (ブラウザ内トランスパイル)
    // @ts-expect-error -- ts はグローバルまたは動的インポートで取得
    const ts = globalThis.ts ?? (await import('typescript'));

    const result = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget[this.config.compilerOptions.target.toUpperCase() as keyof typeof ts.ScriptTarget] ?? ts.ScriptTarget.ES2022,
        module: ts.ModuleKind[this.config.compilerOptions.module.toUpperCase() as keyof typeof ts.ModuleKind] ?? ts.ModuleKind.ES2020,
        strict: this.config.compilerOptions.strict,
        experimentalDecorators: this.config.compilerOptions.experimentalDecorators,
        sourceMap: this.config.generateSourceMaps,
        declaration: false,
        esModuleInterop: true,
      },
    });

    if (result.diagnostics && result.diagnostics.length > 0) {
      const diag = result.diagnostics[0];
      throw {
        message: ts.flattenDiagnosticMessageText(diag.messageText, '\n'),
        code: diag.code,
        line: diag.file
          ? ts.getLineAndCharacterOfPosition(diag.file, diag.start ?? 0).line + 1
          : undefined,
        column: diag.file
          ? ts.getLineAndCharacterOfPosition(diag.file, diag.start ?? 0).character + 1
          : undefined,
      } satisfies ScriptCompileError;
    }

    // エクスポート解析 (簡易版: export キーワードの検出)
    const exports = this.extractExports(source);

    return {
      code: result.outputText,
      sourceMap: result.sourceMapText,
      exports,
    };
  }

  /** ソースコードからエクスポートを抽出 (簡易パーサー) */
  private extractExports(source: string): ScriptExport[] {
    const exports: ScriptExport[] = [];
    const lines = source.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('export function ')) {
        const match = trimmed.match(/^export\s+function\s+(\w+)/);
        if (match) exports.push({ name: match[1], kind: 'function' });
      } else if (trimmed.startsWith('export class ')) {
        const match = trimmed.match(/^export\s+class\s+(\w+)/);
        if (match) exports.push({ name: match[1], kind: 'class' });
      } else if (trimmed.startsWith('export const ') || trimmed.startsWith('export let ') || trimmed.startsWith('export var ')) {
        const match = trimmed.match(/^export\s+(?:const|let|var)\s+(\w+)/);
        if (match) exports.push({ name: match[1], kind: 'variable' });
      } else if (trimmed.startsWith('export interface ')) {
        const match = trimmed.match(/^export\s+interface\s+(\w+)/);
        if (match) exports.push({ name: match[1], kind: 'interface' });
      }
    }

    return exports;
  }

  private toCompileError(err: unknown): ScriptCompileError {
    if (err && typeof err === 'object' && 'message' in err) {
      return err as ScriptCompileError;
    }
    return { message: String(err) };
  }
}
