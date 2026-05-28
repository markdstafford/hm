use rusqlite::Connection;

use crate::audit::entry::{AuditLogAppendInput, AuditLogEntry};
use crate::audit::repository;
use crate::mutations::errors::MutationError;
use crate::mutations::inputs::{
    audit_state, source_feature_or_manual, target_ref, JiraReverseMutationInput,
    JiraUpdateTitleInput,
};
use crate::mutations::jira_client::JiraMutationClient;
use crate::mutations::registry::{action_metadata, batch_or_new, new_audit_id, JIRA_UPDATE_TITLE};

pub fn execute_jira_update_title<C: JiraMutationClient + ?Sized>(
    conn: &Connection,
    client: &C,
    input: JiraUpdateTitleInput,
) -> Result<AuditLogEntry, MutationError> {
    let issue_key = input.common.issue_key.trim().to_string();
    if issue_key.is_empty() {
        return Err(MutationError::InvalidInput("issue_key is required".into()));
    }

    client
        .update_issue_fields(&issue_key, serde_json::json!({"summary": input.after_title}))
        .map_err(|e| MutationError::Jira(e.to_string()))?;

    let batch_id = batch_or_new(input.common.batch_id);
    let meta = action_metadata(JIRA_UPDATE_TITLE).unwrap();

    let append_input = AuditLogAppendInput {
        id: Some(new_audit_id()),
        batch_id,
        action_id: JIRA_UPDATE_TITLE.to_string(),
        target_ref: target_ref(&issue_key),
        before_state: audit_state(serde_json::json!({"title": input.before_title})),
        after_state: audit_state(serde_json::json!({"title": input.after_title})),
        reversible: meta.reversible,
        created_at: None,
        source_feature: source_feature_or_manual(input.common.source_feature),
    };

    repository::append_entry(conn, append_input)
        .map_err(|_| MutationError::AuditWriteFailedAfterRemoteMutation)
}

pub fn execute_jira_update_title_reverse<C: JiraMutationClient + ?Sized>(
    conn: &Connection,
    client: &C,
    input: JiraReverseMutationInput,
) -> Result<AuditLogEntry, MutationError> {
    let original = repository::get_entry(conn, &input.common.audit_entry_id)
        .map_err(|e| MutationError::Audit(e.to_string()))?;

    let before_title = original
        .before_state
        .value()
        .get("title")
        .and_then(|v| v.as_str())
        .ok_or_else(|| MutationError::InvalidInput("original before_state missing title".into()))?
        .to_string();

    let issue_key = original
        .target_ref
        .strip_prefix("jira:")
        .ok_or_else(|| MutationError::InvalidInput("invalid target_ref format".into()))?
        .to_string();

    client
        .update_issue_fields(&issue_key, serde_json::json!({"summary": before_title}))
        .map_err(|e| MutationError::Jira(e.to_string()))?;

    let batch_id = batch_or_new(input.common.batch_id);
    let reverse_id = new_audit_id();

    let after_title_snapshot = original.after_state.value().get("title").cloned();

    let reverse_entry = repository::append_entry(
        conn,
        AuditLogAppendInput {
            id: Some(reverse_id.clone()),
            batch_id,
            action_id: format!("{JIRA_UPDATE_TITLE}-reverse"),
            target_ref: original.target_ref.clone(),
            before_state: audit_state(serde_json::json!({"title": after_title_snapshot})),
            after_state: audit_state(serde_json::json!({"title": before_title})),
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
pub fn jira_update_title(
    input: JiraUpdateTitleInput,
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
    app: tauri::AppHandle,
) -> Result<AuditLogEntry, String> {
    use crate::mutations::jira_client::resolve_real_client;
    let conn = db.lock().map_err(|e| e.to_string())?;
    let client = resolve_real_client(&conn, &app, &input.common.source_id)
        .map_err(|e| e.to_string())?;
    execute_jira_update_title(&conn, &*client, input).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn jira_update_title_reverse(
    input: JiraReverseMutationInput,
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
    app: tauri::AppHandle,
) -> Result<AuditLogEntry, String> {
    use crate::mutations::jira_client::resolve_real_client;
    let conn = db.lock().map_err(|e| e.to_string())?;
    let client = resolve_real_client(&conn, &app, &input.common.source_id)
        .map_err(|e| e.to_string())?;
    execute_jira_update_title_reverse(&conn, &*client, input).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::mutations::tests::RecordingJiraClient;

    #[test]
    fn title_apply_records_jira_call_and_audit_row() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();
        let input = JiraUpdateTitleInput {
            common: crate::mutations::inputs::MutationCommonInput {
                source_id: "src_1".to_string(),
                issue_key: "AMP-1043".to_string(),
                source_feature: Some("test".to_string()),
                batch_id: Some("batch_explicit".to_string()),
            },
            before_title: "Old title".to_string(),
            after_title: "New title".to_string(),
        };
        let entry = execute_jira_update_title(&conn, &client, input).unwrap();

        let calls = client.calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert!(
            calls[0].starts_with("update:AMP-1043:"),
            "expected update call, got: {}",
            calls[0]
        );
        assert!(calls[0].contains("New title"));

        assert_eq!(entry.action_id, "jira-update-title");
        assert_eq!(entry.target_ref, "jira:AMP-1043");
        assert_eq!(entry.batch_id, "batch_explicit");
        assert!(entry.reversible);
        assert_eq!(entry.before_state.value()["title"], "Old title");
        assert_eq!(entry.after_state.value()["title"], "New title");
        assert!(entry.reverted_at.is_none());
    }

    #[test]
    fn title_reverse_restores_before_title_and_marks_original_reverted() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();
        let apply_input = JiraUpdateTitleInput {
            common: crate::mutations::inputs::MutationCommonInput {
                source_id: "src_1".to_string(),
                issue_key: "AMP-1043".to_string(),
                source_feature: Some("test".to_string()),
                batch_id: None,
            },
            before_title: "Old title".to_string(),
            after_title: "New title".to_string(),
        };
        let original_entry = execute_jira_update_title(&conn, &client, apply_input).unwrap();

        let reverse_input = JiraReverseMutationInput {
            common: crate::mutations::inputs::ReverseCommonInput {
                source_id: "src_1".to_string(),
                audit_entry_id: original_entry.id.clone(),
                source_feature: Some("test".to_string()),
                batch_id: None,
            },
        };
        let reverse_entry =
            execute_jira_update_title_reverse(&conn, &client, reverse_input).unwrap();
        assert_eq!(reverse_entry.after_state.value()["title"], "Old title");

        // Original row should now be reverted
        let updated_original = repository::get_entry(&conn, &original_entry.id).unwrap();
        assert!(updated_original.reverted_at.is_some());
        assert_eq!(
            updated_original.reverted_by_action_id.as_deref(),
            Some(reverse_entry.id.as_str())
        );
    }
}
