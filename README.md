# Ars

Ars は、アクターモデルに基づくコンテンツ生成ゲームエンジン＆エディタです。

## 特徴

- **アクターモデルベースの構造設計** — 抽象的なアクターにモジュールを結合し、コンテンツの構造を設計します。アクターは入れ子にでき、トップレベルアクターは「シーン」として扱われます。
- **ノードベースのビジュアルエディタ** — React Flow を使ったノードエディタで、アクターの構成・接続を直感的に操作できます。
- **AI によるコードチューニング** — 設計をもとに AI がコードを自動生成・最適化し、実装を加速します。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Tauri v2 (Rust) |
| フロントエンド | React 19 + TypeScript |
| ノードエディタ | @xyflow/react (React Flow) |
| UI | shadcn/ui + Tailwind CSS 4 |
| 状態管理 | Zustand |
| ビルド | Vite |
| バックエンド | Rust (Tauri Commands) |

## 必要な環境

- **Node.js** 20 LTS 以上
- **Rust** 1.77.2 以上 (rustup 経由でインストール)
- **OS 別の依存パッケージ**
  - **Windows**: Visual Studio Build Tools (C++ デスクトップ開発)、WebView2
  - **Linux**: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev` 等 (詳細は [Linux arm64 セットアップ](docs/setup-linux-arm64.md) を参照)

各 OS ごとの詳細な手順は以下を参照してください:

- [Windows セットアップガイド](docs/setup-windows.md)
- [Linux arm64 セットアップガイド](docs/setup-linux-arm64.md)

## クイックスタート

```bash
# リポジトリのクローン
git clone https://github.com/LUDIARS/Ars.git
cd Ars/ars-editor

# 依存パッケージのインストール
npm install

# 開発モードで起動 (ホットリロード有効)
npx tauri dev
```

初回起動時は Rust のコンパイルに時間がかかります。2 回目以降はキャッシュにより高速化されます。

## ビルド

### Docker

```bash
# ビルド & 起動 (docker compose)
docker compose up -d --build

# または手動でビルド & 起動
docker build -t ars .
docker run -p 5173:5173 ars
```

`http://localhost:5173` でアクセスできます。

### デスクトップアプリ

```bash
cd ars-editor
npx tauri build
```

ビルド成果物は `ars-editor/src-tauri/target/release/bundle/` に出力されます。

### Web サーバー

```bash
cd ars-editor

# フロントエンドのビルド
npm run build

# Web サーバーのビルド & 起動
npm run serve:web
```

Web サーバーモードで GitHub OAuth や DynamoDB を利用する場合は [環境変数セットアップガイド](docs/env-setup.md) を参照してください。

## プロジェクト構成

```
Ars/
├── ars-editor/          # フロントエンド (React + Vite)
│   └── src-tauri/       # Tauri 設定 (エディタ用)
├── src-tauri/           # Rust バックエンド (エンジンコア)
│   └── src/
│       ├── commands/    # Tauri コマンド
│       ├── models/      # データモデル
│       └── services/    # ビジネスロジック
├── src/                 # 共有 TypeScript 型定義
├── infra/               # インフラ構成 (ビルドインスタンス等)
├── docs/                # ドキュメント
└── .github/workflows/   # CI/CD
```

## ライセンス

[LICENSE](LICENSE) を参照してください。
