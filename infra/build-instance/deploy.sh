#!/bin/bash
# =============================================================================
# deploy.sh
# 運用サーバ (t4g.small) 上で実行するデプロイスクリプト
#
# 使用方法:
#   ./deploy.sh                     # latest をデプロイ
#   ./deploy.sh --version v0.2.0    # 特定バージョンをデプロイ
#   ./deploy.sh --build 20260311-abc1234  # 特定ビルドをデプロイ
#   ./deploy.sh --rollback          # 直前のバージョンにロールバック
#
# 環境変数:
#   S3_BUCKET       - S3 バケット名 (デフォルト: ars-build-artifacts)
#   DEPLOY_DIR      - デプロイ先ディレクトリ (デフォルト: /opt/ars-editor)
#   SERVICE_NAME    - systemd サービス名 (デフォルト: ars-web-server)
# =============================================================================
set -euo pipefail

# ----- 設定 -----
S3_BUCKET="${S3_BUCKET:-ars-build-artifacts}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/ars-editor}"
SERVICE_NAME="${SERVICE_NAME:-ars-web-server}"
BACKUP_DIR="$DEPLOY_DIR/backup"
DOWNLOAD_DIR="/tmp/ars-deploy"
S3_PATH="builds/latest"
ROLLBACK=false

# ----- 引数パース -----
while [[ $# -gt 0 ]]; do
  case $1 in
    --version)
      S3_PATH="builds/$2"
      shift 2
      ;;
    --build)
      S3_PATH="builds/$2"
      shift 2
      ;;
    --rollback)
      ROLLBACK=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

LOG_PREFIX="[ars-deploy]"
log() { echo "$LOG_PREFIX $(date '+%Y-%m-%d %H:%M:%S') $*"; }
error_exit() { log "ERROR: $*"; exit 1; }

# =============================================================================
# ロールバック
# =============================================================================
if [ "$ROLLBACK" = true ]; then
  log "ロールバックを実行中..."

  if [ ! -d "$BACKUP_DIR" ]; then
    error_exit "バックアップが見つかりません: $BACKUP_DIR"
  fi

  if [ ! -f "$BACKUP_DIR/ars-web-server" ]; then
    error_exit "バックアップにバイナリがありません"
  fi

  sudo systemctl stop "$SERVICE_NAME" || true

  cp "$BACKUP_DIR/ars-web-server" "$DEPLOY_DIR/ars-web-server"
  chmod +x "$DEPLOY_DIR/ars-web-server"

  if [ -f "$BACKUP_DIR/dist.tar.gz" ]; then
    rm -rf "$DEPLOY_DIR/dist"
    tar xzf "$BACKUP_DIR/dist.tar.gz" -C "$DEPLOY_DIR"
  fi

  sudo systemctl start "$SERVICE_NAME"
  log "ロールバック完了"
  exit 0
fi

# =============================================================================
# 1. ビルド成果物のダウンロード
# =============================================================================
log "ビルド成果物をダウンロード中 (s3://$S3_BUCKET/$S3_PATH/)..."
rm -rf "$DOWNLOAD_DIR"
mkdir -p "$DOWNLOAD_DIR"

aws s3 cp "s3://$S3_BUCKET/$S3_PATH/dist.tar.gz"      "$DOWNLOAD_DIR/dist.tar.gz"
aws s3 cp "s3://$S3_BUCKET/$S3_PATH/ars-web-server"    "$DOWNLOAD_DIR/ars-web-server"
aws s3 cp "s3://$S3_BUCKET/$S3_PATH/build-info.json"   "$DOWNLOAD_DIR/build-info.json"

# ダウンロード検証
if [ ! -f "$DOWNLOAD_DIR/dist.tar.gz" ] || [ ! -f "$DOWNLOAD_DIR/ars-web-server" ]; then
  error_exit "ダウンロードに失敗しました"
fi

# ビルド情報を表示
log "ビルド情報:"
cat "$DOWNLOAD_DIR/build-info.json" | jq '.' 2>/dev/null || cat "$DOWNLOAD_DIR/build-info.json"

# =============================================================================
# 2. バックアップ
# =============================================================================
log "現在のデプロイをバックアップ中..."
mkdir -p "$BACKUP_DIR"
mkdir -p "$DEPLOY_DIR"

if [ -f "$DEPLOY_DIR/ars-web-server" ]; then
  cp "$DEPLOY_DIR/ars-web-server" "$BACKUP_DIR/ars-web-server"
fi

if [ -d "$DEPLOY_DIR/dist" ]; then
  tar czf "$BACKUP_DIR/dist.tar.gz" -C "$DEPLOY_DIR" dist/
fi

if [ -f "$DEPLOY_DIR/build-info.json" ]; then
  cp "$DEPLOY_DIR/build-info.json" "$BACKUP_DIR/build-info.json"
fi

# =============================================================================
# 3. デプロイ
# =============================================================================
log "デプロイ中..."

# サービス停止
sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true

# フロントエンド展開
rm -rf "$DEPLOY_DIR/dist"
tar xzf "$DOWNLOAD_DIR/dist.tar.gz" -C "$DEPLOY_DIR"

# バイナリ配置
cp "$DOWNLOAD_DIR/ars-web-server" "$DEPLOY_DIR/ars-web-server"
chmod +x "$DEPLOY_DIR/ars-web-server"

# ビルド情報配置
cp "$DOWNLOAD_DIR/build-info.json" "$DEPLOY_DIR/build-info.json"

# =============================================================================
# 4. サービス再起動
# =============================================================================
log "サービスを再起動中..."
sudo systemctl start "$SERVICE_NAME"

# ヘルスチェック (5秒待って確認)
sleep 3
if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
  log "サービスは正常に起動しました"
else
  log "WARNING: サービスの起動に失敗しました。ロールバックします..."

  # ロールバック
  if [ -f "$BACKUP_DIR/ars-web-server" ]; then
    cp "$BACKUP_DIR/ars-web-server" "$DEPLOY_DIR/ars-web-server"
    chmod +x "$DEPLOY_DIR/ars-web-server"
    if [ -f "$BACKUP_DIR/dist.tar.gz" ]; then
      rm -rf "$DEPLOY_DIR/dist"
      tar xzf "$BACKUP_DIR/dist.tar.gz" -C "$DEPLOY_DIR"
    fi
    sudo systemctl start "$SERVICE_NAME"
    error_exit "デプロイ失敗。前のバージョンにロールバックしました"
  else
    error_exit "デプロイ失敗。バックアップもありません。手動確認が必要です"
  fi
fi

# =============================================================================
# 5. 完了
# =============================================================================
# クリーンアップ
rm -rf "$DOWNLOAD_DIR"

DEPLOY_VERSION=$(jq -r '.version // "unknown"' "$DEPLOY_DIR/build-info.json" 2>/dev/null || echo "unknown")
DEPLOY_COMMIT=$(jq -r '.commit_short // "unknown"' "$DEPLOY_DIR/build-info.json" 2>/dev/null || echo "unknown")

log "=== デプロイ完了 ==="
log "バージョン: $DEPLOY_VERSION"
log "コミット:   $DEPLOY_COMMIT"
log "デプロイ先: $DEPLOY_DIR"
