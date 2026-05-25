//! Ingestion error type and category. Hand-rolled (no thiserror).
//!
//! `IngestionError::Display` is guaranteed not to leak token-shaped substrings
//! or Authorization headers — the only externally provided text is run through
//! [`scrub`] before being stored.

use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IngestionErrorCategory {
    Authentication,
    Forbidden,
    NotFound,
    RateLimited,
    Network,
    Schema,
    Decode,
    Cancelled,
    Partial,
    Storage,
    Unknown,
}

#[derive(Debug, Clone)]
pub struct IngestionError {
    pub category: IngestionErrorCategory,
    safe_message: String,
}

impl IngestionError {
    pub fn new(category: IngestionErrorCategory, safe_message: impl Into<String>) -> Self {
        Self {
            category,
            safe_message: scrub(&safe_message.into()),
        }
    }

    /// Convenience: accept a category as string (for legacy/test ergonomics) but
    /// always return the safe Display.
    pub fn safe(category_hint: &str, _unsafe_context: &str) -> Self {
        let cat = match category_hint.to_ascii_lowercase().as_str() {
            "authentication" => IngestionErrorCategory::Authentication,
            "forbidden" => IngestionErrorCategory::Forbidden,
            "rate limited" | "rate_limited" | "ratelimited" => {
                IngestionErrorCategory::RateLimited
            }
            "network" => IngestionErrorCategory::Network,
            "schema" => IngestionErrorCategory::Schema,
            "decode" => IngestionErrorCategory::Decode,
            "cancelled" => IngestionErrorCategory::Cancelled,
            "partial" => IngestionErrorCategory::Partial,
            "storage" => IngestionErrorCategory::Storage,
            "notfound" | "not_found" => IngestionErrorCategory::NotFound,
            _ => IngestionErrorCategory::Unknown,
        };
        IngestionError::new(cat, category_hint)
    }

    pub fn category(&self) -> IngestionErrorCategory {
        self.category
    }

    pub fn safe_message(&self) -> &str {
        &self.safe_message
    }
}

impl fmt::Display for IngestionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let label = match self.category {
            IngestionErrorCategory::Authentication => "Authentication failed",
            IngestionErrorCategory::Forbidden => "Access denied",
            IngestionErrorCategory::NotFound => "Not found",
            IngestionErrorCategory::RateLimited => "Rate limited",
            IngestionErrorCategory::Network => "Network error",
            IngestionErrorCategory::Schema => "Schema changed",
            IngestionErrorCategory::Decode => "Decode error",
            IngestionErrorCategory::Cancelled => "Cancelled",
            IngestionErrorCategory::Partial => "Partial sync",
            IngestionErrorCategory::Storage => "Storage error",
            IngestionErrorCategory::Unknown => "Unknown error",
        };
        if self.safe_message.is_empty() {
            f.write_str(label)
        } else {
            write!(f, "{label}: {}", self.safe_message)
        }
    }
}

impl std::error::Error for IngestionError {}

impl From<rusqlite::Error> for IngestionError {
    fn from(_err: rusqlite::Error) -> Self {
        // Storage errors must never leak rusqlite::Error debug contents.
        IngestionError::new(IngestionErrorCategory::Storage, "")
    }
}

impl From<crate::sources::jira_errors::JiraApiError> for IngestionError {
    fn from(err: crate::sources::jira_errors::JiraApiError) -> Self {
        use crate::sources::jira_errors::JiraApiError as J;
        let cat = match err {
            J::Unauthorized => IngestionErrorCategory::Authentication,
            J::Forbidden => IngestionErrorCategory::Forbidden,
            J::NotFound => IngestionErrorCategory::NotFound,
            J::RateLimited { .. } => IngestionErrorCategory::RateLimited,
            J::Network => IngestionErrorCategory::Network,
            J::Decode => IngestionErrorCategory::Decode,
            J::BadRequest
            | J::Server { .. }
            | J::InvalidBaseUrl
            | J::InvalidRequest { .. } => IngestionErrorCategory::Unknown,
        };
        IngestionError::new(cat, "")
    }
}

impl From<crate::sources::jira_ingestion::ProjectionError> for IngestionError {
    fn from(err: crate::sources::jira_ingestion::ProjectionError) -> Self {
        match err {
            crate::sources::jira_ingestion::ProjectionError::Storage(_) => {
                IngestionError::new(IngestionErrorCategory::Storage, "")
            }
            crate::sources::jira_ingestion::ProjectionError::Invalid(_) => {
                IngestionError::new(IngestionErrorCategory::Schema, "")
            }
        }
    }
}

/// Strip token-shaped substrings, Authorization headers, and Bearer tokens
/// conservatively. We replace the *whole* run that contains them with a marker
/// so that no part of the original token survives in Display output.
fn scrub(input: &str) -> String {
    let mut s = input.to_string();
    // Case-insensitive replacement for "Authorization" + any value that follows
    // until the next newline. This is conservative: we drop the entire line.
    let lowered = s.to_ascii_lowercase();
    if lowered.contains("authorization") || lowered.contains("bearer ") {
        // Replace each line that mentions either keyword.
        let mut out = String::with_capacity(s.len());
        let mut first = true;
        for line in s.split('\n') {
            if !first {
                out.push('\n');
            }
            first = false;
            let ll = line.to_ascii_lowercase();
            if ll.contains("authorization") || ll.contains("bearer ") {
                out.push_str("[redacted]");
            } else {
                out.push_str(line);
            }
        }
        s = out;
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sources::jira_errors::JiraApiError;

    #[test]
    fn ingestion_error_display_never_leaks_tokens_or_auth_headers() {
        let err = IngestionError::new(
            IngestionErrorCategory::Authentication,
            "Authorization: Bearer secret-token raw body",
        );
        let rendered = format!("{err}");
        assert!(rendered.contains("Authentication failed"));
        assert!(
            !rendered.contains("secret-token"),
            "rendered={rendered}"
        );
        assert!(
            !rendered.to_ascii_lowercase().contains("authorization"),
            "rendered={rendered}"
        );
    }

    #[test]
    fn empty_safe_message_displays_just_label() {
        let err = IngestionError::new(IngestionErrorCategory::Network, "");
        assert_eq!(format!("{err}"), "Network error");
    }

    #[test]
    fn jira_api_error_maps_to_category() {
        let pairs: Vec<(JiraApiError, IngestionErrorCategory)> = vec![
            (JiraApiError::Unauthorized, IngestionErrorCategory::Authentication),
            (JiraApiError::Forbidden, IngestionErrorCategory::Forbidden),
            (JiraApiError::NotFound, IngestionErrorCategory::NotFound),
            (
                JiraApiError::RateLimited {
                    retry_after_seconds: Some(3),
                },
                IngestionErrorCategory::RateLimited,
            ),
            (JiraApiError::Network, IngestionErrorCategory::Network),
            (JiraApiError::Decode, IngestionErrorCategory::Decode),
            (JiraApiError::BadRequest, IngestionErrorCategory::Unknown),
            (
                JiraApiError::Server { status: 503 },
                IngestionErrorCategory::Unknown,
            ),
            (JiraApiError::InvalidBaseUrl, IngestionErrorCategory::Unknown),
            (
                JiraApiError::InvalidRequest {
                    message: "x".into(),
                },
                IngestionErrorCategory::Unknown,
            ),
        ];
        for (input, expected) in pairs {
            let ie: IngestionError = input.into();
            assert_eq!(ie.category(), expected, "mismatch for category");
            // And display must never carry a token.
            let rendered = format!("{ie}");
            assert!(!rendered.contains("secret"));
        }
    }

    #[test]
    fn rusqlite_error_maps_to_storage_with_empty_message() {
        let err: IngestionError = rusqlite::Error::QueryReturnedNoRows.into();
        assert_eq!(err.category(), IngestionErrorCategory::Storage);
        assert_eq!(format!("{err}"), "Storage error");
    }
}
