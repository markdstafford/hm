//! Typed, idempotent upsert helpers for ingestion bookkeeping.
//!
//! These helpers wrap raw SQL behind small typed input structs. They take a
//! `&rusqlite::Connection` directly — no `tauri::State`, no `Mutex` — so they
//! can be exercised from unit tests against `crate::db::open_in_memory()` and
//! composed inside the larger ingestion pipeline without Tauri coupling.

use rusqlite::{params, Connection, Result};

use crate::issues::ids::stable_id;

pub struct SourceSystemInput<'a> {
    pub id: &'a str,
    pub kind: &'a str,
    pub deployment_kind: Option<&'a str>,
    pub display_name: &'a str,
    pub base_url: Option<&'a str>,
    pub config_source_id: Option<&'a str>,
}

/// Upsert a row into `source_systems`. Idempotent on primary key `id`.
pub fn upsert_source_system(
    conn: &Connection,
    now_utc: &str,
    input: &SourceSystemInput<'_>,
) -> Result<()> {
    conn.execute(
        "INSERT INTO source_systems (
            id, kind, deployment_kind, display_name, base_url, config_source_id, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
        ON CONFLICT(id) DO UPDATE SET
            kind = excluded.kind,
            deployment_kind = excluded.deployment_kind,
            display_name = excluded.display_name,
            base_url = excluded.base_url,
            config_source_id = excluded.config_source_id,
            updated_at = excluded.updated_at",
        params![
            input.id,
            input.kind,
            input.deployment_kind,
            input.display_name,
            input.base_url,
            input.config_source_id,
            now_utc,
        ],
    )?;
    Ok(())
}

pub struct WorkItemInput<'a> {
    pub id: &'a str,
    pub source_system_id: &'a str,
    pub source_kind: &'a str,
    pub upstream_id: &'a str,
    pub key: Option<&'a str>,
    pub url: Option<&'a str>,
    pub title: &'a str,
    pub body: Option<&'a str>,
    pub state: &'a str,
    pub status_name: Option<&'a str>,
    pub resolution_name: Option<&'a str>,
    pub priority_name: Option<&'a str>,
    pub item_type: Option<&'a str>,
    pub project_key: Option<&'a str>,
    pub project_name: Option<&'a str>,
    pub assignee_person_id: Option<&'a str>,
    pub reporter_person_id: Option<&'a str>,
    pub created_at_source: Option<&'a str>,
    pub updated_at_source: Option<&'a str>,
    pub resolved_at_source: Option<&'a str>,
    pub due_at_source: Option<&'a str>,
    pub raw_updated_hash: &'a str,
}

/// Upsert a row into `work_items`. Idempotent on
/// `UNIQUE(source_system_id, source_kind, upstream_id)`.
pub fn upsert_work_item(
    conn: &Connection,
    now_utc: &str,
    input: &WorkItemInput<'_>,
) -> Result<()> {
    conn.execute(
        "INSERT INTO work_items (
            id, source_system_id, source_kind, upstream_id, key, url, title, body, state,
            status_name, resolution_name, priority_name, item_type, project_key, project_name,
            assignee_person_id, reporter_person_id,
            created_at_source, updated_at_source, resolved_at_source, due_at_source,
            last_seen_at, raw_updated_hash, created_at, updated_at
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
            ?10, ?11, ?12, ?13, ?14, ?15,
            ?16, ?17,
            ?18, ?19, ?20, ?21,
            ?22, ?23, ?22, ?22
        )
        ON CONFLICT(source_system_id, source_kind, upstream_id) DO UPDATE SET
            key = excluded.key,
            url = excluded.url,
            title = excluded.title,
            body = excluded.body,
            state = excluded.state,
            status_name = excluded.status_name,
            resolution_name = excluded.resolution_name,
            priority_name = excluded.priority_name,
            item_type = excluded.item_type,
            project_key = excluded.project_key,
            project_name = excluded.project_name,
            assignee_person_id = excluded.assignee_person_id,
            reporter_person_id = excluded.reporter_person_id,
            created_at_source = excluded.created_at_source,
            updated_at_source = excluded.updated_at_source,
            resolved_at_source = excluded.resolved_at_source,
            due_at_source = excluded.due_at_source,
            last_seen_at = excluded.last_seen_at,
            raw_updated_hash = excluded.raw_updated_hash,
            updated_at = excluded.updated_at",
        params![
            input.id,
            input.source_system_id,
            input.source_kind,
            input.upstream_id,
            input.key,
            input.url,
            input.title,
            input.body,
            input.state,
            input.status_name,
            input.resolution_name,
            input.priority_name,
            input.item_type,
            input.project_key,
            input.project_name,
            input.assignee_person_id,
            input.reporter_person_id,
            input.created_at_source,
            input.updated_at_source,
            input.resolved_at_source,
            input.due_at_source,
            now_utc,
            input.raw_updated_hash,
        ],
    )?;
    Ok(())
}

pub struct WorkItemTermInput<'a> {
    pub work_item_id: &'a str,
    pub term_kind: &'a str,
    pub term_key: &'a str,
    pub term_name: Option<&'a str>,
    pub raw_json: Option<&'a str>,
}

/// Upsert a row into `work_item_terms`. Idempotent on the composite
/// PRIMARY KEY `(work_item_id, term_kind, term_key)`.
pub fn upsert_work_item_term(conn: &Connection, input: &WorkItemTermInput<'_>) -> Result<()> {
    conn.execute(
        "INSERT INTO work_item_terms (work_item_id, term_kind, term_key, term_name, raw_json)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(work_item_id, term_kind, term_key) DO UPDATE SET
             term_name = excluded.term_name,
             raw_json = excluded.raw_json",
        params![
            input.work_item_id,
            input.term_kind,
            input.term_key,
            input.term_name,
            input.raw_json,
        ],
    )?;
    Ok(())
}

pub struct WorkItemRelationshipInput<'a> {
    pub id: &'a str,
    pub source_system_id: &'a str,
    pub source_kind: &'a str,
    pub from_work_item_id: Option<&'a str>,
    pub to_work_item_id: Option<&'a str>,
    pub from_upstream_key: Option<&'a str>,
    pub to_upstream_key: Option<&'a str>,
    pub relationship_type: &'a str,
    pub direction: Option<&'a str>,
    pub raw_json: Option<&'a str>,
}

/// Upsert a row into `work_item_relationships`. Idempotent on
/// `UNIQUE(source_system_id, source_kind, from_upstream_key, to_upstream_key, relationship_type)`.
pub fn upsert_work_item_relationship(
    conn: &Connection,
    now_utc: &str,
    input: &WorkItemRelationshipInput<'_>,
) -> Result<()> {
    conn.execute(
        "INSERT INTO work_item_relationships (
            id, source_system_id, source_kind, from_work_item_id, to_work_item_id,
            from_upstream_key, to_upstream_key, relationship_type, direction, raw_json,
            created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)
        ON CONFLICT(source_system_id, source_kind, from_upstream_key, to_upstream_key, relationship_type)
        DO UPDATE SET
            from_work_item_id = excluded.from_work_item_id,
            to_work_item_id = excluded.to_work_item_id,
            direction = excluded.direction,
            raw_json = excluded.raw_json,
            updated_at = excluded.updated_at",
        params![
            input.id,
            input.source_system_id,
            input.source_kind,
            input.from_work_item_id,
            input.to_work_item_id,
            input.from_upstream_key,
            input.to_upstream_key,
            input.relationship_type,
            input.direction,
            input.raw_json,
            now_utc,
        ],
    )?;
    Ok(())
}

pub struct WorkItemCommentInput<'a> {
    pub id: &'a str,
    pub work_item_id: &'a str,
    pub source_system_id: &'a str,
    pub upstream_id: &'a str,
    pub author_identity_id: Option<&'a str>,
    pub body: Option<&'a str>,
    pub visibility_json: Option<&'a str>,
    pub created_at_source: Option<&'a str>,
    pub updated_at_source: Option<&'a str>,
    pub raw_json: Option<&'a str>,
    pub body_hash: &'a str,
}

/// Upsert a row into `work_item_comments`. Idempotent on
/// `UNIQUE(source_system_id, upstream_id)`.
pub fn upsert_work_item_comment(
    conn: &Connection,
    now_utc: &str,
    input: &WorkItemCommentInput<'_>,
) -> Result<()> {
    conn.execute(
        "INSERT INTO work_item_comments (
            id, work_item_id, source_system_id, upstream_id, author_identity_id, body,
            visibility_json, created_at_source, updated_at_source, raw_json, body_hash, ingested_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
        ON CONFLICT(source_system_id, upstream_id) DO UPDATE SET
            work_item_id = excluded.work_item_id,
            author_identity_id = excluded.author_identity_id,
            body = excluded.body,
            visibility_json = excluded.visibility_json,
            created_at_source = excluded.created_at_source,
            updated_at_source = excluded.updated_at_source,
            raw_json = excluded.raw_json,
            body_hash = excluded.body_hash,
            ingested_at = excluded.ingested_at",
        params![
            input.id,
            input.work_item_id,
            input.source_system_id,
            input.upstream_id,
            input.author_identity_id,
            input.body,
            input.visibility_json,
            input.created_at_source,
            input.updated_at_source,
            input.raw_json,
            input.body_hash,
            now_utc,
        ],
    )?;
    Ok(())
}

pub struct JiraWorklogInput<'a> {
    pub id: &'a str,
    pub work_item_id: &'a str,
    pub source_system_id: &'a str,
    pub upstream_id: &'a str,
    pub author_identity_id: Option<&'a str>,
    pub update_author_identity_id: Option<&'a str>,
    pub started_at_source: Option<&'a str>,
    pub time_spent_seconds: Option<i64>,
    pub comment: Option<&'a str>,
    pub raw_json: Option<&'a str>,
    pub raw_hash: &'a str,
}

/// Upsert a row into `jira_worklogs`. Idempotent on
/// `UNIQUE(source_system_id, upstream_id)`.
pub fn upsert_jira_worklog(
    conn: &Connection,
    now_utc: &str,
    input: &JiraWorklogInput<'_>,
) -> Result<()> {
    conn.execute(
        "INSERT INTO jira_worklogs (
            id, work_item_id, source_system_id, upstream_id, author_identity_id,
            update_author_identity_id, started_at_source, time_spent_seconds, comment,
            raw_json, raw_hash, ingested_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
        ON CONFLICT(source_system_id, upstream_id) DO UPDATE SET
            work_item_id = excluded.work_item_id,
            author_identity_id = excluded.author_identity_id,
            update_author_identity_id = excluded.update_author_identity_id,
            started_at_source = excluded.started_at_source,
            time_spent_seconds = excluded.time_spent_seconds,
            comment = excluded.comment,
            raw_json = excluded.raw_json,
            raw_hash = excluded.raw_hash,
            ingested_at = excluded.ingested_at",
        params![
            input.id,
            input.work_item_id,
            input.source_system_id,
            input.upstream_id,
            input.author_identity_id,
            input.update_author_identity_id,
            input.started_at_source,
            input.time_spent_seconds,
            input.comment,
            input.raw_json,
            input.raw_hash,
            now_utc,
        ],
    )?;
    Ok(())
}

pub struct JiraRemoteLinkInput<'a> {
    pub id: &'a str,
    pub work_item_id: &'a str,
    pub source_system_id: &'a str,
    pub upstream_id: Option<&'a str>,
    pub url: &'a str,
    pub title: Option<&'a str>,
    pub relationship: Option<&'a str>,
    pub raw_json: Option<&'a str>,
    pub raw_hash: &'a str,
}

/// Upsert a row into `jira_remote_links`. Idempotent on
/// `UNIQUE(source_system_id, work_item_id, url)`.
pub fn upsert_jira_remote_link(
    conn: &Connection,
    now_utc: &str,
    input: &JiraRemoteLinkInput<'_>,
) -> Result<()> {
    conn.execute(
        "INSERT INTO jira_remote_links (
            id, work_item_id, source_system_id, upstream_id, url, title, relationship,
            raw_json, raw_hash, ingested_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        ON CONFLICT(source_system_id, work_item_id, url) DO UPDATE SET
            upstream_id = excluded.upstream_id,
            title = excluded.title,
            relationship = excluded.relationship,
            raw_json = excluded.raw_json,
            raw_hash = excluded.raw_hash,
            ingested_at = excluded.ingested_at",
        params![
            input.id,
            input.work_item_id,
            input.source_system_id,
            input.upstream_id,
            input.url,
            input.title,
            input.relationship,
            input.raw_json,
            input.raw_hash,
            now_utc,
        ],
    )?;
    Ok(())
}

pub struct IndexableDocumentInput<'a> {
    pub source_system_id: &'a str,
    pub entity_kind: &'a str,
    pub entity_id: &'a str,
    pub work_item_id: Option<&'a str>,
    pub title: Option<&'a str>,
    pub body: &'a str,
    pub metadata_json: &'a str,
    pub content_hash: &'a str,
}

/// Upsert an indexable document.
///
/// Semantics:
/// - If a prior row exists with the same `(entity_kind, entity_id)` but a
///   different `content_hash`, its `embedding_status` is set to `'stale'`.
/// - A new row is inserted with `embedding_status = 'pending'` using a
///   deterministic id (`stable_id("doc", &[entity_kind, entity_id, content_hash])`).
///   The `UNIQUE(entity_kind, entity_id, content_hash)` constraint makes the
///   insert a no-op if a row with the same content already exists, so calling
///   the helper twice for the same content does not create duplicates.
pub fn upsert_indexable_document(
    conn: &Connection,
    now_utc: &str,
    input: &IndexableDocumentInput<'_>,
) -> Result<()> {
    // 1. Mark any prior documents for the same entity with a different hash as stale.
    conn.execute(
        "UPDATE indexable_documents
            SET embedding_status = 'stale',
                updated_at = ?1
          WHERE entity_kind = ?2
            AND entity_id = ?3
            AND content_hash != ?4
            AND embedding_status != 'stale'",
        params![now_utc, input.entity_kind, input.entity_id, input.content_hash],
    )?;

    // 2. Insert the new row; UNIQUE(entity_kind, entity_id, content_hash) makes
    //    repeat calls with the same content a no-op.
    let id = stable_id(
        "doc",
        &[input.entity_kind, input.entity_id, input.content_hash],
    );
    conn.execute(
        "INSERT OR IGNORE INTO indexable_documents (
            id, source_system_id, entity_kind, entity_id, work_item_id, title, body,
            metadata_json, content_hash, embedding_status, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', ?10, ?10)",
        params![
            id,
            input.source_system_id,
            input.entity_kind,
            input.entity_id,
            input.work_item_id,
            input.title,
            input.body,
            input.metadata_json,
            input.content_hash,
            now_utc,
        ],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    const NOW: &str = "2026-05-25T17:00:00Z";

    fn seed_source_system(conn: &Connection, id: &str) {
        upsert_source_system(
            conn,
            NOW,
            &SourceSystemInput {
                id,
                kind: "jira",
                deployment_kind: Some("cloud"),
                display_name: "Test Jira",
                base_url: Some("https://jira.example.com"),
                config_source_id: Some("primary"),
            },
        )
        .expect("seed source_system");
    }

    fn seed_work_item(conn: &Connection, id: &str, source_system_id: &str, upstream_id: &str) {
        upsert_work_item(
            conn,
            NOW,
            &WorkItemInput {
                id,
                source_system_id,
                source_kind: "jira",
                upstream_id,
                key: Some("ABC-1"),
                url: None,
                title: "Initial title",
                body: None,
                state: "open",
                status_name: Some("Open"),
                resolution_name: None,
                priority_name: None,
                item_type: Some("Task"),
                project_key: Some("ABC"),
                project_name: Some("Alphabet"),
                assignee_person_id: None,
                reporter_person_id: None,
                created_at_source: None,
                updated_at_source: None,
                resolved_at_source: None,
                due_at_source: None,
                raw_updated_hash: "hash-1",
            },
        )
        .expect("seed work_item");
    }

    #[test]
    fn upserts_source_system_idempotently() {
        let conn = open_in_memory().expect("db");
        let input = SourceSystemInput {
            id: "src-1",
            kind: "jira",
            deployment_kind: Some("cloud"),
            display_name: "Test Jira",
            base_url: Some("https://jira.example.com"),
            config_source_id: Some("primary"),
        };
        upsert_source_system(&conn, NOW, &input).expect("first upsert");
        upsert_source_system(&conn, NOW, &input).expect("second upsert");

        let count: i64 = conn
            .query_row("SELECT count(*) FROM source_systems", [], |row| row.get(0))
            .expect("count");
        assert_eq!(count, 1, "two upserts of the same input must leave 1 row");
    }

    #[test]
    fn upserts_work_item_terms_comments_relationships_without_duplicates() {
        let conn = open_in_memory().expect("db");
        seed_source_system(&conn, "src-1");
        seed_work_item(&conn, "wi-1", "src-1", "10001");

        let term = WorkItemTermInput {
            work_item_id: "wi-1",
            term_kind: "label",
            term_key: "backend",
            term_name: Some("Backend"),
            raw_json: None,
        };
        upsert_work_item_term(&conn, &term).expect("term 1");
        upsert_work_item_term(&conn, &term).expect("term 2");

        let comment = WorkItemCommentInput {
            id: "c-1",
            work_item_id: "wi-1",
            source_system_id: "src-1",
            upstream_id: "comment-1",
            author_identity_id: None,
            body: Some("Hello"),
            visibility_json: None,
            created_at_source: None,
            updated_at_source: None,
            raw_json: None,
            body_hash: "h1",
        };
        upsert_work_item_comment(&conn, NOW, &comment).expect("comment 1");
        upsert_work_item_comment(&conn, NOW, &comment).expect("comment 2");

        let rel = WorkItemRelationshipInput {
            id: "rel-1",
            source_system_id: "src-1",
            source_kind: "jira",
            from_work_item_id: Some("wi-1"),
            to_work_item_id: None,
            from_upstream_key: Some("ABC-1"),
            to_upstream_key: Some("ABC-2"),
            relationship_type: "blocks",
            direction: Some("outward"),
            raw_json: None,
        };
        upsert_work_item_relationship(&conn, NOW, &rel).expect("rel 1");
        upsert_work_item_relationship(&conn, NOW, &rel).expect("rel 2");

        let term_count: i64 = conn
            .query_row("SELECT count(*) FROM work_item_terms", [], |row| row.get(0))
            .expect("term count");
        let comment_count: i64 = conn
            .query_row("SELECT count(*) FROM work_item_comments", [], |row| row.get(0))
            .expect("comment count");
        let rel_count: i64 = conn
            .query_row(
                "SELECT count(*) FROM work_item_relationships",
                [],
                |row| row.get(0),
            )
            .expect("rel count");

        assert_eq!(term_count, 1, "duplicate term must not insert twice");
        assert_eq!(comment_count, 1, "duplicate comment must not insert twice");
        assert_eq!(rel_count, 1, "duplicate relationship must not insert twice");
    }

    #[test]
    fn work_item_upsert_updates_existing_row() {
        let conn = open_in_memory().expect("db");
        seed_source_system(&conn, "src-1");
        seed_work_item(&conn, "wi-1", "src-1", "10001");

        upsert_work_item(
            &conn,
            NOW,
            &WorkItemInput {
                id: "wi-1",
                source_system_id: "src-1",
                source_kind: "jira",
                upstream_id: "10001",
                key: Some("ABC-1"),
                url: None,
                title: "Updated title",
                body: Some("New body"),
                state: "in_progress",
                status_name: Some("In Progress"),
                resolution_name: None,
                priority_name: None,
                item_type: Some("Task"),
                project_key: Some("ABC"),
                project_name: Some("Alphabet"),
                assignee_person_id: None,
                reporter_person_id: None,
                created_at_source: None,
                updated_at_source: None,
                resolved_at_source: None,
                due_at_source: None,
                raw_updated_hash: "hash-2",
            },
        )
        .expect("second upsert");

        let count: i64 = conn
            .query_row("SELECT count(*) FROM work_items", [], |row| row.get(0))
            .expect("count");
        assert_eq!(count, 1, "upsert on the same upstream_id must update, not duplicate");

        let (title, state, hash): (String, String, String) = conn
            .query_row(
                "SELECT title, state, raw_updated_hash FROM work_items WHERE upstream_id = ?1",
                ["10001"],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("select");
        assert_eq!(title, "Updated title");
        assert_eq!(state, "in_progress");
        assert_eq!(hash, "hash-2");
    }

    #[test]
    fn upserts_jira_worklog_and_remote_link_idempotently() {
        let conn = open_in_memory().expect("db");
        seed_source_system(&conn, "src-1");
        seed_work_item(&conn, "wi-1", "src-1", "10001");

        let wl = JiraWorklogInput {
            id: "wl-1",
            work_item_id: "wi-1",
            source_system_id: "src-1",
            upstream_id: "9001",
            author_identity_id: None,
            update_author_identity_id: None,
            started_at_source: Some("2026-05-22T09:00:00Z"),
            time_spent_seconds: Some(1800),
            comment: Some("Investigating"),
            raw_json: Some("{}"),
            raw_hash: "h1",
        };
        upsert_jira_worklog(&conn, NOW, &wl).expect("worklog 1");
        upsert_jira_worklog(&conn, NOW, &wl).expect("worklog 2");

        let rl = JiraRemoteLinkInput {
            id: "rl-1",
            work_item_id: "wi-1",
            source_system_id: "src-1",
            upstream_id: Some("500"),
            url: "https://docs.example.invalid/abc",
            title: Some("Doc"),
            relationship: Some("references"),
            raw_json: Some("{}"),
            raw_hash: "h1",
        };
        upsert_jira_remote_link(&conn, NOW, &rl).expect("remote link 1");
        upsert_jira_remote_link(&conn, NOW, &rl).expect("remote link 2");

        let wl_count: i64 = conn
            .query_row("SELECT count(*) FROM jira_worklogs", [], |r| r.get(0))
            .expect("count wl");
        let rl_count: i64 = conn
            .query_row("SELECT count(*) FROM jira_remote_links", [], |r| r.get(0))
            .expect("count rl");
        assert_eq!(wl_count, 1, "duplicate worklog must not insert twice");
        assert_eq!(rl_count, 1, "duplicate remote link must not insert twice");
    }

    #[test]
    fn marks_prior_indexable_document_stale_when_content_changes() {
        let conn = open_in_memory().expect("db");
        seed_source_system(&conn, "src-1");

        let mut doc = IndexableDocumentInput {
            source_system_id: "src-1",
            entity_kind: "work_item",
            entity_id: "wi-1",
            work_item_id: None,
            title: Some("Doc title"),
            body: "Body A",
            metadata_json: "{}",
            content_hash: "hashA",
        };
        upsert_indexable_document(&conn, NOW, &doc).expect("insert A");

        doc.body = "Body B";
        doc.content_hash = "hashB";
        upsert_indexable_document(&conn, NOW, &doc).expect("insert B");

        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM indexable_documents WHERE entity_kind = 'work_item' AND entity_id = 'wi-1'",
                [],
                |row| row.get(0),
            )
            .expect("count");
        assert_eq!(count, 2, "both versions should be persisted");

        let stale: String = conn
            .query_row(
                "SELECT embedding_status FROM indexable_documents WHERE content_hash = ?1",
                ["hashA"],
                |row| row.get(0),
            )
            .expect("stale row");
        assert_eq!(stale, "stale");

        let pending: String = conn
            .query_row(
                "SELECT embedding_status FROM indexable_documents WHERE content_hash = ?1",
                ["hashB"],
                |row| row.get(0),
            )
            .expect("pending row");
        assert_eq!(pending, "pending");

        // Idempotent: a third call with the same hashB content does nothing.
        upsert_indexable_document(&conn, NOW, &doc).expect("insert B again");
        let count_after: i64 = conn
            .query_row(
                "SELECT count(*) FROM indexable_documents WHERE entity_kind = 'work_item' AND entity_id = 'wi-1'",
                [],
                |row| row.get(0),
            )
            .expect("count after");
        assert_eq!(count_after, 2, "repeat upsert with same hash must not duplicate");
    }
}
