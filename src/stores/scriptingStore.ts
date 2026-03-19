/**
 * スクリプティングランタイム Zustand ストア
 * TypeScriptゲームロジックのJITコンパイル・ホットリロード・Emscriptenブリッジを管理
 */
import { create } from 'zustand';
import type {
  ScriptModule,
  JitConfig,
  HotReloadEvent,
  ScriptContext,
} from '../types/scripting';
import type { EmscriptenModule, EmscriptenBridgeConfig } from '../types/emscripten-bridge';
import { ScriptingRuntime } from '../services/scripting-runtime';
import { EmscriptenBridge } from '../services/emscripten-bridge';

interface ScriptingState {
  // === データ ===
  /** スクリプトモジュール一覧 */
  modules: ScriptModule[];
  /** WASMモジュール一覧 */
  wasmModules: EmscriptenModule[];
  /** 実行コンテキスト一覧 */
  contexts: ScriptContext[];
  /** ホットリロードイベント履歴 */
  reloadHistory: HotReloadEvent[];
  /** JIT設定 */
  jitConfig: JitConfig | null;

  // === UI状態 ===
  isCompiling: boolean;
  isLoadingWasm: boolean;
  error: string | null;

  // === ランタイムインスタンス ===
  runtime: ScriptingRuntime | null;
  bridge: EmscriptenBridge | null;

  // === アクション: 初期化 ===
  /** ランタイムを初期化 */
  initRuntime: (config?: Partial<JitConfig>) => void;
  /** Emscriptenブリッジを初期化 */
  initBridge: (config?: Partial<EmscriptenBridgeConfig>) => void;
  /** 全体を破棄 */
  dispose: () => void;

  // === アクション: スクリプトモジュール ===
  /** モジュールを登録 */
  registerModule: (module: Omit<ScriptModule, 'state' | 'exports'>) => void;
  /** モジュールをコンパイル */
  compileModule: (moduleId: string, sourceCode: string) => Promise<void>;
  /** モジュールをロード */
  loadModule: (moduleId: string) => Promise<void>;
  /** モジュールをホットリロード */
  hotReload: (moduleId: string, newSourceCode: string) => Promise<void>;
  /** モジュールをアンロード */
  unloadModule: (moduleId: string) => void;

  // === アクション: WASMモジュール ===
  /** WASMモジュールをロード */
  loadWasmModule: (moduleDef: EmscriptenModule) => Promise<void>;
  /** WASMモジュールをアンロード */
  unloadWasmModule: (moduleId: string) => void;

  // === アクション: コンテキスト ===
  /** シーン用コンテキストを作成 */
  createContext: (sceneId: string) => ScriptContext;
  /** コンテキストを破棄 */
  destroyContext: (contextId: string) => void;
}

export const useScriptingStore = create<ScriptingState>((set, get) => ({
  modules: [],
  wasmModules: [],
  contexts: [],
  reloadHistory: [],
  jitConfig: null,
  isCompiling: false,
  isLoadingWasm: false,
  error: null,
  runtime: null,
  bridge: null,

  initRuntime: (config) => {
    const existing = get().runtime;
    if (existing) existing.dispose();

    const runtime = new ScriptingRuntime(config);

    // ホットリロードイベントを購読
    runtime.onModuleChange((event) => {
      set((state) => ({
        reloadHistory: [...state.reloadHistory.slice(-99), event],
        modules: runtime.getModules(),
      }));
    });

    set({
      runtime,
      jitConfig: runtime.getConfig(),
      modules: [],
      error: null,
    });
  },

  initBridge: (config) => {
    const existing = get().bridge;
    if (existing) existing.dispose();

    const bridge = new EmscriptenBridge(config);
    set({ bridge, wasmModules: [], error: null });
  },

  dispose: () => {
    const { runtime, bridge } = get();
    if (runtime) runtime.dispose();
    if (bridge) bridge.dispose();
    set({
      runtime: null,
      bridge: null,
      modules: [],
      wasmModules: [],
      contexts: [],
      reloadHistory: [],
      jitConfig: null,
      error: null,
    });
  },

  registerModule: (module) => {
    const { runtime } = get();
    if (!runtime) return;

    runtime.registerModule(module);
    set({ modules: runtime.getModules() });
  },

  compileModule: async (moduleId, sourceCode) => {
    const { runtime } = get();
    if (!runtime) return;

    set({ isCompiling: true, error: null });
    try {
      await runtime.compileModule(moduleId, sourceCode);
      set({ modules: runtime.getModules(), isCompiling: false });
    } catch (e) {
      set({ error: String(e), isCompiling: false, modules: runtime.getModules() });
    }
  },

  loadModule: async (moduleId) => {
    const { runtime } = get();
    if (!runtime) return;

    set({ error: null });
    try {
      await runtime.loadModule(moduleId);
      set({ modules: runtime.getModules() });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  hotReload: async (moduleId, newSourceCode) => {
    const { runtime } = get();
    if (!runtime) return;

    set({ isCompiling: true, error: null });
    try {
      await runtime.hotReload(moduleId, newSourceCode);
      set({ modules: runtime.getModules(), isCompiling: false });
    } catch (e) {
      set({ error: String(e), isCompiling: false, modules: runtime.getModules() });
    }
  },

  unloadModule: (moduleId) => {
    const { runtime } = get();
    if (!runtime) return;

    runtime.unloadModule(moduleId);
    set({ modules: runtime.getModules() });
  },

  loadWasmModule: async (moduleDef) => {
    const { bridge } = get();
    if (!bridge) return;

    set({ isLoadingWasm: true, error: null });
    try {
      await bridge.loadModule(moduleDef);
      set({ wasmModules: bridge.getLoadedModules(), isLoadingWasm: false });
    } catch (e) {
      set({ error: String(e), isLoadingWasm: false });
    }
  },

  unloadWasmModule: (moduleId) => {
    const { bridge } = get();
    if (!bridge) return;

    bridge.unloadModule(moduleId);
    set({ wasmModules: bridge.getLoadedModules() });
  },

  createContext: (sceneId) => {
    const { runtime } = get();
    if (!runtime) throw new Error('Runtime not initialized');

    const context = runtime.createContext(sceneId);
    set((state) => ({ contexts: [...state.contexts, context] }));
    return context;
  },

  destroyContext: (contextId) => {
    const { runtime } = get();
    if (!runtime) return;

    runtime.destroyContext(contextId);
    set((state) => ({
      contexts: state.contexts.filter((c) => c.id !== contextId),
    }));
  },
}));
