#[cfg(feature = "web-server")]
#[tokio::main]
async fn main() {
    use thaleia_lib::web_server;
    web_server::start().await;
}

#[cfg(not(feature = "web-server"))]
fn main() {
    eprintln!("Web server feature not enabled. Build with --features web-server");
}
