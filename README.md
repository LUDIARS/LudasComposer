# Ars

Ars は、アクターモデルに基づくコンテンツ構造設計エディタ＆ゲームエンジンです。

抽象的なアクターにモジュール (コンポーネント) を結合してコンテンツ構造を設計し、AI コード生成で実装を加速します。アクターは入れ子にでき、トップレベルアクターは「シーン」として扱われます。

## 特徴

- **ノードベースのビジュアルエディタ** — React Flow を使い、アクターの構成・接続・階層構造をグラフィカルに操作
- **マルチプラットフォーム対応** — ars-native (TypeScript/WASM)、Unity (C#)、Unreal (C++)、Godot (GDScript) にコード生成可能
- **App / Web 両対応** — 同一のビジネスロジック (Layer 2) がデスクトップアプリ (Tauri) と Web サーバー (Axum) の両方で動作
- **リアルタイムコラボレーション** — WebSocket によるプレゼンス表示・ノードロック・カーソル共有
- **AI コード生成** — 設計データから AI がプラットフォームに応じたコードを自動生成 (ars-codegen)

## アーキテクチャ

3 層構造でコアロジックをプラットフォーム非依存に保つ設計です。

```
┌───────────────────────────────────────────────────────┐
│ Layer 3: Host Adapter (プラットフォーム固有)             │
│                                                        │
│   App版: Tauri Desktop (ModuleHost + EventBus)         │
│   Web版: Axum Server (Router + Handler)                │
├───────────────────────────────────────────────────────┤
│ Layer 2: Use Case (ビジネスロジック、App/Web 共通)       │
│                                                        │
│   純粋な async 関数。&dyn Repository を引数に取る。      │
│   状態を持たない。ライフサイクルを知らない。              │
├───────────────────────────────────────────────────────┤
│ Layer 1: Domain Model + Repository Trait (ars-core)    │
│                                                        │
│   構造体定義、trait 定義、EventBus 基盤。                │
└───────────────────────────────────────────────────────┘
```

| | App 版 (Tauri Desktop) | Web 版 (Axum Server) |
|---|---|---|
| ユーザー | シングル | マルチ |
| 永続化 | ローカルファイル (`~/.ars/`) | DynamoDB |
| 認証 | 永続セッション | TTL 付きセッション (7 日) |
| モジュール間通信 | EventBus (リアルタイム) | 不要 (リクエスト独立) |

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Tauri v2 (Rust) / Axum (Web) |
| フロントエンド | React 19 + TypeScript 5.9 |
| ノードエディタ | @xyflow/react 12 (React Flow) |
| UI | shadcn/ui + Tailwind CSS 4 |
| 状態管理 | Zustand 5 |
| ビルド | Vite 7 |
| DB (Web) | SurrealDB (embedded) / DynamoDB |
| キャッシュ | Redis (コラボ向け) |
| CI/CD | GitHub Actions |
| コンテナ | Docker (multi-stage build) |

## プロジェクト構成

```
Ars/
├── crates/
│   ├── ars-core/              # Layer 1: ドメインモデル, trait, EventBus
│   └── ars-project/           # Layer 2: プロジェクト I/O, ローカル永続化
├── ars-editor/
│   ├── src/                   # React フロントエンド
│   │   ├── features/          #   機能別モジュール (node-editor, scene-manager, etc.)
│   │   ├── stores/            #   Zustand ストア
│   │   ├── components/        #   共通コンポーネント
│   │   ├── hooks/             #   カスタムフック
│   │   ├── lib/               #   ユーティリティ, API クライアント
│   │   ├── types/             #   TypeScript 型定義
│   │   └── locales/           #   i18n (ja/en)
│   └── src-tauri/             # Rust バックエンド (Layer 3)
│       └── src/
│           ├── commands/      #   Tauri コマンド
│           ├── models/        #   データモデル
│           ├── web_modules/   #   Web 版 Axum ハンドラ
│           ├── auth.rs        #   GitHub OAuth 認証
│           ├── collab.rs      #   WebSocket コラボレーション
│           ├── git_ops.rs     #   Git 操作
│           └── web_server.rs  #   Axum Web サーバーエントリ
├── tools/
│   ├── ars-codegen/           # AI 支援コード生成 CLI
│   └── ars-mcp-server/        # MCP Server (AI ツール連携)
├── spec/                      # 設計書・仕様書
│   ├── modules/               #   モジュール設計 (overview.md, detail.md)
│   ├── rule/                  #   レイヤールール, ドメインルール
│   └── review/                #   コードレビュー記録
├── .github/workflows/         # CI/CD
├── Dockerfile                 # Web 版マルチステージビルド
├── docker-compose.yaml
└── LICENSE                    # MIT License
```

### コアモジュール

| モジュール | 責務 | 状態 |
|-----------|------|------|
| `ars-core` | ドメインモデル, Repository trait, EventBus | 実装済み |
| `ars-project` | プロジェクト I/O, ローカル永続化 | 実装済み |
| `ars-assembly` | ビルド構成, アセンブリ管理 | 設計のみ |
| `ars-module-registry` | Ergo モジュール発見・解析 | 設計のみ |
| `ars-resource-depot` | アセット管理 | 設計のみ |
| `ars-data-organizer` | Blackboard 変数, ゲーム設定値 | 設計のみ |
| `ars-auth` | 認証, セッション管理 | 設計のみ |
| `ars-collab` | WebSocket 同期, プレゼンス, ロック | 設計のみ |
| `ars-secrets` | シークレット管理 (Keychain + TOML) | 設計のみ |
| `ars-git` | Git 操作 (clone, push, pull) | 設計のみ |

### 対応プラットフォーム

| プラットフォーム | 言語 | 用途 |
|-----------------|------|------|
| ars-native (デフォルト) | TypeScript | Ars 独自ランタイム (JIT / WASM) |
| Unity | C# | Unity Engine (URP / HDRP) |
| Unreal | C++ | Unreal Engine (Nanite / Lumen) |
| Godot | GDScript | Godot Engine (Vulkan) |

## 必要な環境

- **Node.js** 20 LTS 以上
- **Rust** 1.77.2 以上 (`rustup` でインストール)
- **OS 別の依存パッケージ**
  - **Windows**: Visual Studio Build Tools (C++ デスクトップ開発)、WebView2
  - **Linux**: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev` 等

OS 別の詳細な手順:
- [Windows セットアップガイド](spec/setup-windows.md)
- [Linux arm64 セットアップガイド](spec/setup-linux-arm64.md)

## クイックスタート

### デスクトップアプリ (開発)

```bash
git clone https://github.com/LUDIARS/Ars.git
cd Ars/ars-editor

npm install
npx tauri dev
```

初回起動時は Rust のコンパイルに数分かかります。2 回目以降はキャッシュで高速化されます。

### デスクトップアプリ (ビルド)

```bash
cd ars-editor
npx tauri build
```

成果物は `ars-editor/src-tauri/target/release/bundle/` に出力されます。

### Web サーバー

```bash
cd ars-editor

npm run build
npm run serve:web
```

GitHub OAuth や DynamoDB を利用する場合は [環境変数セットアップガイド](spec/env-setup.md) を参照してください。

### Docker

```bash
# GitHub Container Registry から取得して起動
docker compose up -d

# ローカルでビルドして起動
docker compose up -d --build

# 手動ビルド
docker build -t ars .
docker run -p 5173:5173 ars
```

`http://localhost:5173` でアクセスできます。

## 開発ツール

### ars-codegen

AI を使ったコード生成 CLI。プロジェクトの `.ars.json` から各プラットフォーム向けのコードを自動生成します。

```bash
cd tools/ars-codegen
npm install
npm run build
```

### ars-mcp-server

MCP (Model Context Protocol) サーバー。AI ツールからプロジェクト構造の読み書きを可能にします。

```bash
cd tools/ars-mcp-server
npm install
npm run build
```

## 設計ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [モジュール概要設計](spec/modules/overview.md) | 3 層アーキテクチャ、モジュール一覧、依存関係 |
| [モジュール詳細設計](spec/modules/detail.md) | 各モジュールの API、型定義、実装方針 |
| [設計書 & 実装計画](spec/plan.md) | ドメインモデル定義、画面設計、実装ステップ |
| [プラットフォーム定義](spec/platforms.md) | 対応プラットフォームの言語・規約・ビルド方式 |
| [環境変数セットアップ](spec/env-setup.md) | Web サーバーモードの環境設定 |

## ライセンス

[MIT License](LICENSE) - Copyright (c) 2026 LUDIARS
