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

## 4. コアモジュールの3層構造（App/Web両対応）

### 4.1 問題: App版とWeb版の根本的な違い

```
App版 (Tauri Desktop)                Web版 (Axum Server)
──────────────────────               ──────────────────────
シングルユーザー                      マルチユーザー
プロジェクトを「開く/閉じる」          ステートレス（リクエスト単位）
ModuleHost がライフサイクル管理        状態はDB、リクエストごとにCRUD
EventBus でモジュール間通信           HTTPレスポンスで完結
ローカルファイル永続化                 DynamoDB永続化
```

ModuleHost / ProjectModule のライフサイクル（open→作業→save→close）は
**App版固有の概念**。Web版は状態を持たないリクエスト駆動。

### 4.2 解決: 各コアモジュールを3層に分ける

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
│  純粋な関数群。&dyn Repository を引数に取る。                 │
│  状態を持たない。ライフサイクルを知らない。                    │
│  App版でもWeb版でも同じコードが動く。                         │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Domain model + Repository trait (ars-core)          │
│                                                              │
│  構造体定義、trait定義。実装を含まない。                       │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 具体例: ars-assembly

```rust
// Layer 1: ars-core (trait定義)
pub trait AssemblyConfigRepository { ... }

// Layer 2: ars-assembly/src/use_cases.rs (ビジネスロジック)
pub async fn add_core_assembly(
    repo: &dyn AssemblyConfigRepository,
    project_id: &str,
    assembly: CoreAssembly,
) -> Result<()> {
    // バリデーション、ビジネスルール
    let mut config = repo.load(project_id).await?.unwrap_or_default();
    if config.core_assemblies.iter().any(|a| a.id == assembly.id) {
        return Err(ArsError::Validation("Duplicate ID".into()));
    }
    config.core_assemblies.push(assembly);
    repo.save(project_id, &config).await
}

// Layer 3a: App版 (AssemblyModule)
impl ProjectModule for AssemblyModule {
    async fn on_project_open(&mut self, ctx: &ProjectContext, event_bus: &EventBus) -> Result<()> {
        self.config = self.repo.load(&ctx.project_id).await?.unwrap_or_default();
        event_bus.register_event::<AssemblyConfigChanged>("assembly").await;
        Ok(())
    }
}

// Layer 3b: Web版 (Axum handler)
async fn api_add_core_assembly(
    State(state): State<AppState>,
    Json(req): Json<AddCoreAssemblyRequest>,
) -> Result<Json<()>, ...> {
    ars_assembly::use_cases::add_core_assembly(
        state.assembly_repo.as_ref(),
        &req.project_id,
        req.assembly,
    ).await.map(Json)...
}
```

### 4.4 各コアモジュールの層構成

| モジュール | Layer 1 (ars-core) | Layer 2 (use case) | Layer 3a (App) | Layer 3b (Web) |
|-----------|------|------|------|------|
| ars-project | ProjectRepository | save/load/list/delete | ProjectModule + EventBus | Axum CRUD handlers |
| ars-assembly | AssemblyConfigRepository | add/remove/update assemblies | AssemblyModule + EventBus | Axum handlers |
| ars-resource-depot | (既存Service) | リソース検索・取得 | ResourceDepotModule | Axum handlers |
| ars-data-organizer | (既存Service) | データCRUD | DataOrganizerModule | Axum handlers |
| ars-auth | UserRepository, SessionRepository | ユーザー認証フロー | AuthModule (セッション復元) | OAuth handlers |
| ars-collab | (WebSocket types) | メッセージ処理 | CollabModule + EventBus | WebSocket handler |

### 4.5 Layer 2 の設計原則

1. **純粋な async 関数**。`&self` を取らない。状態を持たない
2. **Repository trait を引数で受け取る**。具体的な永続化を知らない
3. **EventBus を知らない**。イベント発火は Layer 3 (App版) の責務
4. **ライフサイクルを知らない**。「プロジェクトが開いている」という概念がない
5. **App版でもWeb版でも同一コードが動く**

### 4.6 EventBus の位置づけ

EventBus は **App版 (Layer 3a) 専用**。

```
App版:
  Module A ──emit──→ EventBus ──subscribe──→ Module B
  (リアルタイム反応。ユーザーの操作に即座に連動)

Web版:
  Handler A → use_case → Response
  Handler B → use_case → Response
  (リクエスト独立。モジュール間の即時通信は不要)
```

Web版でモジュール間連携が必要な場合は、Layer 2 の use case 関数を
Handler から直接呼ぶか、キューイング（SQS等）で非同期処理する。

## 5. ライフサイクル（App版）

### 5.1 2つのスコープ

| スコープ | 生存期間 | 対象 |
|---------|---------|------|
| **App** | アプリ起動〜終了 | auth, secrets, module-registry, git |
| **Project** | プロジェクト Open〜Close | assembly, resource-depot, data-organizer, collab, plugins |

### 5.2 ライフサイクルイベント

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

### 5.3 Web版のライフサイクル

```
Server startup
 ├─ AppState 構築 (Repository注入)
 ├─ Router 構築 (各モジュールの handler をマージ)
 └─ listen
     └─ リクエストごとに:
         ├─ 認証 (cookie → session → user)
         ├─ use_case 関数呼び出し (Layer 2)
         └─ レスポンス返却
Server shutdown
 └─ graceful shutdown (既存接続の完了待ち)
```

## 6. イベントバス

### 6.1 設計原則

- **型安全**: イベントは `ArsEvent` trait を実装した任意の struct
- **プラグイン拡張可能**: プラグインが独自のイベント型を定義・発火・購読できる
- **依存宣言必須**: 他モジュールのイベントを購読する場合、`depends_on` に明記
- **起動時一括登録**: 全ハンドラはモジュールの `initialize` / `on_project_open` で登録

### 6.2 コアイベント（ars-core 定義）

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

### 6.3 プラグインイベント（例）

| プラグイン | イベント | depends_on |
|-----------|---------|------------|
| plugin-ergo | `ErgoCodeGenerated` | - (自分が発火) |
| plugin-ergo | subscribes `PlatformChanged` | `assembly` |
| plugin-pictor | `LookdevUpdated` | - |
| plugin-pictor | subscribes `ResourceImported` | `resource-depot` |

## 7. Git管理戦略

### 7.1 Monorepo（Ars本体）

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

### 7.2 独立リポジトリ（プラグイン・外部ツール）

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

### 7.3 Monorepo内ブランチ（コアモジュール分離作業用）

モジュール分離の移行作業は feature branch で段階的に行う:

```
main
 ├─ feature/extract-ars-assembly     # Phase 2: assembly crate抽出
 ├─ feature/extract-ars-auth         # Phase 2: auth crate抽出
 └─ feature/extract-ars-module-reg   # Phase 2: module-registry crate抽出
```

## 8. ディレクトリ構造（最終形）

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
