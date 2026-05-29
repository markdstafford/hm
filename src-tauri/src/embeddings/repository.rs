use rusqlite::Connection;

pub fn setup_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS embedding_models (
          id TEXT PRIMARY KEY,
          provider_profile TEXT NOT NULL,
          provider_model TEXT NOT NULL,
          runner TEXT NOT NULL,
          dimension INTEGER NOT NULL,
          distance_metric TEXT NOT NULL,
          created_at TEXT NOT NULL,
          last_used_at TEXT NOT NULL,
          UNIQUE(provider_profile, provider_model, runner, dimension, distance_metric)
        );

        CREATE TABLE IF NOT EXISTS document_embeddings (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL REFERENCES indexable_documents(id) ON DELETE CASCADE,
          source_system_id TEXT NOT NULL REFERENCES source_systems(id) ON DELETE CASCADE,
          entity_kind TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          work_item_id TEXT REFERENCES work_items(id) ON DELETE CASCADE,
          content_hash TEXT NOT NULL,
          model_id TEXT NOT NULL REFERENCES embedding_models(id),
          dimension INTEGER NOT NULL,
          embedded_at TEXT NOT NULL,
          status TEXT NOT NULL,
          error_summary TEXT,
          UNIQUE(document_id, content_hash, model_id)
        );

        CREATE INDEX IF NOT EXISTS idx_doc_embeddings_document_model
          ON document_embeddings(document_id, model_id, status);

        CREATE INDEX IF NOT EXISTS idx_doc_embeddings_source_kind
          ON document_embeddings(source_system_id, entity_kind, status);

        CREATE TABLE IF NOT EXISTS embedding_failures (
          document_id TEXT PRIMARY KEY REFERENCES indexable_documents(id) ON DELETE CASCADE,
          source_system_id TEXT NOT NULL REFERENCES source_systems(id) ON DELETE CASCADE,
          attempt_count INTEGER NOT NULL,
          last_attempted_at TEXT NOT NULL,
          error_category TEXT NOT NULL,
          safe_summary TEXT NOT NULL
        );",
    )
}

pub fn stable_model_id(
    provider_profile: &str,
    provider_model: &str,
    runner: &str,
    dimension: usize,
    distance_metric: &str,
) -> String {
    crate::issues::ids::stable_id(
        "emod",
        &[provider_profile, provider_model, runner, &dimension.to_string(), distance_metric],
    )
}

pub fn upsert_embedding_model(
    conn: &Connection,
    provider_profile: &str,
    provider_model: &str,
    runner: &str,
    dimension: usize,
    distance_metric: &str,
    now_utc: &str,
) -> Result<String, crate::embeddings::errors::EmbeddingError> {
    let id = stable_model_id(provider_profile, provider_model, runner, dimension, distance_metric);
    conn.execute(
        "INSERT INTO embedding_models (id, provider_profile, provider_model, runner, dimension, distance_metric, created_at, last_used_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
         ON CONFLICT(provider_profile, provider_model, runner, dimension, distance_metric) DO UPDATE SET last_used_at = excluded.last_used_at",
        rusqlite::params![id, provider_profile, provider_model, runner, dimension as i64, distance_metric, now_utc],
    )
    .map_err(crate::embeddings::errors::EmbeddingError::from)?;
    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    pub(crate) fn seed_source_and_document(conn: &Connection, document_id: &str, content_hash: &str) {
        conn.execute(
            "INSERT OR IGNORE INTO source_systems (id, kind, display_name, created_at, updated_at) \
             VALUES ('srcsys_1', 'jira', 'Jira', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO work_items (id, source_system_id, source_kind, upstream_id, title, state, last_seen_at, raw_updated_hash, created_at, updated_at) \
             VALUES ('wi_1', 'srcsys_1', 'jira_issue', '1001', 'Login bug', 'open', '2026-01-01T00:00:00Z', 'raw', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO indexable_documents (id, source_system_id, entity_kind, entity_id, work_item_id, title, body, metadata_json, content_hash, embedding_status, created_at, updated_at) \
             VALUES (?1, 'srcsys_1', 'jira_issue', 'wi_1', 'wi_1', 'Login bug', 'Cannot sign in', '{}', ?2, 'pending', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            rusqlite::params![document_id, content_hash],
        ).unwrap();
    }

    #[test]
    fn schema_creates_embedding_tables() {
        let conn = open_in_memory().expect("db");
        setup_schema(&conn).expect("embedding schema setup");
        for table in &["embedding_models", "document_embeddings", "embedding_failures"] {
            let count: i64 = conn.query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?1",
                [table],
                |r| r.get(0),
            ).expect("query");
            assert_eq!(count, 1, "table {table} must exist");
        }
    }

    #[test]
    fn unique_constraint_prevents_duplicate_document_content_model() {
        let conn = open_in_memory().expect("db");
        setup_schema(&conn).expect("embedding schema");
        seed_source_and_document(&conn, "doc_1", "hash_a");
        conn.execute(
            "INSERT INTO embedding_models (id, provider_profile, provider_model, runner, dimension, distance_metric, created_at, last_used_at) \
             VALUES ('model_1', 'embed-small', 'text-embedding-3-small', 'OpenAiEmbeddings', 3, 'cosine', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO document_embeddings (id, document_id, source_system_id, entity_kind, entity_id, work_item_id, content_hash, model_id, dimension, embedded_at, status) \
             VALUES ('emb_1', 'doc_1', 'srcsys_1', 'jira_issue', 'wi_1', 'wi_1', 'hash_a', 'model_1', 3, '2026-01-01T00:00:00Z', 'fresh')",
            [],
        ).unwrap();
        let err = conn.execute(
            "INSERT INTO document_embeddings (id, document_id, source_system_id, entity_kind, entity_id, work_item_id, content_hash, model_id, dimension, embedded_at, status) \
             VALUES ('emb_2', 'doc_1', 'srcsys_1', 'jira_issue', 'wi_1', 'wi_1', 'hash_a', 'model_1', 3, '2026-01-01T00:00:00Z', 'fresh')",
            [],
        ).unwrap_err();
        assert!(err.to_string().to_lowercase().contains("unique") || err.to_string().to_lowercase().contains("constraint"));
    }
}
