# =============================================================================
# resource-depot Dockerfile
# Multi-stage build: Rust build → minimal runtime
#
# 現在は Tauri デスクトップアプリのみ。
# Web サーバーモードが追加された際に CMD を更新してください。
# =============================================================================

FROM rust:1-bookworm AS builder

WORKDIR /app/src-tauri

# 依存クレートのキャッシュ用に Cargo ファイルだけ先にコピー
COPY src-tauri/Cargo.toml src-tauri/Cargo.lock* ./
RUN mkdir -p src/commands src/models src/services && \
    echo "pub fn dummy() {}" > src/lib.rs && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release 2>/dev/null || true && \
    rm -rf src

# ソースコードをコピーしてビルド
COPY src-tauri/ .
RUN cargo build --release

# ----- Runtime -----
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -r -s /bin/false ars

WORKDIR /app

COPY --from=builder /app/src-tauri/target/release/resource-depot ./resource-depot

RUN chown -R ars:ars /app
USER ars

ENV PORT=5174
EXPOSE 5174

CMD ["./resource-depot"]
