#[cfg(feature = "web-server")]
pub async fn start() {
    use axum::{routing::get, Router};
    use tower_http::cors::CorsLayer;

    let app = Router::new()
        .route("/api/health", get(|| async { "Melpomene OK" }))
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8687")
        .await
        .expect("Failed to bind Melpomene web server");

    println!("Melpomene web server running on http://127.0.0.1:8687");
    axum::serve(listener, app)
        .await
        .expect("Melpomene web server error");
}
