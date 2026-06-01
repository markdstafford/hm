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
    #[serde(default)]
    pub resolution: Option<JiraNamedValue>,
    #[serde(rename = "resolutiondate", default)]
    pub resolution_date: Option<String>,
    #[serde(rename = "duedate", default)]
    pub due_date: Option<String>,
    #[serde(default)]
    pub labels: Vec<String>,
    #[serde(default)]
    pub components: Vec<JiraNamedValue>,
    #[serde(rename = "fixVersions", default)]
    pub fix_versions: Vec<JiraVersion>,
    #[serde(default)]
    pub subtasks: Vec<JiraSubtask>,
    #[serde(default)]
    pub watches: Option<JiraWatches>,
    #[serde(default)]
    pub votes: Option<JiraVotes>,
    #[serde(default)]
    pub comment: Option<JiraPagedComments>,
    #[serde(rename = "issuelinks", default)]
    pub issue_links: Vec<JiraIssueLink>,
    #[serde(default)]
    pub worklog: Option<JiraPagedWorklogs>,
    /// Captures everything else (custom fields, sprint, customer name, etc.) as raw JSON.
    #[serde(flatten)]
    pub raw_extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraVersion {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub released: Option<bool>,
    #[serde(default)]
    pub archived: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraSubtask {
    pub id: String,
    pub key: String,
    #[serde(default)]
    pub fields: JiraSubtaskFields,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct JiraSubtaskFields {
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub status: Option<JiraNamedValue>,
    #[serde(rename = "issuetype", default)]
    pub issue_type: Option<JiraNamedValue>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JiraWatches {
    #[serde(rename = "watchCount", default)]
    pub watch_count: u32,
    #[serde(rename = "isWatching", default)]
    pub is_watching: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JiraVotes {
    #[serde(default)]
    pub votes: u32,
    #[serde(rename = "hasVoted", default)]
    pub has_voted: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraPagedComments {
    #[serde(rename = "startAt", default)]
    pub start_at: u32,
    #[serde(rename = "maxResults", default)]
    pub max_results: u32,
    #[serde(default)]
    pub total: Option<u32>,
    #[serde(default)]
    pub comments: Vec<JiraComment>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraComment {
    pub id: String,
    #[serde(default)]
    pub author: Option<JiraUser>,
    #[serde(rename = "updateAuthor", default)]
    pub update_author: Option<JiraUser>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub visibility: Option<serde_json::Value>,
    #[serde(default)]
    pub created: Option<String>,
    #[serde(default)]
    pub updated: Option<String>,
    #[serde(flatten)]
    pub raw_extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraPagedWorklogs {
    #[serde(rename = "startAt", default)]
    pub start_at: u32,
    #[serde(rename = "maxResults", default)]
    pub max_results: u32,
    #[serde(default)]
    pub total: Option<u32>,
    #[serde(default)]
    pub worklogs: Vec<JiraWorklog>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraWorklog {
    pub id: String,
    #[serde(default)]
    pub author: Option<JiraUser>,
    #[serde(rename = "updateAuthor", default)]
    pub update_author: Option<JiraUser>,
    #[serde(default)]
    pub started: Option<String>,
    #[serde(rename = "timeSpentSeconds", default)]
    pub time_spent_seconds: Option<u64>,
    #[serde(default)]
    pub comment: Option<String>,
    #[serde(default)]
    pub created: Option<String>,
    #[serde(default)]
    pub updated: Option<String>,
    #[serde(flatten)]
    pub raw_extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraIssueLink {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(rename = "type", default)]
    pub type_: Option<JiraIssueLinkType>,
    #[serde(rename = "inwardIssue", default)]
    pub inward_issue: Option<JiraLinkedIssueRef>,
    #[serde(rename = "outwardIssue", default)]
    pub outward_issue: Option<JiraLinkedIssueRef>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JiraIssueLinkType {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub inward: Option<String>,
    #[serde(default)]
    pub outward: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraLinkedIssueRef {
    #[serde(default)]
    pub id: Option<String>,
    pub key: String,
    #[serde(default)]
    pub fields: Option<JiraLinkedIssueFields>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraLinkedIssueFields {
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub status: Option<JiraNamedValue>,
    #[serde(rename = "issuetype", default)]
    pub issue_type: Option<JiraNamedValue>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraRemoteLink {
    #[serde(default)]
    pub id: Option<u64>,
    #[serde(rename = "self", default)]
    pub self_url: Option<String>,
    #[serde(rename = "globalId", default)]
    pub global_id: Option<String>,
    #[serde(default)]
    pub relationship: Option<String>,
    #[serde(default)]
    pub object: Option<JiraRemoteLinkObject>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraRemoteLinkObject {
    pub url: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(flatten)]
    pub raw_extra: serde_json::Map<String, serde_json::Value>,
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraPagedProjects {
    #[serde(rename = "startAt", default)]
    pub start_at: u32,
    #[serde(rename = "maxResults", default)]
    pub max_results: u32,
    #[serde(default)]
    pub total: Option<u32>,
    #[serde(rename = "isLast", default)]
    pub is_last: Option<bool>,
    #[serde(default)]
    pub values: Vec<JiraProject>,
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

// ── Jira write request / response types ───────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraTransitionsResponse {
    #[serde(default)]
    pub transitions: Vec<JiraTransition>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraTransition {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub to: Option<JiraNamedValue>,
    #[serde(rename = "hasScreen", default)]
    pub has_screen: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraTransitionIssueRequest {
    pub transition: JiraTransitionRef,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub update: Option<JiraTransitionUpdate>,
}

impl JiraTransitionIssueRequest {
    pub fn new(transition_id: impl Into<String>, comment: Option<String>) -> Self {
        Self {
            transition: JiraTransitionRef {
                id: transition_id.into(),
            },
            update: comment.map(|body| JiraTransitionUpdate {
                comment: vec![JiraCommentUpdateOperation {
                    add: JiraCommentBody { body },
                }],
            }),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraTransitionRef {
    pub id: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraTransitionUpdate {
    pub comment: Vec<JiraCommentUpdateOperation>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraCommentUpdateOperation {
    pub add: JiraCommentBody,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraCommentBody {
    pub body: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraIssueFieldsUpdateRequest {
    pub fields: serde_json::Value,
}

impl JiraIssueFieldsUpdateRequest {
    pub fn new(fields: serde_json::Value) -> Result<Self, &'static str> {
        if !fields.is_object() {
            return Err("fields payload must be a JSON object");
        }
        Ok(Self { fields })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraCreateCommentRequest {
    pub body: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraCreatedComment {
    pub id: String,
    #[serde(rename = "self", default)]
    pub self_url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraCreateIssueLinkRequest {
    #[serde(rename = "type")]
    pub type_: JiraIssueLinkTypeName,
    #[serde(rename = "inwardIssue")]
    pub inward_issue: JiraIssueKeyRef,
    #[serde(rename = "outwardIssue")]
    pub outward_issue: JiraIssueKeyRef,
}

impl JiraCreateIssueLinkRequest {
    pub fn new(
        link_type: impl Into<String>,
        source_key: impl Into<String>,
        target_key: impl Into<String>,
    ) -> Self {
        Self {
            type_: JiraIssueLinkTypeName {
                name: link_type.into(),
            },
            inward_issue: JiraIssueKeyRef {
                key: source_key.into(),
            },
            outward_issue: JiraIssueKeyRef {
                key: target_key.into(),
            },
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraIssueLinkTypeName {
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraIssueKeyRef {
    pub key: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JiraCreatedIssueLink {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(rename = "self", default)]
    pub self_url: Option<String>,
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
        assert_eq!(
            cl.histories[0].items[0].from_string.as_deref(),
            Some("Open")
        );
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
            search.issues[0]
                .fields
                .assignee
                .as_ref()
                .unwrap()
                .display_name
                .as_deref(),
            Some("Elena Example")
        );

        let changelog: JiraChangelogPage =
            serde_json::from_str(include_str!("fixtures/jira_changelog_page.json")).unwrap();
        assert_eq!(changelog.histories.len(), 2);
        assert_eq!(
            changelog.histories[0]
                .author
                .as_ref()
                .unwrap()
                .display_name
                .as_deref(),
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
            serde_json::from_value(serde_json::json!({ "displayName": "Synthetic User" })).unwrap();
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
    fn parses_amp_search_page_fixture_with_custom_fields_and_inline_collections() {
        let page: JiraSearchPage =
            serde_json::from_str(include_str!("fixtures/jira_amp_search_page.json")).unwrap();
        assert_eq!(page.issues.len(), 2);

        let amp1 = &page.issues[0];
        assert_eq!(amp1.key, "AMP-1");
        assert_eq!(amp1.fields.labels, vec!["ingestion", "jira"]);

        let comments = amp1.fields.comment.as_ref().expect("comments present");
        assert_eq!(comments.total, Some(3));
        assert_eq!(comments.comments.len(), 2);

        assert_eq!(amp1.fields.issue_links.len(), 1);
        let outward = amp1.fields.issue_links[0]
            .outward_issue
            .as_ref()
            .expect("outward issue present");
        assert_eq!(outward.key, "AMP-9");

        let worklog = amp1.fields.worklog.as_ref().expect("worklog present");
        assert_eq!(worklog.total, Some(1));

        let parent_link = amp1
            .fields
            .raw_extra
            .get("customfield_14051")
            .expect("customfield_14051 retained in raw_extra");
        assert_eq!(parent_link.as_str(), Some("AMP-100"));

        assert_eq!(amp1.fields.subtasks.len(), 1);
        assert_eq!(amp1.fields.subtasks[0].key, "AMP-3");

        let watches = amp1.fields.watches.as_ref().expect("watches present");
        assert_eq!(watches.watch_count, 2);

        let votes = amp1.fields.votes.as_ref().expect("votes present");
        assert_eq!(votes.votes, 1);
    }

    #[test]
    fn parses_paginated_comments_fixture() {
        let comments: JiraPagedComments =
            serde_json::from_str(include_str!("fixtures/jira_comments_page.json")).unwrap();
        assert_eq!(comments.start_at, 2);
        assert_eq!(comments.total, Some(3));
        assert_eq!(comments.comments.len(), 1);
    }

    #[test]
    fn parses_paginated_worklogs_fixture() {
        let worklogs: JiraPagedWorklogs =
            serde_json::from_str(include_str!("fixtures/jira_worklogs_page.json")).unwrap();
        assert_eq!(worklogs.worklogs.len(), 1);
        assert_eq!(worklogs.worklogs[0].time_spent_seconds, Some(600));
    }

    #[test]
    fn unknown_custom_field_shapes_remain_in_raw_extra() {
        let issue: JiraIssue = serde_json::from_value(serde_json::json!({
            "id": "99",
            "key": "AMP-99",
            "fields": { "customfield_99999": [{ "weird": "shape" }] }
        }))
        .unwrap();
        assert!(issue.fields.raw_extra.contains_key("customfield_99999"));
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

    mod write_type_tests {
        use super::*;
        use serde_json::json;

        #[test]
        fn transitions_response_ignores_unknown_fields() {
            let parsed: JiraTransitionsResponse = serde_json::from_value(json!({
                "transitions": [
                    {"id": "31", "name": "Done", "to": {"id": "10003", "name": "Done"}, "hasScreen": false, "extra": "ignored"}
                ],
                "expand": "transitions"
            })).expect("transitions should deserialize");
            assert_eq!(parsed.transitions[0].id, "31");
            assert_eq!(
                parsed.transitions[0].to.as_ref().unwrap().name.as_deref(),
                Some("Done")
            );
        }

        #[test]
        fn transition_request_serializes_optional_comment_as_update_block() {
            let request =
                JiraTransitionIssueRequest::new("31", Some("Closing as stale".to_string()));
            let value = serde_json::to_value(request).expect("request should serialize");
            assert_eq!(value["transition"]["id"], "31");
            assert_eq!(
                value["update"]["comment"][0]["add"]["body"],
                "Closing as stale"
            );
        }

        #[test]
        fn field_update_payload_preserves_explicit_null_assignee() {
            let request = JiraIssueFieldsUpdateRequest::new(json!({
                "summary": "New title",
                "labels": ["triaged", "stale"],
                "assignee": null
            }))
            .expect("object fields payload should be accepted");
            let value = serde_json::to_value(request).expect("request should serialize");
            assert!(value["fields"]["assignee"].is_null());
        }

        #[test]
        fn issue_link_request_serializes_jira_data_center_shape() {
            let request = JiraCreateIssueLinkRequest::new("Duplicates", "AMP-1043", "AMP-997");
            let value = serde_json::to_value(request).expect("request should serialize");
            assert_eq!(value["type"]["name"], "Duplicates");
            assert_eq!(value["inwardIssue"]["key"], "AMP-1043");
            assert_eq!(value["outwardIssue"]["key"], "AMP-997");
        }
    }
}
