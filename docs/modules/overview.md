# Ars モジュールシステム 概要設計書

## 1. 目的

Arsエディタのモノリシックな構造を、ドメイン境界に沿ったモジュールに分離し、
各モジュールが独立してビルド・テスト・リリースできるようにする。

## 2. モジュール一覧

### 2.1 コアモジュール（crates/）

| モジュール | ID | スコープ | 責務 | Git管理 |
|-----------|-----|---------|------|---------|
| ars-core | - | - | ドメインモデル、trait定義、EventBus | Ars本体 (monorepo) |
| ars-project | `project` | Project | プロジェクトI/O、ローカル永続化 | Ars本体 |
| ars-assembly | `assembly` | Project | ビルド構成、コア/アプリアセンブリ管理 | Ars本体 |
| ars-module-registry | `module-registry` | App | Ergoモジュール定義の発見・解析・キャッシュ | Ars本体 |
| ars-resource-depot | `resource-depot` | Project | アセット管理（モデル、テクスチャ、モーション） | Ars本体 |
| ars-data-organizer | `data-organizer` | Project | Blackboard変数、ゲーム設定値 | Ars本体 |
| ars-auth | `auth` | App | 認証、セッション管理 | Ars本体 |
| ars-collab | `collab` | Project | WebSocket同期、プレゼンス、ロック | Ars本体 |
| ars-secrets | `secrets` | App | シークレット管理（Keychain + TOML） | Ars本体 |
| ars-git | `git` | App | Git操作（clone, push, pull） | Ars本体 |

### 2.2 プラグイン（plugins/）

| プラグイン | ID | 責務 | Git管理 |
|-----------|-----|------|---------|
| ars-plugin-ergo | `plugin-ergo` | Ergoコード生成 | **独立リポジトリ** |
| ars-plugin-pictor | `plugin-pictor` | Pictorレンダリング連携 | **独立リポジトリ** |
| ars-plugin-unity | `plugin-unity` | Unity連携 | **独立リポジトリ** |
| ars-plugin-unreal | `plugin-unreal` | Unreal連携 | **独立リポジトリ** |
| ars-plugin-godot | `plugin-godot` | Godot連携 | **独立リポジトリ** |

### 2.3 外部ツール（external/）

| ツール | 責務 | Git管理 |
|--------|------|---------|
| melpomene | GitHub Issues・通知管理 | **独立リポジトリ** |
| terpsichore | コマンドサーバー・外部ツール連携 | **独立リポジトリ** |
| thaleia | Markdownドキュメントレンダラ | **独立リポジトリ** |

### 2.4 アプリケーション（apps/）

| アプリ | 役割 | Git管理 |
|--------|------|---------|
| ars-editor | Tauri Desktop エディタ（薄いグルー層） | Ars本体 |
| ars-web-server | Axum Webサーバー | Ars本体 |

## 3. 依存関係

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
      ...

      ─── External (独立) ───
      melpomene, terpsichore, thaleia
```

**依存ルール:**
1. 全モジュールは `ars-core` にのみ共通依存する
2. コアモジュール間の依存は最小限、単方向のみ
3. プラグインは `ars-core` の trait **のみ** 参照。他のコアモジュールへの依存禁止
4. 外部ツールは Ars のどのモジュールにも依存しない
5. アプリ層（ars-editor / ars-web-server）が全モジュールを結合する

## 4. ライフサイクル

### 4.1 2つのスコープ

| スコープ | 生存期間 | 対象 |
|---------|---------|------|
| **App** | アプリ起動〜終了 | auth, secrets, module-registry, git |
| **Project** | プロジェクト Open〜Close | assembly, resource-depot, data-organizer, collab, plugins |

### 4.2 ライフサイクルイベント

```
App Launch
 ├─ [App] initialize (depends_on 順)
 │
 ├─ Project Open
 │   ├─ [Project] on_project_open (depends_on 順)
 │   ├─ (ユーザー作業)
 │   ├─ Project Save → on_project_save (全モジュール)
 │   └─ Project Close → on_project_close (depends_on 逆順)
 │
 └─ App Quit
     ├─ close_project (開いていれば)
     └─ [App] shutdown (depends_on 逆順)
```

## 5. イベントバス

### 5.1 設計原則

- **型安全**: イベントは `ArsEvent` trait を実装した任意の struct
- **プラグイン拡張可能**: プラグインが独自のイベント型を定義・発火・購読できる
- **依存宣言必須**: 他モジュールのイベントを購読する場合、`depends_on` に明記
- **起動時一括登録**: 全ハンドラはモジュールの `initialize` / `on_project_open` で登録

### 5.2 コアイベント（ars-core 定義）

| カテゴリ | イベント | 発火元 |
|---------|---------|--------|
| Project | `ProjectOpened` | ModuleHost |
| Project | `ProjectClosed` | ModuleHost |
| Project | `ProjectSaved` | ModuleHost |
| Scene | `SceneActivated` | project |
| Scene | `ActorAdded` / `ActorRemoved` | project |
| Scene | `ComponentAttached` / `ComponentDetached` | project |
| Assembly | `AssemblyConfigChanged` | assembly |
| Assembly | `PlatformChanged` | assembly |
| Resource | `ResourceImported` | resource-depot |
| Auth | `UserAuthenticated` / `UserLoggedOut` | auth |

### 5.3 プラグインイベント（例）

| プラグイン | イベント | depends_on |
|-----------|---------|------------|
| plugin-ergo | `ErgoCodeGenerated` | - (自分が発火) |
| plugin-ergo | subscribes `PlatformChanged` | `assembly` |
| plugin-pictor | `LookdevUpdated` | - |
| plugin-pictor | subscribes `ResourceImported` | `resource-depot` |

## 6. Git管理戦略

### 6.1 Monorepo（Ars本体）

```
LUDIARS/Ars (monorepo)
├── crates/          # コアモジュール
├── apps/            # アプリケーション
├── packages/        # 共有TypeScript
├── tools/           # CLI ツール
└── docs/
```

- ブランチ戦略: `main` + feature branches
- バージョン: workspace 統一バージョン

### 6.2 独立リポジトリ（プラグイン・外部ツール）

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
- Ars本体の破壊的変更時はプラグイン側でバージョン追従

### 6.3 Monorepo内ブランチ（コアモジュール分離作業用）

モジュール分離の移行作業は feature branch で段階的に行う:

```
main
 ├─ feature/extract-ars-assembly     # Phase 2: assembly crate抽出
 ├─ feature/extract-ars-auth         # Phase 2: auth crate抽出
 └─ feature/extract-ars-module-reg   # Phase 2: module-registry crate抽出
```

## 7. ディレクトリ構造（最終形）

```
Ars/
├── crates/
│   ├── ars-core/
│   ├── ars-project/
│   ├── ars-assembly/
│   ├── ars-module-registry/
│   ├── ars-resource-depot/
│   ├── ars-data-organizer/
│   ├── ars-auth/
│   ├── ars-collab/
│   ├── ars-secrets/
│   └── ars-git/
├── apps/
│   ├── ars-editor/
│   │   ├── src-tauri/          # Rust: ModuleHost + Tauri Commands
│   │   └── src/                # React: features + stores
│   └── ars-web-server/
├── packages/
│   ├── ars-types/
│   └── ars-shared/
├── tools/
│   ├── ars-codegen/
│   └── ars-mcp-server/
├── docs/
│   └── modules/
│       ├── overview.md         # ← この文書
│       └── detail.md
└── Cargo.toml                  # workspace root
```
