use rusqlite::Connection;

use crate::audit::entry::{AuditLogAppendInput, AuditLogEntry};
use crate::audit::repository;
use crate::mutations::errors::MutationError;
use crate::mutations::inputs::{
    audit_state, source_feature_or_manual, target_ref, JiraAddCommentInput,
};
use crate::mutations::jira_client::JiraMutationClient;
use crate::mutations::registry::{action_metadata, batch_or_new, new_audit_id, JIRA_ADD_COMMENT};

pub fn execute_jira_add_comment<C: JiraMutationClient + ?Sized>(
    conn: &Connection,
    client: &C,
    input: JiraAddCommentInput,
) -> Result<AuditLogEntry, MutationError> {
    let issue_key = input.common.issue_key.trim().to_string();
    if issue_key.is_empty() {
        return Err(MutationError::InvalidInput("issue_key is required".into()));
    }
    if input.body.trim().is_empty() {
        return Err(MutationError::InvalidInput("comment body is required".into()));
    }

    let created = client
        .create_comment(&issue_key, &input.body)
        .map_err(|e| MutationError::Jira(e.to_string()))?;

    let batch_id = batch_or_new(input.common.batch_id);
    let meta = action_metadata(JIRA_ADD_COMMENT).unwrap();

    repository::append_entry(
        conn,
        AuditLogAppendInput {
            id: Some(new_audit_id()),
            batch_id,
            action_id: JIRA_ADD_COMMENT.to_string(),
            target_ref: target_ref(&issue_key),
            before_state: audit_state(serde_json::json!({})),
            after_state: audit_state(serde_json::json!({"comment_id": created.id})),
            reversible: meta.reversible,
            created_at: None,
            source_feature: source_feature_or_manual(input.common.source_feature),
        },
    )
    .map_err(|_| MutationError::AuditWriteFailedAfterRemoteMutation)
}

#[tauri::command]
#[specta::specta]
pub fn jira_add_comment(
    input: JiraAddCommentInput,
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
    app: tauri::AppHandle,
) -> Result<AuditLogEntry, String> {
    use crate::mutations::jira_client::resolve_real_client;
    let conn = db.lock().map_err(|e| e.to_string())?;
    let client = resolve_real_client(&conn, &app, &input.common.source_id)
        .map_err(|e| e.to_string())?;
    execute_jira_add_comment(&conn, &*client, input).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::mutations::inputs::MutationCommonInput;
    use crate::mutations::tests::RecordingJiraClient;

    #[test]
    fn add_comment_records_call_and_audit_entry() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();
        let input = JiraAddCommentInput {
            common: MutationCommonInput {
                source_id: "src_1".to_string(),
                issue_key: "AMP-1043".to_string(),
                source_feature: Some("test".to_string()),
                batch_id: None,
            },
            body: "Please add context".to_string(),
        };
        let entry = execute_jira_add_comment(&conn, &client, input).unwrap();

        let calls = client.calls.lock().unwrap().clone();
        assert_eq!(calls, vec!["comment:AMP-1043:Please add context"]);

        assert_eq!(entry.action_id, "jira-add-comment");
        assert!(!entry.reversible);
        assert_eq!(entry.after_state.value()["comment_id"], "comment_1");
        assert!(entry.before_state.value().as_object().unwrap().is_empty());
    }

    #[test]
    fn add_comment_empty_body_returns_invalid_input() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();
        let err = execute_jira_add_comment(&conn, &client, JiraAddCommentInput {
            common: MutationCommonInput {
                source_id: "src_1".to_string(),
                issue_key: "AMP-1043".to_string(),
                source_feature: None,
                batch_id: None,
            },
            body: "  ".to_string(),
        }).unwrap_err();
        assert!(matches!(err, MutationError::InvalidInput(_)));
    }
}
