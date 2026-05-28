use rusqlite::Connection;

use crate::audit::entry::{AuditLogAppendInput, AuditLogEntry};
use crate::audit::repository;
use crate::mutations::errors::MutationError;
use crate::mutations::inputs::{
    audit_state, source_feature_or_manual, target_ref, JiraLinkAsDuplicateInput,
    JiraReverseMutationInput,
};
use crate::mutations::jira_client::JiraMutationClient;
use crate::mutations::registry::{
    action_metadata, batch_or_new, new_audit_id, JIRA_LINK_AS_DUPLICATE,
};

pub fn execute_jira_link_as_duplicate<C: JiraMutationClient + ?Sized>(
    conn: &Connection,
    client: &C,
    input: JiraLinkAsDuplicateInput,
) -> Result<AuditLogEntry, MutationError> {
    let issue_key = input.common.issue_key.trim().to_string();
    if issue_key.is_empty() {
        return Err(MutationError::InvalidInput("issue_key is required".into()));
    }

    let created_link = client
        .create_issue_link(&issue_key, &input.target_issue_key, &input.link_type)
        .map_err(|e| MutationError::Jira(e.to_string()))?;

    if let Some(close_transition_id) = &input.close_transition_id {
        client
            .transition_issue(&issue_key, close_transition_id, None)
            .map_err(|e| MutationError::Jira(e.to_string()))?;
    }

    let batch_id = batch_or_new(input.common.batch_id);
    let meta = action_metadata(JIRA_LINK_AS_DUPLICATE).unwrap();

    let mut after_state_value = serde_json::json!({
        "target_issue_key": input.target_issue_key,
        "link_type": input.link_type,
        "link_id": created_link.id,
        "inverse_transition_id": input.inverse_transition_id
    });

    if let Some(after_status) = &input.after_status {
        after_state_value["after_status"] = serde_json::json!(after_status);
        after_state_value["transition_id"] = serde_json::json!(input.close_transition_id);
    }

    let before_state_value = serde_json::json!({
        "status": input.before_status,
        "inverse_transition_id": input.inverse_transition_id
    });

    repository::append_entry(
        conn,
        AuditLogAppendInput {
            id: Some(new_audit_id()),
            batch_id,
            action_id: JIRA_LINK_AS_DUPLICATE.to_string(),
            target_ref: target_ref(&issue_key),
            before_state: audit_state(before_state_value),
            after_state: audit_state(after_state_value),
            reversible: meta.reversible,
            created_at: None,
            source_feature: source_feature_or_manual(input.common.source_feature),
        },
    )
    .map_err(|_| MutationError::AuditWriteFailedAfterRemoteMutation)
}

pub fn execute_jira_link_as_duplicate_reverse<C: JiraMutationClient + ?Sized>(
    conn: &Connection,
    client: &C,
    input: JiraReverseMutationInput,
) -> Result<AuditLogEntry, MutationError> {
    let original = repository::get_entry(conn, &input.common.audit_entry_id)
        .map_err(|e| MutationError::Audit(e.to_string()))?;

    let link_id = original
        .after_state
        .value()
        .get("link_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            MutationError::ReverseUnsupported("duplicate link id is missing".into())
        })?
        .to_string();

    let issue_key = original
        .target_ref
        .strip_prefix("jira:")
        .ok_or_else(|| MutationError::InvalidInput("invalid target_ref format".into()))?
        .to_string();

    client
        .delete_issue_link(&link_id)
        .map_err(|e| MutationError::Jira(e.to_string()))?;

    if let Some(inverse_transition_id) = original
        .after_state
        .value()
        .get("inverse_transition_id")
        .and_then(|v| v.as_str())
    {
        client
            .transition_issue(&issue_key, inverse_transition_id, None)
            .map_err(|e| MutationError::Jira(e.to_string()))?;
    }

    let batch_id = batch_or_new(input.common.batch_id);
    let reverse_id = new_audit_id();

    let reverse_entry = repository::append_entry(
        conn,
        AuditLogAppendInput {
            id: Some(reverse_id.clone()),
            batch_id,
            action_id: format!("{JIRA_LINK_AS_DUPLICATE}-reverse"),
            target_ref: original.target_ref.clone(),
            before_state: audit_state(serde_json::json!({
                "link_id": link_id,
                "after_status": original.after_state.value().get("after_status")
            })),
            after_state: audit_state(serde_json::json!({
                "status": original.before_state.value().get("status")
            })),
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
pub fn jira_link_as_duplicate(
    input: JiraLinkAsDuplicateInput,
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
    app: tauri::AppHandle,
) -> Result<AuditLogEntry, String> {
    use crate::mutations::jira_client::resolve_real_client;
    let conn = db.lock().map_err(|e| e.to_string())?;
    let client = resolve_real_client(&conn, &app, &input.common.source_id)
        .map_err(|e| e.to_string())?;
    execute_jira_link_as_duplicate(&conn, &*client, input).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn jira_link_as_duplicate_reverse(
    input: JiraReverseMutationInput,
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
    app: tauri::AppHandle,
) -> Result<AuditLogEntry, String> {
    use crate::mutations::jira_client::resolve_real_client;
    let conn = db.lock().map_err(|e| e.to_string())?;
    let client = resolve_real_client(&conn, &app, &input.common.source_id)
        .map_err(|e| e.to_string())?;
    execute_jira_link_as_duplicate_reverse(&conn, &*client, input).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::mutations::inputs::MutationCommonInput;
    use crate::mutations::tests::RecordingJiraClient;

    fn make_input(close_transition_id: Option<&str>, inverse_transition_id: Option<&str>) -> JiraLinkAsDuplicateInput {
        JiraLinkAsDuplicateInput {
            common: MutationCommonInput {
                source_id: "src_1".to_string(),
                issue_key: "AMP-1043".to_string(),
                source_feature: Some("test".to_string()),
                batch_id: None,
            },
            target_issue_key: "AMP-997".to_string(),
            link_type: "Duplicates".to_string(),
            close_transition_id: close_transition_id.map(str::to_string),
            inverse_transition_id: inverse_transition_id.map(str::to_string),
            before_status: Some("Open".to_string()),
            after_status: close_transition_id.map(|_| "Done".to_string()),
        }
    }

    #[test]
    fn link_only_calls_create_link() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();
        let entry = execute_jira_link_as_duplicate(&conn, &client, make_input(None, None)).unwrap();
        let calls = client.calls.lock().unwrap().clone();
        assert_eq!(calls, vec!["link:AMP-1043:AMP-997:Duplicates"]);
        assert_eq!(entry.action_id, "jira-link-as-duplicate");
        assert!(entry.reversible);
        assert_eq!(entry.after_state.value()["link_id"], "link_1");
    }

    #[test]
    fn link_plus_close_calls_link_then_transition() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();
        execute_jira_link_as_duplicate(&conn, &client, make_input(Some("31"), Some("11"))).unwrap();
        let calls = client.calls.lock().unwrap().clone();
        assert_eq!(calls[0], "link:AMP-1043:AMP-997:Duplicates");
        assert_eq!(calls[1], "transition:AMP-1043:31:");
    }

    #[test]
    fn reverse_deletes_link_and_optionally_transitions_back() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();
        let original = execute_jira_link_as_duplicate(&conn, &client, make_input(Some("31"), Some("11"))).unwrap();
        execute_jira_link_as_duplicate_reverse(&conn, &client, crate::mutations::inputs::JiraReverseMutationInput {
            common: crate::mutations::inputs::ReverseCommonInput {
                source_id: "src_1".to_string(),
                audit_entry_id: original.id.clone(),
                source_feature: Some("test".to_string()),
                batch_id: None,
            },
        }).unwrap();
        let calls = client.calls.lock().unwrap().clone();
        assert_eq!(calls[2], "delete_link:link_1");
        assert_eq!(calls[3], "transition:AMP-1043:11:");
        let updated = repository::get_entry(&conn, &original.id).unwrap();
        assert!(updated.reverted_at.is_some());
    }

    #[test]
    fn reverse_fails_when_link_id_missing() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();
        // Manually insert an audit entry with no link_id in after_state
        let entry = crate::audit::repository::append_entry(&conn, crate::audit::entry::AuditLogAppendInput {
            id: Some("audit_no_link".to_string()),
            batch_id: "batch_x".to_string(),
            action_id: JIRA_LINK_AS_DUPLICATE.to_string(),
            target_ref: "jira:AMP-1043".to_string(),
            before_state: crate::mutations::inputs::audit_state(serde_json::json!({"status": "Open"})),
            after_state: crate::mutations::inputs::audit_state(serde_json::json!({"target_issue_key": "AMP-997"})),
            reversible: true,
            created_at: None,
            source_feature: "test".to_string(),
        }).unwrap();
        let err = execute_jira_link_as_duplicate_reverse(&conn, &client, crate::mutations::inputs::JiraReverseMutationInput {
            common: crate::mutations::inputs::ReverseCommonInput {
                source_id: "src_1".to_string(),
                audit_entry_id: entry.id,
                source_feature: Some("test".to_string()),
                batch_id: None,
            },
        }).unwrap_err();
        assert_eq!(format!("{err}"), "reverse mutation is unsupported: duplicate link id is missing");
    }
}
