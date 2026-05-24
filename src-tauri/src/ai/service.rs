use crate::ai::config::{AiExecutionMode, AiRunner};
use crate::ai::errors::AiError;
use crate::ai::resolver::resolve_for_task;
use crate::ai::runners::AiRunnerClient;
use crate::settings::secrets::SecretStore;
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub enum AiMessageRole {
    System,
    User,
    Assistant,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct AiMessage {
    pub role: AiMessageRole,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct AiRequest {
    pub system: Option<String>,
    pub messages: Vec<AiMessage>,
    pub max_output_tokens: Option<u32>,
    pub temperature: Option<f32>,
}

impl AiRequest {
    pub fn smoke_test() -> Self {
        Self {
            system: Some("You are a smoke test responder.".into()),
            messages: vec![AiMessage {
                role: AiMessageRole::User,
                content: "reply with ok".into(),
            }],
            max_output_tokens: Some(16),
            temperature: Some(0.0),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct AiUsage {
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct AiResponse {
    pub text: String,
    pub model: String,
    pub profile: String,
    pub runner: AiRunner,
    pub execution_mode: AiExecutionMode,
    pub usage: Option<AiUsage>,
}

pub fn ai_call_with_runner(
    conn: &rusqlite::Connection,
    store: &dyn SecretStore,
    runner: &dyn AiRunnerClient,
    task_name: &str,
    request: AiRequest,
) -> Result<AiResponse, AiError> {
    let resolved = resolve_for_task(conn, store, task_name)?;
    runner.run(&resolved, request)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::config::{
        save_ai_provider_config, AiCredentialConfig, AiCredentialKind, AiEndpointConfig,
        AiEndpointProtocol, AiExecutionMode, AiProfileConfig, AiProviderConfig, AiRunner,
        CredentialSource,
    };
    use crate::ai::runners::FakeRunner;
    use crate::commands::JsonValue;
    use crate::settings::secrets::InMemorySecretStore;
    use std::collections::BTreeMap;

    fn test_config() -> AiProviderConfig {
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
    fn ai_call_with_fake_runner_returns_response() {
        let conn = crate::db::open_in_memory().unwrap();
        let store = InMemorySecretStore::new();
        store.set("ai.credentials.openai-prod", "sk-test-secret").unwrap();
        save_ai_provider_config(&conn, &test_config()).unwrap();
        let runner = FakeRunner::new("ok");
        let response = ai_call_with_runner(
            &conn, &store, &runner, "chat.answer", AiRequest::smoke_test()
        ).unwrap();
        assert_eq!(response.text, "ok");
        assert_eq!(response.model, "gpt-4o-mini");
        assert_eq!(response.profile, "chat-fast");
        assert_eq!(response.runner, AiRunner::OpenAiChatCompletions);
        assert_eq!(response.execution_mode, AiExecutionMode::DirectApi);
        assert!(response.usage.is_none());
    }

    #[test]
    fn ai_call_missing_route_returns_safe_error() {
        let conn = crate::db::open_in_memory().unwrap();
        let store = InMemorySecretStore::new();
        save_ai_provider_config(&conn, &test_config()).unwrap();
        let runner = FakeRunner::new("ok");
        let err = ai_call_with_runner(
            &conn, &store, &runner, "unknown.task", AiRequest::smoke_test()
        ).unwrap_err();
        assert!(err.to_string().contains("No AI profile is routed for unknown.task"));
    }
}
