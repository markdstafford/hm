use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use specta::Type;

pub const ISSUE_HISTORY_RETENTION_KEY: &str = "issue_history.retention";

#[derive(Debug, Clone, PartialEq)]
pub struct IssueEventInput {
    pub id: String,
    pub source_system_id: String,
    pub issue_id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub source_kind: String,
    pub event_type: String,
    pub upstream_event_id: Option<String>,
    pub upstream_item_id: Option<String>,
    pub field_id: Option<String>,
    pub field_name: Option<String>,
    pub actor_identity_id: Option<String>,
    pub actor_display_name: Option<String>,
    pub occurred_at: String,
    pub from_string: Option<String>,
    pub to_string: Option<String>,
    pub from_json: Option<String>,
    pub to_json: Option<String>,
    pub payload_json: String,
    pub ingested_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct IssueEventRow {
    pub id: String,
    pub issue_id: String,
    pub event_type: String,
    pub occurred_at: String,
    pub actor_display_name: Option<String>,
    pub from_string: Option<String>,
    pub to_string: Option<String>,
    pub payload_json: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct IssueSnapshotInput {
    pub issue_id: String,
    pub snapshot_date: String,
    pub source_system_id: String,
    pub source_kind: String,
    pub key: Option<String>,
    pub title: String,
    pub body_hash: Option<String>,
    pub state: String,
    pub status_name: Option<String>,
    pub status_id: Option<String>,
    pub resolution_name: Option<String>,
    pub resolution_id: Option<String>,
    pub priority_name: Option<String>,
    pub priority_id: Option<String>,
    pub item_type: Option<String>,
    pub project_key: Option<String>,
    pub project_name: Option<String>,
    pub assignee_person_id: Option<String>,
    pub reporter_person_id: Option<String>,
    pub labels_json: String,
    pub components_json: String,
    pub fix_versions_json: String,
    pub sprint_names_json: String,
    pub product_names_json: String,
    pub assigned_team_names_json: String,
    pub customer_name: Option<String>,
    pub parent_link: Option<String>,
    pub epic_link: Option<String>,
    pub epic_name: Option<String>,
    pub epic_status: Option<String>,
    pub created_at_source: Option<String>,
    pub updated_at_source: Option<String>,
    pub resolved_at_source: Option<String>,
    pub due_at_source: Option<String>,
    pub snapshot_source: String,
    pub generated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct IssueSnapshotQuery {
    pub snapshot_date: String,
    pub source_id: Option<String>,
    pub project_key: Option<String>,
    pub status_name: Option<String>,
    pub state: Option<String>,
    pub assignee_person_id: Option<String>,
    pub priority_name: Option<String>,
    pub label: Option<String>,
    pub sprint_name: Option<String>,
    pub product_name: Option<String>,
    pub customer_name: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct IssueSnapshotListItem {
    pub issue_id: String,
    pub snapshot_date: String,
    pub key: Option<String>,
    pub title: String,
    pub status_name: Option<String>,
    pub state: String,
    pub assignee_display_name: Option<String>,
    pub priority_name: Option<String>,
    pub project_key: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct IssueHistoryRetentionConfig {
    pub version: u32,
    pub daily_days: u32,
    pub compact_to_weekly_after_days: u32,
    pub weekly_anchor: String,
}

impl Default for IssueHistoryRetentionConfig {
    fn default() -> Self {
        IssueHistoryRetentionConfig {
            version: 1,
            daily_days: 365,
            compact_to_weekly_after_days: 365,
            weekly_anchor: "monday".to_string(),
        }
    }
}

pub struct IssueSnapshotJobStartInput {
    pub id: String,
    pub source_system_id: Option<String>,
    pub job_kind: String,
    pub started_at: String,
    pub target_start_date: Option<String>,
    pub target_end_date: Option<String>,
    pub progress_json: String,
}

// ── Error type (Task 1.3) ────────────────────────────────────────────────────

#[derive(Debug)]
pub enum IssueHistoryError {
    Storage(rusqlite::Error),
    Projection(String),
    InvalidConfig(String),
}

impl std::fmt::Display for IssueHistoryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IssueHistoryError::Storage(_) => write!(f, "Could not read issue history. Try syncing Jira again."),
            IssueHistoryError::Projection(_) => write!(f, "Issue history could not be updated. Try syncing Jira again."),
            IssueHistoryError::InvalidConfig(_) => write!(f, "Issue history retention settings are invalid."),
        }
    }
}

impl std::error::Error for IssueHistoryError {}

impl From<rusqlite::Error> for IssueHistoryError {
    fn from(e: rusqlite::Error) -> Self {
        IssueHistoryError::Storage(e)
    }
}

// ── Repository functions ─────────────────────────────────────────────────────

/// INSERT with ON CONFLICT DO UPDATE on the `id` primary key.
/// On conflict, update actor fields and payload (those can be enriched over time).
pub fn upsert_issue_event(conn: &Connection, input: &IssueEventInput) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO issue_events (
            id, source_system_id, issue_id, entity_type, entity_id, source_kind,
            event_type, upstream_event_id, upstream_item_id, field_id, field_name,
            actor_identity_id, actor_display_name, occurred_at, from_string, to_string,
            from_json, to_json, payload_json, ingested_at
         ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6,
            ?7, ?8, ?9, ?10, ?11,
            ?12, ?13, ?14, ?15, ?16,
            ?17, ?18, ?19, ?20
         )
         ON CONFLICT(id) DO UPDATE SET
            actor_identity_id  = excluded.actor_identity_id,
            actor_display_name = excluded.actor_display_name,
            payload_json       = excluded.payload_json",
        params![
            input.id,
            input.source_system_id,
            input.issue_id,
            input.entity_type,
            input.entity_id,
            input.source_kind,
            input.event_type,
            input.upstream_event_id,
            input.upstream_item_id,
            input.field_id,
            input.field_name,
            input.actor_identity_id,
            input.actor_display_name,
            input.occurred_at,
            input.from_string,
            input.to_string,
            input.from_json,
            input.to_json,
            input.payload_json,
            input.ingested_at,
        ],
    )?;
    Ok(())
}

/// Query issue_events filtered by issue_id and event_type, ordered by occurred_at DESC.
pub fn list_issue_events_by_type(
    conn: &Connection,
    issue_id: &str,
    event_type: &str,
    limit: u32,
) -> rusqlite::Result<Vec<IssueEventRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, issue_id, event_type, occurred_at, actor_display_name,
                from_string, to_string, payload_json
         FROM issue_events
         WHERE issue_id = ?1 AND event_type = ?2
         ORDER BY occurred_at DESC
         LIMIT ?3",
    )?;
    let rows = stmt.query_map(params![issue_id, event_type, limit], |row| {
        Ok(IssueEventRow {
            id: row.get(0)?,
            issue_id: row.get(1)?,
            event_type: row.get(2)?,
            occurred_at: row.get(3)?,
            actor_display_name: row.get(4)?,
            from_string: row.get(5)?,
            to_string: row.get(6)?,
            payload_json: row.get(7)?,
        })
    })?;
    rows.collect()
}

/// INSERT OR REPLACE — replaces all fields on conflict.
pub fn upsert_issue_snapshot(conn: &Connection, input: &IssueSnapshotInput) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO issue_snapshots (
            issue_id, snapshot_date, source_system_id, source_kind,
            key, title, body_hash, state,
            status_name, status_id, resolution_name, resolution_id,
            priority_name, priority_id, item_type,
            project_key, project_name,
            assignee_person_id, reporter_person_id,
            labels_json, components_json, fix_versions_json,
            sprint_names_json, product_names_json, assigned_team_names_json,
            customer_name, parent_link, epic_link, epic_name, epic_status,
            created_at_source, updated_at_source, resolved_at_source, due_at_source,
            snapshot_source, generated_at
         ) VALUES (
            ?1, ?2, ?3, ?4,
            ?5, ?6, ?7, ?8,
            ?9, ?10, ?11, ?12,
            ?13, ?14, ?15,
            ?16, ?17,
            ?18, ?19,
            ?20, ?21, ?22,
            ?23, ?24, ?25,
            ?26, ?27, ?28, ?29, ?30,
            ?31, ?32, ?33, ?34,
            ?35, ?36
         )",
        params![
            input.issue_id,
            input.snapshot_date,
            input.source_system_id,
            input.source_kind,
            input.key,
            input.title,
            input.body_hash,
            input.state,
            input.status_name,
            input.status_id,
            input.resolution_name,
            input.resolution_id,
            input.priority_name,
            input.priority_id,
            input.item_type,
            input.project_key,
            input.project_name,
            input.assignee_person_id,
            input.reporter_person_id,
            input.labels_json,
            input.components_json,
            input.fix_versions_json,
            input.sprint_names_json,
            input.product_names_json,
            input.assigned_team_names_json,
            input.customer_name,
            input.parent_link,
            input.epic_link,
            input.epic_name,
            input.epic_status,
            input.created_at_source,
            input.updated_at_source,
            input.resolved_at_source,
            input.due_at_source,
            input.snapshot_source,
            input.generated_at,
        ],
    )?;
    Ok(())
}

/// Build a dynamic SQL query based on filter options.
/// LEFT JOINs people to get assignee_display_name.
/// Default limit 100, max 500.
pub fn query_issue_snapshots(
    conn: &Connection,
    filter: &IssueSnapshotQuery,
) -> rusqlite::Result<Vec<IssueSnapshotListItem>> {
    let limit = filter.limit.unwrap_or(100).min(500);

    let mut sql = String::from(
        "SELECT s.issue_id, s.snapshot_date, s.key, s.title, s.status_name,
                s.state, p.display_name AS assignee_display_name, s.priority_name, s.project_key
         FROM issue_snapshots s
         LEFT JOIN people p ON p.id = s.assignee_person_id
         WHERE s.snapshot_date = ?1",
    );
    let mut param_idx = 2usize;
    let mut extra_params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    macro_rules! add_filter {
        ($field:expr, $value:expr) => {
            if let Some(v) = $value {
                sql.push_str(&format!(" AND {} = ?{}", $field, param_idx));
                extra_params.push(Box::new(v.clone()));
                param_idx += 1;
            }
        };
        (like, $field:expr, $value:expr) => {
            if let Some(v) = $value {
                sql.push_str(&format!(" AND {} LIKE ?{}", $field, param_idx));
                extra_params.push(Box::new(format!("%\"{}\"%" , v)));
                param_idx += 1;
            }
        };
    }

    add_filter!("s.source_system_id", &filter.source_id);
    add_filter!("s.project_key", &filter.project_key);
    add_filter!("s.status_name", &filter.status_name);
    add_filter!("s.state", &filter.state);
    add_filter!("s.assignee_person_id", &filter.assignee_person_id);
    add_filter!("s.priority_name", &filter.priority_name);
    add_filter!("s.customer_name", &filter.customer_name);
    add_filter!(like, "s.labels_json", &filter.label);
    add_filter!(like, "s.sprint_names_json", &filter.sprint_name);
    add_filter!(like, "s.product_names_json", &filter.product_name);
    let _ = param_idx; // param_idx is incremented inside the macro; suppress last-write warning

    sql.push_str(&format!(" LIMIT {limit}"));

    let mut stmt = conn.prepare(&sql)?;

    let snapshot_date = filter.snapshot_date.clone();
    let rows = stmt.query_map(
        rusqlite::params_from_iter(
            std::iter::once(Box::new(snapshot_date) as Box<dyn rusqlite::types::ToSql>)
                .chain(extra_params.into_iter()),
        ),
        |row| {
            Ok(IssueSnapshotListItem {
                issue_id: row.get(0)?,
                snapshot_date: row.get(1)?,
                key: row.get(2)?,
                title: row.get(3)?,
                status_name: row.get(4)?,
                state: row.get(5)?,
                assignee_display_name: row.get(6)?,
                priority_name: row.get(7)?,
                project_key: row.get(8)?,
            })
        },
    )?;
    rows.collect()
}

/// INSERT a new snapshot job and return the job id.
pub fn start_snapshot_job(
    conn: &Connection,
    input: &IssueSnapshotJobStartInput,
) -> rusqlite::Result<String> {
    conn.execute(
        "INSERT INTO issue_snapshot_jobs (
            id, source_system_id, job_kind, status, started_at,
            target_start_date, target_end_date, progress_json
         ) VALUES (?1, ?2, ?3, 'running', ?4, ?5, ?6, ?7)",
        params![
            input.id,
            input.source_system_id,
            input.job_kind,
            input.started_at,
            input.target_start_date,
            input.target_end_date,
            input.progress_json,
        ],
    )?;
    Ok(input.id.clone())
}

/// UPDATE progress_json and status for an in-flight job.
pub fn update_snapshot_job_progress(
    conn: &Connection,
    job_id: &str,
    status: &str,
    progress_json: &str,
    error_summary: Option<&str>,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE issue_snapshot_jobs
         SET status = ?1, progress_json = ?2, error_summary = ?3
         WHERE id = ?4",
        params![status, progress_json, error_summary, job_id],
    )?;
    Ok(())
}

/// UPDATE finished_at, status, progress_json, and error_summary when a job completes.
pub fn finish_snapshot_job(
    conn: &Connection,
    job_id: &str,
    status: &str,
    finished_at: &str,
    progress_json: &str,
    error_summary: Option<&str>,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE issue_snapshot_jobs
         SET status = ?1, finished_at = ?2, progress_json = ?3, error_summary = ?4
         WHERE id = ?5",
        params![status, finished_at, progress_json, error_summary, job_id],
    )?;
    Ok(())
}

/// Load retention config from shared_settings. Returns the default if no value is stored.
pub fn load_retention_config(conn: &Connection) -> Result<IssueHistoryRetentionConfig, IssueHistoryError> {
    match crate::settings::shared::shared_settings_get(conn, ISSUE_HISTORY_RETENTION_KEY) {
        Ok(Some(value)) => {
            serde_json::from_value(value).map_err(|e| {
                IssueHistoryError::Storage(rusqlite::Error::ToSqlConversionFailure(Box::new(
                    std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string()),
                )))
            })
        }
        Ok(None) => Ok(IssueHistoryRetentionConfig::default()),
        Err(e) => {
            eprintln!("[history] load_retention_config error (using defaults): {e}");
            Ok(IssueHistoryRetentionConfig::default())
        }
    }
}

/// Validate and save the retention config to shared_settings.
/// Returns `IssueHistoryError::InvalidConfig` on validation failure.
pub fn save_retention_config(
    conn: &Connection,
    config: &IssueHistoryRetentionConfig,
) -> Result<(), IssueHistoryError> {
    if config.daily_days == 0 || config.compact_to_weekly_after_days == 0 {
        return Err(IssueHistoryError::InvalidConfig(
            "daily_days and compact_to_weekly_after_days must be greater than zero".to_string(),
        ));
    }
    if config.weekly_anchor != "monday" {
        return Err(IssueHistoryError::InvalidConfig(
            format!("weekly_anchor '{}' is not supported; use 'monday'", config.weekly_anchor),
        ));
    }

    let value = serde_json::to_value(config).map_err(|e| {
        IssueHistoryError::InvalidConfig(e.to_string())
    })?;

    crate::settings::shared::shared_settings_set(conn, ISSUE_HISTORY_RETENTION_KEY, &value)
        .map_err(|e| IssueHistoryError::InvalidConfig(e.to_string()))
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn insert_test_source_system(conn: &Connection) {
        conn.execute(
            "INSERT INTO source_systems (id, kind, deployment_kind, display_name, base_url, config_source_id, created_at, updated_at)
             VALUES ('srcsys_jira_1', 'jira', 'datacenter', 'Test Jira', 'https://jira.example.com', 'primary', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            [],
        ).unwrap();
    }

    fn insert_test_work_item(conn: &Connection) {
        conn.execute(
            "INSERT INTO work_items (id, source_system_id, source_kind, upstream_id, key, title, state, raw_updated_hash, last_seen_at, created_at, updated_at)
             VALUES ('wi_amp_1043', 'srcsys_jira_1', 'jira_issue', 'AMP-1043', 'AMP-1043', 'Fix the widget', 'open', 'abc123', '2026-05-28T00:00:00Z', '2026-05-28T00:00:00Z', '2026-05-28T00:00:00Z')",
            [],
        ).unwrap();
    }

    fn conn_with_issue() -> Connection {
        let conn = crate::db::open_in_memory().unwrap();
        insert_test_source_system(&conn);
        insert_test_work_item(&conn);
        conn
    }

    fn status_event_input(actor: &str, payload: &str) -> IssueEventInput {
        IssueEventInput {
            id: "iev_test1".to_string(),
            source_system_id: "srcsys_jira_1".to_string(),
            issue_id: "wi_amp_1043".to_string(),
            entity_type: "jira_issue".to_string(),
            entity_id: "wi_amp_1043".to_string(),
            source_kind: "jira".to_string(),
            event_type: "status_changed".to_string(),
            upstream_event_id: Some("30001".to_string()),
            upstream_item_id: Some("30001_0".to_string()),
            field_id: None,
            field_name: Some("status".to_string()),
            actor_identity_id: None,
            actor_display_name: Some(actor.to_string()),
            occurred_at: "2026-05-27T14:18:00Z".to_string(),
            from_string: Some("To Do".to_string()),
            to_string: Some("In Progress".to_string()),
            from_json: None,
            to_json: None,
            payload_json: payload.to_string(),
            ingested_at: "2026-05-28T00:00:00Z".to_string(),
        }
    }

    fn snapshot_input(date: &str, status: &str, labels_json: &str) -> IssueSnapshotInput {
        IssueSnapshotInput {
            issue_id: "wi_amp_1043".to_string(),
            snapshot_date: date.to_string(),
            source_system_id: "srcsys_jira_1".to_string(),
            source_kind: "jira_issue".to_string(),
            key: Some("AMP-1043".to_string()),
            title: "Fix the widget".to_string(),
            body_hash: None,
            state: "in_progress".to_string(),
            status_name: Some(status.to_string()),
            status_id: None,
            resolution_name: None,
            resolution_id: None,
            priority_name: None,
            priority_id: None,
            item_type: None,
            project_key: Some("AMP".to_string()),
            project_name: None,
            assignee_person_id: None,
            reporter_person_id: None,
            labels_json: labels_json.to_string(),
            components_json: "[]".to_string(),
            fix_versions_json: "[]".to_string(),
            sprint_names_json: "[]".to_string(),
            product_names_json: "[]".to_string(),
            assigned_team_names_json: "[]".to_string(),
            customer_name: None,
            parent_link: None,
            epic_link: None,
            epic_name: None,
            epic_status: None,
            created_at_source: None,
            updated_at_source: None,
            resolved_at_source: None,
            due_at_source: None,
            snapshot_source: "generated".to_string(),
            generated_at: "2026-05-28T12:00:00Z".to_string(),
        }
    }

    fn snapshot_query(date: &str) -> IssueSnapshotQuery {
        IssueSnapshotQuery {
            snapshot_date: date.to_string(),
            source_id: None,
            project_key: None,
            status_name: None,
            state: None,
            assignee_person_id: None,
            priority_name: None,
            label: None,
            sprint_name: None,
            product_name: None,
            customer_name: None,
            limit: None,
        }
    }

    #[test]
    fn upsert_event_is_idempotent_and_refreshes_actor_payload() {
        let conn = conn_with_issue();
        let mut input = status_event_input("Alice", r#"{"field":"status"}"#);
        upsert_issue_event(&conn, &input).unwrap();
        input.actor_display_name = Some("Alice Smith".to_string());
        input.payload_json = r#"{"field":"status","fieldtype":"jira"}"#.to_string();
        upsert_issue_event(&conn, &input).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM issue_events", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1, "upsert should not duplicate");
        let rows = list_issue_events_by_type(&conn, "wi_amp_1043", "status_changed", 10).unwrap();
        assert_eq!(rows[0].actor_display_name.as_deref(), Some("Alice Smith"));
    }

    #[test]
    fn snapshot_upsert_and_query_filters_round_trip() {
        let conn = conn_with_issue();
        upsert_issue_snapshot(
            &conn,
            &snapshot_input("2026-05-27", "In Progress", r#"["backend"]"#),
        )
        .unwrap();
        let rows = query_issue_snapshots(&conn, &snapshot_query("2026-05-27")).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].key.as_deref(), Some("AMP-1043"));
    }

    #[test]
    fn retention_config_defaults_and_round_trip() {
        let conn = conn_with_issue();
        assert_eq!(
            load_retention_config(&conn).unwrap(),
            IssueHistoryRetentionConfig::default()
        );
        let custom = IssueHistoryRetentionConfig {
            version: 1,
            daily_days: 180,
            compact_to_weekly_after_days: 180,
            weekly_anchor: "monday".to_string(),
        };
        save_retention_config(&conn, &custom).unwrap();
        assert_eq!(load_retention_config(&conn).unwrap(), custom);
    }

    // Task 1.3 error tests

    #[test]
    fn history_error_display_redacts_token_shaped_values() {
        let err = IssueHistoryError::Projection(
            "Bearer abcdefghijklmnopqrstuvwxyz123456".to_string(),
        );
        let rendered = err.to_string();
        assert!(!rendered.contains("Bearer"));
        assert!(!rendered.contains("abcdefghijklmnopqrstuvwxyz"));
        assert_eq!(
            rendered,
            "Issue history could not be updated. Try syncing Jira again."
        );
    }

    #[test]
    fn history_error_display_keeps_command_errors_short() {
        let err = IssueHistoryError::Storage(rusqlite::Error::InvalidQuery);
        assert_eq!(
            err.to_string(),
            "Could not read issue history. Try syncing Jira again."
        );
    }
}
