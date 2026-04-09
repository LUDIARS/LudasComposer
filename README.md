<p align="center">
  <img src="ars-editor/src-tauri/icons/icon.png" width="120" alt="Ars logo" />
</p>

<h1 align="center">Ars</h1>

<p align="center">
  アクターモデルに基づくコンテンツ構造設計エディタ＆ゲームエンジン
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://github.com/LUDIARS/Ars/actions"><img src="https://github.com/LUDIARS/Ars/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

---

抽象的なアクターにモジュール（コンポーネント）を結合してコンテンツ構造を設計し、AI コード生成で実装を加速するツールです。アクターは入れ子にでき、トップレベルアクターは「シーン」として扱われます。

## 特徴

- **ノードベースのビジュアルエディタ** — React Flow でアクターの構成・接続・階層構造をグラフィカルに操作
- **マルチプラットフォーム コード生成** — ars-native / Unity / Unreal / Godot 向けにコードを自動生成
- **App / Web 両対応** — 同一のビジネスロジックがデスクトップアプリ (Tauri) と Web サーバー (Axum) の両方で動作
- **リアルタイムコラボレーション** — WebSocket によるプレゼンス・ノードロック・カーソル共有
- **AI コード生成** — 設計データからプラットフォーム固有のコードを自動生成

## 生成プロジェクト構造

Ars が管理するプロジェクトは、以下の **3 つのフォルダ**で構成されます。

| フォルダ | 役割 |
|---|---|
| `codedesign/` | コード設計データ — アクター構造・モジュール定義・型情報など、コード生成に使われる設計情報 |
| `gamedesign/` | ゲーム設計データ — シーン構成・バランス・ゲームロジックなどのゲーム固有の設計情報 |
| `data/` | アセット・リソースデータ — 画像・音声・設定ファイルなど、ランタイムが参照する実データ |

この 3 フォルダ構成は Ars の根幹概念であり、エディタ・コード生成・MCP Server のすべてがこの構造を前提に動作します。

---

## アーキテクチャ

3 層構造でコアロジックをプラットフォーム非依存に保ちます。

```
Layer 3 ─ Host Adapter
  App版: Tauri Desktop (ModuleHost + EventBus)
  Web版: Axum Server  (Router + Handler)

Layer 2 ─ Use Case (App/Web 共通)
  純粋な async 関数。&dyn Repository を引数に取り、状態を持たない。

Layer 1 ─ Domain Model + Repository Trait (ars-core)
  構造体定義、trait 定義、EventBus 基盤。
```

|  | App 版 (Tauri) | Web 版 (Axum) |
|---|---|---|
| ユーザー | シングル | マルチ |
| 永続化 | ローカルファイル (`~/.ars/`) | ローカルファイル (サーバーサイド) |
| 認証 | Cernere (永続セッション) | Cernere (TTL 付きセッション) |
| モジュール間通信 | EventBus | リクエスト独立 |

### 認証・プロジェクト管理

認証・ユーザー管理・プロジェクト永続化は [Cernere](https://github.com/LUDIARS/Cernere) に委譲しています。Ars 自体は AWS SDK / DynamoDB / Redis を持たず、Cernere の HTTP API 経由で操作します。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フレームワーク | Tauri v2 (Rust) / Axum (Web) |
| フロントエンド | React 19 · TypeScript 5.9 · Vite 7 |
| ノードエディタ | @xyflow/react 12 |
| UI | shadcn/ui · Tailwind CSS 4 |
| 状態管理 | Zustand 5 |
| 認証 | Cernere (JWT + WebSocket セッション) |
| CI/CD | GitHub Actions |
| コンテナ | Docker (multi-stage) |

## プロジェクト構成

```
Ars/
├── crates/
│   ├── ars-core/            # Layer 1: ドメインモデル · Repository trait · EventBus
│   ├── ars-project/         # Layer 2: プロジェクト I/O · ローカル永続化
│   ├── ars-codegen/         # AI 支援コード生成 CLI
│   ├── ars-mcp-server/      # MCP Server (AI ツール連携)
│   └── ars-secrets/         # シークレット管理 (Infisical)
├── ars-editor/
│   ├── src/                 # React フロントエンド
│   │   ├── features/        #   node-editor, scene-manager, behavior-editor, etc.
│   │   ├── stores/          #   Zustand ストア
│   │   ├── components/      #   共通 UI コンポーネント
│   │   ├── hooks/           #   カスタムフック
│   │   ├── lib/             #   ユーティリティ · API クライアント
│   │   ├── types/           #   TypeScript 型定義
│   │   └── locales/         #   i18n (ja / en)
│   └── src-tauri/           # Tauri / Axum バックエンド (Layer 3)
│       └── src/
│           ├── app_state.rs    # AppState (Cernere クライアント)
│           ├── cernere_auth.rs # JWT 検証
│           ├── cernere_client.rs # Cernere HTTP クライアント
│           ├── collab.rs       # WebSocket コラボレーション
│           ├── git_ops.rs      # Git 操作
│           └── web_server.rs   # Axum エントリ
├── tools/
│   ├── ars-codegen/         # コード生成 CLI (TypeScript)
│   └── ars-mcp-server/      # MCP Server (TypeScript)
├── tests/                   # Playwright 統合テスト
├── spec/                    # 設計書・仕様書
├── Dockerfile
├── docker-compose.yaml
└── LICENSE                  # MIT
```

### コアモジュール

| モジュール | 責務 | 状態 |
|---|---|---|
| `ars-core` | ドメインモデル · Repository trait · EventBus | 実装済み |
| `ars-project` | プロジェクト I/O · ローカル永続化 | 実装済み |
| `ars-secrets` | シークレット管理 (Infisical) | 実装済み |
| `ars-codegen` | AI コード生成 CLI | 実装中 |
| `ars-mcp-server` | MCP Server (AI ツール連携) | 実装中 |

### 対応プラットフォーム

| プラットフォーム | 言語 | 用途 |
|---|---|---|
| ars-native | TypeScript | Ars 独自ランタイム (JIT / WASM) |
| Unity | C# | Unity Engine (URP / HDRP) |
| Unreal | C++ | Unreal Engine (Nanite / Lumen) |
| Godot | GDScript | Godot Engine (Vulkan) |

## セットアップ

### 必要な環境

- **Node.js** 20 LTS 以上
- **Rust** 1.77.2 以上 (`rustup` でインストール)
- **OS 別の依存**
  - **Windows** — Visual Studio Build Tools (C++)、WebView2
  - **Linux** — `libwebkit2gtk-4.1-dev`、`libgtk-3-dev` 等

> OS 別の詳細: [Windows](spec/setup-windows.md) / [Linux arm64](spec/setup-linux-arm64.md)

共通の初期手順:

```bash
git clone https://github.com/LUDIARS/Ars.git
cd Ars/ars-editor
npm install
```

---

### デスクトップ版 (Tauri)

ネイティブアプリ。WebView2 でフロントエンドを描画し、Rust バックエンドがローカルファイル I/O を行う。

```bash
# 開発 (ホットリロード)
npx tauri dev

# ビルド (インストーラー生成)
npx tauri build
# → src-tauri/target/release/bundle/ に .msi / .app / .deb が生成
```

初回起動時は Rust のコンパイルに数分かかります。

WebView2 の依存のため、**OS 固有のシステムライブラリが必要**です（上記参照）。

---

### Web 版 (Axum)

ブラウザからアクセスする Web サーバー。Axum (Rust) がフロントエンド静的ファイル配信 + API + WebSocket コラボレーションを担当。

```bash
# フロントエンドビルド (Vite)
npm run build

# バックエンドビルド (Rust/Axum)
npm run build:web-server

# 起動
npm run serve:web
# → http://localhost:5173
```

`CERNERE_URL` 環境変数で Cernere サーバーの接続先を指定（デフォルト: `http://localhost:8080`）。

#### 開発 (ホットリロード)

```bash
# バックエンド (cargo watch で自動リビルド)
npm run dev:server

# フロントエンド (別ターミナル、Vite HMR)
npm run dev
```

#### Docker

```bash
docker compose up -d              # GHCR イメージで起動
docker compose up -d --build      # ローカルビルド (2段: Vite → Cargo)
```

`http://localhost:5173` でアクセスできます。

#### npm scripts 一覧

| スクリプト | 内容 |
|-----------|------|
| `npm run build` | フロントエンドビルド (Vite → `dist/`) |
| `npm run build:web-server` | バックエンドビルド (Cargo → `ars-web-server` バイナリ) |
| `npm run serve:web` | ビルド済みバックエンドを起動 (`dist/` を配信) |
| `npm run dev:server` | バックエンド開発 (cargo watch + ホットリロード) |

## 開発ツール

| ツール | 概要 |
|---|---|
| `tools/ars-codegen` | `.ars.json` から各プラットフォーム向けコードを生成する CLI |
| `tools/ars-mcp-server` | MCP Server — AI ツールからプロジェクト構造を読み書き |

```bash
cd tools/ars-codegen && npm install && npm run build
cd tools/ars-mcp-server && npm install && npm run build
```

## テスト

```bash
# 統合テスト (Playwright)
npx playwright install
npx playwright test
```

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [モジュール概要設計](spec/modules/overview.md) | 3 層アーキテクチャ・モジュール一覧・依存関係 |
| [モジュール詳細設計](spec/modules/detail.md) | 各モジュールの API・型定義・実装方針 |
| [設計書 & 実装計画](spec/plan.md) | ドメインモデル・画面設計・実装ステップ |
| [プラットフォーム定義](spec/platforms.md) | 対応プラットフォームの言語・規約・ビルド方式 |

## ライセンス

[MIT License](LICENSE) — Copyright (c) 2026 LUDIARS
