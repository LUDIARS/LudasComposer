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
| 永続化 | ローカルファイル (`~/.ars/`) | DynamoDB |
| 認証 | 永続セッション | TTL 付きセッション (7 日) |
| モジュール間通信 | EventBus | リクエスト独立 |

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フレームワーク | Tauri v2 (Rust) / Axum (Web) |
| フロントエンド | React 19 · TypeScript 5.9 · Vite 7 |
| ノードエディタ | @xyflow/react 12 |
| UI | shadcn/ui · Tailwind CSS 4 |
| 状態管理 | Zustand 5 |
| DB (Web) | SurrealDB (embedded) / DynamoDB |
| キャッシュ | Redis |
| CI/CD | GitHub Actions |
| コンテナ | Docker (multi-stage) |

## プロジェクト構成

```
Ars/
├── crates/
│   ├── ars-core/            # Layer 1: ドメインモデル · trait · EventBus
│   ├── ars-project/         # Layer 2: プロジェクト I/O · ローカル永続化
│   ├── ars-codegen/         # AI 支援コード生成 CLI
│   └── ars-mcp-server/      # MCP Server (AI ツール連携)
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
│           ├── commands/    #   Tauri コマンド
│           ├── models/      #   データモデル
│           ├── auth.rs      #   GitHub OAuth
│           ├── collab.rs    #   WebSocket コラボレーション
│           ├── git_ops.rs   #   Git 操作
│           └── web_server.rs#   Axum エントリ
├── tools/
│   ├── ars-codegen/         # コード生成 CLI (TypeScript)
│   └── ars-mcp-server/      # MCP Server (TypeScript)
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

### クイックスタート

```bash
git clone https://github.com/LUDIARS/Ars.git
cd Ars/ars-editor
npm install
npx tauri dev       # デスクトップアプリ (開発)
```

初回起動時は Rust のコンパイルに数分かかります。

### ビルド

```bash
# デスクトップアプリ
cd ars-editor && npx tauri build
# → ars-editor/src-tauri/target/release/bundle/

# Web サーバー
cd ars-editor && npm run build && npm run serve:web
```

### Docker

```bash
docker compose up -d           # GHCR イメージで起動
docker compose up -d --build   # ローカルビルド
```

`http://localhost:5173` でアクセスできます。

## 開発ツール

| ツール | 概要 |
|---|---|
| `tools/ars-codegen` | `.ars.json` から各プラットフォーム向けコードを生成する CLI |
| `tools/ars-mcp-server` | MCP Server — AI ツールからプロジェクト構造を読み書き |

```bash
cd tools/ars-codegen && npm install && npm run build
cd tools/ars-mcp-server && npm install && npm run build
```

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [モジュール概要設計](spec/modules/overview.md) | 3 層アーキテクチャ・モジュール一覧・依存関係 |
| [モジュール詳細設計](spec/modules/detail.md) | 各モジュールの API・型定義・実装方針 |
| [設計書 & 実装計画](spec/plan.md) | ドメインモデル・画面設計・実装ステップ |
| [プラットフォーム定義](spec/platforms.md) | 対応プラットフォームの言語・規約・ビルド方式 |
| [環境変数セットアップ](spec/env-setup.md) | Web サーバーモードの環境設定 |

## ライセンス

[MIT License](LICENSE) — Copyright (c) 2026 LUDIARS
