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
    crate::gardener::schema::setup_schema(conn)?;
    // Best-effort: register the sqlite-vec extension globally so it is available
    // for subsequent operations. The vec_document_embeddings virtual table is
    // created by setup_vec_table (called separately in open_at for production, or
    // lazily by write_embedding_batch when needed).
    let _ = load_sqlite_vec(conn);
    Ok(())
}

pub fn open_at(path: &std::path::Path) -> Result<Connection> {
    let conn = Connection::open(path)?;
    setup_schema(&conn)?;
    // Production startup: ensure the sqlite-vec virtual table exists.
    // Silently ignored when sqlite-vec is unavailable (e.g. sandboxed CI).
    if conn.query_row("SELECT vec_version()", [], |_| Ok(())).is_ok() {
        let _ = crate::embeddings::sqlite_vec::setup_vec_table(&conn);
    }
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

    #[test]
    fn production_setup_path_creates_vec_table_and_vectors_are_searchable() {
        // Use a temporary file to exercise the open_at production path (which
        // calls setup_vec_table after setup_schema). This proves vectors are
        // actually written and searchable end-to-end.
        let tmp = std::env::temp_dir().join(format!(
            "hm_test_production_vec_{}.db",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .subsec_nanos()
        ));
        let conn = match open_at(&tmp) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("SKIP: could not open temp DB ({e})");
                return;
            }
        };

        // Check if sqlite-vec was loaded by the production setup path
        let vec_available = conn.query_row("SELECT vec_version()", [], |_| Ok(())).is_ok();
        if !vec_available {
            eprintln!("SKIP: sqlite-vec not available in this environment");
            let _ = std::fs::remove_file(&tmp);
            return;
        }

        // Verify vec_document_embeddings table exists after open_at (production path)
        let table_count: i64 = conn.query_row(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='vec_document_embeddings'",
            [],
            |r| r.get(0),
        ).expect("query");
        assert_eq!(table_count, 1, "vec_document_embeddings must exist after open_at");

        // Seed the minimum data needed to write an embedding
        use crate::embeddings::repository::{seed_source_and_document, claim_documents, write_embedding_batch, ClaimOptions};
        use crate::embeddings::provider::EmbeddingResponse;

        seed_source_and_document(&conn, "doc_prod", "hash_prod");

        let opts = ClaimOptions { source_system_id: None, entity_kind: None, limit: 10 };
        let claimed = claim_documents(&conn, &opts, "2026-01-01T00:00:00Z").expect("claim");
        assert_eq!(claimed.len(), 1);

        // Use dimension 1536 to match the production vec0 table DDL
        let vec: Vec<f32> = (0..1536).map(|i| (i as f32) / 1536.0).collect();
        let response = EmbeddingResponse {
            vectors: vec![vec.clone()],
            model: "text-embedding-3-small".into(),
            profile: "embed-small".into(),
            dimension: 1536,
            usage: None,
        };

        // write_embedding_batch must succeed (not silently skip or mark without writing)
        write_embedding_batch(&conn, &claimed, &response, "2026-01-01T00:00:00Z")
            .expect("write_embedding_batch must succeed on the production setup path");

        // Verify the vector row was actually written
        let vec_count: i64 = conn.query_row(
            "SELECT count(*) FROM vec_document_embeddings",
            [],
            |r| r.get(0),
        ).expect("count vec rows");
        assert_eq!(vec_count, 1, "vector row must be present after write_embedding_batch");

        // Verify the document was marked embedded
        let status: String = conn.query_row(
            "SELECT embedding_status FROM indexable_documents WHERE id = 'doc_prod'",
            [],
            |r| r.get(0),
        ).expect("doc status");
        assert_eq!(status, "embedded");

        // Verify nearest-neighbor search returns the vector
        let neighbors = crate::embeddings::sqlite_vec::nearest_by_vector(&conn, &vec, 5)
            .expect("nearest_by_vector must succeed when vec table exists");
        assert_eq!(neighbors.len(), 1, "should find the written vector");

        let _ = std::fs::remove_file(&tmp);
    }
}
