# Ars Editor Web Server - 環境変数セットアップガイド

## 概要

WebサーバーモードでGitHub OAuth認証とDynamoDBクラウドストレージを利用するために、以下の環境変数の設定が必要です。

---

## 必須の環境変数

### GitHub OAuth

| 変数名 | 必須 | 説明 |
|---|---|---|
| `GITHUB_CLIENT_ID` | **必須** | GitHub OAuth Appの Client ID |
| `GITHUB_CLIENT_SECRET` | **必須** | GitHub OAuth Appの Client Secret |
| `GITHUB_REDIRECT_URI` | 任意 | OAuthコールバックURL（デフォルト: `http://localhost:5173/auth/github/callback`） |

### AWS / DynamoDB

| 変数名 | 必須 | 説明 |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | **必須** | AWSアクセスキー |
| `AWS_SECRET_ACCESS_KEY` | **必須** | AWSシークレットキー |
| `AWS_REGION` | **必須** | AWSリージョン（例: `ap-northeast-1`） |
| `DYNAMODB_USERS_TABLE` | 任意 | ユーザーテーブル名（デフォルト: `ars-users`） |
| `DYNAMODB_SESSIONS_TABLE` | 任意 | セッションテーブル名（デフォルト: `ars-sessions`） |
| `DYNAMODB_PROJECTS_TABLE` | 任意 | プロジェクトテーブル名（デフォルト: `ars-projects`） |

### サーバー設定

| 変数名 | 必須 | 説明 |
|---|---|---|
| `PORT` | 任意 | サーバーポート番号（デフォルト: `5173`） |

---

## セットアップ手順

### 1. GitHub OAuth App の作成

1. GitHub > Settings > Developer settings > OAuth Apps > **New OAuth App**
2. 以下を入力:
   - **Application name**: `Ars Editor` (任意)
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:5173/auth/github/callback`
3. 作成後、**Client ID** と **Client Secret** をコピー

### 2. AWS DynamoDB テーブルの作成

以下の3テーブルを作成してください。

#### `ars-users` テーブル
| キー | 型 | 説明 |
|---|---|---|
| `id` (Partition Key) | String | ユーザーID (UUID) |

GSI (Global Secondary Index):
| インデックス名 | Partition Key | 型 |
|---|---|---|
| `github_id-index` | `github_id` | Number |

#### `ars-sessions` テーブル
| キー | 型 | 説明 |
|---|---|---|
| `id` (Partition Key) | String | セッションID (UUID) |

#### `ars-projects` テーブル
| キー | 型 | 説明 |
|---|---|---|
| `user_id` (Partition Key) | String | ユーザーID |
| `project_id` (Sort Key) | String | プロジェクトID |

### 3. `.env` ファイルの作成

```bash
cp ars-editor/src-tauri/.env.example ars-editor/src-tauri/.env
```

`.env` を編集して実際の値を入力:

```env
# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
GITHUB_REDIRECT_URI=http://localhost:5173/auth/github/callback

# AWS
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=ap-northeast-1

# DynamoDB (カスタムテーブル名を使う場合のみ)
# DYNAMODB_USERS_TABLE=ars-users
# DYNAMODB_SESSIONS_TABLE=ars-sessions
# DYNAMODB_PROJECTS_TABLE=ars-projects

# Server
# PORT=5173
```

### 4. Webサーバーの起動

```bash
cd ars-editor

# フロントエンドのビルド
npm run build

# Webサーバー起動（.env を読み込む場合）
cd src-tauri
source .env  # or: set -a && source .env && set +a
cargo run --features web-server --no-default-features --bin ars-web-server -- ../../dist
```

---

## 本番環境向けの注意事項

- `GITHUB_REDIRECT_URI` を本番URLに変更すること
- AWS認証はIAMロール（EC2/ECS）やAWS Profileの利用を推奨（環境変数に直接キーを入れない）
- セッションCookieは `http_only` + `SameSite=Lax` で設定済み
- 本番では HTTPS + `Secure` cookie フラグの追加を検討すること
- DynamoDB テーブルにTTL属性を設定してセッションの自動クリーンアップを行うことを推奨
