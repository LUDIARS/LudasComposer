#[tokio::main]
async fn main() {
    let static_dir = std::env::args().nth(1);

    // PORT is the only value still read from CLI args or a simple default.
    // All secrets/config are fetched from Infisical at runtime (not at startup via env vars).
    let port: u16 = std::env::args()
        .nth(2)
        .and_then(|p| p.parse().ok())
        .unwrap_or(5173);

    if let Err(e) = app_lib::web_server::serve(port, static_dir).await {
        eprintln!("Server error: {}", e);
        std::process::exit(1);
    }
}
