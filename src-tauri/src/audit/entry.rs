use serde::{Deserialize, Serialize};
use specta::Type;

use crate::commands::JsonValue;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct AuditState(pub JsonValue);

impl AuditState {
    pub fn new(value: serde_json::Value) -> Result<Self, crate::audit::errors::AuditError> {
        if !value.is_object() {
            return Err(crate::audit::errors::AuditError::InvalidInput(
                "audit state must be a JSON object",
            ));
        }
        Ok(Self(JsonValue(value)))
    }

    pub fn value(&self) -> &serde_json::Value {
        &self.0 .0
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct AuditLogEntry {
    pub id: String,
    pub batch_id: String,
    pub action_id: String,
    pub target_ref: String,
    pub before_state: AuditState,
    pub after_state: AuditState,
    pub reversible: bool,
    pub reverted_at: Option<String>,
    pub reverted_by_action_id: Option<String>,
    pub created_at: String,
    pub source_feature: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct AuditLogAppendInput {
    pub id: Option<String>,
    pub batch_id: String,
    pub action_id: String,
    pub target_ref: String,
    pub before_state: AuditState,
    pub after_state: AuditState,
    pub reversible: bool,
    pub created_at: Option<String>,
    pub source_feature: String,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, Type)]
pub struct AuditLogListFilter {
    pub batch_id: Option<String>,
    pub target_ref: Option<String>,
    pub reversible: Option<bool>,
    pub created_from: Option<String>,
    pub created_to: Option<String>,
    pub newest_first: Option<bool>,
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct AuditLogMarkRevertedInput {
    pub id: String,
    pub reverted_by_action_id: String,
    pub reverted_at: Option<String>,
}
