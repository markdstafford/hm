use crate::ai::config::{AiExecutionMode, AiProviderConfig, AiRunner};
use crate::ai::errors::AiError;
use crate::ai::resolver::{resolve_for_profile, resolve_for_profile_from_config, resolve_for_task};
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub enum SmokeTestStatus { NotRun, Running, Success, Error }

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct SmokeTestResult {
    pub status: SmokeTestStatus,
    pub profile: String,
    pub runner: AiRunner,
    pub execution_mode: AiExecutionMode,
    pub model: String,
    pub elapsed_ms: u32,
    pub preview: Option<String>,
    pub error: Option<String>,
    pub suggested_fix: Option<String>,
}

pub fn ai_call(
    conn: &rusqlite::Connection,
    store: &dyn SecretStore,
    task_name: &str,
    request: AiRequest,
) -> Result<AiResponse, AiError> {
    let runner = crate::ai::runners::DirectApiRunner;
    ai_call_with_runner(conn, store, &runner, task_name, request)
}

pub fn smoke_test_profile(
    conn: &rusqlite::Connection,
    store: &dyn SecretStore,
    profile_name: &str,
) -> SmokeTestResult {
    use crate::ai::config::load_ai_provider_config;
    let config = match load_ai_provider_config(conn) {
        Ok(c) => c,
        Err(e) => {
            return SmokeTestResult {
                status: SmokeTestStatus::Error,
                profile: profile_name.into(),
                runner: AiRunner::OpenAiChatCompletions,
                execution_mode: AiExecutionMode::DirectApi,
                model: "".into(),
                elapsed_ms: 0,
                preview: None,
                error: Some(e.to_string()),
                suggested_fix: Some("Review the AI provider configuration.".into()),
            };
        }
    };
    smoke_test_profile_with_config(config, store, profile_name)
}

/// Run a smoke test using a pre-loaded config. The DB lock must already be released before
/// calling this — secret loading and the HTTP request happen entirely outside SQLite.
pub fn smoke_test_profile_with_config(
    config: AiProviderConfig,
    store: &dyn SecretStore,
    profile_name: &str,
) -> SmokeTestResult {
    let started = std::time::Instant::now();
    let runner = crate::ai::runners::DirectApiRunner;
    match resolve_for_profile_from_config(config.clone(), store, profile_name)
        .and_then(|resolved| runner.run(&resolved, AiRequest::smoke_test()))
    {
        Ok(response) => SmokeTestResult {
            status: SmokeTestStatus::Success,
            profile: response.profile,
            runner: response.runner,
            execution_mode: response.execution_mode,
            model: response.model,
            elapsed_ms: started.elapsed().as_millis() as u32,
            preview: Some(response.text.chars().take(200).collect()),
            error: None,
            suggested_fix: None,
        },
        Err(err) => {
            let fix = suggested_fix(&err);
            // Profile metadata for the result (no DB or HTTP, just config lookup)
            let (runner_val, execution_mode, model) =
                resolve_for_profile_from_config(config, store, profile_name)
                    .map(|r| (r.profile.runner.clone(), r.profile.execution_mode.clone(), r.profile.model.clone()))
                    .unwrap_or((AiRunner::OpenAiChatCompletions, AiExecutionMode::DirectApi, "".into()));
            SmokeTestResult {
                status: SmokeTestStatus::Error,
                profile: profile_name.into(),
                runner: runner_val,
                execution_mode,
                model,
                elapsed_ms: started.elapsed().as_millis() as u32,
                preview: None,
                error: Some(err.to_string()),
                suggested_fix: Some(fix.into()),
            }
        }
    }
}

fn suggested_fix(err: &AiError) -> &'static str {
    let text = err.to_string();
    if text.contains("401") || text.contains("credential") || text.contains("secret") {
        "Check the selected credential."
    } else if text.contains("base_url") || text.contains("connect") || text.contains("timed out") {
        "Check base URL."
    } else if text.contains("runner") || text.contains("protocol") {
        "Choose a runner compatible with this endpoint protocol."
    } else {
        "Review the AI provider configuration."
    }
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
