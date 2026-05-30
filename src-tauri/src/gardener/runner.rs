use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use rusqlite::Connection;

use crate::gardener::contract::{GardenerTrigger, GardenerDependency};
use crate::gardener::engine::{GardenerEngine, EngineRunContext};
use crate::gardener::errors::GardenerError;
use crate::gardener::repository::{self, SuggestionInsert, SuppressionKey};
use crate::gardener::settings::load_gardener_policy;

// ---------------------------------------------------------------------------
// GardenerRuntime — single-flight guard
// ---------------------------------------------------------------------------

#[derive(Default)]
pub struct GardenerRuntime {
    active: Mutex<HashSet<String>>,
}

impl GardenerRuntime {
    pub fn try_start(&self, engine_id: &str) -> bool {
        let mut set = self.active.lock().expect("lock poisoned");
        set.insert(engine_id.to_string())
    }

    pub fn finish(&self, engine_id: &str) {
        let mut set = self.active.lock().expect("lock poisoned");
        set.remove(engine_id);
    }
}

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ScheduledRunInput {
    pub source_id: Option<String>,
    pub project_key: Option<String>,
    pub cursor_kind: String,
    pub cursor_value: String,
    pub now: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct OnDemandRunInput {
    pub source_id: Option<String>,
    pub target_upstream_id: Option<String>,
    pub now: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum GardenerRunStatus {
    Complete,
    Partial,
    Skipped,
    Coalesced,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct GardenerRunSummary {
    pub trigger: GardenerTrigger,
    pub status: GardenerRunStatus,
    pub engines: Vec<EngineRunSummary>,
    pub safe_error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct EngineRunSummary {
    pub engine_id: String,
    pub status: GardenerRunStatus,
    pub scanned: u32,
    pub emitted: u32,
    pub suppressed: u32,
    pub coalesced: bool,
    pub safe_error: Option<String>,
}

// ---------------------------------------------------------------------------
// Dependency availability
// ---------------------------------------------------------------------------

pub struct DependencyAvailability {
    pub embeddings: bool,
    pub history: bool,
    pub ai_provider: bool,
}

impl DependencyAvailability {
    pub fn check(conn: &Connection) -> Self {
        let table_exists = |name: &str| -> bool {
            conn.query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?1",
                rusqlite::params![name],
                |r| r.get::<_, i64>(0),
            )
            .unwrap_or(0)
                > 0
        };
        Self {
            embeddings: table_exists("indexable_documents"),
            history: table_exists("ingestion_runs"),
            ai_provider: false,
        }
    }

    pub fn has(&self, dep: &GardenerDependency) -> bool {
        match dep {
            GardenerDependency::Embeddings => self.embeddings,
            GardenerDependency::History => self.history,
            GardenerDependency::AiProvider => self.ai_provider,
        }
    }
}

// ---------------------------------------------------------------------------
// Scheduled run
// ---------------------------------------------------------------------------

pub fn run_scheduled(
    conn: &Connection,
    runtime: &GardenerRuntime,
    engines: &[Arc<dyn GardenerEngine>],
    input: ScheduledRunInput,
) -> GardenerRunSummary {
    let policy = load_gardener_policy(conn)
        .unwrap_or_else(|_| crate::gardener::settings::GardenerPolicy::default_policy());
    let deps = DependencyAvailability::check(conn);
    let target = repository::latest_jira_work_item_for_scope(
        conn,
        input.source_id.as_deref(),
        None,
    )
    .unwrap_or(None);

    let mut engine_summaries = Vec::new();

    for engine in engines {
        let contract = engine.contract();
        let engine_id = contract.id.0.clone();

        // Check if engine accepts scheduled trigger
        if !contract
            .accepted_triggers
            .contains(&GardenerTrigger::Scheduled)
        {
            continue;
        }

        // Check policy: enabled and scheduled
        let ep = policy.engines.get(&engine_id);
        let enabled = ep.map(|p| p.enabled && p.scheduled).unwrap_or(false);
        if !enabled {
            engine_summaries.push(EngineRunSummary {
                engine_id,
                status: GardenerRunStatus::Skipped,
                scanned: 0,
                emitted: 0,
                suppressed: 0,
                coalesced: false,
                safe_error: Some("Engine is disabled.".into()),
            });
            continue;
        }

        // Check dependencies
        let missing_deps: Vec<_> = contract
            .dependencies
            .iter()
            .filter(|d| !deps.has(d))
            .collect();
        if !missing_deps.is_empty() {
            engine_summaries.push(EngineRunSummary {
                engine_id,
                status: GardenerRunStatus::Skipped,
                scanned: 0,
                emitted: 0,
                suppressed: 0,
                coalesced: false,
                safe_error: Some("Engine dependency not available.".into()),
            });
            continue;
        }

        // Single-flight check
        if !runtime.try_start(&engine_id) {
            engine_summaries.push(EngineRunSummary {
                engine_id,
                status: GardenerRunStatus::Coalesced,
                scanned: 0,
                emitted: 0,
                suppressed: 0,
                coalesced: true,
                safe_error: None,
            });
            continue;
        }

        // Build context
        let ctx = EngineRunContext {
            trigger: GardenerTrigger::Scheduled,
            source_id: input.source_id.clone(),
            target: target.clone(),
            now: input.now.clone(),
        };

        let summary = run_engine_pipeline(
            conn,
            engine.as_ref(),
            &contract,
            ctx,
            GardenerTrigger::Scheduled,
            &input.now,
        );

        runtime.finish(&engine_id);

        // Advance watermark only on success
        if matches!(summary.status, GardenerRunStatus::Complete) {
            if let Some(source_id) = &input.source_id {
                let _ = repository::advance_watermark(
                    conn,
                    &engine_id,
                    source_id,
                    &input.cursor_kind,
                    &input.cursor_value,
                    &input.now,
                );
            }
        }

        engine_summaries.push(summary);
    }

    let overall_status = compute_overall_status(&engine_summaries);
    GardenerRunSummary {
        trigger: GardenerTrigger::Scheduled,
        status: overall_status,
        engines: engine_summaries,
        safe_error: None,
    }
}

// ---------------------------------------------------------------------------
// On-demand run
// ---------------------------------------------------------------------------

pub fn run_on_demand(
    conn: &Connection,
    runtime: &GardenerRuntime,
    engines: &[Arc<dyn GardenerEngine>],
    engine_id_str: &str,
    input: OnDemandRunInput,
) -> GardenerRunSummary {
    let policy = load_gardener_policy(conn)
        .unwrap_or_else(|_| crate::gardener::settings::GardenerPolicy::default_policy());

    let engine = engines.iter().find(|e| e.contract().id.0 == engine_id_str);
    let Some(engine) = engine else {
        return GardenerRunSummary {
            trigger: GardenerTrigger::OnDemand,
            status: GardenerRunStatus::Failed,
            engines: vec![],
            safe_error: Some("Engine not found.".into()),
        };
    };

    let contract = engine.contract();
    let engine_id = contract.id.0.clone();

    // Check policy: enabled and on_demand
    let ep = policy.engines.get(&engine_id);
    let enabled = ep.map(|p| p.enabled && p.on_demand).unwrap_or(false);
    if !enabled {
        return GardenerRunSummary {
            trigger: GardenerTrigger::OnDemand,
            status: GardenerRunStatus::Skipped,
            engines: vec![EngineRunSummary {
                engine_id,
                status: GardenerRunStatus::Skipped,
                scanned: 0,
                emitted: 0,
                suppressed: 0,
                coalesced: false,
                safe_error: Some("Engine is disabled.".into()),
            }],
            safe_error: None,
        };
    }

    // Single-flight check
    if !runtime.try_start(&engine_id) {
        return GardenerRunSummary {
            trigger: GardenerTrigger::OnDemand,
            status: GardenerRunStatus::Coalesced,
            engines: vec![EngineRunSummary {
                engine_id,
                status: GardenerRunStatus::Coalesced,
                scanned: 0,
                emitted: 0,
                suppressed: 0,
                coalesced: true,
                safe_error: None,
            }],
            safe_error: None,
        };
    }

    let target = repository::latest_jira_work_item_for_scope(
        conn,
        input.source_id.as_deref(),
        input.target_upstream_id.as_deref(),
    )
    .unwrap_or(None);

    let ctx = EngineRunContext {
        trigger: GardenerTrigger::OnDemand,
        source_id: input.source_id.clone(),
        target,
        now: input.now.clone(),
    };

    let summary = run_engine_pipeline(
        conn,
        engine.as_ref(),
        &contract,
        ctx,
        GardenerTrigger::OnDemand,
        &input.now,
    );
    runtime.finish(&engine_id);

    let status = summary.status.clone();
    GardenerRunSummary {
        trigger: GardenerTrigger::OnDemand,
        status,
        engines: vec![summary],
        safe_error: None,
    }
}

// ---------------------------------------------------------------------------
// Internal: run one engine pipeline
// ---------------------------------------------------------------------------

fn run_engine_pipeline(
    conn: &Connection,
    engine: &dyn GardenerEngine,
    contract: &crate::gardener::contract::EngineContract,
    ctx: EngineRunContext,
    trigger: GardenerTrigger,
    now: &str,
) -> EngineRunSummary {
    let engine_id = contract.id.0.clone();
    let mut scanned = 0u32;
    let mut emitted = 0u32;
    let mut suppressed = 0u32;

    for stage in &contract.pipeline {
        // Scheduled sweeps skip expensive+gated stages
        if trigger == GardenerTrigger::Scheduled && stage.expensive && stage.gate.is_some() {
            continue;
        }

        // Run compute
        let output = match engine.compute(ctx.clone(), &stage.id) {
            Ok(o) => o,
            Err(e) => {
                return EngineRunSummary {
                    engine_id,
                    status: GardenerRunStatus::Failed,
                    scanned,
                    emitted,
                    suppressed,
                    coalesced: false,
                    safe_error: Some(e.safe_message()),
                };
            }
        };

        scanned += output.scanned;

        // Persist candidates
        for candidate in &output.candidates {
            let key_json = match repository::canonical_suppression_key_json(&candidate.suppression_key) {
                Ok(k) => k,
                Err(_) => continue,
            };

            // Consult suppression for scheduled runs
            if trigger == GardenerTrigger::Scheduled {
                let is_suppressed = repository::suppression_exists(
                    conn,
                    &engine_id,
                    &candidate.suppression_key,
                )
                .unwrap_or(false);
                if is_suppressed {
                    suppressed += 1;
                    continue;
                }
            }

            // Build a deterministic id: engine_id + first 32 chars of key_json
            let key_prefix = &key_json[..key_json.len().min(32)];
            let id = format!("{}_{}", engine_id, key_prefix);

            let insert = SuggestionInsert {
                id,
                engine_id: engine_id.clone(),
                category: contract.category.as_str().to_string(),
                action_id: candidate.action_id.clone(),
                source_id: ctx.source_id.clone(),
                target: candidate.target.clone(),
                suppression_key: candidate.suppression_key.clone(),
                confidence: candidate.confidence,
                title: candidate.title.clone(),
                rationale: candidate.rationale.clone(),
                payload_json: candidate.payload_json.clone(),
            };

            if repository::insert_or_supersede_pending(conn, &insert, now).is_ok() {
                emitted += 1;
            }
        }

        // If stage has a gate, stop pipeline
        if stage.gate.is_some() {
            break;
        }
    }

    EngineRunSummary {
        engine_id,
        status: GardenerRunStatus::Complete,
        scanned,
        emitted,
        suppressed,
        coalesced: false,
        safe_error: None,
    }
}

// ---------------------------------------------------------------------------
// Internal: compute overall status
// ---------------------------------------------------------------------------

fn compute_overall_status(summaries: &[EngineRunSummary]) -> GardenerRunStatus {
    if summaries.is_empty() {
        return GardenerRunStatus::Skipped;
    }
    let any_failed = summaries
        .iter()
        .any(|s| s.status == GardenerRunStatus::Failed);
    let all_skipped = summaries.iter().all(|s| {
        matches!(
            s.status,
            GardenerRunStatus::Skipped | GardenerRunStatus::Coalesced
        )
    });
    if any_failed && summaries.iter().any(|s| s.status == GardenerRunStatus::Complete) {
        GardenerRunStatus::Partial
    } else if any_failed {
        GardenerRunStatus::Failed
    } else if all_skipped {
        GardenerRunStatus::Skipped
    } else {
        GardenerRunStatus::Complete
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};
    use crate::db::open_in_memory;
    use crate::gardener::contract::{
        ApprovalPolicy, EngineCost, EngineContract, GardenerEngineId, GardenerTrigger,
        GatePolicy, PipelineStageSpec, RunPolicy, SuggestionCategory, SuppressionKeySpec,
    };
    use crate::gardener::engine::{EmittedSuggestion, EngineRunContext, GardenerEngine, StageOutput};
    use crate::gardener::errors::GardenerError;
    use crate::gardener::repository::{
        GardenerTarget, SuppressionInput, SuppressionKey, record_suppression,
        list_pending_suggestions, read_watermark,
    };
    use crate::issues::repository::{upsert_source_system, SourceSystemInput, upsert_work_item, WorkItemInput};
    use crate::issues::ids::stable_id;

    // -----------------------------------------------------------------------
    // Test helpers
    // -----------------------------------------------------------------------

    fn seed_work_item(conn: &Connection, source_system_id: &str, upstream_id: &str) {
        upsert_source_system(
            conn,
            "2026-01-01T00:00:00Z",
            &SourceSystemInput {
                id: source_system_id,
                kind: "jira",
                deployment_kind: None,
                display_name: "Test Jira",
                base_url: None,
                config_source_id: None,
            },
        )
        .expect("upsert source system");

        let id = stable_id("wi", &[source_system_id, "jira_issue", upstream_id]);
        upsert_work_item(
            conn,
            "2026-01-01T00:00:00Z",
            &WorkItemInput {
                id: &id,
                source_system_id,
                source_kind: "jira_issue",
                upstream_id,
                key: Some(upstream_id),
                url: None,
                title: "Test issue",
                body: None,
                state: "open",
                status_name: Some("In Progress"),
                resolution_name: None,
                priority_name: None,
                item_type: None,
                project_key: None,
                project_name: None,
                assignee_person_id: None,
                reporter_person_id: None,
                created_at_source: Some("2026-01-01T00:00:00Z"),
                updated_at_source: Some("2026-01-01T00:00:00Z"),
                resolved_at_source: None,
                due_at_source: None,
                raw_updated_hash: "hash1",
            },
        )
        .expect("upsert work item");
    }

    fn make_target(source_id: &str, upstream_id: &str) -> GardenerTarget {
        GardenerTarget {
            source_id: source_id.into(),
            source_kind: "jira_issue".into(),
            upstream_id: upstream_id.into(),
            display_key: upstream_id.into(),
            title: "Test issue".into(),
            status: Some("In Progress".into()),
            assignee: None,
            updated_at_source: Some("2026-01-01T00:00:00Z".into()),
        }
    }

    fn make_suppression_key(source_id: &str, upstream_id: &str) -> SuppressionKey {
        SuppressionKey::Issue {
            source_id: source_id.into(),
            source_kind: "jira_issue".into(),
            upstream_id: upstream_id.into(),
        }
    }

    // -----------------------------------------------------------------------
    // FakeEngine — single gated stage, emits one candidate
    // -----------------------------------------------------------------------

    struct FakeEngine {
        id: String,
        category: SuggestionCategory,
        dependencies: Vec<crate::gardener::contract::GardenerDependency>,
        stages: Vec<PipelineStageSpec>,
        /// Track which stage ids compute() was called with
        calls: Arc<Mutex<Vec<String>>>,
        /// Whether compute returns an error
        fail: bool,
    }

    impl FakeEngine {
        fn new(id: &str) -> Self {
            Self {
                id: id.into(),
                category: SuggestionCategory::Stale,
                dependencies: vec![],
                stages: vec![PipelineStageSpec {
                    id: "scan".into(),
                    display_name: "Scan".into(),
                    gate: Some(GatePolicy::HumanApproval),
                    expensive: false,
                }],
                calls: Arc::new(Mutex::new(vec![])),
                fail: false,
            }
        }

        fn with_stages(mut self, stages: Vec<PipelineStageSpec>) -> Self {
            self.stages = stages;
            self
        }

        fn with_dependencies(mut self, deps: Vec<crate::gardener::contract::GardenerDependency>) -> Self {
            self.dependencies = deps;
            self
        }

        fn with_fail(mut self) -> Self {
            self.fail = true;
            self
        }

        fn call_log(&self) -> Arc<Mutex<Vec<String>>> {
            Arc::clone(&self.calls)
        }
    }

    impl GardenerEngine for FakeEngine {
        fn contract(&self) -> EngineContract {
            EngineContract {
                id: GardenerEngineId(self.id.clone()),
                category: self.category,
                dependencies: self.dependencies.clone(),
                accepted_triggers: vec![GardenerTrigger::Scheduled, GardenerTrigger::OnDemand],
                pipeline: self.stages.clone(),
                approval_policy: ApprovalPolicy::HumanReviewRequired,
                suppression_key: SuppressionKeySpec::Issue,
                cost: EngineCost::Cheap,
                run_policy: RunPolicy::IncrementalSafe,
                emits: "stale_issue".into(),
            }
        }

        fn compute(&self, _ctx: EngineRunContext, stage_id: &str) -> Result<StageOutput, GardenerError> {
            self.calls.lock().unwrap().push(stage_id.to_string());

            if self.fail {
                return Err(GardenerError {
                    category: crate::gardener::errors::GardenerErrorCategory::PipelineStageFailed,
                    message: "Stage failed in test.".into(),
                });
            }

            let target = make_target("src-1", "UP-1");
            let candidate = EmittedSuggestion {
                action_id: "flag_stale".into(),
                suppression_key: make_suppression_key("src-1", "UP-1"),
                target,
                confidence: 80,
                title: "Stale issue".into(),
                status: Some("In Progress".into()),
                assignee: None,
                rationale: "No activity for 30 days.".into(),
                payload_json: serde_json::json!({}),
            };

            Ok(StageOutput {
                candidates: vec![candidate],
                scanned: 1,
            })
        }
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
    // Tests
    // -----------------------------------------------------------------------

    #[test]
    fn scheduled_run_persists_one_stage_gated_candidate_as_pending() {
        let conn = open_in_memory().unwrap();
        seed_work_item(&conn, "src-1", "UP-1");

        let engine: Arc<dyn GardenerEngine> = Arc::new(FakeEngine::new("reference"));
        let runtime = GardenerRuntime::default();

        let summary = run_scheduled(
            &conn,
            &runtime,
            &[engine],
            make_scheduled_input("src-1"),
        );

        assert_eq!(summary.status, GardenerRunStatus::Complete);
        assert_eq!(summary.engines.len(), 1);
        let es = &summary.engines[0];
        assert_eq!(es.emitted, 1, "one candidate should be emitted");
        assert_eq!(es.suppressed, 0);

        let pending = list_pending_suggestions(&conn).expect("list");
        assert_eq!(pending.len(), 1, "candidate should be persisted as pending");
        assert_eq!(pending[0].engine_id, "reference");
        assert_eq!(pending[0].state, "pending");
    }

    #[test]
    fn scheduled_run_consults_suppression_and_hides_candidate() {
        let conn = open_in_memory().unwrap();
        seed_work_item(&conn, "src-1", "UP-1");

        // Record a suppression for the key the fake engine will emit
        let key = make_suppression_key("src-1", "UP-1");
        record_suppression(
            &conn,
            &SuppressionInput {
                id: "sup-1".into(),
                engine_id: "reference".into(),
                key,
                reason: "already handled".into(),
            },
            "2026-01-01T00:00:00Z",
        )
        .expect("record suppression");

        let engine: Arc<dyn GardenerEngine> = Arc::new(FakeEngine::new("reference"));
        let runtime = GardenerRuntime::default();

        let summary = run_scheduled(
            &conn,
            &runtime,
            &[engine],
            make_scheduled_input("src-1"),
        );

        assert_eq!(summary.status, GardenerRunStatus::Complete);
        let es = &summary.engines[0];
        assert_eq!(es.emitted, 0, "suppressed candidate should not be emitted");
        assert_eq!(es.suppressed, 1, "suppressed counter should increment");

        let pending = list_pending_suggestions(&conn).expect("list");
        assert!(pending.is_empty(), "no pending suggestions should be persisted");
    }

    #[test]
    fn on_demand_bypasses_suppression() {
        let conn = open_in_memory().unwrap();
        seed_work_item(&conn, "src-1", "UP-1");

        // Record a suppression
        let key = make_suppression_key("src-1", "UP-1");
        record_suppression(
            &conn,
            &SuppressionInput {
                id: "sup-1".into(),
                engine_id: "reference".into(),
                key,
                reason: "handled".into(),
            },
            "2026-01-01T00:00:00Z",
        )
        .expect("record suppression");

        let engine: Arc<dyn GardenerEngine> = Arc::new(FakeEngine::new("reference"));
        let runtime = GardenerRuntime::default();

        let input = OnDemandRunInput {
            source_id: Some("src-1".into()),
            target_upstream_id: Some("UP-1".into()),
            now: "2026-01-01T00:00:00Z".into(),
        };
        let summary = run_on_demand(&conn, &runtime, &[engine], "reference", input);

        assert_eq!(summary.status, GardenerRunStatus::Complete);
        let es = &summary.engines[0];
        assert_eq!(es.emitted, 1, "on-demand bypasses suppression → candidate emitted");
        assert_eq!(es.suppressed, 0);

        let pending = list_pending_suggestions(&conn).expect("list");
        assert_eq!(pending.len(), 1);
    }

    #[test]
    fn single_flight_coalesces_second_trigger_for_same_engine() {
        let conn = open_in_memory().unwrap();
        seed_work_item(&conn, "src-1", "UP-1");

        let engine: Arc<dyn GardenerEngine> = Arc::new(FakeEngine::new("reference"));
        let runtime = GardenerRuntime::default();

        // Mark engine as already active
        let started = runtime.try_start("reference");
        assert!(started, "first try_start should succeed");

        // Now run scheduled — should coalesce
        let summary = run_scheduled(
            &conn,
            &runtime,
            &[engine],
            make_scheduled_input("src-1"),
        );

        assert_eq!(summary.status, GardenerRunStatus::Skipped, "all coalesced → skipped overall");
        let es = &summary.engines[0];
        assert_eq!(es.status, GardenerRunStatus::Coalesced);
        assert!(es.coalesced);

        // Clean up
        runtime.finish("reference");
    }

    #[test]
    fn missing_dependency_skips_only_that_engine() {
        let conn = open_in_memory().unwrap();
        seed_work_item(&conn, "src-1", "UP-1");

        // Store a policy that enables both engines
        {
            use crate::gardener::settings::{GardenerPolicy, EnginePolicy, GARDENER_POLICY_KEY};
            use crate::settings::shared::shared_settings_set;
            let mut policy = GardenerPolicy::default_policy();
            policy.engines.insert(
                "needs_embeddings".into(),
                EnginePolicy {
                    enabled: true,
                    scheduled: true,
                    on_demand: true,
                    generation_policy: None,
                    first_run_cap: None,
                    per_sweep_cap: None,
                },
            );
            let value = serde_json::to_value(&policy).unwrap();
            shared_settings_set(&conn, GARDENER_POLICY_KEY, &value).unwrap();
        }

        // Engine 1: requires AiProvider (always false in DependencyAvailability::check)
        let engine_with_dep: Arc<dyn GardenerEngine> = Arc::new(
            FakeEngine::new("needs_embeddings")
                .with_dependencies(vec![crate::gardener::contract::GardenerDependency::AiProvider]),
        );

        // Engine 2: no dependencies
        let engine_no_dep: Arc<dyn GardenerEngine> = Arc::new(FakeEngine::new("reference"));

        let runtime = GardenerRuntime::default();

        let summary = run_scheduled(
            &conn,
            &runtime,
            &[engine_with_dep, engine_no_dep],
            make_scheduled_input("src-1"),
        );

        // Overall should be partial or complete (one skipped, one succeeded)
        assert_ne!(summary.status, GardenerRunStatus::Failed);

        let skip_sum = summary.engines.iter().find(|e| e.engine_id == "needs_embeddings")
            .expect("should have summary for needs_embeddings");
        assert_eq!(skip_sum.status, GardenerRunStatus::Skipped);
        assert!(skip_sum.safe_error.as_deref().unwrap_or("").contains("dependency"));

        let ok_sum = summary.engines.iter().find(|e| e.engine_id == "reference")
            .expect("should have summary for reference");
        assert_eq!(ok_sum.status, GardenerRunStatus::Complete);
        assert_eq!(ok_sum.emitted, 1);
    }

    #[test]
    fn scheduled_run_skips_gated_expensive_second_stage() {
        let conn = open_in_memory().unwrap();
        seed_work_item(&conn, "src-1", "UP-1");

        // Stage 1: cheap, no gate → runs and continues
        // Stage 2: expensive + gated → skipped during scheduled sweep
        let stages = vec![
            PipelineStageSpec {
                id: "cheap_stage".into(),
                display_name: "Cheap Stage".into(),
                gate: None,
                expensive: false,
            },
            PipelineStageSpec {
                id: "expensive_gated".into(),
                display_name: "Expensive Gated Stage".into(),
                gate: Some(GatePolicy::HumanApproval),
                expensive: true,
            },
        ];

        // Need AutoCommit so that no-gate on first stage is valid
        struct MultiStageEngine {
            stages: Vec<PipelineStageSpec>,
            calls: Arc<Mutex<Vec<String>>>,
        }
        impl GardenerEngine for MultiStageEngine {
            fn contract(&self) -> EngineContract {
                EngineContract {
                    id: GardenerEngineId("reference".into()),
                    category: SuggestionCategory::Stale,
                    dependencies: vec![],
                    accepted_triggers: vec![GardenerTrigger::Scheduled, GardenerTrigger::OnDemand],
                    pipeline: self.stages.clone(),
                    approval_policy: ApprovalPolicy::AutoCommit,
                    suppression_key: SuppressionKeySpec::Issue,
                    cost: EngineCost::Cheap,
                    run_policy: RunPolicy::IncrementalSafe,
                    emits: "stale_issue".into(),
                }
            }
            fn compute(&self, _ctx: EngineRunContext, stage_id: &str) -> Result<StageOutput, GardenerError> {
                self.calls.lock().unwrap().push(stage_id.to_string());
                Ok(StageOutput { candidates: vec![], scanned: 1 })
            }
        }

        let calls = Arc::new(Mutex::new(vec![]));
        let engine: Arc<dyn GardenerEngine> = Arc::new(MultiStageEngine {
            stages,
            calls: Arc::clone(&calls),
        });

        let runtime = GardenerRuntime::default();
        let summary = run_scheduled(
            &conn,
            &runtime,
            &[engine],
            make_scheduled_input("src-1"),
        );

        assert_eq!(summary.status, GardenerRunStatus::Complete);
        let called = calls.lock().unwrap().clone();
        assert!(
            called.contains(&"cheap_stage".to_string()),
            "cheap stage should run"
        );
        assert!(
            !called.contains(&"expensive_gated".to_string()),
            "expensive+gated stage must NOT run during scheduled sweep"
        );
    }

    #[test]
    fn watermark_advances_after_success_not_after_failure() {
        let conn = open_in_memory().unwrap();
        seed_work_item(&conn, "src-1", "UP-1");

        let success_engine: Arc<dyn GardenerEngine> = Arc::new(FakeEngine::new("reference"));
        let failure_engine: Arc<dyn GardenerEngine> = Arc::new(FakeEngine::new("duplicate").with_fail());

        let runtime = GardenerRuntime::default();
        let input = ScheduledRunInput {
            source_id: Some("src-1".into()),
            project_key: None,
            cursor_kind: "updated_at".into(),
            cursor_value: "2026-01-01T12:00:00Z".into(),
            now: "2026-01-01T12:00:00Z".into(),
        };

        let summary = run_scheduled(
            &conn,
            &runtime,
            &[success_engine, failure_engine],
            input,
        );

        // Overall should be partial (one success, one failure)
        assert_eq!(summary.status, GardenerRunStatus::Partial);

        // Watermark should exist for reference (success)
        let wm = read_watermark(&conn, "reference", "src-1", "updated_at").expect("read wm");
        assert_eq!(wm.as_deref(), Some("2026-01-01T12:00:00Z"), "watermark should advance for success");

        // Watermark should NOT exist for duplicate (failure)
        let wm_fail = read_watermark(&conn, "duplicate", "src-1", "updated_at").expect("read wm fail");
        assert!(wm_fail.is_none(), "watermark must not advance after failure");
    }
}
