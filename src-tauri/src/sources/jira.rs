use serde::{Deserialize, Serialize};
use specta::Type;
use crate::sources::config::{JiraSourceConfig, JiraAuthConfig};
use crate::sources::credentials::{load_source_credential_secret};
use crate::sources::errors::SourceError;
use crate::settings::secrets::SecretStore;

// ── Connection test result types ──────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub enum JiraConnectionTestStatus {
    NotTested,
    Testing,
    Success,
    Error,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub enum JiraConnectionErrorCategory {
    InvalidUrl,
    AuthFailed,
    Forbidden,
    Network,
    RateLimited,
    Server,
    Unsupported,
    Unavailable,
    MissingCredential,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct JiraConnectionProject {
    pub key: String,
    pub name: Option<String>,
    pub id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct JiraConnectionTestResult {
    pub status: JiraConnectionTestStatus,
    pub tested_at: String,
    pub message: String,
    pub suggested_fix: Option<String>,
    pub projects: Vec<JiraConnectionProject>,
    pub category: Option<JiraConnectionErrorCategory>,
}

// ── Internal Jira client trait seam ──────────────────────────────────────────

pub(crate) enum JiraClientError {
    Unauthorized,
    Forbidden,
    Network(String),
    RateLimited,
    Server(String),
}

pub(crate) trait JiraProjectClient {
    fn list_projects(
        &self,
        server_url: &str,
        pat: &str,
    ) -> Result<Vec<JiraConnectionProject>, JiraClientError>;
}

// ── Helper: map client errors to result shapes ────────────────────────────────

pub(crate) fn map_client_error(err: JiraClientError) -> JiraConnectionTestResult {
    match err {
        JiraClientError::Unauthorized => JiraConnectionTestResult {
            status: JiraConnectionTestStatus::Error,
            tested_at: now_utc_string(),
            message: "Authentication failed. Check that the PAT is valid and has not expired.".into(),
            suggested_fix: Some("Replace the token and test again.".into()),
            projects: vec![],
            category: Some(JiraConnectionErrorCategory::AuthFailed),
        },
        JiraClientError::Forbidden => JiraConnectionTestResult {
            status: JiraConnectionTestStatus::Error,
            tested_at: now_utc_string(),
            message: "Access denied. The PAT does not have permission to list projects.".into(),
            suggested_fix: Some("Check the token's permissions in Jira.".into()),
            projects: vec![],
            category: Some(JiraConnectionErrorCategory::Forbidden),
        },
        JiraClientError::Network(msg) => JiraConnectionTestResult {
            status: JiraConnectionTestStatus::Error,
            tested_at: now_utc_string(),
            message: format!("Network error: {msg}"),
            suggested_fix: Some("Check the server URL and your network connection.".into()),
            projects: vec![],
            category: Some(JiraConnectionErrorCategory::Network),
        },
        JiraClientError::RateLimited => JiraConnectionTestResult {
            status: JiraConnectionTestStatus::Error,
            tested_at: now_utc_string(),
            message: "Request was rate limited by the Jira server.".into(),
            suggested_fix: Some("Wait a moment and try again.".into()),
            projects: vec![],
            category: Some(JiraConnectionErrorCategory::RateLimited),
        },
        JiraClientError::Server(msg) => JiraConnectionTestResult {
            status: JiraConnectionTestStatus::Error,
            tested_at: now_utc_string(),
            message: format!("Jira server error: {msg}"),
            suggested_fix: None,
            projects: vec![],
            category: Some(JiraConnectionErrorCategory::Server),
        },
    }
}

// ── Adapter: connection test ──────────────────────────────────────────────────

/// Test a Jira source connection.
///
/// If `pending_pat` is `Some(pat)`, the provided value is used for the test
/// without consulting the secret store. If `None`, the stored credential is
/// loaded from `store`.
///
/// This is the unavailable adapter: the Jira API client does not exist yet
/// (see issue #9). The function validates credentials but always returns
/// `Unavailable` rather than making a live network call.
///
/// # Returns
/// Always returns `Ok(result)`. Credential errors are surfaced as
/// `JiraConnectionTestResult` with `status: Error`, not as `Err(...)`.
pub fn jira_source_test_connection_with_store(
    source: JiraSourceConfig,
    pending_pat: Option<String>,
    store: &dyn SecretStore,
) -> Result<JiraConnectionTestResult, SourceError> {
    // Resolve the credential ref from the source auth config.
    let credential_ref = match &source.auth {
        JiraAuthConfig::Pat { credential_ref } => credential_ref.clone(),
    };

    // When no pending PAT is provided, try to load the saved credential.
    // Missing credential → return an error result (not a Rust Err).
    if pending_pat.is_none() {
        match load_source_credential_secret(&credential_ref, store) {
            Ok(_) => {
                // Credential exists — fall through to Unavailable result below.
            }
            Err(SourceError::MissingCredential(_)) => {
                return Ok(JiraConnectionTestResult {
                    status: JiraConnectionTestStatus::Error,
                    tested_at: now_utc_string(),
                    message: "Jira credential is missing. Replace the token and test again.".into(),
                    suggested_fix: Some("Add a PAT for this source and test again.".into()),
                    projects: vec![],
                    category: Some(JiraConnectionErrorCategory::MissingCredential),
                });
            }
            Err(_other) => {
                return Ok(JiraConnectionTestResult {
                    status: JiraConnectionTestStatus::Error,
                    tested_at: now_utc_string(),
                    message: "Failed to load Jira credential.".into(),
                    suggested_fix: None,
                    projects: vec![],
                    category: Some(JiraConnectionErrorCategory::MissingCredential),
                });
            }
        }
    }

    // Either we have a pending PAT, or the stored credential is valid.
    // Either way, live testing depends on the Jira client (issue #9).
    Ok(JiraConnectionTestResult {
        status: JiraConnectionTestStatus::Unavailable,
        tested_at: now_utc_string(),
        message: "Live connection testing depends on issue #9. The source can be saved, but projects must wait for the Jira API client.".into(),
        suggested_fix: None,
        projects: vec![],
        category: Some(JiraConnectionErrorCategory::Unavailable),
    })
}

// ── Utility ───────────────────────────────────────────────────────────────────

fn now_utc_string() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // Simple ISO 8601-ish: epoch seconds as decimal. Sufficient for non-empty tested_at.
    format!("{secs}")
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_jira_source(id: &str) -> crate::sources::config::JiraSourceConfig {
        crate::sources::config::JiraSourceConfig {
            id: id.to_string(),
            name: "Test Jira".into(),
            enabled: true,
            server_url: "https://jira.example.com".into(),
            auth: crate::sources::config::JiraAuthConfig::Pat {
                credential_ref: format!("source.jira.{id}.pat"),
            },
            projects: vec![],
            last_connection_test: None,
            created_at: "2024-01-01T00:00:00Z".into(),
            updated_at: "2024-01-01T00:00:00Z".into(),
        }
    }

    #[test]
    fn returns_unavailable_before_jira_client_exists() {
        let store = crate::settings::secrets::InMemorySecretStore::new();
        let source = sample_jira_source("src_unavailable");
        let result = jira_source_test_connection_with_store(source, Some("pending-pat".into()), &store).unwrap();
        assert_eq!(result.status, JiraConnectionTestStatus::Unavailable);
        assert!(result.message.contains("issue #9"));
        assert!(result.projects.is_empty());
        assert!(!format!("{result:?}").contains("pending-pat"));
    }

    #[test]
    fn missing_saved_pat_returns_safe_error_result() {
        let store = crate::settings::secrets::InMemorySecretStore::new();
        let source = sample_jira_source("src_missing_pat");
        let result = jira_source_test_connection_with_store(source, None, &store).unwrap();
        assert_eq!(result.status, JiraConnectionTestStatus::Error);
        assert!(result.message.contains("credential"), "got: {}", result.message);
        assert!(!result.message.contains("source.jira.src_missing_pat.pat"));
    }

    #[test]
    fn stored_pat_with_no_pending_returns_unavailable() {
        let store = crate::settings::secrets::InMemorySecretStore::new();
        store.set("source.jira.src_stored.pat", "my-saved-pat").unwrap();
        let source = sample_jira_source("src_stored");
        let result = jira_source_test_connection_with_store(source, None, &store).unwrap();
        assert_eq!(result.status, JiraConnectionTestStatus::Unavailable);
        assert!(result.message.contains("issue #9"));
        assert!(!format!("{result:?}").contains("my-saved-pat"));
    }

    #[test]
    fn fake_client_maps_error_categories() {
        struct FailingClient(JiraClientError);
        impl JiraProjectClient for FailingClient {
            fn list_projects(&self, _url: &str, _pat: &str) -> Result<Vec<JiraConnectionProject>, JiraClientError> {
                Err(JiraClientError::Unauthorized)
            }
        }
        let result = map_client_error(JiraClientError::Unauthorized);
        assert_eq!(result.status, JiraConnectionTestStatus::Error);
        assert_eq!(result.category, Some(JiraConnectionErrorCategory::AuthFailed));

        let result2 = map_client_error(JiraClientError::Forbidden);
        assert_eq!(result2.category, Some(JiraConnectionErrorCategory::Forbidden));

        let result3 = map_client_error(JiraClientError::RateLimited);
        assert_eq!(result3.category, Some(JiraConnectionErrorCategory::RateLimited));

        let result4 = map_client_error(JiraClientError::Network("timeout".into()));
        assert_eq!(result4.category, Some(JiraConnectionErrorCategory::Network));

        let result5 = map_client_error(JiraClientError::Server("500".into()));
        assert_eq!(result5.category, Some(JiraConnectionErrorCategory::Server));
    }
}
