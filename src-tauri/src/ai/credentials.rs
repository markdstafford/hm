use crate::ai::config::{AiCredentialConfig, CredentialSource};
use crate::ai::errors::AiError;
use crate::settings::{keys, secrets::SecretStore};

pub struct SecretValue(String);

impl std::fmt::Debug for SecretValue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("SecretValue([redacted])")
    }
}

impl SecretValue {
    pub fn expose_for_runner(&self) -> &str {
        &self.0
    }
}

#[derive(Debug)]
pub struct LoadedCredentialSecret {
    pub credential_name: String,
    pub value: SecretValue,
}

pub fn credential_keychain_key(credential_name: &str) -> Result<String, AiError> {
    // Validate the credential name using keys::validate_key
    keys::validate_key(credential_name).map_err(|e| AiError::InvalidConfig(e.to_string()))?;
    Ok(format!("ai.credentials.{credential_name}"))
}

pub fn set_keychain_credential_secret(
    credential_name: &str,
    value: &str,
    store: &dyn SecretStore,
) -> Result<(), AiError> {
    store.set(&credential_keychain_key(credential_name)?, value)
        .map_err(|e| AiError::Storage(e.to_string()))
}

pub fn delete_keychain_credential_secret(
    credential_name: &str,
    store: &dyn SecretStore,
) -> Result<(), AiError> {
    store.delete(&credential_keychain_key(credential_name)?)
        .map_err(|e| AiError::Storage(e.to_string()))
}

pub fn load_credential_secret(
    credential: &AiCredentialConfig,
    store: &dyn SecretStore,
) -> Result<LoadedCredentialSecret, AiError> {
    let value = match &credential.source {
        CredentialSource::Keychain { key_ref } => {
            store.get(key_ref)
                .map_err(|e| AiError::Storage(e.to_string()))?
                .ok_or_else(|| AiError::MissingSecret {
                    credential_name: credential.name.clone(),
                    source: "keychain",
                })?
        }
        CredentialSource::Env { var_name } => {
            std::env::var(var_name)
                .ok()
                .filter(|v| !v.is_empty())
                .ok_or_else(|| AiError::MissingSecret {
                    credential_name: credential.name.clone(),
                    source: "env",
                })?
        }
    };
    Ok(LoadedCredentialSecret {
        credential_name: credential.name.clone(),
        value: SecretValue(value),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::config::{AiCredentialConfig, AiCredentialKind, CredentialSource};
    use crate::settings::secrets::InMemorySecretStore;

    #[test]
    fn keychain_key_is_deterministic() {
        assert_eq!(
            credential_keychain_key("anthropic-prod").unwrap(),
            "ai.credentials.anthropic-prod"
        );
        assert!(credential_keychain_key("bad name").is_err());
    }

    #[test]
    fn keychain_secret_loads_but_debug_redacts() {
        let store = InMemorySecretStore::new();
        store.set("ai.credentials.anthropic-prod", "sk-test-secret").unwrap();
        let credential = AiCredentialConfig {
            name: "anthropic-prod".into(),
            kind: AiCredentialKind::ApiKey,
            source: CredentialSource::Keychain {
                key_ref: "ai.credentials.anthropic-prod".into(),
            },
        };
        let loaded = load_credential_secret(&credential, &store).unwrap();
        assert_eq!(loaded.value.expose_for_runner(), "sk-test-secret");
        assert!(!format!("{loaded:?}").contains("sk-test-secret"));
    }

    #[test]
    fn env_secret_reads_at_call_time() {
        std::env::set_var("HM_TEST_AI_SECRET", "first-secret");
        let store = InMemorySecretStore::new();
        let credential = AiCredentialConfig {
            name: "gateway-env".into(),
            kind: AiCredentialKind::BearerToken,
            source: CredentialSource::Env {
                var_name: "HM_TEST_AI_SECRET".into(),
            },
        };
        assert_eq!(
            load_credential_secret(&credential, &store)
                .unwrap()
                .value
                .expose_for_runner(),
            "first-secret"
        );
        std::env::set_var("HM_TEST_AI_SECRET", "second-secret");
        assert_eq!(
            load_credential_secret(&credential, &store)
                .unwrap()
                .value
                .expose_for_runner(),
            "second-secret"
        );
        std::env::remove_var("HM_TEST_AI_SECRET");
    }

    #[test]
    fn missing_keychain_secret_error_is_safe() {
        let store = InMemorySecretStore::new();
        let credential = AiCredentialConfig {
            name: "anthropic-prod".into(),
            kind: AiCredentialKind::ApiKey,
            source: CredentialSource::Keychain {
                key_ref: "ai.credentials.anthropic-prod".into(),
            },
        };
        let err = load_credential_secret(&credential, &store).unwrap_err();
        assert!(err.to_string().contains("keychain"));
        assert!(!err.to_string().contains("sk-test-secret"));
    }

    #[test]
    fn missing_env_secret_error_is_distinct() {
        std::env::remove_var("HM_TEST_MISSING_VAR");
        let store = InMemorySecretStore::new();
        let credential = AiCredentialConfig {
            name: "gateway-env".into(),
            kind: AiCredentialKind::BearerToken,
            source: CredentialSource::Env {
                var_name: "HM_TEST_MISSING_VAR".into(),
            },
        };
        let err = load_credential_secret(&credential, &store).unwrap_err();
        assert!(err.to_string().contains("env"));
    }

    #[test]
    fn set_delete_secret_use_deterministic_key() {
        let store = InMemorySecretStore::new();
        set_keychain_credential_secret("openai-prod", "sk-test-secret", &store).unwrap();
        assert_eq!(
            store.get("ai.credentials.openai-prod").unwrap(),
            Some("sk-test-secret".into())
        );
        delete_keychain_credential_secret("openai-prod", &store).unwrap();
        assert_eq!(store.get("ai.credentials.openai-prod").unwrap(), None);
    }
}
