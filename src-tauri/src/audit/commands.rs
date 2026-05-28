use std::sync::Mutex;

use crate::audit::entry::{AuditLogEntry, AuditLogListFilter, AuditLogMarkRevertedInput};
use crate::audit::repository;

pub(crate) fn audit_log_list_with_conn(
    conn: &rusqlite::Connection,
    filter: AuditLogListFilter,
) -> Result<Vec<AuditLogEntry>, String> {
    repository::list_entries(conn, filter).map_err(|e| e.to_string())
}

pub(crate) fn audit_log_mark_reverted_with_conn(
    conn: &rusqlite::Connection,
    input: AuditLogMarkRevertedInput,
) -> Result<AuditLogEntry, String> {
    repository::mark_reverted(conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn audit_log_list(
    filter: AuditLogListFilter,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<Vec<AuditLogEntry>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    audit_log_list_with_conn(&conn, filter)
}

#[tauri::command]
#[specta::specta]
pub fn audit_log_mark_reverted(
    input: AuditLogMarkRevertedInput,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<AuditLogEntry, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    audit_log_mark_reverted_with_conn(&conn, input)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audit::entry::{AuditLogAppendInput, AuditState};
    use crate::audit::repository::append_entry;
    use crate::db::open_in_memory;

    fn make_state(obj: serde_json::Value) -> AuditState {
        AuditState::new(obj).unwrap()
    }

    #[test]
    fn audit_log_list_with_conn_returns_entries() {
        let conn = open_in_memory().unwrap();
        let input = AuditLogAppendInput {
            id: Some("audit_cmd_001".to_string()),
            batch_id: "batch_001".to_string(),
            action_id: "jira-update-title".to_string(),
            target_ref: "jira:AMP-1043".to_string(),
            before_state: make_state(serde_json::json!({"title": "Old"})),
            after_state: make_state(serde_json::json!({"title": "New"})),
            reversible: true,
            created_at: Some("2026-01-01T00:00:00Z".to_string()),
            source_feature: "test".to_string(),
        };
        append_entry(&conn, input).unwrap();
        let entries = audit_log_list_with_conn(&conn, AuditLogListFilter {
            batch_id: Some("batch_001".to_string()),
            ..Default::default()
        }).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].id, "audit_cmd_001");
    }

    #[test]
    fn audit_log_mark_reverted_with_conn_works() {
        let conn = open_in_memory().unwrap();
        let input = AuditLogAppendInput {
            id: Some("audit_cmd_002".to_string()),
            batch_id: "batch_002".to_string(),
            action_id: "jira-update-title".to_string(),
            target_ref: "jira:AMP-1043".to_string(),
            before_state: make_state(serde_json::json!({"title": "Before"})),
            after_state: make_state(serde_json::json!({"title": "After"})),
            reversible: true,
            created_at: Some("2026-01-01T00:00:00Z".to_string()),
            source_feature: "test".to_string(),
        };
        append_entry(&conn, input).unwrap();
        let reverted = audit_log_mark_reverted_with_conn(&conn, AuditLogMarkRevertedInput {
            id: "audit_cmd_002".to_string(),
            reverted_by_action_id: "audit_rev_001".to_string(),
            reverted_at: Some("2026-02-01T00:00:00Z".to_string()),
        }).unwrap();
        assert_eq!(reverted.reverted_at.as_deref(), Some("2026-02-01T00:00:00Z"));
        assert_eq!(reverted.reverted_by_action_id.as_deref(), Some("audit_rev_001"));
    }
}
