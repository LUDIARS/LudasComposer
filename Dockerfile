# Build stage: Frontend
FROM node:22-alpine AS frontend-builder

WORKDIR /app/ars-editor
COPY ars-editor/package.json ars-editor/package-lock.json ./
RUN npm ci

COPY ars-editor/ ./
RUN npx vite build --base ./

# Build stage: Rust web server
FROM rust:1.87-bookworm AS backend-builder

WORKDIR /app/ars-editor/src-tauri

COPY ars-editor/src-tauri/Cargo.toml ars-editor/src-tauri/Cargo.lock* ./

# Create dummy source to cache dependencies
RUN mkdir -p src && \
    echo 'pub mod commands; pub mod models; #[cfg(feature = "web-server")] pub mod app_state; #[cfg(feature = "web-server")] pub mod auth; #[cfg(feature = "web-server")] pub mod dynamo; #[cfg(feature = "web-server")] pub mod web_server;' > src/lib.rs && \
    mkdir -p src/commands src/models && \
    echo 'pub mod project;' > src/commands/mod.rs && \
    echo 'pub mod project;' > src/models/mod.rs && \
    touch src/commands/project.rs src/models/project.rs && \
    echo 'fn main() {}' > src/web_main.rs && \
    cargo build --release --features web-server --no-default-features --bin ars-web-server 2>/dev/null || true

# Copy actual source and build
COPY ars-editor/src-tauri/ ./
RUN cargo build --release --features web-server --no-default-features --bin ars-web-server

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN useradd -r -s /bin/false appuser
USER appuser

COPY --from=backend-builder /app/ars-editor/src-tauri/target/release/ars-web-server /usr/local/bin/
COPY --from=frontend-builder /app/ars-editor/dist /srv/www

ENV PORT=8080
EXPOSE 8080

CMD ["ars-web-server", "/srv/www"]
