use rusqlite::{params, Connection, OptionalExtension};

use crate::audit::entry::{
    AuditLogAppendInput, AuditLogEntry, AuditLogListFilter, AuditLogMarkRevertedInput, AuditState,
};
use crate::audit::errors::AuditError;
use crate::commands::JsonValue;

pub fn setup_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS audit_log (
            id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL,
            action_id TEXT NOT NULL,
            target_ref TEXT NOT NULL,
            before_state TEXT NOT NULL,
            after_state TEXT NOT NULL,
            reversible INTEGER NOT NULL CHECK (reversible IN (0, 1)),
            reverted_at TEXT NULL,
            reverted_by_action_id TEXT NULL,
            created_at TEXT NOT NULL,
            source_feature TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_log_batch_id ON audit_log (batch_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_target_ref ON audit_log (target_ref);",
    )?;
    Ok(())
}

fn now_utc() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| {
            let secs = d.as_secs();
            chrono_from_secs(secs)
        })
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

fn chrono_from_secs(secs: u64) -> String {
    // Simple ISO-8601 UTC formatter without external dependencies
    let secs_in_day = secs % 86400;
    let days = secs / 86400;
    let h = secs_in_day / 3600;
    let m = (secs_in_day % 3600) / 60;
    let s = secs_in_day % 60;
    let (year, month, day) = days_to_ymd(days);
    format!("{year:04}-{month:02}-{day:02}T{h:02}:{m:02}:{s:02}Z")
}

fn days_to_ymd(days: u64) -> (u64, u64, u64) {
    // Algorithm from https://www.researchgate.net/publication/316558298 (civil_from_days)
    let z = days + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

fn row_to_entry(row: &rusqlite::Row<'_>) -> rusqlite::Result<AuditLogEntry> {
    let before_json: String = row.get(4)?;
    let after_json: String = row.get(5)?;
    let before_val: serde_json::Value =
        serde_json::from_str(&before_json).unwrap_or(serde_json::Value::Object(Default::default()));
    let after_val: serde_json::Value =
        serde_json::from_str(&after_json).unwrap_or(serde_json::Value::Object(Default::default()));

    Ok(AuditLogEntry {
        id: row.get(0)?,
        batch_id: row.get(1)?,
        action_id: row.get(2)?,
        target_ref: row.get(3)?,
        before_state: AuditState(JsonValue(before_val)),
        after_state: AuditState(JsonValue(after_val)),
        reversible: {
            let v: i64 = row.get(6)?;
            v != 0
        },
        reverted_at: row.get(7)?,
        reverted_by_action_id: row.get(8)?,
        created_at: row.get(9)?,
        source_feature: row.get(10)?,
    })
}

pub fn append_entry(
    conn: &Connection,
    input: AuditLogAppendInput,
) -> Result<AuditLogEntry, AuditError> {
    // Validate state is JSON object
    if !input.before_state.value().is_object() {
        return Err(AuditError::InvalidInput(
            "before_state must be a JSON object",
        ));
    }
    if !input.after_state.value().is_object() {
        return Err(AuditError::InvalidInput(
            "after_state must be a JSON object",
        ));
    }

    let id = input
        .id
        .unwrap_or_else(|| format!("audit_{}", generate_unique_suffix()));
    let created_at = input.created_at.unwrap_or_else(now_utc);
    let before_json =
        serde_json::to_string(input.before_state.value()).map_err(|_| AuditError::Database)?;
    let after_json =
        serde_json::to_string(input.after_state.value()).map_err(|_| AuditError::Database)?;

    conn.execute(
        "INSERT INTO audit_log (id, batch_id, action_id, target_ref, before_state, after_state, reversible, reverted_at, reverted_by_action_id, created_at, source_feature)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL, ?8, ?9)",
        params![
            id,
            input.batch_id,
            input.action_id,
            input.target_ref,
            before_json,
            after_json,
            if input.reversible { 1i64 } else { 0i64 },
            created_at,
            input.source_feature,
        ],
    )
    .map_err(|_| AuditError::Database)?;

    get_entry(conn, &id)
}

pub fn get_entry(conn: &Connection, id: &str) -> Result<AuditLogEntry, AuditError> {
    conn.query_row(
        "SELECT id, batch_id, action_id, target_ref, before_state, after_state, reversible, reverted_at, reverted_by_action_id, created_at, source_feature FROM audit_log WHERE id = ?1",
        params![id],
        row_to_entry,
    )
    .optional()
    .map_err(|_| AuditError::Database)?
    .ok_or(AuditError::NotFound)
}

pub fn list_entries(
    conn: &Connection,
    filter: AuditLogListFilter,
) -> Result<Vec<AuditLogEntry>, AuditError> {
    let newest_first = filter.newest_first.unwrap_or(true);
    let limit = filter.limit.map(|l| l.clamp(1, 1000)).unwrap_or(200) as i64;

    let mut sql = "SELECT id, batch_id, action_id, target_ref, before_state, after_state, reversible, reverted_at, reverted_by_action_id, created_at, source_feature FROM audit_log WHERE 1=1".to_string();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(batch_id) = filter.batch_id {
        sql.push_str(" AND batch_id = ?");
        param_values.push(Box::new(batch_id));
    }
    if let Some(target_ref) = filter.target_ref {
        sql.push_str(" AND target_ref = ?");
        param_values.push(Box::new(target_ref));
    }
    if let Some(reversible) = filter.reversible {
        sql.push_str(" AND reversible = ?");
        param_values.push(Box::new(if reversible { 1i64 } else { 0i64 }));
    }
    if let Some(created_from) = filter.created_from {
        sql.push_str(" AND created_at >= ?");
        param_values.push(Box::new(created_from));
    }
    if let Some(created_to) = filter.created_to {
        sql.push_str(" AND created_at <= ?");
        param_values.push(Box::new(created_to));
    }

    let order = if newest_first {
        " ORDER BY created_at DESC, id DESC"
    } else {
        " ORDER BY created_at ASC, id ASC"
    };
    sql.push_str(order);
    sql.push_str(" LIMIT ?");
    param_values.push(Box::new(limit));

    let params_refs: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|b| b.as_ref()).collect();

    let mut stmt = conn.prepare(&sql).map_err(|_| AuditError::Database)?;
    let entries = stmt
        .query_map(params_refs.as_slice(), row_to_entry)
        .map_err(|_| AuditError::Database)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|_| AuditError::Database)?;

    Ok(entries)
}

pub fn mark_reverted(
    conn: &Connection,
    input: AuditLogMarkRevertedInput,
) -> Result<AuditLogEntry, AuditError> {
    let reverted_at = input.reverted_at.unwrap_or_else(now_utc);
    let rows_changed = conn
        .execute(
            "UPDATE audit_log SET reverted_at = ?1, reverted_by_action_id = ?2 WHERE id = ?3 AND reverted_at IS NULL",
            params![reverted_at, input.reverted_by_action_id, input.id],
        )
        .map_err(|_| AuditError::Database)?;

    if rows_changed == 0 {
        return Err(AuditError::NotFound);
    }

    get_entry(conn, &input.id)
}

fn generate_unique_suffix() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    let count = COUNTER.fetch_add(1, Ordering::SeqCst);
    format!("{nanos}_{count}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    fn make_state(obj: serde_json::Value) -> AuditState {
        AuditState::new(obj).unwrap()
    }

    fn base_input(id_suffix: &str) -> AuditLogAppendInput {
        AuditLogAppendInput {
            id: Some(format!("audit_{id_suffix}")),
            batch_id: "batch_001".to_string(),
            action_id: "jira-update-title".to_string(),
            target_ref: "jira:AMP-1043".to_string(),
            before_state: make_state(serde_json::json!({"title": "Old"})),
            after_state: make_state(serde_json::json!({"title": "New"})),
            reversible: true,
            created_at: Some("2026-01-01T00:00:00Z".to_string()),
            source_feature: "test".to_string(),
        }
    }

    #[test]
    fn append_and_get_entry_round_trips() {
        let conn = open_in_memory().unwrap();
        let entry = append_entry(&conn, base_input("001")).unwrap();
        assert_eq!(entry.id, "audit_001");
        assert_eq!(entry.batch_id, "batch_001");
        assert_eq!(entry.action_id, "jira-update-title");
        assert_eq!(entry.target_ref, "jira:AMP-1043");
        assert!(entry.reversible);
        assert!(entry.reverted_at.is_none());
        assert_eq!(entry.before_state.value()["title"], "Old");
        assert_eq!(entry.after_state.value()["title"], "New");
    }

    #[test]
    fn list_entries_newest_first_by_default() {
        let conn = open_in_memory().unwrap();
        let mut input1 = base_input("10");
        input1.created_at = Some("2026-01-01T00:00:00Z".to_string());
        let mut input2 = base_input("20");
        input2.created_at = Some("2026-01-02T00:00:00Z".to_string());
        append_entry(&conn, input1).unwrap();
        append_entry(&conn, input2).unwrap();
        let entries = list_entries(&conn, AuditLogListFilter::default()).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].id, "audit_20");
        assert_eq!(entries[1].id, "audit_10");
    }

    #[test]
    fn list_filter_by_batch_id() {
        let conn = open_in_memory().unwrap();
        let mut input1 = base_input("30");
        input1.batch_id = "batch_A".to_string();
        let mut input2 = base_input("31");
        input2.batch_id = "batch_B".to_string();
        append_entry(&conn, input1).unwrap();
        append_entry(&conn, input2).unwrap();
        let entries = list_entries(
            &conn,
            AuditLogListFilter {
                batch_id: Some("batch_A".to_string()),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].batch_id, "batch_A");
    }

    #[test]
    fn list_filter_by_target_ref() {
        let conn = open_in_memory().unwrap();
        let mut input1 = base_input("40");
        input1.target_ref = "jira:AMP-100".to_string();
        let mut input2 = base_input("41");
        input2.target_ref = "jira:AMP-200".to_string();
        append_entry(&conn, input1).unwrap();
        append_entry(&conn, input2).unwrap();
        let entries = list_entries(
            &conn,
            AuditLogListFilter {
                target_ref: Some("jira:AMP-100".to_string()),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].target_ref, "jira:AMP-100");
    }

    #[test]
    fn list_filter_by_reversible() {
        let conn = open_in_memory().unwrap();
        let mut input1 = base_input("50");
        input1.reversible = true;
        let mut input2 = base_input("51");
        input2.reversible = false;
        append_entry(&conn, input1).unwrap();
        append_entry(&conn, input2).unwrap();
        let rev = list_entries(
            &conn,
            AuditLogListFilter {
                reversible: Some(true),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(rev.len(), 1);
        assert!(rev[0].reversible);
    }

    #[test]
    fn list_filter_by_date_range() {
        let conn = open_in_memory().unwrap();
        let mut input1 = base_input("60");
        input1.created_at = Some("2026-01-01T00:00:00Z".to_string());
        let mut input2 = base_input("61");
        input2.created_at = Some("2026-06-01T00:00:00Z".to_string());
        append_entry(&conn, input1).unwrap();
        append_entry(&conn, input2).unwrap();
        let entries = list_entries(
            &conn,
            AuditLogListFilter {
                created_from: Some("2026-05-01T00:00:00Z".to_string()),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].id, "audit_61");
    }

    #[test]
    fn non_object_state_is_rejected() {
        let conn = open_in_memory().unwrap();
        let mut input = base_input("70");
        // Manually create a non-object AuditState to bypass new()
        input.before_state = AuditState(crate::commands::JsonValue(serde_json::json!([
            "not", "an", "object"
        ])));
        let err = append_entry(&conn, input).unwrap_err();
        assert!(matches!(err, AuditError::InvalidInput(_)));
    }

    #[test]
    fn mark_reverted_updates_row_and_returns_entry() {
        let conn = open_in_memory().unwrap();
        let entry = append_entry(&conn, base_input("80")).unwrap();
        assert!(entry.reverted_at.is_none());
        let reverted = mark_reverted(
            &conn,
            AuditLogMarkRevertedInput {
                id: entry.id.clone(),
                reverted_by_action_id: "audit_reverse_001".to_string(),
                reverted_at: Some("2026-02-01T00:00:00Z".to_string()),
            },
        )
        .unwrap();
        assert_eq!(
            reverted.reverted_at.as_deref(),
            Some("2026-02-01T00:00:00Z")
        );
        assert_eq!(
            reverted.reverted_by_action_id.as_deref(),
            Some("audit_reverse_001")
        );
    }

    #[test]
    fn mark_reverted_already_reverted_returns_not_found() {
        let conn = open_in_memory().unwrap();
        append_entry(&conn, base_input("90")).unwrap();
        mark_reverted(
            &conn,
            AuditLogMarkRevertedInput {
                id: "audit_90".to_string(),
                reverted_by_action_id: "audit_rev_001".to_string(),
                reverted_at: Some("2026-02-01T00:00:00Z".to_string()),
            },
        )
        .unwrap();
        // Second attempt fails because reverted_at is already set
        let err = mark_reverted(
            &conn,
            AuditLogMarkRevertedInput {
                id: "audit_90".to_string(),
                reverted_by_action_id: "audit_rev_002".to_string(),
                reverted_at: None,
            },
        )
        .unwrap_err();
        assert!(matches!(err, AuditError::NotFound));
    }
}
