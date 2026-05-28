// Cross-cutting mutation tests: batch grouping, redaction, audit failure
// Tests are added in Tasks 7-10 as the mutation commands are implemented.

use std::sync::Mutex;

use crate::sources::jira_errors::JiraApiError;
use crate::sources::jira_types::{
    JiraCreatedComment, JiraCreatedIssueLink, JiraNamedValue, JiraTransition,
    JiraTransitionsResponse,
};
use crate::mutations::jira_client::JiraMutationClient;

pub struct RecordingJiraClient {
    pub calls: Mutex<Vec<String>>,
    pub comment_id: String,
    pub link_id: String,
    /// When true, create_issue_link returns id=None (simulates Jira DC 201 empty-body)
    pub null_link_id: bool,
}

impl Default for RecordingJiraClient {
    fn default() -> Self {
        Self {
            calls: Mutex::new(Vec::new()),
            comment_id: "comment_1".to_string(),
            link_id: "link_1".to_string(),
            null_link_id: false,
        }
    }
}

impl JiraMutationClient for RecordingJiraClient {
    fn list_transitions(&self, issue_key: &str) -> Result<JiraTransitionsResponse, JiraApiError> {
        self.calls
            .lock()
            .unwrap()
            .push(format!("list_transitions:{issue_key}"));
        Ok(JiraTransitionsResponse {
            transitions: vec![
                JiraTransition {
                    id: "31".to_string(),
                    name: "Done".to_string(),
                    to: Some(JiraNamedValue {
                        id: Some("10003".to_string()),
                        name: Some("Done".to_string()),
                    }),
                    has_screen: Some(false),
                },
                JiraTransition {
                    id: "11".to_string(),
                    name: "Open".to_string(),
                    to: Some(JiraNamedValue {
                        id: Some("10000".to_string()),
                        name: Some("Open".to_string()),
                    }),
                    has_screen: Some(false),
                },
            ],
        })
    }

    fn transition_issue(
        &self,
        issue_key: &str,
        transition_id: &str,
        comment: Option<&str>,
    ) -> Result<(), JiraApiError> {
        self.calls.lock().unwrap().push(format!(
            "transition:{}:{}:{}",
            issue_key,
            transition_id,
            comment.unwrap_or("")
        ));
        Ok(())
    }

    fn update_issue_fields(
        &self,
        issue_key: &str,
        fields_payload: serde_json::Value,
    ) -> Result<(), JiraApiError> {
        self.calls
            .lock()
            .unwrap()
            .push(format!("update:{}:{}", issue_key, fields_payload));
        Ok(())
    }

    fn create_comment(
        &self,
        issue_key: &str,
        body: &str,
    ) -> Result<JiraCreatedComment, JiraApiError> {
        self.calls
            .lock()
            .unwrap()
            .push(format!("comment:{}:{}", issue_key, body));
        Ok(JiraCreatedComment {
            id: self.comment_id.clone(),
            self_url: None,
        })
    }

    fn create_issue_link(
        &self,
        source_key: &str,
        target_key: &str,
        link_type: &str,
    ) -> Result<JiraCreatedIssueLink, JiraApiError> {
        self.calls.lock().unwrap().push(format!(
            "link:{}:{}:{}",
            source_key, target_key, link_type
        ));
        let id = if self.null_link_id { None } else { Some(self.link_id.clone()) };
        Ok(JiraCreatedIssueLink {
            id,
            self_url: None,
        })
    }

    fn delete_issue_link(&self, link_id: &str) -> Result<(), JiraApiError> {
        self.calls
            .lock()
            .unwrap()
            .push(format!("delete_link:{link_id}"));
        Ok(())
    }
}

#[cfg(test)]
mod cross_cutting_tests {
    use crate::audit::entry::{AuditLogListFilter, AuditState};
    use crate::audit::repository::list_entries;
    use crate::db::open_in_memory;
    use crate::mutations::errors::MutationError;
    use crate::mutations::inputs::{MutationCommonInput, JiraUpdateTitleInput};
    use crate::mutations::jira_update_title::execute_jira_update_title;

    use super::RecordingJiraClient;

    fn make_title_input(issue_key: &str, batch_id: Option<&str>) -> JiraUpdateTitleInput {
        JiraUpdateTitleInput {
            common: MutationCommonInput {
                source_id: "src_1".to_string(),
                issue_key: issue_key.to_string(),
                source_feature: Some("test".to_string()),
                batch_id: batch_id.map(str::to_string),
            },
            before_title: "Old".to_string(),
            after_title: "New".to_string(),
        }
    }

    #[test]
    fn audit_write_failure_after_jira_success_returns_specific_error() {
        // Open with schema then DROP the table to simulate audit persistence failure
        let conn = open_in_memory().unwrap();
        conn.execute_batch("DROP TABLE IF EXISTS audit_log").unwrap();

        let client = RecordingJiraClient::default();
        let err = execute_jira_update_title(
            &conn,
            &client,
            make_title_input("AMP-1043", None),
        )
        .unwrap_err();

        // Jira was called (one update call)
        assert_eq!(client.calls.lock().unwrap().len(), 1);

        // Error is specific audit failure
        assert!(
            matches!(err, MutationError::AuditWriteFailedAfterRemoteMutation),
            "expected AuditWriteFailedAfterRemoteMutation, got: {err:?}"
        );
        assert_eq!(
            format!("{err}"),
            "Jira mutation may have succeeded, but local audit persistence failed"
        );

        // Debug output must not contain a token-shaped title value
        let debug = format!("{err:?}");
        assert!(!debug.contains("secret-token-shaped-value"), "Debug leaked value: {debug}");
    }

    #[test]
    fn jira_error_display_and_debug_do_not_contain_secrets() {
        let err = MutationError::Jira("Authorization: Bearer secret-token raw body".into());
        let display = format!("{err}");
        let debug = format!("{err:?}");
        assert_eq!(display, "Jira mutation failed", "Display must be fixed safe string");
        assert!(!debug.contains("secret-token"), "Debug must not leak secret-token: {debug}");
        assert!(!debug.to_ascii_lowercase().contains("authorization"), "Debug must not leak Authorization: {debug}");
        assert!(!debug.contains("raw body"), "Debug must not leak raw body: {debug}");
        assert!(debug.contains("[redacted]"), "Debug must show [redacted]: {debug}");
    }

    #[test]
    fn shared_batch_id_groups_multiple_entries() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();
        let batch_id = "batch_shared";

        execute_jira_update_title(&conn, &client, make_title_input("AMP-1", Some(batch_id))).unwrap();
        execute_jira_update_title(&conn, &client, make_title_input("AMP-2", Some(batch_id))).unwrap();
        execute_jira_update_title(&conn, &client, make_title_input("AMP-3", Some(batch_id))).unwrap();

        let entries = list_entries(&conn, AuditLogListFilter {
            batch_id: Some(batch_id.to_string()),
            ..Default::default()
        }).unwrap();

        assert_eq!(entries.len(), 3, "expected 3 entries for shared batch_id");
        assert!(entries.iter().all(|e| e.batch_id == batch_id));
    }

    #[test]
    fn omitted_batch_ids_are_unique_per_mutation() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();

        let entry1 = execute_jira_update_title(&conn, &client, make_title_input("AMP-10", None)).unwrap();
        let entry2 = execute_jira_update_title(&conn, &client, make_title_input("AMP-11", None)).unwrap();

        assert_ne!(entry1.batch_id, entry2.batch_id, "separate calls without batch_id should produce unique batch ids");
    }

    #[test]
    fn audit_state_rejects_non_object_input() {
        // AuditState::new should reject arrays and strings
        let array_result = AuditState::new(serde_json::json!(["not", "object"]));
        assert!(array_result.is_err());
        let string_result = AuditState::new(serde_json::json!("not object"));
        assert!(string_result.is_err());
        // But object is accepted
        let ok = AuditState::new(serde_json::json!({"key": "value"}));
        assert!(ok.is_ok());
    }

    #[test]
    fn mutation_audit_state_does_not_contain_credential_shaped_values() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();

        // Input contains no token-shaped strings — verify audit row doesn't invent any
        let entry = execute_jira_update_title(&conn, &client, JiraUpdateTitleInput {
            common: MutationCommonInput {
                source_id: "src_clean".to_string(),
                issue_key: "AMP-1043".to_string(),
                source_feature: Some("test".to_string()),
                batch_id: None,
            },
            before_title: "Clean before".to_string(),
            after_title: "Clean after".to_string(),
        }).unwrap();

        let before_json = serde_json::to_string(entry.before_state.value()).unwrap();
        let after_json = serde_json::to_string(entry.after_state.value()).unwrap();

        for json in [&before_json, &after_json] {
            assert!(!json.to_ascii_lowercase().contains("authorization"), "audit state contains Authorization: {json}");
            assert!(!json.contains("Bearer "), "audit state contains Bearer token: {json}");
            assert!(!json.contains("credential_ref"), "audit state contains credential_ref: {json}");
        }
    }
}
