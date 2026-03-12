#!/bin/bash
# =============================================================================
# setup-iam.sh
# IAM ロール・ポリシー・OIDC プロバイダーの作成スクリプト
#
# 使用方法:
#   # 環境変数を設定して実行
#   export AWS_ACCOUNT_ID="123456789012"
#   export S3_BUCKET="ars-build-artifacts"
#   export GITHUB_ORG="LUDIARS"
#   export GITHUB_REPO="Ars"
#   export AWS_REGION="ap-northeast-1"
#   bash setup-iam.sh
#
#   # または引数で指定
#   bash setup-iam.sh --account-id 123456789012 --bucket my-bucket
#
# 前提条件:
#   - AWS CLI v2 がインストール済みで、IAM 管理権限のあるプロファイルで認証済み
#   - S3 バケットは別途作成済み (このスクリプトでは作成しない)
# =============================================================================
set -euo pipefail

# ----- 設定 -----
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-}"
S3_BUCKET="${S3_BUCKET:-ars-build-artifacts}"
GITHUB_ORG="${GITHUB_ORG:-LUDIARS}"
GITHUB_REPO="${GITHUB_REPO:-Ars}"
AWS_REGION="${AWS_REGION:-ap-northeast-1}"

# ----- 引数パース -----
while [[ $# -gt 0 ]]; do
  case $1 in
    --account-id)   AWS_ACCOUNT_ID="$2"; shift 2 ;;
    --bucket)       S3_BUCKET="$2"; shift 2 ;;
    --github-org)   GITHUB_ORG="$2"; shift 2 ;;
    --github-repo)  GITHUB_REPO="$2"; shift 2 ;;
    --region)       AWS_REGION="$2"; shift 2 ;;
    --help)
      echo "Usage: $0 [--account-id ID] [--bucket NAME] [--github-org ORG] [--github-repo REPO] [--region REGION]"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# アカウント ID の自動取得
if [ -z "$AWS_ACCOUNT_ID" ]; then
  AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
  echo "Auto-detected AWS Account ID: $AWS_ACCOUNT_ID"
fi

LOG_PREFIX="[ars-iam-setup]"
log() { echo "$LOG_PREFIX $*"; }
POLICY_DIR="/tmp/ars-iam-policies"
rm -rf "$POLICY_DIR"
mkdir -p "$POLICY_DIR"

log "=== IAM セットアップ開始 ==="
log "Account:  $AWS_ACCOUNT_ID"
log "Region:   $AWS_REGION"
log "S3:       $S3_BUCKET"
log "GitHub:   $GITHUB_ORG/$GITHUB_REPO"
echo ""

# =============================================================================
# 1. GitHub Actions OIDC プロバイダー
# =============================================================================
log "[1/6] GitHub Actions OIDC プロバイダー..."

OIDC_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" &>/dev/null; then
  log "  既に存在します。スキップ。"
else
  THUMBPRINT="6938fd4d98bab03faadb97b34396831e3780aea1"
  aws iam create-open-id-connect-provider \
    --url "https://token.actions.githubusercontent.com" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "$THUMBPRINT"
  log "  作成しました。"
fi

# =============================================================================
# 2. ビルドインスタンス用ポリシー: ars-build-instance-s3
# =============================================================================
log "[2/6] ビルドインスタンス用 S3 ポリシー: ars-build-instance-s3..."

cat > "$POLICY_DIR/build-instance-s3.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3BuildArtifactsReadWrite",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::${S3_BUCKET}",
        "arn:aws:s3:::${S3_BUCKET}/*"
      ]
    }
  ]
}
EOF

POLICY_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:policy/ars-build-instance-s3"
if aws iam get-policy --policy-arn "$POLICY_ARN" &>/dev/null; then
  log "  ポリシーは既に存在。新バージョンを作成..."
  aws iam create-policy-version \
    --policy-arn "$POLICY_ARN" \
    --policy-document "file://$POLICY_DIR/build-instance-s3.json" \
    --set-as-default
else
  aws iam create-policy \
    --policy-name "ars-build-instance-s3" \
    --policy-document "file://$POLICY_DIR/build-instance-s3.json" \
    --description "Allow build instance to read/write S3 build artifacts"
  log "  作成しました。"
fi

# =============================================================================
# 3. ビルドインスタンス用ロール: ars-build-instance-role
# =============================================================================
log "[3/6] ビルドインスタンス用ロール: ars-build-instance-role..."

cat > "$POLICY_DIR/ec2-trust.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ec2.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

if aws iam get-role --role-name "ars-build-instance-role" &>/dev/null; then
  log "  ロールは既に存在。スキップ。"
else
  aws iam create-role \
    --role-name "ars-build-instance-role" \
    --assume-role-policy-document "file://$POLICY_DIR/ec2-trust.json" \
    --description "Role for ars-build-server EC2 instance"
  log "  作成しました。"
fi

# ポリシーのアタッチ
aws iam attach-role-policy \
  --role-name "ars-build-instance-role" \
  --policy-arn "$POLICY_ARN" 2>/dev/null || true

# SSM 用マネージドポリシー (SSM Agent が動作するために必要)
aws iam attach-role-policy \
  --role-name "ars-build-instance-role" \
  --policy-arn "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore" 2>/dev/null || true

# インスタンスプロファイルの作成
if aws iam get-instance-profile --instance-profile-name "ars-build-instance-profile" &>/dev/null; then
  log "  インスタンスプロファイルは既に存在。"
else
  aws iam create-instance-profile \
    --instance-profile-name "ars-build-instance-profile"
  aws iam add-role-to-instance-profile \
    --instance-profile-name "ars-build-instance-profile" \
    --role-name "ars-build-instance-role"
  log "  インスタンスプロファイルを作成しました。"
fi

# =============================================================================
# 4. 運用サーバ用ポリシー: ars-prod-s3-readonly
# =============================================================================
log "[4/6] 運用サーバ用 S3 読み取りポリシー: ars-prod-s3-readonly..."

cat > "$POLICY_DIR/prod-s3-readonly.json" <<EOF
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
        "arn:aws:s3:::${S3_BUCKET}",
        "arn:aws:s3:::${S3_BUCKET}/*"
      ]
    }
  ]
}
EOF

PROD_POLICY_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:policy/ars-prod-s3-readonly"
if aws iam get-policy --policy-arn "$PROD_POLICY_ARN" &>/dev/null; then
  log "  ポリシーは既に存在。新バージョンを作成..."
  aws iam create-policy-version \
    --policy-arn "$PROD_POLICY_ARN" \
    --policy-document "file://$POLICY_DIR/prod-s3-readonly.json" \
    --set-as-default
else
  aws iam create-policy \
    --policy-name "ars-prod-s3-readonly" \
    --policy-document "file://$POLICY_DIR/prod-s3-readonly.json" \
    --description "Allow production server to read S3 build artifacts"
  log "  作成しました。"
fi

log "  ※ 運用サーバの既存ロールにこのポリシーを手動でアタッチしてください:"
log "    aws iam attach-role-policy --role-name <PROD_ROLE_NAME> --policy-arn $PROD_POLICY_ARN"

# =============================================================================
# 5. GitHub Actions ビルド用ロール: ars-github-actions-build
# =============================================================================
log "[5/6] GitHub Actions ビルド用ロール: ars-github-actions-build..."

cat > "$POLICY_DIR/github-actions-build-trust.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_ORG}/${GITHUB_REPO}:*"
        }
      }
    }
  ]
}
EOF

cat > "$POLICY_DIR/github-actions-build-policy.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EC2BuildInstanceStartStop",
      "Effect": "Allow",
      "Action": [
        "ec2:StartInstances",
        "ec2:StopInstances",
        "ec2:ModifyInstanceAttribute"
      ],
      "Resource": "arn:aws:ec2:${AWS_REGION}:${AWS_ACCOUNT_ID}:instance/*",
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
      "Sid": "SSMRunCommand",
      "Effect": "Allow",
      "Action": [
        "ssm:SendCommand",
        "ssm:GetCommandInvocation",
        "ssm:DescribeInstanceInformation"
      ],
      "Resource": "*"
    }
  ]
}
EOF

if aws iam get-role --role-name "ars-github-actions-build" &>/dev/null; then
  log "  ロールは既に存在。信頼ポリシーを更新..."
  aws iam update-assume-role-policy \
    --role-name "ars-github-actions-build" \
    --policy-document "file://$POLICY_DIR/github-actions-build-trust.json"
else
  aws iam create-role \
    --role-name "ars-github-actions-build" \
    --assume-role-policy-document "file://$POLICY_DIR/github-actions-build-trust.json" \
    --description "GitHub Actions role for building on dedicated EC2 instance"
  log "  作成しました。"
fi

BUILD_ACTIONS_POLICY_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:policy/ars-github-actions-build"
if aws iam get-policy --policy-arn "$BUILD_ACTIONS_POLICY_ARN" &>/dev/null; then
  aws iam create-policy-version \
    --policy-arn "$BUILD_ACTIONS_POLICY_ARN" \
    --policy-document "file://$POLICY_DIR/github-actions-build-policy.json" \
    --set-as-default
else
  aws iam create-policy \
    --policy-name "ars-github-actions-build" \
    --policy-document "file://$POLICY_DIR/github-actions-build-policy.json" \
    --description "EC2 start/stop and SSM permissions for build workflow"
fi

aws iam attach-role-policy \
  --role-name "ars-github-actions-build" \
  --policy-arn "$BUILD_ACTIONS_POLICY_ARN" 2>/dev/null || true

# =============================================================================
# 6. GitHub Actions デプロイ用ロール: ars-github-actions-deploy
# =============================================================================
log "[6/6] GitHub Actions デプロイ用ロール: ars-github-actions-deploy..."

cat > "$POLICY_DIR/github-actions-deploy-trust.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_ORG}/${GITHUB_REPO}:environment:production"
        }
      }
    }
  ]
}
EOF

cat > "$POLICY_DIR/github-actions-deploy-policy.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SSMDeployCommand",
      "Effect": "Allow",
      "Action": [
        "ssm:SendCommand",
        "ssm:GetCommandInvocation"
      ],
      "Resource": "*"
    }
  ]
}
EOF

if aws iam get-role --role-name "ars-github-actions-deploy" &>/dev/null; then
  log "  ロールは既に存在。信頼ポリシーを更新..."
  aws iam update-assume-role-policy \
    --role-name "ars-github-actions-deploy" \
    --policy-document "file://$POLICY_DIR/github-actions-deploy-trust.json"
else
  aws iam create-role \
    --role-name "ars-github-actions-deploy" \
    --assume-role-policy-document "file://$POLICY_DIR/github-actions-deploy-trust.json" \
    --description "GitHub Actions role for deploying to production via SSM"
  log "  作成しました。"
fi

DEPLOY_ACTIONS_POLICY_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:policy/ars-github-actions-deploy"
if aws iam get-policy --policy-arn "$DEPLOY_ACTIONS_POLICY_ARN" &>/dev/null; then
  aws iam create-policy-version \
    --policy-arn "$DEPLOY_ACTIONS_POLICY_ARN" \
    --policy-document "file://$POLICY_DIR/github-actions-deploy-policy.json" \
    --set-as-default
else
  aws iam create-policy \
    --policy-name "ars-github-actions-deploy" \
    --policy-document "file://$POLICY_DIR/github-actions-deploy-policy.json" \
    --description "SSM permissions for deploy workflow"
fi

aws iam attach-role-policy \
  --role-name "ars-github-actions-deploy" \
  --policy-arn "$DEPLOY_ACTIONS_POLICY_ARN" 2>/dev/null || true

# =============================================================================
# 完了サマリー
# =============================================================================
rm -rf "$POLICY_DIR"

echo ""
log "=== IAM セットアップ完了 ==="
echo ""
log "作成されたリソース:"
log ""
log "  ロール:"
log "    - ars-build-instance-role       (EC2 ビルドインスタンス用)"
log "    - ars-github-actions-build      (GitHub Actions ビルド用)"
log "    - ars-github-actions-deploy     (GitHub Actions デプロイ用)"
log ""
log "  ポリシー:"
log "    - ars-build-instance-s3         (S3 読み書き)"
log "    - ars-prod-s3-readonly          (S3 読み取り専用)"
log "    - ars-github-actions-build      (EC2 起動/停止 + SSM)"
log "    - ars-github-actions-deploy     (SSM デプロイ)"
log ""
log "  インスタンスプロファイル:"
log "    - ars-build-instance-profile    (ビルドインスタンスにアタッチ)"
log ""
log "  OIDC プロバイダー:"
log "    - token.actions.githubusercontent.com"
log ""
log "=== 次のステップ ==="
log ""
log "  1. ビルドインスタンスにプロファイルをアタッチ:"
log "     aws ec2 associate-iam-instance-profile \\"
log "       --instance-id <BUILD_INSTANCE_ID> \\"
log "       --iam-instance-profile Name=ars-build-instance-profile"
log ""
log "  2. 運用サーバの既存ロールに S3 読み取りポリシーをアタッチ:"
log "     aws iam attach-role-policy \\"
log "       --role-name <PROD_ROLE_NAME> \\"
log "       --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/ars-prod-s3-readonly"
log ""
log "  3. GitHub リポジトリの Variables を設定:"
log "     AWS_BUILD_ROLE_ARN  = arn:aws:iam::${AWS_ACCOUNT_ID}:role/ars-github-actions-build"
log "     AWS_DEPLOY_ROLE_ARN = arn:aws:iam::${AWS_ACCOUNT_ID}:role/ars-github-actions-deploy"
log "     BUILD_INSTANCE_ID   = <ビルドインスタンスの ID>"
log "     PROD_INSTANCE_ID    = <運用インスタンスの ID>"
log "     S3_BUCKET           = ${S3_BUCKET}"
