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
}
