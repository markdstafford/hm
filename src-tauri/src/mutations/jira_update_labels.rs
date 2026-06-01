use rusqlite::Connection;

use crate::audit::entry::{AuditLogAppendInput, AuditLogEntry};
use crate::audit::repository;
use crate::mutations::errors::MutationError;
use crate::mutations::inputs::{
    audit_state, source_feature_or_manual, target_ref, JiraReverseMutationInput,
    JiraUpdateLabelsInput,
};
use crate::mutations::jira_client::JiraMutationClient;
use crate::mutations::registry::{action_metadata, batch_or_new, new_audit_id, JIRA_UPDATE_LABELS};

pub fn execute_jira_update_labels<C: JiraMutationClient + ?Sized>(
    conn: &Connection,
    client: &C,
    input: JiraUpdateLabelsInput,
) -> Result<AuditLogEntry, MutationError> {
    let issue_key = input.common.issue_key.trim().to_string();
    if issue_key.is_empty() {
        return Err(MutationError::InvalidInput("issue_key is required".into()));
    }

    client
        .update_issue_fields(
            &issue_key,
            serde_json::json!({"labels": input.after_labels}),
        )
        .map_err(|e| MutationError::Jira(e.to_string()))?;

    let batch_id = batch_or_new(input.common.batch_id);
    let meta = action_metadata(JIRA_UPDATE_LABELS).unwrap();

    repository::append_entry(
        conn,
        AuditLogAppendInput {
            id: Some(new_audit_id()),
            batch_id,
            action_id: JIRA_UPDATE_LABELS.to_string(),
            target_ref: target_ref(&issue_key),
            before_state: audit_state(serde_json::json!({"labels": input.before_labels})),
            after_state: audit_state(serde_json::json!({"labels": input.after_labels})),
            reversible: meta.reversible,
            created_at: None,
            source_feature: source_feature_or_manual(input.common.source_feature),
        },
    )
    .map_err(|_| MutationError::AuditWriteFailedAfterRemoteMutation)
}

pub fn execute_jira_update_labels_reverse<C: JiraMutationClient + ?Sized>(
    conn: &Connection,
    client: &C,
    input: JiraReverseMutationInput,
) -> Result<AuditLogEntry, MutationError> {
    let original = repository::get_entry(conn, &input.common.audit_entry_id)
        .map_err(|e| MutationError::Audit(e.to_string()))?;

    let before_labels: Vec<String> = original
        .before_state
        .value()
        .get("labels")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .ok_or_else(|| {
            MutationError::InvalidInput("original before_state missing labels".into())
        })?;

    let issue_key = original
        .target_ref
        .strip_prefix("jira:")
        .ok_or_else(|| MutationError::InvalidInput("invalid target_ref format".into()))?
        .to_string();

    client
        .update_issue_fields(&issue_key, serde_json::json!({"labels": before_labels}))
        .map_err(|e| MutationError::Jira(e.to_string()))?;

    let batch_id = batch_or_new(input.common.batch_id);
    let reverse_id = new_audit_id();

    let after_labels_snapshot = original.after_state.value().get("labels").cloned();

    let reverse_entry = repository::append_entry(
        conn,
        AuditLogAppendInput {
            id: Some(reverse_id.clone()),
            batch_id,
            action_id: format!("{JIRA_UPDATE_LABELS}-reverse"),
            target_ref: original.target_ref.clone(),
            before_state: audit_state(serde_json::json!({"labels": after_labels_snapshot})),
            after_state: audit_state(serde_json::json!({"labels": before_labels})),
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
pub fn jira_update_labels(
    input: JiraUpdateLabelsInput,
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
    app: tauri::AppHandle,
) -> Result<AuditLogEntry, String> {
    use crate::mutations::jira_client::resolve_real_client;
    let conn = db.lock().map_err(|e| e.to_string())?;
    let client =
        resolve_real_client(&conn, &app, &input.common.source_id).map_err(|e| e.to_string())?;
    execute_jira_update_labels(&conn, &*client, input).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn jira_update_labels_reverse(
    input: JiraReverseMutationInput,
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
    app: tauri::AppHandle,
) -> Result<AuditLogEntry, String> {
    use crate::mutations::jira_client::resolve_real_client;
    let conn = db.lock().map_err(|e| e.to_string())?;
    let client =
        resolve_real_client(&conn, &app, &input.common.source_id).map_err(|e| e.to_string())?;
    execute_jira_update_labels_reverse(&conn, &*client, input).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::mutations::tests::RecordingJiraClient;

    #[test]
    fn labels_apply_stores_full_label_sets() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();
        let input = JiraUpdateLabelsInput {
            common: crate::mutations::inputs::MutationCommonInput {
                source_id: "src_1".to_string(),
                issue_key: "AMP-1043".to_string(),
                source_feature: Some("test".to_string()),
                batch_id: None,
            },
            before_labels: vec!["old".to_string()],
            after_labels: vec!["triaged".to_string(), "stale".to_string()],
        };
        let entry = execute_jira_update_labels(&conn, &client, input).unwrap();
        assert_eq!(
            entry.before_state.value()["labels"],
            serde_json::json!(["old"])
        );
        assert_eq!(
            entry.after_state.value()["labels"],
            serde_json::json!(["triaged", "stale"])
        );
        assert!(entry.reversible);
    }

    #[test]
    fn labels_reverse_restores_before_labels() {
        let conn = open_in_memory().unwrap();
        let client = RecordingJiraClient::default();
        let apply_input = JiraUpdateLabelsInput {
            common: crate::mutations::inputs::MutationCommonInput {
                source_id: "src_1".to_string(),
                issue_key: "AMP-1043".to_string(),
                source_feature: Some("test".to_string()),
                batch_id: None,
            },
            before_labels: vec!["original".to_string()],
            after_labels: vec!["new-label".to_string()],
        };
        let original = execute_jira_update_labels(&conn, &client, apply_input).unwrap();
        let reverse = execute_jira_update_labels_reverse(
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
            reverse.after_state.value()["labels"],
            serde_json::json!(["original"])
        );
        let updated = repository::get_entry(&conn, &original.id).unwrap();
        assert!(updated.reverted_at.is_some());
    }
}
