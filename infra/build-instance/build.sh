#!/bin/bash
# =============================================================================
# build.sh
# ビルドインスタンス上で実行するビルドスクリプト
#
# 使用方法:
#   ./build.sh                    # latest としてビルド
#   ./build.sh --version v0.2.0   # バージョンタグ付きビルド
#   ./build.sh --check-only       # ビルドチェックのみ (S3 アップロードなし)
#
# 環境変数:
#   S3_BUCKET       - S3 バケット名 (デフォルト: ars-build-artifacts)
#   REPO_BRANCH     - ビルド対象ブランチ (デフォルト: main)
#   BUILD_JOBS      - cargo 並列ジョブ数 (デフォルト: CPU数)
# =============================================================================
set -euo pipefail

# ----- 設定 -----
S3_BUCKET="${S3_BUCKET:-ars-build-artifacts}"
REPO_BRANCH="${REPO_BRANCH:-main}"
WORK_DIR="$HOME/Ars"
BUILD_DIR="$WORK_DIR/ars-editor"
ARTIFACT_DIR="/tmp/ars-build-artifacts"
VERSION=""
CHECK_ONLY=false

# ----- 引数パース -----
while [[ $# -gt 0 ]]; do
  case $1 in
    --version)
      VERSION="$2"
      shift 2
      ;;
    --check-only)
      CHECK_ONLY=true
      shift
      ;;
    --branch)
      REPO_BRANCH="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ----- 環境読み込み -----
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
# shellcheck source=/dev/null
[ -s "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"

LOG_PREFIX="[ars-build]"
log() { echo "$LOG_PREFIX $(date '+%Y-%m-%d %H:%M:%S') $*"; }
error_exit() { log "ERROR: $*"; exit 1; }

BUILD_START=$(date +%s)

# =============================================================================
# 1. ソースコードの更新
# =============================================================================
log "ソースコードを更新中 (branch: $REPO_BRANCH)..."
cd "$WORK_DIR"

if [ ! -d ".git" ]; then
  error_exit "リポジトリが見つかりません: $WORK_DIR (setup-build-instance.sh を先に実行してください)"
fi

git fetch origin "$REPO_BRANCH"
git checkout "$REPO_BRANCH"
git reset --hard "origin/$REPO_BRANCH"

COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_FULL=$(git rev-parse HEAD)
BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
BUILD_LABEL=$(date +%Y%m%d)-$COMMIT_HASH

log "コミット: $COMMIT_HASH ($(git log -1 --format='%s'))"

# =============================================================================
# 2. 依存パッケージの更新
# =============================================================================
log "npm 依存パッケージを更新中..."
cd "$BUILD_DIR"
npm ci

# =============================================================================
# 3. フロントエンドビルド
# =============================================================================
log "フロントエンドをビルド中 (TypeScript + Vite)..."
npm run build

# =============================================================================
# 4. Web サーバービルド (Rust)
# =============================================================================
log "Web サーバーをビルド中 (Rust --release)..."
cd "$BUILD_DIR/src-tauri"

CARGO_JOBS="${BUILD_JOBS:-$(nproc)}"
cargo build \
  --features web-server \
  --no-default-features \
  --bin ars-web-server \
  --release \
  -j "$CARGO_JOBS"

# =============================================================================
# 5. ビルドチェック
# =============================================================================
log "ビルド成果物を検証中..."

# フロントエンドの成果物チェック
if [ ! -d "$BUILD_DIR/dist" ]; then
  error_exit "フロントエンドビルド失敗: dist/ が見つかりません"
fi

DIST_SIZE=$(du -sh "$BUILD_DIR/dist" | cut -f1)
log "フロントエンド成果物: $DIST_SIZE"

# Rust バイナリのチェック
BINARY_PATH="$BUILD_DIR/src-tauri/target/release/ars-web-server"
if [ ! -f "$BINARY_PATH" ]; then
  error_exit "Rust ビルド失敗: ars-web-server バイナリが見つかりません"
fi

BINARY_SIZE=$(du -sh "$BINARY_PATH" | cut -f1)
log "サーバーバイナリ: $BINARY_SIZE"

# バイナリが実行可能か確認
file "$BINARY_PATH" | grep -q "aarch64" || error_exit "バイナリが ARM64 ではありません"

if [ "$CHECK_ONLY" = true ]; then
  BUILD_END=$(date +%s)
  BUILD_DURATION=$((BUILD_END - BUILD_START))
  log "=== ビルドチェック完了 (${BUILD_DURATION}秒) ==="
  exit 0
fi

# =============================================================================
# 6. アーティファクトのパッケージング
# =============================================================================
log "アーティファクトをパッケージング中..."
rm -rf "$ARTIFACT_DIR"
mkdir -p "$ARTIFACT_DIR"

# dist.tar.gz
cd "$BUILD_DIR"
tar czf "$ARTIFACT_DIR/dist.tar.gz" dist/

# サーバーバイナリ
cp "$BINARY_PATH" "$ARTIFACT_DIR/ars-web-server"

# バージョン情報
PKG_VERSION=$(node -p "require('./package.json').version")
cat > "$ARTIFACT_DIR/build-info.json" <<EOF
{
  "version": "$PKG_VERSION",
  "commit": "$COMMIT_FULL",
  "commit_short": "$COMMIT_HASH",
  "branch": "$REPO_BRANCH",
  "build_date": "$BUILD_DATE",
  "build_instance": "$(curl -s http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || echo 'unknown')",
  "rust_version": "$(rustc --version | awk '{print $2}')",
  "node_version": "$(node --version)"
}
EOF

# =============================================================================
# 7. S3 アップロード
# =============================================================================
log "S3 にアップロード中 (s3://$S3_BUCKET/)..."

# コミットハッシュ付きパス
S3_BUILD_PATH="builds/$BUILD_LABEL"
aws s3 cp "$ARTIFACT_DIR/dist.tar.gz"      "s3://$S3_BUCKET/$S3_BUILD_PATH/dist.tar.gz"
aws s3 cp "$ARTIFACT_DIR/ars-web-server"    "s3://$S3_BUCKET/$S3_BUILD_PATH/ars-web-server"
aws s3 cp "$ARTIFACT_DIR/build-info.json"   "s3://$S3_BUCKET/$S3_BUILD_PATH/build-info.json"

# latest を上書き
aws s3 cp "$ARTIFACT_DIR/dist.tar.gz"      "s3://$S3_BUCKET/builds/latest/dist.tar.gz"
aws s3 cp "$ARTIFACT_DIR/ars-web-server"    "s3://$S3_BUCKET/builds/latest/ars-web-server"
aws s3 cp "$ARTIFACT_DIR/build-info.json"   "s3://$S3_BUCKET/builds/latest/build-info.json"

# バージョンタグ付きビルド
if [ -n "$VERSION" ]; then
  log "バージョンタグ付きアップロード: $VERSION"
  aws s3 cp "$ARTIFACT_DIR/dist.tar.gz"      "s3://$S3_BUCKET/builds/$VERSION/dist.tar.gz"
  aws s3 cp "$ARTIFACT_DIR/ars-web-server"    "s3://$S3_BUCKET/builds/$VERSION/ars-web-server"
  aws s3 cp "$ARTIFACT_DIR/build-info.json"   "s3://$S3_BUCKET/builds/$VERSION/build-info.json"
fi

# =============================================================================
# 8. 完了
# =============================================================================
BUILD_END=$(date +%s)
BUILD_DURATION=$((BUILD_END - BUILD_START))

log "=== ビルド完了 ==="
log "所要時間:     ${BUILD_DURATION}秒"
log "コミット:     $COMMIT_HASH"
log "バージョン:   $PKG_VERSION"
log "S3 パス:      s3://$S3_BUCKET/$S3_BUILD_PATH/"
log "最新パス:     s3://$S3_BUCKET/builds/latest/"
[ -n "$VERSION" ] && log "タグパス:     s3://$S3_BUCKET/builds/$VERSION/"

# クリーンアップ
rm -rf "$ARTIFACT_DIR"
