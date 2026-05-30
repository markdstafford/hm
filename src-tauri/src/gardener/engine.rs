use crate::gardener::contract::{EngineContract, GardenerTrigger};
use crate::gardener::errors::GardenerError;
use crate::gardener::repository::{GardenerTarget, SuppressionKey};

pub trait GardenerEngine: Send + Sync {
    fn contract(&self) -> EngineContract;
    fn compute(
        &self,
        context: EngineRunContext,
        stage_id: &str,
    ) -> Result<StageOutput, GardenerError>;
}

#[derive(Debug, Clone)]
pub struct EngineRunContext {
    pub trigger: GardenerTrigger,
    pub source_id: Option<String>,
    pub target: Option<GardenerTarget>,
    pub now: String,
}

#[derive(Debug, Clone, Default)]
pub struct StageOutput {
    pub candidates: Vec<EmittedSuggestion>,
    pub scanned: u32,
}

#[derive(Debug, Clone)]
pub struct EmittedSuggestion {
    pub action_id: String,
    pub suppression_key: SuppressionKey,
    pub target: GardenerTarget,
    pub confidence: u8,
    pub title: String,
    pub status: Option<String>,
    pub assignee: Option<String>,
    pub rationale: String,
    pub payload_json: serde_json::Value,
}
