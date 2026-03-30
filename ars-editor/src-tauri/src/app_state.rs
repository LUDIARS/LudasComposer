use crate::cernere_client::CernereClient;

#[derive(Clone)]
pub struct AppState {
    pub cernere: CernereClient,
}

impl AppState {
    /// Initialize with Cernere server URL.
    ///
    /// The URL is read from `CERNERE_URL` env var, defaulting to `http://localhost:8080`.
    pub fn new() -> Self {
        let cernere_url = std::env::var("CERNERE_URL")
            .unwrap_or_else(|_| "http://localhost:8080".to_string());
        Self {
            cernere: CernereClient::new(&cernere_url),
        }
    }
}
