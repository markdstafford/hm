use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct MutationCommonInput {
    pub source_id: String,
    pub issue_key: String,
    pub source_feature: Option<String>,
    pub batch_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct ReverseCommonInput {
    pub source_id: String,
    pub audit_entry_id: String,
    pub source_feature: Option<String>,
    pub batch_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct JiraUpdateTitleInput {
    pub common: MutationCommonInput,
    pub before_title: String,
    pub after_title: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct JiraUpdateLabelsInput {
    pub common: MutationCommonInput,
    pub before_labels: Vec<String>,
    pub after_labels: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct JiraReassignInput {
    pub common: MutationCommonInput,
    pub before_assignee_account_id: Option<String>,
    pub after_assignee_account_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct JiraCloseIssueInput {
    pub common: MutationCommonInput,
    pub transition_id: String,
    pub inverse_transition_id: Option<String>,
    pub before_status: String,
    pub after_status: String,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct JiraLinkAsDuplicateInput {
    pub common: MutationCommonInput,
    pub target_issue_key: String,
    pub link_type: String,
    pub close_transition_id: Option<String>,
    pub inverse_transition_id: Option<String>,
    pub before_status: Option<String>,
    pub after_status: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct JiraAddCommentInput {
    pub common: MutationCommonInput,
    pub body: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct JiraReverseMutationInput {
    pub common: ReverseCommonInput,
}

pub fn source_feature_or_manual(feature: Option<String>) -> String {
    feature.unwrap_or_else(|| "manual".to_string())
}

pub fn target_ref(issue_key: &str) -> String {
    format!("jira:{issue_key}")
}

pub fn audit_state(value: serde_json::Value) -> crate::audit::entry::AuditState {
    crate::audit::entry::AuditState::new(value)
        .unwrap_or_else(|_| crate::audit::entry::AuditState::new(serde_json::json!({})).unwrap())
}
