# Ars プロジェクト 総合コードレビュー

**レビュー日**: 2026-03-19
**対象**: リポジトリ全体 (ars-editor, src-tauri, data-organizer, mcp-server, ars-codegen, src/)

---

## 目次

1. [脆弱性](#1-脆弱性)
2. [モジュール間の結合度](#2-モジュール間の結合度)
3. [アーキテクチャ・設計](#3-アーキテクチャ設計)
4. [AIフレンドリーの度合い](#4-aiフレンドリーの度合い)
5. [コードの粒度](#5-コードの粒度)
6. [DRY原則・SOLID対応度合い](#6-dry原則solid対応度合い)
7. [総合評価サマリ](#7-総合評価サマリ)

---

## 1. 脆弱性

### 総合評価: ⚠️ 要改善（CRITICAL 3件、MEDIUM 8件）

### 1.1 CRITICAL: パストラバーサル脆弱性

**ファイル**: `ars-editor/src-tauri/src/commands/project.rs:7-32`, `ars-editor/src-tauri/src/web_modules/editor.rs:36-50`

`save_project` / `load_project` API がクライアントからの任意のファイルパスを検証なしに受け入れている。

```rust
pub fn save_project_impl(path: String, project: Project) -> Result<(), String> {
    // パス検証なし — 任意のファイルに書き込み可能
    fs::write(&path, json)
}
```

**影響**: システム上の任意ファイルの読み書きが可能。
**対策**: `Path::canonicalize()` でベースディレクトリの外にアクセスできないようバリデーションを実装する。

### 1.2 CRITICAL: OAuth CSRF State 未検証

**ファイル**: `ars-editor/src-tauri/src/auth.rs:46-51`

```rust
pub struct OAuthCallbackQuery {
    pub code: String,
    pub state: Option<String>,  // 受信するが検証していない
}
```

`github_callback` で `state` パラメータを受け取っているが、ログイン時に生成した値との照合がない。
**対策**: ログイン時に `state` を生成・保存し、コールバックで照合する。

### 1.3 CRITICAL: CORS が完全許可

**ファイル**: `ars-editor/src-tauri/src/web_server.rs:24`, `data-organizer/src/web_server.rs:261`

```rust
.layer(CorsLayer::permissive())
```

全オリジンからのリクエストを許可しており、クロスサイトリクエストフォージェリが容易。
**対策**: `CorsLayer::very_restrictive()` + 明示的なオリジン指定。

### 1.4 MEDIUM: Data Organizer API に認証なし

**ファイル**: `data-organizer/src/web_server.rs:34-260`

全エンドポイントが認証チェックなしで公開されている。`CorsLayer::permissive()` と組み合わさると、任意のWebサイトからマスタデータ・ユーザー変数の読み書きが可能。

### 1.5 MEDIUM: GitHub Access Token を DynamoDB に平文保存

**ファイル**: `ars-editor/src-tauri/src/dynamo.rs:99,156`

トークンは暗号化・ローテーションされずに長期保存されている。
**対策**: トークン暗号化、または Refresh Token フローへの移行。

### 1.6 MEDIUM: セッション有効期限が長い（7日）& リフレッシュなし

**ファイル**: `ars-editor/src-tauri/src/auth.rs:14`

```rust
const SESSION_TTL_SECS: i64 = 7 * 24 * 60 * 60;
```

### 1.7 MEDIUM: Git Clone URL 未検証（SSRF リスク）

**ファイル**: `ars-editor/src-tauri/src/web_modules/editor.rs:173-205`

ユーザー入力の URL を直接 `git2::Repository::clone()` に渡しており、内部サービスへの SSRF 攻撃が可能。

### 1.8 MEDIUM: レート制限なし

全 API エンドポイントにレート制限がなく、ブルートフォース攻撃やリソース枯渇攻撃が可能。

### 1.9 MEDIUM: SameSite Cookie が Lax

**ファイル**: `ars-editor/src-tauri/src/auth.rs:164`

`SameSite::Lax` → `SameSite::Strict` が推奨。

### 1.10 その他

| 項目 | 状態 |
|------|------|
| XSS (dangerouslySetInnerHTML) | ✅ 検出なし |
| .env のシークレット漏洩 | ✅ .gitignore 適切 |
| Docker: 非 root ユーザー | ✅ 両 Dockerfile 対応済 |
| DynamoDB パラメータ化クエリ | ✅ インジェクション対策済 |
| HTTPS 使用 | ✅ OAuth で使用 |

---

## 2. モジュール間の結合度

### 総合評価: ⚠️ 中程度（改善余地あり）

### 2.1 モジュール関係マップ

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  ars-editor  │     │     src/     │     │   data-organizer │
│  (React UI)  │     │ (Stores/Svc) │     │   (Rust Lib)     │
└──────┬───────┘     └──────┬───────┘     └────────┬─────────┘
       │                    │                       │
       │ REST/Tauri IPC     │ Tauri IPC             │ REST API
       ▼                    ▼                       ▼
┌──────────────────────────────────────────────────────────────┐
│              src-tauri / ars-editor/src-tauri                │
│              (Rust Backend: Commands → Services → Models)    │
└──────────────────────────────────────────────────────────────┘
       ▲                    ▲
       │ 型定義参照           │ 型定義参照
┌──────┴───────┐     ┌──────┴───────┐
│  mcp-server  │     │  ars-codegen │
│  (Read-Only) │     │  (Read-Only) │
└──────────────┘     └──────────────┘
```

### 2.2 結合度の問題点

| 問題 | 詳細 |
|------|------|
| **型定義の4重複** | `src/types/domain.ts`, `ars-editor/src/types/domain.ts`, `mcp-server/src/types.ts`, `ars-codegen/src/types.ts` が同一/類似の型を独立定義 |
| **API ラッパーの二重実装** | `src/services/*-api.ts` と `ars-editor/src/lib/*-api.ts` が 80% 重複 |
| **CommandResult の6重定義** | 各サービスが `{ success, data, error }` を独自定義 |
| **Store ↔ API 密結合** | Store が直接 API を呼び出し → `loadConfig()` で全体リロード、バッチ操作不可 |

### 2.3 良好な点

- **data-organizer** は独立したRustライブラリとして適切に分離
- **mcp-server / ars-codegen** は Read-Only で型定義のみ参照
- **Feature 間の依存なし**: `ars-editor/src/features/` 配下の各機能は相互参照なし

---

## 3. アーキテクチャ・設計

### 総合評価: ✅ 良好（一部改善推奨）

### 3.1 全体構成

| レイヤー | 技術スタック | 役割 |
|---------|-------------|------|
| Frontend | React + Zustand + React Flow | ビジュアルエディタ UI |
| Desktop App | Tauri 2 | ネイティブアプリラッパー |
| Backend (Desktop) | Rust (Tauri commands) | ファイル操作、Git、モジュール管理 |
| Backend (Web) | Rust (Axum) | 統合Webサーバー |
| Data Layer | Rust (data-organizer) | マスタデータ / ユーザーデータ管理 |
| Cloud | AWS DynamoDB | ユーザー認証・プロジェクト保存 |
| AI Integration | MCP Server + ars-codegen | Claude Code 連携、コード生成 |

### 3.2 設計パターン

| パターン | 適用箇所 | 評価 |
|---------|---------|------|
| **Feature-Based Architecture** | `ars-editor/src/features/` | ✅ 優秀 — 各機能が独立して開発可能 |
| **Zustand Store** | 全 Store | ✅ 良好 — ドメインとUIの適切な分離 |
| **Custom Hooks** | `useNodeEditor`, `useSceneManager` | ✅ 優秀 — ロジックの再利用・テスト容易性 |
| **Service Layer (Rust)** | Commands → Services → Models | ✅ 良好 — レイヤード構造 |
| **Dual Runtime** | Tauri IPC / REST API 切替 | ✅ 良好 — Desktop/Web 両対応 |
| **Facade** | `data-organizer/organizer.rs` | ✅ 良好 — master_data + user_data の統合窓口 |

### 3.3 アーキテクチャ上の懸念

1. **2つの src-tauri**: `src-tauri/` と `ars-editor/src-tauri/` が並存し、それぞれが独自のモデル・サービス・コマンドを持つ。統合または明確な役割分離が望ましい。
2. **Webサーバーの認証不統一**: `ars-editor/src-tauri/src/web_server.rs` は認証付き、`data-organizer/src/web_server.rs` は認証なし。
3. **ミドルウェア層の不在**: エラーハンドリング、ロギング、認証がコマンドごとにアドホックに実装。

---

## 4. AIフレンドリーの度合い

### 総合評価: ⭐ 非常に優秀

### 4.1 ドキュメント（AI向け）

| ドキュメント | 行数 | AI 活用度 |
|------------|------|----------|
| `plan.md` | 1,085 | ⭐⭐⭐ — アーキテクチャ、ドメインモデル、実装フェーズ、AI最適化指針を網羅 |
| `ars.md` | 11 | ⭐⭐ — 実装ルールと設計哲学を簡潔に記載 |
| `README.md` | 96 | ⭐⭐ — セットアップ手順（英語・日本語） |
| `docs/*.md` | 4ファイル | ⭐⭐ — 環境構築、ビルド設計 |

**特筆事項**: `plan.md` セクション10 に「AI効率化の観点」が明示的に記載されており、AI によるコード生成を最大化するための6つの設計決定が列挙されている。

### 4.2 MCP Server 統合

- 20+ ツールで Project, Scene, Actor, Component, Connection, Module を操作可能
- `ars://design/plan`, `ars://design/rules` リソースで AI にコンテキストを提供
- Zod スキーマによる型安全なバリデーション
- バッチ操作・検索フィルタ機能

### 4.3 コード生成基盤

- `ars-codegen` モジュールが AI プロンプト生成・セッション管理・タスク並行実行をサポート
- Markdown モジュール定義書を AI の入力契約として使用
- 依存関係解決付きのインクリメンタル生成

### 4.4 コードの自己文書化

- **命名規則が一貫**: TS は camelCase/PascalCase、Rust は snake_case/CamelCase
- **関数名が意図を表現**: `useNodeEditor`, `validateConnection`, `parse_module_markdown`
- **ディレクトリ構造が直感的**: Feature-based で「scene-manager 機能を実装して」と指示するだけで AI が配置先を特定可能

---

## 5. コードの粒度

### 総合評価: ⚠️ 改善推奨（一部ファイルが肥大化）

### 5.1 肥大化ファイル（要分割）

| ファイル | 行数 | 問題 |
|---------|------|------|
| `ars-editor/src/stores/projectStore.ts` | **883** | 50+ メソッドの God Object |
| `mcp-server/src/index.ts` | **589** | 全 MCP ハンドラーが1ファイルに集約 |
| `ars-codegen/src/prompt-generator.ts` | **456** | 単一のコード生成エンジン |
| `data-organizer/src/master_data.rs` | **342** | レジストリ + 永続化が混在 |
| `src-tauri/src/services/module_parser.rs` | **302** | パーサー + キャッシュロジックが混在 |

### 5.2 適切な粒度のファイル

| ファイル | 行数 | 評価 |
|---------|------|------|
| `ars-editor/src/stores/editorStore.ts` | 108 | ✅ UI 状態のみ、適切 |
| `ars-editor/src/stores/historyMiddleware.ts` | 37 | ✅ 単一責務 |
| `src/stores/resourceDepotStore.ts` | 110 | ✅ 読み取り専用データ + フィルタ |
| Feature index.ts 群 | 各 ~20 | ✅ バレルエクスポートとして適切 |

### 5.3 過小粒度（薄すぎるラッパー）

| ファイル | 問題 |
|---------|------|
| `src/services/assembly-api.ts` | `invoke()` の薄いラッパー — 自動生成すべき |
| `src/services/module-registry-api.ts` | 同上 |
| `src/services/resource-depot-api.ts` | 同上 |

---

## 6. DRY原則・SOLID対応度合い

### 総合評価: ⚠️ 要改善

### 6.1 DRY 違反

| 重複パターン | 箇所1 | 箇所2+ | 重複率 |
|-------------|-------|--------|--------|
| ドメイン型定義 | `src/types/domain.ts` | `ars-editor/types/domain.ts`, `mcp-server/types.ts`, `ars-codegen/types.ts` | 95-100% |
| `CommandResult<T>` | `src/services/*-api.ts` | `src-tauri/commands/*`, 他4箇所 | 100% |
| API ラッパー | `src/services/*` | `ars-editor/src/lib/*-api.ts` | 80% |
| エラーハンドリング | コマンドハンドラー 10箇所 | 同一 try/catch パターン | 100% |

**推定重複コード量**: 全体の約 12%

### 6.2 SOLID 原則違反

#### S — Single Responsibility Principle ❌

| ファイル | 責務数 | 内容 |
|---------|--------|------|
| `projectStore.ts` | 7+ | Scene管理 + Actor管理 + Component管理 + Sequence管理 + Prefab管理 + State管理 + Keybinding管理 |
| `scriptingStore.ts` | 5 | TS ランタイム + WASM ブリッジ + コンテキスト + ホットリロード + JIT設定 |

**推奨**: `projectStore` を SceneStore, ActorStore, ComponentStore, SequenceStore, PrefabStore に分割。

#### O — Open/Closed Principle ❌

- ドメイン型が4箇所にハードコードされており、変更時に全箇所の修正が必要
- `CommandResult` の拡張も全6箇所を修正する必要あり

#### L — Liskov Substitution Principle ⚠️

- `AssemblyCommandResult` と `CommandResult` が類似だが互換性なし
- バックエンドサービスに共通インターフェースがなく、差し替え不可

#### I — Interface Segregation Principle ❌

- `projectStore` が 50+ メソッドを公開 — 利用側は全 API を把握する必要あり
- 関心事ごとの絞り込みインターフェースがない

#### D — Dependency Inversion Principle ❌

- `new ScriptingRuntime()`, `invoke('cmd')` 等、具体的な実装に直接依存
- テスト/モック用の抽象レイヤーがない

---

## 7. 総合評価サマリ

| 評価項目 | 評点 | 要約 |
|---------|------|------|
| **脆弱性** | ⚠️ C | CRITICAL 3件（パストラバーサル、CSRF未検証、CORS全許可）の即時対応が必要 |
| **モジュール間結合度** | ⚠️ B- | 型の4重複と API の二重実装。data-organizer の分離は優秀 |
| **アーキテクチャ・設計** | ✅ B+ | Feature-Based Architecture、Zustand、Service Layer は良好。認証の統一性が課題 |
| **AIフレンドリー** | ⭐ A | plan.md の AI 最適化指針、MCP Server、ars-codegen が非常に優秀 |
| **コードの粒度** | ⚠️ B- | projectStore (883行) の肥大化が最大課題。他は概ね適切 |
| **DRY / SOLID** | ⚠️ C+ | 型定義の大量重複、SRP・ISP 違反が顕著。改善の余地大 |

### 優先度別改善ロードマップ

#### 🔴 即時対応（セキュリティ）

1. パストラバーサル対策: `Path::canonicalize()` + ベースディレクトリ制限
2. OAuth state パラメータ検証の実装
3. `CorsLayer::permissive()` → 明示的オリジン指定
4. Data Organizer API に認証ミドルウェア追加
5. レート制限ミドルウェア導入（`tower-governor` 等）

#### 🟡 短期改善（アーキテクチャ）

1. `@ars/types` パッケージ作成 → 型定義の一元化
2. `projectStore` の分割（Scene / Actor / Component / Sequence / Prefab）
3. 共通 `CommandResult<T>` の一元定義
4. API ラッパーの自動生成 or 共通化

#### 🟢 中長期改善

1. サービス層のインターフェース抽象化（テスタビリティ向上）
2. Rust → TypeScript 型自動生成パイプライン
3. 認証ミドルウェアの統一
4. セッション管理の改善（TTL短縮 + リフレッシュトークン）
