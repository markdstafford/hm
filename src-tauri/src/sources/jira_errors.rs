use std::fmt;
use std::time::Duration;

#[derive(Clone, PartialEq, Eq)]
pub enum JiraApiError {
    InvalidBaseUrl,
    InvalidRequest { message: String },
    Unauthorized,
    Forbidden,
    NotFound,
    BadRequest,
    RateLimited { retry_after_seconds: Option<u64> },
    Server { status: u16 },
    Network,
    Decode,
    Conflict,
    UnsafeWriteUnknownOutcome,
}

impl JiraApiError {
    pub fn from_status(status: u16, retry_after_seconds: Option<u64>) -> Self {
        match status {
            400 => JiraApiError::BadRequest,
            401 => JiraApiError::Unauthorized,
            403 => JiraApiError::Forbidden,
            404 => JiraApiError::NotFound,
            409 => JiraApiError::Conflict,
            429 => JiraApiError::RateLimited { retry_after_seconds },
            _ => JiraApiError::Server { status },
        }
    }

    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            JiraApiError::Network
                | JiraApiError::RateLimited { .. }
                | JiraApiError::Server {
                    status: 500 | 502 | 503 | 504
                }
        )
    }

    pub fn retry_after_duration(&self) -> Option<Duration> {
        match self {
            JiraApiError::RateLimited {
                retry_after_seconds: Some(seconds),
            } => Some(Duration::from_secs(*seconds)),
            _ => None,
        }
    }
}

impl fmt::Display for JiraApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            JiraApiError::InvalidBaseUrl => f.write_str("invalid Jira server URL"),
            JiraApiError::InvalidRequest { .. } => f.write_str("invalid Jira request"),
            JiraApiError::Unauthorized => f.write_str("Jira authentication failed"),
            JiraApiError::Forbidden => f.write_str("Jira access denied"),
            JiraApiError::NotFound => f.write_str("Jira resource not found"),
            JiraApiError::BadRequest => f.write_str("Jira rejected the request"),
            JiraApiError::RateLimited { retry_after_seconds } => match retry_after_seconds {
                Some(seconds) => write!(
                    f,
                    "Jira rate limited the request; retry after {seconds} seconds"
                ),
                None => f.write_str("Jira rate limited the request"),
            },
            JiraApiError::Server { status } => {
                write!(f, "Jira server returned status {status}")
            }
            JiraApiError::Network => f.write_str("network error connecting to Jira"),
            JiraApiError::Decode => f.write_str("could not decode Jira response"),
            JiraApiError::Conflict => f.write_str("Jira rejected the write because the resource changed"),
            JiraApiError::UnsafeWriteUnknownOutcome => f.write_str("Jira write outcome is unknown; not retrying to avoid duplicate changes"),
        }
    }
}

impl std::error::Error for JiraApiError {}

/// Custom Debug implementation that redacts the `message` field in `InvalidRequest`
/// so that arbitrary upstream request details (including any token-shaped or
/// header-shaped content passed by callers) never appear in debug output.
impl fmt::Debug for JiraApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            JiraApiError::InvalidBaseUrl => write!(f, "InvalidBaseUrl"),
            JiraApiError::InvalidRequest { .. } => {
                // Redact the message — it may contain upstream request details.
                f.debug_struct("InvalidRequest")
                    .field("message", &"[redacted]")
                    .finish()
            }
            JiraApiError::Unauthorized => write!(f, "Unauthorized"),
            JiraApiError::Forbidden => write!(f, "Forbidden"),
            JiraApiError::NotFound => write!(f, "NotFound"),
            JiraApiError::BadRequest => write!(f, "BadRequest"),
            JiraApiError::RateLimited { retry_after_seconds } => f
                .debug_struct("RateLimited")
                .field("retry_after_seconds", retry_after_seconds)
                .finish(),
            JiraApiError::Server { status } => {
                f.debug_struct("Server").field("status", status).finish()
            }
            JiraApiError::Network => write!(f, "Network"),
            JiraApiError::Decode => write!(f, "Decode"),
            JiraApiError::Conflict => write!(f, "Conflict"),
            JiraApiError::UnsafeWriteUnknownOutcome => write!(f, "UnsafeWriteUnknownOutcome"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_is_safe_for_all_error_variants() {
        let errors = vec![
            JiraApiError::InvalidBaseUrl,
            JiraApiError::InvalidRequest {
                message: "Authorization: Bearer secret-token response body".into(),
            },
            JiraApiError::Unauthorized,
            JiraApiError::Forbidden,
            JiraApiError::NotFound,
            JiraApiError::BadRequest,
            JiraApiError::RateLimited {
                retry_after_seconds: Some(30),
            },
            JiraApiError::Server { status: 503 },
            JiraApiError::Network,
            JiraApiError::Decode,
            JiraApiError::Conflict,
            JiraApiError::UnsafeWriteUnknownOutcome,
        ];
        for err in errors {
            let rendered = format!("{err}");
            assert!(!rendered.contains("secret-token"));
            assert!(!rendered.to_ascii_lowercase().contains("authorization"));
            assert!(!rendered.to_ascii_lowercase().contains("response body"));
        }
    }

    #[test]
    fn debug_is_safe_for_all_error_variants() {
        // InvalidRequest.message must not appear in Debug output even when it contains
        // token-shaped or header-shaped strings (e.g. upstream request details).
        let sensitive_message =
            "Authorization: Bearer secret-token raw-response-body".to_string();
        let errors: Vec<JiraApiError> = vec![
            JiraApiError::InvalidBaseUrl,
            JiraApiError::InvalidRequest {
                message: sensitive_message.clone(),
            },
            JiraApiError::Unauthorized,
            JiraApiError::Forbidden,
            JiraApiError::NotFound,
            JiraApiError::BadRequest,
            JiraApiError::RateLimited {
                retry_after_seconds: Some(30),
            },
            JiraApiError::Server { status: 503 },
            JiraApiError::Network,
            JiraApiError::Decode,
            JiraApiError::Conflict,
            JiraApiError::UnsafeWriteUnknownOutcome,
        ];
        for err in &errors {
            let debug_str = format!("{err:?}");
            assert!(
                !debug_str.contains("secret-token"),
                "Debug output leaked secret-token for variant: {err:?}"
            );
            assert!(
                !debug_str.to_ascii_lowercase().contains("authorization"),
                "Debug output leaked Authorization for variant: {err:?}"
            );
            assert!(
                !debug_str.to_ascii_lowercase().contains("raw-response-body"),
                "Debug output leaked raw-response-body for variant: {err:?}"
            );
        }
        // The redacted placeholder must appear in the InvalidRequest variant's Debug output.
        let invalid_req = JiraApiError::InvalidRequest {
            message: sensitive_message,
        };
        assert!(
            format!("{invalid_req:?}").contains("[redacted]"),
            "InvalidRequest Debug must show [redacted] in place of message"
        );
    }

    #[test]
    fn maps_http_status_codes_to_safe_errors() {
        assert_eq!(JiraApiError::from_status(400, None), JiraApiError::BadRequest);
        assert_eq!(JiraApiError::from_status(401, None), JiraApiError::Unauthorized);
        assert_eq!(JiraApiError::from_status(403, None), JiraApiError::Forbidden);
        assert_eq!(JiraApiError::from_status(404, None), JiraApiError::NotFound);
        assert_eq!(
            JiraApiError::from_status(429, Some(15)),
            JiraApiError::RateLimited {
                retry_after_seconds: Some(15)
            }
        );
        assert_eq!(
            JiraApiError::from_status(500, None),
            JiraApiError::Server { status: 500 }
        );
        assert_eq!(
            JiraApiError::from_status(599, None),
            JiraApiError::Server { status: 599 }
        );
    }

    #[test]
    fn retry_classification_matches_spec() {
        assert!(!JiraApiError::Unauthorized.is_retryable());
        assert!(!JiraApiError::Forbidden.is_retryable());
        assert!(!JiraApiError::NotFound.is_retryable());
        assert!(!JiraApiError::BadRequest.is_retryable());
        assert!(JiraApiError::RateLimited {
            retry_after_seconds: Some(1)
        }
        .is_retryable());
        assert!(JiraApiError::Server { status: 503 }.is_retryable());
        assert!(JiraApiError::Network.is_retryable());
        assert!(!JiraApiError::Decode.is_retryable());
    }

    #[test]
    fn safe_write_error_variants_are_correct() {
        assert_eq!(JiraApiError::from_status(409, None), JiraApiError::Conflict);
        let unsafe_error = JiraApiError::UnsafeWriteUnknownOutcome;
        assert_eq!(format!("{unsafe_error}"), "Jira write outcome is unknown; not retrying to avoid duplicate changes");
        assert!(!format!("{unsafe_error:?}").to_ascii_lowercase().contains("authorization"));
        assert!(!JiraApiError::Conflict.is_retryable());
        assert!(!JiraApiError::UnsafeWriteUnknownOutcome.is_retryable());
    }
}
