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
}

impl Default for RecordingJiraClient {
    fn default() -> Self {
        Self {
            calls: Mutex::new(Vec::new()),
            comment_id: "comment_1".to_string(),
            link_id: "link_1".to_string(),
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
        Ok(JiraCreatedIssueLink {
            id: Some(self.link_id.clone()),
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
