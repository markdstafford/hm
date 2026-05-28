use rusqlite::{Connection, Result};

/// Apply the work-data DDL (source systems, ingestion bookkeeping, people,
/// source-neutral work items, Jira-specific tables, indexable documents).
///
/// Enables `PRAGMA foreign_keys = ON` on the connection so the `REFERENCES`
/// clauses are actually enforced at runtime — without this, SQLite parses but
/// ignores foreign keys.
pub fn setup_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS source_systems (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            deployment_kind TEXT,
            display_name TEXT NOT NULL,
            base_url TEXT,
            config_source_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(kind, base_url, config_source_id)
        );

        CREATE TABLE IF NOT EXISTS ingestion_runs (
            id TEXT PRIMARY KEY,
            source_system_id TEXT NOT NULL REFERENCES source_systems(id),
            connector TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            requested_projects_json TEXT NOT NULL,
            progress_json TEXT NOT NULL,
            counts_json TEXT NOT NULL,
            cancellation_requested_at TEXT,
            error_summary TEXT
        );

        CREATE TABLE IF NOT EXISTS ingestion_cursors (
            source_system_id TEXT NOT NULL REFERENCES source_systems(id),
            connector TEXT NOT NULL,
            cursor_key TEXT NOT NULL,
            cursor_value TEXT NOT NULL,
            last_successful_sync_at TEXT,
            updated_at TEXT NOT NULL,
            PRIMARY KEY(source_system_id, connector, cursor_key)
        );

        CREATE TABLE IF NOT EXISTS people (
            id TEXT PRIMARY KEY,
            display_name TEXT,
            primary_email TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS source_identities (
            id TEXT PRIMARY KEY,
            person_id TEXT NOT NULL REFERENCES people(id),
            source_system_id TEXT NOT NULL REFERENCES source_systems(id),
            source_kind TEXT NOT NULL,
            upstream_account_id TEXT,
            upstream_name TEXT,
            upstream_key TEXT,
            username TEXT,
            email TEXT,
            display_name TEXT,
            avatar_url TEXT,
            raw_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(source_system_id, source_kind, upstream_account_id),
            UNIQUE(source_system_id, source_kind, upstream_name),
            UNIQUE(source_system_id, source_kind, upstream_key)
        );

        CREATE TABLE IF NOT EXISTS identity_links (
            id TEXT PRIMARY KEY,
            person_id TEXT NOT NULL REFERENCES people(id),
            source_identity_id TEXT NOT NULL REFERENCES source_identities(id),
            link_confidence TEXT NOT NULL,
            linked_at TEXT NOT NULL,
            UNIQUE(person_id, source_identity_id)
        );

        CREATE TABLE IF NOT EXISTS work_items (
            id TEXT PRIMARY KEY,
            source_system_id TEXT NOT NULL REFERENCES source_systems(id),
            source_kind TEXT NOT NULL,
            upstream_id TEXT NOT NULL,
            key TEXT,
            url TEXT,
            title TEXT NOT NULL,
            body TEXT,
            state TEXT NOT NULL,
            status_name TEXT,
            resolution_name TEXT,
            priority_name TEXT,
            item_type TEXT,
            project_key TEXT,
            project_name TEXT,
            assignee_person_id TEXT REFERENCES people(id),
            reporter_person_id TEXT REFERENCES people(id),
            created_at_source TEXT,
            updated_at_source TEXT,
            resolved_at_source TEXT,
            due_at_source TEXT,
            last_seen_at TEXT NOT NULL,
            raw_updated_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(source_system_id, source_kind, upstream_id),
            UNIQUE(source_system_id, source_kind, key)
        );

        CREATE TABLE IF NOT EXISTS work_item_terms (
            work_item_id TEXT NOT NULL REFERENCES work_items(id),
            term_kind TEXT NOT NULL,
            term_key TEXT NOT NULL,
            term_name TEXT,
            raw_json TEXT,
            PRIMARY KEY(work_item_id, term_kind, term_key)
        );

        CREATE TABLE IF NOT EXISTS work_item_relationships (
            id TEXT PRIMARY KEY,
            source_system_id TEXT NOT NULL REFERENCES source_systems(id),
            source_kind TEXT NOT NULL,
            from_work_item_id TEXT REFERENCES work_items(id),
            to_work_item_id TEXT REFERENCES work_items(id),
            from_upstream_key TEXT,
            to_upstream_key TEXT,
            relationship_type TEXT NOT NULL,
            direction TEXT,
            raw_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(source_system_id, source_kind, from_upstream_key, to_upstream_key, relationship_type)
        );

        CREATE TABLE IF NOT EXISTS work_item_comments (
            id TEXT PRIMARY KEY,
            work_item_id TEXT NOT NULL REFERENCES work_items(id),
            source_system_id TEXT NOT NULL REFERENCES source_systems(id),
            upstream_id TEXT NOT NULL,
            author_identity_id TEXT REFERENCES source_identities(id),
            body TEXT,
            visibility_json TEXT,
            created_at_source TEXT,
            updated_at_source TEXT,
            raw_json TEXT,
            body_hash TEXT NOT NULL,
            ingested_at TEXT NOT NULL,
            UNIQUE(source_system_id, upstream_id)
        );

        CREATE TABLE IF NOT EXISTS jira_issues (
            work_item_id TEXT PRIMARY KEY REFERENCES work_items(id),
            jira_id TEXT NOT NULL,
            jira_key TEXT NOT NULL,
            self_url TEXT,
            project_id TEXT,
            project_key TEXT,
            project_name TEXT,
            issue_type_id TEXT,
            issue_type_name TEXT,
            status_id TEXT,
            status_name TEXT,
            status_category_key TEXT,
            resolution_id TEXT,
            resolution_name TEXT,
            priority_id TEXT,
            priority_name TEXT,
            watches_count INTEGER,
            votes_count INTEGER,
            parent_link TEXT,
            customer_name TEXT,
            epic_link TEXT,
            epic_name TEXT,
            epic_status TEXT,
            sprint_names_json TEXT,
            product_names_json TEXT,
            assigned_team_names_json TEXT,
            raw_fields_json TEXT NOT NULL,
            raw_issue_json TEXT NOT NULL,
            fields_hash TEXT NOT NULL,
            updated_at_source TEXT,
            ingested_at TEXT NOT NULL,
            UNIQUE(jira_id),
            UNIQUE(jira_key)
        );

        CREATE TABLE IF NOT EXISTS jira_field_definitions (
            source_system_id TEXT NOT NULL REFERENCES source_systems(id),
            field_id TEXT NOT NULL,
            field_name TEXT,
            field_schema_json TEXT,
            is_custom INTEGER NOT NULL,
            last_seen_at TEXT NOT NULL,
            PRIMARY KEY(source_system_id, field_id)
        );

        CREATE TABLE IF NOT EXISTS jira_project_field_mappings (
            source_system_id TEXT NOT NULL REFERENCES source_systems(id),
            project_key TEXT NOT NULL,
            canonical_name TEXT NOT NULL,
            field_id TEXT NOT NULL,
            field_name TEXT,
            value_kind TEXT NOT NULL,
            required_for_ingestion INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL,
            PRIMARY KEY(source_system_id, project_key, canonical_name)
        );

        CREATE TABLE IF NOT EXISTS jira_issue_field_values (
            work_item_id TEXT NOT NULL REFERENCES work_items(id),
            field_id TEXT NOT NULL,
            field_name TEXT,
            canonical_name TEXT,
            value_kind TEXT NOT NULL,
            value_text TEXT,
            value_number REAL,
            value_datetime TEXT,
            value_json TEXT,
            value_hash TEXT NOT NULL,
            updated_at_source TEXT,
            PRIMARY KEY(work_item_id, field_id)
        );

        CREATE TABLE IF NOT EXISTS jira_worklogs (
            id TEXT PRIMARY KEY,
            work_item_id TEXT NOT NULL REFERENCES work_items(id),
            source_system_id TEXT NOT NULL REFERENCES source_systems(id),
            upstream_id TEXT NOT NULL,
            author_identity_id TEXT REFERENCES source_identities(id),
            update_author_identity_id TEXT REFERENCES source_identities(id),
            started_at_source TEXT,
            time_spent_seconds INTEGER,
            comment TEXT,
            raw_json TEXT,
            raw_hash TEXT NOT NULL,
            ingested_at TEXT NOT NULL,
            UNIQUE(source_system_id, upstream_id)
        );

        CREATE TABLE IF NOT EXISTS jira_remote_links (
            id TEXT PRIMARY KEY,
            work_item_id TEXT NOT NULL REFERENCES work_items(id),
            source_system_id TEXT NOT NULL REFERENCES source_systems(id),
            upstream_id TEXT,
            url TEXT NOT NULL,
            title TEXT,
            relationship TEXT,
            raw_json TEXT,
            raw_hash TEXT NOT NULL,
            ingested_at TEXT NOT NULL,
            UNIQUE(source_system_id, work_item_id, url)
        );

        CREATE TABLE IF NOT EXISTS issue_events (
          id TEXT PRIMARY KEY,
          source_system_id TEXT NOT NULL REFERENCES source_systems(id),
          issue_id TEXT NOT NULL REFERENCES work_items(id),
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          source_kind TEXT NOT NULL,
          event_type TEXT NOT NULL,
          upstream_event_id TEXT,
          upstream_item_id TEXT,
          field_id TEXT,
          field_name TEXT,
          actor_identity_id TEXT REFERENCES source_identities(id),
          actor_display_name TEXT,
          occurred_at TEXT NOT NULL,
          from_string TEXT,
          to_string TEXT,
          from_json TEXT,
          to_json TEXT,
          payload_json TEXT NOT NULL,
          ingested_at TEXT NOT NULL,
          -- Secondary dedup: the primary key (id) is the main uniqueness guarantee via
          -- deterministic stable_id generation in the ingestion layer. This constraint
          -- catches cases where the same upstream event is accidentally assigned different ids;
          -- SQLite treats NULLs as distinct so rows with NULL upstream IDs rely on the PK alone.
          UNIQUE(source_system_id, upstream_event_id, upstream_item_id, issue_id, event_type)
        );

        CREATE INDEX IF NOT EXISTS idx_issue_events_issue_time
          ON issue_events(issue_id, occurred_at DESC);

        CREATE INDEX IF NOT EXISTS idx_issue_events_type_time
          ON issue_events(event_type, occurred_at DESC);

        CREATE TABLE IF NOT EXISTS issue_snapshots (
          issue_id TEXT NOT NULL REFERENCES work_items(id),
          snapshot_date TEXT NOT NULL,
          source_system_id TEXT NOT NULL REFERENCES source_systems(id),
          source_kind TEXT NOT NULL,
          key TEXT,
          title TEXT NOT NULL,
          body_hash TEXT,
          state TEXT NOT NULL,
          status_name TEXT,
          status_id TEXT,
          resolution_name TEXT,
          resolution_id TEXT,
          priority_name TEXT,
          priority_id TEXT,
          item_type TEXT,
          project_key TEXT,
          project_name TEXT,
          assignee_person_id TEXT REFERENCES people(id),
          reporter_person_id TEXT REFERENCES people(id),
          labels_json TEXT NOT NULL DEFAULT '[]',
          components_json TEXT NOT NULL DEFAULT '[]',
          fix_versions_json TEXT NOT NULL DEFAULT '[]',
          sprint_names_json TEXT NOT NULL DEFAULT '[]',
          product_names_json TEXT NOT NULL DEFAULT '[]',
          assigned_team_names_json TEXT NOT NULL DEFAULT '[]',
          customer_name TEXT,
          parent_link TEXT,
          epic_link TEXT,
          epic_name TEXT,
          epic_status TEXT,
          created_at_source TEXT,
          updated_at_source TEXT,
          resolved_at_source TEXT,
          due_at_source TEXT,
          snapshot_source TEXT NOT NULL,
          generated_at TEXT NOT NULL,
          PRIMARY KEY(issue_id, snapshot_date)
        );

        CREATE INDEX IF NOT EXISTS idx_issue_snapshots_project_date
          ON issue_snapshots(project_key, snapshot_date);

        CREATE INDEX IF NOT EXISTS idx_issue_snapshots_source_date
          ON issue_snapshots(source_system_id, snapshot_date);

        CREATE TABLE IF NOT EXISTS issue_snapshot_jobs (
          id TEXT PRIMARY KEY,
          source_system_id TEXT REFERENCES source_systems(id),
          job_kind TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          target_start_date TEXT,
          target_end_date TEXT,
          progress_json TEXT NOT NULL,
          error_summary TEXT
        );

        CREATE TABLE IF NOT EXISTS indexable_documents (
            id TEXT PRIMARY KEY,
            source_system_id TEXT NOT NULL REFERENCES source_systems(id),
            entity_kind TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            work_item_id TEXT REFERENCES work_items(id),
            title TEXT,
            body TEXT NOT NULL,
            metadata_json TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            embedding_status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(entity_kind, entity_id, content_hash)
        );",
    )
}

#[cfg(test)]
mod tests {
    use crate::db::open_in_memory;
    use rusqlite::params;

    const EXPECTED_TABLES: &[&str] = &[
        "source_systems",
        "ingestion_runs",
        "ingestion_cursors",
        "people",
        "source_identities",
        "identity_links",
        "work_items",
        "work_item_terms",
        "work_item_relationships",
        "work_item_comments",
        "jira_issues",
        "jira_field_definitions",
        "jira_project_field_mappings",
        "jira_issue_field_values",
        "jira_worklogs",
        "jira_remote_links",
        "issue_events",
        "issue_snapshots",
        "issue_snapshot_jobs",
        "indexable_documents",
    ];

    fn table_exists(conn: &rusqlite::Connection, name: &str) -> bool {
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?1",
                [name],
                |row| row.get(0),
            )
            .expect("sqlite_master query should succeed");
        count == 1
    }

    fn column_names(conn: &rusqlite::Connection, table: &str) -> Vec<String> {
        let sql = format!("PRAGMA table_info({table})");
        let mut stmt = conn.prepare(&sql).expect("prepare table_info");
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .expect("query table_info");
        rows.map(|r| r.expect("row")).collect()
    }

    fn insert_source_system(conn: &rusqlite::Connection, id: &str, base_url: &str) -> rusqlite::Result<usize> {
        conn.execute(
            "INSERT INTO source_systems (id, kind, deployment_kind, display_name, base_url, config_source_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                id,
                "jira",
                "cloud",
                "Test Jira",
                base_url,
                "primary",
                "2026-05-25T17:00:00Z",
                "2026-05-25T17:00:00Z",
            ],
        )
    }

    #[test]
    fn creates_core_work_data_tables() {
        let conn = open_in_memory().expect("database should open");
        assert_eq!(EXPECTED_TABLES.len(), 20, "expected 20 work-data tables");
        for table in EXPECTED_TABLES {
            assert!(
                table_exists(&conn, table),
                "table {table} must exist after schema setup"
            );
        }
    }

    #[test]
    fn unique_constraints_support_idempotent_upserts() {
        let conn = open_in_memory().expect("database should open");
        insert_source_system(&conn, "src-1", "https://jira.example.com")
            .expect("first insert should succeed");
        let err = insert_source_system(&conn, "src-2", "https://jira.example.com")
            .expect_err("duplicate (kind, base_url, config_source_id) must fail");
        let msg = err.to_string().to_lowercase();
        assert!(
            msg.contains("unique") || msg.contains("constraint"),
            "expected unique-constraint error, got: {err}"
        );
    }

    #[test]
    fn per_resource_cursors_are_distinct() {
        let conn = open_in_memory().expect("database should open");
        insert_source_system(&conn, "src-1", "https://jira.example.com")
            .expect("source system insert");

        for cursor_key in ["issues:search", "issues:changelog", "fields", "worklogs"] {
            conn.execute(
                "INSERT INTO ingestion_cursors (source_system_id, connector, cursor_key, cursor_value, last_successful_sync_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    "src-1",
                    "jira",
                    cursor_key,
                    "0",
                    "2026-05-25T17:00:00Z",
                    "2026-05-25T17:00:00Z",
                ],
            )
            .expect("cursor insert should succeed");
        }

        let count: i64 = conn
            .query_row("SELECT count(*) FROM ingestion_cursors", [], |row| row.get(0))
            .expect("count query");
        assert_eq!(count, 4, "four distinct cursor keys should coexist");
    }

    #[test]
    fn foreign_keys_are_enforced() {
        let conn = open_in_memory().expect("database should open");
        let result = conn.execute(
            "INSERT INTO ingestion_runs (id, source_system_id, connector, status, started_at, requested_projects_json, progress_json, counts_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                "run-1",
                "does-not-exist",
                "jira",
                "running",
                "2026-05-25T17:00:00Z",
                "[]",
                "{}",
                "{}",
            ],
        );
        let err = result.expect_err("FK violation should be raised when source_system_id is missing");
        let msg = err.to_string().to_lowercase();
        assert!(
            msg.contains("foreign key") || msg.contains("constraint"),
            "expected foreign-key constraint error, got: {err}"
        );
    }

    #[test]
    fn iso8601_timestamps_round_trip() {
        let conn = open_in_memory().expect("database should open");
        let ts = "2026-05-25T17:24:12Z";
        conn.execute(
            "INSERT INTO source_systems (id, kind, deployment_kind, display_name, base_url, config_source_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                "src-ts",
                "jira",
                "cloud",
                "TS Test",
                "https://ts.example.com",
                "primary",
                ts,
                ts,
            ],
        )
        .expect("insert");

        let (created, updated): (String, String) = conn
            .query_row(
                "SELECT created_at, updated_at FROM source_systems WHERE id=?1",
                ["src-ts"],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("select");
        assert_eq!(created, ts);
        assert_eq!(updated, ts);
    }

    #[test]
    fn history_tables_and_indexes_are_created() {
        let conn = crate::db::open_in_memory().expect("database should open");
        super::setup_schema(&conn).expect("schema setup should succeed");

        let issue_events_sql: String = conn
            .query_row(
                "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'issue_events'",
                [],
                |row| row.get(0),
            )
            .expect("issue_events table should exist");
        assert!(issue_events_sql.contains("upstream_event_id TEXT"));
        assert!(issue_events_sql.contains("payload_json TEXT NOT NULL"));
        assert!(issue_events_sql.contains("UNIQUE(source_system_id, upstream_event_id, upstream_item_id, issue_id, event_type)"));

        let issue_snapshots_sql: String = conn
            .query_row(
                "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'issue_snapshots'",
                [],
                |row| row.get(0),
            )
            .expect("issue_snapshots table should exist");
        assert!(issue_snapshots_sql.contains("snapshot_date TEXT NOT NULL"));
        assert!(issue_snapshots_sql.contains("labels_json TEXT NOT NULL DEFAULT '[]'"));
        assert!(issue_snapshots_sql.contains("PRIMARY KEY(issue_id, snapshot_date)"));

        let jobs_sql: String = conn
            .query_row(
                "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'issue_snapshot_jobs'",
                [],
                |row| row.get(0),
            )
            .expect("issue_snapshot_jobs table should exist");
        assert!(jobs_sql.contains("job_kind TEXT NOT NULL"));
        assert!(jobs_sql.contains("progress_json TEXT NOT NULL"));

        for index_name in [
            "idx_issue_events_issue_time",
            "idx_issue_events_type_time",
            "idx_issue_snapshots_project_date",
            "idx_issue_snapshots_source_date",
        ] {
            let exists: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = ?1",
                    [index_name],
                    |row| row.get(0),
                )
                .expect("sqlite_master index query should succeed");
            assert_eq!(exists, 1, "missing index {index_name}");
        }
    }

    #[test]
    fn event_and_snapshot_prereqs_present() {
        let conn = open_in_memory().expect("database should open");

        let work_items_cols = column_names(&conn, "work_items");
        assert!(
            work_items_cols.iter().any(|c| c == "raw_updated_hash"),
            "work_items.raw_updated_hash required for event-vs-snapshot reconciliation; got cols: {work_items_cols:?}"
        );
        assert!(
            work_items_cols.iter().any(|c| c == "last_seen_at"),
            "work_items.last_seen_at required; got cols: {work_items_cols:?}"
        );

        let jira_cols = column_names(&conn, "jira_issues");
        assert!(
            jira_cols.iter().any(|c| c == "fields_hash"),
            "jira_issues.fields_hash required; got cols: {jira_cols:?}"
        );
        assert!(
            jira_cols.iter().any(|c| c == "raw_issue_json"),
            "jira_issues.raw_issue_json required; got cols: {jira_cols:?}"
        );

        let cursor_cols = column_names(&conn, "ingestion_cursors");
        assert!(
            cursor_cols.iter().any(|c| c == "last_successful_sync_at"),
            "ingestion_cursors.last_successful_sync_at required; got cols: {cursor_cols:?}"
        );
    }
}
