use serde::{Deserialize, Serialize};
use specta::Type;
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub enum EmbeddingErrorCategory {
    MissingRoute,
    UnsupportedProfile,
    ProviderRejected,
    ProviderUnavailable,
    InvalidResponse,
    DimensionMismatch,
    Storage,
    SqliteVecUnavailable,
    MissingFreshEmbedding,
    InvalidQuery,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct EmbeddingError {
    pub category: EmbeddingErrorCategory,
    pub safe_summary: String,
}

impl EmbeddingError {
    pub fn new(category: EmbeddingErrorCategory, safe_summary: impl Into<String>) -> Self {
        Self { category, safe_summary: safe_summary.into() }
    }
    pub fn provider_rejected(_detail: String) -> Self {
        Self::new(EmbeddingErrorCategory::ProviderRejected, "Embedding provider rejected the request: Check the selected credential and model.")
    }
    pub fn unsupported_profile() -> Self {
        Self::new(EmbeddingErrorCategory::UnsupportedProfile, "Unsupported embedding profile: The selected profile cannot create embeddings.")
    }
    pub fn missing_route() -> Self {
        Self::new(EmbeddingErrorCategory::MissingRoute, "No embedding route configured: Add a route for embedding.default.")
    }
    pub fn dimension_mismatch() -> Self {
        Self::new(EmbeddingErrorCategory::DimensionMismatch, "Embedding dimension changed: Rebuild embeddings for this model before searching.")
    }
    pub fn provider_unavailable() -> Self {
        Self::new(EmbeddingErrorCategory::ProviderUnavailable, "Embedding provider unavailable: Retry to continue.")
    }
    pub fn invalid_response() -> Self {
        Self::new(EmbeddingErrorCategory::InvalidResponse, "Embedding provider returned an invalid response.")
    }
}

impl fmt::Display for EmbeddingError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.safe_summary)
    }
}
impl std::error::Error for EmbeddingError {}

impl From<rusqlite::Error> for EmbeddingError {
    fn from(_err: rusqlite::Error) -> Self {
        Self::new(EmbeddingErrorCategory::Storage, "Embedding storage error.")
    }
}

impl From<crate::ai::errors::AiError> for EmbeddingError {
    fn from(err: crate::ai::errors::AiError) -> Self {
        match err {
            crate::ai::errors::AiError::MissingRoute { .. } => Self::missing_route(),
            crate::ai::errors::AiError::UnsupportedRunner(_) => Self::unsupported_profile(),
            crate::ai::errors::AiError::Timeout => Self::provider_unavailable(),
            _ => Self::new(EmbeddingErrorCategory::ProviderRejected, "Embedding provider rejected the request: Check the selected credential and model."),
        }
    }
}
