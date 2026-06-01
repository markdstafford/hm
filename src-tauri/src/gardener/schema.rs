use rusqlite::Connection;

pub fn setup_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS gardener_suggestions (
            id TEXT PRIMARY KEY,
            engine_id TEXT NOT NULL,
            category TEXT NOT NULL,
            state TEXT NOT NULL,
            action_id TEXT NOT NULL,
            source_id TEXT,
            target_source_kind TEXT NOT NULL,
            target_upstream_id TEXT NOT NULL,
            target_display_key TEXT NOT NULL,
            suppression_key_json TEXT NOT NULL,
            confidence INTEGER NOT NULL CHECK(confidence >= 0 AND confidence <= 100),
            title TEXT NOT NULL,
            status TEXT,
            assignee TEXT,
            rationale TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            superseded_by TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            terminal_at TEXT,
            CHECK(state IN ('detected','generating','pending','applied','rejected','suppressed'))
        );
        CREATE INDEX IF NOT EXISTS idx_gardener_suggestions_pending
            ON gardener_suggestions(state, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_gardener_suggestions_engine_key_state
            ON gardener_suggestions(engine_id, suppression_key_json, state);
        CREATE INDEX IF NOT EXISTS idx_gardener_suggestions_target
            ON gardener_suggestions(source_id, target_source_kind, target_upstream_id);

        CREATE TABLE IF NOT EXISTS gardener_suppressions (
            id TEXT PRIMARY KEY,
            engine_id TEXT NOT NULL,
            key_kind TEXT NOT NULL CHECK(key_kind IN ('issue','pair')),
            key_json TEXT NOT NULL,
            reason TEXT NOT NULL,
            recorded_at TEXT NOT NULL,
            note TEXT,
            actor TEXT,
            UNIQUE(engine_id, key_kind, key_json)
        );

        CREATE TABLE IF NOT EXISTS gardener_watermarks (
            engine_id TEXT NOT NULL,
            source_id TEXT NOT NULL,
            cursor_kind TEXT NOT NULL,
            cursor_value TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY(engine_id, source_id, cursor_kind)
        );",
    )?;
    Ok(())
}

pub fn assert_schema(conn: &Connection) -> rusqlite::Result<()> {
    let required: &[(&str, &[&str])] = &[
        (
            "gardener_suggestions",
            &[
                "id",
                "engine_id",
                "category",
                "state",
                "action_id",
                "source_id",
                "target_source_kind",
                "target_upstream_id",
                "target_display_key",
                "suppression_key_json",
                "confidence",
                "title",
                "status",
                "assignee",
                "rationale",
                "payload_json",
                "superseded_by",
                "created_at",
                "updated_at",
                "terminal_at",
            ],
        ),
        (
            "gardener_suppressions",
            &[
                "id",
                "engine_id",
                "key_kind",
                "key_json",
                "reason",
                "recorded_at",
                "note",
                "actor",
            ],
        ),
        (
            "gardener_watermarks",
            &[
                "engine_id",
                "source_id",
                "cursor_kind",
                "cursor_value",
                "updated_at",
            ],
        ),
    ];

    for (table, columns) in required {
        let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
        let actual_columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        for col in *columns {
            if !actual_columns.iter().any(|c| c == col) {
                return Err(rusqlite::Error::SqliteFailure(
                    rusqlite::ffi::Error {
                        code: rusqlite::ffi::ErrorCode::Unknown,
                        extended_code: 1,
                    },
                    Some(format!("missing column {col} in {table}")),
                ));
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn open_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        setup_schema(&conn).expect("schema setup");
        conn
    }

    #[test]
    fn setup_schema_creates_gardener_suggestions_table() {
        let conn = open_test_db();
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='gardener_suggestions'",
                [],
                |r| r.get(0),
            )
            .expect("query");
        assert_eq!(count, 1, "gardener_suggestions table must exist");
    }

    #[test]
    fn setup_schema_creates_gardener_suppressions_table() {
        let conn = open_test_db();
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='gardener_suppressions'",
                [],
                |r| r.get(0),
            )
            .expect("query");
        assert_eq!(count, 1, "gardener_suppressions table must exist");
    }

    #[test]
    fn setup_schema_creates_gardener_watermarks_table() {
        let conn = open_test_db();
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='gardener_watermarks'",
                [],
                |r| r.get(0),
            )
            .expect("query");
        assert_eq!(count, 1, "gardener_watermarks table must exist");
    }

    #[test]
    fn setup_schema_creates_required_indexes() {
        let conn = open_test_db();
        for name in [
            "idx_gardener_suggestions_pending",
            "idx_gardener_suggestions_engine_key_state",
            "idx_gardener_suggestions_target",
        ] {
            let count: i64 = conn
                .query_row(
                    "SELECT count(*) FROM sqlite_master WHERE type='index' AND name=?1",
                    [name],
                    |r| r.get(0),
                )
                .expect("query");
            assert_eq!(count, 1, "index {name} must exist");
        }
    }

    #[test]
    fn setup_schema_is_idempotent() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        setup_schema(&conn).expect("first setup");
        setup_schema(&conn).expect("second setup should be idempotent");
    }

    #[test]
    fn assert_schema_passes_after_setup() {
        let conn = open_test_db();
        assert_schema(&conn).expect("assert_schema should pass after setup_schema");
    }

    #[test]
    fn gardener_suggestions_rejects_invalid_state() {
        let conn = open_test_db();
        let result = conn.execute(
            "INSERT INTO gardener_suggestions
             (id, engine_id, category, state, action_id, target_source_kind,
              target_upstream_id, target_display_key, suppression_key_json,
              confidence, title, rationale, payload_json, created_at, updated_at)
             VALUES ('x','e','c','invalid_state','a','jira_issue','UP-1','UP-1','{}',50,'t','r','{}','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')",
            [],
        );
        assert!(
            result.is_err(),
            "invalid state must be rejected by CHECK constraint"
        );
    }

    #[test]
    fn gardener_suggestions_accepts_valid_state() {
        let conn = open_test_db();
        for state in [
            "detected",
            "generating",
            "pending",
            "applied",
            "rejected",
            "suppressed",
        ] {
            conn.execute(
                "INSERT INTO gardener_suggestions
                 (id, engine_id, category, state, action_id, target_source_kind,
                  target_upstream_id, target_display_key, suppression_key_json,
                  confidence, title, rationale, payload_json, created_at, updated_at)
                 VALUES (?1,'e','c',?2,'a','jira_issue','UP-1','UP-1','{}',50,'t','r','{}','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')",
                rusqlite::params![format!("sug_{state}"), state],
            ).expect(&format!("state '{state}' should be accepted"));
        }
    }

    #[test]
    fn gardener_suppressions_rejects_invalid_key_kind() {
        let conn = open_test_db();
        let result = conn.execute(
            "INSERT INTO gardener_suppressions
             (id, engine_id, key_kind, key_json, reason, recorded_at)
             VALUES ('x','e','bad_kind','{}','r','2026-01-01T00:00:00Z')",
            [],
        );
        assert!(
            result.is_err(),
            "invalid key_kind must be rejected by CHECK constraint"
        );
    }

    #[test]
    fn gardener_watermarks_primary_key_enforced() {
        let conn = open_test_db();
        conn.execute(
            "INSERT INTO gardener_watermarks (engine_id, source_id, cursor_kind, cursor_value, updated_at)
             VALUES ('eng1','src1','page','1','2026-01-01T00:00:00Z')",
            [],
        )
        .expect("first insert");
        let result = conn.execute(
            "INSERT INTO gardener_watermarks (engine_id, source_id, cursor_kind, cursor_value, updated_at)
             VALUES ('eng1','src1','page','2','2026-01-01T00:00:00Z')",
            [],
        );
        assert!(result.is_err(), "duplicate PK must be rejected");
    }
}
