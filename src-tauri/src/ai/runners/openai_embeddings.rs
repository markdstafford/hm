use std::time::Duration;
use crate::ai::config::{AiEndpointProtocol, AiExecutionMode, AiRunner};
use crate::ai::resolver::ResolvedAiProvider;
use crate::embeddings::errors::EmbeddingError;
use crate::embeddings::provider::{EmbeddingRequest, EmbeddingResponse, EmbeddingUsage};

pub struct OpenAiEmbeddingsRunner {
    pub timeout: Duration,
}

impl Default for OpenAiEmbeddingsRunner {
    fn default() -> Self {
        Self { timeout: Duration::from_secs(30) }
    }
}

impl OpenAiEmbeddingsRunner {
    pub fn run(
        &self,
        resolved: &ResolvedAiProvider,
        request: EmbeddingRequest,
    ) -> Result<EmbeddingResponse, EmbeddingError> {
        match (&resolved.endpoint.protocol, &resolved.profile.runner, &resolved.profile.execution_mode) {
            (AiEndpointProtocol::OpenAiEmbeddingsCompatible, AiRunner::OpenAiEmbeddings, AiExecutionMode::DirectApi) => {}
            _ => return Err(EmbeddingError::unsupported_profile()),
        }

        let base_url = resolved.endpoint.base_url.trim_end_matches('/');
        let url = format!("{base_url}/embeddings");
        let api_key = resolved.secret.value.expose_for_runner();

        let body = serde_json::json!({
            "model": resolved.profile.model,
            "input": request.input,
        });

        let agent = ureq::AgentBuilder::new().timeout(self.timeout).build();

        let result = agent
            .post(&url)
            .set("Authorization", &format!("Bearer {api_key}"))
            .set("content-type", "application/json")
            .send_json(&body);

        let response = match result {
            Ok(resp) => resp,
            Err(ureq::Error::Status(status, _resp)) => {
                return Err(match status {
                    401 | 403 => EmbeddingError::provider_rejected(String::new()),
                    429 => EmbeddingError::provider_unavailable(),
                    s if s >= 500 => EmbeddingError::provider_unavailable(),
                    _ => EmbeddingError::provider_rejected(String::new()),
                });
            }
            Err(ureq::Error::Transport(_t)) => {
                return Err(EmbeddingError::provider_unavailable());
            }
        };

        let resp_json: serde_json::Value = response
            .into_json()
            .map_err(|_| EmbeddingError::invalid_response())?;

        let data = resp_json["data"]
            .as_array()
            .ok_or_else(EmbeddingError::invalid_response)?;

        if data.is_empty() {
            return Err(EmbeddingError::invalid_response());
        }

        // Sort by index then extract embeddings
        let mut indexed: Vec<(usize, Vec<f32>)> = data
            .iter()
            .map(|item| {
                let idx = item["index"].as_u64().unwrap_or(0) as usize;
                let embedding: Vec<f32> = item["embedding"]
                    .as_array()
                    .unwrap_or(&vec![])
                    .iter()
                    .filter_map(|v| v.as_f64().map(|f| f as f32))
                    .collect();
                (idx, embedding)
            })
            .collect();
        indexed.sort_by_key(|(i, _)| *i);

        // Validate consistent dimensions
        let first_dim = indexed[0].1.len();
        if first_dim == 0 {
            return Err(EmbeddingError::invalid_response());
        }
        for (_, vec) in &indexed {
            if vec.len() != first_dim {
                return Err(EmbeddingError::dimension_mismatch());
            }
        }

        let model = resp_json["model"]
            .as_str()
            .unwrap_or(&resolved.profile.model)
            .to_string();

        let usage = resp_json.get("usage").map(|u| EmbeddingUsage {
            input_tokens: u["prompt_tokens"].as_u64().map(|v| v as u32),
            total_tokens: u["total_tokens"].as_u64().map(|v| v as u32),
        });

        let vectors: Vec<Vec<f32>> = indexed.into_iter().map(|(_, v)| v).collect();

        Ok(EmbeddingResponse {
            vectors,
            model,
            profile: resolved.profile.name.clone(),
            dimension: first_dim,
            usage,
        })
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
    use std::io::Read;

    fn make_resolved(base_url: &str) -> crate::ai::resolver::ResolvedAiProvider {
        crate::ai::resolver::ResolvedAiProvider {
            profile: AiProfileConfig {
                name: "embed-small".into(),
                endpoint_ref: "embeddings-gateway".into(),
                model: "text-embedding-3-small".into(),
                runner: AiRunner::OpenAiEmbeddings,
                execution_mode: AiExecutionMode::DirectApi,
                settings: JsonValue(serde_json::json!({})),
            },
            endpoint: AiEndpointConfig {
                name: "embeddings-gateway".into(),
                protocol: AiEndpointProtocol::OpenAiEmbeddingsCompatible,
                base_url: base_url.into(),
                credential_ref: "key".into(),
            },
            credential: AiCredentialConfig {
                name: "key".into(),
                kind: AiCredentialKind::BearerToken,
                source: CredentialSource::Keychain { key_ref: "ai.credentials.key".into() },
            },
            secret: LoadedCredentialSecret::new_for_test("key", "sk-test-secret"),
        }
    }

    #[test]
    fn success_response_maps_batched_vectors_and_usage() {
        let server = tiny_http::Server::http("127.0.0.1:0").unwrap();
        let port = server.server_addr().to_ip().unwrap().port();
        let handle = std::thread::spawn(move || {
            let mut req = server.recv().unwrap();
            assert_eq!(req.url(), "/v1/embeddings");
            let has_auth = req.headers().iter().any(|h| h.field.as_str().to_ascii_lowercase() == "authorization");
            assert!(has_auth, "Authorization header must be present");
            // Read request body to verify model and input fields
            let mut body = String::new();
            req.as_reader().read_to_string(&mut body).unwrap();
            let parsed: serde_json::Value = serde_json::from_str(&body).unwrap();
            assert_eq!(parsed["model"], "text-embedding-3-small");
            assert_eq!(parsed["input"].as_array().unwrap().len(), 2);
            let resp_body = r#"{"model":"text-embedding-3-small","usage":{"prompt_tokens":5,"total_tokens":5},"data":[{"index":0,"embedding":[1.0,0.0,0.0]},{"index":1,"embedding":[0.0,1.0,0.0]}]}"#;
            let resp = tiny_http::Response::from_string(resp_body)
                .with_header("content-type: application/json".parse::<tiny_http::Header>().unwrap());
            req.respond(resp).unwrap();
        });
        let runner = OpenAiEmbeddingsRunner::default();
        let resolved = make_resolved(&format!("http://127.0.0.1:{port}/v1"));
        let request = crate::embeddings::provider::EmbeddingRequest {
            input: vec!["hello".into(), "world".into()],
        };
        let result = runner.run(&resolved, request).unwrap();
        handle.join().unwrap();
        assert_eq!(result.dimension, 3);
        assert_eq!(result.vectors.len(), 2);
        assert_eq!(result.vectors[0], vec![1.0f32, 0.0, 0.0]);
        assert_eq!(result.vectors[1], vec![0.0f32, 1.0, 0.0]);
        assert_eq!(result.usage.as_ref().unwrap().input_tokens, Some(5));
    }

    #[test]
    fn provider_401_returns_safe_error() {
        let server = tiny_http::Server::http("127.0.0.1:0").unwrap();
        let port = server.server_addr().to_ip().unwrap().port();
        let handle = std::thread::spawn(move || {
            let req = server.recv().unwrap();
            let resp = tiny_http::Response::from_string(
                r#"{"error":{"message":"sk-test-secret is invalid"}}"#,
            )
            .with_status_code(401)
            .with_header("content-type: application/json".parse::<tiny_http::Header>().unwrap());
            req.respond(resp).unwrap();
        });
        let runner = OpenAiEmbeddingsRunner::default();
        let resolved = make_resolved(&format!("http://127.0.0.1:{port}/v1"));
        let request = crate::embeddings::provider::EmbeddingRequest { input: vec!["hi".into()] };
        let err = runner.run(&resolved, request).unwrap_err();
        handle.join().unwrap();
        let msg = err.to_string();
        assert!(msg.contains("Embedding provider rejected the request"), "should be safe error");
        assert!(!msg.contains("sk-test-secret"), "must not contain secret");
        crate::embeddings::errors::assert_safe_message(&msg);
    }

    #[test]
    fn dimension_mismatch_returns_safe_error() {
        let server = tiny_http::Server::http("127.0.0.1:0").unwrap();
        let port = server.server_addr().to_ip().unwrap().port();
        let handle = std::thread::spawn(move || {
            let req = server.recv().unwrap();
            // Return vectors with inconsistent lengths
            let resp_body = r#"{"model":"text-embedding-3-small","data":[{"index":0,"embedding":[1.0,0.0]},{"index":1,"embedding":[0.0,1.0,0.0]}]}"#;
            let resp = tiny_http::Response::from_string(resp_body)
                .with_header("content-type: application/json".parse::<tiny_http::Header>().unwrap());
            req.respond(resp).unwrap();
        });
        let runner = OpenAiEmbeddingsRunner::default();
        let resolved = make_resolved(&format!("http://127.0.0.1:{port}/v1"));
        let request = crate::embeddings::provider::EmbeddingRequest {
            input: vec!["hello".into(), "world".into()],
        };
        let err = runner.run(&resolved, request).unwrap_err();
        handle.join().unwrap();
        let msg = err.to_string();
        assert!(msg.contains("dimension") || msg.contains("Embedding dimension"), "error should mention dimension");
        assert!(!msg.contains("sk-test-secret"), "must not contain secret");
    }

    #[test]
    fn timeout_returns_safe_error() {
        let server = tiny_http::Server::http("127.0.0.1:0").unwrap();
        let port = server.server_addr().to_ip().unwrap().port();
        let _handle = std::thread::spawn(move || {
            let _req = server.recv().unwrap();
            std::thread::sleep(std::time::Duration::from_secs(60));
        });
        let runner = OpenAiEmbeddingsRunner { timeout: std::time::Duration::from_millis(50) };
        let resolved = make_resolved(&format!("http://127.0.0.1:{port}/v1"));
        let request = crate::embeddings::provider::EmbeddingRequest { input: vec!["hi".into()] };
        let err = runner.run(&resolved, request).unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("unavailable") || msg.contains("Embedding provider"), "should be safe unavailable error");
    }
}
