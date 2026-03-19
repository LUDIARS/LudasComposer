# =============================================================================
# data-organizer Dockerfile
# Multi-stage build: Rust build → minimal runtime
#
# 現在はライブラリクレートのみ。
# Web サーバー (API) が追加された際に CMD を更新してください。
# =============================================================================

FROM rust:1-bookworm AS builder

WORKDIR /app

# 依存クレートのキャッシュ用に Cargo ファイルだけ先にコピー
COPY Cargo.toml Cargo.lock* ./
RUN mkdir -p src && \
    echo "pub fn dummy() {}" > src/lib.rs && \
    cargo build --release 2>/dev/null || true && \
    rm -rf src

# ソースコードをコピーしてビルド
COPY . .
RUN cargo build --release

# ----- Runtime -----
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -r -s /bin/false ars

WORKDIR /app

# ライブラリクレートのため、バイナリが追加された際にここを更新
# COPY --from=builder /app/target/release/data-organizer ./data-organizer

RUN chown -R ars:ars /app
USER ars

ENV PORT=5175
EXPOSE 5175

# バイナリが追加された際にここを更新
CMD ["echo", "data-organizer: Web server not yet implemented"]
