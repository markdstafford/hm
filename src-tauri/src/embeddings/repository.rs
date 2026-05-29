use rusqlite::Connection;
use crate::embeddings::errors::{EmbeddingError, EmbeddingErrorCategory};

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

/// Deterministically assemble the text that will be embedded.
pub fn assemble_text(title: Option<&str>, body: &str) -> String {
    match title.map(str::trim).filter(|t| !t.is_empty()) {
        Some(t) => format!("Title: {t}\n\nBody:\n{body}"),
        None => format!("Body:\n{body}"),
    }
}

#[derive(Debug, Clone)]
pub struct ClaimOptions<'a> {
    pub source_system_id: Option<&'a str>,
    pub entity_kind: Option<&'a str>,
    pub limit: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClaimedDocument {
    pub id: String,
    pub source_system_id: String,
    pub entity_kind: String,
    pub entity_id: String,
    pub work_item_id: Option<String>,
    pub title: Option<String>,
    pub body: String,
    pub content_hash: String,
}

/// Reset any documents stuck in 'embedding' state back to 'pending'.
/// Call this on startup before the embedding loop resumes.
pub fn recover_stuck_embedding_claims(conn: &Connection) -> rusqlite::Result<u32> {
    let count = conn.execute(
        "UPDATE indexable_documents SET embedding_status = 'pending' WHERE embedding_status = 'embedding'",
        [],
    )?;
    Ok(count as u32)
}

/// Claim up to `options.limit` documents that need embedding and mark them 'embedding'.
pub fn claim_documents(
    conn: &Connection,
    options: &ClaimOptions<'_>,
    _now_utc: &str,
) -> Result<Vec<ClaimedDocument>, EmbeddingError> {
    let mut sql = String::from(
        "SELECT id, source_system_id, entity_kind, entity_id, work_item_id, title, body, content_hash \
         FROM indexable_documents \
         WHERE embedding_status IN ('pending', 'stale', 'failed')",
    );
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    if let Some(ssid) = options.source_system_id {
        sql.push_str(" AND source_system_id = ?");
        params.push(Box::new(ssid.to_string()));
    }
    if let Some(kind) = options.entity_kind {
        sql.push_str(" AND entity_kind = ?");
        params.push(Box::new(kind.to_string()));
    }
    sql.push_str(" LIMIT ?");
    params.push(Box::new(options.limit as i64));

    let mut stmt = conn.prepare(&sql).map_err(EmbeddingError::from)?;
    let rows = stmt
        .query_map(
            rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
            |row| {
                Ok(ClaimedDocument {
                    id: row.get(0)?,
                    source_system_id: row.get(1)?,
                    entity_kind: row.get(2)?,
                    entity_id: row.get(3)?,
                    work_item_id: row.get(4)?,
                    title: row.get(5)?,
                    body: row.get(6)?,
                    content_hash: row.get(7)?,
                })
            },
        )
        .map_err(EmbeddingError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(EmbeddingError::from)?;

    if rows.is_empty() {
        return Ok(vec![]);
    }

    // Mark all claimed rows as 'embedding' in a single statement
    let placeholders = rows
        .iter()
        .enumerate()
        .map(|(i, _)| format!("?{}", i + 1))
        .collect::<Vec<_>>()
        .join(", ");
    let update_sql = format!(
        "UPDATE indexable_documents SET embedding_status = 'embedding' WHERE id IN ({placeholders})"
    );
    conn.execute(
        &update_sql,
        rusqlite::params_from_iter(rows.iter().map(|r| r.id.as_str())),
    )
    .map_err(EmbeddingError::from)?;

    Ok(rows)
}

/// Record a failure for a document, incrementing the attempt count on conflict.
pub fn record_embedding_failure(
    conn: &Connection,
    document_id: &str,
    source_system_id: &str,
    err: &EmbeddingError,
    now_utc: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE indexable_documents SET embedding_status = 'failed' WHERE id = ?1",
        [document_id],
    )?;
    conn.execute(
        "INSERT INTO embedding_failures (document_id, source_system_id, attempt_count, last_attempted_at, error_category, safe_summary)
         VALUES (?1, ?2, 1, ?3, ?4, ?5)
         ON CONFLICT(document_id) DO UPDATE SET
           attempt_count = attempt_count + 1,
           last_attempted_at = excluded.last_attempted_at,
           error_category = excluded.error_category,
           safe_summary = excluded.safe_summary",
        rusqlite::params![
            document_id,
            source_system_id,
            now_utc,
            format!("{:?}", err.category),
            err.safe_summary,
        ],
    )?;
    Ok(())
}

/// Write a batch of embedding vectors + metadata. Idempotent on (document_id, content_hash, model_id).
pub fn write_embedding_batch(
    conn: &Connection,
    docs: &[ClaimedDocument],
    response: &crate::embeddings::provider::EmbeddingResponse,
    now_utc: &str,
) -> Result<(), EmbeddingError> {
    if docs.len() != response.vectors.len() {
        return Err(EmbeddingError::new(
            EmbeddingErrorCategory::InvalidResponse,
            "Embedding provider returned an invalid response.",
        ));
    }

    for v in &response.vectors {
        if v.len() != response.dimension {
            return Err(EmbeddingError::dimension_mismatch());
        }
    }

    let model_id = upsert_embedding_model(
        conn,
        &response.profile,
        &response.model,
        "OpenAiEmbeddings",
        response.dimension,
        "l2",
        now_utc,
    )?;

    for (doc, vector) in docs.iter().zip(response.vectors.iter()) {
        let emb_id = crate::issues::ids::stable_id(
            "emb",
            &[&doc.id, &doc.content_hash, &model_id],
        );

        // Mark any prior fresh embedding for this document as stale when content or model changed
        conn.execute(
            "UPDATE document_embeddings SET status = 'stale' \
             WHERE document_id = ?1 AND status = 'fresh' AND NOT (content_hash = ?2 AND model_id = ?3)",
            rusqlite::params![doc.id, doc.content_hash, model_id],
        )
        .map_err(EmbeddingError::from)?;

        // Insert the embedding metadata row if it does not exist yet
        conn.execute(
            "INSERT OR IGNORE INTO document_embeddings \
             (id, document_id, source_system_id, entity_kind, entity_id, work_item_id, content_hash, model_id, dimension, embedded_at, status) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'fresh')",
            rusqlite::params![
                emb_id,
                doc.id,
                doc.source_system_id,
                doc.entity_kind,
                doc.entity_id,
                doc.work_item_id,
                doc.content_hash,
                model_id,
                response.dimension as i64,
                now_utc,
            ],
        )
        .map_err(EmbeddingError::from)?;

        // Refresh embedded_at and status in case the row already existed
        conn.execute(
            "UPDATE document_embeddings SET embedded_at = ?1, status = 'fresh' WHERE id = ?2",
            rusqlite::params![now_utc, emb_id],
        )
        .map_err(EmbeddingError::from)?;

        // Retrieve the stable rowid for the vec table
        let rowid: i64 = conn
            .query_row(
                "SELECT rowid FROM document_embeddings WHERE id = ?1",
                [&emb_id],
                |r| r.get(0),
            )
            .map_err(EmbeddingError::from)?;

        let vec_json = crate::embeddings::sqlite_vec::vector_to_json(vector);
        // vec0 virtual tables don't support INSERT OR REPLACE for existing rowids.
        // Delete any existing row first (ignore error — row may not exist yet or
        // table may not exist yet, both handled below).
        let _ = conn.execute(
            "DELETE FROM vec_document_embeddings WHERE rowid = ?1",
            rusqlite::params![rowid],
        );
        match conn.execute(
            "INSERT INTO vec_document_embeddings (rowid, embedding_id, embedding) VALUES (?1, ?2, ?3)",
            rusqlite::params![rowid, emb_id, vec_json],
        ) {
            Ok(_) => {}
            Err(e) if e.to_string().contains("no such table") => {
                // Table missing: attempt to create it using the actual response
                // dimension, then retry once. This handles first-write startup
                // without requiring a separate setup step. If sqlite-vec is
                // unavailable, setup_vec_table_with_dimension returns
                // SqliteVecUnavailable and we propagate it without marking the
                // document embedded.
                crate::embeddings::sqlite_vec::setup_vec_table_with_dimension(
                    conn,
                    response.dimension,
                )?;
                conn.execute(
                    "INSERT INTO vec_document_embeddings (rowid, embedding_id, embedding) VALUES (?1, ?2, ?3)",
                    rusqlite::params![rowid, emb_id, vec_json],
                ).map_err(EmbeddingError::from)?;
            }
            Err(e) => return Err(EmbeddingError::from(e)),
        }

        // Mark the source document as fully embedded
        conn.execute(
            "UPDATE indexable_documents SET embedding_status = 'embedded' WHERE id = ?1",
            [&doc.id],
        )
        .map_err(EmbeddingError::from)?;

        // Remove any stale failure record now that we succeeded
        conn.execute(
            "DELETE FROM embedding_failures WHERE document_id = ?1",
            [&doc.id],
        )
        .map_err(EmbeddingError::from)?;
    }

    Ok(())
}

/// Get fresh embedding vector and metadata for a document.
/// Returns (embedding_id, model_id, dimension, vector) only when embedding is fresh.
pub fn fresh_embedding_for_document(
    conn: &Connection,
    document_id: &str,
) -> Result<Option<(String, String, usize, Vec<f32>)>, EmbeddingError> {
    use rusqlite::OptionalExtension;
    // Check the document exists and has a fresh embedding
    let result: Option<(String, String, i64)> = conn.query_row(
        "SELECT de.id, de.model_id, de.dimension \
         FROM document_embeddings de \
         JOIN indexable_documents id ON id.id = de.document_id \
         WHERE de.document_id = ?1 \
           AND de.status = 'fresh' \
           AND id.embedding_status = 'embedded'
         LIMIT 1",
        [document_id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    ).optional().map_err(EmbeddingError::from)?;

    let (emb_id, model_id, dimension) = match result {
        None => return Err(EmbeddingError::new(
            EmbeddingErrorCategory::MissingFreshEmbedding,
            "Embedding unavailable: no fresh embedding exists for this document.",
        )),
        Some(r) => r,
    };

    // Get the vector from vec_document_embeddings.
    // sqlite-vec stores vectors as packed little-endian f32 bytes (BLOB), not JSON.
    let vec_result: Option<Vec<u8>> = conn.query_row(
        "SELECT embedding FROM vec_document_embeddings WHERE embedding_id = ?1",
        [&emb_id],
        |r| r.get(0),
    ).optional().map_err(EmbeddingError::from)?;

    let Some(vec_bytes) = vec_result else {
        return Err(EmbeddingError::new(
            EmbeddingErrorCategory::MissingFreshEmbedding,
            "Embedding unavailable: vector data not found.",
        ));
    };

    if vec_bytes.len() % 4 != 0 {
        return Err(EmbeddingError::invalid_response());
    }
    let vector: Vec<f32> = vec_bytes
        .chunks_exact(4)
        .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
        .collect();

    Ok(Some((emb_id, model_id, dimension as usize, vector)))
}

pub fn model_dimension(conn: &Connection, model_id: &str) -> Result<usize, EmbeddingError> {
    use rusqlite::OptionalExtension;
    let dim: Option<i64> = conn.query_row(
        "SELECT dimension FROM embedding_models WHERE id = ?1",
        [model_id],
        |r| r.get(0),
    ).optional().map_err(EmbeddingError::from)?;

    dim.map(|d| d as usize).ok_or_else(|| EmbeddingError::new(
        EmbeddingErrorCategory::DimensionMismatch,
        "Embedding dimension changed: Rebuild embeddings for this model before searching.",
    ))
}

/// Return the stored dimension for any embedding model with the same
/// profile+model+runner combination, regardless of dimension. Returns `Ok(dim)`
/// when a match exists, `Err` when no such model is in the DB yet.
///
/// Used to detect dimension mismatches when a query-text provider returns a
/// vector whose dimension differs from what was previously stored for the same
/// logical model family.
pub fn stored_dimension_for_profile(
    conn: &Connection,
    provider_profile: &str,
    provider_model: &str,
    runner: &str,
    distance_metric: &str,
) -> Result<usize, EmbeddingError> {
    use rusqlite::OptionalExtension;
    let dim: Option<i64> = conn.query_row(
        "SELECT dimension FROM embedding_models \
          WHERE provider_profile = ?1 AND provider_model = ?2 AND runner = ?3 AND distance_metric = ?4 \
          LIMIT 1",
        rusqlite::params![provider_profile, provider_model, runner, distance_metric],
        |r| r.get(0),
    ).optional().map_err(EmbeddingError::from)?;

    dim.map(|d| d as usize).ok_or_else(|| EmbeddingError::new(
        EmbeddingErrorCategory::DimensionMismatch,
        "No stored model found for this profile.",
    ))
}

/// Test helper: seed a source system, work item, and indexable document.
/// Available in test builds only, placed outside `mod tests` so other test modules can import it.
#[cfg(test)]
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
    fn claim_documents_marks_embedding_and_does_not_claim_twice() {
        let conn = open_in_memory().expect("db");
        setup_schema(&conn).expect("schema");
        seed_source_and_document(&conn, "doc_1", "hash_a");

        let options = ClaimOptions { source_system_id: None, entity_kind: None, limit: 10 };
        let claimed = claim_documents(&conn, &options, "2026-01-01T00:00:00Z").expect("claim");
        assert_eq!(claimed.len(), 1);
        assert_eq!(claimed[0].id, "doc_1");

        // Second claim should find nothing (already 'embedding')
        let claimed2 = claim_documents(&conn, &options, "2026-01-01T00:00:00Z").expect("claim2");
        assert_eq!(claimed2.len(), 0);

        // Verify status in DB
        let status: String = conn.query_row(
            "SELECT embedding_status FROM indexable_documents WHERE id = 'doc_1'",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(status, "embedding");
    }

    #[test]
    fn record_failure_marks_failed_and_increments_attempt_count() {
        let conn = open_in_memory().expect("db");
        setup_schema(&conn).expect("schema");
        seed_source_and_document(&conn, "doc_1", "hash_a");

        let err = crate::embeddings::errors::EmbeddingError::provider_rejected(
            "Bearer sk-test raw body Cannot sign in".into(),
        );
        record_embedding_failure(&conn, "doc_1", "srcsys_1", &err, "2026-01-01T00:00:00Z")
            .expect("record failure");
        record_embedding_failure(&conn, "doc_1", "srcsys_1", &err, "2026-01-01T00:00:00Z")
            .expect("record failure 2");

        let status: String = conn.query_row(
            "SELECT embedding_status FROM indexable_documents WHERE id = 'doc_1'",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(status, "failed");

        let (attempt_count, safe_summary): (i64, String) = conn.query_row(
            "SELECT attempt_count, safe_summary FROM embedding_failures WHERE document_id = 'doc_1'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).unwrap();
        assert_eq!(attempt_count, 2);
        assert!(!safe_summary.contains("sk-test"), "safe_summary must not contain secret");
        assert!(!safe_summary.contains("Cannot sign in"), "safe_summary must not contain document text");
    }

    #[test]
    fn write_embeddings_is_idempotent_and_marks_document_embedded() {
        let conn = open_in_memory().expect("db");
        setup_schema(&conn).expect("schema");
        crate::db::load_sqlite_vec(&conn).ok(); // load vec if available
        seed_source_and_document(&conn, "doc_1", "hash_a");

        let options = ClaimOptions { source_system_id: None, entity_kind: None, limit: 10 };
        let claimed = claim_documents(&conn, &options, "2026-01-01T00:00:00Z").expect("claim");
        assert_eq!(claimed.len(), 1);

        let response = crate::embeddings::provider::EmbeddingResponse {
            vectors: vec![vec![1.0f32, 0.0, 0.0]],
            model: "text-embedding-3-small".into(),
            profile: "embed-small".into(),
            dimension: 3,
            usage: None,
        };

        // Write once
        write_embedding_batch(&conn, &claimed, &response, "2026-01-01T00:00:00Z")
            .expect("write batch 1");

        // Write again (idempotent)
        write_embedding_batch(&conn, &claimed, &response, "2026-01-01T00:00:00Z")
            .expect("write batch 2");

        // Should have exactly one document_embeddings row
        let count: i64 = conn.query_row(
            "SELECT count(*) FROM document_embeddings WHERE document_id = 'doc_1'",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(count, 1);

        // Document should be 'embedded'
        let status: String = conn.query_row(
            "SELECT embedding_status FROM indexable_documents WHERE id = 'doc_1'",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(status, "embedded");
    }

    #[test]
    fn assemble_text_is_deterministic() {
        assert_eq!(
            assemble_text(Some("Login bug"), "Cannot sign in"),
            "Title: Login bug\n\nBody:\nCannot sign in"
        );
        assert_eq!(
            assemble_text(None, "Cannot sign in"),
            "Body:\nCannot sign in"
        );
        // Empty title treated as None
        assert_eq!(
            assemble_text(Some(""), "Cannot sign in"),
            "Body:\nCannot sign in"
        );
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
