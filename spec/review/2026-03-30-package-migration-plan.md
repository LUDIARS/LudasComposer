# 切り離しパッケージの解決方針 (2026-03-30)

## 背景

ビルド最適化のため、以下の重量パッケージを Ars リポジトリから除去した。

| パッケージ | 旧用途 | ビルドコスト | 除去理由 |
|-----------|--------|-------------|---------|
| `surrealdb` + RocksDB | ユーザー・プロジェクトのグラフ DB | ~400s (C++) | 組み込み DB → 外部サービス化 |
| `aws-sdk-ssm` + `aws-lc-sys` | SSM Parameter Store 経由のシークレット取得 | ~100s (C) | 専用サーバーに移管 |

これらの機能は **ArsServer** という別リポジトリで再構築する。

---

## 1. ArsServer の責務

ArsServer は Ars エディタ（Web 版）のバックエンドサービスとして、以下を担当する。

```
┌─────────────────────────────────────────────────────────┐
│  Ars Editor (Frontend + BFF)                            │
│  ・React UI                                              │
│  ・Axum BFF (認証プロキシ、ファイル操作、WebSocket)       │
│                                                          │
│  ※ DB を直接持たない。ArsServer に委譲                    │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/gRPC
┌────────────────────▼────────────────────────────────────┐
│  ArsServer (新規リポジトリ)                              │
│                                                          │
│  ├─ ユーザー管理 (CRUD、OAuth 連携)                      │
│  ├─ プロジェクト管理 (CRUD、所有権)                      │
│  ├─ プロジェクト設定 (KV ストア)                         │
│  ├─ シークレット配信 (AWS SSM → アプリへ中継)            │
│  └─ (将来) AST グラフ管理                                │
│                                                          │
│  PostgreSQL ─── ユーザー、プロジェクト、設定              │
│  (Redis) ────── セッション (既存のまま Ars 側に残す案も)  │
└─────────────────────────────────────────────────────────┘
```

### なぜ分離するか

- **ビルド分離**: DB ドライバーやAWS SDK のビルドがエディタに波及しない
- **デプロイ独立**: エディタと API サーバーのリリースサイクルを分離
- **スケーラビリティ**: API サーバーのみ水平スケール可能
- **技術選択の自由**: GraphDB → RDB 等、エディタに影響なく変更可能

---

## 2. SurrealDB の解決

### 現状（暫定）

SurrealDB を HTTP クライアント経由で外部接続する構成に変更済み。
`docker-compose` で `surrealdb/surrealdb:v2` コンテナを起動。

```
Ars (web-server) --HTTP--> SurrealDB コンテナ (port 8000)
```

### 移行先: PostgreSQL (ArsServer)

SurrealDB のグラフ機能は `owns_project` リレーション 1 本のみで、
実質 RDB の外部キー JOIN と等価。PostgreSQL で十分。

#### テーブル設計（案）

```sql
-- ユーザー
CREATE TABLE users (
    id          UUID PRIMARY KEY,
    github_id   BIGINT UNIQUE NOT NULL,
    login       TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url  TEXT NOT NULL,
    email       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- プロジェクト（所有権は user_id 外部キーで表現）
CREATE TABLE projects (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    data        JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_user_id ON projects(user_id);

-- プロジェクト設定
CREATE TABLE project_settings (
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, setting_key)
);
```

#### 移行手順

1. ArsServer リポジトリを作成（PostgreSQL + Axum or Actix-web）
2. 上記テーブルを作成し、REST API を実装
3. Ars 側の `surrealdb_client.rs` → ArsServer HTTP クライアントに差し替え
4. `surreal_repo.rs` → `server_repo.rs`（ArsServer API を呼ぶ Repository 実装）
5. docker-compose から `surrealdb` サービスを削除
6. `surrealdb_client.rs` を削除

#### Ars 側の変更は最小限

既にリポジトリトレイト（`ProjectRepository`, `UserRepository`）経由でアクセスしているため、
Repository 実装を差し替えるだけでエディタ本体のコードは変更不要。

```rust
// 現在: SurrealDB HTTP クライアント
let project_repo = Arc::new(SurrealProjectRepository::new(surreal_client));

// 移行後: ArsServer API クライアント
let project_repo = Arc::new(ArsServerProjectRepository::new(api_client));
```

---

## 3. AWS SSM の解決

### 現状

`ars-secrets` クレートから AWS SDK を除去済み。
`SecretsProvider::AwsSsm` を選択するとランタイムエラーで ArsServer への移行を案内。

### 移行先: ArsServer 経由のシークレット配信

```
                     ┌───────────────────────┐
                     │  AWS SSM              │
                     │  Parameter Store      │
                     └───────┬───────────────┘
                             │ aws-sdk-ssm
                     ┌───────▼───────────────┐
                     │  ArsServer            │
                     │  GET /api/secrets/:key │
                     └───────┬───────────────┘
                             │ HTTP
                     ┌───────▼───────────────┐
                     │  Ars (web-server)     │
                     │  ars-secrets crate    │
                     └───────────────────────┘
```

#### ars-secrets の変更

新しいプロバイダー `ArsServer` を追加し、HTTP で ArsServer からシークレットを取得する。

```toml
# secrets.toml（移行後）
provider = "ars-server"

[ars_server]
url = "http://ars-server:8080"
auth_token = "..."  # サービス間認証トークン
```

```rust
// 新プロバイダー実装（reqwest ベース、AWS SDK 不要）
pub struct ArsServerSecretsClient {
    http: reqwest::Client,
    base_url: String,
    auth_token: String,
}
```

#### Infisical との併存

Infisical プロバイダーは引き続きサポート。
ArsServer 経由と Infisical 直接接続のどちらかを `secrets.toml` で選択可能。

---

## 4. 将来: AST グラフ管理

元々 SurrealDB を選定した動機は AST 解析情報のグラフ格納。
この機能が必要になった場合の選択肢:

| 選択肢 | 特徴 |
|--------|------|
| **PostgreSQL + JSONB** | 現行スキーマに追加。木構造は `ltree` or 隣接リスト |
| **Neo4j** | 本格的なグラフ走査（複数ホップ、パターンマッチ）が必要な場合 |
| **SurrealDB (外部)** | ArsServer のバックエンドとして組み込む（ビルドコストは ArsServer に閉じる） |

いずれも ArsServer 内に閉じるため、Ars エディタのビルドには影響しない。

---

## 5. 移行タイムライン

| フェーズ | 作業 | Ars 側の変更 |
|---------|------|-------------|
| **現在** | SurrealDB HTTP 化 + AWS SDK 除去（完了） | 済 |
| **Phase 1** | ArsServer リポジトリ作成、PostgreSQL スキーマ構築 | なし |
| **Phase 2** | ArsServer に REST API 実装（ユーザー、プロジェクト、設定） | なし |
| **Phase 3** | Ars の Repository 実装を ArsServer クライアントに差し替え | `surreal_repo.rs` → `server_repo.rs` |
| **Phase 4** | ArsServer にシークレット配信 API 追加 | `ars-secrets` に新プロバイダー追加 |
| **Phase 5** | SurrealDB 完全撤去 | `surrealdb_client.rs` 削除、docker-compose 整理 |
