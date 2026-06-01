use crate::gardener::contract::{
    ApprovalPolicy, EngineContract, EngineCost, GardenerEngineId, GardenerTrigger, GatePolicy,
    PipelineStageSpec, RunPolicy, SuggestionCategory, SuppressionKeySpec,
};
use crate::gardener::engine::{EmittedSuggestion, EngineRunContext, GardenerEngine, StageOutput};
use crate::gardener::errors::{GardenerError, GardenerErrorCategory};
use crate::gardener::repository::SuppressionKey;

pub const REFERENCE_ENGINE_ID: &str = "reference";

pub struct ReferenceEngine;

impl GardenerEngine for ReferenceEngine {
    fn contract(&self) -> EngineContract {
        EngineContract {
            id: GardenerEngineId(REFERENCE_ENGINE_ID.into()),
            category: SuggestionCategory::Stale,
            dependencies: vec![],
            accepted_triggers: vec![GardenerTrigger::Scheduled, GardenerTrigger::OnDemand],
            pipeline: vec![PipelineStageSpec {
                id: "emit_reference_suggestion".into(),
                display_name: "Emit reference suggestion".into(),
                gate: Some(GatePolicy::HumanApproval),
                expensive: false,
            }],
            approval_policy: ApprovalPolicy::HumanReviewRequired,
            suppression_key: SuppressionKeySpec::Issue,
            cost: EngineCost::Cheap,
            run_policy: RunPolicy::IncrementalSafe,
            emits: "reference stale-style hygiene suggestion".into(),
        }
    }

    fn compute(
        &self,
        context: EngineRunContext,
        stage_id: &str,
    ) -> Result<StageOutput, GardenerError> {
        if stage_id != "emit_reference_suggestion" {
            return Err(GardenerError {
                category: GardenerErrorCategory::PipelineStageFailed,
                message: "Reference engine stage is not available.".into(),
            });
        }
        let Some(target) = context.target else {
            return Ok(StageOutput {
                candidates: vec![],
                scanned: 0,
            });
        };
        let key = SuppressionKey::Issue {
            source_id: target.source_id.clone(),
            source_kind: target.source_kind.clone(),
            upstream_id: target.upstream_id.clone(),
        };
        Ok(StageOutput {
            scanned: 1,
            candidates: vec![EmittedSuggestion {
                action_id: "close-as-resolved".into(),
                suppression_key: key,
                target: target.clone(),
                confidence: 60,
                title: target.title.clone(),
                status: target.status.clone(),
                assignee: target.assignee.clone(),
                rationale: "Reference gardener output: proves the local suggestion pipeline; it is not real stale analysis.".into(),
                payload_json: serde_json::json!({
                    "kind": "stale",
                    "lastActivityAt": target.updated_at_source,
                    "reference": true
                }),
            }],
        })
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::gardener::contract::GardenerTrigger;
    use crate::gardener::engine::{EngineRunContext, GardenerEngine};
    use crate::gardener::repository::{
        list_pending_suggestions, record_suppression, GardenerTarget, SuppressionInput,
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

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    fn make_target() -> GardenerTarget {
        GardenerTarget {
            source_id: "srcsys_1".into(),
            source_kind: "jira_issue".into(),
            upstream_id: "10001".into(),
            display_key: "TEST-1".into(),
            title: "Test issue title".into(),
            status: Some("Open".into()),
            assignee: None,
            updated_at_source: Some("2026-01-01T00:00:00Z".into()),
        }
    }

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

    fn make_scheduled_input(source_id: &str) -> ScheduledRunInput {
        ScheduledRunInput {
            source_id: Some(source_id.into()),
            project_key: None,
            cursor_kind: "updated_at".into(),
            cursor_value: "2026-01-01T00:00:00Z".into(),
            now: "2026-01-01T00:00:00Z".into(),
        }
    }

    fn reference_engines() -> Vec<Arc<dyn GardenerEngine>> {
        vec![Arc::new(ReferenceEngine)]
    }

    // -----------------------------------------------------------------------
    // Unit tests: contract + compute
    // -----------------------------------------------------------------------

    #[test]
    fn reference_contract_is_valid_and_has_no_dependencies() {
        let engine = ReferenceEngine;
        let contract = engine.contract();
        assert_eq!(contract.id.0, "reference");
        assert_eq!(contract.category, SuggestionCategory::Stale);
        assert!(contract.dependencies.is_empty());
        assert!(contract
            .accepted_triggers
            .contains(&GardenerTrigger::Scheduled));
        assert!(contract
            .accepted_triggers
            .contains(&GardenerTrigger::OnDemand));
        crate::gardener::contract::validate_contract(&contract).expect("reference contract valid");
    }

    #[test]
    fn reference_engine_emits_honest_payload_for_existing_target() {
        let engine = ReferenceEngine;
        let ctx = EngineRunContext {
            trigger: GardenerTrigger::Scheduled,
            source_id: Some("srcsys_1".into()),
            target: Some(make_target()),
            now: "2026-01-01T00:00:00Z".into(),
        };
        let output = engine
            .compute(ctx, "emit_reference_suggestion")
            .expect("compute succeeds");
        assert_eq!(output.scanned, 1);
        assert_eq!(output.candidates.len(), 1);
        let c = &output.candidates[0];
        assert_eq!(c.action_id, "close-as-resolved");
        assert_eq!(c.confidence, 60);
        assert_eq!(
            c.payload_json.get("reference").and_then(|v| v.as_bool()),
            Some(true)
        );
    }

    #[test]
    fn reference_engine_emits_nothing_without_target() {
        let engine = ReferenceEngine;
        let ctx = EngineRunContext {
            trigger: GardenerTrigger::Scheduled,
            source_id: None,
            target: None,
            now: "2026-01-01T00:00:00Z".into(),
        };
        let output = engine
            .compute(ctx, "emit_reference_suggestion")
            .expect("compute succeeds");
        assert_eq!(output.scanned, 0);
        assert!(output.candidates.is_empty());
    }

    // -----------------------------------------------------------------------
    // Integration tests: runner + reference engine
    // -----------------------------------------------------------------------

    #[test]
    fn scheduled_reference_run_persists_pending_suggestion_for_seeded_work_item() {
        let conn = open_in_memory().unwrap();
        seed_source_and_work_item(&conn);
        let runtime = GardenerRuntime::default();

        let summary = run_scheduled(
            &conn,
            &runtime,
            &reference_engines(),
            make_scheduled_input("srcsys_1"),
        );

        assert_eq!(summary.status, GardenerRunStatus::Complete);
        let pending = list_pending_suggestions(&conn).expect("list");
        assert_eq!(
            pending.len(),
            1,
            "reference engine should have created a pending suggestion"
        );
        assert!(
            pending[0].rationale.contains("Reference gardener output"),
            "should be the reference engine rationale"
        );
    }

    #[test]
    fn second_scheduled_reference_run_supersedes_instead_of_duplicating() {
        let conn = open_in_memory().unwrap();
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

        let pending = list_pending_suggestions(&conn).expect("list");
        assert_eq!(pending.len(), 1, "second run must supersede, not duplicate");
    }

    #[test]
    fn scheduled_reference_run_after_suppression_hides_suggestion() {
        let conn = open_in_memory().unwrap();
        seed_source_and_work_item(&conn);

        let key = SuppressionKey::Issue {
            source_id: "srcsys_1".into(),
            source_kind: "jira_issue".into(),
            upstream_id: "10001".into(),
        };
        record_suppression(
            &conn,
            &SuppressionInput {
                id: "sup-ref-1".into(),
                engine_id: "reference".into(),
                key,
                reason: "handled".into(),
            },
            "2026-01-01T00:00:00Z",
        )
        .expect("record suppression");

        let runtime = GardenerRuntime::default();
        run_scheduled(
            &conn,
            &runtime,
            &reference_engines(),
            make_scheduled_input("srcsys_1"),
        );

        let pending = list_pending_suggestions(&conn).expect("list");
        assert!(pending.is_empty(), "suppressed item must not surface");
    }

    #[test]
    fn on_demand_reference_run_after_suppression_surfaces_suggestion() {
        let conn = open_in_memory().unwrap();
        seed_source_and_work_item(&conn);

        let key = SuppressionKey::Issue {
            source_id: "srcsys_1".into(),
            source_kind: "jira_issue".into(),
            upstream_id: "10001".into(),
        };
        record_suppression(
            &conn,
            &SuppressionInput {
                id: "sup-ref-2".into(),
                engine_id: "reference".into(),
                key,
                reason: "handled".into(),
            },
            "2026-01-01T00:00:00Z",
        )
        .expect("record suppression");

        let runtime = GardenerRuntime::default();
        let input = OnDemandRunInput {
            source_id: Some("srcsys_1".into()),
            target_upstream_id: Some("10001".into()),
            now: "2026-01-01T00:00:00Z".into(),
        };
        let summary = run_on_demand(&conn, &runtime, &reference_engines(), "reference", input);

        assert_eq!(summary.status, GardenerRunStatus::Complete);
        let pending = list_pending_suggestions(&conn).expect("list");
        assert_eq!(pending.len(), 1, "on-demand bypasses suppression");
    }

    // -----------------------------------------------------------------------
    // Ingestion seam test
    // -----------------------------------------------------------------------

    #[test]
    fn ingestion_success_seam_runs_reference_gardener_best_effort() {
        let conn = open_in_memory().unwrap();
        seed_source_and_work_item(&conn);
        let runtime = GardenerRuntime::default();

        let summary = crate::gardener::run_gardener_after_successful_project_ingestion(
            &conn,
            &runtime,
            "srcsys_1",
            "TEST",
            "2026-01-01T00:00:00Z",
        );

        assert!(
            !matches!(summary.status, GardenerRunStatus::Failed),
            "seam function must not return Failed for a healthy run"
        );

        let pending = list_pending_suggestions(&conn).expect("list");
        assert!(
            !pending.is_empty(),
            "reference engine should have created a pending suggestion via the seam"
        );
    }
}
