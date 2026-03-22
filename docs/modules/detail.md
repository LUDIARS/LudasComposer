# Ars モジュールシステム 詳細設計書

## 1. EventBus 詳細設計

### 1.1 設計目標

- プラグインが独自イベント型を定義・発火・購読できる
- 型安全: コンパイル時にイベント型を検証
- 依存宣言: 他モジュールのイベントを購読するには `depends_on` が必要
- 全ハンドラはモジュール起動時に一括登録される

### 1.2 イベントの基本フォーマット

```rust
// crates/ars-core/src/event.rs

use std::any::{Any, TypeId};
use std::fmt::Debug;

/// 全イベントが実装する基底 trait
pub trait ArsEvent: Any + Debug + Send + Sync + Clone + 'static {
    /// このイベントを定義したモジュールID
    /// コアイベントは "core"、プラグインは自身のID
    fn source_module(&self) -> &'static str;

    /// イベントのカテゴリ（ログ・デバッグ用）
    fn category(&self) -> &'static str;
}

/// ArsEvent → Any ダウンキャスト用ヘルパー
impl dyn ArsEvent {
    pub fn downcast_ref<T: ArsEvent>(&self) -> Option<&T> {
        (self as &dyn Any).downcast_ref::<T>()
    }
}
```

### 1.3 コアイベント定義

```rust
// crates/ars-core/src/events/project.rs

/// プロジェクトが開かれた
#[derive(Debug, Clone)]
pub struct ProjectOpened {
    pub project_id: String,
    pub project_root: PathBuf,
}

impl ArsEvent for ProjectOpened {
    fn source_module(&self) -> &'static str { "core" }
    fn category(&self) -> &'static str { "project.lifecycle" }
}

/// プロジェクトが閉じられた
#[derive(Debug, Clone)]
pub struct ProjectClosed {
    pub project_id: String,
}

impl ArsEvent for ProjectClosed {
    fn source_module(&self) -> &'static str { "core" }
    fn category(&self) -> &'static str { "project.lifecycle" }
}

/// プロジェクトが保存された
#[derive(Debug, Clone)]
pub struct ProjectSaved {
    pub project_id: String,
}

impl ArsEvent for ProjectSaved {
    fn source_module(&self) -> &'static str { "core" }
    fn category(&self) -> &'static str { "project.lifecycle" }
}
```

```rust
// crates/ars-core/src/events/scene.rs

#[derive(Debug, Clone)]
pub struct SceneActivated {
    pub scene_id: String,
}

impl ArsEvent for SceneActivated {
    fn source_module(&self) -> &'static str { "core" }
    fn category(&self) -> &'static str { "scene" }
}

#[derive(Debug, Clone)]
pub struct ActorAdded {
    pub scene_id: String,
    pub actor_id: String,
}

impl ArsEvent for ActorAdded {
    fn source_module(&self) -> &'static str { "core" }
    fn category(&self) -> &'static str { "scene" }
}

#[derive(Debug, Clone)]
pub struct ActorRemoved {
    pub scene_id: String,
    pub actor_id: String,
}

impl ArsEvent for ActorRemoved {
    fn source_module(&self) -> &'static str { "core" }
    fn category(&self) -> &'static str { "scene" }
}

#[derive(Debug, Clone)]
pub struct ComponentAttached {
    pub actor_id: String,
    pub component_id: String,
}

impl ArsEvent for ComponentAttached {
    fn source_module(&self) -> &'static str { "core" }
    fn category(&self) -> &'static str { "scene" }
}

#[derive(Debug, Clone)]
pub struct ComponentDetached {
    pub actor_id: String,
    pub component_id: String,
}

impl ArsEvent for ComponentDetached {
    fn source_module(&self) -> &'static str { "core" }
    fn category(&self) -> &'static str { "scene" }
}
```

```rust
// crates/ars-core/src/events/assembly.rs

#[derive(Debug, Clone)]
pub struct AssemblyConfigChanged {
    pub project_id: String,
}

impl ArsEvent for AssemblyConfigChanged {
    fn source_module(&self) -> &'static str { "assembly" }
    fn category(&self) -> &'static str { "assembly" }
}

#[derive(Debug, Clone)]
pub struct PlatformChanged {
    pub platform: BackendPlatform,
}

impl ArsEvent for PlatformChanged {
    fn source_module(&self) -> &'static str { "assembly" }
    fn category(&self) -> &'static str { "assembly" }
}
```

```rust
// crates/ars-core/src/events/resource.rs

#[derive(Debug, Clone)]
pub struct ResourceImported {
    pub resource_id: String,
    pub resource_type: String,
}

impl ArsEvent for ResourceImported {
    fn source_module(&self) -> &'static str { "resource-depot" }
    fn category(&self) -> &'static str { "resource" }
}
```

```rust
// crates/ars-core/src/events/auth.rs

#[derive(Debug, Clone)]
pub struct UserAuthenticated {
    pub user_id: String,
}

impl ArsEvent for UserAuthenticated {
    fn source_module(&self) -> &'static str { "auth" }
    fn category(&self) -> &'static str { "auth" }
}

#[derive(Debug, Clone)]
pub struct UserLoggedOut;

impl ArsEvent for UserLoggedOut {
    fn source_module(&self) -> &'static str { "auth" }
    fn category(&self) -> &'static str { "auth" }
}
```

### 1.4 プラグインイベント定義の例

```rust
// plugins/ars-plugin-ergo/src/events.rs

/// Ergoコード生成が完了した
#[derive(Debug, Clone)]
pub struct ErgoCodeGenerated {
    pub module_id: String,
    pub output_path: PathBuf,
    pub platform: BackendPlatform,
}

impl ArsEvent for ErgoCodeGenerated {
    fn source_module(&self) -> &'static str { "plugin-ergo" }
    fn category(&self) -> &'static str { "codegen" }
}

/// Ergoコード生成でエラーが発生した
#[derive(Debug, Clone)]
pub struct ErgoCodeGenFailed {
    pub module_id: String,
    pub error: String,
}

impl ArsEvent for ErgoCodeGenFailed {
    fn source_module(&self) -> &'static str { "plugin-ergo" }
    fn category(&self) -> &'static str { "codegen" }
}
```

### 1.5 EventBus 実装

```rust
// crates/ars-core/src/event_bus.rs

use std::any::TypeId;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

type ErasedSender = Box<dyn Any + Send + Sync>;

/// 型安全・プラグイン拡張可能なイベントバス
pub struct EventBus {
    /// TypeId → broadcast::Sender<T> (型消去して保持)
    channels: RwLock<HashMap<TypeId, ErasedSender>>,
    /// イベント型 → それを発火するモジュールID（デバッグ・検証用）
    event_sources: RwLock<HashMap<TypeId, &'static str>>,
    /// バッファサイズ
    buffer_size: usize,
}

impl EventBus {
    pub fn new(buffer_size: usize) -> Self {
        Self {
            channels: RwLock::new(HashMap::new()),
            event_sources: RwLock::new(HashMap::new()),
            buffer_size,
        }
    }

    /// イベントチャンネルを登録する（モジュール起動時に呼ぶ）
    ///
    /// source_module_id: このイベントを発火するモジュールのID
    pub async fn register_event<E: ArsEvent>(&self, source_module_id: &'static str) {
        let type_id = TypeId::of::<E>();
        let mut channels = self.channels.write().await;
        if !channels.contains_key(&type_id) {
            let (tx, _) = broadcast::channel::<E>(self.buffer_size);
            channels.insert(type_id, Box::new(tx));
        }
        self.event_sources.write().await.insert(type_id, source_module_id);
    }

    /// イベントを発火する
    pub async fn emit<E: ArsEvent>(&self, event: E) {
        let type_id = TypeId::of::<E>();
        let channels = self.channels.read().await;
        if let Some(sender) = channels.get(&type_id) {
            if let Some(tx) = sender.downcast_ref::<broadcast::Sender<E>>() {
                let _ = tx.send(event);
            }
        }
    }

    /// イベントを購読する
    ///
    /// 呼び出し元モジュールは depends_on にイベント発火元を含めること。
    pub async fn subscribe<E: ArsEvent>(&self) -> Option<broadcast::Receiver<E>> {
        let type_id = TypeId::of::<E>();
        let channels = self.channels.read().await;
        channels.get(&type_id)
            .and_then(|sender| sender.downcast_ref::<broadcast::Sender<E>>())
            .map(|tx| tx.subscribe())
    }

    /// 登録済みイベントの発火元モジュールIDを取得（依存検証用）
    pub async fn get_event_source<E: ArsEvent>(&self) -> Option<&'static str> {
        let type_id = TypeId::of::<E>();
        self.event_sources.read().await.get(&type_id).copied()
    }
}
```

### 1.6 依存検証

```rust
// crates/ars-core/src/module_host.rs (抜粋)

impl ModuleHost {
    /// モジュール登録時にイベント購読の依存関係を検証
    async fn validate_event_dependencies(&self) -> Result<()> {
        // 各モジュールが購読するイベントの source_module が
        // そのモジュールの depends_on に含まれているか検証
        //
        // 例: plugin-ergo が PlatformChanged を購読
        //     → PlatformChanged.source_module() == "assembly"
        //     → plugin-ergo.depends_on に "assembly" が含まれていること
        //
        // 違反があれば起動時エラー（ランタイムではなく設定ミス）
        Ok(())
    }
}
```

### 1.7 イベント登録フロー

```
Module startup
 │
 ├─ register_event<MyCustomEvent>("my-module-id")   ← 自分が発火するイベントを登録
 │
 ├─ subscribe<PlatformChanged>()                    ← 他モジュールのイベントを購読
 │   └─ depends_on: ["assembly"] が必須
 │
 └─ spawn event listener task
     └─ while let Ok(event) = rx.recv().await { ... }
```

### 1.8 ルール一覧

| ルール | 説明 |
|--------|------|
| **R1** | イベント発火は `register_event` でチャンネル登録済みの型のみ |
| **R2** | 他モジュールのイベントを購読するには `depends_on` に発火元を宣言 |
| **R3** | 全ハンドラ登録は `initialize` / `on_project_open` 内で完了すること |
| **R4** | イベントハンドラ内で同期的にイベントを発火しない（デッドロック防止） |
| **R5** | コアイベント（source_module = "core"）は全モジュールが依存宣言なしで購読可能 |
| **R6** | プラグインイベントを購読するモジュールは、そのプラグインの不在を考慮する（Optional依存） |

---

## 2. モジュール trait 詳細

### 2.1 AppModule

```rust
// crates/ars-core/src/module.rs

#[async_trait]
pub trait AppModule: Send + Sync + 'static {
    fn info(&self) -> ModuleInfo;

    /// アプリ起動時: グローバルリソース初期化 + イベント登録
    async fn initialize(&mut self, event_bus: &EventBus) -> Result<()>;

    /// アプリ終了時: クリーンアップ
    async fn shutdown(&mut self) -> Result<()>;

    fn as_any(&self) -> &dyn Any;
    fn as_any_mut(&mut self) -> &mut dyn Any;
}
```

### 2.2 ProjectModule

```rust
#[async_trait]
pub trait ProjectModule: Send + Sync + 'static {
    fn info(&self) -> ModuleInfo;

    /// プロジェクト Open: サービス初期化 + イベント登録
    async fn on_project_open(
        &mut self,
        ctx: &ProjectContext,
        event_bus: &EventBus,
    ) -> Result<()>;

    /// プロジェクト保存
    async fn on_project_save(&mut self) -> Result<()>;

    /// プロジェクト Close: クリーンアップ
    async fn on_project_close(&mut self) -> Result<()>;

    fn as_any(&self) -> &dyn Any;
    fn as_any_mut(&mut self) -> &mut dyn Any;
}
```

### 2.3 ProjectContext

```rust
/// プロジェクト Open 時に渡されるコンテキスト
pub struct ProjectContext {
    pub project_id: String,
    pub project_root: PathBuf,
    pub platform: BackendPlatform,
}
```

### 2.4 ModuleInfo

```rust
pub struct ModuleInfo {
    /// モジュール識別子（グローバルに一意）
    pub id: &'static str,
    /// 表示名
    pub name: &'static str,
    /// スコープ
    pub scope: ModuleScope,
    /// 初期化順序の依存先
    pub depends_on: &'static [&'static str],
    /// このモジュールが発火するイベント型（TypeId のリスト）
    /// 起動時に EventBus.register_event() を呼ぶ
    pub emits: fn() -> Vec<TypeId>,
    /// このモジュールが購読するイベント型（TypeId のリスト）
    /// depends_on の検証に使用
    pub subscribes: fn() -> Vec<TypeId>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ModuleScope {
    App,
    Project,
}
```

---

## 3. ModuleHost 詳細

### 3.1 構造

```rust
pub struct ModuleHost {
    app_modules: Vec<(ModuleInfo, Arc<RwLock<dyn AppModule>>)>,
    project_modules: Vec<(ModuleInfo, Arc<RwLock<dyn ProjectModule>>)>,
    event_bus: Arc<EventBus>,
    active_project: Option<ProjectContext>,
}
```

### 3.2 起動シーケンス

```
ModuleHost::new()
 │
 ├─ register_app_module(AuthModule)
 ├─ register_app_module(SecretsModule)
 ├─ register_app_module(ModuleRegistryModule)
 ├─ register_app_module(GitModule)
 │
 ├─ register_project_module(AssemblyModule)
 ├─ register_project_module(ResourceDepotModule)
 ├─ register_project_module(DataOrganizerModule)
 ├─ register_project_module(CollabModule)
 ├─ register_project_module(ErgoModule)       ← プラグイン
 ├─ register_project_module(PictorModule)     ← プラグイン
 │
 ├─ validate_dependencies()                   ← トポロジカルソート + 循環検出
 ├─ validate_event_dependencies()             ← イベント購読の依存チェック
 │
 └─ startup()
     ├─ auth.initialize(&event_bus)           ← depends_on 順
     ├─ secrets.initialize(&event_bus)
     ├─ module-registry.initialize(&event_bus)
     └─ git.initialize(&event_bus)
```

### 3.3 プロジェクト Open シーケンス

```
open_project(project_root, project_id)
 │
 ├─ close_project() if active
 │
 ├─ ProjectContext 構築
 │   └─ platform は ars-project.toml から読み取り
 │
 ├─ assembly.on_project_open(&ctx, &event_bus)
 ├─ resource-depot.on_project_open(&ctx, &event_bus)
 ├─ data-organizer.on_project_open(&ctx, &event_bus)
 ├─ collab.on_project_open(&ctx, &event_bus)
 ├─ plugin-ergo.on_project_open(&ctx, &event_bus)
 ├─ plugin-pictor.on_project_open(&ctx, &event_bus)
 │
 └─ event_bus.emit(ProjectOpened { ... })
```

---

## 4. プラグインのイベント拡張パターン

### 4.1 プラグインがイベントを追加する

```rust
// plugins/ars-plugin-ergo/src/module.rs

impl ProjectModule for ErgoModule {
    fn info(&self) -> ModuleInfo {
        ModuleInfo {
            id: "plugin-ergo",
            name: "Ergo Code Generator",
            scope: ModuleScope::Project,
            depends_on: &["assembly"],
            emits: || vec![
                TypeId::of::<ErgoCodeGenerated>(),
                TypeId::of::<ErgoCodeGenFailed>(),
            ],
            subscribes: || vec![
                TypeId::of::<PlatformChanged>(),       // assembly が発火
                TypeId::of::<ComponentAttached>(),      // core が発火
            ],
        }
    }

    async fn on_project_open(&mut self, ctx: &ProjectContext, event_bus: &EventBus) -> Result<()> {
        // 1. 自分のイベントチャンネルを登録
        event_bus.register_event::<ErgoCodeGenerated>("plugin-ergo").await;
        event_bus.register_event::<ErgoCodeGenFailed>("plugin-ergo").await;

        // 2. 他モジュールのイベントを購読
        let mut platform_rx = event_bus.subscribe::<PlatformChanged>().await
            .expect("PlatformChanged channel not registered");
        let mut component_rx = event_bus.subscribe::<ComponentAttached>().await
            .expect("ComponentAttached channel not registered");

        // 3. コード生成エンジン初期化
        self.codegen = Some(ErgoCodegen::new(&ctx.project_root, &ctx.platform));

        // 4. イベントリスナーを起動
        let event_bus = event_bus.clone();
        let codegen = self.codegen.clone();
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    Ok(event) = platform_rx.recv() => {
                        // プラットフォーム変更 → テンプレート再生成
                        if let Some(ref cg) = codegen {
                            cg.update_platform(event.platform);
                        }
                    }
                    Ok(event) = component_rx.recv() => {
                        // コンポーネント追加 → コード生成
                        if let Some(ref cg) = codegen {
                            match cg.generate(&event.component_id) {
                                Ok(path) => {
                                    event_bus.emit(ErgoCodeGenerated {
                                        module_id: event.component_id.clone(),
                                        output_path: path,
                                        platform: cg.platform(),
                                    }).await;
                                }
                                Err(e) => {
                                    event_bus.emit(ErgoCodeGenFailed {
                                        module_id: event.component_id,
                                        error: e.to_string(),
                                    }).await;
                                }
                            }
                        }
                    }
                }
            }
        });

        Ok(())
    }
}
```

### 4.2 他のプラグインが Ergo イベントを購読する

```rust
// plugins/ars-plugin-pictor/src/module.rs

impl ProjectModule for PictorModule {
    fn info(&self) -> ModuleInfo {
        ModuleInfo {
            id: "plugin-pictor",
            name: "Pictor Renderer",
            scope: ModuleScope::Project,
            depends_on: &["assembly", "plugin-ergo"],  // ← Ergo に依存
            emits: || vec![TypeId::of::<LookdevUpdated>()],
            subscribes: || vec![
                TypeId::of::<ErgoCodeGenerated>(),     // ← Ergo のイベントを購読
                TypeId::of::<ResourceImported>(),
            ],
        }
    }
}
```

### 4.3 Optional 依存（プラグイン不在への対応）

```rust
// plugin-ergo が未インストールの場合
async fn on_project_open(&mut self, ctx: &ProjectContext, event_bus: &EventBus) -> Result<()> {
    // subscribe は Option を返す → None ならプラグイン未登録
    if let Some(mut rx) = event_bus.subscribe::<ErgoCodeGenerated>().await {
        // Ergo がいる場合のみリスナー起動
        tokio::spawn(async move {
            while let Ok(event) = rx.recv().await {
                // ...
            }
        });
    }
    // Ergo がいなくても Pictor は動作する
    Ok(())
}
```

Optional依存の場合は `depends_on` に含めず、`subscribe` の戻り値で有無を判定する。

---

## 5. フロントエンド（TypeScript）連携

### 5.1 Tauri イベント連携

```rust
// Rust側: ArsEvent → Tauri の event system にブリッジ
async fn bridge_events_to_frontend(
    app_handle: tauri::AppHandle,
    event_bus: &EventBus,
) {
    // コアイベントをフロントエンドに転送
    if let Some(mut rx) = event_bus.subscribe::<ProjectOpened>().await {
        let handle = app_handle.clone();
        tokio::spawn(async move {
            while let Ok(event) = rx.recv().await {
                handle.emit("ars:project-opened", &event).ok();
            }
        });
    }
    // 他のイベントも同様...
}
```

```typescript
// TypeScript側: Tauri イベントを Zustand store に反映
import { listen } from '@tauri-apps/api/event';

// projectStore.ts
listen<ProjectOpened>('ars:project-opened', (event) => {
  useProjectStore.getState().onProjectOpened(event.payload);
});
```

---

## 6. 既存コードからの移行パス

| Phase | 作業 | 影響範囲 |
|-------|------|---------|
| **Phase 1** | `ars-core` に EventBus + module traits 実装 | 新規。既存コードに影響なし |
| **Phase 2** | 既存サービスを Module trait でラップ | `src-tauri/src/services/*` → 各 crate |
| **Phase 3** | ModuleHost に統合。`run()` を書き換え | `ars-editor/src-tauri/src/lib.rs` |
| **Phase 4** | プラグインを独立リポジトリに分離 | 新規リポジトリ作成 |
| **Phase 5** | フロントエンド連携（Tauri event bridge） | `ars-editor/src/stores/*` |
