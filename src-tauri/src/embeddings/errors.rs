use serde::{Deserialize, Serialize};
use specta::Type;
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub enum EmbeddingErrorCategory {
    MissingRoute,
    UnsupportedProfile,
    ProviderRejected,
    ProviderUnavailable,
    ProviderRateLimited,
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
    pub retry_after_seconds: Option<u64>,
}

impl EmbeddingError {
    pub fn new(category: EmbeddingErrorCategory, safe_summary: impl Into<String>) -> Self {
        Self { category, safe_summary: safe_summary.into(), retry_after_seconds: None }
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
    pub fn provider_rate_limited(retry_after_seconds: Option<u64>) -> Self {
        let seconds = retry_after_seconds.unwrap_or(60).max(60);
        Self {
            category: EmbeddingErrorCategory::ProviderRateLimited,
            safe_summary: format!(
                "Embedding paused: provider rate limit reached. Retry after at least {seconds} seconds."
            ),
            retry_after_seconds: Some(seconds),
        }
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

#[cfg(test)]
pub fn assert_safe_message(message: &str) {
    for forbidden in [
        "Authorization",
        "Bearer",
        "sk-test-secret",
        "api_key",
        "raw provider body",
        "Cannot sign in",
        "Full issue text",
    ] {
        assert!(
            !message.contains(forbidden),
            "forbidden text leaked: {forbidden} in: {message}"
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_rejected_redacts_secret_and_document_text() {
        let err = EmbeddingError::provider_rejected(
            "Bearer sk-test-secret Authorization raw provider body Cannot sign in Full issue text".into(),
        );
        assert_safe_message(&err.to_string());
        assert!(err.to_string().contains("Embedding provider rejected"));
    }

    #[test]
    fn provider_unavailable_message_is_safe() {
        let err = EmbeddingError::provider_unavailable();
        assert_safe_message(&err.to_string());
    }

    #[test]
    fn dimension_mismatch_message_is_safe() {
        let err = EmbeddingError::dimension_mismatch();
        assert_safe_message(&err.to_string());
    }

    #[test]
    fn invalid_response_message_is_safe() {
        let err = EmbeddingError::invalid_response();
        assert_safe_message(&err.to_string());
    }

    #[test]
    fn storage_error_is_safe() {
        let rusqlite_err = rusqlite::Error::QueryReturnedNoRows;
        let err = EmbeddingError::from(rusqlite_err);
        assert_safe_message(&err.to_string());
    }

    #[test]
    fn rate_limited_message_is_safe_and_carries_retry_delay() {
        let err = EmbeddingError::provider_rate_limited(Some(30));
        assert_eq!(err.retry_after_seconds, Some(60));
        assert_safe_message(&err.to_string());
        assert!(err.to_string().contains("Embedding paused"));
    }
}
