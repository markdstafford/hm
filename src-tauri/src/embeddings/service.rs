use serde::{Deserialize, Serialize};
use specta::Type;
use crate::embeddings::errors::{EmbeddingError, EmbeddingErrorCategory};
use crate::embeddings::provider::{EmbeddingProvider, EmbeddingRequest};
use crate::embeddings::repository::{
    assemble_text, claim_documents, recover_stuck_embedding_claims,
    record_embedding_failure, write_embedding_batch, ClaimOptions,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct EmbeddingRunOptions {
    pub source_system_id: Option<String>,
    pub entity_kind: Option<String>,
    pub limit: Option<u32>,
    pub force_rebuild: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub enum EmbeddingRunStatus {
    Complete,
    Running,
    Paused,
    Failed,
    Partial,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct EmbeddingRunSummary {
    pub status: EmbeddingRunStatus,
    pub scanned: u32,
    pub embedded: u32,
    pub skipped: u32,
    pub failed: u32,
    pub model_id: String,
    /// Embedding vector dimension. Stored as `u32` rather than `usize` so
    /// specta can emit a TypeScript-safe numeric type without BigInt risk.
    pub dimension: u32,
    pub safe_error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct EmbeddingStatusSummary {
    pub pending: u32,
    pub embedding: u32,
    pub embedded: u32,
    pub stale: u32,
    pub failed: u32,
    pub last_embedding_refresh: Option<String>,
    pub warning: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct EmbeddingCandidateQuery {
    pub document_id: Option<String>,
    pub query_text: Option<String>,
    pub source_system_id: Option<String>,
    pub entity_kinds: Vec<String>,
    pub work_item_kind: Option<String>,
    pub limit: u32,
    pub exclude_entity_id: Option<String>,
    pub include_self: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct EmbeddingCandidate {
    pub document_id: String,
    pub entity_kind: String,
    pub entity_id: String,
    pub work_item_id: Option<String>,
    pub source_system_id: String,
    pub content_hash: String,
    pub model_id: String,
    pub distance: f32,
}

pub fn nearest_neighbors(
    conn: &rusqlite::Connection,
    provider: &dyn EmbeddingProvider,
    query: EmbeddingCandidateQuery,
) -> Result<Vec<EmbeddingCandidate>, EmbeddingError> {
    // Validate: exactly one of document_id or query_text
    match (&query.document_id, &query.query_text) {
        (None, None) | (Some(_), Some(_)) => {
            return Err(EmbeddingError::new(
                EmbeddingErrorCategory::InvalidQuery,
                "Exactly one of document_id or query_text must be provided.",
            ));
        }
        _ => {}
    }

    let (vector, model_id) = if let Some(doc_id) = &query.document_id {
        // fresh_embedding_for_document returns Err when unavailable
        let (_emb_id, model_id, _dimension, vector) =
            crate::embeddings::repository::fresh_embedding_for_document(conn, doc_id)?
                .unwrap_or_else(|| unreachable!("fresh_embedding_for_document returns Err, not Ok(None)"));
        (vector, model_id)
    } else {
        // query_text path — embed on the fly
        let text = query.query_text.as_deref().unwrap_or("");
        let request = EmbeddingRequest { input: vec![text.to_string()] };
        let mut response = provider.embed(request)?;
        let model_id = crate::embeddings::repository::stable_model_id(
            &response.profile,
            &response.model,
            "OpenAiEmbeddings",
            response.dimension,
            "l2",
        );
        let vector = response.vectors.drain(..).next().ok_or_else(EmbeddingError::invalid_response)?;
        // Check if this profile+model+runner combination has stored embeddings
        // with a different dimension. `stable_model_id` encodes dimension in the
        // id, so we look up by profile/model/runner instead of by model_id.
        if let Ok(stored_dim) = crate::embeddings::repository::stored_dimension_for_profile(
            conn,
            &response.profile,
            &response.model,
            "OpenAiEmbeddings",
            "l2",
        ) {
            if stored_dim != response.dimension {
                return Err(EmbeddingError::dimension_mismatch());
            }
        }
        (vector, model_id)
    };

    // Get KNN candidates from sqlite-vec; over-fetch to allow for filtering/self-exclusion
    let fetch_limit = if query.include_self { query.limit as usize } else { query.limit as usize + 1 };
    let raw_matches = crate::embeddings::sqlite_vec::nearest_by_vector(conn, &vector, fetch_limit)?;

    if raw_matches.is_empty() {
        return Ok(vec![]);
    }

    // Resolve rowids back to document metadata
    let rowids: Vec<i64> = raw_matches.iter().map(|(r, _)| *r).collect();
    let distance_map: std::collections::HashMap<i64, f32> = raw_matches.into_iter().collect();

    // Build parameterized query. Params vector is populated in lock-step with
    // the placeholders added to `sql` below.
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = rowids
        .iter()
        .map(|r| Box::new(*r) as Box<dyn rusqlite::ToSql>)
        .collect();

    let rowid_placeholders = rowids
        .iter()
        .enumerate()
        .map(|(i, _)| format!("?{}", i + 1))
        .collect::<Vec<_>>()
        .join(", ");
    let model_param_idx = rowids.len() + 1;
    params.push(Box::new(model_id));

    // LEFT JOIN work_items to support work_item_kind filter
    let mut sql = format!(
        "SELECT de.rowid, de.document_id, de.entity_kind, de.entity_id, de.work_item_id, \
                de.source_system_id, de.content_hash, de.model_id \
         FROM document_embeddings de \
         LEFT JOIN work_items wi ON wi.id = de.work_item_id \
         WHERE de.rowid IN ({rowid_placeholders}) \
           AND de.status = 'fresh' \
           AND de.model_id = ?{model_param_idx}"
    );

    if let Some(ssid) = &query.source_system_id {
        let idx = params.len() + 1;
        sql.push_str(&format!(" AND de.source_system_id = ?{idx}"));
        params.push(Box::new(ssid.clone()));
    }
    if !query.entity_kinds.is_empty() {
        let start = params.len() + 1;
        let kind_placeholders: Vec<String> = (start..start + query.entity_kinds.len())
            .map(|i| format!("?{i}"))
            .collect();
        sql.push_str(&format!(" AND de.entity_kind IN ({})", kind_placeholders.join(", ")));
        for k in &query.entity_kinds {
            params.push(Box::new(k.clone()));
        }
    }
    if let Some(wk) = &query.work_item_kind {
        let idx = params.len() + 1;
        sql.push_str(&format!(" AND wi.item_type = ?{idx}"));
        params.push(Box::new(wk.clone()));
    }
    if let Some(eid) = &query.exclude_entity_id {
        let idx = params.len() + 1;
        sql.push_str(&format!(" AND de.entity_id != ?{idx}"));
        params.push(Box::new(eid.clone()));
    }
    if !query.include_self {
        if let Some(doc_id) = &query.document_id {
            let idx = params.len() + 1;
            sql.push_str(&format!(" AND de.document_id != ?{idx}"));
            params.push(Box::new(doc_id.clone()));
        }
    }

    let mut stmt = conn.prepare(&sql).map_err(EmbeddingError::from)?;
    let rows = stmt
        .query_map(
            rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
            |row| {
                let rowid: i64 = row.get(0)?;
                Ok((rowid, EmbeddingCandidate {
                    document_id: row.get(1)?,
                    entity_kind: row.get(2)?,
                    entity_id: row.get(3)?,
                    work_item_id: row.get(4)?,
                    source_system_id: row.get(5)?,
                    content_hash: row.get(6)?,
                    model_id: row.get(7)?,
                    distance: 0.0, // filled below
                }))
            },
        )
        .map_err(EmbeddingError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(EmbeddingError::from)?;

    let mut candidates: Vec<EmbeddingCandidate> = rows
        .into_iter()
        .map(|(rowid, mut c)| {
            c.distance = distance_map.get(&rowid).copied().unwrap_or(f32::MAX);
            c
        })
        .collect();

    candidates.sort_by(|a, b| a.distance.partial_cmp(&b.distance).unwrap_or(std::cmp::Ordering::Equal));
    candidates.truncate(query.limit as usize);

    Ok(candidates)
}

pub fn refresh_embeddings_with_provider(
    conn: &rusqlite::Connection,
    provider: &dyn EmbeddingProvider,
    options: EmbeddingRunOptions,
    now_utc: &str,
) -> Result<EmbeddingRunSummary, EmbeddingError> {
    // Recover any stuck claims from a previous interrupted run
    recover_stuck_embedding_claims(conn).map_err(EmbeddingError::from)?;

    // If force_rebuild, set all 'embedded' docs matching filters back to 'pending'
    if options.force_rebuild {
        let mut sql = String::from(
            "UPDATE indexable_documents SET embedding_status = 'pending' WHERE embedding_status = 'embedded'",
        );
        let mut rebuild_params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        if let Some(ref ssid) = options.source_system_id {
            sql.push_str(" AND source_system_id = ?");
            rebuild_params.push(Box::new(ssid.clone()));
        }
        if let Some(ref kind) = options.entity_kind {
            sql.push_str(" AND entity_kind = ?");
            rebuild_params.push(Box::new(kind.clone()));
        }
        conn.execute(&sql, rusqlite::params_from_iter(rebuild_params.iter().map(|p| p.as_ref())))
            .map_err(EmbeddingError::from)?;
    }

    let limit = options.limit.unwrap_or(25).max(1) as usize;
    let claim_opts = ClaimOptions {
        source_system_id: options.source_system_id.as_deref(),
        entity_kind: options.entity_kind.as_deref(),
        limit,
    };

    let claimed = claim_documents(conn, &claim_opts, now_utc)?;
    let scanned = claimed.len() as u32;

    if claimed.is_empty() {
        return Ok(EmbeddingRunSummary {
            status: EmbeddingRunStatus::Complete,
            scanned: 0,
            embedded: 0,
            skipped: 0,
            failed: 0,
            model_id: String::new(),
            dimension: 0,
            safe_error: None,
        });
    }

    // Assemble text for each claimed document
    let texts: Vec<String> = claimed
        .iter()
        .map(|doc| assemble_text(doc.title.as_deref(), &doc.body))
        .collect();

    let request = EmbeddingRequest { input: texts };

    // Call provider (DB lock is NOT held here)
    let response = match provider.embed(request) {
        Ok(r) => r,
        Err(e) => {
            for doc in &claimed {
                let _ = record_embedding_failure(conn, &doc.id, &doc.source_system_id, &e, now_utc);
            }
            return Ok(EmbeddingRunSummary {
                status: EmbeddingRunStatus::Paused,
                scanned,
                embedded: 0,
                skipped: 0,
                failed: scanned,
                model_id: String::new(),
                dimension: 0,
                safe_error: Some(e.to_string()),
            });
        }
    };

    let model_id = crate::embeddings::repository::stable_model_id(
        &response.profile,
        &response.model,
        "OpenAiEmbeddings",
        response.dimension,
        "l2",
    );
    let dimension = response.dimension as u32;

    // Write vectors and update status
    match write_embedding_batch(conn, &claimed, &response, now_utc) {
        Ok(()) => {}
        Err(e) => {
            for doc in &claimed {
                let _ = record_embedding_failure(conn, &doc.id, &doc.source_system_id, &e, now_utc);
            }
            return Ok(EmbeddingRunSummary {
                status: EmbeddingRunStatus::Paused,
                scanned,
                embedded: 0,
                skipped: 0,
                failed: scanned,
                model_id,
                dimension,
                safe_error: Some(e.to_string()),
            });
        }
    }

    Ok(EmbeddingRunSummary {
        status: EmbeddingRunStatus::Complete,
        scanned,
        embedded: scanned,
        skipped: 0,
        failed: 0,
        model_id,
        dimension,
        safe_error: None,
    })
}

pub fn refresh_embeddings(
    conn: &rusqlite::Connection,
    store: &dyn crate::settings::secrets::SecretStore,
    options: EmbeddingRunOptions,
    now_utc: &str,
) -> Result<EmbeddingRunSummary, EmbeddingError> {
    let provider = crate::embeddings::provider::AiEmbeddingProvider::default();

    recover_stuck_embedding_claims(conn).map_err(EmbeddingError::from)?;

    if options.force_rebuild {
        let mut sql = String::from(
            "UPDATE indexable_documents SET embedding_status = 'pending' WHERE embedding_status = 'embedded'",
        );
        let mut rebuild_params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        if let Some(ref ssid) = options.source_system_id {
            sql.push_str(" AND source_system_id = ?");
            rebuild_params.push(Box::new(ssid.clone()));
        }
        if let Some(ref kind) = options.entity_kind {
            sql.push_str(" AND entity_kind = ?");
            rebuild_params.push(Box::new(kind.clone()));
        }
        conn.execute(&sql, rusqlite::params_from_iter(rebuild_params.iter().map(|p| p.as_ref())))
            .map_err(EmbeddingError::from)?;
    }

    let limit = options.limit.unwrap_or(25).max(1) as usize;
    let claim_opts = ClaimOptions {
        source_system_id: options.source_system_id.as_deref(),
        entity_kind: options.entity_kind.as_deref(),
        limit,
    };

    let claimed = claim_documents(conn, &claim_opts, now_utc)?;
    let scanned = claimed.len() as u32;

    if claimed.is_empty() {
        return Ok(EmbeddingRunSummary {
            status: EmbeddingRunStatus::Complete,
            scanned: 0,
            embedded: 0,
            skipped: 0,
            failed: 0,
            model_id: String::new(),
            dimension: 0,
            safe_error: None,
        });
    }

    let texts: Vec<String> = claimed
        .iter()
        .map(|doc| assemble_text(doc.title.as_deref(), &doc.body))
        .collect();
    let request = EmbeddingRequest { input: texts };

    let response = match provider.embed_for_default_route(conn, store, request) {
        Ok(r) => r,
        Err(e) => {
            for doc in &claimed {
                let _ = record_embedding_failure(conn, &doc.id, &doc.source_system_id, &e, now_utc);
            }
            return Ok(EmbeddingRunSummary {
                status: EmbeddingRunStatus::Paused,
                scanned,
                embedded: 0,
                skipped: 0,
                failed: scanned,
                model_id: String::new(),
                dimension: 0,
                safe_error: Some(e.to_string()),
            });
        }
    };

    let model_id = crate::embeddings::repository::stable_model_id(
        &response.profile,
        &response.model,
        "OpenAiEmbeddings",
        response.dimension,
        "l2",
    );
    let dimension = response.dimension as u32;

    match write_embedding_batch(conn, &claimed, &response, now_utc) {
        Ok(()) => {}
        Err(e) => {
            for doc in &claimed {
                let _ = record_embedding_failure(conn, &doc.id, &doc.source_system_id, &e, now_utc);
            }
            return Ok(EmbeddingRunSummary {
                status: EmbeddingRunStatus::Paused,
                scanned,
                embedded: 0,
                skipped: 0,
                failed: scanned,
                model_id,
                dimension,
                safe_error: Some(e.to_string()),
            });
        }
    }

    Ok(EmbeddingRunSummary {
        status: EmbeddingRunStatus::Complete,
        scanned,
        embedded: scanned,
        skipped: 0,
        failed: 0,
        model_id,
        dimension,
        safe_error: None,
    })
}

pub fn embedding_status(
    conn: &rusqlite::Connection,
    source_system_id: Option<&str>,
) -> Result<EmbeddingStatusSummary, EmbeddingError> {
    let mut pending = 0u32;
    let mut embedding = 0u32;
    let mut embedded = 0u32;
    let mut stale = 0u32;
    let mut failed = 0u32;

    if let Some(ssid) = source_system_id {
        let mut stmt = conn.prepare(
            "SELECT embedding_status, count(*) FROM indexable_documents \
             WHERE source_system_id = ? GROUP BY embedding_status",
        ).map_err(EmbeddingError::from)?;
        let rows = stmt.query_map([ssid], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))
            .map_err(EmbeddingError::from)?;
        for row in rows {
            let (status, count) = row.map_err(EmbeddingError::from)?;
            let c = count as u32;
            match status.as_str() {
                "pending" => pending = c,
                "embedding" => embedding = c,
                "embedded" => embedded = c,
                "stale" => stale = c,
                "failed" => failed = c,
                _ => {}
            }
        }
    } else {
        let mut stmt = conn.prepare(
            "SELECT embedding_status, count(*) FROM indexable_documents GROUP BY embedding_status",
        ).map_err(EmbeddingError::from)?;
        let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))
            .map_err(EmbeddingError::from)?;
        for row in rows {
            let (status, count) = row.map_err(EmbeddingError::from)?;
            let c = count as u32;
            match status.as_str() {
                "pending" => pending = c,
                "embedding" => embedding = c,
                "embedded" => embedded = c,
                "stale" => stale = c,
                "failed" => failed = c,
                _ => {}
            }
        }
    }

    let last_embedding_refresh: Option<String> = if let Some(ssid) = source_system_id {
        conn.query_row(
            "SELECT MAX(embedded_at) FROM document_embeddings WHERE source_system_id = ?",
            [ssid],
            |r| r.get(0),
        ).unwrap_or(None)
    } else {
        conn.query_row(
            "SELECT MAX(embedded_at) FROM document_embeddings",
            [],
            |r| r.get(0),
        ).unwrap_or(None)
    };

    let warning: Option<String> = if let Some(ssid) = source_system_id {
        conn.query_row(
            "SELECT safe_summary FROM embedding_failures \
             WHERE source_system_id = ? ORDER BY last_attempted_at DESC LIMIT 1",
            [ssid],
            |r| r.get(0),
        ).unwrap_or(None)
    } else {
        conn.query_row(
            "SELECT safe_summary FROM embedding_failures ORDER BY last_attempted_at DESC LIMIT 1",
            [],
            |r| r.get(0),
        ).unwrap_or(None)
    };

    Ok(EmbeddingStatusSummary {
        pending,
        embedding,
        embedded,
        stale,
        failed,
        last_embedding_refresh,
        warning,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::embeddings::errors::EmbeddingError;
    use crate::embeddings::provider::{EmbeddingProvider, EmbeddingRequest, EmbeddingResponse, FakeEmbeddingProvider};
    use crate::embeddings::repository::{setup_schema, seed_source_and_document};

    fn open_with_embedding_schema() -> rusqlite::Connection {
        let conn = open_in_memory().expect("db");
        setup_schema(&conn).expect("embedding schema");
        conn
    }

    #[test]
    fn refresh_embeddings_embeds_pending_documents_and_reports_summary() {
        let conn = open_with_embedding_schema();
        seed_source_and_document(&conn, "doc_1", "hash_a");

        let provider = FakeEmbeddingProvider::new(3, "embed-small", "text-embedding-3-small");
        let options = EmbeddingRunOptions {
            source_system_id: None,
            entity_kind: None,
            limit: Some(10),
            force_rebuild: false,
        };

        let summary = refresh_embeddings_with_provider(
            &conn, &provider, options, "2026-01-01T00:00:00Z",
        ).expect("refresh");

        assert_eq!(summary.embedded, 1);
        assert_eq!(summary.failed, 0);
        assert_eq!(summary.scanned, 1);
        assert_eq!(summary.dimension, 3);
        assert!(matches!(summary.status, EmbeddingRunStatus::Complete));
        assert!(summary.safe_error.is_none());

        // Verify DB state
        let status: String = conn.query_row(
            "SELECT embedding_status FROM indexable_documents WHERE id = 'doc_1'",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(status, "embedded");
    }

    #[test]
    fn refresh_partial_failure_records_failed_documents() {
        let conn = open_with_embedding_schema();
        seed_source_and_document(&conn, "doc_1", "hash_a");

        struct FailingProvider;
        impl EmbeddingProvider for FailingProvider {
            fn embed(&self, _req: EmbeddingRequest) -> Result<EmbeddingResponse, EmbeddingError> {
                Err(EmbeddingError::provider_rejected(
                    "Bearer sk-test raw body Cannot sign in".into(),
                ))
            }
        }

        let options = EmbeddingRunOptions {
            source_system_id: None,
            entity_kind: None,
            limit: Some(10),
            force_rebuild: false,
        };

        let summary = refresh_embeddings_with_provider(
            &conn, &FailingProvider, options, "2026-01-01T00:00:00Z",
        ).expect("refresh");

        assert_eq!(summary.embedded, 0);
        assert_eq!(summary.failed, 1);
        assert!(matches!(summary.status, EmbeddingRunStatus::Paused));

        let safe_error = summary.safe_error.expect("should have safe error");
        assert!(safe_error.contains("Embedding provider"), "error should be safe");
        assert!(!safe_error.contains("sk-test"), "must not contain secret");
        assert!(!safe_error.contains("Cannot sign in"), "must not contain document text");
    }

    #[test]
    fn refresh_respects_source_and_entity_kind_filters() {
        let conn = open_with_embedding_schema();
        seed_source_and_document(&conn, "doc_1", "hash_a"); // srcsys_1, jira_issue
        // Insert a second doc with different entity_kind
        conn.execute(
            "INSERT INTO indexable_documents (id, source_system_id, entity_kind, entity_id, work_item_id, title, body, metadata_json, content_hash, embedding_status, created_at, updated_at) \
             VALUES ('doc_2', 'srcsys_1', 'other_kind', 'wi_1', 'wi_1', 'Other', 'Other body', '{}', 'hash_b', 'pending', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            [],
        ).unwrap();

        let provider = FakeEmbeddingProvider::new(3, "embed-small", "text-embedding-3-small");
        let options = EmbeddingRunOptions {
            source_system_id: None,
            entity_kind: Some("jira_issue".into()),
            limit: Some(10),
            force_rebuild: false,
        };

        let summary = refresh_embeddings_with_provider(
            &conn, &provider, options, "2026-01-01T00:00:00Z",
        ).expect("refresh");

        assert_eq!(summary.embedded, 1);

        // doc_2 should still be pending
        let status: String = conn.query_row(
            "SELECT embedding_status FROM indexable_documents WHERE id = 'doc_2'",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(status, "pending");
    }

    #[test]
    fn nearest_neighbors_by_document_returns_sorted_candidates() {
        let conn = open_with_embedding_schema();
        let vec_available = crate::db::load_sqlite_vec(&conn).is_ok();
        if !vec_available {
            eprintln!("SKIP: sqlite-vec not available");
            return;
        }
        crate::embeddings::sqlite_vec::setup_vec_table(&conn).expect("vec table");

        // Seed srcsys + work item first
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

        // Insert 3 distinct documents
        for (doc_id, hash) in [("doc_a", "hash_a"), ("doc_b", "hash_b"), ("doc_c", "hash_c")] {
            conn.execute(
                "INSERT OR IGNORE INTO indexable_documents (id, source_system_id, entity_kind, entity_id, work_item_id, title, body, metadata_json, content_hash, embedding_status, created_at, updated_at) \
                 VALUES (?1, 'srcsys_1', 'jira_issue', 'wi_1', 'wi_1', ?1, ?1, '{}', ?2, 'pending', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
                rusqlite::params![doc_id, hash],
            ).unwrap();
        }

        // Embed all 3 using fake provider — dimension must match the vec0 table DDL (1536)
        let provider = FakeEmbeddingProvider::new(1536, "embed-small", "text-embedding-3-small");
        let options = EmbeddingRunOptions {
            source_system_id: None,
            entity_kind: None,
            limit: Some(10),
            force_rebuild: false,
        };
        refresh_embeddings_with_provider(&conn, &provider, options, "2026-01-01T00:00:00Z")
            .expect("embed all");

        // Search nearest neighbors for doc_a
        let query = EmbeddingCandidateQuery {
            document_id: Some("doc_a".into()),
            query_text: None,
            source_system_id: None,
            entity_kinds: vec![],
            work_item_kind: None,
            limit: 2,
            exclude_entity_id: None,
            include_self: false,
        };

        let candidates = nearest_neighbors(&conn, &provider, query).expect("neighbors");
        // Should not include doc_a itself
        assert!(
            !candidates.iter().any(|c| c.document_id == "doc_a"),
            "self should be excluded"
        );
        assert!(!candidates.is_empty(), "should return candidates");
        // Distances should be non-negative
        for c in &candidates {
            assert!(c.distance >= 0.0, "distance should be non-negative: {}", c.distance);
        }
    }

    #[test]
    fn nearest_neighbors_missing_fresh_embedding_returns_error() {
        let conn = open_with_embedding_schema();
        seed_source_and_document(&conn, "doc_1", "hash_a");
        // Do NOT embed it

        let provider = FakeEmbeddingProvider::new(3, "embed-small", "text-embedding-3-small");
        let query = EmbeddingCandidateQuery {
            document_id: Some("doc_1".into()),
            query_text: None,
            source_system_id: None,
            entity_kinds: vec![],
            work_item_kind: None,
            limit: 5,
            exclude_entity_id: None,
            include_self: false,
        };

        let err = nearest_neighbors(&conn, &provider, query).unwrap_err();
        assert!(
            err.to_string().contains("Embedding unavailable") || err.to_string().contains("embedding"),
            "error should mention embedding: {err}"
        );
    }

    #[test]
    fn nearest_neighbors_rejects_neither_query_input() {
        let conn = open_with_embedding_schema();
        let provider = FakeEmbeddingProvider::new(3, "embed-small", "text-embedding-3-small");
        let query = EmbeddingCandidateQuery {
            document_id: None,
            query_text: None,
            source_system_id: None,
            entity_kinds: vec![],
            work_item_kind: None,
            limit: 5,
            exclude_entity_id: None,
            include_self: false,
        };
        let err = nearest_neighbors(&conn, &provider, query).unwrap_err();
        assert!(
            err.to_string().to_lowercase().contains("exactly one") || err.to_string().contains("InvalidQuery"),
            "should mention query requirement: {err}"
        );
    }

    #[test]
    fn nearest_neighbors_rejects_both_query_inputs() {
        let conn = open_with_embedding_schema();
        let provider = FakeEmbeddingProvider::new(3, "embed-small", "text-embedding-3-small");
        let query = EmbeddingCandidateQuery {
            document_id: Some("doc_1".into()),
            query_text: Some("some text".into()),
            source_system_id: None,
            entity_kinds: vec![],
            work_item_kind: None,
            limit: 5,
            exclude_entity_id: None,
            include_self: false,
        };
        let err = nearest_neighbors(&conn, &provider, query).unwrap_err();
        assert!(
            err.to_string().to_lowercase().contains("exactly one") || err.to_string().contains("InvalidQuery"),
            "should mention query requirement: {err}"
        );
    }

    #[test]
    fn nearest_neighbors_query_text_generates_vector_without_storing_query() {
        let conn = open_with_embedding_schema();
        seed_source_and_document(&conn, "doc_1", "hash_a");

        // First embed doc_1 so there are neighbors to find
        let provider = FakeEmbeddingProvider::new(3, "embed-small", "text-embedding-3-small");
        let embed_opts = EmbeddingRunOptions {
            source_system_id: None, entity_kind: None, limit: Some(10), force_rebuild: false,
        };
        refresh_embeddings_with_provider(&conn, &provider, embed_opts, "2026-01-01T00:00:00Z")
            .expect("embed");

        // Count documents/embeddings before query
        let doc_count_before: i64 = conn.query_row(
            "SELECT count(*) FROM indexable_documents", [], |r| r.get(0)
        ).unwrap();
        let emb_count_before: i64 = conn.query_row(
            "SELECT count(*) FROM document_embeddings", [], |r| r.get(0)
        ).unwrap();

        // Query by text
        let query = EmbeddingCandidateQuery {
            document_id: None,
            query_text: Some("login issue".into()),
            source_system_id: None,
            entity_kinds: vec![],
            work_item_kind: None,
            limit: 5,
            exclude_entity_id: None,
            include_self: true,
        };
        let _candidates = nearest_neighbors(&conn, &provider, query).expect("query text search");

        // Counts unchanged — query text was not stored
        let doc_count_after: i64 = conn.query_row(
            "SELECT count(*) FROM indexable_documents", [], |r| r.get(0)
        ).unwrap();
        let emb_count_after: i64 = conn.query_row(
            "SELECT count(*) FROM document_embeddings", [], |r| r.get(0)
        ).unwrap();
        assert_eq!(doc_count_before, doc_count_after);
        assert_eq!(emb_count_before, emb_count_after);
    }

    #[test]
    fn query_text_dimension_mismatch_fails_safely() {
        let conn = open_with_embedding_schema();
        seed_source_and_document(&conn, "doc_1", "hash_a");

        // Embed with dimension 3
        let provider3 = FakeEmbeddingProvider::new(3, "embed-small", "text-embedding-3-small");
        let embed_opts = EmbeddingRunOptions {
            source_system_id: None, entity_kind: None, limit: Some(10), force_rebuild: false,
        };
        refresh_embeddings_with_provider(&conn, &provider3, embed_opts, "2026-01-01T00:00:00Z")
            .expect("embed");

        // Now query with dimension 4 (mismatch) — same profile/model name but different dimension
        let provider4 = FakeEmbeddingProvider::new(4, "embed-small", "text-embedding-3-small");
        let query = EmbeddingCandidateQuery {
            document_id: None,
            query_text: Some("login issue".into()),
            source_system_id: None,
            entity_kinds: vec![],
            work_item_kind: None,
            limit: 5,
            exclude_entity_id: None,
            include_self: true,
        };
        let err = nearest_neighbors(&conn, &provider4, query).unwrap_err();
        assert!(
            err.to_string().contains("dimension"),
            "error should mention dimension: {err}"
        );
    }

    #[test]
    fn force_rebuild_marks_embedded_documents_pending_before_claim() {
        let conn = open_with_embedding_schema();
        seed_source_and_document(&conn, "doc_1", "hash_a");

        let provider = FakeEmbeddingProvider::new(3, "embed-small", "text-embedding-3-small");

        // First embed it
        let opts = EmbeddingRunOptions {
            source_system_id: None,
            entity_kind: None,
            limit: Some(10),
            force_rebuild: false,
        };
        refresh_embeddings_with_provider(&conn, &provider, opts, "2026-01-01T00:00:00Z")
            .expect("first refresh");

        // Verify embedded
        let status: String = conn.query_row(
            "SELECT embedding_status FROM indexable_documents WHERE id = 'doc_1'",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(status, "embedded");

        // Force rebuild
        let opts2 = EmbeddingRunOptions {
            source_system_id: None,
            entity_kind: None,
            limit: Some(10),
            force_rebuild: true,
        };
        let summary = refresh_embeddings_with_provider(&conn, &provider, opts2, "2026-01-01T00:00:00Z")
            .expect("force refresh");

        assert_eq!(summary.embedded, 1);
        assert!(matches!(summary.status, EmbeddingRunStatus::Complete));
    }

    #[test]
    fn source_system_id_with_quotes_does_not_break_force_rebuild() {
        // Regression: source_system_id containing a quote must not corrupt SQL
        let conn = open_with_embedding_schema();
        seed_source_and_document(&conn, "doc_1", "hash_a");

        let provider = FakeEmbeddingProvider::new(3, "embed-small", "text-embedding-3-small");
        let opts = EmbeddingRunOptions {
            source_system_id: Some("srcsys'injection".into()),
            entity_kind: None,
            limit: Some(10),
            force_rebuild: true,
        };
        // Must not panic or return a SQL error — it simply matches zero rows because
        // no source has this synthetic id.
        let summary = refresh_embeddings_with_provider(&conn, &provider, opts, "2026-01-01T00:00:00Z")
            .expect("force_rebuild with quote in source_system_id must not error");
        assert_eq!(summary.embedded, 0); // no matching documents for the injected id
    }

    #[test]
    fn entity_kind_with_quotes_does_not_break_force_rebuild() {
        let conn = open_with_embedding_schema();
        seed_source_and_document(&conn, "doc_1", "hash_a");

        let provider = FakeEmbeddingProvider::new(3, "embed-small", "text-embedding-3-small");
        let opts = EmbeddingRunOptions {
            source_system_id: None,
            entity_kind: Some("jira_issue' OR '1'='1".into()),
            limit: Some(10),
            force_rebuild: true,
        };
        let summary = refresh_embeddings_with_provider(&conn, &provider, opts, "2026-01-01T00:00:00Z")
            .expect("force_rebuild with quote in entity_kind must not error");
        assert_eq!(summary.embedded, 0);
    }

    #[test]
    fn nearest_neighbors_filters_by_work_item_kind() {
        let conn = open_with_embedding_schema();

        let vec_available = crate::db::load_sqlite_vec(&conn).is_ok();
        if !vec_available {
            eprintln!("SKIP: sqlite-vec not available");
            return;
        }
        crate::embeddings::sqlite_vec::setup_vec_table(&conn).expect("vec table");

        // Seed source + two work items with different item_types
        conn.execute(
            "INSERT OR IGNORE INTO source_systems (id, kind, display_name, created_at, updated_at) \
             VALUES ('srcsys_1', 'jira', 'Jira', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO work_items (id, source_system_id, source_kind, upstream_id, title, state, item_type, last_seen_at, raw_updated_hash, created_at, updated_at) \
             VALUES ('wi_bug', 'srcsys_1', 'jira_issue', '1001', 'Bug report', 'open', 'Bug', '2026-01-01T00:00:00Z', 'raw', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO work_items (id, source_system_id, source_kind, upstream_id, title, state, item_type, last_seen_at, raw_updated_hash, created_at, updated_at) \
             VALUES ('wi_task', 'srcsys_1', 'jira_issue', '1002', 'Task item', 'open', 'Task', '2026-01-01T00:00:00Z', 'raw', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            [],
        ).unwrap();

        // Insert one doc per work item
        conn.execute(
            "INSERT INTO indexable_documents (id, source_system_id, entity_kind, entity_id, work_item_id, title, body, metadata_json, content_hash, embedding_status, created_at, updated_at) \
             VALUES ('doc_bug', 'srcsys_1', 'jira_issue', 'wi_bug', 'wi_bug', 'Bug', 'bug body', '{}', 'hash_bug', 'pending', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO indexable_documents (id, source_system_id, entity_kind, entity_id, work_item_id, title, body, metadata_json, content_hash, embedding_status, created_at, updated_at) \
             VALUES ('doc_task', 'srcsys_1', 'jira_issue', 'wi_task', 'wi_task', 'Task', 'task body', '{}', 'hash_task', 'pending', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            [],
        ).unwrap();

        // Embed both docs using dimension 1536 to match the vec0 table DDL
        let provider = FakeEmbeddingProvider::new(1536, "embed-small", "text-embedding-3-small");
        let opts = EmbeddingRunOptions {
            source_system_id: None, entity_kind: None, limit: Some(10), force_rebuild: false,
        };
        refresh_embeddings_with_provider(&conn, &provider, opts, "2026-01-01T00:00:00Z")
            .expect("embed both");

        // Search by text (no stored doc), filtered to Bug kind only
        let query = EmbeddingCandidateQuery {
            document_id: None,
            query_text: Some("bug".into()),
            source_system_id: None,
            entity_kinds: vec![],
            work_item_kind: Some("Bug".into()),
            limit: 5,
            exclude_entity_id: None,
            include_self: true,
        };
        let candidates = nearest_neighbors(&conn, &provider, query).expect("neighbors");

        // All returned candidates must have Bug work items
        assert!(!candidates.is_empty(), "should return at least one Bug candidate");
        for c in &candidates {
            assert_eq!(
                c.work_item_id.as_deref(),
                Some("wi_bug"),
                "work_item_kind filter should exclude Task candidates"
            );
        }
    }
}
