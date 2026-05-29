//! Per-project data reset for Jira sources.
//!
//! Wipes every row that belongs to a single `(source_system_id, project_key)`
//! so the next sync re-fetches that project from scratch. Runs inside a single
//! transaction so a partial wipe is impossible.
//!
//! What gets deleted:
//! - `work_items` for the project and every table that references them
//!   (`jira_issues`, `work_item_terms`, `work_item_relationships`,
//!   `work_item_comments`, `jira_issue_field_values`, `jira_worklogs`,
//!   `jira_remote_links`, `issue_events`, `issue_snapshots`,
//!   `indexable_documents`).
//! - Project-keyed metadata: `jira_project_field_mappings`,
//!   `ingestion_cursors` for `project:{KEY}:*`, and `ingestion_runs` whose
//!   `requested_projects_json` array contains the project key.
//!
//! What is preserved:
//! - Shared rows that span projects or sources: `source_systems`,
//!   `people`, `source_identities`, `identity_links`,
//!   `jira_field_definitions`, `shared_settings`.
//! - Source-scoped jobs not tied to a single project:
//!   `issue_snapshot_jobs`.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct ResetJiraProjectCounts {
    pub work_items: u32,
    pub work_item_terms: u32,
    pub work_item_relationships: u32,
    pub work_item_comments: u32,
    pub jira_issues: u32,
    pub jira_issue_field_values: u32,
    pub jira_worklogs: u32,
    pub jira_remote_links: u32,
    pub jira_project_field_mappings: u32,
    pub issue_events: u32,
    pub issue_snapshots: u32,
    pub document_embeddings: u32,
    pub indexable_documents: u32,
    pub ingestion_cursors: u32,
    pub ingestion_runs: u32,
}

/// Atomically delete every row scoped to `(source_system_id, project_key)`.
/// See module docs for the full table list.
pub fn reset_jira_project_data(
    conn: &mut Connection,
    source_system_id: &str,
    project_key: &str,
) -> rusqlite::Result<ResetJiraProjectCounts> {
    let tx = conn.transaction()?;
    let mut counts = ResetJiraProjectCounts::default();

    // Tables that reference work_items via FK — delete leaves first.

    // Delete embedding metadata before indexable_documents.
    // document_embeddings has ON DELETE CASCADE from indexable_documents, but we
    // delete explicitly here to capture the count.
    // NOTE: vec_document_embeddings (sqlite-vec virtual table) rows are NOT
    // cascade-deleted and will be orphaned until a future cleanup pass adds
    // explicit vec row deletion here.
    counts.document_embeddings = tx.execute(
        "DELETE FROM document_embeddings \
         WHERE document_id IN ( \
             SELECT id FROM indexable_documents \
             WHERE work_item_id IN ( \
                 SELECT id FROM work_items \
                 WHERE source_system_id = ?1 AND project_key = ?2 \
             ) \
         )",
        params![source_system_id, project_key],
    )? as u32;

    counts.indexable_documents = tx.execute(
        "DELETE FROM indexable_documents \
         WHERE work_item_id IN ( \
             SELECT id FROM work_items \
             WHERE source_system_id = ?1 AND project_key = ?2 \
         )",
        params![source_system_id, project_key],
    )? as u32;

    counts.issue_snapshots = tx.execute(
        "DELETE FROM issue_snapshots \
         WHERE source_system_id = ?1 AND project_key = ?2",
        params![source_system_id, project_key],
    )? as u32;

    counts.issue_events = tx.execute(
        "DELETE FROM issue_events \
         WHERE issue_id IN ( \
             SELECT id FROM work_items \
             WHERE source_system_id = ?1 AND project_key = ?2 \
         )",
        params![source_system_id, project_key],
    )? as u32;

    counts.jira_remote_links = tx.execute(
        "DELETE FROM jira_remote_links \
         WHERE work_item_id IN ( \
             SELECT id FROM work_items \
             WHERE source_system_id = ?1 AND project_key = ?2 \
         )",
        params![source_system_id, project_key],
    )? as u32;

    counts.jira_worklogs = tx.execute(
        "DELETE FROM jira_worklogs \
         WHERE work_item_id IN ( \
             SELECT id FROM work_items \
             WHERE source_system_id = ?1 AND project_key = ?2 \
         )",
        params![source_system_id, project_key],
    )? as u32;

    counts.jira_issue_field_values = tx.execute(
        "DELETE FROM jira_issue_field_values \
         WHERE work_item_id IN ( \
             SELECT id FROM work_items \
             WHERE source_system_id = ?1 AND project_key = ?2 \
         )",
        params![source_system_id, project_key],
    )? as u32;

    counts.work_item_comments = tx.execute(
        "DELETE FROM work_item_comments \
         WHERE work_item_id IN ( \
             SELECT id FROM work_items \
             WHERE source_system_id = ?1 AND project_key = ?2 \
         )",
        params![source_system_id, project_key],
    )? as u32;

    // Relationships where *either* end is in the target project. A
    // cross-project link gets removed when one side is wiped — the issues on
    // the other side stay, but they lose the link to the wiped issues.
    counts.work_item_relationships = tx.execute(
        "DELETE FROM work_item_relationships \
         WHERE from_work_item_id IN ( \
             SELECT id FROM work_items \
             WHERE source_system_id = ?1 AND project_key = ?2 \
         ) OR to_work_item_id IN ( \
             SELECT id FROM work_items \
             WHERE source_system_id = ?1 AND project_key = ?2 \
         )",
        params![source_system_id, project_key],
    )? as u32;

    counts.jira_issues = tx.execute(
        "DELETE FROM jira_issues \
         WHERE work_item_id IN ( \
             SELECT id FROM work_items \
             WHERE source_system_id = ?1 AND project_key = ?2 \
         )",
        params![source_system_id, project_key],
    )? as u32;

    counts.work_item_terms = tx.execute(
        "DELETE FROM work_item_terms \
         WHERE work_item_id IN ( \
             SELECT id FROM work_items \
             WHERE source_system_id = ?1 AND project_key = ?2 \
         )",
        params![source_system_id, project_key],
    )? as u32;

    counts.work_items = tx.execute(
        "DELETE FROM work_items \
         WHERE source_system_id = ?1 AND project_key = ?2",
        params![source_system_id, project_key],
    )? as u32;

    // Project-keyed metadata.
    counts.jira_project_field_mappings = tx.execute(
        "DELETE FROM jira_project_field_mappings \
         WHERE source_system_id = ?1 AND project_key = ?2",
        params![source_system_id, project_key],
    )? as u32;

    // Cursors are keyed as `project:{KEY}:issues` and
    // `project:{KEY}:remotelinks`. Match the whole `project:{KEY}:*` family.
    counts.ingestion_cursors = tx.execute(
        "DELETE FROM ingestion_cursors \
         WHERE source_system_id = ?1 AND cursor_key LIKE ?2",
        params![source_system_id, format!("project:{}:%", project_key)],
    )? as u32;

    // `ingest_project` records one run per (source, project) with the project
    // key in `requested_projects_json`. Use `json_each` to match robustly even
    // when the array has more than one element.
    counts.ingestion_runs = tx.execute(
        "DELETE FROM ingestion_runs \
         WHERE source_system_id = ?1 \
           AND EXISTS ( \
               SELECT 1 FROM json_each(ingestion_runs.requested_projects_json) \
               WHERE value = ?2 \
           )",
        params![source_system_id, project_key],
    )? as u32;

    tx.commit()?;
    Ok(counts)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    fn open() -> Connection {
        open_in_memory().expect("db")
    }

    fn seed_source(conn: &Connection, source_system_id: &str) {
        conn.execute(
            "INSERT INTO source_systems(id, kind, display_name, base_url, created_at, updated_at) \
             VALUES (?1, 'jira', 'src', 'https://example.org', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            params![source_system_id],
        )
        .unwrap();
    }

    fn seed_work_item(
        conn: &Connection,
        id: &str,
        source_system_id: &str,
        project_key: &str,
        upstream_id: &str,
        key: &str,
    ) {
        conn.execute(
            "INSERT INTO work_items( \
                 id, source_system_id, source_kind, upstream_id, key, title, state, \
                 project_key, last_seen_at, raw_updated_hash, created_at, updated_at \
             ) VALUES (?1, ?2, 'jira_issue', ?3, ?4, 'T', 'open', ?5, 'now', 'h', 'now', 'now')",
            params![id, source_system_id, upstream_id, key, project_key],
        )
        .unwrap();
    }

    #[test]
    fn deletes_only_target_project_rows() {
        let mut conn = open();
        seed_source(&conn, "srcsys_1");
        seed_source(&conn, "srcsys_2");

        // Two issues in target project, one in other project, one in other source.
        seed_work_item(&conn, "wi_a1", "srcsys_1", "AMP", "1001", "AMP-1");
        seed_work_item(&conn, "wi_a2", "srcsys_1", "AMP", "1002", "AMP-2");
        seed_work_item(&conn, "wi_o1", "srcsys_1", "OTHER", "2001", "OTHER-1");
        seed_work_item(&conn, "wi_s2", "srcsys_2", "AMP", "3001", "AMP-1");

        // Project mapping rows for the same triplet shape.
        conn.execute(
            "INSERT INTO jira_project_field_mappings(source_system_id, project_key, canonical_name, field_id, value_kind, updated_at) \
             VALUES ('srcsys_1','AMP','title','summary','text','now'), \
                    ('srcsys_1','OTHER','title','summary','text','now')",
            [],
        ).unwrap();

        // Cursors: target + remotelinks for AMP, other project, separate source.
        conn.execute(
            "INSERT INTO ingestion_cursors(source_system_id, connector, cursor_key, cursor_value, updated_at) \
             VALUES \
                ('srcsys_1','jira.issue','project:AMP:issues','{\"last_updated\":\"x\"}','now'), \
                ('srcsys_1','jira.issue','project:AMP:remotelinks','{\"last_updated\":\"x\"}','now'), \
                ('srcsys_1','jira.issue','project:OTHER:issues','{\"last_updated\":\"x\"}','now'), \
                ('srcsys_2','jira.issue','project:AMP:issues','{\"last_updated\":\"x\"}','now')",
            [],
        ).unwrap();

        // Runs: AMP, OTHER, other source.
        conn.execute(
            "INSERT INTO ingestion_runs(id, source_system_id, connector, status, started_at, requested_projects_json, progress_json, counts_json) \
             VALUES \
                ('run_amp_1','srcsys_1','jira.issue','succeeded','t','[\"AMP\"]','{}','{}'), \
                ('run_other','srcsys_1','jira.issue','succeeded','t','[\"OTHER\"]','{}','{}'), \
                ('run_s2','srcsys_2','jira.issue','succeeded','t','[\"AMP\"]','{}','{}')",
            [],
        ).unwrap();

        // A cross-project relationship (AMP-1 → OTHER-1) and a same-source
        // intra-project relationship (AMP-1 → AMP-2). Both should go.
        conn.execute(
            "INSERT INTO work_item_relationships(id, source_system_id, source_kind, from_work_item_id, to_work_item_id, relationship_type, created_at, updated_at) \
             VALUES \
                ('rel_a1_o1','srcsys_1','jira_issue','wi_a1','wi_o1','relates','now','now'), \
                ('rel_a1_a2','srcsys_1','jira_issue','wi_a1','wi_a2','blocks','now','now')",
            [],
        ).unwrap();

        // Indexable doc and a snapshot in the target project.
        conn.execute(
            "INSERT INTO indexable_documents(id, source_system_id, entity_kind, entity_id, work_item_id, body, metadata_json, content_hash, embedding_status, created_at, updated_at) \
             VALUES ('doc_a1','srcsys_1','jira_issue','wi_a1','wi_a1','b','{}','h','pending','now','now')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO issue_snapshots(issue_id, snapshot_date, source_system_id, source_kind, title, state, project_key, snapshot_source, generated_at) \
             VALUES ('wi_a1','2026-05-28','srcsys_1','jira_issue','T','open','AMP','generated','now')",
            [],
        ).unwrap();
        // An event tied to AMP-1.
        conn.execute(
            "INSERT INTO issue_events(id, source_system_id, issue_id, entity_type, entity_id, source_kind, event_type, occurred_at, payload_json, ingested_at) \
             VALUES ('ev_1','srcsys_1','wi_a1','issue','wi_a1','jira_issue','status_changed','now','{}','now')",
            [],
        ).unwrap();

        let counts = reset_jira_project_data(&mut conn, "srcsys_1", "AMP").expect("reset");

        // Target: AMP work items deleted.
        let amp_work_items: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM work_items WHERE source_system_id='srcsys_1' AND project_key='AMP'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(amp_work_items, 0);

        // Preserved: OTHER project on same source.
        let other_work_items: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM work_items WHERE source_system_id='srcsys_1' AND project_key='OTHER'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(other_work_items, 1);

        // Preserved: AMP project on a *different* source.
        let other_source: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM work_items WHERE source_system_id='srcsys_2'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(other_source, 1);

        // Target snapshots/events/docs gone.
        let target_snapshots: i64 = conn
            .query_row("SELECT COUNT(*) FROM issue_snapshots", [], |r| r.get(0))
            .unwrap();
        assert_eq!(target_snapshots, 0);
        let target_events: i64 = conn
            .query_row("SELECT COUNT(*) FROM issue_events", [], |r| r.get(0))
            .unwrap();
        assert_eq!(target_events, 0);
        let target_docs: i64 = conn
            .query_row("SELECT COUNT(*) FROM indexable_documents", [], |r| r.get(0))
            .unwrap();
        assert_eq!(target_docs, 0);

        // Cursors: target's `project:AMP:*` rows gone, other source/project preserved.
        let cursor_rows: Vec<(String, String)> = {
            let mut stmt = conn
                .prepare("SELECT source_system_id, cursor_key FROM ingestion_cursors ORDER BY source_system_id, cursor_key")
                .unwrap();
            stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
                .unwrap()
                .collect::<rusqlite::Result<_>>()
                .unwrap()
        };
        assert_eq!(
            cursor_rows,
            vec![
                ("srcsys_1".to_string(), "project:OTHER:issues".to_string()),
                ("srcsys_2".to_string(), "project:AMP:issues".to_string()),
            ]
        );

        // Runs: AMP run on srcsys_1 gone; OTHER run on srcsys_1 kept; AMP on srcsys_2 kept.
        let run_ids: Vec<String> = {
            let mut stmt = conn
                .prepare("SELECT id FROM ingestion_runs ORDER BY id")
                .unwrap();
            stmt.query_map([], |r| r.get(0))
                .unwrap()
                .collect::<rusqlite::Result<_>>()
                .unwrap()
        };
        assert_eq!(run_ids, vec!["run_other", "run_s2"]);

        // Both relationships involving the target project are gone.
        let rels: i64 = conn
            .query_row("SELECT COUNT(*) FROM work_item_relationships", [], |r| r.get(0))
            .unwrap();
        assert_eq!(rels, 0);

        // Counts returned by the function match observed deletions.
        assert_eq!(counts.work_items, 2);
        assert_eq!(counts.ingestion_cursors, 2);
        assert_eq!(counts.ingestion_runs, 1);
        assert_eq!(counts.issue_events, 1);
        assert_eq!(counts.issue_snapshots, 1);
        assert_eq!(counts.indexable_documents, 1);
        assert_eq!(counts.work_item_relationships, 2);
        assert_eq!(counts.jira_project_field_mappings, 1);
    }

    #[test]
    fn preserves_shared_identities_and_field_definitions() {
        let mut conn = open();
        seed_source(&conn, "srcsys_1");
        seed_work_item(&conn, "wi_a1", "srcsys_1", "AMP", "1001", "AMP-1");

        // Shared rows that must NOT be touched.
        conn.execute(
            "INSERT INTO people(id, display_name, created_at, updated_at) \
             VALUES ('p_1','Alice','now','now')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO source_identities(id, person_id, source_system_id, source_kind, display_name, created_at, updated_at) \
             VALUES ('sid_1','p_1','srcsys_1','jira_issue','Alice','now','now')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO jira_field_definitions(source_system_id, field_id, is_custom, last_seen_at) \
             VALUES ('srcsys_1','summary',0,'now')",
            [],
        )
        .unwrap();

        reset_jira_project_data(&mut conn, "srcsys_1", "AMP").expect("reset");

        let identities: i64 = conn
            .query_row("SELECT COUNT(*) FROM source_identities", [], |r| r.get(0))
            .unwrap();
        assert_eq!(identities, 1);
        let field_defs: i64 = conn
            .query_row("SELECT COUNT(*) FROM jira_field_definitions", [], |r| r.get(0))
            .unwrap();
        assert_eq!(field_defs, 1);
    }

    #[test]
    fn no_op_when_no_data_for_project() {
        let mut conn = open();
        seed_source(&conn, "srcsys_1");
        let counts =
            reset_jira_project_data(&mut conn, "srcsys_1", "GHOST").expect("reset no-op");
        assert_eq!(counts, ResetJiraProjectCounts::default());
    }
}
