use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    // リッスンアドレス解決: ARS_LISTEN_ADDR > ARS_HOST+ARS_PORT > CLI引数 > デフォルト
    let addr = resolve_listen_addr();

    let static_dir = std::env::args().nth(1);

    if let Err(e) = app_lib::web_server::serve(addr, static_dir).await {
        eprintln!("Server error: {}", e);
        std::process::exit(1);
    }
}

fn resolve_listen_addr() -> SocketAddr {
    // 1. ARS_LISTEN_ADDR (e.g. "0.0.0.0:5173")
    if let Ok(val) = std::env::var("ARS_LISTEN_ADDR") {
        return val.parse().unwrap_or_else(|e| {
            eprintln!("Invalid ARS_LISTEN_ADDR '{}': {}", val, e);
            std::process::exit(1);
        });
    }

    // 2. ARS_HOST + ARS_PORT (個別指定)
    let host = std::env::var("ARS_HOST").ok();
    let port_env = std::env::var("ARS_PORT").ok();

    if host.is_some() || port_env.is_some() {
        let h = host.as_deref().unwrap_or("0.0.0.0");
        let p = port_env.as_deref().unwrap_or("5173");
        let combined = format!("{}:{}", h, p);
        return combined.parse().unwrap_or_else(|e| {
            eprintln!("Invalid ARS_HOST/ARS_PORT '{}': {}", combined, e);
            std::process::exit(1);
        });
    }

    // 3. CLI引数 (後方互換: ars-web-server <static_dir> <port>)
    let port: u16 = std::env::args()
        .nth(2)
        .and_then(|p| p.parse().ok())
        .unwrap_or(5173);

    SocketAddr::from(([0, 0, 0, 0], port))
}
