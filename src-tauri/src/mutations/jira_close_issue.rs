use rusqlite::Connection;

use crate::audit::entry::{AuditLogAppendInput, AuditLogEntry};
use crate::audit::repository;
use crate::mutations::errors::MutationError;
use crate::mutations::inputs::{
    audit_state, source_feature_or_manual, target_ref, JiraCloseIssueInput,
    JiraReverseMutationInput,
};
use crate::mutations::jira_client::JiraMutationClient;
use crate::mutations::registry::{action_metadata, batch_or_new, new_audit_id, JIRA_CLOSE_ISSUE};

pub fn execute_jira_close_issue<C: JiraMutationClient + ?Sized>(
    conn: &Connection,
    client: &C,
    input: JiraCloseIssueInput,
) -> Result<AuditLogEntry, MutationError> {
    let issue_key = input.common.issue_key.trim().to_string();
    if issue_key.is_empty() {
        return Err(MutationError::InvalidInput("issue_key is required".into()));
    }
    if input.transition_id.trim().is_empty() {
        return Err(MutationError::InvalidInput(
            "transition_id is required".into(),
        ));
    }

    let transitions = client
        .list_transitions(&issue_key)
        .map_err(|e| MutationError::Jira(e.to_string()))?;
    if !transitions
        .transitions
        .iter()
        .any(|t| t.id == input.transition_id)
    {
        return Err(MutationError::InvalidInput(format!(
            "transition not available: {}",
            input.transition_id
        )));
    }

    client
        .transition_issue(&issue_key, &input.transition_id, input.comment.as_deref())
        .map_err(|e| MutationError::Jira(e.to_string()))?;

    let batch_id = batch_or_new(input.common.batch_id);
    let meta = action_metadata(JIRA_CLOSE_ISSUE).unwrap();

    repository::append_entry(
        conn,
        AuditLogAppendInput {
            id: Some(new_audit_id()),
            batch_id,
            action_id: JIRA_CLOSE_ISSUE.to_string(),
            target_ref: target_ref(&issue_key),
            before_state: audit_state(serde_json::json!({
                "status": input.before_status,
                "inverse_transition_id": input.inverse_transition_id
            })),
            after_state: audit_state(serde_json::json!({
                "status": input.after_status,
                "transition_id": input.transition_id,
                "inverse_transition_id": input.inverse_transition_id
            })),
            reversible: meta.reversible,
            created_at: None,
            source_feature: source_feature_or_manual(input.common.source_feature),
        },
    )
    .map_err(|_| MutationError::AuditWriteFailedAfterRemoteMutation)
}

pub fn execute_jira_close_issue_reverse<C: JiraMutationClient + ?Sized>(
    conn: &Connection,
    client: &C,
    input: JiraReverseMutationInput,
) -> Result<AuditLogEntry, MutationError> {
    let original = repository::get_entry(conn, &input.common.audit_entry_id)
        .map_err(|e| MutationError::Audit(e.to_string()))?;

    let inverse_transition_id = original
        .before_state
        .value()
        .get("inverse_transition_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            MutationError::ReverseUnsupported("inverse transition id is missing".into())
        })?
        .to_string();

    let issue_key = original
        .target_ref
        .strip_prefix("jira:")
        .ok_or_else(|| MutationError::InvalidInput("invalid target_ref format".into()))?
        .to_string();

    let before_status = original
        .before_state
        .value()
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let after_status_original = original
        .after_state
        .value()
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    client
        .transition_issue(&issue_key, &inverse_transition_id, None)
        .map_err(|e| MutationError::Jira(e.to_string()))?;

    let batch_id = batch_or_new(input.common.batch_id);
    let reverse_id = new_audit_id();

    let reverse_entry = repository::append_entry(
        conn,
        AuditLogAppendInput {
            id: Some(reverse_id.clone()),
            batch_id,
            action_id: format!("{JIRA_CLOSE_ISSUE}-reverse"),
            target_ref: original.target_ref.clone(),
            before_state: audit_state(serde_json::json!({"status": after_status_original})),
            after_state: audit_state(serde_json::json!({"status": before_status})),
            reversible: false,
            created_at: None,
            source_feature: source_feature_or_manual(input.common.source_feature),
        },
    )
    .map_err(|_| MutationError::AuditWriteFailedAfterRemoteMutation)?;

    repository::mark_reverted(
        conn,
        crate::audit::entry::AuditLogMarkRevertedInput {
            id: original.id,
            reverted_by_action_id: reverse_id,
            reverted_at: None,
        },
    )
    .map_err(|e| MutationError::Audit(e.to_string()))?;

    Ok(reverse_entry)
}

#[tauri::command]
#[specta::specta]
pub fn jira_close_issue(
    input: JiraCloseIssueInput,
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
    app: tauri::AppHandle,
) -> Result<AuditLogEntry, String> {
    use crate::mutations::jira_client::resolve_real_client;
    let conn = db.lock().map_err(|e| e.to_string())?;
    let client =
        resolve_real_client(&conn, &app, &input.common.source_id).map_err(|e| e.to_string())?;
    execute_jira_close_issue(&conn, &*client, input).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn jira_close_issue_reverse(
    input: JiraReverseMutationInput,
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
    app: tauri::AppHandle,
) -> Result<AuditLogEntry, String> {
    use crate::mutations::jira_client::resolve_real_client;
    let conn = db.lock().map_err(|e| e.to_string())?;
    let client =
        resolve_real_client(&conn, &app, &input.common.source_id).map_err(|e| e.to_string())?;
    execute_jira_close_issue_reverse(&conn, &*client, input).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::mutations::inputs::MutationCommonInput;
    use crate::mutations::tests::RecordingJiraClient;

    fn make_input(
        issue_key: &str,
        transition_id: &str,
        inverse_transition_id: Option<&str>,
        comment: Option<&str>,
    ) -> JiraCloseIssueInput {
        JiraCloseIssueInput {
            common: MutationCommonInput {
                source_id: "src_1".to_string(),
                issue_key: issue_key.to_string(),
                source_feature: Some("test".to_string()),
                batch_id: None,
            },
            transition_id: transition_id.to_string(),
            inverse_transition_id: inverse_transition_id.map(str::to_string),
            before_status: "Open".to_string(),
            after_status: "Done".to_string(),
            comment: comment.map(str::to_string),
        }
    }

    #[test]
    fn close_issue_calls_list_then_transition() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();
        let entry = execute_jira_close_issue(
            &conn,
            &client,
            make_input("AMP-1043", "31", Some("11"), Some("Closing as stale")),
        )
        .unwrap();

        let calls = client.calls.lock().unwrap().clone();
        assert_eq!(calls[0], "list_transitions:AMP-1043");
        assert_eq!(calls[1], "transition:AMP-1043:31:Closing as stale");

        assert_eq!(entry.action_id, "jira-close-issue");
        assert_eq!(entry.target_ref, "jira:AMP-1043");
        assert!(entry.reversible);
        assert_eq!(entry.before_state.value()["status"], "Open");
        assert_eq!(entry.before_state.value()["inverse_transition_id"], "11");
        assert_eq!(entry.after_state.value()["status"], "Done");
        assert_eq!(entry.after_state.value()["transition_id"], "31");
        assert_eq!(entry.after_state.value()["inverse_transition_id"], "11");
    }

    #[test]
    fn close_issue_rejects_unavailable_transition() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();
        // RecordingJiraClient returns transitions "31" and "11"; "99" is not in the list
        let err =
            execute_jira_close_issue(&conn, &client, make_input("AMP-1043", "99", None, None))
                .unwrap_err();
        assert!(matches!(err, MutationError::InvalidInput(_)));
        assert!(format!("{err}").contains("transition not available"));
    }

    #[test]
    fn close_issue_reverse_transitions_back() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();
        let original = execute_jira_close_issue(
            &conn,
            &client,
            make_input("AMP-1043", "31", Some("11"), None),
        )
        .unwrap();

        let reverse = execute_jira_close_issue_reverse(
            &conn,
            &client,
            crate::mutations::inputs::JiraReverseMutationInput {
                common: crate::mutations::inputs::ReverseCommonInput {
                    source_id: "src_1".to_string(),
                    audit_entry_id: original.id.clone(),
                    source_feature: Some("test".to_string()),
                    batch_id: None,
                },
            },
        )
        .unwrap();

        let calls = client.calls.lock().unwrap().clone();
        assert_eq!(calls[2], "transition:AMP-1043:11:");
        assert_eq!(reverse.after_state.value()["status"], "Open");

        let updated = repository::get_entry(&conn, &original.id).unwrap();
        assert!(updated.reverted_at.is_some());
    }

    #[test]
    fn close_issue_reverse_fails_when_inverse_missing() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();
        let original =
            execute_jira_close_issue(&conn, &client, make_input("AMP-1043", "31", None, None))
                .unwrap();

        let err = execute_jira_close_issue_reverse(
            &conn,
            &client,
            crate::mutations::inputs::JiraReverseMutationInput {
                common: crate::mutations::inputs::ReverseCommonInput {
                    source_id: "src_1".to_string(),
                    audit_entry_id: original.id,
                    source_feature: Some("test".to_string()),
                    batch_id: None,
                },
            },
        )
        .unwrap_err();

        assert!(matches!(err, MutationError::ReverseUnsupported(_)));
        assert_eq!(
            format!("{err}"),
            "reverse mutation is unsupported: inverse transition id is missing"
        );
    }
}
