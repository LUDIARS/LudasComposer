# 専用ビルドインスタンス設計書

## 1. 概要

t4g.small (2 vCPU / 2GB RAM) の運用サーバでは Rust + Vite のビルドが重すぎるため、
専用のビルドインスタンスを用意してビルドをオフロードする。

### 基本方針

- ビルドインスタンスは普段 **停止状態** で、ビルド時のみ起動する
- ストレージ (EBS) は永続化し、ソースコードやビルドキャッシュを保持する
- ビルド成果物は **S3** にアップロードする
- 運用サーバは S3 からビルド成果物をダウンロードしてデプロイする

## 2. アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AWS Account                                 │
│                                                                     │
│  ┌──────────────┐     ┌──────────────┐     ┌────────────────────┐  │
│  │  GitHub       │     │ Build Server │     │  S3 Bucket         │  │
│  │  (main branch)│────▶│ c7g.2xlarge  │────▶│  ars-build-artifacts│  │
│  │              │     │ (ARM/Graviton)│     │                    │  │
│  └──────────────┘     │              │     │  /builds/          │  │
│         │             │ - git pull    │     │    v0.1.0/         │  │
│         │             │ - npm ci      │     │      dist.tar.gz  │  │
│         │             │ - npm build   │     │      server.tar.gz│  │
│         │             │ - cargo build │     │    latest/         │  │
│         │             │ - upload to S3│     │      dist.tar.gz  │  │
│         │             └──────┬───────┘     │      server.tar.gz│  │
│         │                    │              └────────┬───────────┘  │
│         │                    │ 停止                   │              │
│         │                    ▼                       │              │
│         │             ┌──────────────┐              │              │
│         │             │  EBS Volume   │              │              │
│         │             │  (永続化)      │              │              │
│         │             │ - ソースコード  │              │              │
│         │             │ - cargo cache │              │              │
│         │             │ - node_modules│              │              │
│         │             └──────────────┘              │              │
│         │                                           │              │
│         │             ┌──────────────┐              │              │
│         └────────────▶│ Production   │◀─────────────┘              │
│                       │ t4g.small    │                              │
│                       │ (ARM/Graviton)│  aws s3 cp                  │
│                       │              │                              │
│                       │ - ars-web-   │                              │
│                       │   server     │                              │
│                       │ - dist/      │                              │
│                       └──────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      ビルドフロー                                     │
│                                                                     │
│  GitHub push ──▶ GitHub Actions ──▶ EC2 起動 ──▶ ビルド ──▶ S3 upload │
│                                                    │                │
│                                                    ▼                │
│                                              EC2 停止              │
│                                                    │                │
│  (手動 or 自動) ──▶ Production: S3 download ──▶ サービス再起動         │
└─────────────────────────────────────────────────────────────────────┘
```

## 3. インフラ構成

### 3.1 ビルドインスタンス

| 項目 | 値 |
|------|------|
| インスタンスタイプ | **c7g.2xlarge** (8 vCPU / 16GB RAM, Graviton3) |
| アーキテクチャ | ARM64 (aarch64) - 運用サーバと同一 |
| AMI | Ubuntu 24.04 LTS ARM64 |
| EBS | gp3 30GB (ソース + ビルドキャッシュ用) |
| セキュリティグループ | SSH (22) のみ、IP制限推奨 |
| IAM ロール | `ars-build-instance-role` |
| 通常状態 | **停止** |
| Name タグ | `ars-build-server` |

#### インスタンスタイプの選定理由

- **c7g.2xlarge**: 8 vCPU で Rust のコンパイルを高速化。Graviton3 は ARM ネイティブで
  運用サーバ (t4g) とアーキテクチャが一致するため、クロスコンパイル不要
- 停止時はEBSストレージ料金 (月額約$2.40) のみ発生
- 起動時: $0.289/h × ビルド時間 (約5-10分) = **1回あたり約$0.02-0.05**

### 3.2 S3 バケット

| 項目 | 値 |
|------|------|
| バケット名 | `ars-build-artifacts` (要変更: グローバルユニーク) |
| リージョン | 運用サーバと同一リージョン |
| バージョニング | 無効 (パスにバージョン含める) |
| ライフサイクル | 90日経過した `builds/` 以下のオブジェクトを削除 (最新10世代は保持) |
| パブリックアクセス | 全てブロック |

#### S3 パス構造

```
s3://ars-build-artifacts/
├── builds/
│   ├── latest/                          # 最新ビルド (常に上書き)
│   │   ├── dist.tar.gz                  # フロントエンド成果物
│   │   ├── ars-web-server               # Web サーババイナリ
│   │   └── build-info.json              # ビルドメタデータ
│   ├── v0.1.0/                          # バージョンタグ付きビルド
│   │   ├── dist.tar.gz
│   │   ├── ars-web-server
│   │   └── build-info.json
│   └── 20260311-abc1234/                # コミットハッシュ付きビルド
│       ├── dist.tar.gz
│       ├── ars-web-server
│       └── build-info.json
```

#### `build-info.json` の構造

```json
{
  "version": "0.1.0",
  "commit": "abc1234def5678",
  "branch": "main",
  "build_date": "2026-03-11T10:30:00Z",
  "build_instance": "i-0123456789abcdef0",
  "rust_version": "1.77.2",
  "node_version": "20.11.0"
}
```

### 3.3 IAM 構成

#### ビルドインスタンス用ロール: `ars-build-instance-role`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3BuildArtifacts",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::ars-build-artifacts",
        "arn:aws:s3:::ars-build-artifacts/*"
      ]
    }
  ]
}
```

#### 運用サーバ用ポリシー (既存ロールに追加)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3BuildArtifactsRead",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::ars-build-artifacts",
        "arn:aws:s3:::ars-build-artifacts/*"
      ]
    }
  ]
}
```

#### GitHub Actions 用 (EC2 起動/停止)

GitHub OIDC を使用して AssumeRole する。

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EC2BuildInstance",
      "Effect": "Allow",
      "Action": [
        "ec2:StartInstances",
        "ec2:StopInstances",
        "ec2:DescribeInstances",
        "ec2:DescribeInstanceStatus"
      ],
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": {
        "StringEquals": {
          "aws:ResourceTag/Name": "ars-build-server"
        }
      }
    },
    {
      "Sid": "EC2Describe",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeInstanceStatus"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SSMSendCommand",
      "Effect": "Allow",
      "Action": [
        "ssm:SendCommand",
        "ssm:GetCommandInvocation"
      ],
      "Resource": "*"
    }
  ]
}
```

## 4. ビルドフロー詳細

### 4.1 トリガー

| トリガー | 説明 |
|---------|------|
| GitHub Actions (自動) | `main` ブランチへの push 時 |
| GitHub Actions (手動) | `workflow_dispatch` でバージョン指定 |
| SSH 手動実行 | ビルドインスタンスに SSH してスクリプト実行 |

### 4.2 ビルドステップ

```
1. [GitHub Actions] EC2 インスタンスを起動
2. [GitHub Actions] SSM RunCommand でビルドスクリプトを実行
   2a. git pull (または初回は clone)
   2b. npm ci (node_modules が残っていれば差分のみ)
   2c. npm run build (Vite フロントエンドビルド)
   2d. npm run build:web-server (Rust バイナリビルド)
   2e. ビルド成果物を tar.gz に圧縮
   2f. S3 にアップロード (latest/ + バージョン付きパス)
   2g. build-info.json を生成・アップロード
3. [GitHub Actions] EC2 インスタンスを停止
4. [GitHub Actions] ビルド結果を通知 (成功/失敗)
```

### 4.3 デプロイステップ (運用サーバ)

```
1. S3 から最新ビルド成果物をダウンロード
2. 既存の dist/ とバイナリをバックアップ
3. 新しい成果物を展開・配置
4. ars-web-server を再起動 (systemd)
5. ヘルスチェック
6. 失敗時はバックアップからロールバック
```

## 5. コスト試算

| 項目 | 月額コスト |
|------|-----------|
| ビルドインスタンス (停止時 EBS) | ~$2.40 (30GB gp3) |
| ビルドインスタンス (起動時) | ~$0.29/h × 回数 |
| S3 ストレージ | ~$0.50 (数GB程度) |
| S3 転送 (同一リージョン) | $0.00 |
| **月10回ビルドの場合** | **~$3.40/月** |
| **月30回ビルドの場合** | **~$4.30/月** |

## 6. セキュリティ考慮事項

- ビルドインスタンスのセキュリティグループは SSH のみ (IP制限推奨)
- S3 バケットはパブリックアクセス完全ブロック
- IAM ロールは最小権限の原則に従う
- GitHub Actions は OIDC による一時的な認証情報を使用
- SSM を使用することで SSH キーの管理が不要
- ビルドインスタンスに `.env` や秘密情報は置かない (ビルドには不要)

## 7. ファイル構成

```
infra/build-instance/
├── setup-build-instance.sh    # ビルドインスタンス初期セットアップ
├── build.sh                   # ビルド実行スクリプト
└── deploy.sh                  # 運用サーバ用デプロイスクリプト

.github/workflows/
├── build-and-deploy.yml       # ビルド+デプロイ ワークフロー
└── update-web-version.yml     # (既存) バージョン更新
```
