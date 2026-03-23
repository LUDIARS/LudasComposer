# Ars (Ars Editor) - Windows セットアップガイド

このガイドでは、Windows 環境で Ars (Ars Editor) を開発・ビルドするための手順を説明します。

## 動作環境

- **OS**: Windows 10 (バージョン 1803 以降) / Windows 11
- **アーキテクチャ**: x86_64 (64-bit)
- **メモリ**: 4GB 以上推奨
- **ディスク**: 10GB 以上の空き容量

## 1. Microsoft Visual Studio Build Tools のインストール

Tauri の Rust バックエンドをコンパイルするために、C++ ビルドツールが必要です。

1. [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) をダウンロード
2. インストーラーを実行
3. **「C++ によるデスクトップ開発」** ワークロードを選択してインストール

> **注意**: Visual Studio 本体（IDE）は不要です。Build Tools のみで十分です。

### 含まれる必要なコンポーネント

- MSVC C++ コンパイラ
- Windows SDK
- C++ CMake ツール

## 2. WebView2 の確認

Tauri v2 は Microsoft Edge WebView2 を使用します。Windows 10 (バージョン 1803 以降) および Windows 11 には通常プリインストールされています。

インストールされていない場合は、[WebView2 ランタイム](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) からダウンロードしてください。

## 3. Node.js のインストール

### 方法 A: 公式インストーラー（推奨）

1. [Node.js 公式サイト](https://nodejs.org/) から LTS 版をダウンロード
2. インストーラーを実行（デフォルト設定で OK）
3. PowerShell またはコマンドプロンプトを**再起動**して確認：

```powershell
node --version   # v20.x.x 以上
npm --version    # 10.x.x 以上
```

### 方法 B: winget を使用

```powershell
winget install OpenJS.NodeJS.LTS
```

### 方法 C: nvm-windows を使用

複数の Node.js バージョンを管理したい場合は [nvm-windows](https://github.com/coreybutler/nvm-windows) を使用できます。

```powershell
# nvm-windows インストール後
nvm install lts
nvm use lts
```

## 4. Rust のインストール

1. [rustup-init.exe](https://www.rust-lang.org/tools/install) をダウンロードして実行
2. デフォルト設定で進める（`1` を入力して Enter）
3. PowerShell を**再起動**して確認：

```powershell
rustc --version   # 1.77.2 以上
cargo --version
```

## 5. Git のインストール（未インストールの場合）

```powershell
winget install Git.Git
```

または [Git for Windows](https://gitforwindows.org/) からインストーラーをダウンロードしてください。

## 6. プロジェクトのセットアップ

PowerShell またはコマンドプロンプトで以下を実行します：

```powershell
# リポジトリのクローン
git clone https://github.com/LUDIARS/Ars.git
cd Ars\ars-editor

# npm 依存パッケージのインストール
npm install
```

## 7. 開発サーバーの起動

```powershell
cd ars-editor

# 開発モードで起動（ホットリロード有効）
npx tauri dev
```

初回起動時は Rust のコンパイルに時間がかかります。2回目以降はキャッシュにより高速化されます。

起動すると以下が実行されます：
1. Vite 開発サーバーが `http://localhost:5173` で起動
2. Rust バックエンドがコンパイル
3. デスクトップウィンドウ (1280x800) が表示

## 8. プロダクションビルド

```powershell
cd ars-editor

# プロダクションビルド
npx tauri build
```

ビルド成果物は以下に出力されます：

```
ars-editor\src-tauri\target\release\bundle\
├── msi\        # .msi インストーラー
└── nsis\       # .exe インストーラー (NSIS)
```

## トラブルシューティング

### `link.exe` が見つからない

```
error: linker `link.exe` not found
```

→ Visual Studio Build Tools の **「C++ によるデスクトップ開発」** がインストールされているか確認してください。インストール後、PowerShell を再起動してください。

### Rust コンパイル時にリンカーエラー

```
LINK : fatal error LNK1181: cannot open input file 'kernel32.lib'
```

→ Windows SDK が正しくインストールされていない可能性があります。Visual Studio Installer を開いて「Windows SDK」コンポーネントが選択されているか確認してください。

### `npm install` で node-gyp エラー

```
gyp ERR! find VS
```

→ Visual Studio Build Tools のインストール後、以下を試してください：

```powershell
npm config set msvs_version 2022
```

### ポート 5173 が使用中

```
Port 5173 is already in use
```

→ 他の Vite プロセスが残っている可能性があります：

```powershell
# ポートを使用しているプロセスを確認
netstat -ano | findstr :5173

# プロセスを終了（PID を置き換え）
taskkill /PID <PID> /F
```

### WebView2 が見つからない

```
Error: WebView2 Runtime not found
```

→ [WebView2 ランタイム](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) をインストールしてください。

### Windows Defender によるビルド速度低下

Windows Defender のリアルタイムスキャンがビルドを遅くする場合があります。プロジェクトフォルダと Rust のターゲットフォルダを除外リストに追加してください：

1. **Windows セキュリティ** → **ウイルスと脅威の防止** → **設定の管理**
2. **除外の追加または削除** をクリック
3. 以下のフォルダを追加：
   - プロジェクトフォルダ（例: `C:\Users\<ユーザー名>\Ars`）
   - Cargo のキャッシュ（例: `C:\Users\<ユーザー名>\.cargo`）
   - Rust のターゲットフォルダ（例: `...\ars-editor\src-tauri\target`）

### 長いパスの問題

Windows ではパスの長さに 260 文字の制限があります。Rust のビルドでパスが長くなりすぎる場合：

```powershell
# 管理者権限の PowerShell で実行
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
  -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

Git でも長いパスを有効にします：

```powershell
git config --global core.longpaths true
```
