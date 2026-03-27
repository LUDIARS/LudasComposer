# =============================================================================
# Ars - 統合Webサーバー Dockerfile
#
# Stage 1: Frontend build (React + Vite)
# Stage 2: Backend build (Rust + Axum)
# Stage 3: Runtime
#
# 使用方法:
#   docker build -t ars .
# =============================================================================

# ----- Stage 1: Frontend build -----
FROM node:20-slim AS frontend-builder

WORKDIR /app

COPY ars-editor/package.json ars-editor/package-lock.json* ./
RUN npm ci

COPY ars-editor/ .
RUN npm run build

# ----- Stage 2: Rust web server build -----
FROM rust:1-bookworm AS server-builder

# SurrealDB (RocksDB) と AWS SDK (aws-lc-sys) のビルドに必要なシステムライブラリ
RUN apt-get update && apt-get install -y --no-install-recommends \
    clang \
    libclang-dev \
    cmake \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ワークスペースルートのCargo.tomlをコピー（workspace.dependenciesの解決に必要）
COPY Cargo.toml ./

# コアクレートをコピー
COPY crates/ crates/

# メインクレートの依存キャッシュ
COPY ars-editor/src-tauri/Cargo.toml ars-editor/src-tauri/Cargo.lock* ars-editor/src-tauri/
RUN mkdir -p ars-editor/src-tauri/src/commands ars-editor/src-tauri/src/models ars-editor/src-tauri/src/web_modules && \
    echo "pub fn dummy() {}" > ars-editor/src-tauri/src/lib.rs && \
    echo "fn main() {}" > ars-editor/src-tauri/src/web_main.rs && \
    cargo build --manifest-path ars-editor/src-tauri/Cargo.toml --features web-server --no-default-features --bin ars-web-server --release 2>/dev/null || true && \
    rm -rf ars-editor/src-tauri/src

# ソースコードをコピーしてビルド
COPY ars-editor/src-tauri/ ars-editor/src-tauri/
RUN cargo build --manifest-path ars-editor/src-tauri/Cargo.toml --features web-server --no-default-features --bin ars-web-server --release

# ----- Stage 3: Runtime -----
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -r -s /bin/false ars

WORKDIR /app

COPY --from=server-builder /app/target/release/ars-web-server ./ars-web-server
COPY --from=frontend-builder /app/dist ./dist

# SurrealDB データディレクトリ（グラフDB: ユーザー・プロジェクト）
RUN mkdir -p /app/data/surrealdb && chown -R ars:ars /app
USER ars

EXPOSE 5173

VOLUME ["/app/data"]

# secrets.toml はボリュームマウントで /app/ に配置される
# ポートはCLI引数で指定（デフォルト: 5173）
CMD ["./ars-web-server", "./dist", "5173"]
