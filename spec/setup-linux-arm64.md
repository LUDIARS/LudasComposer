# Ars (Ars Editor) - Linux arm64 セットアップガイド

このガイドでは、Linux arm64 (aarch64) 環境で Ars (Ars Editor) を開発・ビルドするための手順を説明します。

## 動作環境

- **OS**: Ubuntu 22.04 LTS / 24.04 LTS (arm64) または同等の Debian 系ディストリビューション
- **アーキテクチャ**: aarch64 (ARM 64-bit)
- **メモリ**: 4GB 以上推奨
- **ディスク**: 10GB 以上の空き容量

## 1. システム依存パッケージのインストール

Tauri v2 が必要とするシステムライブラリをインストールします。

```bash
sudo apt update
sudo apt install -y \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libwebkit2gtk-4.1-dev \
  libjavascriptcoregtk-4.1-dev \
  libsoup-3.0-dev \
  libglib2.0-dev \
  patchelf
```

> **注意**: Tauri v2 では `libwebkit2gtk-4.1-dev` を使用します（v1 では `4.0`）。パッケージ名を間違えないようにしてください。

## 2. Node.js のインストール

Node.js 20 LTS 以上が必要です。`nvm` を使ったインストールを推奨します。

```bash
# nvm のインストール
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# シェルを再読み込み
source ~/.bashrc

# Node.js LTS のインストール
nvm install --lts
nvm use --lts

# バージョン確認
node --version   # v20.x.x 以上
npm --version    # 10.x.x 以上
```

## 3. Rust のインストール

Rust 1.77.2 以上が必要です。

```bash
# rustup でインストール
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# デフォルト設定で進める（Enter を押す）

# パスを反映
source "$HOME/.cargo/env"

# バージョン確認
rustc --version   # 1.77.2 以上
cargo --version
```

### arm64 ターゲットの確認

```bash
rustup show
# default host: aarch64-unknown-linux-gnu が表示されることを確認
```

## 4. Tauri CLI のインストール

```bash
# npm 経由でインストール（プロジェクトの devDependencies に含まれていますが、グローバルにもインストール可能）
npm install -g @tauri-apps/cli
```

## 5. プロジェクトのセットアップ

```bash
# リポジトリのクローン
git clone https://github.com/LUDIARS/Ars.git
cd Ars/ars-editor

# npm 依存パッケージのインストール
npm install
```

## 6. 開発サーバーの起動

```bash
cd ars-editor

# 開発モードで起動（ホットリロード有効）
npx tauri dev
```

初回起動時は Rust のコンパイルに時間がかかります（arm64 では特に）。2回目以降はキャッシュにより高速化されます。

起動すると以下が実行されます：
1. Vite 開発サーバーが `http://localhost:5173` で起動
2. Rust バックエンドがコンパイル
3. デスクトップウィンドウ (1280x800) が表示

## 7. プロダクションビルド

```bash
cd ars-editor

# プロダクションビルド
npx tauri build
```

ビルド成果物は以下に出力されます：

```
ars-editor/src-tauri/target/release/bundle/
├── deb/        # .deb パッケージ (Debian/Ubuntu)
└── appimage/   # .AppImage (ポータブル実行ファイル)
```

## トラブルシューティング

### WebKit 関連のエラー

```
Package webkit2gtk-4.1 was not found
```

→ `libwebkit2gtk-4.1-dev` がインストールされているか確認してください。Tauri v2 では `4.1` が必要です。

### arm64 でのコンパイルが遅い

- Rust の初回コンパイルは arm64 で特に時間がかかる場合があります
- `CARGO_BUILD_JOBS` 環境変数でコンパイルの並列数を調整できます：
  ```bash
  export CARGO_BUILD_JOBS=4
  ```

### libsoup 関連のエラー

```
Package libsoup-3.0 was not found
```

→ `libsoup-3.0-dev` がインストールされているか確認してください。

### GPU アクセラレーションの問題

arm64 デバイスでは GPU ドライバーの問題が発生する場合があります。WebKit のハードウェアアクセラレーションを無効にして試してください：

```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 npx tauri dev
```

### Raspberry Pi での注意事項

- Raspberry Pi 4 以降を推奨します（メモリ 4GB 以上）
- スワップ領域を 2GB 以上に拡張することを推奨します：
  ```bash
  sudo dphys-swapfile swapoff
  sudo sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
  sudo dphys-swapfile setup
  sudo dphys-swapfile swapon
  ```
