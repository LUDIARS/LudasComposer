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
