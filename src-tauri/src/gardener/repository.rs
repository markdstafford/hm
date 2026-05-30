use rusqlite::{params, Connection, OptionalExtension};
use crate::gardener::errors::GardenerError;

// ---------------------------------------------------------------------------
// State enum
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum SuggestionState {
    Detected,
    Generating,
    Pending,
    Applied,
    Rejected,
    Suppressed,
}

impl SuggestionState {
    pub fn as_db(&self) -> &'static str {
        match self {
            SuggestionState::Detected => "detected",
            SuggestionState::Generating => "generating",
            SuggestionState::Pending => "pending",
            SuggestionState::Applied => "applied",
            SuggestionState::Rejected => "rejected",
            SuggestionState::Suppressed => "suppressed",
        }
    }

    fn from_db(s: &str) -> Option<Self> {
        match s {
            "detected" => Some(SuggestionState::Detected),
            "generating" => Some(SuggestionState::Generating),
            "pending" => Some(SuggestionState::Pending),
            "applied" => Some(SuggestionState::Applied),
            "rejected" => Some(SuggestionState::Rejected),
            "suppressed" => Some(SuggestionState::Suppressed),
            _ => None,
        }
    }

    fn is_terminal(&self) -> bool {
        matches!(self, SuggestionState::Applied | SuggestionState::Rejected | SuggestionState::Suppressed)
    }

    pub fn can_transition_to(&self, next: &Self) -> bool {
        use SuggestionState::*;
        matches!(
            (self, next),
            (Detected, Generating)
                | (Detected, Pending)
                | (Detected, Suppressed)
                | (Generating, Detected)
                | (Generating, Pending)
                | (Generating, Suppressed)
                | (Pending, Applied)
                | (Pending, Rejected)
                | (Pending, Suppressed)
        )
    }
}

// ---------------------------------------------------------------------------
// SuppressionKey & SourceIdentityKey
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct SourceIdentityKey {
    pub source_id: String,
    pub source_kind: String,
    pub upstream_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum SuppressionKey {
    Issue {
        source_id: String,
        source_kind: String,
        upstream_id: String,
    },
    Pair {
        left: SourceIdentityKey,
        right: SourceIdentityKey,
    },
}

impl SuppressionKey {
    pub fn key_kind_str(&self) -> &'static str {
        match self {
            SuppressionKey::Issue { .. } => "issue",
            SuppressionKey::Pair { .. } => "pair",
        }
    }
}

/// Returns the canonical JSON string for a SuppressionKey.
/// For Pair keys, left/right are sorted before serialization so
/// (A, B) and (B, A) produce the same key.
pub fn canonical_suppression_key_json(key: &SuppressionKey) -> Result<String, GardenerError> {
    match key {
        SuppressionKey::Issue { source_id, source_kind, upstream_id } => {
            serde_json::to_string(&serde_json::json!({
                "kind": "issue",
                "source_id": source_id,
                "source_kind": source_kind,
                "upstream_id": upstream_id,
            }))
            .map_err(|_| GardenerError {
                category: crate::gardener::errors::GardenerErrorCategory::SuppressionKeyInvalid,
                message: "Failed to serialize suppression key.".into(),
            })
        }
        SuppressionKey::Pair { left, right } => {
            // Sort so (A, B) == (B, A)
            let (a, b) = if left <= right {
                (left, right)
            } else {
                (right, left)
            };
            serde_json::to_string(&serde_json::json!({
                "kind": "pair",
                "left": { "source_id": a.source_id, "source_kind": a.source_kind, "upstream_id": a.upstream_id },
                "right": { "source_id": b.source_id, "source_kind": b.source_kind, "upstream_id": b.upstream_id },
            }))
            .map_err(|_| GardenerError {
                category: crate::gardener::errors::GardenerErrorCategory::SuppressionKeyInvalid,
                message: "Failed to serialize suppression key.".into(),
            })
        }
    }
}

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct GardenerTarget {
    pub source_id: String,
    pub source_kind: String,
    pub upstream_id: String,
    pub display_key: String,
    pub title: String,
    pub status: Option<String>,
    pub assignee: Option<String>,
    pub updated_at_source: Option<String>,
}

#[derive(Debug, Clone)]
pub struct SuggestionInsert {
    pub id: String,
    pub engine_id: String,
    pub category: String,
    pub action_id: String,
    pub source_id: Option<String>,
    pub target: GardenerTarget,
    pub suppression_key: SuppressionKey,
    pub confidence: u8,
    pub title: String,
    pub rationale: String,
    pub payload_json: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct GardenerSuggestionRecord {
    pub id: String,
    pub engine_id: String,
    pub category: String,
    pub state: String,
    pub action_id: String,
    pub source_id: Option<String>,
    pub target_source_kind: String,
    pub target_upstream_id: String,
    pub target_display_key: String,
    pub suppression_key_json: String,
    pub confidence: u8,
    pub title: String,
    pub status: Option<String>,
    pub assignee: Option<String>,
    pub rationale: String,
    pub payload_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct SuppressionInput {
    pub id: String,
    pub engine_id: String,
    pub key: SuppressionKey,
    pub reason: String,
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

/// Insert a new pending suggestion, superseding any prior pending row for the
/// same (engine_id, suppression_key_json). Returns the new suggestion id.
///
/// Both the suppression UPDATE and the new INSERT are wrapped in a single
/// transaction so a crash between them cannot leave the old row suppressed
/// without a replacement row existing.
pub fn insert_or_supersede_pending(
    conn: &Connection,
    input: &SuggestionInsert,
    now: &str,
) -> Result<String, GardenerError> {
    let key_json = canonical_suppression_key_json(&input.suppression_key)?;
    let payload_str = serde_json::to_string(&input.payload_json).map_err(|_| GardenerError::database())?;

    // Begin an explicit transaction so the suppression UPDATE and the INSERT
    // are atomic. unchecked_transaction() does not borrow conn mutably, which
    // is safe here because we own the connection for the duration of the call.
    let tx = conn.unchecked_transaction().map_err(|_| GardenerError::database())?;

    // Find any existing *pending* row for this (engine_id, key_json).
    // Terminal rows (applied, rejected, suppressed) are intentionally excluded
    // so they are not disturbed by a later scan for the same key.
    let existing_id: Option<String> = tx
        .query_row(
            "SELECT id FROM gardener_suggestions
             WHERE engine_id = ?1 AND suppression_key_json = ?2
               AND state = 'pending' AND superseded_by IS NULL
             LIMIT 1",
            params![input.engine_id, key_json],
            |row| row.get(0),
        )
        .optional()
        .map_err(|_| GardenerError::database())?;

    // Mark old pending row as suppressed + superseded
    if let Some(ref old_id) = existing_id {
        tx.execute(
            "UPDATE gardener_suggestions
             SET state = 'suppressed', superseded_by = ?1, updated_at = ?2, terminal_at = ?2
             WHERE id = ?3 AND state = 'pending'",
            params![input.id, now, old_id],
        )
        .map_err(|_| GardenerError::database())?;
    }

    // Insert the new pending row
    tx.execute(
        "INSERT INTO gardener_suggestions
         (id, engine_id, category, state, action_id, source_id,
          target_source_kind, target_upstream_id, target_display_key,
          suppression_key_json, confidence, title, status, assignee,
          rationale, payload_json, created_at, updated_at)
         VALUES (?1,?2,?3,'pending',?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?16)",
        params![
            input.id,
            input.engine_id,
            input.category,
            input.action_id,
            input.source_id,
            input.target.source_kind,
            input.target.upstream_id,
            input.target.display_key,
            key_json,
            input.confidence as i64,
            input.title,
            input.target.status,
            input.target.assignee,
            input.rationale,
            payload_str,
            now,
        ],
    )
    .map_err(|_| GardenerError::database())?;

    tx.commit().map_err(|_| GardenerError::database())?;

    Ok(input.id.clone())
}

/// List all pending suggestions that have not been superseded, ordered by
/// confidence DESC then target_display_key ASC.
pub fn list_pending_suggestions(
    conn: &Connection,
) -> Result<Vec<GardenerSuggestionRecord>, GardenerError> {
    let mut stmt = conn
        .prepare(
            "SELECT id, engine_id, category, state, action_id, source_id,
                    target_source_kind, target_upstream_id, target_display_key,
                    suppression_key_json, confidence, title, status, assignee,
                    rationale, payload_json, created_at, updated_at
             FROM gardener_suggestions
             WHERE state = 'pending' AND superseded_by IS NULL
             ORDER BY confidence DESC, target_display_key ASC",
        )
        .map_err(|_| GardenerError::database())?;

    let rows = stmt
        .query_map([], |row| {
            let confidence: i64 = row.get(10)?;
            Ok(GardenerSuggestionRecord {
                id: row.get(0)?,
                engine_id: row.get(1)?,
                category: row.get(2)?,
                state: row.get(3)?,
                action_id: row.get(4)?,
                source_id: row.get(5)?,
                target_source_kind: row.get(6)?,
                target_upstream_id: row.get(7)?,
                target_display_key: row.get(8)?,
                suppression_key_json: row.get(9)?,
                confidence: confidence as u8,
                title: row.get(11)?,
                status: row.get(12)?,
                assignee: row.get(13)?,
                rationale: row.get(14)?,
                payload_json: row.get(15)?,
                created_at: row.get(16)?,
                updated_at: row.get(17)?,
            })
        })
        .map_err(|_| GardenerError::database())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|_| GardenerError::database())?;

    Ok(rows)
}

/// Transition a suggestion from its current state to `next`, validating the
/// state machine. Sets terminal_at for terminal states.
pub fn transition_suggestion(
    conn: &Connection,
    id: &str,
    next: SuggestionState,
    now: &str,
) -> Result<(), GardenerError> {
    let current_str: Option<String> = conn
        .query_row(
            "SELECT state FROM gardener_suggestions WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|_| GardenerError::database())?;

    let current_str = current_str.ok_or_else(|| GardenerError {
        category: crate::gardener::errors::GardenerErrorCategory::NotFound,
        message: "Suggestion not found.".into(),
    })?;

    let current = SuggestionState::from_db(&current_str).ok_or_else(|| GardenerError::database())?;

    if !current.can_transition_to(&next) {
        return Err(GardenerError::invalid_transition(current.as_db(), next.as_db()));
    }

    let terminal_at: Option<&str> = if next.is_terminal() { Some(now) } else { None };

    conn.execute(
        "UPDATE gardener_suggestions
         SET state = ?1, updated_at = ?2, terminal_at = ?3
         WHERE id = ?4",
        params![next.as_db(), now, terminal_at, id],
    )
    .map_err(|_| GardenerError::database())?;

    Ok(())
}

/// Upsert a suppression record. Returns the suppression id.
pub fn record_suppression(
    conn: &Connection,
    input: &SuppressionInput,
    now: &str,
) -> Result<String, GardenerError> {
    let key_json = canonical_suppression_key_json(&input.key)?;
    let key_kind = input.key.key_kind_str();

    conn.execute(
        "INSERT OR REPLACE INTO gardener_suppressions
         (id, engine_id, key_kind, key_json, reason, recorded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![input.id, input.engine_id, key_kind, key_json, input.reason, now],
    )
    .map_err(|_| GardenerError::database())?;

    Ok(input.id.clone())
}

/// Returns true if a suppression exists for the given engine + key.
pub fn suppression_exists(
    conn: &Connection,
    engine_id: &str,
    key: &SuppressionKey,
) -> Result<bool, GardenerError> {
    let key_json = canonical_suppression_key_json(key)?;
    let key_kind = key.key_kind_str();

    let count: i64 = conn
        .query_row(
            "SELECT count(*) FROM gardener_suppressions
             WHERE engine_id = ?1 AND key_kind = ?2 AND key_json = ?3",
            params![engine_id, key_kind, key_json],
            |row| row.get(0),
        )
        .map_err(|_| GardenerError::database())?;

    Ok(count > 0)
}

/// Read the current watermark cursor value for an engine/source/cursor_kind.
pub fn read_watermark(
    conn: &Connection,
    engine_id: &str,
    source_id: &str,
    cursor_kind: &str,
) -> Result<Option<String>, GardenerError> {
    conn.query_row(
        "SELECT cursor_value FROM gardener_watermarks
         WHERE engine_id = ?1 AND source_id = ?2 AND cursor_kind = ?3",
        params![engine_id, source_id, cursor_kind],
        |row| row.get(0),
    )
    .optional()
    .map_err(|_| GardenerError::database())
}

/// Upsert a watermark value.
pub fn advance_watermark(
    conn: &Connection,
    engine_id: &str,
    source_id: &str,
    cursor_kind: &str,
    cursor_value: &str,
    now: &str,
) -> Result<(), GardenerError> {
    conn.execute(
        "INSERT INTO gardener_watermarks
         (engine_id, source_id, cursor_kind, cursor_value, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(engine_id, source_id, cursor_kind)
         DO UPDATE SET cursor_value = excluded.cursor_value, updated_at = excluded.updated_at",
        params![engine_id, source_id, cursor_kind, cursor_value, now],
    )
    .map_err(|_| GardenerError::database())?;
    Ok(())
}

/// Find the most recently updated jira work item matching the optional filters.
pub fn latest_jira_work_item_for_scope(
    conn: &Connection,
    source_id: Option<&str>,
    target_upstream_id: Option<&str>,
) -> Result<Option<GardenerTarget>, GardenerError> {
    conn.query_row(
        "SELECT w.source_system_id, w.source_kind, w.upstream_id,
                COALESCE(w.key, w.upstream_id), w.title, w.status_name,
                p.display_name, w.updated_at_source
         FROM work_items w
         LEFT JOIN people p ON p.id = w.assignee_person_id
         WHERE w.source_kind = 'jira_issue'
           AND (?1 IS NULL OR w.source_system_id = ?1)
           AND (?2 IS NULL OR w.upstream_id = ?2)
         ORDER BY w.updated_at_source IS NULL, w.updated_at_source DESC, w.key ASC
         LIMIT 1",
        params![source_id, target_upstream_id],
        |row| {
            Ok(GardenerTarget {
                source_id: row.get(0)?,
                source_kind: row.get(1)?,
                upstream_id: row.get(2)?,
                display_key: row.get(3)?,
                title: row.get(4)?,
                status: row.get(5)?,
                assignee: row.get(6)?,
                updated_at_source: row.get(7)?,
            })
        },
    )
    .optional()
    .map_err(|_| GardenerError::database())
}

/// Suppress all pending (non-superseded) suggestions for a given target.
/// Returns the count of rows updated.
pub fn suppress_pending_for_changed_target(
    conn: &Connection,
    source_id: &str,
    source_kind: &str,
    upstream_id: &str,
    now: &str,
) -> Result<u32, GardenerError> {
    let n = conn
        .execute(
            "UPDATE gardener_suggestions
             SET state = 'suppressed', updated_at = ?1, terminal_at = ?1
             WHERE source_id = ?2
               AND target_source_kind = ?3
               AND target_upstream_id = ?4
               AND state = 'pending'
               AND superseded_by IS NULL",
            params![now, source_id, source_kind, upstream_id],
        )
        .map_err(|_| GardenerError::database())?;
    Ok(n as u32)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gardener::schema::setup_schema;

    fn open_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        setup_schema(&conn).expect("schema");
        conn
    }

    fn make_insert(id: &str, engine_id: &str, confidence: u8) -> SuggestionInsert {
        SuggestionInsert {
            id: id.to_string(),
            engine_id: engine_id.to_string(),
            category: "hygiene".to_string(),
            action_id: "close_duplicate".to_string(),
            source_id: Some("src-1".to_string()),
            target: GardenerTarget {
                source_id: "src-1".to_string(),
                source_kind: "jira_issue".to_string(),
                upstream_id: "UP-1".to_string(),
                display_key: "UP-1".to_string(),
                title: "Fix bug".to_string(),
                status: Some("In Progress".to_string()),
                assignee: Some("alice".to_string()),
                updated_at_source: Some("2026-01-01T00:00:00Z".to_string()),
            },
            suppression_key: SuppressionKey::Issue {
                source_id: "src-1".to_string(),
                source_kind: "jira_issue".to_string(),
                upstream_id: "UP-1".to_string(),
            },
            confidence,
            title: "Close duplicate UP-1".to_string(),
            rationale: "This is a duplicate.".to_string(),
            payload_json: serde_json::json!({}),
        }
    }

    #[test]
    fn insert_pending_suggestion_and_list() {
        let conn = open_test_db();
        let input = make_insert("sug-1", "eng-1", 80);
        insert_or_supersede_pending(&conn, &input, "2026-01-01T00:00:00Z").expect("insert");

        let list = list_pending_suggestions(&conn).expect("list");
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, "sug-1");
        assert_eq!(list[0].state, "pending");
    }

    #[test]
    fn insert_supersedes_prior_pending_for_same_key() {
        let conn = open_test_db();
        let first = make_insert("sug-1", "eng-1", 80);
        insert_or_supersede_pending(&conn, &first, "2026-01-01T00:00:00Z").expect("first insert");

        let mut second = make_insert("sug-2", "eng-1", 90);
        // Same engine + suppression_key as first
        second.suppression_key = first.suppression_key.clone();
        insert_or_supersede_pending(&conn, &second, "2026-01-02T00:00:00Z").expect("second insert");

        // Only the new row should appear as pending
        let list = list_pending_suggestions(&conn).expect("list");
        assert_eq!(list.len(), 1, "only the new suggestion should be pending");
        assert_eq!(list[0].id, "sug-2");

        // Old row should now be suppressed+superseded
        let old_state: String = conn
            .query_row("SELECT state FROM gardener_suggestions WHERE id='sug-1'", [], |r| r.get(0))
            .expect("query old");
        let old_superseded_by: String = conn
            .query_row("SELECT superseded_by FROM gardener_suggestions WHERE id='sug-1'", [], |r| r.get(0))
            .expect("query superseded_by");
        assert_eq!(old_state, "suppressed");
        assert_eq!(old_superseded_by, "sug-2");
    }

    #[test]
    fn list_pending_sorted_by_confidence_desc_then_key_asc() {
        let conn = open_test_db();
        // Different keys so they don't supersede each other
        let mut a = make_insert("sug-a", "eng-1", 50);
        a.suppression_key = SuppressionKey::Issue {
            source_id: "src-1".to_string(),
            source_kind: "jira_issue".to_string(),
            upstream_id: "AAA-1".to_string(),
        };
        a.target.upstream_id = "AAA-1".to_string();
        a.target.display_key = "AAA-1".to_string();

        let mut b = make_insert("sug-b", "eng-1", 90);
        b.suppression_key = SuppressionKey::Issue {
            source_id: "src-1".to_string(),
            source_kind: "jira_issue".to_string(),
            upstream_id: "BBB-1".to_string(),
        };
        b.target.upstream_id = "BBB-1".to_string();
        b.target.display_key = "BBB-1".to_string();

        insert_or_supersede_pending(&conn, &a, "2026-01-01T00:00:00Z").expect("a");
        insert_or_supersede_pending(&conn, &b, "2026-01-01T00:00:00Z").expect("b");

        let list = list_pending_suggestions(&conn).expect("list");
        assert_eq!(list[0].id, "sug-b", "higher confidence first");
        assert_eq!(list[1].id, "sug-a");
    }

    #[test]
    fn transition_pending_to_applied() {
        let conn = open_test_db();
        let input = make_insert("sug-1", "eng-1", 70);
        insert_or_supersede_pending(&conn, &input, "2026-01-01T00:00:00Z").expect("insert");

        transition_suggestion(&conn, "sug-1", SuggestionState::Applied, "2026-01-02T00:00:00Z")
            .expect("transition");

        let state: String = conn
            .query_row("SELECT state FROM gardener_suggestions WHERE id='sug-1'", [], |r| r.get(0))
            .expect("query");
        let terminal: Option<String> = conn
            .query_row("SELECT terminal_at FROM gardener_suggestions WHERE id='sug-1'", [], |r| r.get(0))
            .expect("query terminal");
        assert_eq!(state, "applied");
        assert!(terminal.is_some(), "terminal_at should be set for terminal states");
    }

    #[test]
    fn transition_invalid_rejects() {
        let conn = open_test_db();
        let input = make_insert("sug-1", "eng-1", 70);
        insert_or_supersede_pending(&conn, &input, "2026-01-01T00:00:00Z").expect("insert");

        // pending -> generating is invalid
        let result = transition_suggestion(&conn, "sug-1", SuggestionState::Generating, "2026-01-02T00:00:00Z");
        assert!(result.is_err(), "invalid transition must be rejected");
        let err = result.unwrap_err();
        assert_eq!(err.category, crate::gardener::errors::GardenerErrorCategory::InvalidTransition);
    }

    #[test]
    fn transition_not_found_returns_error() {
        let conn = open_test_db();
        let result = transition_suggestion(&conn, "no-such-id", SuggestionState::Applied, "2026-01-01T00:00:00Z");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.category, crate::gardener::errors::GardenerErrorCategory::NotFound);
    }

    #[test]
    fn state_machine_valid_transitions() {
        use SuggestionState::*;
        let valid = vec![
            (Detected, Generating),
            (Detected, Pending),
            (Detected, Suppressed),
            (Generating, Detected),
            (Generating, Pending),
            (Generating, Suppressed),
            (Pending, Applied),
            (Pending, Rejected),
            (Pending, Suppressed),
        ];
        for (from, to) in &valid {
            assert!(from.can_transition_to(to), "{:?} -> {:?} should be valid", from, to);
        }
    }

    #[test]
    fn state_machine_invalid_transitions() {
        use SuggestionState::*;
        let invalid = vec![
            (Pending, Generating),
            (Pending, Detected),
            (Applied, Pending),
            (Rejected, Pending),
            (Suppressed, Pending),
        ];
        for (from, to) in &invalid {
            assert!(!from.can_transition_to(to), "{:?} -> {:?} should be invalid", from, to);
        }
    }

    #[test]
    fn record_suppression_and_exists() {
        let conn = open_test_db();
        let key = SuppressionKey::Issue {
            source_id: "src-1".to_string(),
            source_kind: "jira_issue".to_string(),
            upstream_id: "UP-1".to_string(),
        };
        let input = SuppressionInput {
            id: "sup-1".to_string(),
            engine_id: "eng-1".to_string(),
            key: key.clone(),
            reason: "already handled".to_string(),
        };
        record_suppression(&conn, &input, "2026-01-01T00:00:00Z").expect("record");
        assert!(suppression_exists(&conn, "eng-1", &key).expect("exists"));
        assert!(!suppression_exists(&conn, "eng-2", &key).expect("other engine"));
    }

    #[test]
    fn suppression_upsert_replaces_existing() {
        let conn = open_test_db();
        let key = SuppressionKey::Issue {
            source_id: "src-1".to_string(),
            source_kind: "jira_issue".to_string(),
            upstream_id: "UP-2".to_string(),
        };
        let input1 = SuppressionInput {
            id: "sup-1".to_string(),
            engine_id: "eng-1".to_string(),
            key: key.clone(),
            reason: "first".to_string(),
        };
        let input2 = SuppressionInput {
            id: "sup-2".to_string(),
            engine_id: "eng-1".to_string(),
            key: key.clone(),
            reason: "second".to_string(),
        };
        record_suppression(&conn, &input1, "2026-01-01T00:00:00Z").expect("first");
        record_suppression(&conn, &input2, "2026-01-02T00:00:00Z").expect("second");

        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM gardener_suppressions WHERE engine_id='eng-1'",
                [],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(count, 1, "upsert must not create duplicates");
    }

    #[test]
    fn pair_suppression_key_is_order_independent() {
        let a = SourceIdentityKey { source_id: "s".into(), source_kind: "jira_issue".into(), upstream_id: "A-1".into() };
        let b = SourceIdentityKey { source_id: "s".into(), source_kind: "jira_issue".into(), upstream_id: "B-1".into() };
        let key_ab = SuppressionKey::Pair { left: a.clone(), right: b.clone() };
        let key_ba = SuppressionKey::Pair { left: b.clone(), right: a.clone() };
        let json_ab = canonical_suppression_key_json(&key_ab).expect("ab");
        let json_ba = canonical_suppression_key_json(&key_ba).expect("ba");
        assert_eq!(json_ab, json_ba, "pair key must be order-independent");
    }

    #[test]
    fn watermark_roundtrip() {
        let conn = open_test_db();
        let initial = read_watermark(&conn, "eng-1", "src-1", "page").expect("read initial");
        assert!(initial.is_none(), "no watermark before set");

        advance_watermark(&conn, "eng-1", "src-1", "page", "42", "2026-01-01T00:00:00Z").expect("advance");
        let after = read_watermark(&conn, "eng-1", "src-1", "page").expect("read after");
        assert_eq!(after.as_deref(), Some("42"));

        // Advance again
        advance_watermark(&conn, "eng-1", "src-1", "page", "100", "2026-01-02T00:00:00Z").expect("advance2");
        let after2 = read_watermark(&conn, "eng-1", "src-1", "page").expect("read after2");
        assert_eq!(after2.as_deref(), Some("100"));
    }

    #[test]
    fn terminal_suggestion_is_not_superseded_by_new_pending() {
        let conn = open_test_db();
        let now = "2026-01-01T00:00:00Z";
        let later = "2026-01-01T01:00:00Z";

        let first = make_insert("sug-terminal-1", "reference", 60);

        // Insert the first suggestion then transition it to rejected (terminal)
        let first_id = insert_or_supersede_pending(&conn, &first, now).expect("first insert");
        transition_suggestion(&conn, &first_id, SuggestionState::Rejected, now)
            .expect("transition to rejected");

        // Insert a new suggestion with the same engine + suppression key
        let second = make_insert("sug-terminal-2", "reference", 60);
        let second_id = insert_or_supersede_pending(&conn, &second, later).expect("second insert");

        // The rejected row must remain rejected — it must not be suppressed
        let rejected_state: String = conn
            .query_row(
                "SELECT state FROM gardener_suggestions WHERE id = ?1",
                params![&first_id],
                |r| r.get(0),
            )
            .expect("query rejected row");
        assert_eq!(rejected_state, "rejected", "terminal row must remain rejected, not suppressed");

        // The new pending row should be present
        let pending = list_pending_suggestions(&conn).expect("list pending");
        assert!(
            pending.iter().any(|s| s.id == second_id),
            "new pending suggestion should be visible"
        );
        assert_eq!(pending.len(), 1, "only one pending suggestion should exist");
    }

    #[test]
    fn suppress_pending_for_changed_target_updates_rows() {
        let conn = open_test_db();

        // Insert two suggestions for different keys but same target
        let mut a = make_insert("sug-a", "eng-1", 70);
        a.suppression_key = SuppressionKey::Issue {
            source_id: "src-1".to_string(),
            source_kind: "jira_issue".to_string(),
            upstream_id: "UP-10".to_string(),
        };
        a.target.upstream_id = "UP-10".to_string();
        a.target.display_key = "UP-10".to_string();
        a.source_id = Some("src-1".to_string());

        let mut b = make_insert("sug-b", "eng-1", 60);
        b.suppression_key = SuppressionKey::Issue {
            source_id: "src-1".to_string(),
            source_kind: "jira_issue".to_string(),
            upstream_id: "UP-11".to_string(),
        };
        b.target.upstream_id = "UP-10".to_string(); // same target upstream_id
        b.target.display_key = "UP-10".to_string();
        b.source_id = Some("src-1".to_string());

        insert_or_supersede_pending(&conn, &a, "2026-01-01T00:00:00Z").expect("a");
        insert_or_supersede_pending(&conn, &b, "2026-01-01T00:00:00Z").expect("b");

        let n = suppress_pending_for_changed_target(&conn, "src-1", "jira_issue", "UP-10", "2026-01-02T00:00:00Z")
            .expect("suppress");
        assert_eq!(n, 2, "both pending suggestions for target should be suppressed");

        let list = list_pending_suggestions(&conn).expect("list");
        assert!(list.is_empty(), "no pending suggestions should remain");
    }
}
