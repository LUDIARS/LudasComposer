// === アセンブリ管理型定義 ===
// プログラムをコアアセンブリとアプリケーションアセンブリに分離管理する

/** ビルドターゲットプラットフォーム */
export type BuildTarget = 'webgl' | 'pc';

/** ビルド方式 */
export type BuildMethod = 'typescript-jit' | 'wasm-bundle';

/** ビルドターゲットとビルド方式の対応 */
export interface BuildConfig {
  target: BuildTarget;
  method: BuildMethod;
}

/** プラットフォームごとのデフォルトビルド方式 */
export const DEFAULT_BUILD_CONFIGS: BuildConfig[] = [
  { target: 'webgl', method: 'typescript-jit' },  // WebGL: TypeScript JIT (ホットリロード対応)
  { target: 'pc', method: 'typescript-jit' },      // PC: TypeScript JIT (Tauri webview内実行)
];

// ─────────────────────────────────────────────
// コアアセンブリ
// PictorやErgoから取得した変更頻度が低い使いまわせるコード
// ─────────────────────────────────────────────

/** コアアセンブリの取得元 */
export type CoreAssemblyOrigin = 'pictor' | 'ergo' | 'other';

/** コアアセンブリのアーティファクト種別 */
export type CoreArtifactType = 'source' | 'wasm';

/** コアアセンブリのカスタマイズ状態 */
export type CustomizationStatus = 'original' | 'modified';

/** コアアセンブリ定義 */
export interface CoreAssembly {
  /** 一意識別子 */
  id: string;
  /** 表示名 */
  name: string;
  /** 取得元 (Pictor, Ergo, etc.) */
  origin: CoreAssemblyOrigin;
  /** リリースデポ上のパス/識別子 */
  depotPath: string;
  /** リリースデポのバージョンタグ */
  version: string;
  /** アーティファクト種別 (ソースコード or DLL) */
  artifactType: CoreArtifactType;
  /** カスタマイズ状態 */
  customization: CustomizationStatus;
  /** 方言対応のカスタマイズメモ (modified時のみ) */
  customizationNote?: string;
  /** プロジェクトローカルでのパス */
  localPath?: string;
  /** 対応ビルドターゲット */
  buildTargets: BuildTarget[];
}

// ─────────────────────────────────────────────
// アプリケーションアセンブリ
// ゲーム固有のプログラム。モノリシックで使いまわせないもの
// アプリケーションやシーン別にアセンブリを作成して分散的にビルド
// ─────────────────────────────────────────────

/** アプリケーションアセンブリのスコープ */
export type AssemblyScope = 'application' | 'scene';

/** アプリケーションアセンブリ定義 */
export interface ApplicationAssembly {
  /** 一意識別子 */
  id: string;
  /** 表示名 */
  name: string;
  /** スコープ (アプリケーション全体 or シーン固有) */
  scope: AssemblyScope;
  /** シーンスコープの場合、紐づくシーンID */
  sceneId?: string;
  /** ソースコードのローカルパス */
  sourcePath: string;
  /** 各ターゲットごとのビルド設定 */
  buildConfigs: BuildConfig[];
  /** 依存するコアアセンブリID一覧 */
  coreAssemblyDependencies: string[];
  /** 依存する他のアプリケーションアセンブリID一覧 */
  appAssemblyDependencies: string[];
  /** エントリポイントファイル名 */
  entryPoint?: string;
}

// ─────────────────────────────────────────────
// プロジェクトレベルのアセンブリ管理設定
// ─────────────────────────────────────────────

/** リリースデポ接続設定 */
export interface ReleaseDepotConfig {
  /** デポの名前 */
  name: string;
  /** デポのURL/パス */
  url: string;
  /** 認証トークン (オプション) */
  authToken?: string;
}

/** リソースデポ参照設定 (実体は別システム) */
export interface ResourceDepotRef {
  /** デポの名前 */
  name: string;
  /** デポのURL/パス */
  url: string;
}

/** データオーガナイザー参照設定 (実体は別システム) */
export interface DataOrganizerRef {
  /** オーガナイザーの名前 */
  name: string;
  /** オーガナイザーのURL/パス */
  url: string;
}

/** プロジェクトのアセンブリ管理設定 */
export interface ProjectAssemblyConfig {
  /** リリースデポ設定一覧 */
  releaseDepots: ReleaseDepotConfig[];
  /** コアアセンブリ一覧 */
  coreAssemblies: CoreAssembly[];
  /** アプリケーションアセンブリ一覧 */
  applicationAssemblies: ApplicationAssembly[];
  /** リソースデポ参照 (外部システム) */
  resourceDepotRef?: ResourceDepotRef;
  /** データオーガナイザー参照 (外部システム) */
  dataOrganizerRef?: DataOrganizerRef;
}

/** デフォルトのプロジェクトアセンブリ設定 */
export function createDefaultAssemblyConfig(): ProjectAssemblyConfig {
  return {
    releaseDepots: [],
    coreAssemblies: [],
    applicationAssemblies: [],
  };
}
