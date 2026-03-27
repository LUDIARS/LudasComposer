use serde::{Deserialize, Serialize};

use crate::config::InfisicalConfig;
use crate::error::SecretsError;

/// Low-level Infisical API client.
///
/// Handles Universal Auth login and secret retrieval.
#[derive(Clone)]
pub struct InfisicalClient {
    http: reqwest::Client,
    config: InfisicalConfig,
    access_token: tokio::sync::watch::Sender<Option<String>>,
    access_token_rx: tokio::sync::watch::Receiver<Option<String>>,
}

#[derive(Debug, Deserialize)]
struct AuthResponse {
    #[serde(rename = "accessToken")]
    access_token: String,
}

#[derive(Debug, Deserialize)]
struct SecretResponse {
    secret: SecretData,
}

#[derive(Debug, Deserialize)]
struct SecretsListResponse {
    secrets: Vec<SecretData>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SecretData {
    #[serde(rename = "secretKey")]
    pub key: String,
    #[serde(rename = "secretValue")]
    pub value: String,
}

impl InfisicalClient {
    pub fn new(config: InfisicalConfig) -> Self {
        let (tx, rx) = tokio::sync::watch::channel(None);
        Self {
            http: reqwest::Client::new(),
            config,
            access_token: tx,
            access_token_rx: rx,
        }
    }

    /// Authenticate with Infisical via Universal Auth (Machine Identity).
    pub async fn authenticate(&self) -> Result<(), SecretsError> {
        let url = format!(
            "{}/api/v1/auth/universal-auth/login",
            self.config.host.trim_end_matches('/')
        );

        let res = self
            .http
            .post(&url)
            .json(&serde_json::json!({
                "clientId": self.config.client_id,
                "clientSecret": self.config.client_secret,
            }))
            .send()
            .await?;

        if !res.status().is_success() {
            let status = res.status().as_u16();
            let body = res.text().await.unwrap_or_default();
            return Err(SecretsError::AuthFailed(format!(
                "status={status}, body={body}"
            )));
        }

        let auth: AuthResponse = res.json().await?;
        self.access_token.send_replace(Some(auth.access_token));
        Ok(())
    }

    /// Ensure we have a valid access token, re-authenticating if needed.
    async fn ensure_token(&self) -> Result<String, SecretsError> {
        {
            let token = self.access_token_rx.borrow();
            if let Some(ref t) = *token {
                return Ok(t.clone());
            }
        }
        self.authenticate().await?;
        let token = self.access_token_rx.borrow();
        token
            .clone()
            .ok_or_else(|| SecretsError::AuthFailed("No token after auth".to_string()))
    }

    /// Get a single secret by key from the specified path.
    pub async fn get_secret(
        &self,
        key: &str,
        secret_path: &str,
    ) -> Result<String, SecretsError> {
        let token = self.ensure_token().await?;
        let base = self.config.host.trim_end_matches('/');
        let url = format!(
            "{base}/api/v3/secrets/raw/{key}",
            base = base,
            key = urlencoding::encode(key),
        );

        let res = self
            .http
            .get(&url)
            .bearer_auth(&token)
            .query(&[
                ("workspaceId", self.config.project_id.as_str()),
                ("environment", self.config.environment.as_str()),
                ("secretPath", secret_path),
            ])
            .send()
            .await?;

        if res.status().as_u16() == 401 {
            // Token expired — re-auth and retry once
            self.authenticate().await?;
            return Box::pin(self.get_secret(key, secret_path)).await;
        }

        if res.status().as_u16() == 404 {
            return Err(SecretsError::SecretNotFound {
                key: key.to_string(),
                scope: secret_path.to_string(),
            });
        }

        if !res.status().is_success() {
            let status = res.status().as_u16();
            let body = res.text().await.unwrap_or_default();
            return Err(SecretsError::ApiError {
                status,
                message: body,
            });
        }

        let data: SecretResponse = res.json().await?;
        Ok(data.secret.value)
    }

    /// List all secrets at the specified path.
    pub async fn list_secrets(
        &self,
        secret_path: &str,
    ) -> Result<Vec<SecretData>, SecretsError> {
        let token = self.ensure_token().await?;
        let base = self.config.host.trim_end_matches('/');
        let url = format!("{base}/api/v3/secrets/raw");

        let res = self
            .http
            .get(&url)
            .bearer_auth(&token)
            .query(&[
                ("workspaceId", self.config.project_id.as_str()),
                ("environment", self.config.environment.as_str()),
                ("secretPath", secret_path),
            ])
            .send()
            .await?;

        if res.status().as_u16() == 401 {
            self.authenticate().await?;
            return Box::pin(self.list_secrets(secret_path)).await;
        }

        if !res.status().is_success() {
            let status = res.status().as_u16();
            let body = res.text().await.unwrap_or_default();
            return Err(SecretsError::ApiError {
                status,
                message: body,
            });
        }

        let data: SecretsListResponse = res.json().await?;
        Ok(data.secrets)
    }
}

/// URL-encoding helper (minimal, for path segments).
mod urlencoding {
    pub fn encode(s: &str) -> String {
        s.replace('%', "%25")
            .replace(' ', "%20")
            .replace('/', "%2F")
            .replace('?', "%3F")
            .replace('#', "%23")
            .replace('&', "%26")
            .replace('=', "%3D")
    }
}
