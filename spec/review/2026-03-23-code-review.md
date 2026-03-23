# Ars 包括的コードレビュー (2026-03-23)

## レビュー範囲

- **Rust バックエンド**: `crates/ars-core`, `crates/ars-project`, `ars-editor/src-tauri`
- **フロントエンド**: `ars-editor/src/` (React + TypeScript)
- **ツール**: `tools/ars-codegen`, `tools/ars-mcp-server`
- **インフラ**: Dockerfile, docker-compose.yaml, CI/CD workflows

---

## 1. セキュリティ脆弱性

### 1.1 [Critical] パストラバーサル — ファイル操作

- **場所**: `ars-editor/src-tauri/src/commands/project.rs:23-50`
- **問題**: `load_project_impl` / `save_project_impl` がユーザー提供のパスをそのまま `fs::read_to_string` / `fs::write` に渡している。`../../etc/passwd` のようなパスで任意ファイルの読み書きが可能
- **対策**: `canonicalize()` でパス正規化し、許可ディレクトリ内かチェック

### 1.2 [Critical] OAuth CSRF 未対策

- **場所**: `ars-editor/src-tauri/src/auth.rs:47-51`
- **問題**: `OAuthCallbackQuery.state` が `Option<String>` で `#[allow(dead_code)]` 付き。完全に無視されている
- **対策**: ログイン開始時にランダムnonce生成、callback時に照合

### 1.3 [High] 平文でのトークン保存

- **場所**: `crates/ars-core/src/models/auth.rs:38-41`
- **問題**: `access_token` が JSON ファイルに平文で保存。コメントでKeychain移行予定とあるが未実装
- **対策**: `ars-secrets` モジュール実装を優先。`keyring` crate でOS Keychain利用

### 1.4 [High] Cookie に Secure フラグ未設定

- **場所**: `ars-editor/src-tauri/src/auth.rs:160-166`
- **問題**: `http_only(true)` と `same_site(Lax)` は設定されているが、`.secure(true)` が未設定
- **対策**: 本番環境では `.secure(true)` を追加

### 1.5 [High] サブプロセスへの環境変数漏洩

- **場所**: `tools/ars-codegen/src/session-runner.ts:155`
- **問題**: `...process.env` を展開してClaudeサブプロセスに渡している。APIキー等の機密値が意図せず渡される
- **対策**: 必要な変数だけホワイトリストで渡す

### 1.6 [Medium] レートリミットなし

- **場所**: `ars-editor/src-tauri/src/web_server.rs:15-45`
- **問題**: 全エンドポイントにレートリミットなし
- **対策**: `tower-governor` 等でミドルウェア追加

### 1.7 [Medium] SVG Injection リスク

- **場所**: `ars-editor/src/features/node-editor/components/CollabCursors.tsx:56`
- **問題**: `user.display_name` がサーバーから取得されたまま SVG `<text>` 内にレンダリング
- **対策**: サニタイズまたはテキスト長制限

### 1.8 [Medium] GitHub API トークンのスコープ未検証

- **場所**: `ars-editor/src-tauri/src/auth.rs:84-102`
- **問題**: OAuthで取得したトークンのスコープを検証していない
- **対策**: トークン取得後に必要なスコープ保持を確認

---

## 2. アーキテクチャ

### 2.1 [High] モデル定義の重複

- **場所**:
  - `crates/ars-core/src/models/project.rs` (Component, Actor, Scene, Project)
  - `ars-editor/src-tauri/src/models/` (同一構造体の再定義)
- **問題**: 同じ構造体が2箇所で定義。変更時の同期漏れリスク大
- **対策**: `ars-core` に統一して再エクスポート。`surreal_repo.rs` のJSON round-trip変換 (113-119行) も解消

### 2.2 [High] TypeScript 型定義の重複

- **場所**:
  - `tools/ars-codegen/src/types.ts`
  - `tools/ars-mcp-server/src/types.ts`
- **問題**: 完全同一のインターフェース群が2ファイルに存在。136行の重複コード
- **対策**: `packages/ars-types` 共有パッケージに抽出

### 2.3 [Medium] editor.rs の責務過多

- **場所**: `ars-editor/src-tauri/src/web_modules/editor.rs` (297行)
- **問題**: ローカルファイル操作、クラウド操作、Git操作、認証を1モジュールで処理
- **対策**: `local.rs`, `cloud.rs`, `git.rs` に分離

### 2.4 [Medium] fetchJson の重複

- **場所**: `ars-editor/src/lib/auth-api.ts`, `settings-api.ts`, `backend.ts`
- **問題**: 同一の `fetchJson` 関数が3ファイルに存在
- **対策**: 共通ユーティリティに抽出

### 2.5 [Medium] プロジェクトスキャンロジックの重複

- **場所**:
  - `tools/ars-codegen/src/project-loader.ts:14-36`
  - `tools/ars-mcp-server/src/project-manager.ts:27-43`
- **問題**: `.ars.json` ファイルの再帰探索ロジックが2ツールで重複
- **対策**: 共有ユーティリティに抽出

---

## 3. エラーハンドリング

### 3.1 [High] 起動時の panic

- **場所**:
  - `ars-editor/src-tauri/src/lib.rs:30-41` — リポジトリ初期化
  - `ars-editor/src-tauri/src/app_state.rs:33-41` — DB初期化
  - `ars-editor/src-tauri/src/app_state.rs:50-56` — 環境変数
- **問題**: すべて `.expect()` でパニック。DB不通やenv未設定で即クラッシュ
- **対策**: `Result` を返してグレースフルに処理

### 3.2 [Medium] String型エラーの乱用

- **場所**: `git_ops.rs`, `surrealdb_client.rs`, `redis_client.rs` の全関数
- **問題**: `Result<T, String>` でエラーコンテキストが失われる。`std::error::Error` 未実装
- **対策**: `thiserror::Error` を使った専用エラー型の定義

### 3.3 [Medium] サイレントエラー

- **場所**:
  - `ars-editor/src-tauri/src/collab.rs:191, 201, 248, 324, 343` — `let _ =` パターン
  - `tools/ars-codegen/src/session-runner.ts:208-210` — 空catch
  - `tools/ars-codegen/src/project-loader.ts:33-35` — 空catch
  - `ars-editor/src/lib/collab-client.ts:40` — パースエラー無視
- **問題**: エラーが完全に無視され、デバッグ不能
- **対策**: 最低限 `warn!` / `console.warn` でロギング

### 3.4 [Low] プロジェクト一覧のパースエラー無視

- **場所**: `crates/ars-project/src/local_project.rs:86-102`
- **問題**: `serde_json::from_str` の失敗を `if let Ok` で黙殺
- **対策**: ロギング追加

---

## 4. 型安全性

### 4.1 [High] unsafe な JSON round-trip 変換

- **場所**: `ars-editor/src-tauri/src/surreal_repo.rs:112-119`
- **問題**: `serde_json::to_value(p).unwrap()` + `serde_json::from_value(json).unwrap()` で型変換。失敗時パニック
- **対策**: モデル統一 (2.1の解決) で変換自体を不要に

### 4.2 [Medium] ActorNode の二重キャスト

- **場所**: `ars-editor/src/features/node-editor/components/ActorNode.tsx:19`
- **問題**: `data as unknown as ActorNodeData` — TypeScript の型安全を完全にバイパス
- **対策**: React Flow の型パラメータ指定または型ガード追加

### 4.3 [Medium] ID型の弱さ

- **場所**: コードベース全体
- **問題**: すべてのID (Project, Actor, Scene, Component) が `String` 型。フォーマット検証なし
- **対策**: newtype パターン (`pub struct ProjectId(String)`) で型安全なID管理

### 4.4 [Medium] TaskEditor の `unknown` 型

- **場所**: `ars-editor/src/features/component-editor/components/TaskEditor.tsx:74`
- **問題**: `updateTask(index, field, value: unknown)` でフィールドに不正な型を設定可能
- **対策**: ジェネリクスまたはオーバーロードで型制約

---

## 5. 並行性

### 5.1 [Medium] コラボレーションのレースコンディション

- **場所**: `ars-editor/src-tauri/src/collab.rs:299-318`
- **問題**: ロック取得の get-then-insert がアトミックでない
- **対策**: `entry()` API で原子的なチェック＆挿入

### 5.2 [Medium] useUndoRedo のレースコンディション

- **場所**: `ars-editor/src/features/node-editor/hooks/useUndoRedo.ts:13-23`
- **問題**: 高速なstate変更時にJSON比較で同一スナップショットが複数pushされる可能性
- **対策**: デバウンス追加

### 5.3 [Low] CollabStore のクリーンアップ不足

- **場所**: `ars-editor/src/stores/collabStore.ts:33-50`
- **問題**: `joinRoom` で `disconnect()` 後にunsubscribeが失われるケース
- **対策**: ステートガード追加

---

## 6. パフォーマンス

### 6.1 [Medium] ScenePreview の不要な再レンダリング

- **場所**: `ars-editor/src/features/preview/components/ScenePreview.tsx:19-107`
- **問題**: `ActorPreviewNode` が `React.memo` なしで再帰レンダリング
- **対策**: `React.memo` でメモ化

### 6.2 [Low] CollabStore の不要なMap再生成

- **場所**: `ars-editor/src/stores/collabStore.ts:83-90`
- **問題**: `room_state` メッセージ受信のたびに新Map生成
- **対策**: 差分チェック後に生成

### 6.3 [Low] ネットワークリクエストのタイムアウトなし

- **場所**: `ars-editor/src/lib/` 配下の全 fetch 呼び出し
- **問題**: タイムアウト未設定で無限待機の可能性
- **対策**: `AbortController` で30秒タイムアウト設定

---

## 7. CI/CD・インフラ

### 7.1 [Medium] Docker イメージの非決定的ビルド

- **場所**: `Dockerfile:13, 24, 51`
- **問題**: `FROM node:20-slim`, `FROM rust:1-bookworm` 等でダイジェストピン未使用
- **対策**: SHA256ダイジェストでピン止め

### 7.2 [Medium] ヘルスチェック未設定

- **場所**: `docker-compose.yaml`, `Dockerfile`
- **問題**: HEALTHCHECK ディレクティブなし
- **対策**: HTTPヘルスエンドポイント追加 + compose の `healthcheck` 設定

### 7.3 [Medium] バージョン更新時のロックファイル漏れ

- **場所**: `.github/workflows/update-web-version.yml:87-95`
- **問題**: `package.json` と `Cargo.toml` のみコミットし、ロックファイルが含まれない
- **対策**: `package-lock.json`, `Cargo.lock` もコミット対象に追加

### 7.4 [Low] Docker Compose でのシークレット直接渡し

- **場所**: `docker-compose.yaml:39-41`
- **問題**: `GITHUB_CLIENT_SECRET` が環境変数でそのまま渡される
- **対策**: Docker Secrets または外部シークレットマネージャ利用

---

## 8. アクセシビリティ

### 8.1 [Medium] アイコンボタンに aria-label なし

- **場所**: `App.tsx:70-76`, `ProjectManager.tsx:177`, `ActorNode.tsx:160-192`
- **対策**: すべてのアイコンボタンに `aria-label` 追加

### 8.2 [Medium] コンテキストメニューのキーボード操作未対応

- **場所**: `ars-editor/src/features/node-editor/components/ContextMenu.tsx`
- **対策**: Enter/Escape/Arrow キーハンドラ追加

### 8.3 [Low] カラーのみの識別

- **場所**: `ars-editor/src/features/node-editor/types/nodes.ts:17-21`
- **問題**: ロール区別が色のみ (blue/green/orange) で色覚異常者に不親切
- **対策**: アイコンまたはテキストラベルを併用

---

## 9. テスト・品質

### 9.1 [Medium] テスト不足

- **場所**: Rust側は `event_bus.rs` のみテストあり。フロントエンドはテストゼロ
- **対策**: 以下を優先的にテスト追加:
  - Repository 実装の単体テスト
  - 認証フローのモックテスト
  - フロントエンドストアのユニットテスト

### 9.2 [Medium] 構造的バリデーション不足

- **場所**: `crates/ars-core/src/models/project.rs`
- **問題**: コンポーネント依存の循環検出、シーン参照の有効性検証がない
- **対策**: バリデーション関数追加

### 9.3 [Low] Observability なし

- **場所**: Rust バックエンド全体
- **問題**: 構造化ログ (`tracing`) もメトリクスもなし。`log = "0.4"` のみ
- **対策**: `tracing` + `tracing-subscriber` 導入

---

## 10. 優先度別サマリー

### 即時対応 (Critical/High)

| # | 問題 | 分類 |
|---|------|------|
| 1 | パストラバーサル (commands/project.rs) | セキュリティ |
| 2 | OAuth CSRF 未対策 (auth.rs) | セキュリティ |
| 3 | 平文トークン保存 (auth.rs) | セキュリティ |
| 4 | Cookie Secure フラグ (auth.rs) | セキュリティ |
| 5 | 起動時 panic (lib.rs, app_state.rs) | エラーハンドリング |
| 6 | モデル定義の重複 (ars-core vs src-tauri) | アーキテクチャ |
| 7 | unsafe JSON変換 (surreal_repo.rs) | 型安全性 |
| 8 | 環境変数漏洩 (session-runner.ts) | セキュリティ |

### 短期対応 (Medium)

| # | 問題 | 分類 |
|---|------|------|
| 9 | String型エラーの乱用 | エラーハンドリング |
| 10 | レートリミットなし | セキュリティ |
| 11 | TypeScript型定義の重複 | アーキテクチャ |
| 12 | editor.rs 責務過多 | アーキテクチャ |
| 13 | fetchJson 重複 | コード品質 |
| 14 | コラボレーションのレース条件 | 並行性 |
| 15 | テスト不足 | 品質 |
| 16 | アクセシビリティ | UX |

### 長期対応 (Low)

| # | 問題 | 分類 |
|---|------|------|
| 17 | Dockerイメージのダイジェストピン | インフラ |
| 18 | ネットワークタイムアウト | パフォーマンス |
| 19 | ID型の newtype 化 | 型安全性 |
| 20 | Observability 導入 | 品質 |

---

## 統計

- **分析ファイル数**: Rust 21ファイル + TypeScript 50ファイル + インフラ 6ファイル
- **検出問題数**: 40+件
- **Critical**: 2件, **High**: 6件, **Medium**: 20件, **Low**: 12件
