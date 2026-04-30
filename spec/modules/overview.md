# Ars モジュールシステム 概要設計書

## 1. 目的

Arsエディタを、ドメイン境界に沿ったモジュールに分離し、
App版（Tauri Desktop）とWeb版（Axum Server）の**両方で同一ビジネスロジックが動く**構造にする。

## 2. アーキテクチャ原則

### 2.1 3層構造

各コアモジュールを3層に分けることで、App/Web両対応を実現する。

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Host adapter (App版 or Web版 固有)                  │
│                                                              │
│  App版:  ProjectModule trait 実装（ライフサイクル管理）       │
│          ModuleHost に登録、EventBus でイベント駆動           │
│                                                              │
│  Web版:  Axum Handler / Router 定義                          │
│          リクエストごとに Layer 2 の関数を呼ぶだけ             │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Use case (ビジネスロジック、App/Web共通)             │
│                                                              │
│  純粋な async 関数群。&dyn Repository を引数に取る。          │
│  状態を持たない。ライフサイクルを知らない。                    │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Domain model + Repository trait (ars-core)          │
│                                                              │
│  構造体定義、trait定義、EventBus基盤。実装を含まない。        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 App版とWeb版の違い

| | App版 (Tauri Desktop) | Web版 (Axum Server) |
|---|---|---|
| ユーザー | シングル | マルチ |
| プロジェクト | 「開く/閉じる」ライフサイクル | ステートレス（リクエスト単位） |
| 永続化 | ローカルファイル (~/.ars/) | DynamoDB |
| モジュール間通信 | EventBus（リアルタイム反応） | 不要（リクエスト独立） |
| 状態管理 | ModuleHost が保持 | DB が State of Truth |
| セッション | 永続（同一PCで再認証不要） | TTL付き（7日） |

### 2.3 Layer 2 の設計原則

1. **純粋な async 関数**。`&self` を取らない。状態を持たない
2. **Repository trait を引数で受け取る**。具体的な永続化を知らない
3. **EventBus を知らない**。イベント発火は Layer 3 (App版) の責務
4. **ライフサイクルを知らない**。「プロジェクトが開いている」という概念がない
5. **App版でもWeb版でも同一コードが動く**

## 3. モジュール一覧

### 3.1 コアモジュール（crates/、Ars monorepo）

| モジュール | ID | 責務 | 実装状況 |
|-----------|-----|------|---------|
| **ars-core** | - | ドメインモデル、trait定義、EventBus | **実装済み** |
| **ars-project** | `project` | プロジェクトI/O、ローカル永続化 | **実装済み** |
| ars-assembly | `assembly` | ビルド構成、コア/アプリアセンブリ管理 | 設計のみ |
| ars-module-registry | `module-registry` | Ergoモジュール定義の発見・解析・キャッシュ | 設計のみ |
| ars-resource-depot | `resource-depot` | アセット管理 | 設計のみ |
| ars-data-organizer | `data-organizer` | Blackboard変数、ゲーム設定値 | 設計のみ |
| **ars-game-lexicon** | `game-lexicon` | ゲーム辞書 (Genre / Feature / Preset / Term)、 仕様駆動の seed データ + ローダ | **v0.1 (フレーム + 9 ジャンル seed)** |
| ars-auth | `auth` | 認証、セッション管理 | 設計のみ |
| ars-collab | `collab` | WebSocket同期、プレゼンス、ロック | 設計のみ |
| ars-secrets | `secrets` | シークレット管理（Keychain + TOML） | 設計のみ |
| ars-git | `git` | Git操作（clone, push, pull） | 設計のみ |
| ars-test | `test` | 機能テスト・統合テスト・テストモジュール管理（`spec/rule/test-rules.md`） | 設計のみ |

### 3.2 プラグイン（独立リポジトリ）

| プラグイン | ID | 責務 |
|-----------|-----|------|
| ars-plugin-ergo | `plugin-ergo` | Ergoコード生成 |
| ars-plugin-pictor | `plugin-pictor` | Pictorレンダリング連携 |
| ars-plugin-unity | `plugin-unity` | Unity連携 |
| ars-plugin-unreal | `plugin-unreal` | Unreal連携 |
| ars-plugin-godot | `plugin-godot` | Godot連携 |

### 3.3 外部ツール（独立リポジトリ）

| ツール | 責務 |
|--------|------|
| melpomene | GitHub Issues・通知管理 |
| terpsichore | コマンドサーバー・外部ツール連携 |
| thaleia | Markdownドキュメントレンダラ |

### 3.4 アプリケーション（Ars monorepo）

| アプリ | 役割 |
|--------|------|
| ars-editor | Tauri Desktop エディタ (Layer 3a) |
| ars-web-server | Axum Webサーバー (Layer 3b) |

## 4. 依存関係

```
                        ┌─────────────┐
                        │  ars-core   │
                        │  (models,   │
                        │   traits,   │
                        │   EventBus) │
                        └──────┬──────┘
           ┌───────┬───────┬───┴───┬──────────┐
           ▼       ▼       ▼       ▼          ▼
      ars-project  ars-    ars-    ars-    ars-collab
           │      assembly module  resource
           ▼               │ registry
      ars-secrets          ▼
           ▲          ars-git
           │
      ars-auth

      ─── Plugin (ars-core のみ依存) ───
      plugin-ergo → ars-core
      plugin-pictor → ars-core
      plugin-unity → ars-core

      ─── External (独立) ───
      melpomene, terpsichore, thaleia
```

**依存ルール:**
1. 全モジュールは `ars-core` にのみ共通依存する
2. コアモジュール間の依存は最小限、単方向のみ
3. プラグインは `ars-core` の trait **のみ** 参照。他のコアモジュールへの依存禁止
4. 外部ツールは Ars のどのモジュールにも依存しない
5. App層（ars-editor / ars-web-server）が全モジュールを結合する

## 5. ライフサイクル

### 5.1 App版: 2つのスコープ

| スコープ | 生存期間 | 対象 |
|---------|---------|------|
| **App** | アプリ起動〜終了 | auth, secrets, module-registry, git |
| **Project** | プロジェクト Open〜Close | assembly, resource-depot, data-organizer, collab, plugins |

```
App Launch
 ├─ [App] initialize (depends_on 順)
 │
 ├─ Project Open
 │   ├─ [Project] on_project_open (depends_on 順)
 │   ├─ (ユーザー作業)
 │   ├─ Project Save → on_project_save
 │   └─ Project Close → on_project_close (depends_on 逆順)
 │
 └─ App Quit
     ├─ close_project (開いていれば)
     └─ [App] shutdown (depends_on 逆順)
```

### 5.2 Web版: ステートレス

```
Server startup
 ├─ AppState 構築 (Repository DI)
 ├─ Router 構築 (handler マージ)
 └─ listen
     └─ リクエスト → 認証 → use_case(Layer 2) → レスポンス
Server shutdown
 └─ graceful shutdown
```

## 6. EventBus

### 6.1 位置づけ

EventBus は **App版 (Layer 3a) 専用**。
Web版はリクエスト独立のためモジュール間のリアルタイム通知が不要。

### 6.2 設計原則

- **型安全**: イベントは `ArsEvent` trait を実装した任意の struct
- **プラグイン拡張可能**: プラグインが独自のイベント型を定義・発火・購読できる
- **依存宣言必須**: 他モジュールのイベントを購読するには `depends_on` に明記
- **コアイベント例外**: `source_module = "core"` は依存宣言なしで購読可能
- **起動時一括登録**: 全ハンドラはモジュールの `initialize` / `on_project_open` で登録

### 6.3 コアイベント（ars-core 定義、実装済み）

| カテゴリ | イベント | 発火元 |
|---------|---------|--------|
| Project | `ProjectOpened` / `ProjectClosed` / `ProjectSaved` | ModuleHost |
| Scene | `SceneActivated` | project |
| Scene | `ActorAdded` / `ActorRemoved` | project |
| Scene | `ComponentAttached` / `ComponentDetached` | project |
| Assembly | `AssemblyConfigChanged` / `PlatformChanged` | assembly |
| Resource | `ResourceImported` | resource-depot |
| Auth | `UserAuthenticated` / `UserLoggedOut` | auth |

### 6.4 プラグインイベント拡張（例）

| プラグイン | 自前イベント | 購読イベント | depends_on |
|-----------|-------------|-------------|------------|
| plugin-ergo | `ErgoCodeGenerated`, `ErgoCodeGenFailed` | `PlatformChanged`, `ComponentAttached` | `assembly` |
| plugin-pictor | `LookdevUpdated` | `ResourceImported`, `ErgoCodeGenerated` | `resource-depot`, `plugin-ergo` |
| test | `FunctionalTestsGenerated`, `IntegrationFlowDrafted`, `TestRunCompleted` | `ErgoCodeGenerated`, `SceneActivated` | `plugin-ergo`, `assembly` |

## 7. 永続化

### 7.1 Repository trait パターン（実装済み）

```
Layer 1 (ars-core):  ProjectRepository, UserRepository, SessionRepository
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                                                     ▼
Layer 3a (App版):                                    Layer 3b (Web版):
  LocalProjectRepository                              DynamoProjectRepository
  LocalUserRepository                                  DynamoUserRepository
  LocalSessionRepository                               DynamoSessionRepository
  (~/.ars/ JSON + Keychain)                            (AWS DynamoDB)
```

### 7.2 ローカルストレージ構造（App版）

```
~/.ars/
├── config.toml                 # グローバル設定
├── user.json                   # ローカルユーザー情報
├── session.json                # 永続セッション（再認証不要）
├── projects/
│   └── <project-id>/
│       ├── project.json        # プロジェクトデータ
│       └── meta.json           # 名前・更新日時
├── secrets/
│   ├── <project-id>/
│   │   ├── secrets.toml        # 機密値
│   │   └── env.toml            # 非機密ローカル設定
│   └── global/
│       └── secrets.toml        # 共通機密値
├── module-cache/               # モジュールレジストリキャッシュ
└── resource-depot/
    └── depot.json
```

## 8. 機密情報管理

### 8.1 3層のシークレット管理

| 層 | 手段 | 対象 |
|---|---|---|
| Layer 1 | OS Keychain (`keyring` crate) | マスターキー、長期トークン |
| Layer 2 | `~/.ars/secrets/` (TOML) | プロジェクト固有の機密値 |
| Layer 3 | GitHub Actions Secrets / AWS SSM | CI/CD・本番デプロイ |

- プロジェクトディレクトリ外（`~/.ars/`）に格納 → Git混入リスクゼロ
- `keychain:<key-name>` プレフィックスで Layer 1 への間接参照
- 環境変数 `ARS_SECRET_<SECTION>_<KEY>` でオーバーライド可能

## 9. Native Build 運用

### 9.1 Phase A → B の段階的アプローチ

```
Phase A: ローカルビルド
  ├─ tauri.conf.json 修正 (identifier: dev.ludiars.ars-editor)
  ├─ ~/.ars/ シークレット解決フロー
  └─ ビルドコマンド: npx tauri build

Phase B: CI/CD 自動ビルド
  ├─ GitHub Actions + tauri-action
  ├─ Windows (MSI + NSIS) / Linux (deb + AppImage)
  ├─ GitHub Releases へ自動アップロード
  └─ Tauri Updater によるアプリ内自動更新
```

### 9.2 ビルド成果物

| OS | 形式 | 用途 |
|----|------|------|
| Windows | `.msi` | 企業配布 |
| Windows | `.exe` (NSIS) | 個人インストール |
| Linux | `.deb` | Debian/Ubuntu |
| Linux | `.AppImage` | ポータブル |

## 10. Git管理戦略

### 10.1 Monorepo（Ars本体）

```
LUDIARS/Ars
├── crates/          # コアモジュール
├── apps/            # アプリケーション
├── packages/        # 共有TypeScript
├── tools/           # CLI ツール
└── docs/
```

### 10.2 独立リポジトリ

```
LUDIARS/ars-plugin-ergo
LUDIARS/ars-plugin-pictor
LUDIARS/ars-plugin-unity
LUDIARS/ars-plugin-unreal
LUDIARS/ars-plugin-godot
LUDIARS/melpomene
LUDIARS/terpsichore
LUDIARS/thaleia
```

- `ars-core` への依存: Git dependency or crates.io
- 独立したバージョニング・リリースサイクル

## 11. 移行ロードマップ

| Phase | 作業 | 状況 |
|-------|------|------|
| **1-1** | `ars-core` 抽出（モデル、trait、EventBus） | **完了** |
| **1-2** | `ars-project` 抽出（ローカル永続化） | **完了** |
| **1-3** | Repository DI 配線 + DynamoRepo ラッパー | **完了** |
| 2-1 | `ars-assembly` 抽出 (Layer 2 use case + Layer 3 module) | 未着手 |
| 2-2 | `ars-module-registry` 抽出 | 未着手 |
| 2-3 | `ars-auth` 抽出 | 未着手 |
| 3 | Plugin 独立リポジトリ化 | 未着手 |
| 4 | App層スリム化 + Cargo workspace化 | 未着手 |

## 12. ディレクトリ構造（最終形）

```
Ars/
├── crates/
│   ├── ars-core/               # Layer 1: モデル + trait + EventBus
│   ├── ars-project/            # Layer 2 + ローカル永続化
│   ├── ars-assembly/           # Layer 2: アセンブリ use case
│   ├── ars-module-registry/    # Layer 2: モジュールレジストリ use case
│   ├── ars-resource-depot/     # Layer 2: リソース use case
│   ├── ars-data-organizer/     # Layer 2: マスターデータ use case
│   ├── ars-auth/               # Layer 2: 認証 use case
│   ├── ars-collab/             # Layer 2: コラボレーション use case
│   ├── ars-secrets/            # Layer 2: シークレット管理
│   └── ars-git/                # Layer 2: Git操作
├── apps/
│   ├── ars-editor/             # Layer 3a: Tauri Desktop
│   │   ├── src-tauri/          #   ModuleHost + Tauri Commands
│   │   └── src/                #   React features + stores
│   └── ars-web-server/         # Layer 3b: Axum handlers
├── packages/
│   ├── ars-types/              # 共有TypeScript型定義
│   └── ars-shared/             # 共有ユーティリティ
├── tools/
│   ├── ars-codegen/            # AI支援コード生成 CLI
│   └── ars-mcp-server/         # MCP Server
├── docs/
│   └── modules/
│       ├── overview.md         # ← この文書
│       └── detail.md           # 詳細設計書
└── Cargo.toml                  # workspace root
```
