//! Bookkeeping helpers for `ingestion_runs` and `ingestion_cursors`.
//!
//! These functions are thin, idempotent wrappers around plain SQL. They take a
//! `&rusqlite::Connection` directly so they can be exercised from unit tests
//! against `crate::db::open_in_memory()`.
//!
//! Rusqlite errors bubble up via `?` into [`IngestionError`] using the
//! `From<rusqlite::Error>` impl in `crate::ingestion::errors`, which collapses
//! storage errors to the `Storage` category with an empty safe message.

use rusqlite::{params, Connection};

use crate::ingestion::errors::IngestionError;

/// A snapshot row read from `ingestion_runs` by [`latest_run`].
#[derive(Debug, Clone)]
pub struct LatestRunRow {
    pub id: String,
    pub status: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub progress_json: String,
    pub counts_json: String,
    pub error_summary: Option<String>,
    pub cancellation_requested_at: Option<String>,
}

/// A snapshot row read from `ingestion_cursors` by [`read_cursor`].
#[derive(Debug, Clone)]
pub struct CursorRow {
    pub cursor_value: String,
    pub last_successful_sync_at: Option<String>,
    pub updated_at: String,
}

/// Insert a new `ingestion_runs` row with `status = 'running'` and empty
/// progress / counts JSON.
pub fn start_run(
    conn: &Connection,
    run_id: &str,
    source_system_id: &str,
    connector: &str,
    started_at: &str,
    requested_projects_json: &str,
) -> Result<(), IngestionError> {
    conn.execute(
        "INSERT INTO ingestion_runs
            (id, source_system_id, connector, status, started_at,
             requested_projects_json, progress_json, counts_json)
         VALUES (?1, ?2, ?3, 'running', ?4, ?5, '{}', '{}')",
        params![
            run_id,
            source_system_id,
            connector,
            started_at,
            requested_projects_json,
        ],
    )?;
    Ok(())
}

/// Overwrite the `progress_json` and `counts_json` fields for a run.
pub fn update_progress(
    conn: &Connection,
    run_id: &str,
    progress_json: &str,
    counts_json: &str,
) -> Result<(), IngestionError> {
    conn.execute(
        "UPDATE ingestion_runs SET progress_json = ?1, counts_json = ?2 WHERE id = ?3",
        params![progress_json, counts_json, run_id],
    )?;
    Ok(())
}

/// Mark a run as finished. `status` should be one of
/// `"succeeded" | "partial" | "failed" | "cancelled"`. `error_summary` is the
/// scrubbed `Display` of the terminal error when applicable.
pub fn finish_run(
    conn: &Connection,
    run_id: &str,
    finished_at: &str,
    status: &str,
    counts_json: &str,
    error_summary: Option<&str>,
) -> Result<(), IngestionError> {
    conn.execute(
        "UPDATE ingestion_runs SET
            status = ?1,
            finished_at = ?2,
            counts_json = ?3,
            error_summary = ?4
         WHERE id = ?5",
        params![status, finished_at, counts_json, error_summary, run_id],
    )?;
    Ok(())
}

/// Stamp a cancellation request timestamp on a run. Does not change `status` —
/// the caller flushes that via [`finish_run`] when the loop exits.
pub fn mark_cancellation_requested(
    conn: &Connection,
    run_id: &str,
    when_utc: &str,
) -> Result<(), IngestionError> {
    conn.execute(
        "UPDATE ingestion_runs SET cancellation_requested_at = ?1 WHERE id = ?2",
        params![when_utc, run_id],
    )?;
    Ok(())
}

/// Return the most-recently-started run for the (`source_system_id`,
/// `connector`) pair, or `None` if there are no rows.
pub fn latest_run(
    conn: &Connection,
    source_system_id: &str,
    connector: &str,
) -> Result<Option<LatestRunRow>, IngestionError> {
    let mut stmt = conn.prepare(
        "SELECT id, status, started_at, finished_at, progress_json, counts_json,
                error_summary, cancellation_requested_at
           FROM ingestion_runs
          WHERE source_system_id = ?1 AND connector = ?2
          ORDER BY started_at DESC
          LIMIT 1",
    )?;
    let mut rows = stmt.query(params![source_system_id, connector])?;
    if let Some(row) = rows.next()? {
        Ok(Some(LatestRunRow {
            id: row.get(0)?,
            status: row.get(1)?,
            started_at: row.get(2)?,
            finished_at: row.get(3)?,
            progress_json: row.get(4)?,
            counts_json: row.get(5)?,
            error_summary: row.get(6)?,
            cancellation_requested_at: row.get(7)?,
        }))
    } else {
        Ok(None)
    }
}

/// Idempotently upsert an `ingestion_cursors` row keyed by
/// `(source_system_id, connector, cursor_key)`.
pub fn upsert_cursor(
    conn: &Connection,
    source_system_id: &str,
    connector: &str,
    cursor_key: &str,
    cursor_value: &str,
    last_successful_sync_at: Option<&str>,
    updated_at: &str,
) -> Result<(), IngestionError> {
    conn.execute(
        "INSERT INTO ingestion_cursors
            (source_system_id, connector, cursor_key, cursor_value,
             last_successful_sync_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(source_system_id, connector, cursor_key) DO UPDATE SET
            cursor_value = excluded.cursor_value,
            last_successful_sync_at = excluded.last_successful_sync_at,
            updated_at = excluded.updated_at",
        params![
            source_system_id,
            connector,
            cursor_key,
            cursor_value,
            last_successful_sync_at,
            updated_at,
        ],
    )?;
    Ok(())
}

/// Read a single cursor row, or `None` if it has never been written.
pub fn read_cursor(
    conn: &Connection,
    source_system_id: &str,
    connector: &str,
    cursor_key: &str,
) -> Result<Option<CursorRow>, IngestionError> {
    let mut stmt = conn.prepare(
        "SELECT cursor_value, last_successful_sync_at, updated_at
           FROM ingestion_cursors
          WHERE source_system_id = ?1 AND connector = ?2 AND cursor_key = ?3",
    )?;
    let mut rows = stmt.query(params![source_system_id, connector, cursor_key])?;
    if let Some(row) = rows.next()? {
        Ok(Some(CursorRow {
            cursor_value: row.get(0)?,
            last_successful_sync_at: row.get(1)?,
            updated_at: row.get(2)?,
        }))
    } else {
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::issues::repository::{upsert_source_system, SourceSystemInput};

    const NOW: &str = "2026-05-25T17:00:00Z";
    const SRC: &str = "srcsys_runs";
    const CONNECTOR: &str = "jira.issue";

    fn seed_source(conn: &Connection) {
        upsert_source_system(
            conn,
            NOW,
            &SourceSystemInput {
                id: SRC,
                kind: "jira",
                deployment_kind: Some("server"),
                display_name: "AMP Jira",
                base_url: Some("https://jira.example.invalid"),
                config_source_id: Some("src_jira"),
            },
        )
        .expect("seed source_system");
    }

    #[test]
    fn start_run_persists_running_row() {
        let conn = open_in_memory().expect("db");
        seed_source(&conn);
        start_run(&conn, "run_1", SRC, CONNECTOR, NOW, r#"["AMP"]"#).expect("start");

        let (status, progress, counts): (String, String, String) = conn
            .query_row(
                "SELECT status, progress_json, counts_json FROM ingestion_runs WHERE id = 'run_1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .expect("query");
        assert_eq!(status, "running");
        assert_eq!(progress, "{}");
        assert_eq!(counts, "{}");
    }

    #[test]
    fn update_progress_overwrites_json_fields() {
        let conn = open_in_memory().expect("db");
        seed_source(&conn);
        start_run(&conn, "run_2", SRC, CONNECTOR, NOW, r#"["AMP"]"#).expect("start");
        update_progress(
            &conn,
            "run_2",
            r#"{"phase":"searching","current_page":1}"#,
            r#"{"saved_issues":12}"#,
        )
        .expect("update");
        let (progress, counts): (String, String) = conn
            .query_row(
                "SELECT progress_json, counts_json FROM ingestion_runs WHERE id = 'run_2'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .expect("query");
        assert!(progress.contains("\"current_page\":1"));
        assert!(counts.contains("\"saved_issues\":12"));
    }

    #[test]
    fn finish_run_marks_status_finished_at_and_error_summary() {
        let conn = open_in_memory().expect("db");
        seed_source(&conn);
        start_run(&conn, "run_3", SRC, CONNECTOR, NOW, r#"["AMP"]"#).expect("start");
        finish_run(
            &conn,
            "run_3",
            "2026-05-25T18:00:00Z",
            "partial",
            r#"{"saved_issues":4}"#,
            Some("Network error"),
        )
        .expect("finish");
        let (status, finished_at, counts, error_summary): (
            String,
            Option<String>,
            String,
            Option<String>,
        ) = conn
            .query_row(
                "SELECT status, finished_at, counts_json, error_summary FROM ingestion_runs WHERE id = 'run_3'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .expect("query");
        assert_eq!(status, "partial");
        assert_eq!(finished_at.as_deref(), Some("2026-05-25T18:00:00Z"));
        assert!(counts.contains("\"saved_issues\":4"));
        assert_eq!(error_summary.as_deref(), Some("Network error"));
    }

    #[test]
    fn mark_cancellation_requested_sets_timestamp() {
        let conn = open_in_memory().expect("db");
        seed_source(&conn);
        start_run(&conn, "run_4", SRC, CONNECTOR, NOW, r#"["AMP"]"#).expect("start");
        mark_cancellation_requested(&conn, "run_4", "2026-05-25T18:30:00Z").expect("cancel");
        let ts: Option<String> = conn
            .query_row(
                "SELECT cancellation_requested_at FROM ingestion_runs WHERE id = 'run_4'",
                [],
                |r| r.get(0),
            )
            .expect("query");
        assert_eq!(ts.as_deref(), Some("2026-05-25T18:30:00Z"));
    }

    #[test]
    fn latest_run_returns_most_recent() {
        let conn = open_in_memory().expect("db");
        seed_source(&conn);
        start_run(&conn, "run_a", SRC, CONNECTOR, "2026-05-25T10:00:00Z", "[]").expect("a");
        start_run(&conn, "run_b", SRC, CONNECTOR, "2026-05-25T12:00:00Z", "[]").expect("b");
        start_run(&conn, "run_c", SRC, CONNECTOR, "2026-05-25T11:00:00Z", "[]").expect("c");

        let latest = latest_run(&conn, SRC, CONNECTOR)
            .expect("latest_run")
            .expect("some row");
        assert_eq!(latest.id, "run_b");
        assert_eq!(latest.started_at, "2026-05-25T12:00:00Z");
        assert_eq!(latest.status, "running");

        // Different connector with no rows returns None.
        let none = latest_run(&conn, SRC, "jira.other").expect("latest none");
        assert!(none.is_none());
    }

    #[test]
    fn upsert_cursor_is_idempotent_and_keys_are_independent() {
        let conn = open_in_memory().expect("db");
        seed_source(&conn);
        upsert_cursor(
            &conn,
            SRC,
            CONNECTOR,
            "project:AMP:issues",
            r#"{"last_updated":"2026-05-22T10:00:00Z"}"#,
            Some(NOW),
            NOW,
        )
        .expect("amp");
        upsert_cursor(
            &conn,
            SRC,
            CONNECTOR,
            "project:OPS:issues",
            r#"{"last_updated":"2026-05-20T00:00:00Z"}"#,
            Some(NOW),
            NOW,
        )
        .expect("ops");
        upsert_cursor(
            &conn,
            SRC,
            CONNECTOR,
            "project:HM:issues",
            r#"{"last_updated":"2026-05-15T00:00:00Z"}"#,
            Some(NOW),
            NOW,
        )
        .expect("hm");

        // Update one cursor only.
        upsert_cursor(
            &conn,
            SRC,
            CONNECTOR,
            "project:AMP:issues",
            r#"{"last_updated":"2026-05-25T10:00:00Z"}"#,
            Some(NOW),
            NOW,
        )
        .expect("amp-update");

        let amp = read_cursor(&conn, SRC, CONNECTOR, "project:AMP:issues")
            .expect("read amp")
            .expect("some");
        assert_eq!(
            amp.cursor_value,
            r#"{"last_updated":"2026-05-25T10:00:00Z"}"#
        );

        let ops = read_cursor(&conn, SRC, CONNECTOR, "project:OPS:issues")
            .expect("read ops")
            .expect("some");
        assert_eq!(
            ops.cursor_value, r#"{"last_updated":"2026-05-20T00:00:00Z"}"#,
            "OPS cursor must be untouched by AMP update"
        );

        let hm = read_cursor(&conn, SRC, CONNECTOR, "project:HM:issues")
            .expect("read hm")
            .expect("some");
        assert_eq!(
            hm.cursor_value, r#"{"last_updated":"2026-05-15T00:00:00Z"}"#,
            "HM cursor must be untouched by AMP update"
        );

        // Total cursor count should be 3 (one per key).
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM ingestion_cursors WHERE source_system_id = ?1",
                params![SRC],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(count, 3);
    }

    #[test]
    fn read_cursor_missing_row_returns_none() {
        let conn = open_in_memory().expect("db");
        seed_source(&conn);
        let none = read_cursor(&conn, SRC, CONNECTOR, "missing").expect("read");
        assert!(none.is_none());
    }
}
