# Self-hosted Runner セットアップガイド

結合テストは self-hosted runner 上で手動実行 (`workflow_dispatch`) する。
Infisical のシークレットは **runner 環境に直接配置** し、GitHub Secrets は使用しない。

## 前提条件

Self-hosted runner に以下がインストール済みであること:

- Node.js 20+
- Rust toolchain (rustup)
- clang, cmake (Rust ビルド用)
- Chromium (Playwright 用、初回は自動インストール)

## Infisical 設定

Runner 上に `secrets.toml` を配置する。アプリが自動検出する。

### 配置先 (優先順)

1. `./secrets.toml` (リポジトリルート)
2. `~/.config/ars/secrets.toml`

### 設定ファイル例

```toml
provider = "infisical"

[infisical]
host = "https://app.infisical.com"
client_id = "<Machine Identity Client ID>"
client_secret = "<Machine Identity Client Secret>"
project_id = "<Project ID>"
environment = "dev"
shared_path = "/shared"
personal_path_prefix = "/personal"
cache_ttl_secs = 300
```

### Machine Identity 作成手順

1. Infisical ダッシュボード → Settings → Machine Identities
2. `New Machine Identity` → 名前: `ars-ci-runner`
3. Authentication Method: `Universal Auth`
4. `Client ID` と `Client Secret` をコピー
5. Machine Identity にプロジェクトへの Read アクセスを付与
6. 上記の値を runner の `secrets.toml` に記入

## テスト実行

### CI (GitHub Actions)

Actions タブ → "Integration Tests" → "Run workflow" ボタン

### ローカル実行

```bash
# バックエンドビルド (差分ビルド)
cd ars-editor
npm ci && npm run build
cd src-tauri
cargo build --features web-server --no-default-features --bin ars-web-server

# テスト実行
cd ../../tests/integration
npm ci
npx playwright install chromium
npx playwright test
```

## 注意事項

- `secrets.toml` は `.gitignore` に含まれておりリポジトリにコミットされない
- Runner の `secrets.toml` はファイルパーミッション `600` を推奨
- 結合テスト自体は Mock Cernere を使用するため Infisical 接続は不要
- Infisical 設定は将来の Docker E2E テスト・ステージングデプロイ用
