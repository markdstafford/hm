use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub enum GardenerErrorCategory {
    InvalidEngineContract,
    DisabledEngine,
    MissingDependency,
    InvalidTransition,
    Database,
    PipelineStageFailed,
    SuppressionKeyInvalid,
    Settings,
    NotFound,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct GardenerError {
    pub category: GardenerErrorCategory,
    pub message: String,
}

impl GardenerError {
    pub fn database() -> Self {
        Self {
            category: GardenerErrorCategory::Database,
            message: "Could not access gardener storage.".into(),
        }
    }
    pub fn invalid_transition(from: &str, to: &str) -> Self {
        Self {
            category: GardenerErrorCategory::InvalidTransition,
            message: format!("Suggestion cannot transition from {from} to {to}."),
        }
    }
    pub fn safe_message(&self) -> String {
        self.message.clone()
    }
}

impl std::fmt::Display for GardenerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}
impl std::error::Error for GardenerError {}
