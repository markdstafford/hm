use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

pub const JIRA_CLOSE_ISSUE: &str = "jira-close-issue";
pub const JIRA_LINK_AS_DUPLICATE: &str = "jira-link-as-duplicate";
pub const JIRA_UPDATE_TITLE: &str = "jira-update-title";
pub const JIRA_UPDATE_LABELS: &str = "jira-update-labels";
pub const JIRA_REASSIGN: &str = "jira-reassign";
pub const JIRA_ADD_COMMENT: &str = "jira-add-comment";

pub struct ActionMetadata {
    pub action_id: &'static str,
    pub reversible: bool,
}

pub fn action_metadata(action_id: &str) -> Option<ActionMetadata> {
    match action_id {
        JIRA_CLOSE_ISSUE => Some(ActionMetadata {
            action_id: JIRA_CLOSE_ISSUE,
            reversible: true,
        }),
        JIRA_LINK_AS_DUPLICATE => Some(ActionMetadata {
            action_id: JIRA_LINK_AS_DUPLICATE,
            reversible: true,
        }),
        JIRA_UPDATE_TITLE => Some(ActionMetadata {
            action_id: JIRA_UPDATE_TITLE,
            reversible: true,
        }),
        JIRA_UPDATE_LABELS => Some(ActionMetadata {
            action_id: JIRA_UPDATE_LABELS,
            reversible: true,
        }),
        JIRA_REASSIGN => Some(ActionMetadata {
            action_id: JIRA_REASSIGN,
            reversible: true,
        }),
        JIRA_ADD_COMMENT => Some(ActionMetadata {
            action_id: JIRA_ADD_COMMENT,
            reversible: false,
        }),
        _ => None,
    }
}

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn unique_suffix() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let count = COUNTER.fetch_add(1, Ordering::SeqCst);
    format!("{nanos}_{count}")
}

pub fn new_audit_id() -> String {
    format!("audit_{}", unique_suffix())
}

pub fn new_batch_id() -> String {
    format!("batch_{}", unique_suffix())
}

pub fn batch_or_new(batch_id: Option<String>) -> String {
    batch_id.unwrap_or_else(new_batch_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_declares_expected_action_reversibility() {
        assert!(action_metadata(JIRA_CLOSE_ISSUE).unwrap().reversible);
        assert!(action_metadata(JIRA_LINK_AS_DUPLICATE).unwrap().reversible);
        assert!(action_metadata(JIRA_UPDATE_TITLE).unwrap().reversible);
        assert!(action_metadata(JIRA_UPDATE_LABELS).unwrap().reversible);
        assert!(action_metadata(JIRA_REASSIGN).unwrap().reversible);
        assert!(!action_metadata(JIRA_ADD_COMMENT).unwrap().reversible);
    }

    #[test]
    fn generated_ids_have_expected_prefixes_and_are_unique() {
        let a = new_audit_id();
        let b = new_audit_id();
        let batch = new_batch_id();
        assert!(a.starts_with("audit_"));
        assert!(batch.starts_with("batch_"));
        assert_ne!(a, b);
    }
}
