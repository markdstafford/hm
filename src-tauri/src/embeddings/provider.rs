use serde::{Deserialize, Serialize};
use specta::Type;
use crate::embeddings::errors::EmbeddingError;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct EmbeddingRequest {
    pub input: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct EmbeddingUsage {
    pub input_tokens: Option<u32>,
    pub total_tokens: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct EmbeddingResponse {
    pub vectors: Vec<Vec<f32>>,
    pub model: String,
    pub profile: String,
    pub dimension: usize,
    pub usage: Option<EmbeddingUsage>,
}

pub trait EmbeddingProvider: Send + Sync {
    fn embed(&self, request: EmbeddingRequest) -> Result<EmbeddingResponse, EmbeddingError>;
}

#[derive(Debug, Clone)]
pub struct FakeEmbeddingProvider {
    dimension: usize,
    profile: String,
    model: String,
}

impl FakeEmbeddingProvider {
    pub fn new(dimension: usize, profile: impl Into<String>, model: impl Into<String>) -> Self {
        Self { dimension, profile: profile.into(), model: model.into() }
    }
}

impl EmbeddingProvider for FakeEmbeddingProvider {
    fn embed(&self, request: EmbeddingRequest) -> Result<EmbeddingResponse, EmbeddingError> {
        let vectors = request.input.iter().map(|text| deterministic_vector(text, self.dimension)).collect();
        Ok(EmbeddingResponse {
            vectors,
            model: self.model.clone(),
            profile: self.profile.clone(),
            dimension: self.dimension,
            usage: None,
        })
    }
}

#[derive(Default)]
pub struct AiEmbeddingProvider;

impl AiEmbeddingProvider {
    pub fn embed_for_default_route(
        &self,
        conn: &rusqlite::Connection,
        store: &dyn crate::settings::secrets::SecretStore,
        request: EmbeddingRequest,
    ) -> Result<EmbeddingResponse, EmbeddingError> {
        let resolved = crate::ai::resolver::resolve_for_task(conn, store, crate::embeddings::EMBEDDING_DEFAULT_ROUTE)
            .map_err(EmbeddingError::from)?;
        crate::ai::runners::openai_embeddings::OpenAiEmbeddingsRunner::default()
            .run(&resolved, request)
    }
}

fn deterministic_vector(text: &str, dimension: usize) -> Vec<f32> {
    let mut state: u64 = 0xcbf29ce484222325;
    for byte in text.as_bytes() {
        state ^= *byte as u64;
        state = state.wrapping_mul(0x100000001b3);
    }
    (0..dimension)
        .map(|i| {
            let bucket = (state.rotate_left((i as u32 * 13) % 63) % 2001) as f32;
            (bucket - 1000.0) / 1000.0
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fake_provider_returns_deterministic_vectors_for_fixed_text() {
        let provider = FakeEmbeddingProvider::new(3, "fake-profile", "fake-model");
        let request = EmbeddingRequest {
            input: vec![
                "Title: Login bug\n\nBody:\nCannot sign in".into(),
                "Body:\nSecond comment".into(),
            ],
        };
        let first = provider.embed(request.clone()).expect("first fake response");
        let second = provider.embed(request).expect("second fake response");
        assert_eq!(first, second);
        assert_eq!(first.dimension, 3);
        assert_eq!(first.vectors.len(), 2);
        assert_ne!(first.vectors[0], first.vectors[1]);
    }

    #[test]
    fn provider_error_display_redacts_secret_and_document_text() {
        let err = EmbeddingError::provider_rejected(
            "Bearer sk-test-secret Authorization raw body Cannot sign in".into(),
        );
        let msg = err.to_string();
        assert!(msg.contains("Embedding provider rejected the request"), "should contain safe message");
        assert!(!msg.contains("sk-test-secret"), "must not contain secret");
        assert!(!msg.contains("Authorization"), "must not contain auth header");
        assert!(!msg.contains("Cannot sign in"), "must not contain document text");
    }
}
