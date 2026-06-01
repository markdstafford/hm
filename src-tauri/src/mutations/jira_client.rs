use crate::mutations::errors::MutationError;
use crate::sources::jira_errors::JiraApiError;
use crate::sources::jira_types::{
    JiraCreatedComment, JiraCreatedIssueLink, JiraTransitionsResponse,
};

pub trait JiraMutationClient: Send + Sync {
    fn list_transitions(&self, issue_key: &str) -> Result<JiraTransitionsResponse, JiraApiError>;
    fn transition_issue(
        &self,
        issue_key: &str,
        transition_id: &str,
        comment: Option<&str>,
    ) -> Result<(), JiraApiError>;
    fn update_issue_fields(
        &self,
        issue_key: &str,
        fields_payload: serde_json::Value,
    ) -> Result<(), JiraApiError>;
    fn create_comment(
        &self,
        issue_key: &str,
        body: &str,
    ) -> Result<JiraCreatedComment, JiraApiError>;
    fn create_issue_link(
        &self,
        source_key: &str,
        target_key: &str,
        link_type: &str,
    ) -> Result<JiraCreatedIssueLink, JiraApiError>;
    fn delete_issue_link(&self, link_id: &str) -> Result<(), JiraApiError>;
}

impl JiraMutationClient for crate::sources::jira_client::JiraApiClient {
    fn list_transitions(&self, issue_key: &str) -> Result<JiraTransitionsResponse, JiraApiError> {
        self.list_transitions(issue_key)
    }
    fn transition_issue(
        &self,
        issue_key: &str,
        transition_id: &str,
        comment: Option<&str>,
    ) -> Result<(), JiraApiError> {
        self.transition_issue(issue_key, transition_id, comment)
    }
    fn update_issue_fields(
        &self,
        issue_key: &str,
        fields_payload: serde_json::Value,
    ) -> Result<(), JiraApiError> {
        self.update_issue_fields(issue_key, fields_payload)
    }
    fn create_comment(
        &self,
        issue_key: &str,
        body: &str,
    ) -> Result<JiraCreatedComment, JiraApiError> {
        self.create_comment(issue_key, body)
    }
    fn create_issue_link(
        &self,
        source_key: &str,
        target_key: &str,
        link_type: &str,
    ) -> Result<JiraCreatedIssueLink, JiraApiError> {
        self.create_issue_link(source_key, target_key, link_type)
    }
    fn delete_issue_link(&self, link_id: &str) -> Result<(), JiraApiError> {
        self.delete_issue_link(link_id)
    }
}

/// Resolve a Jira client using an injected secret store. Testable without a Tauri AppHandle.
pub fn resolve_client_with_store(
    conn: &rusqlite::Connection,
    source_id: &str,
    store: &dyn crate::settings::secrets::SecretStore,
) -> Result<Box<dyn JiraMutationClient>, MutationError> {
    use crate::sources::config::{load_sources_config, JiraAuthConfig, SourceConfig};
    use crate::sources::credentials::load_source_credential_secret;
    use crate::sources::jira_client::{
        JiraApiClient, JiraApiClientConfig, RateLimitPolicy, RetryPolicy,
    };

    let sources_config = load_sources_config(conn)
        .map_err(|_| MutationError::SourceNotFound(source_id.to_string()))?;

    let jira_source = sources_config
        .sources
        .into_iter()
        .find_map(|s| match s {
            SourceConfig::Jira(j) if j.id == source_id => Some(j),
            _ => None,
        })
        .ok_or_else(|| MutationError::SourceNotFound(source_id.to_string()))?;

    let credential_ref = match &jira_source.auth {
        JiraAuthConfig::Pat { credential_ref } => credential_ref.clone(),
    };

    let pat = load_source_credential_secret(&credential_ref, store)
        .map_err(|_| MutationError::CredentialMissing(source_id.to_string()))?
        .expose_for_jira_client()
        .to_string();

    let client = JiraApiClient::new(JiraApiClientConfig {
        base_url: jira_source.server_url,
        pat,
        user_agent: format!("hm/{}", env!("CARGO_PKG_VERSION")),
        retry_policy: RetryPolicy::default(),
        rate_limit_policy: RateLimitPolicy::default(),
    })
    .map_err(|e| MutationError::InvalidInput(e.to_string()))?;

    Ok(Box::new(client))
}

/// Resolve the real Jira client for a given source_id using the app's managed secret store.
pub fn resolve_real_client(
    conn: &rusqlite::Connection,
    app: &tauri::AppHandle,
    source_id: &str,
) -> Result<Box<dyn JiraMutationClient>, MutationError> {
    use tauri::Manager;
    let store = app.state::<crate::settings::secrets::ManagedSecretStore>();
    resolve_client_with_store(conn, source_id, &*store.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::settings::secrets::InMemorySecretStore;
    use crate::sources::config::{
        save_sources_config, JiraAuthConfig, JiraSourceConfig, SourceConfig, SourcesConfig,
    };

    fn make_jira_source(id: &str) -> JiraSourceConfig {
        JiraSourceConfig {
            id: id.to_string(),
            name: "Test Jira".into(),
            enabled: true,
            server_url: "https://jira.example.invalid".into(),
            auth: JiraAuthConfig::Pat {
                credential_ref: format!("source.jira.{id}.pat"),
            },
            projects: vec![],
            last_connection_test: None,
            created_at: "2024-01-01T00:00:00Z".into(),
            updated_at: "2024-01-01T00:00:00Z".into(),
        }
    }

    #[test]
    fn resolve_client_source_not_found() {
        let conn = open_in_memory().expect("open in-memory db");
        let store = InMemorySecretStore::new();
        let result = resolve_client_with_store(&conn, "missing_id", &store);
        assert!(
            matches!(result, Err(MutationError::SourceNotFound(_))),
            "expected SourceNotFound"
        );
    }

    #[test]
    fn resolve_client_credential_missing() {
        let conn = open_in_memory().expect("open in-memory db");
        let store = InMemorySecretStore::new();

        let config = SourcesConfig {
            version: 1,
            sources: vec![SourceConfig::Jira(make_jira_source("src_test"))],
        };
        save_sources_config(&conn, &config).expect("save sources config");

        let result = resolve_client_with_store(&conn, "src_test", &store);
        assert!(
            matches!(result, Err(MutationError::CredentialMissing(_))),
            "expected CredentialMissing"
        );
    }
}
