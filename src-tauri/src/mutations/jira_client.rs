use crate::mutations::errors::MutationError;
use crate::sources::jira_errors::JiraApiError;
use crate::sources::jira_types::{JiraCreatedComment, JiraCreatedIssueLink, JiraTransitionsResponse};

pub trait JiraMutationClient: Send + Sync {
    fn list_transitions(&self, issue_key: &str) -> Result<JiraTransitionsResponse, JiraApiError>;
    fn transition_issue(&self, issue_key: &str, transition_id: &str, comment: Option<&str>) -> Result<(), JiraApiError>;
    fn update_issue_fields(&self, issue_key: &str, fields_payload: serde_json::Value) -> Result<(), JiraApiError>;
    fn create_comment(&self, issue_key: &str, body: &str) -> Result<JiraCreatedComment, JiraApiError>;
    fn create_issue_link(&self, source_key: &str, target_key: &str, link_type: &str) -> Result<JiraCreatedIssueLink, JiraApiError>;
    fn delete_issue_link(&self, link_id: &str) -> Result<(), JiraApiError>;
}

impl JiraMutationClient for crate::sources::jira_client::JiraApiClient {
    fn list_transitions(&self, issue_key: &str) -> Result<JiraTransitionsResponse, JiraApiError> {
        self.list_transitions(issue_key)
    }
    fn transition_issue(&self, issue_key: &str, transition_id: &str, comment: Option<&str>) -> Result<(), JiraApiError> {
        self.transition_issue(issue_key, transition_id, comment)
    }
    fn update_issue_fields(&self, issue_key: &str, fields_payload: serde_json::Value) -> Result<(), JiraApiError> {
        self.update_issue_fields(issue_key, fields_payload)
    }
    fn create_comment(&self, issue_key: &str, body: &str) -> Result<JiraCreatedComment, JiraApiError> {
        self.create_comment(issue_key, body)
    }
    fn create_issue_link(&self, source_key: &str, target_key: &str, link_type: &str) -> Result<JiraCreatedIssueLink, JiraApiError> {
        self.create_issue_link(source_key, target_key, link_type)
    }
    fn delete_issue_link(&self, link_id: &str) -> Result<(), JiraApiError> {
        self.delete_issue_link(link_id)
    }
}

/// Resolve the real Jira client for a given source_id.
/// TODO (Task 11): wire up proper settings/keychain lookup.
pub fn resolve_real_client(
    _conn: &rusqlite::Connection,
    _app: &tauri::AppHandle,
    source_id: &str,
) -> Result<Box<dyn JiraMutationClient>, MutationError> {
    Err(MutationError::SourceNotFound(source_id.to_string()))
}
