# =============================================================================
# ars-editor Dockerfile
# Multi-stage build: Node (frontend) + Rust (web server) → minimal runtime
# =============================================================================

# ----- Stage 1: Frontend build -----
FROM node:20-slim AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ----- Stage 2: Rust web server build -----
FROM rust:1-bookworm AS server-builder

WORKDIR /app/src-tauri

# 依存クレートのキャッシュ用に Cargo ファイルだけ先にコピー
COPY src-tauri/Cargo.toml src-tauri/Cargo.lock* ./
RUN mkdir -p src && echo "fn main() {}" > src/web_main.rs && \
    mkdir -p src/commands src/models && \
    echo "pub fn dummy() {}" > src/lib.rs && \
    cargo build --features web-server --no-default-features --bin ars-web-server --release 2>/dev/null || true && \
    rm -rf src

# ソースコードをコピーしてビルド
COPY src-tauri/ .
RUN cargo build --features web-server --no-default-features --bin ars-web-server --release

# ----- Stage 3: Runtime -----
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -r -s /bin/false ars

WORKDIR /app

COPY --from=server-builder /app/src-tauri/target/release/ars-web-server ./ars-web-server
COPY --from=frontend-builder /app/dist ./dist

RUN chown -R ars:ars /app
USER ars

ENV PORT=5173
EXPOSE 5173

CMD ["./ars-web-server", "./dist"]
