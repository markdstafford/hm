use crate::ai::config::{load_ai_provider_config, AiCredentialConfig, AiEndpointConfig, AiProfileConfig, AiProviderConfig};
use crate::ai::credentials::{load_credential_secret, LoadedCredentialSecret};
use crate::ai::errors::AiError;
use crate::settings::secrets::SecretStore;

#[derive(Debug)]
pub struct ResolvedAiProvider {
    pub profile: AiProfileConfig,
    pub endpoint: AiEndpointConfig,
    pub credential: AiCredentialConfig,
    pub secret: LoadedCredentialSecret,
}

pub fn resolve_for_task(
    conn: &rusqlite::Connection,
    store: &dyn SecretStore,
    task_name: &str,
) -> Result<ResolvedAiProvider, AiError> {
    let config = load_ai_provider_config(conn)?;
    let profile_name = config
        .routing
        .get(task_name)
        .cloned()
        .ok_or_else(|| AiError::MissingRoute { task_name: task_name.into() })?;
    resolve_loaded(config, store, &profile_name)
}

pub fn resolve_for_profile(
    conn: &rusqlite::Connection,
    store: &dyn SecretStore,
    profile_name: &str,
) -> Result<ResolvedAiProvider, AiError> {
    resolve_for_profile_from_config(load_ai_provider_config(conn)?, store, profile_name)
}

/// Resolve a profile without touching the database. Use this when the config has already been
/// loaded and the DB lock has been released (e.g. in the smoke-test command path).
pub fn resolve_for_profile_from_config(
    config: AiProviderConfig,
    store: &dyn SecretStore,
    profile_name: &str,
) -> Result<ResolvedAiProvider, AiError> {
    resolve_loaded(config, store, profile_name)
}

fn resolve_loaded(
    config: AiProviderConfig,
    store: &dyn SecretStore,
    profile_name: &str,
) -> Result<ResolvedAiProvider, AiError> {
    let profile = config
        .profiles
        .iter()
        .find(|p| p.name == profile_name)
        .cloned()
        .ok_or_else(|| AiError::MissingProfile { profile_name: profile_name.into() })?;
    let endpoint = config
        .endpoints
        .iter()
        .find(|e| e.name == profile.endpoint_ref)
        .cloned()
        .ok_or_else(|| AiError::MissingEndpoint { endpoint_name: profile.endpoint_ref.clone() })?;
    let credential = config
        .credentials
        .iter()
        .find(|c| c.name == endpoint.credential_ref)
        .cloned()
        .ok_or_else(|| AiError::MissingCredential { credential_name: endpoint.credential_ref.clone() })?;
    // Note: SQLite lock is NOT held at this point — load_ai_provider_config holds it internally
    // and releases before returning. Secret loading happens outside any lock.
    let secret = load_credential_secret(&credential, store)?;
    Ok(ResolvedAiProvider { profile, endpoint, credential, secret })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::config::{
        save_ai_provider_config, AiCredentialConfig, AiCredentialKind, AiEndpointConfig,
        AiEndpointProtocol, AiExecutionMode, AiProfileConfig, AiProviderConfig, AiRunner,
        CredentialSource,
    };
    use crate::commands::JsonValue;
    use crate::settings::secrets::InMemorySecretStore;
    use std::collections::BTreeMap;

    fn openai_config() -> AiProviderConfig {
        AiProviderConfig {
            version: 1,
            credentials: vec![AiCredentialConfig {
                name: "openai-prod".into(),
                kind: AiCredentialKind::BearerToken,
                source: CredentialSource::Keychain {
                    key_ref: "ai.credentials.openai-prod".into(),
                },
            }],
            endpoints: vec![AiEndpointConfig {
                name: "gateway".into(),
                protocol: AiEndpointProtocol::OpenAiChatCompletionsCompatible,
                base_url: "https://api.openai.com/v1".into(),
                credential_ref: "openai-prod".into(),
            }],
            profiles: vec![AiProfileConfig {
                name: "chat-fast".into(),
                endpoint_ref: "gateway".into(),
                model: "gpt-4o-mini".into(),
                runner: AiRunner::OpenAiChatCompletions,
                execution_mode: AiExecutionMode::DirectApi,
                settings: JsonValue(serde_json::json!({})),
            }],
            routing: BTreeMap::from([("chat.answer".into(), "chat-fast".into())]),
        }
    }

    #[test]
    fn resolve_task_returns_full_chain() {
        let conn = crate::db::open_in_memory().unwrap();
        let store = InMemorySecretStore::new();
        store.set("ai.credentials.openai-prod", "sk-test-secret").unwrap();
        save_ai_provider_config(&conn, &openai_config()).unwrap();
        let resolved = resolve_for_task(&conn, &store, "chat.answer").unwrap();
        assert_eq!(resolved.profile.name, "chat-fast");
        assert_eq!(resolved.endpoint.name, "gateway");
        assert_eq!(resolved.credential.name, "openai-prod");
        assert_eq!(resolved.secret.value.expose_for_runner(), "sk-test-secret");
        assert!(!format!("{resolved:?}").contains("sk-test-secret"));
    }

    #[test]
    fn resolve_reads_latest_config_at_call_time() {
        let conn = crate::db::open_in_memory().unwrap();
        let store = InMemorySecretStore::new();
        store.set("ai.credentials.openai-prod", "sk-test-secret").unwrap();
        save_ai_provider_config(&conn, &openai_config()).unwrap();
        let r1 = resolve_for_task(&conn, &store, "chat.answer").unwrap();
        assert_eq!(r1.profile.model, "gpt-4o-mini");

        // Update config with new model
        let mut updated = openai_config();
        updated.profiles[0].model = "gpt-4o".into();
        save_ai_provider_config(&conn, &updated).unwrap();

        let r2 = resolve_for_task(&conn, &store, "chat.answer").unwrap();
        assert_eq!(r2.profile.model, "gpt-4o");
    }

    #[test]
    fn missing_route_returns_safe_error() {
        let conn = crate::db::open_in_memory().unwrap();
        let store = InMemorySecretStore::new();
        save_ai_provider_config(&conn, &openai_config()).unwrap();
        let err = resolve_for_task(&conn, &store, "issue.triage").unwrap_err();
        assert!(err.to_string().contains("No AI profile is routed for issue.triage"));
    }

    #[test]
    fn resolve_for_profile_works_without_routing() {
        let conn = crate::db::open_in_memory().unwrap();
        let store = InMemorySecretStore::new();
        store.set("ai.credentials.openai-prod", "sk-test-secret").unwrap();
        // Config with no routing
        let mut config = openai_config();
        config.routing.clear();
        save_ai_provider_config(&conn, &config).unwrap();
        let resolved = resolve_for_profile(&conn, &store, "chat-fast").unwrap();
        assert_eq!(resolved.profile.name, "chat-fast");
    }

    #[test]
    fn missing_profile_returns_distinct_error() {
        let conn = crate::db::open_in_memory().unwrap();
        let store = InMemorySecretStore::new();
        save_ai_provider_config(&conn, &openai_config()).unwrap();
        let err = resolve_for_profile(&conn, &store, "nonexistent").unwrap_err();
        assert!(err.to_string().contains("AI profile not found: nonexistent"));
    }

    #[test]
    fn missing_secret_returns_safe_error() {
        let conn = crate::db::open_in_memory().unwrap();
        let store = InMemorySecretStore::new(); // no secret set
        save_ai_provider_config(&conn, &openai_config()).unwrap();
        let err = resolve_for_task(&conn, &store, "chat.answer").unwrap_err();
        // Should be MissingSecret, not a panic
        assert!(matches!(err, AiError::MissingSecret { .. }));
    }
}
