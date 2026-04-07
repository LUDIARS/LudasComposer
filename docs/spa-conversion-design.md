# Ars SPA 変換 設計書

## 1. 背景と目的

### 1.1 現状の課題

Ars Editor の Web 版は WebSocket によるリアルタイム共同編集（collab）機能を提供している。
現在のアーキテクチャでは以下の問題が存在する：

1. **OAuth ログインによるフルページリロード**
   - `<a href="/auth/github/login">` によるリンクナビゲーションで GitHub OAuth に遷移
   - OAuth コールバック後 `Redirect::temporary("/")` でルートにリダイレクト
   - この一連の流れでページが完全にリロードされ、WebSocket 接続が切断される

2. **SPA フォールバックの不備**
   - バックエンドの `ServeDir::new(dir)` は静的ファイルを提供するが、
     存在しないパスへのリクエストに対して `index.html` を返す SPA フォールバックが未設定
   - ブラウザリロードやディープリンクで 404 になる可能性がある

3. **ルーティング不在**
   - フロントエンドに React Router 等のクライアントサイドルーティングがない
   - URL が常に `/` のため、ブックマーク・共有・ブラウザ履歴が機能しない
   - プロジェクト・シーン単位のディープリンクが不可能

### 1.2 Cernere での先行事例

Cernere プロジェクトでは同様の課題を SPA 化により解決済み。
Ars でも同じパターンを適用し、WS セッションの安定性を向上させる。

### 1.3 ゴール

- ページ遷移時に WebSocket 接続を維持する
- OAuth フローでも WS セッションを断絶させない
- URL ベースのルーティングでディープリンク・ブックマークを可能にする
- Tauri デスクトップモードとの互換性を維持する

---

## 2. 現状アーキテクチャの整理

### 2.1 フロントエンド構成

```
ars-editor/src/
├── App.tsx                    # ルートコンポーネント（ナビ + ページ切替）
├── main.tsx                   # エントリポイント（i18n 初期化 → React render）
├── features/                  # 機能モジュール
│   ├── editor-page/          # メインエディタ（唯一のページ）
│   ├── project-settings/     # プロジェクト設定（未結合）
│   ├── node-editor/          # React Flow キャンバス
│   ├── scene-manager/        # シーン管理パネル
│   ├── component-editor/     # コンポーネントプロパティ
│   ├── behavior-editor/      # ビヘイビア編集
│   ├── sequence-editor/      # シーケンス編集（モーダル）
│   └── ...
├── stores/                    # Zustand ストア
│   ├── projectStore/         # プロジェクトデータ（メイン）
│   ├── editorStore.ts        # UI 状態
│   ├── authStore.ts          # 認証状態
│   ├── collabStore.ts        # コラボレーション状態
│   └── ...
├── lib/
│   ├── backend.ts            # Tauri/Web デュアルモード抽象化
│   ├── collab-client.ts      # WebSocket クライアント（自動再接続付き）
│   ├── auth-api.ts           # 認証 API ラッパー
│   └── ...
└── components/                # グローバル UI コンポーネント
```

**ナビゲーション方式**: `useState<Page>('editor')` による内部状態切替のみ
- `Page` 型は `'editor'` のみ定義
- URL 変更なし、ブラウザ履歴なし

### 2.2 バックエンド構成

```
ars-editor/src-tauri/src/
├── web_server.rs              # Axum サーバー本体 + ルーティング統合
├── web_main.rs                # Web サーバーエントリポイント
├── auth.rs                    # GitHub OAuth + セッション管理
├── collab.rs                  # WebSocket コラボレーション
├── web_modules/
│   ├── editor.rs              # プロジェクト・認証・クラウド・Git API
│   ├── module_manager.rs      # モジュール管理 API
│   ├── setup.rs               # 初期セットアップウィザード API
│   └── project_settings.rs    # プロジェクト設定 API
└── ...
```

**API ルート一覧**:

| プレフィックス | 用途 | 認証 |
|---|---|---|
| `/api/project/*` | ローカルファイル操作 | 不要 |
| `/api/cloud/project/*` | クラウド保存 (SurrealDB) | 必要 |
| `/api/git/*` | Git リポジトリ操作 | 必要 |
| `/api/modules/*` | モジュール管理 | 必要 |
| `/api/setup/*` | 初期セットアップ | 不要 |
| `/auth/*` | OAuth + セッション | - |
| `/ws/collab` | WebSocket コラボ | クエリパラメータ |

**静的ファイル配信**: `ServeDir::new(dir)` をフォールバックサービスとして設定
- SPA 対応（`index.html` へのフォールバック）は未実装

### 2.3 認証フロー（現状）

```
[フロントエンド]                    [バックエンド]                 [GitHub]
     |                                  |                           |
     |--- <a> click ("/auth/github/login") -->                      |
     |                                  |--- 302 Redirect --------->|
     |<--- (ブラウザがGitHubに遷移) ---|                           |
     |                                  |                           |
     |                                  |<-- callback (?code=X) ----|
     |                                  |--- セッション作成          |
     |<--- 302 Redirect to "/" ---------|                           |
     |                                  |                           |
     |--- (フルページリロード) -------->|                           |
     |    ★ WebSocket 切断             |                           |
```

### 2.4 WebSocket 接続管理（現状）

- **接続**: `App.tsx` の `useEffect` で `user && projectName` を検知して自動接続
- **自動再接続**: `collab-client.ts` で 3 秒間隔のリトライ
- **問題**: OAuth リダイレクトでページリロードが発生し、React ツリー全体が破棄される
  → WebSocket 切断 → 再接続までの間にカーソル位置やロック情報が失われる

---

## 3. SPA 変換方針

### 3.1 方針概要

| 項目 | 方針 |
|---|---|
| ルーティング | React Router v7 (BrowserRouter) を導入 |
| OAuth | ポップアップウィンドウ方式に変更（ページ遷移を回避） |
| SPA フォールバック | `ServeDir` + `ServeFile` で index.html フォールバック |
| 状態管理 | 既存の Zustand ストアをそのまま活用 |
| Tauri 互換 | `isTauri()` 分岐を維持 |

### 3.2 変更箇所マトリクス

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `package.json` | 依存追加 | `react-router` v7 |
| `src/main.tsx` | 修正 | `BrowserRouter` ラッパー追加 |
| `src/App.tsx` | 大幅修正 | ルート定義、レイアウト分離 |
| `src/App.tsx` (auth部分) | 修正 | OAuth ポップアップ方式に変更 |
| `src/lib/auth-api.ts` | 修正 | ポップアップ OAuth ヘルパー追加 |
| `src/components/OAuthCallback.tsx` | 新規 | OAuth コールバック処理コンポーネント |
| `src-tauri/src/auth.rs` | 修正 | コールバック後の応答を JSON/HTML に変更 |
| `src-tauri/src/web_server.rs` | 修正 | SPA フォールバック設定 |
| `vite.config.ts` | 修正 | SPA フォールバック（開発サーバー） |

---

## 4. 詳細設計

### 4.1 React Router 導入

#### ルート定義

```typescript
// src/routes.tsx
const routes = [
  {
    path: '/',
    element: <AppLayout />,       // ナビバー + コラボ接続
    children: [
      { index: true, element: <EditorPage /> },
      { path: 'settings', element: <ProjectSettingsPage /> },
    ],
  },
  { path: '/auth/callback', element: <OAuthCallback /> },
];
```

#### URL 設計

| パス | コンポーネント | 説明 |
|---|---|---|
| `/` | `EditorPage` | メインエディタ |
| `/settings` | `ProjectSettingsPage` | プロジェクト設定 |
| `/auth/callback` | `OAuthCallback` | OAuth コールバック処理 |

**注**: シーン選択やアクター選択は URL パラメータではなく、
既存の Zustand ストア (`editorStore`) で管理を継続する。
将来的に `/project/:id/scene/:sceneId` のような深いルーティングを
導入する余地は残すが、初期スコープでは含めない。

#### main.tsx 変更

```typescript
// src/main.tsx
import { BrowserRouter } from 'react-router';
import { useRoutes } from 'react-router';
import { routes } from './routes';

function AppRoutes() {
  return useRoutes(routes);
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AppRoutes />
  </BrowserRouter>
);
```

#### AppLayout（新コンポーネント）

現在の `App.tsx` からルーティング部分を分離し、レイアウトコンポーネントとする。

```typescript
// src/App.tsx → AppLayout
function AppLayout() {
  // 既存の初期化ロジック（セットアップチェック、認証、コラボ接続）
  // ...

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-900 text-zinc-200">
      <nav>
        {/* ナビゲーションバー - <Link> に変更 */}
        <Link to="/">Editor</Link>
        <Link to="/settings">Settings</Link>
      </nav>
      <div className="flex-1 overflow-hidden">
        <Outlet />  {/* 子ルートのレンダリング */}
      </div>
    </div>
  );
}
```

### 4.2 OAuth ポップアップ方式

#### フロー（変更後）

```
[メインウィンドウ]               [ポップアップ]              [バックエンド]
     |                              |                          |
     |-- window.open() ----------->|                          |
     |                              |-- /auth/github/login -->|
     |                              |                          |-- 302 to GitHub
     |                              |<-- GitHub callback ------|
     |                              |                          |-- セッション作成
     |                              |<-- HTML (postMessage) ---|
     |<-- message event ------------|                          |
     |   (認証成功通知)             |-- window.close() ------->|
     |                              |                          |
     |-- fetchUser() ------------->|                          |
     |   ★ WebSocket 維持          |                          |
```

#### フロントエンド実装

```typescript
// src/lib/auth-api.ts に追加
export function openOAuthPopup(): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    const popup = window.open(
      '/auth/github/login',
      'ars-oauth',
      'width=600,height=700,popup=yes'
    );

    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'ars-oauth-callback') {
        window.removeEventListener('message', handler);
        resolve({ success: event.data.success });
      }
    };
    window.addEventListener('message', handler);

    // ポップアップが閉じられた場合のフォールバック
    const timer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(timer);
        window.removeEventListener('message', handler);
        resolve({ success: false });
      }
    }, 500);
  });
}
```

#### App.tsx のログインボタン変更

```typescript
// 変更前
<a href="/auth/github/login">Sign in with GitHub</a>

// 変更後
<button onClick={async () => {
  const result = await openOAuthPopup();
  if (result.success) {
    await fetchUser();
  }
}}>
  Sign in with GitHub
</button>
```

#### バックエンド変更（auth.rs）

OAuth コールバックの応答を、ポップアップ用の HTML に変更：

```rust
// auth.rs - github_callback の最後
// 変更前: Redirect::temporary("/")
// 変更後: ポップアップ閉鎖用 HTML を返す

let html = r#"<!DOCTYPE html>
<html><body><script>
  window.opener.postMessage(
    { type: 'ars-oauth-callback', success: true },
    window.location.origin
  );
  window.close();
</script></body></html>"#;

Ok((jar.add(cookie).remove(clear_csrf), Html(html)))
```

### 4.3 SPA フォールバック（バックエンド）

#### web_server.rs 変更

```rust
use tower_http::services::{ServeDir, ServeFile};

// 変更前
let app = if let Some(dir) = static_dir {
    app.fallback_service(ServeDir::new(dir))
} else {
    app
};

// 変更後
let app = if let Some(ref dir) = static_dir {
    let index_path = format!("{}/index.html", dir);
    app.fallback_service(
        ServeDir::new(dir)
            .not_found_service(ServeFile::new(index_path))
    )
} else {
    app
};
```

これにより：
- `/assets/main.js` → 静的ファイルを返す
- `/settings` → `index.html` を返す（React Router が処理）
- `/unknown/path` → `index.html` を返す（React Router の 404 処理）

#### vite.config.ts 変更（開発サーバー）

```typescript
server: {
  port: 5174,
  proxy: {
    '/api': 'http://localhost:5173',
    '/auth': 'http://localhost:5173',
    '/ws': { target: 'ws://localhost:5173', ws: true },
  },
  // SPA フォールバック（Vite はデフォルトで有効だが明示）
  historyApiFallback: true,
},
```

> 注: Vite は開発サーバーで SPA フォールバックをデフォルト有効にしているため、
> 開発時は特別な設定は不要。プロキシ設定が API パスを正しくバックエンドに
> 転送していれば、残りのパスは自動的に `index.html` にフォールバックされる。

### 4.4 OAuthCallback コンポーネント

```typescript
// src/components/OAuthCallback.tsx
export function OAuthCallback() {
  useEffect(() => {
    // ポップアップから開かれた場合
    if (window.opener) {
      window.opener.postMessage(
        { type: 'ars-oauth-callback', success: true },
        window.location.origin
      );
      window.close();
      return;
    }
    // 直接アクセスされた場合（フォールバック）
    window.location.href = '/';
  }, []);

  return <div>Completing sign in...</div>;
}
```

> バックエンド側で HTML を直接返す方式と、このコンポーネント方式の
> 2 段構えとする。通常はバックエンド HTML が先に処理されるが、
> ユーザーが直接 `/auth/callback` にアクセスした場合の安全策。

### 4.5 Tauri デスクトップ互換性

Tauri モードでは以下の動作となる：

- **ルーティング**: React Router は動作するが、URL バーがないため実質的に影響なし
- **OAuth**: Tauri では `isTauri()` が true → ログインボタン非表示（既存動作を維持）
- **SPA フォールバック**: Tauri は `frontendDist` からファイルを配信 → 設定変更不要
- **WebSocket**: Tauri モードではコラボ機能未使用（`!isTauri()` ガード既存）

---

## 5. 実装計画

### Phase 1: バックエンド SPA フォールバック

**対象ファイル**: `src-tauri/src/web_server.rs`

1. `ServeDir::not_found_service(ServeFile)` で index.html フォールバックを追加
2. セットアップモードにも同様のフォールバックを追加

**影響範囲**: 最小（バックエンドのみ）
**リスク**: 低

### Phase 2: OAuth ポップアップ化

**対象ファイル**:
- `src-tauri/src/auth.rs` - コールバック応答変更
- `src/lib/auth-api.ts` - ポップアップヘルパー追加
- `src/App.tsx` - ログインボタン変更

**影響範囲**: 認証フローのみ
**リスク**: 中（OAuth のリダイレクト URI 設定に注意が必要）

### Phase 3: React Router 導入

**対象ファイル**:
- `package.json` - `react-router` 追加
- `src/main.tsx` - BrowserRouter ラッパー
- `src/App.tsx` - ルート定義 + レイアウト分離
- `src/routes.tsx` - ルート設定（新規）
- `src/components/OAuthCallback.tsx` - コールバック処理（新規）

**影響範囲**: フロントエンド全体のナビゲーション
**リスク**: 中（既存のナビゲーションロジックとの整合性確認が必要）

### Phase 4: ナビゲーション統合

**対象ファイル**:
- `src/App.tsx` - `<Link>` コンポーネントへの移行
- `src/components/Toolbar.tsx` - ナビゲーション対応

**影響範囲**: UI コンポーネント
**リスク**: 低

---

## 6. テスト方針

### 6.1 手動テストシナリオ

| シナリオ | 期待動作 |
|---|---|
| `/` にアクセス | エディタページが表示される |
| `/settings` にアクセス | 設定ページが表示される |
| `/settings` でブラウザリロード | 設定ページが再表示される（404 にならない） |
| OAuth ログイン | ポップアップが開き、認証後にメインウィンドウの WS が維持される |
| OAuth ログイン中にキャンバス操作 | メインウィンドウは操作可能（ポップアップは別ウィンドウ） |
| ページ遷移 (`/` ↔ `/settings`) | WebSocket 接続が切断されない |
| Tauri デスクトップで起動 | 既存動作と同一（ログインボタン非表示、ローカルモード） |
| 不正なパスにアクセス (`/foo/bar`) | index.html が返り、React Router で処理される |

### 6.2 WebSocket セッション維持確認

1. Web 版でログイン → コラボルームに接続
2. ページ遷移（`/` → `/settings` → `/`）を繰り返す
3. `collabStore.connected` が常に `true` であることを確認
4. 他ユーザーのカーソルが途切れず表示されることを確認

---

## 7. 依存関係とバージョン

| パッケージ | バージョン | 用途 |
|---|---|---|
| `react-router` | `^7.x` | クライアントサイドルーティング |
| `tower-http` | `0.5` (既存) | `ServeFile` は既にクレートに含まれる |

追加の Rust クレートは不要。`tower-http` の `ServeFile` は `ServeDir` と
同じモジュールに含まれている。

---

## 8. 将来の拡張可能性

本設計では初期スコープを最小限に抑えているが、以下の拡張が容易に可能：

1. **ディープリンク**: `/project/:projectId/scene/:sceneId` 形式の URL ルーティング
2. **コードスプリッティング**: `React.lazy()` によるルート単位の遅延読み込み
3. **オフライン対応**: Service Worker 追加による PWA 化
4. **セッションリストア**: URL パラメータによるエディタ状態の復元
