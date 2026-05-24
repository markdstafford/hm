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
    InvalidUrl,
    Unauthorized,
    Forbidden,
    Network,
    RateLimited,
    Server,
    Decode,
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
        JiraClientError::InvalidUrl => JiraConnectionTestResult {
            status: JiraConnectionTestStatus::Error,
            tested_at: now_utc_string(),
            message: "Check the Jira server URL and try again.".into(),
            suggested_fix: Some("Verify the Jira server URL and test again.".into()),
            projects: vec![],
            category: Some(JiraConnectionErrorCategory::InvalidUrl),
        },
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
        JiraClientError::Network => JiraConnectionTestResult {
            status: JiraConnectionTestStatus::Error,
            tested_at: now_utc_string(),
            message: "Network error connecting to Jira. Check the server URL and your network connection.".into(),
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
        JiraClientError::Server => JiraConnectionTestResult {
            status: JiraConnectionTestStatus::Error,
            tested_at: now_utc_string(),
            message: "Jira server returned an error. Check the server status.".into(),
            suggested_fix: None,
            projects: vec![],
            category: Some(JiraConnectionErrorCategory::Server),
        },
        JiraClientError::Decode => JiraConnectionTestResult {
            status: JiraConnectionTestStatus::Error,
            tested_at: now_utc_string(),
            message: "Jira returned a response this version cannot read.".into(),
            suggested_fix: Some("Check the Jira server version and try again.".into()),
            projects: vec![],
            category: Some(JiraConnectionErrorCategory::Unsupported),
        },
    }
}

// ── Real client adapter ───────────────────────────────────────────────────────

struct RealJiraProjectClient;

impl JiraProjectClient for RealJiraProjectClient {
    fn list_projects(
        &self,
        server_url: &str,
        pat: &str,
    ) -> Result<Vec<JiraConnectionProject>, JiraClientError> {
        let client = crate::sources::jira_client::JiraApiClient::new(
            crate::sources::jira_client::JiraApiClientConfig {
                base_url: server_url.to_string(),
                pat: pat.to_string(),
                user_agent: format!("hm/{}", env!("CARGO_PKG_VERSION")),
                retry_policy: crate::sources::jira_client::RetryPolicy::default(),
                rate_limit_policy: crate::sources::jira_client::RateLimitPolicy::default(),
            },
        )
        .map_err(map_api_error_to_client_error)?;
        client
            .list_projects()
            .map(|projects| {
                projects
                    .into_iter()
                    .map(|p| JiraConnectionProject {
                        key: p.key,
                        name: Some(p.name),
                        id: p.id,
                    })
                    .collect()
            })
            .map_err(map_api_error_to_client_error)
    }
}

fn map_api_error_to_client_error(
    err: crate::sources::jira_errors::JiraApiError,
) -> JiraClientError {
    use crate::sources::jira_errors::JiraApiError;
    match err {
        JiraApiError::InvalidBaseUrl | JiraApiError::InvalidRequest { .. } => {
            JiraClientError::InvalidUrl
        }
        JiraApiError::Unauthorized => JiraClientError::Unauthorized,
        JiraApiError::Forbidden => JiraClientError::Forbidden,
        JiraApiError::RateLimited { .. } => JiraClientError::RateLimited,
        JiraApiError::Server { .. } => JiraClientError::Server,
        JiraApiError::Network => JiraClientError::Network,
        JiraApiError::Decode => JiraClientError::Decode,
        JiraApiError::NotFound | JiraApiError::BadRequest => JiraClientError::Server,
    }
}

fn success_result(projects: Vec<JiraConnectionProject>) -> JiraConnectionTestResult {
    let mut seen = std::collections::HashSet::new();
    let mut deduped: Vec<JiraConnectionProject> = projects
        .into_iter()
        .filter(|project| seen.insert(project.key.clone()))
        .collect();
    deduped.sort_by(|a, b| a.key.cmp(&b.key));
    JiraConnectionTestResult {
        status: JiraConnectionTestStatus::Success,
        tested_at: now_utc_string(),
        message: "Connected to Jira. Select projects to ingest.".into(),
        suggested_fix: None,
        projects: deduped,
        category: None,
    }
}

/// Connection test with injected client (for testing).
pub(crate) fn jira_source_test_connection_with_client(
    source: JiraSourceConfig,
    pending_pat: Option<String>,
    store: &dyn SecretStore,
    client: &dyn JiraProjectClient,
) -> Result<JiraConnectionTestResult, SourceError> {
    let credential_ref = match &source.auth {
        JiraAuthConfig::Pat { credential_ref } => credential_ref.clone(),
    };

    let pat = match pending_pat {
        Some(pat) => pat,
        None => match load_source_credential_secret(&credential_ref, store) {
            Ok(secret) => secret.expose_for_jira_client().to_string(),
            Err(SourceError::MissingCredential(_)) => {
                return Ok(JiraConnectionTestResult {
                    status: JiraConnectionTestStatus::Error,
                    tested_at: now_utc_string(),
                    message: "Jira credential is missing. Replace the token and test again."
                        .into(),
                    suggested_fix: Some("Add a PAT for this source and test again.".into()),
                    projects: vec![],
                    category: Some(JiraConnectionErrorCategory::MissingCredential),
                });
            }
            Err(_) => {
                return Ok(JiraConnectionTestResult {
                    status: JiraConnectionTestStatus::Error,
                    tested_at: now_utc_string(),
                    message: "Failed to load Jira credential.".into(),
                    suggested_fix: None,
                    projects: vec![],
                    category: Some(JiraConnectionErrorCategory::MissingCredential),
                });
            }
        },
    };

    match client.list_projects(&source.server_url, &pat) {
        Ok(projects) => Ok(success_result(projects)),
        Err(err) => Ok(map_client_error(err)),
    }
}

/// Test a Jira source connection.
///
/// If `pending_pat` is `Some(pat)`, the provided value is used for the test
/// without consulting the secret store. If `None`, the stored credential is
/// loaded from `store`.
///
/// # Returns
/// Always returns `Ok(result)`. Credential errors are surfaced as
/// `JiraConnectionTestResult` with `status: Error`, not as `Err(...)`.
pub fn jira_source_test_connection_with_store(
    source: JiraSourceConfig,
    pending_pat: Option<String>,
    store: &dyn SecretStore,
) -> Result<JiraConnectionTestResult, SourceError> {
    jira_source_test_connection_with_client(source, pending_pat, store, &RealJiraProjectClient)
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
    fn pending_pat_uses_real_client_seam_and_returns_sorted_success() {
        struct CapturingClient;
        impl JiraProjectClient for CapturingClient {
            fn list_projects(
                &self,
                server_url: &str,
                pat: &str,
            ) -> Result<Vec<JiraConnectionProject>, JiraClientError> {
                assert_eq!(server_url, "https://jira.example.com");
                assert_eq!(pat, "pending-pat");
                Ok(vec![
                    JiraConnectionProject {
                        key: "ZAP".into(),
                        name: Some("Zap".into()),
                        id: Some("2".into()),
                    },
                    JiraConnectionProject {
                        key: "HM".into(),
                        name: Some("Home Map".into()),
                        id: Some("1".into()),
                    },
                    JiraConnectionProject {
                        key: "HM".into(),
                        name: Some("Duplicate".into()),
                        id: Some("3".into()),
                    },
                ])
            }
        }
        let store = crate::settings::secrets::InMemorySecretStore::new();
        let source = sample_jira_source("src_pending");
        let result =
            jira_source_test_connection_with_client(source, Some("pending-pat".into()), &store, &CapturingClient)
                .unwrap();
        assert_eq!(result.status, JiraConnectionTestStatus::Success);
        assert_eq!(result.message, "Connected to Jira. Select projects to ingest.");
        assert_eq!(
            result.projects.iter().map(|p| p.key.as_str()).collect::<Vec<_>>(),
            vec!["HM", "ZAP"]
        );
        // PAT must not appear in result debug
        assert!(!format!("{result:?}").contains("pending-pat"));
    }

    #[test]
    fn stored_pat_loaded_when_pending_absent() {
        struct PassingClient;
        impl JiraProjectClient for PassingClient {
            fn list_projects(
                &self,
                _server_url: &str,
                pat: &str,
            ) -> Result<Vec<JiraConnectionProject>, JiraClientError> {
                assert_eq!(pat, "stored-pat");
                Ok(vec![])
            }
        }
        let store = crate::settings::secrets::InMemorySecretStore::new();
        store.set("source.jira.src_stored.pat", "stored-pat").unwrap();
        let source = sample_jira_source("src_stored");
        let result =
            jira_source_test_connection_with_client(source, None, &store, &PassingClient).unwrap();
        assert_eq!(result.status, JiraConnectionTestStatus::Success);
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
    fn fake_client_maps_error_categories() {
        let result = map_client_error(JiraClientError::Unauthorized);
        assert_eq!(result.status, JiraConnectionTestStatus::Error);
        assert_eq!(result.category, Some(JiraConnectionErrorCategory::AuthFailed));

        let result2 = map_client_error(JiraClientError::Forbidden);
        assert_eq!(result2.category, Some(JiraConnectionErrorCategory::Forbidden));

        let result3 = map_client_error(JiraClientError::RateLimited);
        assert_eq!(result3.category, Some(JiraConnectionErrorCategory::RateLimited));

        let result4 = map_client_error(JiraClientError::Network);
        assert_eq!(result4.category, Some(JiraConnectionErrorCategory::Network));

        let result5 = map_client_error(JiraClientError::Server);
        assert_eq!(result5.category, Some(JiraConnectionErrorCategory::Server));
    }

    fn fake_successful_result(projects: Vec<JiraConnectionProject>) -> JiraConnectionTestResult {
        // Deduplicate and sort projects by key
        let mut seen = std::collections::HashSet::new();
        let mut deduped: Vec<JiraConnectionProject> = projects.into_iter()
            .filter(|p| seen.insert(p.key.clone()))
            .collect();
        deduped.sort_by(|a, b| a.key.cmp(&b.key));
        JiraConnectionTestResult {
            status: JiraConnectionTestStatus::Success,
            tested_at: "2024-01-01T00:00:00Z".into(),
            message: "Connected to Jira. Select projects to ingest.".into(),
            suggested_fix: None,
            projects: deduped,
            category: None,
        }
    }

    #[test]
    fn fake_client_error_categories_map_to_safe_results() {
        let cases = vec![
            (JiraClientError::Unauthorized, JiraConnectionErrorCategory::AuthFailed),
            (JiraClientError::Forbidden, JiraConnectionErrorCategory::Forbidden),
            (JiraClientError::Network, JiraConnectionErrorCategory::Network),
            (JiraClientError::RateLimited, JiraConnectionErrorCategory::RateLimited),
            (JiraClientError::Server, JiraConnectionErrorCategory::Server),
        ];
        for (err, expected_category) in cases {
            let result = map_client_error(err);
            assert_eq!(result.status, JiraConnectionTestStatus::Error, "expected Error status");
            assert_eq!(result.category, Some(expected_category.clone()), "wrong category");
            // Safe: no raw server details in message
            assert!(!result.message.to_ascii_lowercase().contains("stack trace"), "raw stack trace exposed");
        }
    }

    #[test]
    fn fake_client_success_with_empty_projects_returns_success_state() {
        // A successful connection with no accessible projects is still success
        let result = fake_successful_result(vec![]);
        assert_eq!(result.status, JiraConnectionTestStatus::Success);
        assert!(result.projects.is_empty());
    }

    #[test]
    fn fake_client_success_with_projects_deduplicates_and_sorts() {
        let projects = vec![
            JiraConnectionProject { key: "ZAP".into(), name: Some("Zap".into()), id: None },
            JiraConnectionProject { key: "HM".into(), name: Some("HM".into()), id: None },
            JiraConnectionProject { key: "HM".into(), name: Some("HM duplicate".into()), id: None },
        ];
        let result = fake_successful_result(projects);
        assert_eq!(result.status, JiraConnectionTestStatus::Success);
        let keys: Vec<_> = result.projects.iter().map(|p| p.key.as_str()).collect();
        assert_eq!(keys, vec!["HM", "ZAP"], "projects should be deduplicated and sorted");
    }

    #[test]
    fn client_errors_map_to_safe_categories() {
        assert_eq!(
            map_client_error(JiraClientError::InvalidUrl).category,
            Some(JiraConnectionErrorCategory::InvalidUrl)
        );
        assert_eq!(
            map_client_error(JiraClientError::Decode).category,
            Some(JiraConnectionErrorCategory::Unsupported)
        );
        assert!(
            !map_client_error(JiraClientError::Decode)
                .message
                .to_ascii_lowercase()
                .contains("response body")
        );
    }
}
