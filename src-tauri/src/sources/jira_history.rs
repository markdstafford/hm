//! Jira changelog projection — maps `JiraChangelogEntry` rows into `IssueEventInput` rows.
//!
//! This module is pure (no DB writes). The caller is responsible for resolving
//! actor identities and persisting the returned events.

use rusqlite::Connection;
use serde_json::json;

use crate::issues::history::{IssueEventInput, IssueHistoryError};
use crate::issues::ids::stable_id;
use crate::issues::people::{upsert_source_identity, SourceIdentityInput};
use crate::sources::jira_types::JiraChangelogEntry;

// ── Field → event type mapping ────────────────────────────────────────────────

/// Map a Jira changelog field name to a typed event_type string.
pub fn event_type_for_field(field: &str) -> &'static str {
    match field {
        "status" => "status_changed",
        "assignee" => "assignee_changed",
        "priority" => "priority_changed",
        "resolution" => "resolution_changed",
        "summary" => "title_changed",
        "labels" => "labels_changed",
        "components" => "components_changed",
        "fixVersions" => "fix_versions_changed",
        "customfield_10557" => "sprint_changed",
        "customfield_14655" => "product_changed",
        "customfield_12751" => "assigned_teams_changed",
        "customfield_14353" => "customer_changed",
        "customfield_14051" | "customfield_10857" | "customfield_10858" | "customfield_10859" => {
            "relationship_field_changed"
        }
        "duedate" => "due_date_changed",
        _ => "field_changed",
    }
}

// ── Cursor key helper ─────────────────────────────────────────────────────────

/// Build the cursor key used to track how far we have ingested changelog entries
/// for a given issue. Used by the ingestion layer to avoid re-fetching pages
/// that have already been stored.
pub fn issue_changelog_cursor_key(issue_key: &str) -> String {
    format!("issue:{issue_key}:changelog")
}

// ── Timestamp normalisation ───────────────────────────────────────────────────

/// Convert Jira's `created` timestamps to UTC RFC 3339.
///
/// Jira Data Center emits timestamps like `"2026-05-03T11:00:00.000+0000"` or
/// `"2026-05-03T11:00:00.000+05:30"`.  We strip the millisecond fraction,
/// parse the timezone offset, and convert to UTC so the stored value is always
/// a UTC RFC 3339 string like `"2026-05-03T05:30:00Z"`.
///
/// If the string cannot be parsed at all, the original is returned unchanged so
/// we never silently lose data.
pub fn normalize_jira_datetime(created: &str) -> String {
    // Strip fractional seconds: "...T11:00:00.000+0000" → "...T11:00:00+0000"
    let without_ms = if let Some(dot_pos) = created.find('.') {
        let rest = &created[dot_pos + 1..];
        let frac_len = rest.find(['+', '-', 'Z']).unwrap_or(rest.len());
        format!("{}{}", &created[..dot_pos], &rest[frac_len..])
    } else {
        created.to_string()
    };

    // Fast-path: already UTC
    if without_ms.ends_with('Z') {
        return without_ms;
    }
    if without_ms.ends_with("+0000") {
        return format!("{}Z", &without_ms[..without_ms.len() - 5]);
    }
    if without_ms.ends_with("+00:00") {
        return format!("{}Z", &without_ms[..without_ms.len() - 6]);
    }

    // General path: parse and convert non-zero UTC offsets.
    convert_offset_to_utc(&without_ms).unwrap_or(without_ms)
}

/// Parse `YYYY-MM-DDTHH:MM:SS±HHMM` or `YYYY-MM-DDTHH:MM:SS±HH:MM` and
/// return the equivalent UTC RFC 3339 string.  Returns `None` if parsing fails.
fn convert_offset_to_utc(s: &str) -> Option<String> {
    // Split at 'T' to get date and time-with-offset.
    let t_pos = s.find('T')?;
    let date_str = &s[..t_pos];
    let time_offset_str = &s[t_pos + 1..];

    // Time component is always HH:MM:SS (8 chars).
    if time_offset_str.len() < 8 {
        return None;
    }
    let time_str = &time_offset_str[..8]; // "HH:MM:SS"
    let offset_str = &time_offset_str[8..]; // "±HHMM" or "±HH:MM"

    if offset_str.is_empty() {
        return None;
    }

    // Parse offset sign and magnitude.
    let (sign, offset_body) = match offset_str.chars().next()? {
        '+' => (1i64, &offset_str[1..]),
        '-' => (-1i64, &offset_str[1..]),
        _ => return None,
    };

    let (off_h, off_m) = if offset_body.contains(':') {
        let (h, rest) = offset_body.split_once(':')?;
        (h.parse::<i64>().ok()?, rest.parse::<i64>().ok()?)
    } else if offset_body.len() == 4 {
        (
            offset_body[..2].parse::<i64>().ok()?,
            offset_body[2..].parse::<i64>().ok()?,
        )
    } else {
        return None;
    };

    // Parse date.
    let (ds, rest) = date_str.split_once('-')?;
    let (ms, day_s) = rest.split_once('-')?;
    let y = ds.parse::<i64>().ok()?;
    let mo = ms.parse::<i64>().ok()?;
    let d = day_s.parse::<i64>().ok()?;

    // Parse time.
    let (hs, rest) = time_str.split_once(':')?;
    let (mis, ss) = rest.split_once(':')?;
    let h = hs.parse::<i64>().ok()?;
    let mi = mis.parse::<i64>().ok()?;
    let sec = ss.parse::<i64>().ok()?;

    // Subtract offset (offset is how far local is ahead of UTC).
    let offset_minutes = sign * (off_h * 60 + off_m);
    let mut utc_minutes = h * 60 + mi - offset_minutes;
    let mut day_delta: i64 = 0;
    while utc_minutes < 0 {
        utc_minutes += 24 * 60;
        day_delta -= 1;
    }
    while utc_minutes >= 24 * 60 {
        utc_minutes -= 24 * 60;
        day_delta += 1;
    }
    let utc_h = utc_minutes / 60;
    let utc_m = utc_minutes % 60;

    // Adjust calendar date.
    let (ny, nmo, nd) = add_days_simple(y, mo, d, day_delta);

    Some(format!(
        "{ny:04}-{nmo:02}-{nd:02}T{utc_h:02}:{utc_m:02}:{sec:02}Z"
    ))
}

/// Add `delta` days (expected to be -1, 0, or +1 — timezone offsets never span
/// more than one calendar day) to a `(year, month, day)` triple.
fn add_days_simple(y: i64, m: i64, d: i64, delta: i64) -> (i64, i64, i64) {
    if delta == 0 {
        return (y, m, d);
    }
    let dims = days_in_month_i64(y, m);
    if delta == 1 {
        if d < dims {
            return (y, m, d + 1);
        }
        if m < 12 {
            return (y, m + 1, 1);
        }
        return (y + 1, 1, 1);
    }
    // delta == -1
    if d > 1 {
        return (y, m, d - 1);
    }
    if m > 1 {
        let prev_m = m - 1;
        return (y, prev_m, days_in_month_i64(y, prev_m));
    }
    (y - 1, 12, 31)
}

fn days_in_month_i64(y: i64, m: i64) -> i64 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}

// ── Actor identity resolution ──────────────────────────────────────────────────

/// Resolve the actor identity for a changelog entry.
///
/// Returns `Some(source_identity_id)` if author data is present and persisted
/// successfully. Returns `None` if no author data exists or the upsert fails —
/// identity link failures are best-effort and must not fail event ingestion.
pub(crate) fn resolve_actor_identity(
    conn: &Connection,
    source_system_id: &str,
    entry: &JiraChangelogEntry,
    now: &str,
) -> Option<String> {
    let author = entry.author.as_ref()?;
    // Skip if no stable key is available.
    if author.account_id.is_none()
        && author.name.is_none()
        && author.key.is_none()
        && author.display_name.is_none()
    {
        return None;
    }
    let result = upsert_source_identity(
        conn,
        now,
        &SourceIdentityInput {
            source_system_id,
            source_kind: "jira",
            upstream_account_id: author.account_id.as_deref(),
            upstream_name: author.name.as_deref(),
            upstream_key: author.key.as_deref(),
            username: author.name.as_deref(),
            email: author.email_address.as_deref(),
            display_name: author.display_name.as_deref(),
            avatar_url: None,
            raw_json: None, // omit raw_json — changelog author could carry PII
        },
    );
    match result {
        Ok(id) => Some(id.source_identity_id),
        Err(_) => None, // best-effort: identity link failure does not fail event ingestion
    }
}

// ── Projection ────────────────────────────────────────────────────────────────

/// Project a single Jira changelog entry into zero or more `IssueEventInput` rows.
///
/// This function is **pure** — it makes no database calls. The `actor_identity_id`
/// parameter accepts a pre-resolved identity id from the caller (Task 2.2 supplies
/// this after calling `upsert_source_identity`).
pub fn project_changelog_entry(
    source_system_id: &str,
    issue_id: &str,
    issue_key: &str,
    entry: &JiraChangelogEntry,
    ingested_at: &str,
    actor_identity_id: Option<&str>,
) -> Result<Vec<IssueEventInput>, IssueHistoryError> {
    let occurred_at = normalize_jira_datetime(&entry.created);
    let actor_display_name = entry.author.as_ref().and_then(|u| u.display_name.clone());

    let mut events = Vec::with_capacity(entry.items.len());

    for (idx, item) in entry.items.iter().enumerate() {
        let event_type = event_type_for_field(&item.field);
        let idx_str = idx.to_string();

        let id = stable_id(
            "iev",
            &[source_system_id, issue_id, &entry.id, &idx_str, event_type],
        );

        // Build a safe payload that contains only non-sensitive field metadata.
        // Deliberately omit: accountId, emailAddress, name/key (token-adjacent).
        let mut payload = json!({
            "field": item.field,
            "issueKey": issue_key,
        });
        if let Some(ft) = &item.fieldtype {
            payload["fieldtype"] = json!(ft);
        }
        if let Some(f) = &item.from {
            payload["from"] = json!(f);
        }
        if let Some(fs) = &item.from_string {
            payload["fromString"] = json!(fs);
        }
        if let Some(t) = &item.to {
            payload["to"] = json!(t);
        }
        if let Some(ts) = &item.to_string {
            payload["toString"] = json!(ts);
        }
        if let Some(name) = &actor_display_name {
            payload["authorDisplayName"] = json!(name);
        }

        let payload_json = serde_json::to_string(&payload).map_err(|e| {
            IssueHistoryError::Projection(format!("payload serialisation failed: {e}"))
        })?;

        events.push(IssueEventInput {
            id,
            source_system_id: source_system_id.to_string(),
            issue_id: issue_id.to_string(),
            entity_type: "jira_issue".to_string(),
            entity_id: issue_id.to_string(),
            source_kind: "jira".to_string(), // source system kind (not entity kind — entity_type holds "jira_issue")
            event_type: event_type.to_string(),
            upstream_event_id: Some(entry.id.clone()),
            upstream_item_id: Some(format!("{}_{}", entry.id, idx)),
            field_id: Some(item.field.clone()),
            field_name: Some(item.field.clone()), // raw Jira field key; display label lookup deferred to future work
            actor_identity_id: actor_identity_id.map(str::to_string),
            actor_display_name: actor_display_name.clone(),
            occurred_at: occurred_at.clone(),
            from_string: item.from_string.clone(),
            to_string: item.to_string.clone(),
            from_json: None,
            to_json: None,
            payload_json,
            ingested_at: ingested_at.to_string(),
        });
    }

    Ok(events)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::issues::history::{upsert_issue_event, IssueEventInput};
    use crate::sources::jira_types::JiraChangelogEntry;
    use rusqlite::Connection;

    fn entry_from_json(json: &str) -> JiraChangelogEntry {
        serde_json::from_str(json).unwrap()
    }

    // ── Idempotency helpers ───────────────────────────────────────────────────

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

    /// Ingest the status fixture once, persisting one event row via upsert_issue_event.
    fn ingest_status_fixture(conn: &Connection) -> rusqlite::Result<()> {
        let entry = entry_from_json(include_str!("fixtures/jira_changelog_history_status.json"));
        let events = project_changelog_entry(
            "srcsys_jira_1",
            "wi_amp_1043",
            "AMP-1043",
            &entry,
            "2026-05-28T12:00:00Z",
            None,
        )
        .unwrap();
        for event in &events {
            upsert_issue_event(conn, event)?;
        }
        Ok(())
    }

    // ── Deleted-author helpers ────────────────────────────────────────────────

    /// Project the deleted-author fixture and return the resulting events.
    /// The caller passes actor_identity_id = None, mirroring what resolve_actor_identity
    /// returns when no stable key (accountId / name / key) exists.
    fn project_deleted_author_fixture() -> Result<Vec<IssueEventInput>, IssueHistoryError> {
        let entry = entry_from_json(include_str!(
            "fixtures/jira_changelog_history_deleted_author.json"
        ));
        project_changelog_entry(
            "srcsys_jira_1",
            "wi_amp_1043",
            "AMP-1043",
            &entry,
            "2026-05-28T12:00:00Z",
            None, // caller supplies None when no stable key is available
        )
    }

    // ── Unknown-custom-field helpers ──────────────────────────────────────────

    /// Project the fields fixture and return the event for the unknown custom field.
    fn project_unknown_custom_field_fixture() -> Result<Vec<IssueEventInput>, IssueHistoryError> {
        let entry = entry_from_json(include_str!("fixtures/jira_changelog_history_fields.json"));
        let all = project_changelog_entry(
            "srcsys_jira_1",
            "wi_amp_1043",
            "AMP-1043",
            &entry,
            "2026-05-28T12:00:00Z",
            None,
        )?;
        // Return only the event for the unknown custom field.
        let filtered: Vec<IssueEventInput> = all
            .into_iter()
            .filter(|e| e.field_id.as_deref() == Some("customfield_99999"))
            .collect();
        Ok(filtered)
    }

    // ── New fixture-coverage tests ────────────────────────────────────────────

    #[test]
    fn reingesting_same_changelog_does_not_duplicate_events() {
        let conn = conn_with_issue();
        ingest_status_fixture(&conn).unwrap();
        ingest_status_fixture(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM issue_events", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn deleted_author_uses_display_name_without_identity_when_no_stable_key_exists() {
        let mut events = project_deleted_author_fixture().unwrap();
        assert!(
            !events.is_empty(),
            "fixture should produce at least one event"
        );
        let event = events.remove(0);
        assert_eq!(event.actor_display_name.as_deref(), Some("Deleted User"));
        assert_eq!(event.actor_identity_id, None);
    }

    #[test]
    fn unknown_custom_fields_project_as_field_changed_events() {
        let mut events = project_unknown_custom_field_fixture().unwrap();
        assert!(
            !events.is_empty(),
            "fixture should contain customfield_99999 event"
        );
        let event = events.remove(0);
        assert_eq!(event.event_type, "field_changed");
        assert_eq!(event.field_id.as_deref(), Some("customfield_99999"));
    }

    #[test]
    fn maps_status_item_to_status_changed_event() {
        let entry = entry_from_json(include_str!("fixtures/jira_changelog_history_status.json"));
        let events = project_changelog_entry(
            "srcsys_jira_1",
            "wi_amp_1043",
            "AMP-1043",
            &entry,
            "2026-05-28T12:00:00Z",
            None,
        )
        .unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event_type, "status_changed");
        assert_eq!(events[0].from_string.as_deref(), Some("To Do"));
        assert_eq!(events[0].to_string.as_deref(), Some("In Progress"));
        assert_eq!(events[0].actor_display_name.as_deref(), Some("Alice Smith"));
        assert_eq!(events[0].upstream_event_id.as_deref(), Some("30100"));
    }

    #[test]
    fn preserves_unknown_fields_as_field_changed() {
        let entry = entry_from_json(include_str!("fixtures/jira_changelog_history_fields.json"));
        let events = project_changelog_entry(
            "srcsys_jira_1",
            "wi_amp_1043",
            "AMP-1043",
            &entry,
            "2026-05-28T12:00:00Z",
            None,
        )
        .unwrap();
        let unknown = events
            .iter()
            .find(|e| e.field_id.as_deref() == Some("customfield_99999"))
            .unwrap();
        assert_eq!(unknown.event_type, "field_changed");
    }

    #[test]
    fn maps_amp_custom_fields_to_typed_events() {
        assert_eq!(event_type_for_field("assignee"), "assignee_changed");
        assert_eq!(event_type_for_field("customfield_10557"), "sprint_changed");
        assert_eq!(event_type_for_field("duedate"), "due_date_changed");
        assert_eq!(event_type_for_field("customfield_99999"), "field_changed");
    }

    #[test]
    fn missing_author_keeps_event_without_actor_identity() {
        let entry = entry_from_json(include_str!(
            "fixtures/jira_changelog_history_missing_author.json"
        ));
        let events = project_changelog_entry(
            "srcsys_jira_1",
            "wi_amp_1043",
            "AMP-1043",
            &entry,
            "2026-05-28T12:00:00Z",
            None,
        )
        .unwrap();
        assert_eq!(events[0].actor_display_name, None);
        assert_eq!(events[0].actor_identity_id, None);
    }

    #[test]
    fn event_ids_are_deterministic() {
        let entry = entry_from_json(include_str!("fixtures/jira_changelog_history_status.json"));
        let events1 = project_changelog_entry(
            "srcsys_jira_1",
            "wi_amp_1043",
            "AMP-1043",
            &entry,
            "2026-05-28T12:00:00Z",
            None,
        )
        .unwrap();
        let events2 = project_changelog_entry(
            "srcsys_jira_1",
            "wi_amp_1043",
            "AMP-1043",
            &entry,
            "2026-05-29T00:00:00Z",
            None,
        )
        .unwrap();
        // Same entry produces same event id regardless of ingested_at
        assert_eq!(events1[0].id, events2[0].id);
    }

    #[test]
    fn payload_json_does_not_contain_account_id() {
        let entry = entry_from_json(include_str!("fixtures/jira_changelog_history_status.json"));
        let events = project_changelog_entry(
            "srcsys_jira_1",
            "wi_amp_1043",
            "AMP-1043",
            &entry,
            "2026-05-28T12:00:00Z",
            None,
        )
        .unwrap();
        // payload_json must NOT contain accountId — that's PII/token-adjacent
        assert!(!events[0].payload_json.contains("accountId"));
        assert!(!events[0].payload_json.contains("user-alice-123"));
    }

    #[test]
    fn normalize_jira_datetime_strips_millis_and_utc_offset() {
        assert_eq!(
            normalize_jira_datetime("2026-05-03T11:00:00.000+0000"),
            "2026-05-03T11:00:00Z"
        );
        assert_eq!(
            normalize_jira_datetime("2026-05-03T11:00:00.123+00:00"),
            "2026-05-03T11:00:00Z"
        );
        assert_eq!(
            normalize_jira_datetime("2026-05-03T11:00:00Z"),
            "2026-05-03T11:00:00Z"
        );
        // Non-UTC offsets are now converted to UTC (fixes INIT-2).
        // +0530 means UTC+5:30 → UTC = 11:00 - 5:30 = 05:30
        assert_eq!(
            normalize_jira_datetime("2026-05-03T11:00:00.000+0530"),
            "2026-05-03T05:30:00Z"
        );
        // +05:30 colon-separated form
        assert_eq!(
            normalize_jira_datetime("2026-05-03T11:00:00.000+05:30"),
            "2026-05-03T05:30:00Z"
        );
        // Negative offset: -0800 (UTC-8) → UTC = 22:00 + 8:00 = 06:00 next day
        assert_eq!(
            normalize_jira_datetime("2026-05-03T22:00:00.000-0800"),
            "2026-05-04T06:00:00Z"
        );
        // Positive offset pushing past midnight: +0530 at 00:15 → previous day 18:45
        assert_eq!(
            normalize_jira_datetime("2026-05-03T00:15:00.000+0530"),
            "2026-05-02T18:45:00Z"
        );
    }

    #[test]
    fn multi_item_entry_produces_correct_upstream_item_ids() {
        let entry = entry_from_json(include_str!("fixtures/jira_changelog_history_fields.json"));
        let events = project_changelog_entry(
            "srcsys_jira_1",
            "wi_amp_1043",
            "AMP-1043",
            &entry,
            "2026-05-28T12:00:00Z",
            None,
        )
        .unwrap();
        assert_eq!(events.len(), 4);
        assert_eq!(events[0].upstream_item_id.as_deref(), Some("30101_0"));
        assert_eq!(events[1].upstream_item_id.as_deref(), Some("30101_1"));
        assert_eq!(events[2].upstream_item_id.as_deref(), Some("30101_2"));
        assert_eq!(events[3].upstream_item_id.as_deref(), Some("30101_3"));
    }
}
