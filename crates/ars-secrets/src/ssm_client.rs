use aws_sdk_ssm::Client as SsmClient;

use crate::config::AwsSsmConfig;
use crate::error::SecretsError;

/// AWS SSM Parameter Store client.
///
/// Credentials are loaded from the standard AWS credential chain:
///   - `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`
///   - `AWS_REGION` or `AWS_DEFAULT_REGION`
///   - IAM role / `~/.aws/credentials`
#[derive(Clone)]
pub struct AwsSsmClient {
    client: SsmClient,
    config: AwsSsmConfig,
}

impl AwsSsmClient {
    /// Create a new SSM client from config.
    /// Validates connectivity by calling DescribeParameters (lightweight check).
    pub async fn new(config: AwsSsmConfig) -> Result<Self, SecretsError> {
        let mut aws_config_loader = aws_config::from_env();

        // If a region is explicitly specified in config, use it.
        if let Some(ref region) = config.region {
            aws_config_loader = aws_config_loader.region(
                aws_sdk_ssm::config::Region::new(region.clone()),
            );
        }

        let aws_config = aws_config_loader.load().await;
        let client = SsmClient::new(&aws_config);

        Ok(Self { client, config })
    }

    /// Validate that credentials work by making a lightweight API call.
    pub async fn validate(&self) -> Result<(), SecretsError> {
        // Try to get a parameter that likely doesn't exist — we just want to
        // verify that credentials and region are valid (no AccessDeniedException).
        let prefix = self.config.path_prefix.trim_end_matches('/');
        let test_path = format!("{}/shared", prefix);

        self.client
            .get_parameters_by_path()
            .path(&test_path)
            .max_results(1)
            .send()
            .await
            .map_err(|e| SecretsError::AwsSsm(format!("Credential validation failed: {e}")))?;

        Ok(())
    }

    /// Build the full SSM parameter name from path components.
    fn param_name(&self, key: &str, path: &str) -> String {
        let prefix = self.config.path_prefix.trim_end_matches('/');
        let path = path.trim_matches('/');
        format!("{prefix}/{path}/{key}")
    }

    /// Get a single secret by key from the specified scope path.
    pub async fn get_secret(
        &self,
        key: &str,
        secret_path: &str,
    ) -> Result<String, SecretsError> {
        let name = self.param_name(key, secret_path);

        let result = self
            .client
            .get_parameter()
            .name(&name)
            .with_decryption(true)
            .send()
            .await
            .map_err(|e| {
                let msg = e.to_string();
                if msg.contains("ParameterNotFound") {
                    return SecretsError::SecretNotFound {
                        key: key.to_string(),
                        scope: secret_path.to_string(),
                    };
                }
                SecretsError::AwsSsm(msg)
            })?;

        let value = result
            .parameter()
            .and_then(|p| p.value())
            .ok_or_else(|| SecretsError::SecretNotFound {
                key: key.to_string(),
                scope: secret_path.to_string(),
            })?;

        Ok(value.to_string())
    }

    /// Resolve the SSM path for a scope.
    pub fn secret_path(&self, scope: &crate::SecretScope) -> String {
        match scope {
            crate::SecretScope::Shared => self.config.shared_path.clone(),
            crate::SecretScope::Personal(user_id) => {
                format!("{}/{}", self.config.personal_path_prefix, user_id)
            }
        }
    }
}
