use terpsichore_lib::models::config::TerpsichoreConfig;
use terpsichore_lib::services::command_server::CommandServer;

#[tokio::main]
async fn main() {
    let config = TerpsichoreConfig::load();
    println!("Starting Terpsichore command server...");
    let server = CommandServer::new(config);
    if let Err(e) = server.start().await {
        eprintln!("Server error: {}", e);
        std::process::exit(1);
    }
}
