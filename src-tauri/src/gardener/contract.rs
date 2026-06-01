use crate::gardener::errors::{GardenerError, GardenerErrorCategory};
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct GardenerEngineId(pub String);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum SuggestionCategory {
    Duplicate,
    Stale,
    Enrichment,
}

impl SuggestionCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            SuggestionCategory::Duplicate => "duplicate",
            SuggestionCategory::Stale => "stale",
            SuggestionCategory::Enrichment => "enrichment",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum GardenerTrigger {
    Scheduled,
    OnDemand,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum GardenerDependency {
    Embeddings,
    History,
    AiProvider,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct PipelineStageSpec {
    pub id: String,
    pub display_name: String,
    pub gate: Option<GatePolicy>,
    pub expensive: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum GatePolicy {
    HumanApproval,
    HumanConfirmation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalPolicy {
    HumanReviewRequired,
    AutoCommit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum SuppressionKeySpec {
    Issue,
    Pair,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum EngineCost {
    Cheap,
    Expensive,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum RunPolicy {
    IncrementalSafe,
    FullSweepRequired,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct EngineContract {
    pub id: GardenerEngineId,
    pub category: SuggestionCategory,
    pub dependencies: Vec<GardenerDependency>,
    pub accepted_triggers: Vec<GardenerTrigger>,
    pub pipeline: Vec<PipelineStageSpec>,
    pub approval_policy: ApprovalPolicy,
    pub suppression_key: SuppressionKeySpec,
    pub cost: EngineCost,
    pub run_policy: RunPolicy,
    pub emits: String,
}

pub fn validate_contract(contract: &EngineContract) -> Result<(), GardenerError> {
    // id.0 must be non-empty, lowercase ASCII, only a-z/0-9/_/-
    let id = &contract.id.0;
    if id.is_empty() {
        return Err(GardenerError {
            category: GardenerErrorCategory::InvalidEngineContract,
            message: "Engine id must not be empty.".into(),
        });
    }
    for ch in id.chars() {
        if !matches!(ch, 'a'..='z' | '0'..='9' | '_' | '-') {
            return Err(GardenerError {
                category: GardenerErrorCategory::InvalidEngineContract,
                message: format!(
                    "Engine id '{}' must use only lowercase letters, digits, underscores, or hyphens.",
                    id
                ),
            });
        }
    }

    // accepted_triggers must be non-empty
    if contract.accepted_triggers.is_empty() {
        return Err(GardenerError {
            category: GardenerErrorCategory::InvalidEngineContract,
            message: "Engine must accept at least one trigger.".into(),
        });
    }

    // pipeline must be non-empty
    if contract.pipeline.is_empty() {
        return Err(GardenerError {
            category: GardenerErrorCategory::InvalidEngineContract,
            message: "Engine pipeline must have at least one stage.".into(),
        });
    }

    // stage ids must be non-empty and unique
    let mut seen_stage_ids = std::collections::HashSet::new();
    for stage in &contract.pipeline {
        if stage.id.is_empty() {
            return Err(GardenerError {
                category: GardenerErrorCategory::InvalidEngineContract,
                message: "All pipeline stage ids must be non-empty.".into(),
            });
        }
        if !seen_stage_ids.insert(stage.id.clone()) {
            return Err(GardenerError {
                category: GardenerErrorCategory::InvalidEngineContract,
                message: format!("Pipeline stage id '{}' is duplicated.", stage.id),
            });
        }
    }

    // if approval_policy == HumanReviewRequired, must have at least one gate
    if contract.approval_policy == ApprovalPolicy::HumanReviewRequired {
        let has_gate = contract.pipeline.iter().any(|s| s.gate.is_some());
        if !has_gate {
            return Err(GardenerError {
                category: GardenerErrorCategory::InvalidEngineContract,
                message:
                    "Engine with HumanReviewRequired approval must have at least one gated stage."
                        .into(),
            });
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_contract() -> EngineContract {
        EngineContract {
            id: GardenerEngineId("reference".into()),
            category: SuggestionCategory::Stale,
            dependencies: vec![],
            accepted_triggers: vec![GardenerTrigger::Scheduled, GardenerTrigger::OnDemand],
            pipeline: vec![PipelineStageSpec {
                id: "scan".into(),
                display_name: "Scan issues".into(),
                gate: Some(GatePolicy::HumanApproval),
                expensive: false,
            }],
            approval_policy: ApprovalPolicy::HumanReviewRequired,
            suppression_key: SuppressionKeySpec::Issue,
            cost: EngineCost::Cheap,
            run_policy: RunPolicy::IncrementalSafe,
            emits: "stale_issue".into(),
        }
    }

    #[test]
    fn valid_contract_passes() {
        assert!(validate_contract(&valid_contract()).is_ok());
    }

    #[test]
    fn empty_id_fails() {
        let mut c = valid_contract();
        c.id = GardenerEngineId("".into());
        let err = validate_contract(&c).unwrap_err();
        assert_eq!(err.category, GardenerErrorCategory::InvalidEngineContract);
        assert!(err.message.contains("empty"));
    }

    #[test]
    fn uppercase_id_fails() {
        let mut c = valid_contract();
        c.id = GardenerEngineId("MyEngine".into());
        let err = validate_contract(&c).unwrap_err();
        assert_eq!(err.category, GardenerErrorCategory::InvalidEngineContract);
    }

    #[test]
    fn id_with_space_fails() {
        let mut c = valid_contract();
        c.id = GardenerEngineId("my engine".into());
        let err = validate_contract(&c).unwrap_err();
        assert_eq!(err.category, GardenerErrorCategory::InvalidEngineContract);
    }

    #[test]
    fn id_with_allowed_chars_passes() {
        let mut c = valid_contract();
        c.id = GardenerEngineId("my-engine_v2".into());
        assert!(validate_contract(&c).is_ok());
    }

    #[test]
    fn empty_accepted_triggers_fails() {
        let mut c = valid_contract();
        c.accepted_triggers = vec![];
        let err = validate_contract(&c).unwrap_err();
        assert_eq!(err.category, GardenerErrorCategory::InvalidEngineContract);
        assert!(err.message.contains("trigger"));
    }

    #[test]
    fn empty_pipeline_fails() {
        let mut c = valid_contract();
        c.pipeline = vec![];
        let err = validate_contract(&c).unwrap_err();
        assert_eq!(err.category, GardenerErrorCategory::InvalidEngineContract);
        assert!(err.message.contains("stage"));
    }

    #[test]
    fn duplicate_stage_ids_fail() {
        let mut c = valid_contract();
        c.pipeline = vec![
            PipelineStageSpec {
                id: "stage1".into(),
                display_name: "Stage 1".into(),
                gate: None,
                expensive: false,
            },
            PipelineStageSpec {
                id: "stage1".into(),
                display_name: "Stage 1 again".into(),
                gate: None,
                expensive: false,
            },
        ];
        let err = validate_contract(&c).unwrap_err();
        assert_eq!(err.category, GardenerErrorCategory::InvalidEngineContract);
        assert!(err.message.contains("stage1"));
    }

    #[test]
    fn empty_stage_id_fails() {
        let mut c = valid_contract();
        c.pipeline = vec![PipelineStageSpec {
            id: "".into(),
            display_name: "No id".into(),
            gate: None,
            expensive: false,
        }];
        let err = validate_contract(&c).unwrap_err();
        assert_eq!(err.category, GardenerErrorCategory::InvalidEngineContract);
    }

    #[test]
    fn human_review_required_without_gate_fails() {
        let mut c = valid_contract();
        c.approval_policy = ApprovalPolicy::HumanReviewRequired;
        c.pipeline = vec![PipelineStageSpec {
            id: "scan".into(),
            display_name: "Scan".into(),
            gate: None, // no gate!
            expensive: false,
        }];
        let err = validate_contract(&c).unwrap_err();
        assert_eq!(err.category, GardenerErrorCategory::InvalidEngineContract);
        assert!(err.message.contains("gate"));
    }

    #[test]
    fn human_review_required_with_gate_passes() {
        let mut c = valid_contract();
        c.approval_policy = ApprovalPolicy::HumanReviewRequired;
        c.pipeline = vec![PipelineStageSpec {
            id: "scan".into(),
            display_name: "Scan".into(),
            gate: Some(GatePolicy::HumanApproval),
            expensive: false,
        }];
        assert!(validate_contract(&c).is_ok());
    }

    #[test]
    fn auto_commit_without_gate_passes() {
        let mut c = valid_contract();
        c.approval_policy = ApprovalPolicy::AutoCommit;
        c.pipeline = vec![PipelineStageSpec {
            id: "scan".into(),
            display_name: "Scan".into(),
            gate: None,
            expensive: false,
        }];
        assert!(validate_contract(&c).is_ok());
    }
}
