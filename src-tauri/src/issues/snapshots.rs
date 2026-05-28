//! Snapshot state folding: projects `issue_events` into daily `issue_snapshots`.
//!
//! The core operation is `fold_events_to_day_end`, which takes a base `SnapshotState`
//! (usually loaded from `work_items` + `jira_issues`) and applies all events up to
//! 23:59:59 on the given date to produce the issue's state at end-of-day.
//!
//! `generate_snapshots_for_range` iterates all issues for a source system and
//! writes one snapshot row per issue per date.

use rusqlite::{params, Connection};
use serde_json;

use crate::issues::history::{
    coarse_state, query_issue_events_for_issue, upsert_issue_snapshot, IssueEventRow,
    IssueHistoryError, IssueSnapshotInput,
};

// ── Working state type ────────────────────────────────────────────────────────

/// The working state during snapshot folding.  This mirrors the columns of
/// `issue_snapshots` but uses owned `Vec<String>` for multi-value fields so
/// that `apply_event` can update them cheaply.
#[derive(Debug, Clone)]
pub struct SnapshotState {
    pub issue_id: String,
    pub source_system_id: String,
    pub source_kind: String,
    pub key: Option<String>,
    pub title: String,
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
    pub labels: Vec<String>,
    pub components: Vec<String>,
    pub fix_versions: Vec<String>,
    pub sprint_names: Vec<String>,
    pub product_names: Vec<String>,
    pub assigned_team_names: Vec<String>,
    pub customer_name: Option<String>,
    pub parent_link: Option<String>,
    pub epic_link: Option<String>,
    pub epic_name: Option<String>,
    pub epic_status: Option<String>,
    pub created_at_source: Option<String>,
    pub updated_at_source: Option<String>,
    pub resolved_at_source: Option<String>,
    pub due_at_source: Option<String>,
    pub body_hash: Option<String>,
}

/// Parse a comma-separated string into a sorted, trimmed, deduplicated vec.
fn parse_csv(raw: &str) -> Vec<String> {
    let mut items: Vec<String> = raw
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    items.sort();
    items.dedup();
    items
}

// ── Event application ────────────────────────────────────────────────────────

/// Apply a single event to `state`, mutating it in place.
fn apply_event(state: &mut SnapshotState, event: &IssueEventRow) {
    match event.event_type.as_str() {
        "status_changed" => {
            let new_status = event.to_string.clone();
            state.state = coarse_state(new_status.as_deref()).to_string();
            state.status_name = new_status;
            // status_id: use field_id from the event as a proxy when available,
            // but the changelog does not carry a status ID, so leave unchanged.
        }
        "priority_changed" => {
            state.priority_name = event.to_string.clone();
            // priority_id: not available in event rows; leave unchanged.
        }
        "resolution_changed" => {
            let new_res = event.to_string.clone();
            if new_res.as_deref().map_or(false, |s| !s.is_empty()) {
                state.state = "done".to_string();
            }
            state.resolution_name = new_res;
        }
        "title_changed" => {
            if let Some(new_title) = &event.to_string {
                state.title = new_title.clone();
            }
        }
        "labels_changed" => {
            state.labels = event
                .to_string
                .as_deref()
                .map(parse_csv)
                .unwrap_or_default();
        }
        "components_changed" => {
            state.components = event
                .to_string
                .as_deref()
                .map(parse_csv)
                .unwrap_or_default();
        }
        "fix_versions_changed" => {
            state.fix_versions = event
                .to_string
                .as_deref()
                .map(parse_csv)
                .unwrap_or_default();
        }
        "sprint_changed" => {
            state.sprint_names = event
                .to_string
                .as_deref()
                .map(parse_csv)
                .unwrap_or_default();
        }
        "product_changed" => {
            state.product_names = event
                .to_string
                .as_deref()
                .map(parse_csv)
                .unwrap_or_default();
        }
        "assigned_teams_changed" => {
            state.assigned_team_names = event
                .to_string
                .as_deref()
                .map(parse_csv)
                .unwrap_or_default();
        }
        "customer_changed" => {
            state.customer_name = event.to_string.clone();
        }
        "relationship_field_changed" => {
            if let Some(field_id) = &event.field_id {
                match field_id.as_str() {
                    "customfield_14051" => state.parent_link = event.to_string.clone(),
                    "customfield_10857" => state.epic_link = event.to_string.clone(),
                    "customfield_10858" => state.epic_name = event.to_string.clone(),
                    "customfield_10859" => state.epic_status = event.to_string.clone(),
                    _ => {}
                }
            }
        }
        "due_date_changed" => {
            state.due_at_source = event.to_string.clone();
        }
        // field_changed has no snapshot effect
        _ => {}
    }
}

// ── Core fold function ────────────────────────────────────────────────────────

/// Fold all events in `events` that occurred on or before the end of
/// `snapshot_date` (i.e. ≤ `{snapshot_date}T23:59:59`) into `state`.
///
/// Events are processed in `occurred_at` ASC order, with `id` as a tiebreaker.
pub fn fold_events_to_day_end(
    mut state: SnapshotState,
    events: &[IssueEventRow],
    snapshot_date: &str,
) -> SnapshotState {
    let day_end_prefix = format!("{snapshot_date}T23:59:59");
    let mut ordered = events.to_vec();
    ordered.sort_by(|a, b| {
        a.occurred_at
            .cmp(&b.occurred_at)
            .then(a.id.cmp(&b.id))
    });
    for event in &ordered {
        if event.occurred_at.as_str() > day_end_prefix.as_str() {
            continue;
        }
        apply_event(&mut state, event);
    }
    state
}

// ── Conversion to IssueSnapshotInput ─────────────────────────────────────────

/// Convert a `SnapshotState` into an `IssueSnapshotInput` ready for upsert.
/// Serializes `Vec<String>` fields to JSON arrays.
pub fn snapshot_input_from_state(
    state: SnapshotState,
    snapshot_date: &str,
    snapshot_source: &str,
    generated_at: &str,
) -> Result<IssueSnapshotInput, IssueHistoryError> {
    let serialize = |v: &Vec<String>| -> Result<String, IssueHistoryError> {
        serde_json::to_string(v).map_err(|e| IssueHistoryError::Projection(e.to_string()))
    };

    Ok(IssueSnapshotInput {
        issue_id: state.issue_id,
        snapshot_date: snapshot_date.to_string(),
        source_system_id: state.source_system_id,
        source_kind: state.source_kind,
        key: state.key,
        title: state.title,
        body_hash: state.body_hash,
        state: state.state,
        status_name: state.status_name,
        status_id: state.status_id,
        resolution_name: state.resolution_name,
        resolution_id: state.resolution_id,
        priority_name: state.priority_name,
        priority_id: state.priority_id,
        item_type: state.item_type,
        project_key: state.project_key,
        project_name: state.project_name,
        assignee_person_id: state.assignee_person_id,
        reporter_person_id: state.reporter_person_id,
        labels_json: serialize(&state.labels)?,
        components_json: serialize(&state.components)?,
        fix_versions_json: serialize(&state.fix_versions)?,
        sprint_names_json: serialize(&state.sprint_names)?,
        product_names_json: serialize(&state.product_names)?,
        assigned_team_names_json: serialize(&state.assigned_team_names)?,
        customer_name: state.customer_name,
        parent_link: state.parent_link,
        epic_link: state.epic_link,
        epic_name: state.epic_name,
        epic_status: state.epic_status,
        created_at_source: state.created_at_source,
        updated_at_source: state.updated_at_source,
        resolved_at_source: state.resolved_at_source,
        due_at_source: state.due_at_source,
        snapshot_source: snapshot_source.to_string(),
        generated_at: generated_at.to_string(),
    })
}

// ── Date range iteration helper ───────────────────────────────────────────────

/// Iterate dates from `start_date` to `end_date` (inclusive), both `YYYY-MM-DD`.
/// Uses simple string arithmetic — valid for the foreseeable range of dates.
fn dates_in_range(start_date: &str, end_date: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = start_date.to_string();
    while current.as_str() <= end_date {
        result.push(current.clone());
        current = next_date(&current);
    }
    result
}

/// Increment a `YYYY-MM-DD` string by one day using the `time` crate is not
/// available here; instead use a simple carry-based algorithm.
fn next_date(date: &str) -> String {
    let parts: Vec<&str> = date.split('-').collect();
    if parts.len() != 3 {
        return date.to_string();
    }
    let Ok(y) = parts[0].parse::<u32>() else {
        return date.to_string();
    };
    let Ok(m) = parts[1].parse::<u32>() else {
        return date.to_string();
    };
    let Ok(d) = parts[2].parse::<u32>() else {
        return date.to_string();
    };

    let days_in_month = days_in_month(y, m);
    let (ny, nm, nd) = if d >= days_in_month {
        if m == 12 {
            (y + 1, 1, 1)
        } else {
            (y, m + 1, 1)
        }
    } else {
        (y, m, d + 1)
    };
    format!("{ny:04}-{nm:02}-{nd:02}")
}

fn is_leap_year(y: u32) -> bool {
    (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0)
}

fn days_in_month(y: u32, m: u32) -> u32 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if is_leap_year(y) {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}

// ── Load base state from DB ──────────────────────────────────────────────────

/// Load the initial `SnapshotState` for an issue from `work_items`, `jira_issues`,
/// and `work_item_terms`.  This is the "as ingested" state, before any events are
/// applied.  Events are then folded on top to get the state at a specific date.
fn load_base_state(
    conn: &Connection,
    issue_id: &str,
) -> Result<Option<SnapshotState>, IssueHistoryError> {
    let row = conn.query_row(
        "SELECT
            w.id, w.source_system_id, w.source_kind, w.key, w.title, w.state,
            w.status_name, w.resolution_name, w.priority_name, w.item_type,
            w.project_key, w.project_name,
            w.assignee_person_id, w.reporter_person_id,
            w.created_at_source, w.updated_at_source, w.resolved_at_source, w.due_at_source,
            j.status_id, j.resolution_id, j.priority_id,
            j.sprint_names_json, j.product_names_json, j.assigned_team_names_json,
            j.customer_name, j.parent_link, j.epic_link, j.epic_name, j.epic_status
         FROM work_items w
         LEFT JOIN jira_issues j ON j.work_item_id = w.id
         WHERE w.id = ?1",
        params![issue_id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,   // issue_id
                row.get::<_, String>(1)?,   // source_system_id
                row.get::<_, String>(2)?,   // source_kind
                row.get::<_, Option<String>>(3)?, // key
                row.get::<_, String>(4)?,   // title
                row.get::<_, String>(5)?,   // state
                row.get::<_, Option<String>>(6)?, // status_name
                row.get::<_, Option<String>>(7)?, // resolution_name
                row.get::<_, Option<String>>(8)?, // priority_name
                row.get::<_, Option<String>>(9)?, // item_type
                row.get::<_, Option<String>>(10)?, // project_key
                row.get::<_, Option<String>>(11)?, // project_name
                row.get::<_, Option<String>>(12)?, // assignee_person_id
                row.get::<_, Option<String>>(13)?, // reporter_person_id
                row.get::<_, Option<String>>(14)?, // created_at_source
                row.get::<_, Option<String>>(15)?, // updated_at_source
                row.get::<_, Option<String>>(16)?, // resolved_at_source
                row.get::<_, Option<String>>(17)?, // due_at_source
                row.get::<_, Option<String>>(18)?, // status_id
                row.get::<_, Option<String>>(19)?, // resolution_id
                row.get::<_, Option<String>>(20)?, // priority_id
                row.get::<_, Option<String>>(21)?, // sprint_names_json
                row.get::<_, Option<String>>(22)?, // product_names_json
                row.get::<_, Option<String>>(23)?, // assigned_team_names_json
                row.get::<_, Option<String>>(24)?, // customer_name
                row.get::<_, Option<String>>(25)?, // parent_link
                row.get::<_, Option<String>>(26)?, // epic_link
                row.get::<_, Option<String>>(27)?, // epic_name
                row.get::<_, Option<String>>(28)?, // epic_status
            ))
        },
    );

    let row = match row {
        Ok(r) => r,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
        Err(e) => return Err(IssueHistoryError::from(e)),
    };

    let parse_json_array = |opt: Option<String>| -> Vec<String> {
        opt.and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok())
            .unwrap_or_default()
    };

    // Load labels, components, fix_versions from work_item_terms
    let labels = load_terms(conn, &row.0, "label")?;
    let components = load_terms(conn, &row.0, "component")?;
    let fix_versions = load_terms(conn, &row.0, "fix_version")?;

    Ok(Some(SnapshotState {
        issue_id: row.0,
        source_system_id: row.1,
        source_kind: row.2,
        key: row.3,
        title: row.4,
        state: row.5,
        status_name: row.6,
        status_id: row.18,
        resolution_name: row.7,
        resolution_id: row.19,
        priority_name: row.8,
        priority_id: row.20,
        item_type: row.9,
        project_key: row.10,
        project_name: row.11,
        assignee_person_id: row.12,
        reporter_person_id: row.13,
        labels,
        components,
        fix_versions,
        sprint_names: parse_json_array(row.21),
        product_names: parse_json_array(row.22),
        assigned_team_names: parse_json_array(row.23),
        customer_name: row.24,
        parent_link: row.25,
        epic_link: row.26,
        epic_name: row.27,
        epic_status: row.28,
        created_at_source: row.14,
        updated_at_source: row.15,
        resolved_at_source: row.16,
        due_at_source: row.17,
        body_hash: None,
    }))
}

fn load_terms(
    conn: &Connection,
    issue_id: &str,
    term_kind: &str,
) -> Result<Vec<String>, IssueHistoryError> {
    let mut stmt = conn.prepare(
        "SELECT term_name FROM work_item_terms
         WHERE work_item_id = ?1 AND term_kind = ?2
         ORDER BY term_key ASC",
    )?;
    let rows = stmt.query_map(params![issue_id, term_kind], |row| {
        row.get::<_, Option<String>>(0)
    })?;
    let terms: Vec<String> = rows
        .filter_map(|r| r.ok().and_then(|name| name))
        .collect();
    Ok(terms)
}

// ── Replay result type ───────────────────────────────────────────────────────

/// Result returned by `replay_missing_snapshots`.
#[derive(Debug, Clone, PartialEq)]
pub struct SnapshotReplayResult {
    pub generated_dates: Vec<String>,
    pub snapshots_written: usize,
    pub job_id: String,
}

// ── Main range generator ─────────────────────────────────────────────────────

/// Generate (or regenerate) daily snapshots for every issue belonging to
/// `source_system_id` for each date in `[start_date, end_date]` (inclusive).
///
/// The algorithm for each issue:
/// 1. Load the base state from `work_items` + `jira_issues` + `work_item_terms`.
/// 2. Load all `issue_events` for that issue.
/// 3. For each date, fold the events to end-of-day and upsert the snapshot.
///
/// Returns the total number of snapshot rows written.
pub fn generate_snapshots_for_range(
    conn: &Connection,
    source_system_id: &str,
    start_date: &str,
    end_date: &str,
    generated_at: &str,
) -> Result<usize, IssueHistoryError> {
    // Collect all issue IDs for this source system
    let mut stmt = conn.prepare(
        "SELECT id FROM work_items WHERE source_system_id = ?1",
    )?;
    let issue_ids: Vec<String> = stmt
        .query_map(params![source_system_id], |row| row.get(0))?
        .collect::<rusqlite::Result<Vec<String>>>()?;

    let dates = dates_in_range(start_date, end_date);
    let mut total = 0usize;

    for issue_id in &issue_ids {
        let base_state = match load_base_state(conn, issue_id)? {
            Some(s) => s,
            None => continue,
        };

        let events = query_issue_events_for_issue(conn, issue_id)?;

        for date in &dates {
            let folded = fold_events_to_day_end(base_state.clone(), &events, date);
            let input =
                snapshot_input_from_state(folded, date, "generated", generated_at)?;
            upsert_issue_snapshot(conn, &input)?;
            total += 1;
        }
    }

    Ok(total)
}

// ── Replay missing snapshots ─────────────────────────────────────────────────

/// Build the `shared_settings` key used to track the last snapshot date for a
/// project.  Colons are not allowed by `validate_key`, so we use dots.
/// e.g. `"project.AMP.snapshots"`
fn snapshot_cursor_key(project_key: &str) -> String {
    format!("project.{}.snapshots", project_key)
}

/// Replay any missing daily snapshots for `project_key` since the last cursor.
///
/// The cursor (stored in `shared_settings` as a JSON string `"YYYY-MM-DD"`)
/// records the last date for which snapshots were generated.  If the cursor is
/// absent, only today (`current_local_date`) is generated.
///
/// On success the cursor is advanced to `current_local_date` and a
/// [`SnapshotReplayResult`] is returned.
pub fn replay_missing_snapshots(
    conn: &Connection,
    source_system_id: &str,
    project_key: &str,
    current_local_date: &str,
    now_utc: &str,
) -> Result<SnapshotReplayResult, IssueHistoryError> {
    let cursor_key = snapshot_cursor_key(project_key);

    // Read the existing cursor (a JSON-encoded date string).
    let cursor_opt: Option<String> =
        match crate::settings::shared::shared_settings_get(conn, &cursor_key) {
            Ok(Some(v)) => v.as_str().map(|s| s.to_string()),
            Ok(None) => None,
            Err(e) => {
                return Err(IssueHistoryError::Storage(rusqlite::Error::ToSqlConversionFailure(
                    Box::new(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())),
                )));
            }
        };

    // Determine the start date for generation.
    let start_date: String = match cursor_opt.as_deref() {
        Some(cursor) if cursor >= current_local_date => {
            // Already up-to-date — nothing to do.
            // `job_id` is intentionally empty here: no job was created, so
            // there is no ID to return.  Callers should check `generated_dates`
            // is empty (or `snapshots_written == 0`) to detect this fast-path
            // rather than relying on `job_id`.
            return Ok(SnapshotReplayResult {
                generated_dates: vec![],
                snapshots_written: 0,
                job_id: String::new(),
            });
        }
        Some(cursor) => next_date(cursor),
        None => current_local_date.to_string(),
    };

    let dates = dates_in_range(&start_date, current_local_date);

    // Create a job record.
    let job_id = crate::issues::ids::stable_id(
        "snapjob",
        &[source_system_id, project_key, current_local_date, now_utc],
    );
    let job_input = crate::issues::history::IssueSnapshotJobStartInput {
        id: job_id.clone(),
        source_system_id: Some(source_system_id.to_string()),
        job_kind: "replay_missing".to_string(),
        started_at: now_utc.to_string(),
        target_start_date: Some(start_date.clone()),
        target_end_date: Some(current_local_date.to_string()),
        progress_json: serde_json::json!({ "dates": dates.len() }).to_string(),
    };
    crate::issues::history::start_snapshot_job(conn, &job_input)
        .map_err(IssueHistoryError::Storage)?;

    // Generate snapshots for the full missing range.
    let snapshots_written =
        generate_snapshots_for_range(conn, source_system_id, &start_date, current_local_date, now_utc)?;

    // Mark the job done.
    let final_progress = serde_json::json!({
        "dates_generated": dates.len(),
        "snapshots_written": snapshots_written,
    })
    .to_string();
    crate::issues::history::finish_snapshot_job(
        conn,
        &job_id,
        "succeeded",
        now_utc,
        &final_progress,
        None,
    )
    .map_err(IssueHistoryError::Storage)?;

    // Advance the cursor.
    let cursor_value = serde_json::json!(current_local_date);
    crate::settings::shared::shared_settings_set(conn, &cursor_key, &cursor_value).map_err(
        |e| {
            IssueHistoryError::Storage(rusqlite::Error::ToSqlConversionFailure(Box::new(
                std::io::Error::new(std::io::ErrorKind::Other, e.to_string()),
            )))
        },
    )?;

    Ok(SnapshotReplayResult {
        generated_dates: dates,
        snapshots_written,
        job_id,
    })
}

// ── Retention compaction ─────────────────────────────────────────────────────

/// Result returned by `compact_snapshot_retention`.
#[derive(Debug, Clone, PartialEq)]
pub struct RetentionCompactionResult {
    pub kept_daily_rows: usize,
    pub compacted_weekly_rows: usize,
    pub deleted_daily_rows: usize,
    pub job_id: String,
}

/// Return true if the ISO date string `"YYYY-MM-DD"` falls on a Monday.
/// Uses Tomohiko Sakamoto's algorithm: 0=Sunday, 1=Monday, …, 6=Saturday.
fn is_monday(date: &str) -> bool {
    let parts: Vec<&str> = date.splitn(3, '-').collect();
    if parts.len() != 3 {
        return false;
    }
    let y: i32 = parts[0].parse().unwrap_or(0);
    let m: u32 = parts[1].parse().unwrap_or(0);
    let d: u32 = parts[2].parse().unwrap_or(0);
    if m == 0 || d == 0 {
        return false;
    }
    let t = [0i32, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    let y = if m < 3 { y - 1 } else { y };
    let dow = (y + y / 4 - y / 100 + y / 400 + t[(m as usize) - 1] + d as i32) % 7;
    dow == 1 // 1 = Monday
}

/// Subtract `n` days from a `YYYY-MM-DD` string.
fn prev_date_n(date: &str, n: u32) -> String {
    let mut current = date.to_string();
    for _ in 0..n {
        current = prev_date(&current);
    }
    current
}

/// Decrement a `YYYY-MM-DD` string by one day.
fn prev_date(date: &str) -> String {
    let parts: Vec<&str> = date.split('-').collect();
    if parts.len() != 3 {
        return date.to_string();
    }
    let Ok(y) = parts[0].parse::<u32>() else {
        return date.to_string();
    };
    let Ok(m) = parts[1].parse::<u32>() else {
        return date.to_string();
    };
    let Ok(d) = parts[2].parse::<u32>() else {
        return date.to_string();
    };

    if d > 1 {
        format!("{y:04}-{m:02}-{:02}", d - 1)
    } else if m > 1 {
        let prev_m = m - 1;
        let prev_d = days_in_month(y, prev_m);
        format!("{y:04}-{prev_m:02}-{prev_d:02}")
    } else {
        let prev_y = y - 1;
        format!("{prev_y:04}-12-31")
    }
}

use crate::issues::history::IssueHistoryRetentionConfig;

/// Compact old snapshot rows for `source_system_id`:
/// - Keep rows in the recent daily window (last `config.daily_days` days) as-is.
/// - For older rows: keep Monday rows (updating `snapshot_source` to
///   `'compacted_weekly'`) and delete all other non-Monday rows.
/// - Never touches `issue_events`.
pub fn compact_snapshot_retention(
    conn: &Connection,
    source_system_id: &str,
    current_local_date: &str,
    config: &IssueHistoryRetentionConfig,
    now_utc: &str,
) -> Result<RetentionCompactionResult, IssueHistoryError> {
    // 1. Create a retention_compaction job row.
    let job_id = crate::issues::ids::stable_id(
        "retjob",
        &[source_system_id, current_local_date, now_utc],
    );
    let job_input = crate::issues::history::IssueSnapshotJobStartInput {
        id: job_id.clone(),
        source_system_id: Some(source_system_id.to_string()),
        job_kind: "retention_compaction".to_string(),
        started_at: now_utc.to_string(),
        target_start_date: None,
        target_end_date: Some(current_local_date.to_string()),
        progress_json: serde_json::json!({ "status": "started" }).to_string(),
    };
    crate::issues::history::start_snapshot_job(conn, &job_input)
        .map_err(IssueHistoryError::Storage)?;

    // 2. Determine the daily cutoff date: current_local_date - daily_days.
    let cutoff_date = prev_date_n(current_local_date, config.daily_days);

    // 3a. Count rows in the daily window (snapshot_date > cutoff_date).
    let kept_daily_rows: usize = conn
        .query_row(
            "SELECT COUNT(*) FROM issue_snapshots
             WHERE source_system_id = ?1 AND snapshot_date > ?2",
            params![source_system_id, cutoff_date],
            |row| row.get::<_, i64>(0),
        )
        .map_err(IssueHistoryError::Storage)? as usize;

    // 3b. Collect old snapshot dates (snapshot_date <= cutoff_date).
    let old_dates: Vec<String> = {
        let mut stmt = conn
            .prepare(
                "SELECT DISTINCT snapshot_date FROM issue_snapshots
                 WHERE source_system_id = ?1 AND snapshot_date <= ?2
                 ORDER BY snapshot_date ASC",
            )
            .map_err(IssueHistoryError::Storage)?;
        let rows = stmt
            .query_map(params![source_system_id, cutoff_date], |row| {
                row.get::<_, String>(0)
            })
            .map_err(IssueHistoryError::Storage)?;
        rows.collect::<rusqlite::Result<Vec<String>>>()
            .map_err(IssueHistoryError::Storage)?
    };

    let mut compacted_weekly_rows: usize = 0;
    let mut deleted_daily_rows: usize = 0;

    for date in &old_dates {
        if is_monday(date) {
            // Keep Monday rows; mark them compacted_weekly.
            let updated = conn
                .execute(
                    "UPDATE issue_snapshots
                     SET snapshot_source = 'compacted_weekly'
                     WHERE source_system_id = ?1 AND snapshot_date = ?2
                       AND snapshot_source != 'compacted_weekly'",
                    params![source_system_id, date],
                )
                .map_err(IssueHistoryError::Storage)?;
            compacted_weekly_rows += updated as usize;
        } else {
            // Delete non-Monday old rows.
            let deleted = conn
                .execute(
                    "DELETE FROM issue_snapshots
                     WHERE source_system_id = ?1 AND snapshot_date = ?2",
                    params![source_system_id, date],
                )
                .map_err(IssueHistoryError::Storage)?;
            deleted_daily_rows += deleted as usize;
        }
    }

    // 4. Update job with final progress.
    let final_progress = serde_json::json!({
        "kept_daily_rows": kept_daily_rows,
        "compacted_weekly_rows": compacted_weekly_rows,
        "deleted_daily_rows": deleted_daily_rows,
    })
    .to_string();
    crate::issues::history::finish_snapshot_job(
        conn,
        &job_id,
        "succeeded",
        now_utc,
        &final_progress,
        None,
    )
    .map_err(IssueHistoryError::Storage)?;

    Ok(RetentionCompactionResult {
        kept_daily_rows,
        compacted_weekly_rows,
        deleted_daily_rows,
        job_id,
    })
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::issues::history::{upsert_issue_event, IssueEventInput};
    use rusqlite::Connection;

    // ── Shared test helpers ───────────────────────────────────────────────────

    fn base_state() -> SnapshotState {
        SnapshotState {
            issue_id: "wi_amp_1043".to_string(),
            source_system_id: "srcsys_jira_1".to_string(),
            source_kind: "jira_issue".to_string(),
            key: Some("AMP-1043".to_string()),
            title: "Fix the widget".to_string(),
            state: "open".to_string(),
            status_name: Some("To Do".to_string()),
            status_id: None,
            resolution_name: None,
            resolution_id: None,
            priority_name: Some("Medium".to_string()),
            priority_id: None,
            item_type: None,
            project_key: Some("AMP".to_string()),
            project_name: None,
            assignee_person_id: None,
            reporter_person_id: None,
            labels: vec![],
            components: vec![],
            fix_versions: vec![],
            sprint_names: vec![],
            product_names: vec![],
            assigned_team_names: vec![],
            customer_name: None,
            parent_link: None,
            epic_link: None,
            epic_name: None,
            epic_status: None,
            created_at_source: None,
            updated_at_source: None,
            resolved_at_source: None,
            due_at_source: None,
            body_hash: None,
        }
    }

    fn make_event(
        id: &str,
        event_type: &str,
        occurred_at: &str,
        to_string: Option<&str>,
        field_id: Option<&str>,
    ) -> IssueEventRow {
        IssueEventRow {
            id: id.to_string(),
            issue_id: "wi_amp_1043".to_string(),
            event_type: event_type.to_string(),
            occurred_at: occurred_at.to_string(),
            field_id: field_id.map(|s| s.to_string()),
            actor_display_name: None,
            from_string: None,
            to_string: to_string.map(|s| s.to_string()),
            payload_json: "{}".to_string(),
        }
    }

    fn events_spanning_two_days() -> Vec<IssueEventRow> {
        vec![
            make_event("e1", "status_changed",   "2026-05-27T10:00:00Z", Some("In Progress"), None),
            make_event("e2", "priority_changed",  "2026-05-27T11:00:00Z", Some("High"),        None),
            make_event("e3", "labels_changed",    "2026-05-27T12:00:00Z", Some("backend, urgent"), None),
            // This event is on 2026-05-28 and must NOT be applied for snapshot_date 2026-05-27
            make_event("e4", "status_changed",    "2026-05-28T09:00:00Z", Some("Done"),        None),
        ]
    }

    // ── In-memory DB helpers ──────────────────────────────────────────────────

    fn insert_source_system(conn: &Connection) {
        conn.execute(
            "INSERT INTO source_systems (id, kind, deployment_kind, display_name, base_url, config_source_id, created_at, updated_at)
             VALUES ('srcsys_jira_1', 'jira', 'datacenter', 'Test Jira', 'https://jira.example.com', 'primary', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            [],
        ).unwrap();
    }

    fn insert_work_item(conn: &Connection) {
        conn.execute(
            "INSERT INTO work_items (id, source_system_id, source_kind, upstream_id, key, title, state, status_name, raw_updated_hash, last_seen_at, created_at, updated_at)
             VALUES ('wi_amp_1043', 'srcsys_jira_1', 'jira_issue', 'AMP-1043', 'AMP-1043', 'Fix the widget', 'open', 'To Do', 'abc123', '2026-05-27T00:00:00Z', '2026-05-27T00:00:00Z', '2026-05-27T00:00:00Z')",
            [],
        ).unwrap();
    }

    fn insert_jira_issue(conn: &Connection) {
        conn.execute(
            "INSERT INTO jira_issues (work_item_id, jira_id, jira_key, raw_fields_json, raw_issue_json, fields_hash, ingested_at)
             VALUES ('wi_amp_1043', '10043', 'AMP-1043', '{}', '{}', 'hash1', '2026-05-27T00:00:00Z')",
            [],
        ).unwrap();
    }

    fn seeded_snapshot_conn() -> Connection {
        let conn = crate::db::open_in_memory().unwrap();
        insert_source_system(&conn);
        insert_work_item(&conn);
        insert_jira_issue(&conn);

        // Two events: status → In Progress on day 27, status → Done on day 28
        let e1 = IssueEventInput {
            id: "iev_snap_1".to_string(),
            source_system_id: "srcsys_jira_1".to_string(),
            issue_id: "wi_amp_1043".to_string(),
            entity_type: "jira_issue".to_string(),
            entity_id: "wi_amp_1043".to_string(),
            source_kind: "jira".to_string(),
            event_type: "status_changed".to_string(),
            upstream_event_id: Some("ev1".to_string()),
            upstream_item_id: Some("ev1_0".to_string()),
            field_id: None,
            field_name: Some("status".to_string()),
            actor_identity_id: None,
            actor_display_name: None,
            occurred_at: "2026-05-27T10:00:00Z".to_string(),
            from_string: Some("To Do".to_string()),
            to_string: Some("In Progress".to_string()),
            from_json: None,
            to_json: None,
            payload_json: "{}".to_string(),
            ingested_at: "2026-05-27T12:00:00Z".to_string(),
        };
        let e2 = IssueEventInput {
            id: "iev_snap_2".to_string(),
            source_system_id: "srcsys_jira_1".to_string(),
            issue_id: "wi_amp_1043".to_string(),
            entity_type: "jira_issue".to_string(),
            entity_id: "wi_amp_1043".to_string(),
            source_kind: "jira".to_string(),
            event_type: "status_changed".to_string(),
            upstream_event_id: Some("ev2".to_string()),
            upstream_item_id: Some("ev2_0".to_string()),
            field_id: None,
            field_name: Some("status".to_string()),
            actor_identity_id: None,
            actor_display_name: None,
            occurred_at: "2026-05-28T09:00:00Z".to_string(),
            from_string: Some("In Progress".to_string()),
            to_string: Some("Done".to_string()),
            from_json: None,
            to_json: None,
            payload_json: "{}".to_string(),
            ingested_at: "2026-05-28T12:00:00Z".to_string(),
        };
        upsert_issue_event(&conn, &e1).unwrap();
        upsert_issue_event(&conn, &e2).unwrap();
        conn
    }

    // ── Test 1: Pure fold ─────────────────────────────────────────────────────

    #[test]
    fn folds_status_priority_and_label_events_up_to_day_end() {
        let folded =
            fold_events_to_day_end(base_state(), &events_spanning_two_days(), "2026-05-27");
        assert_eq!(folded.status_name.as_deref(), Some("In Progress"));
        assert_eq!(folded.priority_name.as_deref(), Some("High"));
        assert_eq!(
            folded.labels,
            vec!["backend".to_string(), "urgent".to_string()]
        );
    }

    #[test]
    fn does_not_apply_event_after_day_end() {
        let folded =
            fold_events_to_day_end(base_state(), &events_spanning_two_days(), "2026-05-27");
        // The "Done" event is on 2026-05-28 — state must NOT be "done"
        assert_ne!(folded.state, "done");
        assert_eq!(folded.state, "in_progress");
    }

    // ── Test 2: JSON array serialization ──────────────────────────────────────

    #[test]
    fn snapshot_state_serializes_json_arrays_for_storage() {
        let mut state = base_state();
        state.labels = vec!["backend".to_string(), "urgent".to_string()];
        let input =
            snapshot_input_from_state(state, "2026-05-27", "generated", "2026-05-28T12:00:00Z")
                .unwrap();
        assert_eq!(input.labels_json, r#"["backend","urgent"]"#);
    }

    #[test]
    fn empty_vecs_serialize_to_empty_json_arrays() {
        let state = base_state();
        let input =
            snapshot_input_from_state(state, "2026-05-27", "generated", "2026-05-28T12:00:00Z")
                .unwrap();
        assert_eq!(input.components_json, "[]");
        assert_eq!(input.sprint_names_json, "[]");
    }

    // ── Test 3: Database-backed snapshot generation ───────────────────────────

    #[test]
    fn generates_snapshots_for_date_range_with_status_transitions() {
        let conn = seeded_snapshot_conn();
        let count = generate_snapshots_for_range(
            &conn,
            "srcsys_jira_1",
            "2026-05-27",
            "2026-05-28",
            "2026-05-28T12:00:00Z",
        )
        .unwrap();
        assert_eq!(count, 2);

        let status_27: String = conn
            .query_row(
                "SELECT status_name FROM issue_snapshots WHERE issue_id = 'wi_amp_1043' AND snapshot_date = '2026-05-27'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let status_28: String = conn
            .query_row(
                "SELECT status_name FROM issue_snapshots WHERE issue_id = 'wi_amp_1043' AND snapshot_date = '2026-05-28'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(status_27, "In Progress");
        assert_eq!(status_28, "Done");
    }

    // ── Additional unit tests ─────────────────────────────────────────────────

    #[test]
    fn coarse_state_maps_correctly() {
        assert_eq!(coarse_state(Some("In Progress")), "in_progress");
        assert_eq!(coarse_state(Some("In Review")), "in_progress");
        assert_eq!(coarse_state(Some("Done")), "done");
        assert_eq!(coarse_state(Some("Resolved")), "done");
        assert_eq!(coarse_state(Some("Closed")), "closed");
        assert_eq!(coarse_state(Some("Cancelled")), "cancelled");
        assert_eq!(coarse_state(Some("Won't Do")), "cancelled");
        assert_eq!(coarse_state(Some("To Do")), "open");
        assert_eq!(coarse_state(None), "unknown");
    }

    #[test]
    fn dates_in_range_single_day() {
        let dates = dates_in_range("2026-05-27", "2026-05-27");
        assert_eq!(dates, vec!["2026-05-27"]);
    }

    #[test]
    fn dates_in_range_month_boundary() {
        let dates = dates_in_range("2026-01-30", "2026-02-02");
        assert_eq!(
            dates,
            vec!["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]
        );
    }

    #[test]
    fn parse_csv_trims_and_sorts() {
        let result = parse_csv("  urgent , backend ");
        assert_eq!(result, vec!["backend", "urgent"]);
    }

    #[test]
    fn relationship_field_changed_updates_epic_link() {
        let mut state = base_state();
        let event = make_event(
            "e10",
            "relationship_field_changed",
            "2026-05-27T09:00:00Z",
            Some("EPIC-42"),
            Some("customfield_10857"),
        );
        apply_event(&mut state, &event);
        assert_eq!(state.epic_link.as_deref(), Some("EPIC-42"));
    }

    // ── seeded_snapshot_conn_with_cursor ─────────────────────────────────────

    fn seeded_snapshot_conn_with_cursor(cursor_key: &str, cursor_date: &str) -> Connection {
        let conn = seeded_snapshot_conn();
        // Store the cursor as a JSON-encoded date string, using the raw SQL so
        // we can use a colon-containing key for the spec-aligned assertion.
        let value_json = serde_json::json!(cursor_date).to_string();
        conn.execute(
            "INSERT INTO shared_settings (key, value_json, updated_at)
             VALUES (?1, ?2, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = datetime('now')",
            rusqlite::params![cursor_key, value_json],
        )
        .unwrap();
        conn
    }

    #[test]
    fn replay_missing_days_fills_gap_after_downtime() {
        // Use the dot-separated key required by validate_key.
        let cursor_key = "project.AMP.snapshots";
        // Seed the cursor with value "2026-05-25" (JSON string).
        let conn = seeded_snapshot_conn_with_cursor(cursor_key, "2026-05-25");

        let result = replay_missing_snapshots(
            &conn,
            "srcsys_jira_1",
            "AMP",
            "2026-05-28",
            "2026-05-28T12:00:00Z",
        )
        .unwrap();

        assert!(
            result.generated_dates.contains(&"2026-05-26".to_string()),
            "should include 2026-05-26"
        );
        assert!(
            result.generated_dates.contains(&"2026-05-27".to_string()),
            "should include 2026-05-27"
        );
        assert!(
            result.generated_dates.contains(&"2026-05-28".to_string()),
            "should include 2026-05-28"
        );
        assert!(result.snapshots_written > 0, "should write at least one snapshot");

        // Cursor is updated to current date (stored as JSON string "\"2026-05-28\"")
        let updated_cursor_json: String = conn
            .query_row(
                "SELECT value_json FROM shared_settings WHERE key = ?1",
                rusqlite::params![cursor_key],
                |row| row.get(0),
            )
            .unwrap();
        // The value is stored as a JSON string: "\"2026-05-28\""
        let updated_cursor: String =
            serde_json::from_str::<serde_json::Value>(&updated_cursor_json)
                .unwrap()
                .as_str()
                .unwrap()
                .to_string();
        assert_eq!(updated_cursor, "2026-05-28");
    }

    #[test]
    fn replay_returns_empty_when_cursor_is_current() {
        let cursor_key = "project.AMP.snapshots";
        let conn = seeded_snapshot_conn_with_cursor(cursor_key, "2026-05-28");
        let result = replay_missing_snapshots(
            &conn,
            "srcsys_jira_1",
            "AMP",
            "2026-05-28",
            "2026-05-28T12:00:00Z",
        )
        .unwrap();
        assert!(result.generated_dates.is_empty());
        assert_eq!(result.snapshots_written, 0);
    }

    #[test]
    fn replay_generates_only_today_when_no_cursor() {
        let conn = seeded_snapshot_conn();
        let result = replay_missing_snapshots(
            &conn,
            "srcsys_jira_1",
            "AMP",
            "2026-05-28",
            "2026-05-28T12:00:00Z",
        )
        .unwrap();
        assert_eq!(result.generated_dates, vec!["2026-05-28"]);
        assert!(result.snapshots_written > 0);
    }

    #[test]
    fn upsert_is_idempotent_for_same_date() {
        let conn = seeded_snapshot_conn();
        generate_snapshots_for_range(
            &conn,
            "srcsys_jira_1",
            "2026-05-27",
            "2026-05-27",
            "2026-05-28T12:00:00Z",
        )
        .unwrap();
        generate_snapshots_for_range(
            &conn,
            "srcsys_jira_1",
            "2026-05-27",
            "2026-05-27",
            "2026-05-28T13:00:00Z",
        )
        .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM issue_snapshots WHERE issue_id = 'wi_amp_1043' AND snapshot_date = '2026-05-27'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "re-generating the same date should upsert, not duplicate");
    }

    // ── Retention compaction helpers ──────────────────────────────────────────

    /// Seed an in-memory DB with one source system, one work_item, one jira_issue,
    /// one issue_event, and one `issue_snapshots` row per day from `start_date` to
    /// `end_date` (inclusive).
    fn seeded_snapshot_conn_with_many_dates(
        source_system_id: &str,
        issue_id: &str,
        start_date: &str,
        end_date: &str,
    ) -> Connection {
        let conn = crate::db::open_in_memory().unwrap();

        // Source system
        conn.execute(
            "INSERT INTO source_systems (id, kind, deployment_kind, display_name, base_url, config_source_id, created_at, updated_at)
             VALUES (?1, 'jira', 'datacenter', 'Test Jira', 'https://jira.example.com', 'primary', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
            rusqlite::params![source_system_id],
        ).unwrap();

        // Work item
        conn.execute(
            "INSERT INTO work_items (id, source_system_id, source_kind, upstream_id, key, title, state, status_name, raw_updated_hash, last_seen_at, created_at, updated_at)
             VALUES (?1, ?2, 'jira_issue', 'AMP-1043', 'AMP-1043', 'Fix the widget', 'open', 'To Do', 'abc123', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
            rusqlite::params![issue_id, source_system_id],
        ).unwrap();

        // Jira issue
        conn.execute(
            "INSERT INTO jira_issues (work_item_id, jira_id, jira_key, raw_fields_json, raw_issue_json, fields_hash, ingested_at)
             VALUES (?1, '10043', 'AMP-1043', '{}', '{}', 'hash1', '2025-01-01T00:00:00Z')",
            rusqlite::params![issue_id],
        ).unwrap();

        // One issue_event
        let event = IssueEventInput {
            id: "iev_retention_1".to_string(),
            source_system_id: source_system_id.to_string(),
            issue_id: issue_id.to_string(),
            entity_type: "jira_issue".to_string(),
            entity_id: issue_id.to_string(),
            source_kind: "jira".to_string(),
            event_type: "status_changed".to_string(),
            upstream_event_id: Some("ev1".to_string()),
            upstream_item_id: Some("ev1_0".to_string()),
            field_id: None,
            field_name: Some("status".to_string()),
            actor_identity_id: None,
            actor_display_name: None,
            occurred_at: format!("{start_date}T10:00:00Z"),
            from_string: Some("To Do".to_string()),
            to_string: Some("In Progress".to_string()),
            from_json: None,
            to_json: None,
            payload_json: "{}".to_string(),
            ingested_at: format!("{start_date}T12:00:00Z"),
        };
        upsert_issue_event(&conn, &event).unwrap();

        // Insert one snapshot per day for the full range
        let dates = dates_in_range(start_date, end_date);
        for date in &dates {
            conn.execute(
                "INSERT OR REPLACE INTO issue_snapshots (
                    issue_id, snapshot_date, source_system_id, source_kind,
                    key, title, state, status_name, labels_json, components_json,
                    fix_versions_json, sprint_names_json, product_names_json,
                    assigned_team_names_json, snapshot_source, generated_at
                 ) VALUES (
                    ?1, ?2, ?3, 'jira_issue',
                    'AMP-1043', 'Fix the widget', 'open', 'To Do', '[]', '[]',
                    '[]', '[]', '[]', '[]', 'generated', ?4
                 )",
                rusqlite::params![issue_id, date, source_system_id, format!("{date}T12:00:00Z")],
            ).unwrap();
        }

        conn
    }

    #[test]
    fn retention_keeps_recent_daily_and_compacts_old_rows_to_mondays() {
        let conn = seeded_snapshot_conn_with_many_dates(
            "srcsys_jira_1",
            "wi_amp_1043",
            "2025-01-01",
            "2026-05-28",
        );

        let config = crate::issues::history::IssueHistoryRetentionConfig {
            version: 1,
            daily_days: 30,
            compact_to_weekly_after_days: 365,
            weekly_anchor: "monday".to_string(),
        };

        let result = compact_snapshot_retention(
            &conn,
            "srcsys_jira_1",
            "2026-05-28",
            &config,
            "2026-05-28T12:00:00Z",
        )
        .unwrap();

        // Recent 30 days (2026-04-28..2026-05-28) are kept as-is
        assert!(result.kept_daily_rows > 0, "should have kept daily rows");
        // Old rows were compacted (deleted non-Monday rows outside daily window)
        assert!(result.deleted_daily_rows > 0, "should have deleted old non-Monday rows");
        // issue_events are untouched
        let event_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM issue_events", [], |row| row.get(0))
            .unwrap();
        assert!(event_count > 0, "issue_events should not be touched");
    }

    #[test]
    fn is_monday_identifies_mondays_correctly() {
        // 2026-05-25 is a Monday
        assert!(is_monday("2026-05-25"));
        // 2026-05-26 is a Tuesday
        assert!(!is_monday("2026-05-26"));
        // 2026-05-28 is a Thursday
        assert!(!is_monday("2026-05-28"));
        // 2025-01-06 is a Monday
        assert!(is_monday("2025-01-06"));
    }

    #[test]
    fn prev_date_n_subtracts_days_correctly() {
        assert_eq!(prev_date_n("2026-05-28", 0), "2026-05-28");
        assert_eq!(prev_date_n("2026-05-28", 1), "2026-05-27");
        assert_eq!(prev_date_n("2026-03-01", 1), "2026-02-28");
        assert_eq!(prev_date_n("2024-03-01", 1), "2024-02-29"); // leap year
        assert_eq!(prev_date_n("2026-01-01", 1), "2025-12-31");
        assert_eq!(prev_date_n("2026-05-28", 30), "2026-04-28");
    }
}
