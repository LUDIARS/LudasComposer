# Native Build 機密情報管理 & モジュール分離設計

## 1. 機密情報管理の提案

### 現状の課題

現在 `.env.example` で管理している機密情報:
- GitHub OAuth (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`)
- AWS DynamoDB (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- サービスURLとポート

GraphDBで管理しようとしているプロジェクト固有の機密情報（API鍵、外部サービス認証情報、ビルド署名鍵など）は、ローカルNative Buildではグラフ構造を必要としない。必要なのは**安全な格納・取得・環境切替**。

### 提案: 3層のシークレット管理

```
┌─────────────────────────────────────────────────────┐
│ Layer 3: CI/CD & Cloud Secrets                      │
│ (GitHub Actions Secrets / AWS SSM Parameter Store)   │
│ → Docker環境・本番デプロイ時のみ                       │
├─────────────────────────────────────────────────────┤
│ Layer 2: プロジェクト固有シークレット                   │
│ (~/.ars/secrets/<project-id>/secrets.toml)           │
│ → プロジェクトごとに分離、暗号化オプション               │
├─────────────────────────────────────────────────────┤
│ Layer 1: OS ネイティブ Keychain                      │
│ (Windows Credential Manager / Linux Secret Service)  │
│ → マスターキー・長期トークンの保管                      │
└─────────────────────────────────────────────────────┘
```

### Layer 1: OS ネイティブ Keychain（マスターキー保管）

長期保存が必要な認証情報（GitHubトークン、AWS認証）を安全に格納。

```
Windows: Credential Manager (DPAPI暗号化)
Linux:   libsecret (GNOME Keyring / KDE Wallet)
macOS:   Keychain (参考)
```

**Rust実装**: `keyring` crate を使用（Windows/Linux/macOS対応済み）

```rust
// src-tauri/src/services/keychain.rs
use keyring::Entry;

pub struct KeychainService {
    service_name: String, // "ars-editor"
}

impl KeychainService {
    pub fn store(&self, key: &str, value: &str) -> Result<()> {
        let entry = Entry::new(&self.service_name, key)?;
        entry.set_password(value)?;
        Ok(())
    }

    pub fn retrieve(&self, key: &str) -> Result<String> {
        let entry = Entry::new(&self.service_name, key)?;
        entry.get_password().map_err(Into::into)
    }
}
```

**格納対象:**
| キー | 用途 |
|------|------|
| `github-oauth-token` | GitHubアクセストークン（現在DynamoDBに平文保存→移行） |
| `aws-access-key-id` | AWS認証（ローカル開発用） |
| `aws-secret-access-key` | AWS認証 |
| `secrets-master-key` | Layer 2 暗号化のマスターキー（オプション） |

### Layer 2: プロジェクト固有シークレット（ローカルファイル）

プロジェクトごとの設定・シークレットを `~/.ars/secrets/` 配下に管理。
**プロジェクトディレクトリ内には一切置かない**（Git混入リスク排除）。

```
~/.ars/
├── secrets/
│   ├── <project-id>/
│   │   ├── secrets.toml        # 機密値
│   │   └── env.toml            # 非機密だがローカル固有の設定
│   └── global/
│       └── secrets.toml        # 全プロジェクト共通の機密値
├── config.toml                 # グローバル設定
└── resource-depot/
    └── depot.json              # 既存
```

**secrets.toml の構造:**

```toml
# ~/.ars/secrets/<project-id>/secrets.toml

[github]
client_id = "Ov23li..."
client_secret = "..."

[aws]
access_key_id = "AKIA..."
secret_access_key = "..."
region = "ap-northeast-1"

[signing]
# Native Build用のコード署名
windows_pfx_path = "C:/certs/ars-signing.pfx"
windows_pfx_password = "keychain:signing-pfx-password"  # Keychainへの参照

[custom]
# プロジェクト固有の任意キー
analytics_api_key = "..."
push_notification_key = "..."
```

**設計ポイント:**
- `keychain:<key-name>` プレフィックスでLayer 1への間接参照が可能
- TOML形式でセクション分けが明確（GraphDBのノード→セクションにマッピング）
- `env.toml` は非機密のローカル環境差分（パス、ポート等）

### Layer 3: CI/CD & Cloud（Docker / GitHub Actions）

既存の `.env.example` + GitHub Actions Secrets + AWS SSM Parameter Store で管理。ローカルNative Buildでは使わない。

### GraphDBとの対応関係

GraphDBでやろうとしていたことが、このファイルベース構造でどう対応するか:

| GraphDBの役割 | 代替手段 |
|---------------|----------|
| シークレットノードの格納 | `secrets.toml` セクション |
| ノード間リレーション（この鍵はこのサービスで使う） | TOMLセクション名 + コメント |
| 環境別の値切替（dev/staging/prod） | `secrets.toml` 内の `[env.dev]` / `[env.prod]` セクション |
| アクセス制御 | OSファイルパーミッション (0600) + Keychain |
| 変更履歴 | 暗号化後に `~/.ars/secrets/` をローカルgitで管理（オプション） |

### Tauri Commandとの統合

```rust
// ars-editor/src-tauri/src/commands/secrets.rs

#[tauri::command]
fn get_project_secret(project_id: &str, section: &str, key: &str) -> Result<String>;

#[tauri::command]
fn set_project_secret(project_id: &str, section: &str, key: &str, value: &str) -> Result<()>;

#[tauri::command]
fn list_secret_sections(project_id: &str) -> Result<Vec<String>>;
```

フロントエンドからは `invoke` でアクセスし、値はRustプロセス内に留まる（WebViewのJSメモリには必要最小限のみ渡す）。

---

## 2. モジュール分離設計

### 現状の分析

現在のArsは以下の機能が `ars-editor` と `src-tauri` に混在している:

| 現在の場所 | 含まれている機能 |
|-----------|----------------|
| `ars-editor/src-tauri/` | エディタUI、OAuth認証、DynamoDB、WebSocket Collab、Git操作、プロジェクトI/O |
| `src-tauri/` | モジュールレジストリ、アセンブリ管理、リソースデポ、モジュールパーサー、Git Clone |
| `ars-editor/src/features/` | 12種類のUIフィーチャー（node-editor, scene-manager, component-picker, etc.） |
| `ars-editor/src/stores/` | エディタ状態、認証、Collab、i18n、プロジェクト、履歴 |

### 分離の方針

**3軸で整理する:**

```
ドメイン (何の領域か)
  × 機能属性 (何をするか)
    × レイヤー (どの層で動くか)
```

### 2.1 ドメイン定義

| ドメインID | ドメイン名 | 説明 |
|-----------|-----------|------|
| `scene` | シーン編集 | Scene/Actor/Component/Connectionの構造編集 |
| `assembly` | アセンブリ | ビルド構成、コア/アプリアセンブリ管理 |
| `module` | モジュールレジストリ | Ergoモジュール定義の発見・解析・キャッシュ |
| `resource` | リソース | アセット管理（モデル、テクスチャ、モーション） |
| `data` | マスターデータ | Blackboard変数、ゲーム設定値 |
| `project` | プロジェクト | プロジェクトファイルI/O、メタデータ |
| `collab` | コラボレーション | WebSocket同期、プレゼンス、ロック |
| `auth` | 認証 | GitHub OAuth、セッション管理 |
| `devops` | 開発運用 | GitHub Issues、通知、CI連携 |
| `docs` | ドキュメント | Markdown閲覧・レンダリング |
| `codegen` | コード生成 | AI支援コード生成、プラットフォーム別出力 |

### 2.2 機能属性

| 属性 | 説明 |
|------|------|
| `core` | ドメインの中核ロジック（ビジネスルール、モデル、バリデーション） |
| `persistence` | 永続化（ファイルI/O、DB、キャッシュ） |
| `transport` | 通信（HTTP、WebSocket、IPC） |
| `presentation` | UI表示（Reactコンポーネント、ストア） |
| `integration` | 外部連携（GitHub API、AWS SDK、Git操作） |

### 2.3 レイヤー

| レイヤー | 技術 | 配置 |
|---------|------|------|
| `rust-lib` | Rust library crate | Cargo workspace member |
| `rust-cmd` | Tauri Command / Axum Handler | ars-editor/src-tauri |
| `ts-store` | Zustand store | ars-editor/src/stores |
| `ts-ui` | React component | ars-editor/src/features |
| `ts-cli` | Node.js CLI | 独立パッケージ |

### 2.4 モジュール一覧と依存関係

```
モジュール構成図（Cargo workspace + npm workspace）

ars-workspace/
├── crates/
│   ├── ars-core/            # [scene] core: ドメインモデル・型定義（Actor, Component, Scene, Connection）
│   ├── ars-project/         # [project] core+persistence: プロジェクトファイルI/O
│   ├── ars-assembly/        # [assembly] core+persistence: ≒現 src-tauri assembly系
│   ├── ars-module-registry/ # [module] core+persistence+integration: ≒現 src-tauri module系
│   ├── ars-resource-depot/  # [resource] core+persistence: ≒現 resource-depot
│   ├── ars-data-organizer/  # [data] core+persistence: ≒現 data-organizer
│   ├── ars-auth/            # [auth] core+integration: OAuth, セッション, Keychain
│   ├── ars-collab/          # [collab] core+transport: WebSocket同期
│   ├── ars-secrets/         # [project] persistence: シークレット管理（Layer1+2）
│   └── ars-git/             # [module,project] integration: Git操作
│
├── apps/
│   ├── ars-editor/          # Tauri Desktop App (presentation layer)
│   │   ├── src-tauri/       # Rust: Tauri Command 薄いグルー層のみ
│   │   └── src/             # React: UI features
│   └── ars-web-server/      # Axum Web Server (transport layer)
│
├── plugins/                 # 外部ソリューション バイパス/プラグイン
│   ├── ars-plugin-unity/    # Unity連携プラグイン
│   ├── ars-plugin-unreal/   # Unreal連携プラグイン
│   ├── ars-plugin-godot/    # Godot連携プラグイン
│   ├── ars-plugin-ergo/     # Ergoコード生成プラグイン
│   └── ars-plugin-pictor/   # Pictorレンダリングプラグイン
│
├── tools/
│   ├── ars-codegen/         # ≒現 ars-codegen（Node.js CLI）
│   └── ars-mcp-server/      # ≒現 mcp-server
│
├── packages/                # 共有TypeScriptパッケージ
│   ├── ars-types/           # ≒現 src/types（共有型定義）
│   └── ars-shared/          # 共有ユーティリティ
│
└── external/
    ├── melpomene/           # [devops] ≒現 melpomene
    ├── terpsichore/         # [devops] ≒現 terpsichore
    └── thaleia/             # [docs] ≒現 thaleia
```

### 2.5 依存関係マトリクス

```
依存の方向: → は「依存する」を意味

ars-core          → (依存なし。純粋なドメインモデル)
ars-project       → ars-core, ars-secrets
ars-assembly      → ars-core
ars-module-registry → ars-core, ars-git
ars-resource-depot → ars-core
ars-data-organizer → ars-core
ars-auth          → ars-secrets
ars-collab        → ars-core
ars-secrets       → (依存なし。keyring crateのみ)
ars-git           → (依存なし。git2 crateのみ)

[Plugin層 - 他crateへの依存なし。traitのみ参照]
ars-plugin-unity  → ars-core (trait: PlatformCodegen)
ars-plugin-ergo   → ars-core (trait: ModuleCodegen)
ars-plugin-pictor → ars-core (trait: RenderPipeline)

[App層 - 全crateを結合]
ars-editor        → ars-core, ars-project, ars-assembly, ars-module-registry,
                     ars-resource-depot, ars-auth, ars-collab, ars-secrets
                     + 選択したplugin

[External - 独立動作、ars-coreのみ参照可]
melpomene         → (独立)
terpsichore       → (独立)
thaleia           → (独立)
```

**依存関係図:**

```
                    ┌─────────────┐
                    │  ars-core   │ ← 全ての起点
                    └──────┬──────┘
           ┌───────┬───────┼───────┬──────────┐
           ▼       ▼       ▼       ▼          ▼
      ars-project  ars-    ars-    ars-    ars-collab
           │      assembly module  resource
           ▼               │ registry
      ars-secrets          ▼
           ▲          ars-git
           │
      ars-auth

      ─── Plugin層 (ars-coreのtraitのみ参照) ───
      ars-plugin-unity
      ars-plugin-unreal
      ars-plugin-godot
      ars-plugin-ergo
      ars-plugin-pictor

      ─── External (独立) ───
      melpomene  terpsichore  thaleia
```

### 2.6 Plugin設計（外部ソリューション連携）

外部ソリューション（Ergo, Pictor, Unity, Unreal, Godot）はプラグインとして完全分離。
**プラグインから他のArsモジュールへの依存は `ars-core` のtrait定義のみ。**

```rust
// crates/ars-core/src/traits/platform.rs

/// プラットフォーム固有のコード生成
pub trait PlatformCodegen: Send + Sync {
    fn platform(&self) -> BackendPlatform;
    fn generate_component(&self, module: &ModuleDefinition) -> Result<GeneratedCode>;
    fn generate_assembly(&self, assembly: &ApplicationAssembly) -> Result<GeneratedCode>;
    fn file_extension(&self) -> &str;
}

/// レンダリングパイプライン連携
pub trait RenderPipeline: Send + Sync {
    fn platform(&self) -> BackendPlatform;
    fn generate_lookdev(&self, config: &LookdevConfig) -> Result<GeneratedCode>;
    fn supported_features(&self) -> Vec<String>;
}

/// Ergoモジュールのコード生成
pub trait ModuleCodegen: Send + Sync {
    fn generate_module(&self, module: &ModuleDefinition, platform: BackendPlatform) -> Result<GeneratedCode>;
    fn generate_message_passing(&self, tasks: &[TaskDefinition]) -> Result<GeneratedCode>;
}
```

```rust
// plugins/ars-plugin-unity/src/lib.rs

pub struct UnityCodegen;

impl PlatformCodegen for UnityCodegen {
    fn platform(&self) -> BackendPlatform { BackendPlatform::Unity }
    fn file_extension(&self) -> &str { ".cs" }
    // ...
}
```

**プラグインのCargo.toml:**

```toml
# plugins/ars-plugin-unity/Cargo.toml
[package]
name = "ars-plugin-unity"

[dependencies]
ars-core = { path = "../../crates/ars-core" }
# ← ars-core以外のarsクレートへの依存は禁止
```

### 2.7 複数ドメインにまたがる機能の扱い

| 機能 | 関連ドメイン | 解決方法 |
|------|-------------|---------|
| プロジェクト保存 | scene + assembly + resource | `ars-project` が各crateの公開APIを呼び出して集約 |
| モジュール→アセンブリ登録 | module + assembly | App層（ars-editor）で結合。crate間は直接依存しない |
| コード生成 | module + assembly + codegen | Plugin trait経由。`ars-plugin-ergo` が `ModuleCodegen` を実装 |
| Collab同期 | collab + scene | `ars-collab` は `ars-core` の型を送受信。scene固有ロジックはApp層 |
| Git Clone → モジュール取得 | module + git | `ars-module-registry` → `ars-git` で依存OK（同一方向） |

### 2.8 フロントエンド（React）のモジュール対応

```
ars-editor/src/
├── features/
│   ├── scene-editor/          # [scene] node-editor + scene-manager 統合
│   │   ├── components/
│   │   │   ├── NodeCanvas.tsx
│   │   │   ├── ActorNode.tsx
│   │   │   ├── GroupNode.tsx
│   │   │   ├── SceneList.tsx
│   │   │   └── ...
│   │   ├── hooks/
│   │   └── store.ts           # scene専用store
│   │
│   ├── component-editor/      # [scene] コンポーネント定義の編集
│   ├── assembly-manager/      # [assembly] ビルド構成管理UI
│   ├── module-browser/        # [module] モジュールレジストリUI
│   ├── resource-depot/        # [resource] アセットブラウザ
│   ├── data-organizer/        # [data] マスターデータUI
│   ├── collab/                # [collab] プレゼンス表示・カーソル
│   ├── auth/                  # [auth] ログインUI
│   └── preview/               # [scene] プレビューレンダラ
│
├── stores/
│   ├── sceneStore.ts          # [scene] Actor/Component/Connection状態
│   ├── projectStore.ts        # [project] プロジェクトメタ
│   ├── authStore.ts           # [auth] セッション
│   ├── collabStore.ts         # [collab] WebSocket
│   └── i18nStore.ts           # 横断: i18n
│
└── types/                     # packages/ars-types から import
```

### 2.9 移行優先順位

現状からの段階的な移行:

**Phase 1: crate分離（Rust）**
1. `ars-core` 抽出: `src-tauri/src/models/` → 独立crate
2. `ars-secrets` 新設: シークレット管理
3. `ars-git` 抽出: `git_clone.rs` + `git_ops.rs` → 独立crate

**Phase 2: 機能crate分離**
4. `ars-assembly` 抽出: assembly系のservice/command/model
5. `ars-module-registry` 抽出: module系のservice/command/model
6. `ars-auth` 抽出: OAuth + DynamoDB + Keychain統合

**Phase 3: Plugin化**
7. `ars-plugin-*` 作成: `BackendPlatform` ごとの実装を分離
8. `ars-plugin-ergo` / `ars-plugin-pictor` 作成

**Phase 4: アプリ層スリム化**
9. `ars-editor/src-tauri` → 薄いグルー層のみに
10. `ars-web-server` → 独立バイナリに（現在は feature gate）

---

## 3. Native Build構成（統合）

上記モジュール分離後のNative Buildフロー:

```toml
# Cargo.toml (workspace root)
[workspace]
members = [
    "crates/ars-core",
    "crates/ars-project",
    "crates/ars-assembly",
    "crates/ars-module-registry",
    "crates/ars-resource-depot",
    "crates/ars-data-organizer",
    "crates/ars-auth",
    "crates/ars-collab",
    "crates/ars-secrets",
    "crates/ars-git",
    "plugins/ars-plugin-unity",
    "plugins/ars-plugin-unreal",
    "plugins/ars-plugin-godot",
    "plugins/ars-plugin-ergo",
    "plugins/ars-plugin-pictor",
    "apps/ars-editor/src-tauri",
    "apps/ars-web-server",
    "external/melpomene/src-tauri",
    "external/terpsichore/src-tauri",
    "external/thaleia/src-tauri",
]
```

```bash
# Windows Native Build
cargo tauri build --target x86_64-pc-windows-msvc

# Linux Native Build
cargo tauri build --target x86_64-unknown-linux-gnu

# 特定プラグインのみ有効化
cargo tauri build --features "plugin-unity,plugin-pictor"
```

シークレットは `~/.ars/secrets/<project-id>/secrets.toml` から自動読み込み。ビルド署名鍵はKeychain経由でアクセス。

---

## 4. Native Build 運用設計（ars-native）

### 4.1 Phase A: ローカルビルド運用

#### 前提

- 対象: ars-native（Tauri Desktop）のみ
- 配布先: 開発チーム内 or 自分自身
- 署名: オプション（社内配布なら不要な場合も）

#### ビルドコマンド体系

```bash
# 開発（ホットリロード）
npm run tauri dev

# デバッグビルド（署名なし、高速）
npm run tauri build -- --debug

# リリースビルド（最適化あり）
npm run tauri build
```

#### 成果物マトリクス

| OS | 形式 | パス | 用途 |
|----|------|------|------|
| Windows | `.msi` | `target/release/bundle/msi/` | 企業配布（GPO対応） |
| Windows | `.exe` (NSIS) | `target/release/bundle/nsis/` | 個人インストール |
| Linux | `.deb` | `target/release/bundle/deb/` | Debian/Ubuntu |
| Linux | `.AppImage` | `target/release/bundle/appimage/` | ポータブル |
| Linux | `.rpm` | `target/release/bundle/rpm/` | Fedora/RHEL（要追加設定） |

#### tauri.conf.json の改善

```jsonc
{
  "productName": "Ars Editor",
  "version": "0.1.0",
  "identifier": "dev.ludiars.ars-editor",  // ← com.tauri.dev から変更
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [/* ... */],
    "resources": [],
    "windows": {
      "certificateThumbprint": null,       // Phase B で設定
      "digestAlgorithm": "sha256",
      "wix": {
        "language": ["ja-JP", "en-US"]
      }
    },
    "linux": {
      "deb": {
        "depends": [
          "libwebkit2gtk-4.1-0",
          "libgtk-3-0"
        ],
        "section": "devel",
        "priority": "optional"
      },
      "appimage": {
        "bundleMediaFramework": false
      }
    }
  },
  "plugins": {
    "updater": {
      "active": false,                     // Phase B で有効化
      "pubkey": "",
      "endpoints": []
    }
  }
}
```

#### ローカルビルド時のシークレット解決フロー

```
npx tauri build
    │
    ▼
[Rust build.rs / ランタイム初期化]
    │
    ├── ~/.ars/config.toml からプロジェクトID特定
    │
    ├── ~/.ars/secrets/<project-id>/env.toml 読み込み
    │   └── 非機密設定（APIエンドポイントURL、ポート等）
    │
    ├── ~/.ars/secrets/<project-id>/secrets.toml 読み込み
    │   └── 機密値（API鍵、署名パスワード等）
    │        └── "keychain:xxx" → OS Keychain で解決
    │
    └── 環境変数でオーバーライド可能
        └── ARS_SECRET_<SECTION>_<KEY>=value
```

**重要**: ビルド時に機密値をバイナリに埋め込まない。ランタイムで `~/.ars/` から読み込む。

#### プロジェクトとビルドの紐付け

```toml
# <project-dir>/ars-project.toml（プロジェクトルートに配置、Git管理対象）
[project]
id = "my-game-project"
name = "My Game"

[build]
platform = "ars-native"

[build.targets]
windows = { enabled = true, arch = "x86_64" }
linux = { enabled = true, arch = "x86_64" }
```

```toml
# ~/.ars/secrets/my-game-project/env.toml（ローカルのみ、Git管理外）
[paths]
resource_depot = "/home/user/assets/my-game"
data_organizer_url = "http://localhost:5175"

[build]
parallel_jobs = 8
```

---

### 4.2 Phase B: CI/CD Native Build

#### GitHub Actions ワークフロー

```yaml
# .github/workflows/native-build.yml
name: Native Build

on:
  push:
    tags:
      - 'v*'          # タグプッシュでリリースビルド
  workflow_dispatch:    # 手動トリガーも可能
    inputs:
      target:
        description: 'Build target'
        type: choice
        options:
          - all
          - windows
          - linux

permissions:
  contents: write      # GitHub Releases へのアップロード

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: windows-latest
            target: x86_64-pc-windows-msvc
            bundle: "msi,nsis"
          - platform: ubuntu-22.04
            target: x86_64-unknown-linux-gnu
            bundle: "deb,appimage"

    runs-on: ${{ matrix.platform }}
    timeout-minutes: 60

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
          cache-dependency-path: ars-editor/package-lock.json

      - uses: dtolnay/rust-toolchain@stable

      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: ars-editor/src-tauri -> target

      - name: Install Linux dependencies
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
            librsvg2-dev patchelf

      - name: Install frontend dependencies
        working-directory: ars-editor
        run: npm ci

      - name: Build (Tauri)
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # Windows コード署名（オプション）
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          projectPath: ars-editor
          tagName: ${{ github.ref_name }}
          releaseName: 'Ars Editor ${{ github.ref_name }}'
          releaseBody: 'Native build for ${{ github.ref_name }}'
          releaseDraft: true
          prerelease: false
          args: --target ${{ matrix.target }}
```

#### CI用シークレット（GitHub Actions Secrets）

| Secret名 | 用途 | 必須 |
|-----------|------|------|
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri Updater署名鍵 | Updater有効時 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 署名鍵パスワード | 同上 |
| `WINDOWS_CERTIFICATE` | Windows Authenticode証明書 (Base64) | 配布時 |
| `WINDOWS_CERTIFICATE_PASSWORD` | 証明書パスワード | 同上 |

#### リリースフロー

```
feature branch → PR → main merge
                          │
                     tag v0.2.0 push
                          │
                ┌─────────┼─────────┐
                ▼                   ▼
         windows-latest       ubuntu-22.04
         (MSI + NSIS)         (deb + AppImage)
                │                   │
                └─────────┬─────────┘
                          ▼
                  GitHub Release (Draft)
                          │
                     手動で Publish
                          │
                  Tauri Updater JSON 更新
                  (→ アプリ内自動更新通知)
```

#### Tauri Updater 設定（Phase B後半）

```jsonc
// tauri.conf.json
{
  "plugins": {
    "updater": {
      "active": true,
      "dialog": true,
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ...",
      "endpoints": [
        "https://github.com/LUDIARS/Ars/releases/latest/download/latest.json"
      ]
    }
  }
}
```

GitHub Releases にアップロードされる `latest.json` の例:

```json
{
  "version": "0.2.0",
  "notes": "Bug fixes and performance improvements",
  "pub_date": "2026-03-22T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "...",
      "url": "https://github.com/LUDIARS/Ars/releases/download/v0.2.0/Ars-Editor_0.2.0_x64-setup.nsis.zip"
    },
    "linux-x86_64": {
      "signature": "...",
      "url": "https://github.com/LUDIARS/Ars/releases/download/v0.2.0/Ars-Editor_0.2.0_amd64.AppImage.tar.gz"
    }
  }
}
```

---

### 4.3 バージョニング戦略

```
v<major>.<minor>.<patch>[-<pre>]

例:
  v0.1.0        初回リリース
  v0.2.0-beta   Phase B テスト
  v0.2.0        Phase B 正式
  v1.0.0        モジュール分離完了後の安定版
```

バージョンの変更箇所:
- `ars-editor/src-tauri/tauri.conf.json` → `version`
- `ars-editor/package.json` → `version`
- 各 `Cargo.toml` → `version`（workspace版で統一）

自動化: `cargo-release` または Tauri の `before-build` hook でバージョン同期。

---

### 4.4 モジュール分離との関係

| Phase | モジュール状態 | Native Build への影響 |
|-------|--------------|---------------------|
| 現状 | monolith（feature gate） | ビルドは単純だが、全依存が入る |
| Module Phase 1 | `ars-core` 分離 | ビルドは変わらない。crate分離のみ |
| Module Phase 2 | 機能crate分離 | **Cargo workspace化が必要**。CI設定更新 |
| Module Phase 3 | Plugin化 | feature flagでPlugin選択。CI matrix拡張 |
| Module Phase 4 | App層スリム化 | ars-editor のビルド時間短縮。web-server独立 |

**注意**: Module Phase 2 でCargo workspaceに移行する際、CI/CDのワークフローとrust-cache設定を同時に更新する必要がある。

---

### 4.5 まとめ: ロードマップ

```
現在
 │  Phase A-1: tauri.conf.json修正（identifier, bundle設定）
 │  Phase A-2: ars-secrets crate新設 + ~/.ars/ ディレクトリ構造
 │  Phase A-3: ローカルビルドの手順ドキュメント整備
 │
 ▼
Module Phase 1-2（crate分離）
 │  Phase B-1: CI workflow追加（native-build.yml）
 │  Phase B-2: tauri-action でWindows/Linuxビルド自動化
 │  Phase B-3: GitHub Releases へのアーティファクト自動アップロード
 │
 ▼
Module Phase 3（Plugin化）
 │  Phase B-4: コード署名設定（Windows Authenticode）
 │  Phase B-5: Tauri Updater有効化（アプリ内自動更新）
 │
 ▼
安定版 v1.0.0
```

---

## 5. 永続化バックエンドの抽象化（Repository層）

### 5.1 現状の問題

```
tauri-app (ネイティブ)              web-server (Docker/Web)
──────────────────────              ────────────────────────
Project:  ローカルJSON               Project:  DynamoDB
Auth:     なし                       Auth:     GitHub OAuth + DynamoDB
User:     なし (シングルユーザー)     User:     DynamoDB (マルチユーザー)
Settings: なし                       Settings: 環境変数のみ
```

- ネイティブビルドにもプロジェクト設定・ユーザー設定・アセンブリ構成の永続化が必要
- しかしDynamoDBを必須にするとローカル開発が面倒になる
- web-server側は既にDynamoDBに依存している
- **同一のアプリケーションロジックに対して、永続化バックエンドを差し替え可能にする必要がある**

### 5.2 Repository trait パターン

```rust
// crates/ars-core/src/repository.rs

/// プロジェクト永続化の抽象
#[async_trait::async_trait]
pub trait ProjectRepository: Send + Sync {
    async fn save(&self, user_id: &str, project_id: &str, project: &Project) -> Result<()>;
    async fn load(&self, user_id: &str, project_id: &str) -> Result<Option<Project>>;
    async fn list(&self, user_id: &str) -> Result<Vec<ProjectSummary>>;
    async fn delete(&self, user_id: &str, project_id: &str) -> Result<()>;
}

/// ユーザー永続化の抽象
#[async_trait::async_trait]
pub trait UserRepository: Send + Sync {
    async fn put_user(&self, user: &User) -> Result<()>;
    async fn get_user(&self, user_id: &str) -> Result<Option<User>>;
    async fn get_user_by_provider_id(&self, provider: &str, id: &str) -> Result<Option<User>>;
}

/// セッション永続化の抽象
#[async_trait::async_trait]
pub trait SessionRepository: Send + Sync {
    async fn put_session(&self, session: &Session) -> Result<()>;
    async fn get_session(&self, session_id: &str) -> Result<Option<Session>>;
    async fn delete_session(&self, session_id: &str) -> Result<()>;
}

/// アセンブリ設定の永続化
#[async_trait::async_trait]
pub trait AssemblyConfigRepository: Send + Sync {
    async fn save(&self, project_id: &str, config: &ProjectAssemblyConfig) -> Result<()>;
    async fn load(&self, project_id: &str) -> Result<Option<ProjectAssemblyConfig>>;
}
```

### 5.3 実装: ネイティブ用（ローカルファイル）

```rust
// crates/ars-project/src/local_repo.rs

/// ローカルファイルシステムベースの実装
/// ~/.ars/projects/<project-id>/ にJSON保存
pub struct LocalProjectRepository {
    base_dir: PathBuf,  // ~/.ars/projects/
}

#[async_trait::async_trait]
impl ProjectRepository for LocalProjectRepository {
    async fn save(&self, _user_id: &str, project_id: &str, project: &Project) -> Result<()> {
        let path = self.base_dir.join(project_id).join("project.json");
        fs::create_dir_all(path.parent().unwrap())?;
        let json = serde_json::to_string_pretty(project)?;
        fs::write(&path, json)?;
        Ok(())
    }

    async fn load(&self, _user_id: &str, project_id: &str) -> Result<Option<Project>> {
        let path = self.base_dir.join(project_id).join("project.json");
        if !path.exists() { return Ok(None); }
        let content = fs::read_to_string(&path)?;
        Ok(Some(serde_json::from_str(&content)?))
    }

    // ...
}

/// ネイティブはシングルユーザー。固定IDで返す。
pub struct LocalUserRepository {
    config_path: PathBuf,  // ~/.ars/user.toml
}

#[async_trait::async_trait]
impl UserRepository for LocalUserRepository {
    async fn get_user(&self, _user_id: &str) -> Result<Option<User>> {
        // ローカルの user.toml から読み取り
        // GitHub連携していれば GitHub 情報、なければローカルユーザー
        todo!()
    }
    // ...
}

/// ネイティブはセッション不要だが、GitHub token管理に使う
pub struct LocalSessionRepository {
    keychain: KeychainService,
}
```

### 5.4 実装: Web用（DynamoDB）

```rust
// crates/ars-auth/src/dynamo_repo.rs

/// 既存の DynamoClient をラップ
pub struct DynamoProjectRepository {
    client: DynamoClient,
}

#[async_trait::async_trait]
impl ProjectRepository for DynamoProjectRepository {
    async fn save(&self, user_id: &str, project_id: &str, project: &Project) -> Result<()> {
        self.client.save_project(user_id, project_id, project).await
    }
    // ... 既存のdynamo.rsの実装をそのまま委譲
}
```

### 5.5 DI（依存注入）の配線

```rust
// apps/ars-editor/src-tauri/src/main.rs (ネイティブ)

fn main() {
    let base_dir = dirs::home_dir().unwrap().join(".ars");

    // ネイティブ: ローカルファイル実装を注入
    let project_repo: Arc<dyn ProjectRepository> =
        Arc::new(LocalProjectRepository::new(base_dir.join("projects")));
    let user_repo: Arc<dyn UserRepository> =
        Arc::new(LocalUserRepository::new(base_dir.join("user.toml")));
    let assembly_repo: Arc<dyn AssemblyConfigRepository> =
        Arc::new(LocalAssemblyConfigRepository::new(base_dir.join("assemblies")));

    tauri::Builder::default()
        .manage(project_repo)
        .manage(user_repo)
        .manage(assembly_repo)
        .invoke_handler(tauri::generate_handler![/* ... */])
        .run(tauri::generate_context!())
        .expect("error");
}
```

```rust
// apps/ars-web-server/src/main.rs (Web)

#[tokio::main]
async fn main() {
    // Web: DynamoDB実装を注入
    let dynamo = DynamoClient::new().await;
    let project_repo: Arc<dyn ProjectRepository> =
        Arc::new(DynamoProjectRepository::new(dynamo.clone()));
    let user_repo: Arc<dyn UserRepository> =
        Arc::new(DynamoUserRepository::new(dynamo.clone()));

    let state = AppState { project_repo, user_repo, /* ... */ };
    // ...
}
```

### 5.6 Tauri Command / Axum Handler の共通化

```rust
// crates/ars-project/src/use_cases.rs
//
// ユースケース層: Repository trait に依存。具体実装を知らない。

pub async fn save_project(
    repo: &dyn ProjectRepository,
    user_id: &str,
    project_id: &str,
    project: &Project,
) -> Result<()> {
    // バリデーション、ビジネスルール
    if project.name.is_empty() {
        return Err(anyhow!("Project name is required"));
    }
    repo.save(user_id, project_id, project).await
}
```

```rust
// apps/ars-editor/src-tauri/src/commands.rs (Tauri側 - 薄いグルー)

#[tauri::command]
async fn save_project(
    repo: State<'_, Arc<dyn ProjectRepository>>,
    project_id: String,
    project: Project,
) -> Result<(), String> {
    let user_id = "local";  // ネイティブはシングルユーザー
    ars_project::use_cases::save_project(repo.as_ref(), user_id, &project_id, &project)
        .await
        .map_err(|e| e.to_string())
}
```

```rust
// apps/ars-web-server/src/handlers.rs (Axum側 - 薄いグルー)

async fn api_save_project(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<SaveRequest>,
) -> Result<Json<()>, (StatusCode, String)> {
    let user = auth::extract_user(&state, &jar).await?;
    ars_project::use_cases::save_project(
        state.project_repo.as_ref(), &user.id, &req.project_id, &req.project
    )
    .await
    .map(Json)
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}
```

### 5.7 レイヤー構成図

```
┌───────────────────────────────────────────────────────────┐
│ Transport (薄いグルー)                                     │
│  ├─ Tauri Command   → user_id = "local"                  │
│  └─ Axum Handler    → user_id = auth::extract_user()     │
├───────────────────────────────────────────────────────────┤
│ Use Case (crates/ars-project/src/use_cases.rs)            │
│  └─ ビジネスロジック、バリデーション                         │
│     引数: &dyn ProjectRepository                          │
├───────────────────────────────────────────────────────────┤
│ Repository trait (crates/ars-core/src/repository.rs)      │
│  └─ async fn save / load / list / delete                  │
├──────────────────┬────────────────────────────────────────┤
│ LocalRepo        │  DynamoRepo                            │
│ (ars-project)    │  (ars-auth)                            │
│ ~/.ars/ JSON     │  AWS DynamoDB                          │
│ + Keychain       │  + 環境変数                             │
└──────────────────┴────────────────────────────────────────┘
```

### 5.8 ネイティブ固有: ~/.ars/ ディレクトリ構造（更新）

```
~/.ars/
├── config.toml                        # グローバル設定
├── user.toml                          # ローカルユーザー情報
├── projects/
│   ├── <project-id>/
│   │   ├── project.json               # ≒ DynamoDB の projects テーブル
│   │   └── assembly.config.json       # ≒ 現 assembly.config.json
│   └── ...
├── secrets/
│   ├── <project-id>/
│   │   ├── secrets.toml               # 機密値
│   │   └── env.toml                   # 非機密ローカル設定
│   └── global/
│       └── secrets.toml               # 共通機密値
├── module-cache/                      # モジュールレジストリキャッシュ
└── resource-depot/
    └── depot.json                     # 既存
```

### 5.9 移行パス: 既存コードからの変換

| 現在のファイル | 変換先 | 作業内容 |
|-------------|--------|---------|
| `dynamo.rs` (DynamoClient) | `ars-auth/src/dynamo_repo.rs` | Repository trait 実装でラップ |
| `commands/project.rs` (ファイルI/O) | `ars-project/src/local_repo.rs` | Repository trait 実装でラップ |
| `commands/project.rs` (use case) | `ars-project/src/use_cases.rs` | トランスポート非依存のユースケース抽出 |
| `app_state.rs` (AppState) | 各アプリのエントリポイント | DI配線のみ |
| `auth.rs` (OAuth) | `ars-auth/src/oauth.rs` | web-server専用のまま。ネイティブは不要 |
| `assembly_manager.rs` | `ars-assembly/src/` | AssemblyConfigRepository経由に |

### 5.10 ネイティブで不要なもの / Web専用のもの

| 機能 | ネイティブ | Web | 理由 |
|------|----------|-----|------|
| GitHub OAuth | 不要 | 必須 | ネイティブはOS Keychainでトークン管理 |
| DynamoDB | 不要 | 必須 | ネイティブはローカルJSON |
| Session管理 | 不要 | 必須 | シングルユーザー |
| CORS設定 | 不要 | 必須 | 同一プロセス |
| WebSocket Collab | 将来対応 | 対応済み | ネイティブ同士の同期は別途検討 |
| Git操作 | 対応 | 対応 | 両方で使う（`ars-git` crate共通） |

これらは feature flag ではなく **バイナリレベルで分離** する（ars-editor と ars-web-server が別バイナリ）。

---

## 6. モジュール インタフェース設計 & ライフサイクル

### 6.1 現状の問題

```rust
// 現状: 全サービスがアプリ起動時に一括初期化
pub fn run() {
    let registry_service = ModuleRegistryService::with_defaults()...;
    let assembly_service = AssemblyManagerService::load(current_dir())...;
    let depot_service = ResourceDepotService::new(depot_file)...;

    tauri::Builder::default()
        .manage(Mutex::new(registry_service))   // ← プロジェクト未定なのに初期化
        .manage(Mutex::new(assembly_service))    // ← current_dir() に依存
        .manage(Mutex::new(depot_service))
        // ...
}
```

| 問題 | 影響 |
|------|------|
| プロジェクト開閉の概念がない | AssemblyManagerが`current_dir()`に固定。プロジェクト切替不可 |
| 全モジュール起動時一括初期化 | 使わないモジュールも初期化。起動が重くなる |
| シャットダウン処理なし | 未保存データの確認、キャッシュのフラッシュ、ロック解放が漏れる |
| モジュール間の初期化順序が暗黙 | AssemblyManager → ResourceDepot の依存順序がコードで保証されない |
| フロントエンドと独立に進化できない | Tauri Command が直接サービスを呼ぶ密結合 |

### 6.2 2つのスコープ

エディタのモジュールには **アプリスコープ** と **プロジェクトスコープ** がある。

```
App Launch
 │
 ├─ [App-scoped] 認証、グローバル設定、モジュールレジストリキャッシュ
 │   ← アプリ終了まで生存
 │
 ├─ Project Open ("my-game")
 │   │
 │   ├─ [Project-scoped] アセンブリ管理、リソースデポ、データオーガナイザー、Collab
 │   │   ← プロジェクト閉じるまで生存
 │   │
 │   ├─ (ユーザーが作業)
 │   │
 │   └─ Project Close
 │       └─ 保存確認 → キャッシュフラッシュ → ロック解放 → 破棄
 │
 ├─ Project Open ("another-game")  ← 別プロジェクト開いても App-scoped は生きている
 │   └─ ...
 │
 └─ App Quit
     └─ App-scoped モジュール破棄
```

### 6.3 モジュール trait 設計

```rust
// crates/ars-core/src/module.rs

use async_trait::async_trait;
use std::any::Any;

/// モジュールのメタ情報
pub struct ModuleInfo {
    pub id: &'static str,        // "assembly", "resource-depot", etc.
    pub name: &'static str,      // 表示名
    pub scope: ModuleScope,
    pub depends_on: &'static [&'static str],  // 初期化順序の依存
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ModuleScope {
    /// アプリ起動〜終了まで
    App,
    /// プロジェクト Open〜Close まで
    Project,
}

/// App-scoped モジュール
#[async_trait]
pub trait AppModule: Send + Sync + Any {
    /// メタ情報
    fn info(&self) -> ModuleInfo;

    /// アプリ起動時に呼ばれる。グローバルリソースの初期化。
    async fn initialize(&mut self) -> Result<()>;

    /// アプリ終了時に呼ばれる。クリーンアップ。
    async fn shutdown(&mut self) -> Result<()>;

    /// ダウンキャスト用
    fn as_any(&self) -> &dyn Any;
}

/// Project-scoped モジュール
#[async_trait]
pub trait ProjectModule: Send + Sync + Any {
    /// メタ情報
    fn info(&self) -> ModuleInfo;

    /// プロジェクトを開いた時に呼ばれる。
    /// project_root: プロジェクトのルートディレクトリ
    /// project_id: プロジェクトの識別子
    async fn on_project_open(&mut self, project_root: &Path, project_id: &str) -> Result<()>;

    /// プロジェクトを閉じる時に呼ばれる。
    /// 未保存データがあれば Err(ArsError::UnsavedChanges) を返してもよい。
    async fn on_project_close(&mut self) -> Result<()>;

    /// プロジェクト保存時に呼ばれる（自分の管理データを永続化するチャンス）
    async fn on_project_save(&mut self) -> Result<()>;

    /// ダウンキャスト用
    fn as_any(&self) -> &dyn Any;
}
```

### 6.4 各モジュールの分類

| モジュール | スコープ | depends_on | 初期化タイミング |
|-----------|---------|------------|----------------|
| `auth` | App | `[]` | アプリ起動直後 |
| `secrets` | App | `["auth"]` | auth の後 |
| `module-registry` | App | `[]` | アプリ起動直後（キャッシュ読み込み） |
| `assembly` | Project | `[]` | プロジェクト Open |
| `resource-depot` | Project | `[]` | プロジェクト Open |
| `data-organizer` | Project | `[]` | プロジェクト Open |
| `collab` | Project | `["auth"]` | プロジェクト Open（認証済みユーザー情報が必要） |
| `git` | App | `["auth"]` | アプリ起動時（トークン取得のためauthが先） |

### 6.5 ModuleHost（モジュール管理者）

```rust
// crates/ars-core/src/module_host.rs

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// モジュールのライフサイクルを管理するホスト
pub struct ModuleHost {
    app_modules: HashMap<&'static str, Arc<RwLock<dyn AppModule>>>,
    project_modules: HashMap<&'static str, Arc<RwLock<dyn ProjectModule>>>,
    active_project: Option<String>,
}

impl ModuleHost {
    pub fn new() -> Self {
        Self {
            app_modules: HashMap::new(),
            project_modules: HashMap::new(),
            active_project: None,
        }
    }

    /// App-scoped モジュールを登録
    pub fn register_app_module(&mut self, module: impl AppModule + 'static) {
        let id = module.info().id;
        self.app_modules.insert(id, Arc::new(RwLock::new(module)));
    }

    /// Project-scoped モジュールを登録
    pub fn register_project_module(&mut self, module: impl ProjectModule + 'static) {
        let id = module.info().id;
        self.project_modules.insert(id, Arc::new(RwLock::new(module)));
    }

    /// アプリ起動: depends_on 順にソートして initialize
    pub async fn startup(&self) -> Result<()> {
        let sorted = topo_sort_modules(&self.app_modules);
        for id in sorted {
            if let Some(m) = self.app_modules.get(id) {
                m.write().await.initialize().await?;
            }
        }
        Ok(())
    }

    /// プロジェクトを開く
    pub async fn open_project(&mut self, project_root: &Path, project_id: &str) -> Result<()> {
        // 既にプロジェクトが開いていたら閉じる
        if self.active_project.is_some() {
            self.close_project().await?;
        }
        // depends_on 順にソートして on_project_open
        let sorted = topo_sort_project_modules(&self.project_modules);
        for id in sorted {
            if let Some(m) = self.project_modules.get(id) {
                m.write().await.on_project_open(project_root, project_id).await?;
            }
        }
        self.active_project = Some(project_id.to_string());
        Ok(())
    }

    /// プロジェクトを閉じる
    pub async fn close_project(&mut self) -> Result<()> {
        // 逆順で on_project_close
        let sorted = topo_sort_project_modules(&self.project_modules);
        for id in sorted.iter().rev() {
            if let Some(m) = self.project_modules.get(id) {
                m.write().await.on_project_close().await?;
            }
        }
        self.active_project = None;
        Ok(())
    }

    /// プロジェクト保存
    pub async fn save_project(&self) -> Result<()> {
        for (_, m) in &self.project_modules {
            m.write().await.on_project_save().await?;
        }
        Ok(())
    }

    /// アプリ終了
    pub async fn shutdown(&self) -> Result<()> {
        // まずプロジェクトを閉じる（開いていれば）
        // 次に逆順で App モジュールを shutdown
        let sorted = topo_sort_modules(&self.app_modules);
        for id in sorted.iter().rev() {
            if let Some(m) = self.app_modules.get(id) {
                m.write().await.shutdown().await?;
            }
        }
        Ok(())
    }

    /// 特定の App モジュールを取得（ダウンキャスト）
    pub fn get_app_module<T: AppModule + 'static>(&self, id: &str) -> Option<Arc<RwLock<dyn AppModule>>> {
        self.app_modules.get(id).cloned()
    }

    /// 特定の Project モジュールを取得
    pub fn get_project_module(&self, id: &str) -> Option<Arc<RwLock<dyn ProjectModule>>> {
        self.project_modules.get(id).cloned()
    }
}
```

### 6.6 具体例: AssemblyModule の実装

```rust
// crates/ars-assembly/src/module.rs

use ars_core::module::{ModuleInfo, ModuleScope, ProjectModule};

pub struct AssemblyModule {
    service: Option<AssemblyManagerService>,
}

impl AssemblyModule {
    pub fn new() -> Self {
        Self { service: None }
    }

    /// 外部からサービスにアクセス
    pub fn service(&self) -> Option<&AssemblyManagerService> {
        self.service.as_ref()
    }
}

#[async_trait]
impl ProjectModule for AssemblyModule {
    fn info(&self) -> ModuleInfo {
        ModuleInfo {
            id: "assembly",
            name: "Assembly Manager",
            scope: ModuleScope::Project,
            depends_on: &[],
        }
    }

    async fn on_project_open(&mut self, project_root: &Path, _project_id: &str) -> Result<()> {
        self.service = Some(
            AssemblyManagerService::load(project_root.to_path_buf())
                .unwrap_or_else(|_| AssemblyManagerService::new(project_root.to_path_buf()))
        );
        Ok(())
    }

    async fn on_project_close(&mut self) -> Result<()> {
        // 設定を保存してからドロップ
        if let Some(ref service) = self.service {
            service.save()?;
        }
        self.service = None;
        Ok(())
    }

    async fn on_project_save(&mut self) -> Result<()> {
        if let Some(ref service) = self.service {
            service.save()?;
        }
        Ok(())
    }

    fn as_any(&self) -> &dyn std::any::Any { self }
}
```

### 6.7 具体例: AuthModule (App-scoped)

```rust
// crates/ars-auth/src/module.rs

pub struct AuthModule {
    session_repo: Arc<dyn SessionRepository>,
    user_repo: Arc<dyn UserRepository>,
    current_session: Option<Session>,
    current_user: Option<User>,
}

#[async_trait]
impl AppModule for AuthModule {
    fn info(&self) -> ModuleInfo {
        ModuleInfo {
            id: "auth",
            name: "Authentication",
            scope: ModuleScope::App,
            depends_on: &[],
        }
    }

    async fn initialize(&mut self) -> Result<()> {
        // アプリ起動時: ローカルセッションを復元
        // → 同一PCで永続利用、再認証不要
        if let Some(session) = self.session_repo.get_active().await? {
            let user = self.user_repo.get(&session.user_id).await?;
            self.current_session = Some(session);
            self.current_user = user;
        }
        Ok(())
    }

    async fn shutdown(&mut self) -> Result<()> {
        // セッションはローカル永続なので何もしない
        Ok(())
    }

    fn as_any(&self) -> &dyn std::any::Any { self }
}
```

### 6.8 エディタ（Tauri / Axum）との統合

```rust
// apps/ars-editor/src-tauri/src/lib.rs

pub fn run() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let host = rt.block_on(async {
        let mut host = ModuleHost::new();

        // App-scoped モジュール登録
        let session_repo = Arc::new(LocalSessionRepository::with_defaults().unwrap());
        let user_repo = Arc::new(LocalUserRepository::with_defaults().unwrap());
        host.register_app_module(AuthModule::new(session_repo, user_repo));
        host.register_app_module(ModuleRegistryModule::new());

        // Project-scoped モジュール登録
        host.register_project_module(AssemblyModule::new());
        host.register_project_module(ResourceDepotModule::new());
        host.register_project_module(DataOrganizerModule::new());
        host.register_project_module(CollabModule::new());

        // App起動
        host.startup().await.expect("Module startup failed");
        host
    });

    let host = Arc::new(RwLock::new(host));

    tauri::Builder::default()
        .manage(host.clone())
        .invoke_handler(tauri::generate_handler![
            cmd_open_project,
            cmd_close_project,
            cmd_save_project,
            // Assembly commands
            cmd_get_assembly_config,
            cmd_add_core_assembly,
            // ...
        ])
        .on_window_event(move |_window, event| {
            // ウィンドウ閉じる時にshutdown
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let host = host.clone();
                tokio::spawn(async move {
                    let h = host.read().await;
                    let _ = h.shutdown().await;
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error");
}
```

```rust
// apps/ars-editor/src-tauri/src/commands.rs

#[tauri::command]
async fn cmd_open_project(
    host: State<'_, Arc<RwLock<ModuleHost>>>,
    project_path: String,
    project_id: String,
) -> Result<(), String> {
    let mut h = host.write().await;
    h.open_project(Path::new(&project_path), &project_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_get_assembly_config(
    host: State<'_, Arc<RwLock<ModuleHost>>>,
) -> Result<ProjectAssemblyConfig, String> {
    let h = host.read().await;
    let module = h.get_project_module("assembly")
        .ok_or("Assembly module not found")?;
    let m = module.read().await;
    let assembly = m.as_any().downcast_ref::<AssemblyModule>()
        .ok_or("Type mismatch")?;
    assembly.service()
        .ok_or("No project open".to_string())?
        .get_config()
        .cloned()
        .ok_or("No config".to_string())
}
```

### 6.9 ライフサイクルイベントとフロントエンド

```
Rust (ModuleHost)                    TypeScript (Zustand)
─────────────────                    ────────────────────
App startup                          ─
  ├ auth.initialize()
  └ module-registry.initialize()
                                     App mount
                                       └ authStore.restoreSession()
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
cmd_open_project()                   invoke('cmd_open_project')
  ├ assembly.on_project_open()         ├ projectStore.loadProject()
  ├ resource-depot.on_project_open()   ├ editorStore.reset()
  ├ data-organizer.on_project_open()   └ (各featureのstoreが初期化)
  └ collab.on_project_open()
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  (ユーザーが作業)                    (ユーザーが作業)
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
cmd_save_project()                   invoke('cmd_save_project')
  ├ assembly.on_project_save()         └ projectStore.markSaved()
  ├ resource-depot.on_project_save()
  └ data-organizer.on_project_save()
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
cmd_close_project()                  invoke('cmd_close_project')
  ├ collab.on_project_close()          ├ editorStore.reset()
  ├ data-organizer.on_project_close()  └ projectStore.clear()
  ├ resource-depot.on_project_close()
  └ assembly.on_project_close()
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
Window close                         ─
  ├ host.close_project()
  └ host.shutdown()
```

### 6.10 イベントバス（モジュール間通信）

モジュール同士が直接参照せず、イベントで疎結合にやりとりする。

```rust
// crates/ars-core/src/event.rs

#[derive(Debug, Clone)]
pub enum ArsEvent {
    // Project lifecycle
    ProjectOpened { project_id: String, project_root: PathBuf },
    ProjectClosed { project_id: String },
    ProjectSaved { project_id: String },

    // Scene editing
    SceneActivated { scene_id: String },
    ActorAdded { scene_id: String, actor_id: String },
    ActorRemoved { scene_id: String, actor_id: String },
    ComponentAttached { actor_id: String, component_id: String },

    // Assembly
    AssemblyConfigChanged,
    PlatformChanged { platform: BackendPlatform },

    // Resource
    ResourceImported { resource_id: String },

    // Auth
    UserLoggedIn { user_id: String },
    UserLoggedOut,
}

/// イベントバス: tokio broadcast channel ベース
pub struct EventBus {
    sender: broadcast::Sender<ArsEvent>,
}

impl EventBus {
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(256);
        Self { sender }
    }

    pub fn emit(&self, event: ArsEvent) {
        let _ = self.sender.send(event);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<ArsEvent> {
        self.sender.subscribe()
    }
}
```

**使用例: プラットフォーム変更 → コード生成モジュールが反応**

```rust
// AssemblyModule 内
fn set_platform(&self, platform: BackendPlatform, event_bus: &EventBus) {
    self.service.set_backend_platform(platform.clone());
    event_bus.emit(ArsEvent::PlatformChanged { platform });
}

// CodegenModule 内（subscribe側）
async fn handle_events(&self, mut rx: broadcast::Receiver<ArsEvent>) {
    while let Ok(event) = rx.recv().await {
        match event {
            ArsEvent::PlatformChanged { platform } => {
                self.regenerate_templates(platform);
            }
            _ => {}
        }
    }
}
```

### 6.11 Plugin のライフサイクル

外部ソリューション Plugin (Unity, Ergo, Pictor) は **ProjectModule** として登録。
ただし依存は `ars-core` の trait のみ。

```rust
// plugins/ars-plugin-ergo/src/module.rs

pub struct ErgoModule {
    codegen: Option<ErgoCodegen>,
}

#[async_trait]
impl ProjectModule for ErgoModule {
    fn info(&self) -> ModuleInfo {
        ModuleInfo {
            id: "plugin-ergo",
            name: "Ergo Code Generator",
            scope: ModuleScope::Project,
            depends_on: &["assembly"],  // platform情報が必要
        }
    }

    async fn on_project_open(&mut self, project_root: &Path, _project_id: &str) -> Result<()> {
        self.codegen = Some(ErgoCodegen::new(project_root));
        Ok(())
    }

    async fn on_project_close(&mut self) -> Result<()> {
        self.codegen = None;
        Ok(())
    }

    async fn on_project_save(&mut self) -> Result<()> { Ok(()) }
    fn as_any(&self) -> &dyn std::any::Any { self }
}
```

```rust
// エディタの main.rs で、プラットフォーム設定に応じてPluginを登録
match project_platform {
    BackendPlatform::ArsNative => {
        host.register_project_module(ErgoModule::new());
        host.register_project_module(PictorModule::new());
    }
    BackendPlatform::Unity => {
        host.register_project_module(UnityModule::new());
    }
    // ...
}
```

### 6.12 まとめ: ライフサイクル全体像

```
┌─────────────────────────────────────────────────────────────────┐
│ ModuleHost                                                       │
│                                                                  │
│  ┌─ App-scoped ──────────────────────────────────────────────┐  │
│  │  auth → secrets → module-registry → git                   │  │
│  │  (起動時 initialize、終了時 shutdown)                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Project-scoped (Open/Close で生死) ──────────────────────┐  │
│  │  assembly → resource-depot → data-organizer → collab      │  │
│  │  + plugin-ergo, plugin-pictor (platform依存)              │  │
│  │                                                           │  │
│  │  on_project_open()  ← depends_on 順                      │  │
│  │  on_project_save()  ← 全モジュール並列OK                  │  │
│  │  on_project_close() ← depends_on 逆順                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ EventBus ────────────────────────────────────────────────┐  │
│  │  broadcast channel: モジュール間の疎結合イベント通知       │  │
│  │  PlatformChanged → Ergo/Pictor が反応                     │  │
│  │  SceneActivated → Collab がロック情報を配信               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```
