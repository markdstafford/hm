use std::time::Duration;
use crate::ai::config::{AiEndpointProtocol, AiExecutionMode, AiRunner};
use crate::ai::errors::AiError;
use crate::ai::resolver::ResolvedAiProvider;
use crate::ai::runners::AiRunnerClient;
use crate::ai::service::{AiMessageRole, AiRequest, AiResponse, AiUsage};

pub struct AnthropicMessagesRunner {
    pub timeout: Duration,
}

impl Default for AnthropicMessagesRunner {
    fn default() -> Self {
        Self { timeout: Duration::from_secs(30) }
    }
}

impl AiRunnerClient for AnthropicMessagesRunner {
    fn run(&self, resolved: &ResolvedAiProvider, request: AiRequest) -> Result<AiResponse, AiError> {
        // Validate: protocol must be AnthropicMessages, runner AnthropicMessages, mode DirectApi
        match (&resolved.endpoint.protocol, &resolved.profile.runner, &resolved.profile.execution_mode) {
            (AiEndpointProtocol::AnthropicMessages, AiRunner::AnthropicMessages, AiExecutionMode::DirectApi) => {}
            _ => return Err(AiError::UnsupportedRunner(
                format!("AnthropicMessagesRunner requires AnthropicMessages endpoint+runner+DirectApi mode, got {:?}/{:?}/{:?}",
                    resolved.endpoint.protocol, resolved.profile.runner, resolved.profile.execution_mode)
            )),
        }

        let base_url = resolved.endpoint.base_url.trim_end_matches('/');
        let url = format!("{base_url}/messages");
        let api_key = resolved.secret.value.expose_for_runner();

        // Build messages (system goes in top-level "system" field)
        let messages: Vec<serde_json::Value> = request.messages.iter().map(|m| {
            let role = match m.role {
                AiMessageRole::User => "user",
                AiMessageRole::Assistant => "assistant",
                AiMessageRole::System => "user", // fallback; system is handled separately
            };
            serde_json::json!({"role": role, "content": m.content})
        }).collect();

        let mut body = serde_json::json!({
            "model": resolved.profile.model,
            "messages": messages,
            "max_tokens": request.max_output_tokens.unwrap_or(256),
        });
        if let Some(sys) = &request.system {
            body["system"] = serde_json::json!(sys);
        }
        if let Some(temp) = request.temperature {
            body["temperature"] = serde_json::json!(temp);
        }

        let agent = ureq::AgentBuilder::new()
            .timeout(self.timeout)
            .build();

        let result = agent
            .post(&url)
            .set("x-api-key", api_key)
            .set("api-key", api_key)
            .set("anthropic-version", "2023-06-01")
            .set("content-type", "application/json")
            .send_json(&body);

        let response = match result {
            Ok(resp) => resp,
            Err(ureq::Error::Status(status, resp)) => {
                let safe_msg = safe_error_message(status, &resp);
                return Err(AiError::Provider(safe_msg));
            }
            Err(ureq::Error::Transport(t)) => {
                if t.kind() == ureq::ErrorKind::Io {
                    return Err(AiError::Timeout);
                }
                return Err(AiError::Provider("connection error".into()));
            }
        };

        let resp_json: serde_json::Value = response
            .into_json()
            .map_err(|_| AiError::Provider("failed to parse provider response".into()))?;

        let text = resp_json["content"]
            .as_array()
            .and_then(|arr| arr.first())
            .and_then(|item| item["text"].as_str())
            .ok_or_else(|| AiError::Provider("unexpected response format".into()))?
            .to_string();

        let model = resp_json["model"].as_str().unwrap_or(&resolved.profile.model).to_string();
        let usage = resp_json.get("usage").map(|u| AiUsage {
            input_tokens: u["input_tokens"].as_u64().map(|v| v as u32),
            output_tokens: u["output_tokens"].as_u64().map(|v| v as u32),
        });

        Ok(AiResponse {
            text,
            model,
            profile: resolved.profile.name.clone(),
            runner: AiRunner::AnthropicMessages,
            execution_mode: AiExecutionMode::DirectApi,
            usage,
        })
    }
}

fn safe_error_message(status: u16, _resp: &ureq::Response) -> String {
    match status {
        401 => "Endpoint returned 401. Check the selected credential.".into(),
        403 => "Endpoint returned 403. Check credential permissions.".into(),
        404 => "Endpoint returned 404. Check base URL.".into(),
        429 => "Endpoint returned 429. Rate limited.".into(),
        s if s >= 500 => format!("Endpoint returned {}. Provider error.", s),
        s => format!("Endpoint returned {}.", s),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::config::{AiCredentialConfig, AiCredentialKind, AiEndpointConfig, AiEndpointProtocol, AiExecutionMode, AiProfileConfig, AiRunner, CredentialSource};
    use crate::ai::credentials::LoadedCredentialSecret;
    use crate::commands::JsonValue;

    fn make_resolved(base_url: &str) -> ResolvedAiProvider {
        crate::ai::resolver::ResolvedAiProvider {
            profile: AiProfileConfig {
                name: "triage".into(),
                endpoint_ref: "anthropic".into(),
                model: "claude-test".into(),
                runner: AiRunner::AnthropicMessages,
                execution_mode: AiExecutionMode::DirectApi,
                settings: JsonValue(serde_json::json!({})),
            },
            endpoint: AiEndpointConfig {
                name: "anthropic".into(),
                protocol: AiEndpointProtocol::AnthropicMessages,
                base_url: base_url.into(),
                credential_ref: "key".into(),
            },
            credential: AiCredentialConfig {
                name: "key".into(),
                kind: AiCredentialKind::ApiKey,
                source: CredentialSource::Keychain { key_ref: "ai.credentials.key".into() },
            },
            secret: LoadedCredentialSecret::new_for_test("key", "sk-test-secret"),
        }
    }

    #[test]
    fn success_response_maps_correctly() {
        let server = tiny_http::Server::http("127.0.0.1:0").unwrap();
        let port = server.server_addr().to_ip().unwrap().port();
        let handle = std::thread::spawn(move || {
            let req = server.recv().unwrap();
            // Verify path
            assert_eq!(req.url(), "/v1/messages");
            // Verify x-api-key header is present (not logging value)
            let has_api_key = req.headers().iter().any(|h| h.field.as_str().to_ascii_lowercase() == "x-api-key");
            assert!(has_api_key, "x-api-key header must be present");
            let body = r#"{"model":"claude-test","usage":{"input_tokens":3,"output_tokens":1},"content":[{"type":"text","text":"ok"}]}"#;
            let resp = tiny_http::Response::from_string(body)
                .with_header("content-type: application/json".parse::<tiny_http::Header>().unwrap());
            req.respond(resp).unwrap();
        });
        let runner = AnthropicMessagesRunner::default();
        let resolved = make_resolved(&format!("http://127.0.0.1:{port}/v1"));
        let result = runner.run(&resolved, AiRequest::smoke_test()).unwrap();
        handle.join().unwrap();
        assert_eq!(result.text, "ok");
        assert_eq!(result.model, "claude-test");
        assert_eq!(result.usage.as_ref().unwrap().input_tokens, Some(3));
        assert_eq!(result.usage.as_ref().unwrap().output_tokens, Some(1));
        assert_eq!(result.runner, AiRunner::AnthropicMessages);
    }

    #[test]
    fn provider_401_returns_safe_error() {
        let server = tiny_http::Server::http("127.0.0.1:0").unwrap();
        let port = server.server_addr().to_ip().unwrap().port();
        let handle = std::thread::spawn(move || {
            let req = server.recv().unwrap();
            let resp = tiny_http::Response::from_string(r#"{"error":{"type":"auth_error","message":"invalid api key"}}"#)
                .with_status_code(401)
                .with_header("content-type: application/json".parse::<tiny_http::Header>().unwrap());
            req.respond(resp).unwrap();
        });
        let runner = AnthropicMessagesRunner::default();
        let resolved = make_resolved(&format!("http://127.0.0.1:{port}/v1"));
        let err = runner.run(&resolved, AiRequest::smoke_test()).unwrap_err();
        handle.join().unwrap();
        let msg = err.to_string();
        assert!(msg.contains("401"), "error should mention 401");
        assert!(msg.contains("credential"), "error should suggest checking credential");
        assert!(!msg.contains("sk-test-secret"), "error must not contain secret");
    }

    #[test]
    fn timeout_returns_safe_error() {
        let server = tiny_http::Server::http("127.0.0.1:0").unwrap();
        let port = server.server_addr().to_ip().unwrap().port();
        // Server accepts but never responds
        let _handle = std::thread::spawn(move || {
            let _req = server.recv().unwrap();
            std::thread::sleep(Duration::from_secs(60));
        });
        let runner = AnthropicMessagesRunner { timeout: Duration::from_millis(50) };
        let resolved = make_resolved(&format!("http://127.0.0.1:{port}/v1"));
        let err = runner.run(&resolved, AiRequest::smoke_test()).unwrap_err();
        assert!(matches!(err, AiError::Timeout), "expected Timeout error, got: {err}");
    }
}
