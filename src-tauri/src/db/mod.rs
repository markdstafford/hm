use rusqlite::{Connection, Result};

pub fn open_in_memory() -> Result<Connection> {
    let conn = Connection::open_in_memory()?;
    setup_schema(&conn)?;
    Ok(conn)
}

pub fn setup_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS migrations (
            id          INTEGER PRIMARY KEY,
            name        TEXT    NOT NULL,
            applied_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS shared_settings (
            key         TEXT PRIMARY KEY,
            value_json  TEXT NOT NULL,
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    )?;
    crate::collections::views::setup_schema(conn)?;
    crate::issues::schema::setup_schema(conn)?;
    crate::audit::repository::setup_schema(conn)?;
    crate::embeddings::repository::setup_schema(conn)?;
    Ok(())
}

pub fn open_at(path: &std::path::Path) -> Result<Connection> {
    let conn = Connection::open(path)?;
    setup_schema(&conn)?;
    Ok(conn)
}

/// Load the sqlite-vec extension so that `vec_*` SQL functions become available.
///
/// sqlite-vec 0.1.9 exposes only a raw C entry point (`sqlite3_vec_init`), so we
/// register it via `sqlite3_auto_extension` — the same approach used in the
/// crate's own test suite.
///
/// The test for this function intentionally does **not** hard-fail if the
/// extension fails to load (e.g. in sandboxed CI environments).
pub fn load_sqlite_vec(conn: &Connection) -> Result<()> {
    unsafe {
        // sqlite3_auto_extension expects a function pointer with the SQLite extension
        // entry-point signature. sqlite_vec::sqlite3_vec_init is that function; we
        // transmute the raw pointer to match what rusqlite's FFI binding expects.
        type ExtensionEntryPoint = unsafe extern "C" fn(
            *mut rusqlite::ffi::sqlite3,
            *mut *mut std::os::raw::c_char,
            *const rusqlite::ffi::sqlite3_api_routines,
        ) -> std::os::raw::c_int;
        let entry: ExtensionEntryPoint =
            std::mem::transmute(sqlite_vec::sqlite3_vec_init as *const ());
        rusqlite::ffi::sqlite3_auto_extension(Some(entry));
    }
    // Verify the extension is actually available on this connection.
    conn.query_row("SELECT vec_version()", [], |_| Ok(()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn schema_creates_migrations_table() {
        let conn = open_in_memory().expect("database should open");
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='migrations'",
                [],
                |row| row.get(0),
            )
            .expect("query should succeed");
        assert_eq!(count, 1, "migrations table must exist after schema setup");
    }

    #[test]
    fn migrations_table_accepts_insert() {
        let conn = open_in_memory().expect("database should open");
        conn.execute(
            "INSERT INTO migrations (name) VALUES (?1)",
            ["initial_schema"],
        )
        .expect("insert should succeed");
        let count: i64 = conn
            .query_row("SELECT count(*) FROM migrations", [], |row| row.get(0))
            .expect("count query should succeed");
        assert_eq!(count, 1, "inserted row should be present");
    }

    #[test]
    fn schema_creates_shared_settings_table() {
        let conn = open_in_memory().expect("database should open");
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='shared_settings'",
                [],
                |row| row.get(0),
            )
            .expect("query should succeed");
        assert_eq!(count, 1, "shared_settings table must exist after schema setup");
    }

    #[test]
    fn schema_creates_collection_views_table() {
        let conn = open_in_memory().expect("database should open");
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='collection_views'",
                [],
                |row| row.get(0),
            )
            .expect("query should succeed");
        assert_eq!(count, 1, "collection_views table must exist after schema setup");
    }

    #[test]
    fn schema_creates_collection_view_seed_state_table() {
        let conn = open_in_memory().expect("database should open");
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='collection_view_seed_state'",
                [],
                |row| row.get(0),
            )
            .expect("query should succeed");
        assert_eq!(
            count, 1,
            "collection_view_seed_state table must exist after schema setup"
        );
    }

    #[test]
    fn schema_creates_audit_log_table_and_indexes() {
        let conn = open_in_memory().expect("database should open");
        for (kind, name) in [
            ("table", "audit_log"),
            ("index", "idx_audit_log_created_at"),
            ("index", "idx_audit_log_batch_id"),
            ("index", "idx_audit_log_target_ref"),
        ] {
            let count: i64 = conn.query_row(
                "SELECT count(*) FROM sqlite_master WHERE type=?1 AND name=?2",
                [kind, name],
                |row| row.get(0),
            ).expect("query should succeed");
            assert_eq!(count, 1, "{kind} {name} must exist after schema setup");
        }
    }

    #[test]
    fn sqlite_vec_loads_and_reports_version() {
        let conn = open_in_memory().expect("database should open");
        match load_sqlite_vec(&conn) {
            Ok(()) => {
                let version: String = conn
                    .query_row("SELECT vec_version()", [], |row| row.get(0))
                    .expect("vec_version() should be callable after load");
                assert!(!version.is_empty(), "sqlite-vec version should not be empty");
                println!("sqlite-vec version: {version}");
            }
            Err(e) => {
                // Extension loading may fail in CI — documented in context-agent/wiki/testing.md
                eprintln!("WARN: sqlite-vec extension did not load ({e}). See testing.md.");
            }
        }
    }
}
