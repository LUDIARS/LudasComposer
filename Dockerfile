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

WORKDIR /app

# メインクレートの依存キャッシュ
WORKDIR /app/ars-editor/src-tauri
COPY ars-editor/src-tauri/Cargo.toml ars-editor/src-tauri/Cargo.lock* ./
RUN mkdir -p src/commands src/models src/web_modules && \
    echo "pub fn dummy() {}" > src/lib.rs && \
    echo "fn main() {}" > src/web_main.rs && \
    cargo build --features web-server --no-default-features --bin ars-web-server --release 2>/dev/null || true && \
    rm -rf src

# ソースコードをコピーしてビルド
COPY ars-editor/src-tauri/ .
RUN cargo build --features web-server --no-default-features --bin ars-web-server --release

# ----- Stage 3: Runtime -----
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -r -s /bin/false ars

WORKDIR /app

COPY --from=server-builder /app/ars-editor/src-tauri/target/release/ars-web-server ./ars-web-server
COPY --from=frontend-builder /app/dist ./dist

RUN chown -R ars:ars /app
USER ars

ENV PORT=5173
EXPOSE 5173

CMD ["./ars-web-server", "./dist"]
