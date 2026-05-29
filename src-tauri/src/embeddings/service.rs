use serde::{Deserialize, Serialize};
use specta::Type;
use crate::embeddings::errors::EmbeddingError;
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
    pub dimension: usize,
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
        if let Some(ref ssid) = options.source_system_id {
            sql.push_str(&format!(" AND source_system_id = '{ssid}'"));
        }
        if let Some(ref kind) = options.entity_kind {
            sql.push_str(&format!(" AND entity_kind = '{kind}'"));
        }
        conn.execute(&sql, []).map_err(EmbeddingError::from)?;
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
    let dimension = response.dimension;

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
        if let Some(ref ssid) = options.source_system_id {
            sql.push_str(&format!(" AND source_system_id = '{ssid}'"));
        }
        if let Some(ref kind) = options.entity_kind {
            sql.push_str(&format!(" AND entity_kind = '{kind}'"));
        }
        conn.execute(&sql, []).map_err(EmbeddingError::from)?;
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
    let dimension = response.dimension;

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
    let mut sql = String::from(
        "SELECT embedding_status, count(*) FROM indexable_documents",
    );
    if let Some(ssid) = source_system_id {
        sql.push_str(&format!(" WHERE source_system_id = '{ssid}'"));
    }
    sql.push_str(" GROUP BY embedding_status");

    let mut stmt = conn.prepare(&sql).map_err(EmbeddingError::from)?;
    let mut pending = 0u32;
    let mut embedding = 0u32;
    let mut embedded = 0u32;
    let mut stale = 0u32;
    let mut failed = 0u32;

    let rows = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))
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

    let last_sql = if let Some(ssid) = source_system_id {
        format!(
            "SELECT MAX(embedded_at) FROM document_embeddings WHERE source_system_id = '{ssid}'"
        )
    } else {
        "SELECT MAX(embedded_at) FROM document_embeddings".into()
    };
    let last_embedding_refresh: Option<String> = conn
        .query_row(&last_sql, [], |r| r.get(0))
        .unwrap_or(None);

    let warning_sql = if let Some(ssid) = source_system_id {
        format!(
            "SELECT safe_summary FROM embedding_failures WHERE source_system_id = '{ssid}' ORDER BY last_attempted_at DESC LIMIT 1"
        )
    } else {
        "SELECT safe_summary FROM embedding_failures ORDER BY last_attempted_at DESC LIMIT 1".into()
    };
    let warning: Option<String> = conn
        .query_row(&warning_sql, [], |r| r.get(0))
        .unwrap_or(None);

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
}
