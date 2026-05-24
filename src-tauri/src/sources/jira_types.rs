use serde::{Deserialize, Serialize};

// ── Jira response types ────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraIssue {
    pub id: String,
    pub key: String,
    #[serde(rename = "self", default)]
    pub self_url: Option<String>,
    #[serde(default)]
    pub fields: JiraIssueFields,
    #[serde(default)]
    pub changelog: Option<JiraChangelogPage>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct JiraIssueFields {
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(rename = "issuetype", default)]
    pub issue_type: Option<JiraNamedValue>,
    #[serde(default)]
    pub status: Option<JiraNamedValue>,
    #[serde(default)]
    pub priority: Option<JiraNamedValue>,
    #[serde(default)]
    pub assignee: Option<JiraUser>,
    #[serde(default)]
    pub reporter: Option<JiraUser>,
    #[serde(default)]
    pub project: Option<JiraProject>,
    #[serde(default)]
    pub created: Option<String>,
    #[serde(default)]
    pub updated: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraSearchPage {
    #[serde(rename = "startAt")]
    pub start_at: u32,
    #[serde(rename = "maxResults")]
    pub max_results: u32,
    #[serde(default)]
    pub total: Option<u32>,
    #[serde(default)]
    pub issues: Vec<JiraIssue>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraChangelogPage {
    #[serde(rename = "startAt")]
    pub start_at: u32,
    #[serde(rename = "maxResults")]
    pub max_results: u32,
    #[serde(default)]
    pub total: Option<u32>,
    #[serde(default)]
    pub histories: Vec<JiraChangelogEntry>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraChangelogEntry {
    pub id: String,
    #[serde(default)]
    pub author: Option<JiraUser>,
    pub created: String,
    #[serde(default)]
    pub items: Vec<JiraChangelogItem>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraChangelogItem {
    pub field: String,
    #[serde(default)]
    pub fieldtype: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(rename = "fromString", default)]
    pub from_string: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
    #[serde(rename = "toString", default)]
    pub to_string: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JiraProject {
    #[serde(default)]
    pub id: Option<String>,
    pub key: String,
    pub name: String,
    #[serde(rename = "self", default)]
    pub self_url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JiraUser {
    #[serde(rename = "accountId", default)]
    pub account_id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub key: Option<String>,
    #[serde(rename = "displayName", default)]
    pub display_name: Option<String>,
    #[serde(rename = "emailAddress", default)]
    pub email_address: Option<String>,
    #[serde(default)]
    pub active: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JiraNamedValue {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
}

// ── Tests ──────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_issue_with_embedded_changelog_fixture() {
        let issue: JiraIssue =
            serde_json::from_str(include_str!("fixtures/jira_issue_with_changelog.json")).unwrap();
        assert_eq!(issue.id, "20001");
        assert_eq!(issue.key, "HM-1");
        assert_eq!(
            issue.fields.summary.as_deref(),
            Some("Synthetic issue with changelog")
        );
        assert_eq!(
            issue.fields.issue_type.as_ref().unwrap().name.as_deref(),
            Some("Task")
        );
        let cl = issue.changelog.as_ref().unwrap();
        assert_eq!(cl.histories.len(), 1);
        assert_eq!(cl.histories[0].items[0].field, "status");
        assert_eq!(cl.histories[0].items[0].from_string.as_deref(), Some("Open"));
        assert_eq!(
            cl.histories[0].items[0].to_string.as_deref(),
            Some("In Progress")
        );
    }

    #[test]
    fn parses_search_changelog_and_project_fixtures() {
        let search: JiraSearchPage =
            serde_json::from_str(include_str!("fixtures/jira_search_page.json")).unwrap();
        assert_eq!(search.start_at, 0);
        assert_eq!(search.max_results, 2);
        assert_eq!(search.total, Some(3));
        assert_eq!(search.issues.len(), 2);
        assert_eq!(search.issues[0].key, "HM-1");
        assert_eq!(
            search.issues[0].fields.assignee.as_ref().unwrap().display_name.as_deref(),
            Some("Elena Example")
        );

        let changelog: JiraChangelogPage =
            serde_json::from_str(include_str!("fixtures/jira_changelog_page.json")).unwrap();
        assert_eq!(changelog.histories.len(), 2);
        assert_eq!(
            changelog.histories[0].author.as_ref().unwrap().display_name.as_deref(),
            Some("Elena Example")
        );
        // Second entry has no author
        assert!(changelog.histories[1].author.is_none());

        let projects: Vec<JiraProject> =
            serde_json::from_str(include_str!("fixtures/jira_projects.json")).unwrap();
        assert_eq!(projects.len(), 2);
        assert_eq!(
            projects.iter().map(|p| p.key.as_str()).collect::<Vec<_>>(),
            vec!["HM", "OPS"]
        );
    }

    #[test]
    fn user_identity_fields_are_optional() {
        let user: JiraUser =
            serde_json::from_value(serde_json::json!({ "displayName": "Synthetic User" }))
                .unwrap();
        assert_eq!(user.account_id, None);
        assert_eq!(user.name, None);
        assert_eq!(user.key, None);
        assert_eq!(user.display_name.as_deref(), Some("Synthetic User"));
        assert_eq!(user.email_address, None);
    }

    #[test]
    fn missing_required_issue_key_fails_decode() {
        let result: Result<JiraIssue, _> = serde_json::from_value(serde_json::json!({
            "id": "20001",
            "fields": {}
        }));
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(
            !err_msg.to_ascii_lowercase().contains("authorization"),
            "error contained auth: {err_msg}"
        );
    }

    #[test]
    fn issue_fields_tolerate_all_optional_subfields() {
        // Minimal issue: only id and key required
        let issue: JiraIssue = serde_json::from_value(serde_json::json!({
            "id": "99999",
            "key": "TEST-1",
            "fields": {}
        }))
        .unwrap();
        assert_eq!(issue.key, "TEST-1");
        assert!(issue.fields.summary.is_none());
        assert!(issue.fields.assignee.is_none());
        assert!(issue.changelog.is_none());
    }
}
