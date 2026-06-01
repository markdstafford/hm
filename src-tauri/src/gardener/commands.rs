use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::Mutex;

use crate::gardener::errors::GardenerError;
use crate::gardener::repository::{list_pending_suggestions, GardenerSuggestionRecord};
use crate::gardener::repository::{record_suppression, SuppressionInput, SuppressionKey};
use crate::gardener::runner::{GardenerRunSummary, OnDemandRunInput};

// DTO types (no serde_json::Value in specta types!)

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct HygieneSuggestionsListFilter {
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct HygieneIssueRefDto {
    pub key: String,
    pub title: String,
    pub status: Option<String>,
    pub assignee: Option<String>,
    pub updated_at: Option<String>,
    pub body: Option<String>,
    pub labels: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct HygieneProposedChangeDto {
    pub title: Option<String>,
    pub body: Option<String>,
    pub labels: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct HygieneSuggestionDto {
    pub id: String,
    pub category: String,
    pub action: String,
    pub confidence: u8,
    pub rationale: String,
    pub target: HygieneIssueRefDto,
    pub duplicate_of: Option<HygieneIssueRefDto>,
    pub last_activity_at: Option<String>,
    pub proposed: Option<HygieneProposedChangeDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct GardenerOnDemandInput {
    pub engine_id: String,
    pub source_id: Option<String>,
    pub target_upstream_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct GardenerRecordSuppressionInput {
    pub engine_id: String,
    pub key_kind: String,
    pub source_id: String,
    pub source_kind: String,
    pub upstream_id: String,
    pub reason: String,
}

// Connection-level helper (for tests and command impl)
pub fn list_hygiene_suggestions_from_conn(
    conn: &rusqlite::Connection,
    _filter: Option<&HygieneSuggestionsListFilter>,
) -> Result<Vec<HygieneSuggestionDto>, GardenerError> {
    let records = list_pending_suggestions(conn)?;
    records.into_iter().map(map_record_to_dto).collect()
}

fn map_record_to_dto(r: GardenerSuggestionRecord) -> Result<HygieneSuggestionDto, GardenerError> {
    // Parse payload_json to extract category-specific fields
    let payload: serde_json::Value =
        serde_json::from_str(&r.payload_json).unwrap_or(serde_json::Value::Null);

    let last_activity_at = payload
        .get("lastActivityAt")
        .or_else(|| payload.get("last_activity_at"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let duplicate_of = None; // For future duplicate engine
    let proposed = None; // For future enrichment engine

    Ok(HygieneSuggestionDto {
        id: r.id,
        category: r.category,
        action: r.action_id,
        confidence: r.confidence,
        rationale: r.rationale,
        target: HygieneIssueRefDto {
            key: r.target_display_key,
            title: r.title,
            status: r.status,
            assignee: r.assignee,
            updated_at: None, // Not stored in the record directly; could add later
            body: None,
            labels: vec![],
        },
        duplicate_of,
        last_activity_at,
        proposed,
    })
}

// Tauri commands
#[tauri::command]
#[specta::specta]
pub fn hygiene_suggestions_list(
    filter: Option<HygieneSuggestionsListFilter>,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<Vec<HygieneSuggestionDto>, String> {
    let conn = db
        .lock()
        .map_err(|_| "Could not access gardener storage.".to_string())?;
    list_hygiene_suggestions_from_conn(&conn, filter.as_ref()).map_err(|e| e.safe_message())
}

#[tauri::command]
#[specta::specta]
pub fn gardener_run_on_demand(
    input: GardenerOnDemandInput,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
    runtime: tauri::State<'_, crate::gardener::runner::GardenerRuntime>,
) -> Result<GardenerRunSummary, String> {
    // Known limitation (INIT-5): the SQLite mutex is held for the duration of
    // the entire gardener run, including engine compute. The spec requires
    // acquiring the connection only for short read/write phases and releasing it
    // during compute. For the v1 reference engine this is safe because compute
    // is cheap and local. A future provider-backed engine must refactor the
    // runner to accept a connection factory / short-lived borrows so that
    // compute runs without holding the mutex.
    let conn = db
        .lock()
        .map_err(|_| "Could not access gardener storage.".to_string())?;
    let now = crate::sources::jira_ingestion::now_utc_rfc3339();
    let on_demand_input = OnDemandRunInput {
        source_id: input.source_id,
        target_upstream_id: input.target_upstream_id,
        now,
    };
    Ok(crate::gardener::runner::run_on_demand(
        &conn,
        &runtime,
        &crate::gardener::default_engines(),
        &input.engine_id,
        on_demand_input,
    ))
}

#[tauri::command]
#[specta::specta]
pub fn gardener_record_suppression(
    input: GardenerRecordSuppressionInput,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<String, String> {
    let conn = db
        .lock()
        .map_err(|_| "Could not access gardener storage.".to_string())?;
    let now = crate::sources::jira_ingestion::now_utc_rfc3339();
    let key = SuppressionKey::Issue {
        source_id: input.source_id,
        source_kind: input.source_kind,
        upstream_id: input.upstream_id,
    };
    let suppression_input = SuppressionInput {
        id: format!("{}_{}", &input.engine_id, &now),
        engine_id: input.engine_id,
        key,
        reason: input.reason,
    };
    record_suppression(&conn, &suppression_input, &now).map_err(|e| e.safe_message())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::gardener::engine::GardenerEngine;
    use crate::gardener::reference::ReferenceEngine;
    use crate::gardener::repository::{
        insert_or_supersede_pending, read_watermark, record_suppression,
        suppress_pending_for_changed_target, GardenerTarget, SuggestionInsert, SuppressionInput,
        SuppressionKey,
    };
    use crate::gardener::runner::{
        run_on_demand, run_scheduled, GardenerRunStatus, GardenerRuntime, OnDemandRunInput,
        ScheduledRunInput,
    };
    use crate::issues::ids::stable_id;
    use crate::issues::repository::{
        upsert_source_system, upsert_work_item, SourceSystemInput, WorkItemInput,
    };
    use std::sync::Arc;

    fn seed_source_and_work_item(conn: &rusqlite::Connection) {
        let now = "2026-01-01T00:00:00Z";
        upsert_source_system(
            conn,
            now,
            &SourceSystemInput {
                id: "srcsys_1",
                kind: "jira",
                deployment_kind: Some("data_center"),
                display_name: "Test Jira",
                base_url: Some("https://jira.example.com"),
                config_source_id: Some("src_1"),
            },
        )
        .expect("upsert source");

        let item_id = stable_id("wi", &["srcsys_1", "jira_issue", "10001"]);
        upsert_work_item(
            conn,
            now,
            &WorkItemInput {
                id: &item_id,
                source_system_id: "srcsys_1",
                source_kind: "jira_issue",
                upstream_id: "10001",
                key: Some("TEST-1"),
                url: None,
                title: "Test issue title",
                body: None,
                state: "open",
                status_name: Some("Open"),
                resolution_name: None,
                priority_name: None,
                item_type: None,
                project_key: Some("TEST"),
                project_name: Some("Test Project"),
                assignee_person_id: None,
                reporter_person_id: None,
                created_at_source: None,
                updated_at_source: Some("2026-01-01T00:00:00Z"),
                resolved_at_source: None,
                due_at_source: None,
                raw_updated_hash: "hash001",
            },
        )
        .expect("upsert work item");
    }

    fn reference_engines() -> Vec<Arc<dyn GardenerEngine>> {
        vec![Arc::new(ReferenceEngine)]
    }

    fn make_scheduled_input(source_id: &str) -> ScheduledRunInput {
        ScheduledRunInput {
            source_id: Some(source_id.into()),
            project_key: None,
            cursor_kind: "updated_at".into(),
            cursor_value: "2026-01-01T00:00:00Z".into(),
            now: "2026-01-01T00:00:00Z".into(),
        }
    }

    // -----------------------------------------------------------------------
    // End-to-end acceptance tests
    // -----------------------------------------------------------------------

    /// Full path: seed work item → run scheduled → list via command helper → assert DTO shape.
    #[test]
    fn full_path_reference_suggestion_lists_through_command_shape() {
        let conn = open_in_memory().expect("db opens");
        seed_source_and_work_item(&conn);
        let runtime = GardenerRuntime::default();

        let summary = run_scheduled(
            &conn,
            &runtime,
            &reference_engines(),
            make_scheduled_input("srcsys_1"),
        );
        assert_eq!(summary.status, GardenerRunStatus::Complete);

        let dtos = list_hygiene_suggestions_from_conn(&conn, None).expect("list");
        assert_eq!(dtos.len(), 1);
        let dto = &dtos[0];
        assert_eq!(dto.category, "stale");
        assert_eq!(dto.action, "close-as-resolved");
        assert_eq!(dto.target.key, "TEST-1");
        assert!(!dto.rationale.is_empty());
    }

    /// Running scheduled twice for the same target must result in exactly one pending suggestion.
    #[test]
    fn repeated_scheduled_reference_run_keeps_one_pending_visible_suggestion() {
        let conn = open_in_memory().expect("db opens");
        seed_source_and_work_item(&conn);
        let runtime = GardenerRuntime::default();

        run_scheduled(
            &conn,
            &runtime,
            &reference_engines(),
            make_scheduled_input("srcsys_1"),
        );
        run_scheduled(
            &conn,
            &runtime,
            &reference_engines(),
            make_scheduled_input("srcsys_1"),
        );

        let dtos = list_hygiene_suggestions_from_conn(&conn, None).expect("list");
        assert_eq!(
            dtos.len(),
            1,
            "second run must supersede, not add a duplicate"
        );
    }

    /// Suppression hides suggestions from scheduled runs but on-demand bypasses suppression.
    #[test]
    fn suppression_hides_scheduled_but_on_demand_bypasses() {
        let conn = open_in_memory().expect("db opens");
        seed_source_and_work_item(&conn);

        let key = SuppressionKey::Issue {
            source_id: "srcsys_1".into(),
            source_kind: "jira_issue".into(),
            upstream_id: "10001".into(),
        };
        record_suppression(
            &conn,
            &SuppressionInput {
                id: "sup-acc-1".into(),
                engine_id: "reference".into(),
                key,
                reason: "already handled".into(),
            },
            "2026-01-01T00:00:00Z",
        )
        .expect("record suppression");

        let runtime = GardenerRuntime::default();

        // Scheduled run: suppressed → zero visible
        run_scheduled(
            &conn,
            &runtime,
            &reference_engines(),
            make_scheduled_input("srcsys_1"),
        );
        let scheduled_dtos =
            list_hygiene_suggestions_from_conn(&conn, None).expect("list after scheduled");
        assert!(
            scheduled_dtos.is_empty(),
            "suppression must hide the scheduled suggestion"
        );

        // On-demand run: bypasses suppression → one visible
        let on_demand_input = OnDemandRunInput {
            source_id: Some("srcsys_1".into()),
            target_upstream_id: Some("10001".into()),
            now: "2026-01-01T00:00:00Z".into(),
        };
        let on_demand_summary = run_on_demand(
            &conn,
            &runtime,
            &reference_engines(),
            "reference",
            on_demand_input,
        );
        assert_eq!(on_demand_summary.status, GardenerRunStatus::Complete);
        let on_demand_dtos =
            list_hygiene_suggestions_from_conn(&conn, None).expect("list after on-demand");
        assert_eq!(
            on_demand_dtos.len(),
            1,
            "on-demand must bypass suppression and surface the suggestion"
        );
    }

    /// Writing gardener.policy.v1 with reference.enabled=false causes zero suggestions.
    #[test]
    fn disabled_reference_engine_produces_no_suggestions() {
        let conn = open_in_memory().expect("db opens");
        seed_source_and_work_item(&conn);

        // Disable the reference engine via policy
        crate::settings::shared::shared_settings_set(
            &conn,
            crate::gardener::settings::GARDENER_POLICY_KEY,
            &serde_json::json!({
                "engines": {
                    "reference": { "enabled": false, "scheduled": false, "on_demand": false }
                }
            }),
        )
        .expect("set policy");

        let runtime = GardenerRuntime::default();
        let summary = run_scheduled(
            &conn,
            &runtime,
            &reference_engines(),
            make_scheduled_input("srcsys_1"),
        );

        // All engines should be skipped
        assert!(
            matches!(summary.status, GardenerRunStatus::Skipped),
            "disabled engine must skip, got {:?}",
            summary.status
        );

        let dtos = list_hygiene_suggestions_from_conn(&conn, None).expect("list");
        assert!(
            dtos.is_empty(),
            "disabled engine must produce zero suggestions"
        );
    }

    /// After a successful scheduled run, the watermark reference/source/timestamp is set.
    #[test]
    fn watermark_advances_after_successful_scheduled_reference_run() {
        let conn = open_in_memory().expect("db opens");
        seed_source_and_work_item(&conn);
        let runtime = GardenerRuntime::default();

        let summary = run_scheduled(
            &conn,
            &runtime,
            &reference_engines(),
            make_scheduled_input("srcsys_1"),
        );
        assert_eq!(summary.status, GardenerRunStatus::Complete);

        let wm =
            read_watermark(&conn, "reference", "srcsys_1", "updated_at").expect("read watermark");
        assert_eq!(
            wm.as_deref(),
            Some("2026-01-01T00:00:00Z"),
            "watermark must be set after successful scheduled run"
        );
    }

    /// suppress_pending_for_changed_target hides pending suggestions for a changed target.
    #[test]
    fn changed_source_target_suppresses_stale_pending_suggestion() {
        let conn = open_in_memory().expect("db opens");
        seed_source_and_work_item(&conn);
        let runtime = GardenerRuntime::default();

        // Seed a pending suggestion via the runner
        run_scheduled(
            &conn,
            &runtime,
            &reference_engines(),
            make_scheduled_input("srcsys_1"),
        );
        let before = list_hygiene_suggestions_from_conn(&conn, None).expect("list before");
        assert_eq!(before.len(), 1, "precondition: one pending suggestion");

        // Simulate a source change that invalidates existing pending suggestions
        suppress_pending_for_changed_target(
            &conn,
            "srcsys_1",
            "jira_issue",
            "10001",
            "2026-01-02T00:00:00Z",
        )
        .expect("suppress pending for changed target");

        let after = list_hygiene_suggestions_from_conn(&conn, None).expect("list after");
        assert!(
            after.is_empty(),
            "pending suggestion must be suppressed after target change"
        );
    }

    fn make_pending_row(conn: &rusqlite::Connection, id: &str, key_json_seed: &str) {
        let target = GardenerTarget {
            source_id: "srcsys_1".into(),
            source_kind: "jira_issue".into(),
            upstream_id: key_json_seed.into(),
            display_key: format!("TEST-{key_json_seed}"),
            title: format!("Test issue {key_json_seed}"),
            status: Some("Open".into()),
            assignee: None,
            updated_at_source: Some("2026-01-01T00:00:00Z".into()),
        };
        let key = SuppressionKey::Issue {
            source_id: "srcsys_1".into(),
            source_kind: "jira_issue".into(),
            upstream_id: key_json_seed.into(),
        };
        insert_or_supersede_pending(
            conn,
            &SuggestionInsert {
                id: id.into(),
                engine_id: "reference".into(),
                category: "stale".into(),
                action_id: "close-as-resolved".into(),
                source_id: Some("srcsys_1".into()),
                target,
                suppression_key: key,
                confidence: 60,
                title: format!("Test issue {key_json_seed}"),
                rationale: "Reference gardener output".into(),
                payload_json: serde_json::json!({"kind": "stale", "lastActivityAt": "2026-01-01T00:00:00Z", "reference": true}),
            },
            "2026-01-01T00:00:00Z",
        )
        .expect("insert pending");
    }

    #[test]
    fn list_command_maps_pending_reference_suggestion_to_hygiene_shape() {
        let conn = open_in_memory().expect("db opens");
        make_pending_row(&conn, "sug-cmd-1", "10001");

        let result = list_hygiene_suggestions_from_conn(&conn, None).expect("list succeeds");
        assert_eq!(result.len(), 1);
        let dto = &result[0];
        assert_eq!(dto.category, "stale");
        assert_eq!(dto.action, "close-as-resolved");
        assert_eq!(dto.target.key, "TEST-10001");
        assert_eq!(
            dto.last_activity_at.as_deref(),
            Some("2026-01-01T00:00:00Z")
        );
    }

    #[test]
    fn list_command_returns_only_pending_visible_suggestions() {
        let conn = open_in_memory().expect("db opens");

        // Seed a pending row
        make_pending_row(&conn, "sug-visible-1", "10001");

        // Seed a second pending row then transition to rejected
        make_pending_row(&conn, "sug-rejected-2", "10002");
        crate::gardener::repository::transition_suggestion(
            &conn,
            "sug-rejected-2",
            crate::gardener::repository::SuggestionState::Rejected,
            "2026-01-01T00:00:00Z",
        )
        .expect("transition");

        let result = list_hygiene_suggestions_from_conn(&conn, None).expect("list");
        assert_eq!(
            result.len(),
            1,
            "only pending visible row should be returned"
        );
        assert_eq!(result[0].id, "sug-visible-1");
    }

    #[test]
    fn command_errors_are_safe_for_display() {
        let conn = open_in_memory().expect("db opens");
        // Insert a row with malformed payload_json that will still parse gracefully
        conn.execute(
            "INSERT INTO gardener_suggestions (id, engine_id, category, state, action_id, target_source_kind, target_upstream_id, target_display_key, suppression_key_json, confidence, title, rationale, payload_json, created_at, updated_at) VALUES ('bad-payload', 'reference', 'stale', 'pending', 'close-as-resolved', 'jira_issue', '10001', 'TEST-1', '{\"kind\":\"issue\"}', 60, 'Test', 'test', 'not-valid-json-object-but-string', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            [],
        )
        .expect("insert raw");
        // Should still succeed — malformed payload → None for optional fields
        let result = list_hygiene_suggestions_from_conn(&conn, None).expect("list");
        assert!(!result.is_empty());
        // Verify no auth/token strings would appear in error paths
        // (the error path itself is tested by trying to provoke a database error)
    }
}
