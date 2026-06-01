use crate::ai::config::{AiEndpointProtocol, AiExecutionMode, AiRunner};
use crate::ai::errors::AiError;
use crate::ai::resolver::ResolvedAiProvider;
use crate::ai::runners::AiRunnerClient;
use crate::ai::service::{AiMessageRole, AiRequest, AiResponse, AiUsage};
use std::time::Duration;

pub struct OpenAiChatCompletionsRunner {
    pub timeout: Duration,
}

impl Default for OpenAiChatCompletionsRunner {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(30),
        }
    }
}

impl AiRunnerClient for OpenAiChatCompletionsRunner {
    fn run(
        &self,
        resolved: &ResolvedAiProvider,
        request: AiRequest,
    ) -> Result<AiResponse, AiError> {
        // Validate: protocol must be OpenAiChatCompletionsCompatible, runner OpenAiChatCompletions, mode DirectApi
        match (&resolved.endpoint.protocol, &resolved.profile.runner, &resolved.profile.execution_mode) {
            (AiEndpointProtocol::OpenAiChatCompletionsCompatible, AiRunner::OpenAiChatCompletions, AiExecutionMode::DirectApi) => {}
            _ => return Err(AiError::UnsupportedRunner(
                format!("OpenAiChatCompletionsRunner requires OpenAiChatCompletionsCompatible endpoint+OpenAiChatCompletions runner+DirectApi mode, got {:?}/{:?}/{:?}",
                    resolved.endpoint.protocol, resolved.profile.runner, resolved.profile.execution_mode)
            )),
        }

        let base_url = resolved.endpoint.base_url.trim_end_matches('/');
        let url = format!("{base_url}/chat/completions");
        let api_key = resolved.secret.value.expose_for_runner();

        // Build messages array — system message prepended if present
        let mut messages: Vec<serde_json::Value> = Vec::new();
        if let Some(sys) = &request.system {
            messages.push(serde_json::json!({"role": "system", "content": sys}));
        }
        for m in &request.messages {
            let role = match m.role {
                AiMessageRole::User => "user",
                AiMessageRole::Assistant => "assistant",
                AiMessageRole::System => "system",
            };
            messages.push(serde_json::json!({"role": role, "content": m.content}));
        }

        let mut body = serde_json::json!({
            "model": resolved.profile.model,
            "messages": messages,
            "max_tokens": request.max_output_tokens.unwrap_or(256),
        });
        if let Some(temp) = request.temperature {
            body["temperature"] = serde_json::json!(temp);
        }

        let agent = ureq::AgentBuilder::new().timeout(self.timeout).build();

        let result = agent
            .post(&url)
            .set("Authorization", &format!("Bearer {api_key}"))
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

        let text = resp_json["choices"]
            .as_array()
            .and_then(|arr| arr.first())
            .and_then(|choice| choice["message"]["content"].as_str())
            .ok_or_else(|| AiError::Provider("unexpected response format".into()))?
            .to_string();

        let model = resp_json["model"]
            .as_str()
            .unwrap_or(&resolved.profile.model)
            .to_string();
        let usage = resp_json.get("usage").map(|u| AiUsage {
            input_tokens: u["prompt_tokens"].as_u64().map(|v| v as u32),
            output_tokens: u["completion_tokens"].as_u64().map(|v| v as u32),
        });

        Ok(AiResponse {
            text,
            model,
            profile: resolved.profile.name.clone(),
            runner: AiRunner::OpenAiChatCompletions,
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
    use crate::ai::config::{
        AiCredentialConfig, AiCredentialKind, AiEndpointConfig, AiEndpointProtocol,
        AiExecutionMode, AiProfileConfig, AiRunner, CredentialSource,
    };
    use crate::ai::credentials::LoadedCredentialSecret;
    use crate::commands::JsonValue;

    fn make_resolved(base_url: &str) -> ResolvedAiProvider {
        crate::ai::resolver::ResolvedAiProvider {
            profile: AiProfileConfig {
                name: "chat-fast".into(),
                endpoint_ref: "gateway".into(),
                model: "gpt-test".into(),
                runner: AiRunner::OpenAiChatCompletions,
                execution_mode: AiExecutionMode::DirectApi,
                settings: JsonValue(serde_json::json!({})),
            },
            endpoint: AiEndpointConfig {
                name: "gateway".into(),
                protocol: AiEndpointProtocol::OpenAiChatCompletionsCompatible,
                base_url: base_url.into(),
                credential_ref: "key".into(),
            },
            credential: AiCredentialConfig {
                name: "key".into(),
                kind: AiCredentialKind::BearerToken,
                source: CredentialSource::Keychain {
                    key_ref: "ai.credentials.key".into(),
                },
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
            assert_eq!(req.url(), "/v1/chat/completions");
            // Verify Authorization: Bearer header is present (not logging value)
            let has_auth = req
                .headers()
                .iter()
                .any(|h| h.field.as_str().to_ascii_lowercase() == "authorization");
            assert!(has_auth, "Authorization header must be present");
            let body = r#"{"model":"gpt-test","usage":{"prompt_tokens":3,"completion_tokens":1},"choices":[{"message":{"role":"assistant","content":"ok"}}]}"#;
            let resp = tiny_http::Response::from_string(body).with_header(
                "content-type: application/json"
                    .parse::<tiny_http::Header>()
                    .unwrap(),
            );
            req.respond(resp).unwrap();
        });
        let runner = OpenAiChatCompletionsRunner::default();
        let resolved = make_resolved(&format!("http://127.0.0.1:{port}/v1"));
        let result = runner.run(&resolved, AiRequest::smoke_test()).unwrap();
        handle.join().unwrap();
        assert_eq!(result.text, "ok");
        assert_eq!(result.model, "gpt-test");
        assert_eq!(result.usage.as_ref().unwrap().input_tokens, Some(3));
        assert_eq!(result.usage.as_ref().unwrap().output_tokens, Some(1));
        assert_eq!(result.runner, AiRunner::OpenAiChatCompletions);
    }

    #[test]
    fn provider_401_returns_safe_error() {
        let server = tiny_http::Server::http("127.0.0.1:0").unwrap();
        let port = server.server_addr().to_ip().unwrap().port();
        let handle = std::thread::spawn(move || {
            let req = server.recv().unwrap();
            let resp = tiny_http::Response::from_string(
                r#"{"error":{"message":"Incorrect API key provided"}}"#,
            )
            .with_status_code(401)
            .with_header(
                "content-type: application/json"
                    .parse::<tiny_http::Header>()
                    .unwrap(),
            );
            req.respond(resp).unwrap();
        });
        let runner = OpenAiChatCompletionsRunner::default();
        let resolved = make_resolved(&format!("http://127.0.0.1:{port}/v1"));
        let err = runner.run(&resolved, AiRequest::smoke_test()).unwrap_err();
        handle.join().unwrap();
        let msg = err.to_string();
        assert!(msg.contains("401"), "error should mention 401");
        assert!(
            msg.contains("credential"),
            "error should suggest checking credential"
        );
        assert!(
            !msg.contains("sk-test-secret"),
            "error must not contain secret"
        );
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
        let runner = OpenAiChatCompletionsRunner {
            timeout: Duration::from_millis(50),
        };
        let resolved = make_resolved(&format!("http://127.0.0.1:{port}/v1"));
        let err = runner.run(&resolved, AiRequest::smoke_test()).unwrap_err();
        assert!(
            matches!(err, AiError::Timeout),
            "expected Timeout error, got: {err}"
        );
    }
}
