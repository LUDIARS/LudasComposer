#!/bin/bash
# =============================================================================
# setup-build-instance.sh
# ビルドインスタンスの初期セットアップスクリプト
#
# 使用方法:
#   EC2 インスタンスに SSH して実行:
#   curl -sSL <this-script-url> | bash
#   または:
#   scp setup-build-instance.sh ubuntu@<ip>:~ && ssh ubuntu@<ip> bash setup-build-instance.sh
# =============================================================================
set -euo pipefail

LOG_PREFIX="[ars-build-setup]"
log() { echo "$LOG_PREFIX $(date '+%Y-%m-%d %H:%M:%S') $*"; }

# ----- 設定 -----
REPO_URL="https://github.com/LUDIARS/Ars.git"
WORK_DIR="$HOME/Ars"
NODE_VERSION="20"

# =============================================================================
# 1. システムパッケージ
# =============================================================================
log "システムパッケージを更新・インストール中..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  build-essential \
  curl \
  wget \
  git \
  unzip \
  jq \
  libssl-dev \
  pkg-config

# SSM Agent のインストール (SSM 経由でコマンド実行するため)
if ! command -v amazon-ssm-agent &> /dev/null; then
  log "SSM Agent をインストール中..."
  sudo snap install amazon-ssm-agent --classic || true
fi

# AWS CLI v2 のインストール
if ! command -v aws &> /dev/null; then
  log "AWS CLI v2 をインストール中..."
  cd /tmp
  curl -sSL "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
  unzip -qo awscliv2.zip
  sudo ./aws/install
  rm -rf aws awscliv2.zip
  cd ~
fi

# =============================================================================
# 2. Node.js (nvm)
# =============================================================================
if ! command -v node &> /dev/null; then
  log "Node.js $NODE_VERSION をインストール中..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

  export NVM_DIR="$HOME/.nvm"
  # shellcheck source=/dev/null
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

  nvm install "$NODE_VERSION"
  nvm alias default "$NODE_VERSION"
else
  log "Node.js は既にインストール済み: $(node --version)"
fi

# nvm を読み込み (以降のステップで使えるように)
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# =============================================================================
# 3. Rust
# =============================================================================
if ! command -v rustc &> /dev/null; then
  log "Rust をインストール中..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env"
else
  log "Rust は既にインストール済み: $(rustc --version)"
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env"
fi

# =============================================================================
# 4. リポジトリのクローン
# =============================================================================
if [ ! -d "$WORK_DIR" ]; then
  log "リポジトリをクローン中..."
  git clone "$REPO_URL" "$WORK_DIR"
else
  log "リポジトリは既に存在: $WORK_DIR"
fi

# =============================================================================
# 5. 初回依存関係のインストール
# =============================================================================
log "npm 依存パッケージをインストール中..."
cd "$WORK_DIR/ars-editor"
npm ci

log "Rust 依存パッケージを事前ダウンロード中..."
cd "$WORK_DIR/ars-editor/src-tauri"
cargo fetch

# =============================================================================
# 6. ビルドスクリプトの配置
# =============================================================================
log "ビルドスクリプトを配置中..."
chmod +x "$WORK_DIR/infra/build-instance/build.sh" 2>/dev/null || true

# =============================================================================
# 7. 確認
# =============================================================================
log "=== セットアップ完了 ==="
log "Node.js: $(node --version)"
log "npm:     $(npm --version)"
log "Rust:    $(rustc --version)"
log "Cargo:   $(cargo --version)"
log "AWS CLI: $(aws --version)"
log "リポジトリ: $WORK_DIR"
log ""
log "次のステップ:"
log "  1. IAM ロール (ars-build-instance-role) をインスタンスにアタッチ"
log "  2. S3 バケット (ars-build-artifacts) を作成"
log "  3. ビルドテスト: $WORK_DIR/infra/build-instance/build.sh"
