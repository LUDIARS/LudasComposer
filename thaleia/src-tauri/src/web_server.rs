#[cfg(feature = "web-server")]
pub async fn start() {
    use axum::{routing::get, Router};
    use tower_http::cors::CorsLayer;

    let app = Router::new()
        .route("/api/health", get(|| async { "Thaleia OK" }))
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8688")
        .await
        .expect("Failed to bind Thaleia web server");

    println!("Thaleia web server running on http://127.0.0.1:8688");
    axum::serve(listener, app)
        .await
        .expect("Thaleia web server error");
}
