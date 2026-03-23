# Ars モジュールシステム 詳細設計書

## 1. ars-core 実装仕様

### 1.1 ドメインモデル（実装済み）

```
crates/ars-core/src/
├── models/
│   ├── project.rs    # Project, Scene, Actor, Component, Connection, etc.
│   └── auth.rs       # User (provider抽象化), Session (expires_at: Option)
├── repository.rs     # ProjectRepository, UserRepository, SessionRepository
├── error.rs          # ArsError 統一エラー型
├── event.rs          # ArsEvent trait
├── event_bus.rs      # EventBus (型安全 broadcast channel)
├── events/           # コアイベント定義
│   ├── project.rs    # ProjectOpened, ProjectClosed, ProjectSaved
│   ├── scene.rs      # SceneActivated, ActorAdded/Removed, ComponentAttached/Detached
│   ├── assembly.rs   # AssemblyConfigChanged, PlatformChanged
│   ├── resource.rs   # ResourceImported
│   └── auth.rs       # UserAuthenticated, UserLoggedOut
└── module.rs         # AppModule, ProjectModule traits, ModuleHost types
```

### 1.2 Repository trait（実装済み）

```rust
#[async_trait]
pub trait ProjectRepository: Send + Sync {
    async fn save(&self, user_id: &str, project_id: &str, project: &Project) -> Result<()>;
    async fn load(&self, user_id: &str, project_id: &str) -> Result<Option<Project>>;
    async fn list(&self, user_id: &str) -> Result<Vec<ProjectSummary>>;
    async fn delete(&self, user_id: &str, project_id: &str) -> Result<()>;
}

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn put(&self, user: &User) -> Result<()>;
    async fn get(&self, user_id: &str) -> Result<Option<User>>;
    async fn get_by_provider_id(&self, provider: &str, provider_id: &str) -> Result<Option<User>>;
}

#[async_trait]
pub trait SessionRepository: Send + Sync {
    async fn put(&self, session: &Session) -> Result<()>;
    async fn get(&self, session_id: &str) -> Result<Option<Session>>;
    async fn delete(&self, session_id: &str) -> Result<()>;
    async fn get_active(&self) -> Result<Option<Session>>;  // App版: 永続セッション取得
}
```

### 1.3 User / Session モデル（実装済み）

```rust
pub struct User {
    pub id: String,
    pub provider_id: String,     // GitHub ID等（旧: github_id: i64）
    pub provider: String,        // "github", "local"
    pub login: String,
    pub display_name: String,
    pub avatar_url: String,
    pub email: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

pub struct Session {
    pub id: String,
    pub user_id: String,
    pub expires_at: Option<String>,  // None = 永続（App版）
    pub created_at: String,
    pub access_token: String,
}
```

---

## 2. EventBus 詳細仕様（実装済み）

### 2.1 ArsEvent trait

```rust
pub trait ArsEvent: Any + Debug + Send + Sync + Clone + 'static {
    /// 発火元モジュールID。コアイベントは "core"
    fn source_module(&self) -> &'static str;
    /// カテゴリ（ログ・フィルタリング用）
    fn category(&self) -> &'static str;
}
```

### 2.2 EventBus API

```rust
impl EventBus {
    pub fn new(buffer_size: usize) -> Self;

    /// イベントチャンネルを登録（モジュール起動時）
    pub async fn register_event<E: ArsEvent>(&self, source_module_id: &'static str);

    /// イベントを発火
    pub async fn emit<E: ArsEvent>(&self, event: E);

    /// イベントを購読。未登録なら None（Optional依存に対応）
    pub async fn subscribe<E: ArsEvent>(&self) -> Option<broadcast::Receiver<E>>;

    /// 発火元モジュールID取得（依存検証用）
    pub async fn get_event_source<E: ArsEvent>(&self) -> Option<&'static str>;
}
```

### 2.3 プラグインによるイベント追加

```rust
// 1. プラグインが独自イベント型を定義
#[derive(Debug, Clone)]
pub struct ErgoCodeGenerated {
    pub module_id: String,
    pub output_path: PathBuf,
}
impl ArsEvent for ErgoCodeGenerated {
    fn source_module(&self) -> &'static str { "plugin-ergo" }
    fn category(&self) -> &'static str { "codegen" }
}

// 2. on_project_open でチャンネル登録 + 購読開始
async fn on_project_open(&mut self, ctx: &ProjectContext, event_bus: &EventBus) -> Result<()> {
    // 自分のイベントを登録
    event_bus.register_event::<ErgoCodeGenerated>("plugin-ergo").await;

    // 他モジュールのイベントを購読（depends_on に "assembly" 必須）
    if let Some(mut rx) = event_bus.subscribe::<PlatformChanged>().await {
        tokio::spawn(async move {
            while let Ok(event) = rx.recv().await {
                // プラットフォーム変更に反応
            }
        });
    }
    Ok(())
}
```

### 2.4 ルール

| # | ルール |
|---|--------|
| R1 | 発火は `register_event` 済みの型のみ |
| R2 | 他モジュールのイベント購読には `depends_on` に発火元を宣言 |
| R3 | 全ハンドラ登録は `initialize` / `on_project_open` 内で完了 |
| R4 | ハンドラ内で同期的にイベント発火しない（デッドロック防止） |
| R5 | コアイベント（`source_module = "core"`）は依存宣言不要で購読可能 |
| R6 | Optional依存は `subscribe()` の `None` チェックで対応 |

---

## 3. Module trait 詳細仕様（実装済み）

### 3.1 ModuleInfo

```rust
pub struct ModuleInfo {
    pub id: &'static str,                    // "assembly", "plugin-ergo"
    pub name: &'static str,                  // 表示名
    pub scope: ModuleScope,                  // App or Project
    pub depends_on: &'static [&'static str], // 初期化順序の依存先
    pub emits: fn() -> Vec<TypeId>,          // 発火するイベント型
    pub subscribes: fn() -> Vec<TypeId>,     // 購読するイベント型
}
```

### 3.2 AppModule（App版 Layer 3a）

```rust
#[async_trait]
pub trait AppModule: Send + Sync + 'static {
    fn info(&self) -> ModuleInfo;
    async fn initialize(&mut self, event_bus: &EventBus) -> Result<()>;
    async fn shutdown(&mut self) -> Result<()>;
    fn as_any(&self) -> &dyn Any;
    fn as_any_mut(&mut self) -> &mut dyn Any;
}
```

### 3.3 ProjectModule（App版 Layer 3a）

```rust
#[async_trait]
pub trait ProjectModule: Send + Sync + 'static {
    fn info(&self) -> ModuleInfo;
    async fn on_project_open(&mut self, ctx: &ProjectContext, event_bus: &EventBus) -> Result<()>;
    async fn on_project_save(&mut self) -> Result<()>;
    async fn on_project_close(&mut self) -> Result<()>;
    fn as_any(&self) -> &dyn Any;
    fn as_any_mut(&mut self) -> &mut dyn Any;
}
```

### 3.4 モジュール分類

| モジュール | スコープ | depends_on |
|-----------|---------|------------|
| `auth` | App | `[]` |
| `secrets` | App | `["auth"]` |
| `module-registry` | App | `[]` |
| `git` | App | `["auth"]` |
| `assembly` | Project | `[]` |
| `resource-depot` | Project | `[]` |
| `data-organizer` | Project | `[]` |
| `collab` | Project | `["auth"]` |
| `plugin-ergo` | Project | `["assembly"]` |
| `plugin-pictor` | Project | `["assembly"]` |

---

## 4. Repository 実装（実装済み）

### 4.1 App版: ローカルファイル

```
crates/ars-project/src/
├── local_project.rs    # ~/.ars/projects/<id>/project.json
├── local_user.rs       # ~/.ars/user.json (シングルユーザー)
└── local_session.rs    # ~/.ars/session.json (永続、期限なし)
```

- `user_id` 引数は無視（シングルユーザー）
- セッションは `expires_at = None` で永続。同一PCで再認証不要

### 4.2 Web版: DynamoDB ラッパー

```
ars-editor/src-tauri/src/
└── dynamo_repo.rs      # DynamoProjectRepository, DynamoUserRepository, DynamoSessionRepository
```

- 既存 `DynamoClient` を Repository trait でラップ
- `ars-core::models` ⇔ `crate::models` の型変換は JSON経由（移行期）

### 4.3 DI 配線

```rust
// App版 (lib.rs)
let project_repo: Arc<dyn ProjectRepository> =
    Arc::new(LocalProjectRepository::with_defaults()?);
tauri::Builder::default().manage(project_repo)...

// Web版 (app_state.rs)
let project_repo: Arc<dyn ProjectRepository> =
    Arc::new(DynamoProjectRepository::new(dynamo.clone()));
```

---

## 5. Layer 2 Use Case パターン

### 5.1 基本形

```rust
// crates/ars-assembly/src/use_cases.rs

/// Layer 2: App版でもWeb版でも同じコードが動く
pub async fn add_core_assembly(
    repo: &dyn AssemblyConfigRepository,
    project_id: &str,
    assembly: CoreAssembly,
) -> Result<()> {
    let mut config = repo.load(project_id).await?.unwrap_or_default();
    if config.core_assemblies.iter().any(|a| a.id == assembly.id) {
        return Err(ArsError::Validation("Duplicate assembly ID".into()));
    }
    config.core_assemblies.push(assembly);
    repo.save(project_id, &config).await
}
```

### 5.2 App版での呼び出し（Layer 3a）

```rust
// AssemblyModule (ProjectModule impl)
pub async fn handle_add_core_assembly(&mut self, assembly: CoreAssembly) -> Result<()> {
    let project_id = self.project_id.as_ref().ok_or(ArsError::NotFound("No project"))?;
    ars_assembly::use_cases::add_core_assembly(&*self.repo, project_id, assembly).await?;
    // App版のみ: EventBus でイベント発火
    self.event_bus.emit(AssemblyConfigChanged { project_id: project_id.clone() }).await;
    Ok(())
}
```

### 5.3 Web版での呼び出し（Layer 3b）

```rust
// Axum handler
async fn api_add_core_assembly(
    State(state): State<AppState>,
    Json(req): Json<AddRequest>,
) -> Result<Json<()>, (StatusCode, String)> {
    // Web版: EventBus なし。use_case を直接呼ぶだけ
    ars_assembly::use_cases::add_core_assembly(
        state.assembly_repo.as_ref(), &req.project_id, req.assembly,
    ).await.map(Json).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}
```

---

## 6. フロントエンド連携（App版）

### 6.1 Tauri Event Bridge

```rust
// EventBus → Tauri event system → フロントエンド
async fn bridge_events_to_frontend(app: tauri::AppHandle, event_bus: &EventBus) {
    if let Some(mut rx) = event_bus.subscribe::<ProjectOpened>().await {
        let handle = app.clone();
        tokio::spawn(async move {
            while let Ok(event) = rx.recv().await {
                handle.emit("ars:project-opened", &event).ok();
            }
        });
    }
}
```

```typescript
// TypeScript 側
import { listen } from '@tauri-apps/api/event';

listen('ars:project-opened', (event) => {
    useProjectStore.getState().onProjectOpened(event.payload);
});
```

---

## 7. 機密情報管理 詳細

### 7.1 OS Keychain (Layer 1)

```rust
// keyring crate でクロスプラットフォーム対応
// Windows: Credential Manager (DPAPI)
// Linux: libsecret (GNOME Keyring / KDE Wallet)

pub struct KeychainService { service_name: String }
impl KeychainService {
    pub fn store(&self, key: &str, value: &str) -> Result<()>;
    pub fn retrieve(&self, key: &str) -> Result<String>;
}
```

| キー | 用途 |
|------|------|
| `github-oauth-token` | GitHubアクセストークン |
| `aws-access-key-id` | AWS認証 |
| `secrets-master-key` | secrets.toml 暗号化キー |

### 7.2 secrets.toml (Layer 2)

```toml
# ~/.ars/secrets/<project-id>/secrets.toml

[github]
client_id = "Ov23li..."
client_secret = "..."

[signing]
windows_pfx_path = "C:/certs/signing.pfx"
windows_pfx_password = "keychain:signing-pfx-password"  # Keychain参照

[custom]
analytics_api_key = "..."
```

---

## 8. Native Build 詳細

### 8.1 tauri.conf.json（変更予定）

```jsonc
{
  "productName": "Ars Editor",
  "version": "0.1.0",
  "identifier": "dev.ludiars.ars-editor",
  "bundle": {
    "targets": "all",
    "windows": {
      "digestAlgorithm": "sha256",
      "wix": { "language": ["ja-JP", "en-US"] }
    },
    "linux": {
      "deb": {
        "depends": ["libwebkit2gtk-4.1-0", "libgtk-3-0"],
        "section": "devel"
      }
    }
  }
}
```

### 8.2 CI/CD ワークフロー（Phase B）

```yaml
# .github/workflows/native-build.yml
on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        include:
          - { platform: windows-latest, target: x86_64-pc-windows-msvc }
          - { platform: ubuntu-22.04, target: x86_64-unknown-linux-gnu }
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: tauri-apps/tauri-action@v0
        with:
          tagName: ${{ github.ref_name }}
          releaseDraft: true
```

### 8.3 バージョニング

```
v<major>.<minor>.<patch>[-<pre>]
同期対象: tauri.conf.json, package.json, 各 Cargo.toml (workspace版)
```
