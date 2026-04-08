# GitHub Secrets 設定ガイド

結合テストの CI 実行に必���な GitHub Secrets の設定方法。

## シークレット一覧

### Organization Secrets (ludiars org レベル)

Infisical Machine Identity の認証情報。全リポジトリで共有。

| シークレット名 | 説明 | 設定場所 |
|---|---|---|
| `INFISICAL_CLIENT_ID` | Machine Identity Client ID | GitHub Organization Settings → Secrets → Actions |
| `INFISICAL_CLIENT_SECRET` | Machine Identity Client Secret | GitHub Organization Settings → Secrets → Actions |

### Repository Secrets (ludiars/ars リポジトリレベル)

プロジェクト固有の設定値。

| シークレット名 | 説明 | 例 |
|---|---|---|
| `INFISICAL_PROJECT_ID` | Infisical プロジェクト ID | `proj_xxxxxxxx` |
| `INFISICAL_HOST` | Infisical ホスト URL | `https://app.infisical.com` |
| `INFISICAL_ENVIRONMENT` | 環境名 | `dev` / `staging` / `prod` |

## 設定手順

### 1. Organization Secrets

```
GitHub → ludiars org → Settings → Secrets and variables → Actions
→ New organization secret
```

- **Visibility**: `Selected repositories` → `ludiars/ars` を選択
- Machine Identity の Client ID / Client Secret を設定

### 2. Repository Secrets

```
GitHub → ludiars/ars → Settings → Secrets and variables → Actions
→ New repository secret
```

- Infisical のプロジェクト固有設定を登録

## Infisical Machine Identity 作成手順

1. Infisical ダッシュボード → Settings → Machine Identities
2. `New Machine Identity` → 名前: `ars-ci`
3. Authentication Method: `Universal Auth`
4. `Client ID` と `Client Secret` をコピー
5. Machine Identity にプロジェクトへの Read アクセスを付与

## 結合テストでの使われ方

現在の結合テストでは Mock Cernere サーバーを使用するため、
実際の Infisical 接続は**不要**です。

これらのシークレットは将来の以下のテストで使用予定:
- Docker 環境での E2E テスト
- ステージング環境への自動デプロイ後テスト
- Cernere 実サーバーを使った認証フローテ��ト

## ローカル開発

ローカルでの結合テスト実行時は Infisical シークレット不要:

```bash
cd tests/integration
npm ci
npx playwright install chromium
npx playwright test
```

バックエンドのビルドが必要:

```bash
cd ars-editor
npm ci && npm run build
cd src-tauri
cargo build --features web-server --no-default-features --bin ars-web-server
```
