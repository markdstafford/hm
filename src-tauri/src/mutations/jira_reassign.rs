use rusqlite::Connection;

use crate::audit::entry::{AuditLogAppendInput, AuditLogEntry};
use crate::audit::repository;
use crate::mutations::errors::MutationError;
use crate::mutations::inputs::{
    audit_state, source_feature_or_manual, target_ref, JiraReassignInput, JiraReverseMutationInput,
};
use crate::mutations::jira_client::JiraMutationClient;
use crate::mutations::registry::{action_metadata, batch_or_new, new_audit_id, JIRA_REASSIGN};

pub fn execute_jira_reassign<C: JiraMutationClient + ?Sized>(
    conn: &Connection,
    client: &C,
    input: JiraReassignInput,
) -> Result<AuditLogEntry, MutationError> {
    let issue_key = input.common.issue_key.trim().to_string();
    if issue_key.is_empty() {
        return Err(MutationError::InvalidInput("issue_key is required".into()));
    }

    let fields = match &input.after_assignee_account_id {
        None => serde_json::json!({"assignee": null}),
        Some(id) => serde_json::json!({"assignee": {"name": id}}),
    };

    client
        .update_issue_fields(&issue_key, fields)
        .map_err(|e| MutationError::Jira(e.to_string()))?;

    let batch_id = batch_or_new(input.common.batch_id);
    let meta = action_metadata(JIRA_REASSIGN).unwrap();

    repository::append_entry(
        conn,
        AuditLogAppendInput {
            id: Some(new_audit_id()),
            batch_id,
            action_id: JIRA_REASSIGN.to_string(),
            target_ref: target_ref(&issue_key),
            before_state: audit_state(
                serde_json::json!({"assignee_account_id": input.before_assignee_account_id}),
            ),
            after_state: audit_state(
                serde_json::json!({"assignee_account_id": input.after_assignee_account_id}),
            ),
            reversible: meta.reversible,
            created_at: None,
            source_feature: source_feature_or_manual(input.common.source_feature),
        },
    )
    .map_err(|_| MutationError::AuditWriteFailedAfterRemoteMutation)
}

pub fn execute_jira_reassign_reverse<C: JiraMutationClient + ?Sized>(
    conn: &Connection,
    client: &C,
    input: JiraReverseMutationInput,
) -> Result<AuditLogEntry, MutationError> {
    let original = repository::get_entry(conn, &input.common.audit_entry_id)
        .map_err(|e| MutationError::Audit(e.to_string()))?;

    let issue_key = original
        .target_ref
        .strip_prefix("jira:")
        .ok_or_else(|| MutationError::InvalidInput("invalid target_ref format".into()))?
        .to_string();

    // before_assignee_account_id may be null (unassigned) or a string
    let before_assignee = original
        .before_state
        .value()
        .get("assignee_account_id")
        .cloned();

    let fields = match before_assignee.as_ref().and_then(|v| v.as_str()) {
        None => serde_json::json!({"assignee": null}),
        Some(id) => serde_json::json!({"assignee": {"name": id}}),
    };

    client
        .update_issue_fields(&issue_key, fields)
        .map_err(|e| MutationError::Jira(e.to_string()))?;

    let batch_id = batch_or_new(input.common.batch_id);
    let reverse_id = new_audit_id();

    let after_assignee_snapshot = original
        .after_state
        .value()
        .get("assignee_account_id")
        .cloned();

    let reverse_entry = repository::append_entry(
        conn,
        AuditLogAppendInput {
            id: Some(reverse_id.clone()),
            batch_id,
            action_id: format!("{JIRA_REASSIGN}-reverse"),
            target_ref: original.target_ref.clone(),
            before_state: audit_state(
                serde_json::json!({"assignee_account_id": after_assignee_snapshot}),
            ),
            after_state: audit_state(
                serde_json::json!({"assignee_account_id": before_assignee}),
            ),
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
pub fn jira_reassign(
    input: JiraReassignInput,
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
    app: tauri::AppHandle,
) -> Result<AuditLogEntry, String> {
    use crate::mutations::jira_client::resolve_real_client;
    let conn = db.lock().map_err(|e| e.to_string())?;
    let client = resolve_real_client(&conn, &app, &input.common.source_id)
        .map_err(|e| e.to_string())?;
    execute_jira_reassign(&conn, &*client, input).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn jira_reassign_reverse(
    input: JiraReverseMutationInput,
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
    app: tauri::AppHandle,
) -> Result<AuditLogEntry, String> {
    use crate::mutations::jira_client::resolve_real_client;
    let conn = db.lock().map_err(|e| e.to_string())?;
    let client = resolve_real_client(&conn, &app, &input.common.source_id)
        .map_err(|e| e.to_string())?;
    execute_jira_reassign_reverse(&conn, &*client, input).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::mutations::tests::RecordingJiraClient;

    #[test]
    fn reassign_to_user_sends_account_id() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();
        let input = JiraReassignInput {
            common: crate::mutations::inputs::MutationCommonInput {
                source_id: "src_1".to_string(),
                issue_key: "AMP-1043".to_string(),
                source_feature: Some("test".to_string()),
                batch_id: None,
            },
            before_assignee_account_id: Some("user_old".to_string()),
            after_assignee_account_id: Some("user_new".to_string()),
        };
        let entry = execute_jira_reassign(&conn, &client, input).unwrap();
        let calls = client.calls.lock().unwrap();
        assert!(
            calls[0].contains("user_new"),
            "expected new user in call, got: {}",
            calls[0]
        );
        assert_eq!(entry.before_state.value()["assignee_account_id"], "user_old");
        assert_eq!(entry.after_state.value()["assignee_account_id"], "user_new");
        assert!(entry.reversible);
    }

    #[test]
    fn reassign_to_unassigned_sends_null() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();
        let input = JiraReassignInput {
            common: crate::mutations::inputs::MutationCommonInput {
                source_id: "src_1".to_string(),
                issue_key: "AMP-1043".to_string(),
                source_feature: Some("test".to_string()),
                batch_id: None,
            },
            before_assignee_account_id: Some("user_old".to_string()),
            after_assignee_account_id: None,
        };
        let entry = execute_jira_reassign(&conn, &client, input).unwrap();
        let calls = client.calls.lock().unwrap();
        assert!(
            calls[0].contains("null"),
            "expected null assignee in call, got: {}",
            calls[0]
        );
        assert!(entry.after_state.value()["assignee_account_id"].is_null());
    }

    #[test]
    fn reassign_reverse_restores_before_assignee() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();
        let original = execute_jira_reassign(
            &conn,
            &client,
            JiraReassignInput {
                common: crate::mutations::inputs::MutationCommonInput {
                    source_id: "src_1".to_string(),
                    issue_key: "AMP-1043".to_string(),
                    source_feature: Some("test".to_string()),
                    batch_id: None,
                },
                before_assignee_account_id: Some("before_user".to_string()),
                after_assignee_account_id: Some("after_user".to_string()),
            },
        )
        .unwrap();
        let reverse = execute_jira_reassign_reverse(
            &conn,
            &client,
            JiraReverseMutationInput {
                common: crate::mutations::inputs::ReverseCommonInput {
                    source_id: "src_1".to_string(),
                    audit_entry_id: original.id.clone(),
                    source_feature: Some("test".to_string()),
                    batch_id: None,
                },
            },
        )
        .unwrap();
        assert_eq!(
            reverse.after_state.value()["assignee_account_id"],
            "before_user"
        );
        let updated = repository::get_entry(&conn, &original.id).unwrap();
        assert!(updated.reverted_at.is_some());
    }
}
