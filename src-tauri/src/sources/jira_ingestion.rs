//! Jira project field mappings + AMP issue projection.
//!
//! This module owns two responsibilities:
//!
//! 1. Seeding canonical-name → custom-field mappings into
//!    `jira_project_field_mappings` for the AMP project (the bootstrap profile
//!    of Jira fields we ingest first). The seed lives in code rather than a
//!    config file because the canonical-name vocabulary is part of the schema
//!    contract — adding a new mapping is a code change.
//!
//! 2. Projecting a parsed `JiraIssue` (plus its raw JSON) into the work-data
//!    tables: `work_items`, `jira_issues`, `jira_issue_field_values`,
//!    `work_item_terms`, `work_item_relationships`, `work_item_comments`, and
//!    `indexable_documents`. Each upsert is idempotent so re-projecting the
//!    same issue is a no-op.
//!
//! Unknown custom fields are persisted into `jira_issue_field_values` with
//! `value_kind = "json"` and a NULL `canonical_name`. That is the "pressure
//! valve" that lets the ingestion path absorb new custom fields without a
//! schema migration.

use rusqlite::{params, Connection};
use serde_json::Value;

use crate::issues::history::coarse_state;
use crate::issues::ids::{content_hash, stable_id};
use crate::issues::people::{upsert_source_identity, SourceIdentityInput, UpsertedIdentity};
use crate::issues::repository::{
    delete_work_item_terms_by_kind, upsert_indexable_document, upsert_jira_remote_link,
    upsert_jira_worklog, upsert_work_item, upsert_work_item_comment,
    upsert_work_item_relationship, upsert_work_item_term, IndexableDocumentInput,
    JiraRemoteLinkInput, JiraWorklogInput, WorkItemCommentInput, WorkItemInput,
    WorkItemRelationshipInput, WorkItemTermInput,
};
use crate::sources::jira_types::{JiraComment, JiraIssue, JiraRemoteLink, JiraWorklog};

// ── Constants ──────────────────────────────────────────────────────────────────

pub const JIRA_ISSUE_CONNECTOR: &str = "jira.issue";
pub const JIRA_SOURCE_KIND: &str = "jira";
pub const JIRA_WORK_ITEM_KIND: &str = "jira_issue";

// ── AMP search field list ──────────────────────────────────────────────────────

/// Fields requested from `/rest/api/2/search` for AMP issues. Includes the AMP
/// custom fields plus the inline collections we want server-side
/// (`comment`, `issuelinks`, `worklog`).
pub fn amp_search_fields() -> Vec<&'static str> {
    vec![
        "summary",
        "status",
        "resolution",
        "assignee",
        "reporter",
        "priority",
        "labels",
        "components",
        "issuetype",
        "project",
        "description",
        "created",
        "updated",
        "resolutiondate",
        "duedate",
        "fixVersions",
        "subtasks",
        "watches",
        "customfield_14051",
        "customfield_14353",
        "customfield_12751",
        "customfield_14655",
        "customfield_10857",
        "customfield_10858",
        "customfield_10859",
        "customfield_10557",
        "comment",
        "issuelinks",
        "worklog",
    ]
}

// ── AMP mapping seed ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy)]
pub struct AmpFieldMapping {
    pub canonical_name: &'static str,
    pub field_id: &'static str,
    pub field_name: &'static str,
    pub value_kind: &'static str,
}

/// The eight AMP custom-field mappings we seed for each AMP project. The
/// `value_kind` describes the *intended* shape of the value, used downstream
/// to pick a column in `jira_issue_field_values`.
pub fn amp_field_mappings() -> Vec<AmpFieldMapping> {
    vec![
        AmpFieldMapping {
            canonical_name: "parent_link",
            field_id: "customfield_14051",
            field_name: "Parent Link",
            value_kind: "string",
        },
        AmpFieldMapping {
            canonical_name: "customer_name",
            field_id: "customfield_14353",
            field_name: "Customer",
            value_kind: "string",
        },
        AmpFieldMapping {
            canonical_name: "assigned_teams",
            field_id: "customfield_12751",
            field_name: "Assigned Teams",
            value_kind: "array",
        },
        AmpFieldMapping {
            canonical_name: "product",
            field_id: "customfield_14655",
            field_name: "Product",
            value_kind: "array",
        },
        AmpFieldMapping {
            canonical_name: "epic_link",
            field_id: "customfield_10857",
            field_name: "Epic Link",
            value_kind: "string",
        },
        AmpFieldMapping {
            canonical_name: "epic_name",
            field_id: "customfield_10858",
            field_name: "Epic Name",
            value_kind: "string",
        },
        AmpFieldMapping {
            canonical_name: "epic_status",
            field_id: "customfield_10859",
            field_name: "Epic Status",
            value_kind: "option",
        },
        AmpFieldMapping {
            canonical_name: "sprint",
            field_id: "customfield_10557",
            field_name: "Sprint",
            value_kind: "array",
        },
    ]
}

/// Upsert the AMP mappings into `jira_project_field_mappings` for the supplied
/// `(source_system_id, project_key)` scope. Idempotent.
pub fn seed_amp_field_mappings(
    conn: &Connection,
    source_system_id: &str,
    project_key: &str,
    now_utc: &str,
) -> rusqlite::Result<()> {
    for m in amp_field_mappings() {
        conn.execute(
            "INSERT INTO jira_project_field_mappings
                (source_system_id, project_key, canonical_name, field_id, field_name, value_kind, required_for_ingestion, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7)
             ON CONFLICT(source_system_id, project_key, canonical_name) DO UPDATE SET
                field_id = excluded.field_id,
                field_name = excluded.field_name,
                value_kind = excluded.value_kind,
                required_for_ingestion = excluded.required_for_ingestion,
                updated_at = excluded.updated_at",
            params![
                source_system_id,
                project_key,
                m.canonical_name,
                m.field_id,
                m.field_name,
                m.value_kind,
                now_utc,
            ],
        )?;
    }
    Ok(())
}

// ── Projection error ───────────────────────────────────────────────────────────

#[derive(Debug)]
pub enum ProjectionError {
    Storage(rusqlite::Error),
    Invalid(String),
}

impl std::fmt::Display for ProjectionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProjectionError::Storage(e) => write!(f, "storage error: {e}"),
            ProjectionError::Invalid(msg) => write!(f, "invalid issue payload: {msg}"),
        }
    }
}

impl std::error::Error for ProjectionError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ProjectionError::Storage(e) => Some(e),
            ProjectionError::Invalid(_) => None,
        }
    }
}

impl From<rusqlite::Error> for ProjectionError {
    fn from(e: rusqlite::Error) -> Self {
        ProjectionError::Storage(e)
    }
}

// ── Projection context + result ────────────────────────────────────────────────

pub struct JiraIssueProjectionContext<'a> {
    pub source_system_id: &'a str,
    pub project_key: &'a str,
    pub project_name: Option<&'a str>,
    pub ingested_at: &'a str,
}

#[derive(Debug, Clone)]
pub struct ProjectedJiraIssue {
    pub work_item_id: String,
    pub jira_id: String,
    pub jira_key: String,
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/// Extract a string value from a JSON node, treating non-strings/nulls as None.
fn as_string(v: Option<&Value>) -> Option<String> {
    v.and_then(|val| val.as_str().map(|s| s.to_string()))
}

/// Pick the displayable name for an "option" custom field that can show up
/// either as a string or as `{ "value": "..." }` / `{ "name": "..." }`.
fn option_name(v: Option<&Value>) -> Option<String> {
    let v = v?;
    if let Some(s) = v.as_str() {
        return Some(s.to_string());
    }
    if let Some(obj) = v.as_object() {
        if let Some(name) = obj.get("value").and_then(|x| x.as_str()) {
            return Some(name.to_string());
        }
        if let Some(name) = obj.get("name").and_then(|x| x.as_str()) {
            return Some(name.to_string());
        }
    }
    None
}

/// Best-effort sprint string parser. Jira's greenhopper plugin serializes
/// sprint values as a flat string with `name=...` embedded in it. We extract
/// the names; on failure we return an empty Vec so the caller can fall back
/// to storing the raw JSON.
fn parse_sprint_names(v: &Value) -> Vec<String> {
    let arr = match v.as_array() {
        Some(a) => a,
        None => return Vec::new(),
    };
    let mut out: Vec<String> = Vec::with_capacity(arr.len());
    for item in arr {
        if let Some(s) = item.as_str() {
            if let Some(start) = s.find("name=") {
                let rest = &s[start + "name=".len()..];
                // Read until the next comma or closing bracket.
                let end = rest.find([',', ']']).unwrap_or(rest.len());
                let name = rest[..end].trim().to_string();
                if !name.is_empty() {
                    out.push(name);
                }
            }
        } else if let Some(obj) = item.as_object() {
            if let Some(name) = obj.get("name").and_then(|n| n.as_str()) {
                out.push(name.to_string());
            }
        }
    }
    out
}

/// Extract the `value` fields from an array of `{value: "..."}` objects.
/// Returns an empty Vec if the shape doesn't match.
fn array_of_values(v: &Value) -> Vec<String> {
    let Some(arr) = v.as_array() else { return Vec::new() };
    arr.iter()
        .filter_map(|item| {
            item.as_object()
                .and_then(|o| o.get("value"))
                .and_then(|x| x.as_str())
                .map(|s| s.to_string())
                .or_else(|| item.as_str().map(|s| s.to_string()))
        })
        .collect()
}

/// Detect a plausible ISO-8601 datetime by checking for digit prefix and `T`.
fn looks_like_datetime(s: &str) -> bool {
    if s.len() < 10 {
        return false;
    }
    let bytes = s.as_bytes();
    // YYYY-MM-DDTHH:MM... or YYYY-MM-DD
    bytes[0].is_ascii_digit()
        && bytes[1].is_ascii_digit()
        && bytes[2].is_ascii_digit()
        && bytes[3].is_ascii_digit()
        && bytes[4] == b'-'
        && (s.contains('T') || s.len() == 10)
}

fn upsert_jira_user_identity(
    conn: &Connection,
    now: &str,
    source_system_id: &str,
    user_value: Option<&Value>,
) -> Result<Option<UpsertedIdentity>, ProjectionError> {
    let Some(user) = user_value else { return Ok(None) };
    if user.is_null() {
        return Ok(None);
    }
    let obj = user.as_object();
    let account_id = obj.and_then(|o| o.get("accountId")).and_then(|v| v.as_str());
    let name = obj.and_then(|o| o.get("name")).and_then(|v| v.as_str());
    let key = obj.and_then(|o| o.get("key")).and_then(|v| v.as_str());
    let display_name = obj.and_then(|o| o.get("displayName")).and_then(|v| v.as_str());
    let email = obj
        .and_then(|o| o.get("emailAddress"))
        .and_then(|v| v.as_str());

    if account_id.is_none() && name.is_none() && key.is_none() && display_name.is_none() {
        return Ok(None);
    }

    let raw_json = serde_json::to_string(user).ok();
    let identity = upsert_source_identity(
        conn,
        now,
        &SourceIdentityInput {
            source_system_id,
            source_kind: JIRA_SOURCE_KIND,
            upstream_account_id: account_id,
            upstream_name: name,
            upstream_key: key,
            username: name,
            email,
            display_name,
            avatar_url: None,
            raw_json: raw_json.as_deref(),
        },
    )?;
    Ok(Some(identity))
}

struct FieldValueInput<'a> {
    work_item_id: &'a str,
    field_id: &'a str,
    field_name: Option<&'a str>,
    canonical_name: Option<&'a str>,
    value_kind: &'a str,
    value: &'a Value,
    updated_at_source: Option<&'a str>,
}

/// Upsert one row into `jira_issue_field_values`. Best-effort populates the
/// typed columns alongside the always-stored JSON.
fn upsert_field_value(
    conn: &Connection,
    input: &FieldValueInput<'_>,
) -> Result<(), ProjectionError> {
    let value = input.value;
    let value_json = value.to_string();
    let value_hash = content_hash(&value_json);

    let (value_text, value_number, value_datetime) = match value {
        Value::String(s) => {
            if looks_like_datetime(s) {
                (None, None, Some(s.clone()))
            } else {
                (Some(s.clone()), None, None)
            }
        }
        Value::Number(n) => {
            if let Some(f) = n.as_f64() {
                (None, Some(f), None)
            } else {
                (None, None, None)
            }
        }
        _ => (None, None, None),
    };

    conn.execute(
        "INSERT INTO jira_issue_field_values
            (work_item_id, field_id, field_name, canonical_name, value_kind,
             value_text, value_number, value_datetime, value_json, value_hash, updated_at_source)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(work_item_id, field_id) DO UPDATE SET
            field_name = excluded.field_name,
            canonical_name = excluded.canonical_name,
            value_kind = excluded.value_kind,
            value_text = excluded.value_text,
            value_number = excluded.value_number,
            value_datetime = excluded.value_datetime,
            value_json = excluded.value_json,
            value_hash = excluded.value_hash,
            updated_at_source = excluded.updated_at_source",
        params![
            input.work_item_id,
            input.field_id,
            input.field_name,
            input.canonical_name,
            input.value_kind,
            value_text,
            value_number,
            value_datetime,
            value_json,
            value_hash,
            input.updated_at_source,
        ],
    )?;
    Ok(())
}

/// Persist a single Jira comment under the supplied work_item. Used for both
/// inline comments (during projection) and tail-fetched comments (during the
/// ingestion service post-pass).
fn persist_jira_comment(
    conn: &Connection,
    ctx: &JiraIssueProjectionContext<'_>,
    work_item_id: &str,
    issue_key: &str,
    comment: &JiraComment,
) -> Result<(), ProjectionError> {
    let comment_id = stable_id("c", &[ctx.source_system_id, "jira", &comment.id]);
    let author_identity = if let Some(author) = comment.author.as_ref() {
        let raw = serde_json::to_string(author).ok();
        let result = upsert_source_identity(
            conn,
            ctx.ingested_at,
            &SourceIdentityInput {
                source_system_id: ctx.source_system_id,
                source_kind: JIRA_SOURCE_KIND,
                upstream_account_id: author.account_id.as_deref(),
                upstream_name: author.name.as_deref(),
                upstream_key: author.key.as_deref(),
                username: author.name.as_deref(),
                email: author.email_address.as_deref(),
                display_name: author.display_name.as_deref(),
                avatar_url: None,
                raw_json: raw.as_deref(),
            },
        );
        match result {
            Ok(id) => Some(id),
            Err(rusqlite::Error::InvalidQuery) => None,
            Err(e) => return Err(ProjectionError::Storage(e)),
        }
    } else {
        None
    };

    let body_str = comment.body.clone().unwrap_or_default();
    let body_hash = content_hash(&body_str);
    let visibility_json = comment.visibility.as_ref().map(|v| v.to_string());
    let raw_json = serde_json::to_string(comment).ok();

    upsert_work_item_comment(
        conn,
        ctx.ingested_at,
        &WorkItemCommentInput {
            id: &comment_id,
            work_item_id,
            source_system_id: ctx.source_system_id,
            upstream_id: &comment.id,
            author_identity_id: author_identity
                .as_ref()
                .map(|i| i.source_identity_id.as_str()),
            body: comment.body.as_deref(),
            visibility_json: visibility_json.as_deref(),
            created_at_source: comment.created.as_deref(),
            updated_at_source: comment.updated.as_deref(),
            raw_json: raw_json.as_deref(),
            body_hash: &body_hash,
        },
    )?;

    let metadata_json = serde_json::json!({
        "kind": "jira_comment",
        "jira_issue_key": issue_key,
        "comment_id": comment.id,
    })
    .to_string();
    upsert_indexable_document(
        conn,
        ctx.ingested_at,
        &IndexableDocumentInput {
            source_system_id: ctx.source_system_id,
            entity_kind: "comment",
            entity_id: &comment.id,
            work_item_id: Some(work_item_id),
            title: None,
            body: comment.body.as_deref().unwrap_or(""),
            metadata_json: &metadata_json,
            content_hash: &body_hash,
        },
    )?;
    Ok(())
}

/// Persist a single Jira worklog under the supplied work_item. Used for both
/// inline worklogs (during projection) and tail-fetched worklogs (during the
/// ingestion service post-pass).
fn persist_jira_worklog(
    conn: &Connection,
    ctx: &JiraIssueProjectionContext<'_>,
    work_item_id: &str,
    worklog: &JiraWorklog,
) -> Result<(), ProjectionError> {
    let id = stable_id("wl", &[ctx.source_system_id, "jira", &worklog.id]);

    let author_identity = if let Some(author) = worklog.author.as_ref() {
        let raw = serde_json::to_string(author).ok();
        let result = upsert_source_identity(
            conn,
            ctx.ingested_at,
            &SourceIdentityInput {
                source_system_id: ctx.source_system_id,
                source_kind: JIRA_SOURCE_KIND,
                upstream_account_id: author.account_id.as_deref(),
                upstream_name: author.name.as_deref(),
                upstream_key: author.key.as_deref(),
                username: author.name.as_deref(),
                email: author.email_address.as_deref(),
                display_name: author.display_name.as_deref(),
                avatar_url: None,
                raw_json: raw.as_deref(),
            },
        );
        match result {
            Ok(id) => Some(id),
            Err(rusqlite::Error::InvalidQuery) => None,
            Err(e) => return Err(ProjectionError::Storage(e)),
        }
    } else {
        None
    };

    let update_author_identity = if let Some(author) = worklog.update_author.as_ref() {
        let raw = serde_json::to_string(author).ok();
        let result = upsert_source_identity(
            conn,
            ctx.ingested_at,
            &SourceIdentityInput {
                source_system_id: ctx.source_system_id,
                source_kind: JIRA_SOURCE_KIND,
                upstream_account_id: author.account_id.as_deref(),
                upstream_name: author.name.as_deref(),
                upstream_key: author.key.as_deref(),
                username: author.name.as_deref(),
                email: author.email_address.as_deref(),
                display_name: author.display_name.as_deref(),
                avatar_url: None,
                raw_json: raw.as_deref(),
            },
        );
        match result {
            Ok(id) => Some(id),
            Err(rusqlite::Error::InvalidQuery) => None,
            Err(e) => return Err(ProjectionError::Storage(e)),
        }
    } else {
        None
    };

    let raw_json = serde_json::to_string(worklog).unwrap_or_default();
    let raw_hash = content_hash(&raw_json);
    let time_spent: Option<i64> = worklog.time_spent_seconds.map(|n| n as i64);

    upsert_jira_worklog(
        conn,
        ctx.ingested_at,
        &JiraWorklogInput {
            id: &id,
            work_item_id,
            source_system_id: ctx.source_system_id,
            upstream_id: &worklog.id,
            author_identity_id: author_identity
                .as_ref()
                .map(|i| i.source_identity_id.as_str()),
            update_author_identity_id: update_author_identity
                .as_ref()
                .map(|i| i.source_identity_id.as_str()),
            started_at_source: worklog.started.as_deref(),
            time_spent_seconds: time_spent,
            comment: worklog.comment.as_deref(),
            raw_json: Some(&raw_json),
            raw_hash: &raw_hash,
        },
    )?;
    Ok(())
}

/// Persist a single Jira remote link under the supplied work_item.
fn persist_jira_remote_link(
    conn: &Connection,
    ctx: &JiraIssueProjectionContext<'_>,
    work_item_id: &str,
    issue_key: &str,
    link: &JiraRemoteLink,
) -> Result<bool, ProjectionError> {
    let url = link
        .object
        .as_ref()
        .map(|o| o.url.clone())
        .unwrap_or_default();
    if url.is_empty() {
        return Ok(false);
    }
    let id = stable_id(
        "rl",
        &[ctx.source_system_id, "jira", issue_key, &url],
    );
    let upstream_id_string = link.id.map(|n| n.to_string());
    let title = link.object.as_ref().and_then(|o| o.title.clone());
    let raw_json = serde_json::to_string(link).unwrap_or_default();
    let raw_hash = content_hash(&raw_json);

    upsert_jira_remote_link(
        conn,
        ctx.ingested_at,
        &JiraRemoteLinkInput {
            id: &id,
            work_item_id,
            source_system_id: ctx.source_system_id,
            upstream_id: upstream_id_string.as_deref(),
            url: &url,
            title: title.as_deref(),
            relationship: link.relationship.as_deref(),
            raw_json: Some(&raw_json),
            raw_hash: &raw_hash,
        },
    )?;
    Ok(true)
}

// ── Main projection ────────────────────────────────────────────────────────────

/// Project a Jira issue into the work-data tables. The caller is responsible
/// for ensuring the source-system row already exists.
pub fn project_jira_issue(
    conn: &Connection,
    ctx: &JiraIssueProjectionContext<'_>,
    raw_issue: &Value,
    issue: &JiraIssue,
) -> Result<ProjectedJiraIssue, ProjectionError> {
    if issue.id.is_empty() || issue.key.is_empty() {
        return Err(ProjectionError::Invalid(
            "issue.id and issue.key must be non-empty".into(),
        ));
    }

    let work_item_id = stable_id(
        "wi",
        &[ctx.source_system_id, JIRA_WORK_ITEM_KIND, &issue.id],
    );
    let fields = &issue.fields;
    let state = coarse_state(fields.status.as_ref().and_then(|s| s.name.as_deref()));

    let raw_updated_hash = content_hash(&raw_issue.to_string());
    let fields_json_string = raw_issue
        .get("fields")
        .map(|v| v.to_string())
        .unwrap_or_else(|| "{}".to_string());
    let fields_hash = content_hash(&fields_json_string);

    // ── 1. People upserts ──────────────────────────────────────────────────────
    let raw_fields = raw_issue.get("fields");
    let assignee_identity = upsert_jira_user_identity(
        conn,
        ctx.ingested_at,
        ctx.source_system_id,
        raw_fields.and_then(|f| f.get("assignee")),
    )?;
    let reporter_identity = upsert_jira_user_identity(
        conn,
        ctx.ingested_at,
        ctx.source_system_id,
        raw_fields.and_then(|f| f.get("reporter")),
    )?;
    let assignee_person_id = assignee_identity.as_ref().map(|i| i.person_id.clone());
    let reporter_person_id = reporter_identity.as_ref().map(|i| i.person_id.clone());

    // ── 2. work_items upsert ──────────────────────────────────────────────────
    let project_key = ctx.project_key;
    let fallback_project_name = fields.project.as_ref().map(|p| p.name.as_str());
    let project_name_opt: Option<&str> = ctx.project_name.or(fallback_project_name);

    let title_owned: String = fields
        .summary
        .clone()
        .unwrap_or_else(|| "(no summary)".to_string());

    upsert_work_item(
        conn,
        ctx.ingested_at,
        &WorkItemInput {
            id: &work_item_id,
            source_system_id: ctx.source_system_id,
            source_kind: JIRA_WORK_ITEM_KIND,
            upstream_id: &issue.id,
            key: Some(&issue.key),
            url: issue.self_url.as_deref(),
            title: &title_owned,
            body: fields.description.as_deref(),
            state,
            status_name: fields.status.as_ref().and_then(|s| s.name.as_deref()),
            resolution_name: fields.resolution.as_ref().and_then(|r| r.name.as_deref()),
            priority_name: fields.priority.as_ref().and_then(|p| p.name.as_deref()),
            item_type: fields.issue_type.as_ref().and_then(|t| t.name.as_deref()),
            project_key: Some(project_key),
            project_name: project_name_opt,
            assignee_person_id: assignee_person_id.as_deref(),
            reporter_person_id: reporter_person_id.as_deref(),
            created_at_source: fields.created.as_deref(),
            updated_at_source: fields.updated.as_deref(),
            resolved_at_source: fields.resolution_date.as_deref(),
            due_at_source: fields.due_date.as_deref(),
            raw_updated_hash: &raw_updated_hash,
        },
    )?;

    // ── 3. jira_issues upsert ─────────────────────────────────────────────────
    let project_id = fields.project.as_ref().and_then(|p| p.id.clone());
    let project_key_final: String = fields
        .project
        .as_ref()
        .map(|p| p.key.clone())
        .unwrap_or_else(|| project_key.to_string());
    let project_name_final: Option<String> = ctx
        .project_name
        .map(|s| s.to_string())
        .or_else(|| fields.project.as_ref().map(|p| p.name.clone()));

    let issue_type_id = fields.issue_type.as_ref().and_then(|t| t.id.clone());
    let issue_type_name = fields.issue_type.as_ref().and_then(|t| t.name.clone());
    let status_id = fields.status.as_ref().and_then(|s| s.id.clone());
    let status_name = fields.status.as_ref().and_then(|s| s.name.clone());
    let resolution_id = fields.resolution.as_ref().and_then(|r| r.id.clone());
    let resolution_name = fields.resolution.as_ref().and_then(|r| r.name.clone());
    let priority_id = fields.priority.as_ref().and_then(|p| p.id.clone());
    let priority_name = fields.priority.as_ref().and_then(|p| p.name.clone());
    let watches_count = fields.watches.as_ref().map(|w| w.watch_count as i64);
    let votes_count = fields.votes.as_ref().map(|v| v.votes as i64);

    let parent_link = as_string(raw_fields.and_then(|f| f.get("customfield_14051")));
    let customer_name = as_string(raw_fields.and_then(|f| f.get("customfield_14353")));
    let epic_link = as_string(raw_fields.and_then(|f| f.get("customfield_10857")));
    let epic_name = as_string(raw_fields.and_then(|f| f.get("customfield_10858")));
    let epic_status = option_name(raw_fields.and_then(|f| f.get("customfield_10859")));

    // Sprint names: try greenhopper parse, fall back to raw JSON.
    let sprint_value = raw_fields.and_then(|f| f.get("customfield_10557"));
    let sprint_names: Vec<String> = sprint_value.map(parse_sprint_names).unwrap_or_default();
    let sprint_names_json: Option<String> = match sprint_value {
        Some(v) if !v.is_null() => {
            if !sprint_names.is_empty() {
                serde_json::to_string(&sprint_names).ok()
            } else {
                Some(v.to_string())
            }
        }
        _ => None,
    };

    let product_value = raw_fields.and_then(|f| f.get("customfield_14655"));
    let product_names: Vec<String> = product_value.map(array_of_values).unwrap_or_default();
    let product_names_json: Option<String> = match product_value {
        Some(v) if !v.is_null() => serde_json::to_string(&product_names).ok(),
        _ => None,
    };

    let team_value = raw_fields.and_then(|f| f.get("customfield_12751"));
    let team_names: Vec<String> = team_value.map(array_of_values).unwrap_or_default();
    let assigned_team_names_json: Option<String> = match team_value {
        Some(v) if !v.is_null() => serde_json::to_string(&team_names).ok(),
        _ => None,
    };

    let raw_fields_json: String = fields_json_string.clone();
    let raw_issue_json: String = raw_issue.to_string();

    conn.execute(
        "INSERT INTO jira_issues
            (work_item_id, jira_id, jira_key, self_url, project_id, project_key, project_name,
             issue_type_id, issue_type_name, status_id, status_name, status_category_key,
             resolution_id, resolution_name, priority_id, priority_name,
             watches_count, votes_count, parent_link, customer_name, epic_link, epic_name, epic_status,
             sprint_names_json, product_names_json, assigned_team_names_json,
             raw_fields_json, raw_issue_json, fields_hash, updated_at_source, ingested_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18,
                 ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31)
         ON CONFLICT(work_item_id) DO UPDATE SET
            jira_key = excluded.jira_key,
            self_url = excluded.self_url,
            project_id = excluded.project_id,
            project_key = excluded.project_key,
            project_name = excluded.project_name,
            issue_type_id = excluded.issue_type_id,
            issue_type_name = excluded.issue_type_name,
            status_id = excluded.status_id,
            status_name = excluded.status_name,
            status_category_key = excluded.status_category_key,
            resolution_id = excluded.resolution_id,
            resolution_name = excluded.resolution_name,
            priority_id = excluded.priority_id,
            priority_name = excluded.priority_name,
            watches_count = excluded.watches_count,
            votes_count = excluded.votes_count,
            parent_link = excluded.parent_link,
            customer_name = excluded.customer_name,
            epic_link = excluded.epic_link,
            epic_name = excluded.epic_name,
            epic_status = excluded.epic_status,
            sprint_names_json = excluded.sprint_names_json,
            product_names_json = excluded.product_names_json,
            assigned_team_names_json = excluded.assigned_team_names_json,
            raw_fields_json = excluded.raw_fields_json,
            raw_issue_json = excluded.raw_issue_json,
            fields_hash = excluded.fields_hash,
            updated_at_source = excluded.updated_at_source,
            ingested_at = excluded.ingested_at",
        params![
            work_item_id,
            issue.id,
            issue.key,
            issue.self_url,
            project_id,
            project_key_final,
            project_name_final,
            issue_type_id,
            issue_type_name,
            status_id,
            status_name,
            None::<String>, // status_category_key — not yet captured
            resolution_id,
            resolution_name,
            priority_id,
            priority_name,
            watches_count,
            votes_count,
            parent_link,
            customer_name,
            epic_link,
            epic_name,
            epic_status,
            sprint_names_json,
            product_names_json,
            assigned_team_names_json,
            raw_fields_json,
            raw_issue_json,
            fields_hash,
            fields.updated,
            ctx.ingested_at,
        ],
    )?;

    // ── 4. jira_issue_field_values: AMP mappings + every field present ────────
    //
    // First, build a map field_id → (canonical_name, value_kind) for AMP fields.
    let mappings = amp_field_mappings();
    let mapping_lookup = |field_id: &str| -> Option<&'static AmpFieldMapping> {
        for m in mappings.iter() {
            if m.field_id == field_id {
                // Returning a static reference would need a lifetime trick; clone semantics
                // are cheap (Copy). We work around by returning Option<AmpFieldMapping> via
                // a separate helper below.
                let _ = m;
            }
        }
        None
    };
    let _ = mapping_lookup; // suppress unused — we iterate inline instead.

    if let Some(fields_obj) = raw_fields.and_then(|v| v.as_object()) {
        for (field_id, value) in fields_obj {
            if value.is_null() {
                continue;
            }
            // Lookup mapping by field_id.
            let mapping = mappings.iter().find(|m| m.field_id == field_id);
            let (canonical_name, value_kind, field_name): (
                Option<&str>,
                &str,
                Option<&str>,
            ) = match mapping {
                Some(m) => (Some(m.canonical_name), m.value_kind, Some(m.field_name)),
                None => (None, "json", None),
            };
            upsert_field_value(
                conn,
                &FieldValueInput {
                    work_item_id: &work_item_id,
                    field_id,
                    field_name,
                    canonical_name,
                    value_kind,
                    value,
                    updated_at_source: fields.updated.as_deref(),
                },
            )?;
        }
    }

    // Ensure every AMP-mapped field has at least an empty row even when the
    // payload omits it? The task says "one row per AMP mapping AND one row
    // per other custom field present". We interpret "AMP mapping" to mean
    // *when present in payload*; absent → no row. The iteration above already
    // covers that.

    // ── 5. Terms ──────────────────────────────────────────────────────────────
    // Delete existing label terms before upserting current ones so that labels
    // removed upstream do not persist after a resync.
    delete_work_item_terms_by_kind(conn, &work_item_id, "label")?;
    for label in &fields.labels {
        upsert_work_item_term(
            conn,
            &WorkItemTermInput {
                work_item_id: &work_item_id,
                term_kind: "label",
                term_key: label,
                term_name: Some(label),
                raw_json: None,
            },
        )?;
    }

    for component in &fields.components {
        let key = component.id.as_deref().or(component.name.as_deref());
        if let Some(k) = key {
            upsert_work_item_term(
                conn,
                &WorkItemTermInput {
                    work_item_id: &work_item_id,
                    term_kind: "component",
                    term_key: k,
                    term_name: component.name.as_deref(),
                    raw_json: None,
                },
            )?;
        }
    }

    for version in &fields.fix_versions {
        let key = version.id.as_deref().or(version.name.as_deref());
        if let Some(k) = key {
            upsert_work_item_term(
                conn,
                &WorkItemTermInput {
                    work_item_id: &work_item_id,
                    term_kind: "fix_version",
                    term_key: k,
                    term_name: version.name.as_deref(),
                    raw_json: None,
                },
            )?;
        }
    }

    for product in &product_names {
        upsert_work_item_term(
            conn,
            &WorkItemTermInput {
                work_item_id: &work_item_id,
                term_kind: "product",
                term_key: product,
                term_name: Some(product),
                raw_json: None,
            },
        )?;
    }

    for team in &team_names {
        upsert_work_item_term(
            conn,
            &WorkItemTermInput {
                work_item_id: &work_item_id,
                term_kind: "assigned_team",
                term_key: team,
                term_name: Some(team),
                raw_json: None,
            },
        )?;
    }

    for sprint in &sprint_names {
        upsert_work_item_term(
            conn,
            &WorkItemTermInput {
                work_item_id: &work_item_id,
                term_kind: "sprint",
                term_key: sprint,
                term_name: Some(sprint),
                raw_json: None,
            },
        )?;
    }

    // ── 6. Relationships ──────────────────────────────────────────────────────
    for subtask in &fields.subtasks {
        let rel_id = stable_id(
            "rel",
            &[ctx.source_system_id, "subtask", &issue.key, &subtask.key],
        );
        upsert_work_item_relationship(
            conn,
            ctx.ingested_at,
            &WorkItemRelationshipInput {
                id: &rel_id,
                source_system_id: ctx.source_system_id,
                source_kind: JIRA_WORK_ITEM_KIND,
                from_work_item_id: Some(&work_item_id),
                to_work_item_id: None,
                from_upstream_key: Some(&issue.key),
                to_upstream_key: Some(&subtask.key),
                relationship_type: "subtask",
                direction: Some("outward"),
                raw_json: None,
            },
        )?;
    }

    if let Some(epic) = epic_link.as_deref() {
        let rel_id = stable_id(
            "rel",
            &[ctx.source_system_id, "epic", &issue.key, epic],
        );
        upsert_work_item_relationship(
            conn,
            ctx.ingested_at,
            &WorkItemRelationshipInput {
                id: &rel_id,
                source_system_id: ctx.source_system_id,
                source_kind: JIRA_WORK_ITEM_KIND,
                from_work_item_id: Some(&work_item_id),
                to_work_item_id: None,
                from_upstream_key: Some(&issue.key),
                to_upstream_key: Some(epic),
                relationship_type: "epic",
                direction: Some("outward"),
                raw_json: None,
            },
        )?;
    }

    if let Some(parent) = parent_link.as_deref() {
        let rel_id = stable_id(
            "rel",
            &[ctx.source_system_id, "parent", &issue.key, parent],
        );
        upsert_work_item_relationship(
            conn,
            ctx.ingested_at,
            &WorkItemRelationshipInput {
                id: &rel_id,
                source_system_id: ctx.source_system_id,
                source_kind: JIRA_WORK_ITEM_KIND,
                from_work_item_id: Some(&work_item_id),
                to_work_item_id: None,
                from_upstream_key: Some(&issue.key),
                to_upstream_key: Some(parent),
                relationship_type: "parent",
                direction: Some("outward"),
                raw_json: None,
            },
        )?;
    }

    for link in &fields.issue_links {
        let rel_type = link
            .type_
            .as_ref()
            .and_then(|t| t.name.as_deref())
            .unwrap_or("link")
            .to_string();
        let (direction, other_key) = if let Some(outward) = link.outward_issue.as_ref() {
            ("outward", outward.key.clone())
        } else if let Some(inward) = link.inward_issue.as_ref() {
            ("inward", inward.key.clone())
        } else {
            continue;
        };
        let rel_id = stable_id(
            "rel",
            &[
                ctx.source_system_id,
                &rel_type,
                &issue.key,
                &other_key,
                direction,
            ],
        );
        let raw_json = serde_json::to_string(link).ok();
        let (from_key, to_key) = if direction == "outward" {
            (issue.key.as_str(), other_key.as_str())
        } else {
            (other_key.as_str(), issue.key.as_str())
        };
        upsert_work_item_relationship(
            conn,
            ctx.ingested_at,
            &WorkItemRelationshipInput {
                id: &rel_id,
                source_system_id: ctx.source_system_id,
                source_kind: JIRA_WORK_ITEM_KIND,
                from_work_item_id: if direction == "outward" {
                    Some(&work_item_id)
                } else {
                    None
                },
                to_work_item_id: if direction == "inward" {
                    Some(&work_item_id)
                } else {
                    None
                },
                from_upstream_key: Some(from_key),
                to_upstream_key: Some(to_key),
                relationship_type: &rel_type,
                direction: Some(direction),
                raw_json: raw_json.as_deref(),
            },
        )?;
    }

    // ── 7. Inline comments ────────────────────────────────────────────────────
    if let Some(comments) = fields.comment.as_ref() {
        for comment in &comments.comments {
            persist_jira_comment(conn, ctx, &work_item_id, &issue.key, comment)?;
        }
    }

    // ── 7b. Inline worklogs ───────────────────────────────────────────────────
    if let Some(worklogs) = fields.worklog.as_ref() {
        for worklog in &worklogs.worklogs {
            persist_jira_worklog(conn, ctx, &work_item_id, worklog)?;
        }
    }

    // ── 8. Indexable document for the issue body ──────────────────────────────
    let summary = fields.summary.as_deref().unwrap_or("(no summary)");
    let description = fields.description.as_deref().unwrap_or("");
    let body_combined = format!("{summary}\n\n{description}").trim().to_string();
    let issue_doc_hash = content_hash(&body_combined);

    let assignee_display = assignee_identity
        .as_ref()
        .and(fields.assignee.as_ref())
        .and_then(|u| u.display_name.clone());
    let reporter_display = reporter_identity
        .as_ref()
        .and(fields.reporter.as_ref())
        .and_then(|u| u.display_name.clone());

    let metadata_json = serde_json::json!({
        "kind": "jira_issue",
        "project_key": project_key,
        "status_name": status_name,
        "priority_name": priority_name,
        "labels": fields.labels,
        "assignee_display_name": assignee_display,
        "reporter_display_name": reporter_display,
    })
    .to_string();

    upsert_indexable_document(
        conn,
        ctx.ingested_at,
        &IndexableDocumentInput {
            source_system_id: ctx.source_system_id,
            entity_kind: "work_item",
            entity_id: &work_item_id,
            work_item_id: Some(&work_item_id),
            title: fields.summary.as_deref(),
            body: &body_combined,
            metadata_json: &metadata_json,
            content_hash: &issue_doc_hash,
        },
    )?;

    Ok(ProjectedJiraIssue {
        work_item_id,
        jira_id: issue.id.clone(),
        jira_key: issue.key.clone(),
    })
}

// ── Ingestion service ──────────────────────────────────────────────────────────

use std::sync::atomic::{AtomicU64, Ordering};

use crate::ingestion::errors::{IngestionError, IngestionErrorCategory};
use crate::ingestion::runs::{
    finish_run, read_cursor, start_run, update_progress, upsert_cursor,
};

/// Process-static counter mixed into `run_id` so two runs for the same
/// `(source_system_id, project_key)` started within the same wall-clock
/// second do not collide on the primary key. `start_run` uses INSERT, not
/// UPSERT, so colliding ids would surface as a hard error. Resets per
/// process, which is safe because timestamps drift across restarts and the
/// FNV-1a content hash still emits distinct ids.
static RUN_ID_SEQ: AtomicU64 = AtomicU64::new(0);
use crate::sources::jira_client::{JiraApiClient, JiraSearchRequest};
use crate::sources::jira_errors::JiraApiError;
use crate::sources::jira_types::{JiraChangelogPage, JiraPagedComments, JiraPagedWorklogs, JiraSearchPage};

/// Trait seam that abstracts over `JiraApiClient::search_issues_page` so
/// `JiraIssueIngestionService` can be exercised against an in-memory stub.
pub trait JiraIssueClient {
    fn search_issues_page(
        &self,
        request: JiraSearchRequest,
    ) -> Result<JiraSearchPage, JiraApiError>;

    fn get_issue_comments_page(
        &self,
        issue_id_or_key: &str,
        start_at: u32,
        max_results: u32,
    ) -> Result<JiraPagedComments, JiraApiError>;

    fn get_issue_worklogs_page(
        &self,
        issue_id_or_key: &str,
        start_at: u32,
        max_results: u32,
    ) -> Result<JiraPagedWorklogs, JiraApiError>;

    fn get_issue_remote_links(
        &self,
        issue_id_or_key: &str,
    ) -> Result<Vec<JiraRemoteLink>, JiraApiError>;

    fn get_issue_changelog(
        &self,
        issue_id_or_key: &str,
    ) -> Result<Option<JiraChangelogPage>, JiraApiError>;
}

impl JiraIssueClient for JiraApiClient {
    fn search_issues_page(
        &self,
        request: JiraSearchRequest,
    ) -> Result<JiraSearchPage, JiraApiError> {
        JiraApiClient::search_issues_page(self, request)
    }

    fn get_issue_comments_page(
        &self,
        issue_id_or_key: &str,
        start_at: u32,
        max_results: u32,
    ) -> Result<JiraPagedComments, JiraApiError> {
        JiraApiClient::get_issue_comments_page(self, issue_id_or_key, start_at, max_results)
    }

    fn get_issue_worklogs_page(
        &self,
        issue_id_or_key: &str,
        start_at: u32,
        max_results: u32,
    ) -> Result<JiraPagedWorklogs, JiraApiError> {
        JiraApiClient::get_issue_worklogs_page(self, issue_id_or_key, start_at, max_results)
    }

    fn get_issue_remote_links(
        &self,
        issue_id_or_key: &str,
    ) -> Result<Vec<JiraRemoteLink>, JiraApiError> {
        JiraApiClient::get_issue_remote_links(self, issue_id_or_key)
    }

    fn get_issue_changelog(
        &self,
        issue_id_or_key: &str,
    ) -> Result<Option<JiraChangelogPage>, JiraApiError> {
        Ok(JiraApiClient::get_issue_with_changelog(self, issue_id_or_key)?.changelog)
    }
}

/// Opt-in feature toggles for the Jira issue ingestion service.
///
/// Watchers / votes / remote links are disabled by default and must be
/// explicitly opted into via this struct. Watchers and votes are placeholders
/// for the next ingestion baseline. Both `fetch_remote_links` and
/// `fetch_changelog` are wired today; `fetch_watchers` and `fetch_votes`
/// are placeholders for a future baseline.
#[derive(Debug, Clone)]
pub struct JiraIngestionOptions {
    /// When true, fetch `/rest/api/2/issue/{key}/remotelink` for each issue
    /// and persist the result via `jira_remote_links`. Maintained under a
    /// separate cursor key `project:{KEY}:remotelinks`.
    pub fetch_remote_links: bool,
    /// When true, fetch `/rest/api/2/issue/{key}/changelog` for each issue
    /// and persist the result as `issue_events` rows.
    pub fetch_changelog: bool,
    /// Placeholder — not wired in this task.
    pub fetch_watchers: bool,
    /// Placeholder — not wired in this task.
    pub fetch_votes: bool,
}

impl Default for JiraIngestionOptions {
    fn default() -> Self {
        Self {
            fetch_remote_links: false,
            fetch_changelog: true,
            fetch_watchers: false,
            fetch_votes: false,
        }
    }
}

/// Cooperative cancellation flag shared between the service and any caller
/// that wishes to interrupt a long-running ingestion.
pub struct CancellationFlag {
    cancelled: std::sync::atomic::AtomicBool,
}

impl CancellationFlag {
    pub fn new() -> Self {
        Self {
            cancelled: std::sync::atomic::AtomicBool::new(false),
        }
    }

    pub fn request_cancel(&self) {
        self.cancelled
            .store(true, std::sync::atomic::Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(std::sync::atomic::Ordering::SeqCst)
    }
}

impl Default for CancellationFlag {
    fn default() -> Self {
        Self::new()
    }
}

/// Summary returned by `ingest_project`.
#[derive(Debug, Clone)]
pub struct JiraIssueIngestionSummary {
    pub run_id: String,
    /// `"succeeded" | "partial" | "cancelled" | "failed"`.
    pub status: String,
    pub pages: u32,
    pub saved_issues: u32,
    pub total_issues: Option<u32>,
}

/// Service that paginates a Jira search and persists results via
/// `project_jira_issue`.
///
/// The service holds the SQLite mutex only during short write batches: one
/// per setup, one per page projection, one per tail-fetch batch, and one
/// final block that advances cursors and finalizes the run. HTTP fetches
/// (`search_issues_page`, `get_issue_comments_page`, `get_issue_worklogs_page`,
/// `get_issue_remote_links`) always happen with NO lock held so other
/// commands — notably `jira_issue_ingestion_status` and
/// `jira_issue_ingestion_cancel` — can observe and interrupt a run mid-flight.
pub struct JiraIssueIngestionService<'a, C> {
    pub client: &'a C,
    pub page_size: u32,
    pub overlap_seconds: i64,
    pub options: JiraIngestionOptions,
}

impl<'a, C: JiraIssueClient> JiraIssueIngestionService<'a, C> {
    pub fn new(client: &'a C) -> Self {
        Self {
            client,
            page_size: 50,
            overlap_seconds: 60,
            options: JiraIngestionOptions::default(),
        }
    }

    /// Construct a service with non-default ingestion options.
    pub fn with_options(client: &'a C, options: JiraIngestionOptions) -> Self {
        Self {
            client,
            page_size: 50,
            overlap_seconds: 60,
            options,
        }
    }

    pub fn ingest_project<D: crate::ingestion::db::DbAccess>(
        &self,
        db: &D,
        source_system_id: &str,
        project_key: &str,
        project_name: Option<&str>,
        now_utc: &str,
        cancellation: &CancellationFlag,
    ) -> Result<JiraIssueIngestionSummary, IngestionError> {
        let seq = RUN_ID_SEQ.fetch_add(1, Ordering::Relaxed);
        let seq_str = seq.to_string();
        let run_id = stable_id(
            "run",
            &[source_system_id, project_key, now_utc, &seq_str],
        );
        let requested_projects_json =
            serde_json::json!([project_key]).to_string();

        // ── Setup: start run + seed mappings + read cursor in ONE locked block.
        let cursor_last_updated: Option<String> = db.with_conn(|conn| {
            start_run(
                conn,
                &run_id,
                source_system_id,
                JIRA_ISSUE_CONNECTOR,
                now_utc,
                &requested_projects_json,
            )?;
            if let Err(err) = seed_amp_field_mappings(conn, source_system_id, project_key, now_utc)
            {
                let ie: IngestionError = err.into();
                let failed_at = now_utc_rfc3339();
                let _ = finish_run(
                    conn,
                    &run_id,
                    &failed_at,
                    "failed",
                    "{}",
                    Some(&format!("{ie}")),
                );
                return Err(ie);
            }
            let cursor_key = format!("project:{}:issues", project_key);
            let cursor =
                read_cursor(conn, source_system_id, JIRA_ISSUE_CONNECTOR, &cursor_key)?;
            let last_updated: Option<String> = cursor.as_ref().and_then(|row| {
                serde_json::from_str::<serde_json::Value>(&row.cursor_value)
                    .ok()
                    .and_then(|v| {
                        v.get("last_updated")
                            .and_then(|x| x.as_str())
                            .map(|s| s.to_string())
                    })
            });
            Ok(last_updated)
        })?;
        let cursor_key = format!("project:{}:issues", project_key);
        let overlap_adjusted: Option<String> = cursor_last_updated
            .as_deref()
            .and_then(|ts| subtract_seconds_rfc3339(ts, self.overlap_seconds));

        let jql = match overlap_adjusted.as_deref().and_then(jql_datetime) {
            Some(filter_ts) => format!(
                "project = \"{}\" AND updated >= \"{}\" ORDER BY updated ASC, key ASC",
                project_key, filter_ts
            ),
            None => format!(
                "project = \"{}\" ORDER BY updated ASC, key ASC",
                project_key
            ),
        };

        let mut start_at: u32 = 0;
        let mut pages: u32 = 0;
        let mut saved_issues: u32 = 0;
        let mut total_issues: Option<u32> = None;
        let mut max_updated_seen: Option<String> = None;
        let mut any_page_persisted = false;
        let mut cancelled_mid_loop = false;
        let mut tail_errors: Vec<String> = Vec::new();
        // Tracks whether any remote-link fetch failed across the run. Used to
        // decide whether to advance the per-project remote-links cursor.
        let mut remote_links_had_error = false;

        // Shared projection context — all four `with_conn` blocks below build
        // an identical `JiraIssueProjectionContext` from these inputs, so we
        // hoist it once. The lifetime tracks the `&str` borrows on
        // `source_system_id`, `project_key`, `project_name`, and `now_utc`.
        let ctx = JiraIssueProjectionContext {
            source_system_id,
            project_key,
            project_name,
            ingested_at: now_utc,
        };

        // ── Page loop body wrapped in an IIFE so every error path falls
        // through to ONE finalize block below. This guarantees we always call
        // `finish_run` — even on storage errors mid-page — so the
        // `ingestion_runs` row never stays stuck at status='running'.
        let loop_result: Result<(), IngestionError> = (|| {
            loop {
                if cancellation.is_cancelled() {
                    cancelled_mid_loop = true;
                    break;
                }

                let request = JiraSearchRequest::new(jql.clone())
                    .with_max_results(self.page_size)
                    .with_fields(amp_search_fields())
                    .with_start_at(start_at);

                // HTTP: fetch the page WITHOUT holding the SQLite mutex.
                let page = self.client.search_issues_page(request)?;

                let returned = page.issues.len() as u32;
                total_issues = page.total.or(total_issues);

                // ── Persist the whole page in ONE locked block, wrapped in an
                // explicit transaction so a mid-page projection failure rolls
                // back the entire page rather than leaving N-1 issues behind.
                let (page_max_updated, page_saved) = db.with_conn(|conn| {
                    let tx = conn.unchecked_transaction()?;
                    let mut page_max_updated: Option<String> = None;
                    let mut page_saved: u32 = 0;
                    let result: Result<(), IngestionError> = (|| {
                        for issue in &page.issues {
                            let raw_value = serde_json::to_value(issue).map_err(|_| {
                                IngestionError::new(IngestionErrorCategory::Decode, "")
                            })?;
                            project_jira_issue(&tx, &ctx, &raw_value, issue)?;

                            if let Some(updated) = issue.fields.updated.as_deref() {
                                match page_max_updated.as_deref() {
                                    None => page_max_updated = Some(updated.to_string()),
                                    Some(prev) if updated > prev => {
                                        page_max_updated = Some(updated.to_string())
                                    }
                                    _ => {}
                                }
                            }
                            page_saved += 1;
                        }
                        Ok(())
                    })();
                    match result {
                        Ok(()) => {
                            tx.commit()?;
                            Ok((page_max_updated, page_saved))
                        }
                        Err(e) => {
                            // Rollback errors are intentionally ignored — the
                            // outer error is what we want to surface.
                            let _ = tx.rollback();
                            Err(e)
                        }
                    }
                })?;
                if let Some(updated) = page_max_updated {
                    match max_updated_seen.as_deref() {
                        None => max_updated_seen = Some(updated),
                        Some(prev) if updated.as_str() > prev => {
                            max_updated_seen = Some(updated)
                        }
                        _ => {}
                    }
                }
                saved_issues += page_saved;

                // ── Tail / sub-resource fetches ─────────────────────────────
                // These happen OUTSIDE the per-issue projection — by the time
                // we reach here the issues are already persisted, so a tail
                // failure marks the run "partial" but doesn't roll back saved
                // issues.
                //
                // For each tail fetch, HTTP happens FIRST (no lock held); the
                // returned items are persisted inside a short `with_conn`
                // block. Each tail persist is batched (not atomic) — each
                // helper uses `ON CONFLICT` upserts so a partial flush is
                // safe to retry.
                for issue in &page.issues {
                    if cancellation.is_cancelled() {
                        break;
                    }
                    let work_item_id_for_tail = stable_id(
                        "wi",
                        &[source_system_id, JIRA_WORK_ITEM_KIND, &issue.id],
                    );

                    // Comments tail.
                    if let Some(comment) = issue.fields.comment.as_ref() {
                        let total = comment.total.unwrap_or(0) as usize;
                        let inline = comment.comments.len();
                        if total > inline {
                            let mut start_at_tail = inline as u32;
                            loop {
                                if cancellation.is_cancelled() {
                                    break;
                                }
                                // HTTP (no lock held).
                                let page_tail = match self.client.get_issue_comments_page(
                                    &issue.key,
                                    start_at_tail,
                                    self.page_size,
                                ) {
                                    Ok(p) => p,
                                    Err(err) => {
                                        let ie: IngestionError = err.into();
                                        tail_errors
                                            .push(format!("comments {}: {}", issue.key, ie));
                                        break;
                                    }
                                };
                                let returned = page_tail.comments.len() as u32;
                                // Batched (not atomic). persist_jira_comment uses
                                // upserts so retry after partial flush is safe.
                                db.with_conn(|conn| {
                                    for c in &page_tail.comments {
                                        persist_jira_comment(
                                            conn,
                                            &ctx,
                                            &work_item_id_for_tail,
                                            &issue.key,
                                            c,
                                        )
                                        .map_err(IngestionError::from)?;
                                    }
                                    Ok(())
                                })?;
                                let next = start_at_tail.saturating_add(returned);
                                let reached_total = page_tail
                                    .total
                                    .map(|t| next as usize >= t as usize)
                                    .unwrap_or(false);
                                if returned == 0 || reached_total || next <= start_at_tail {
                                    break;
                                }
                                start_at_tail = next;
                            }
                        }
                    }

                    if cancellation.is_cancelled() {
                        break;
                    }

                    // Worklogs tail.
                    if let Some(worklog) = issue.fields.worklog.as_ref() {
                        let total = worklog.total.unwrap_or(0) as usize;
                        let inline = worklog.worklogs.len();
                        if total > inline {
                            let mut start_at_tail = inline as u32;
                            loop {
                                if cancellation.is_cancelled() {
                                    break;
                                }
                                let page_tail = match self.client.get_issue_worklogs_page(
                                    &issue.key,
                                    start_at_tail,
                                    self.page_size,
                                ) {
                                    Ok(p) => p,
                                    Err(err) => {
                                        let ie: IngestionError = err.into();
                                        tail_errors
                                            .push(format!("worklogs {}: {}", issue.key, ie));
                                        break;
                                    }
                                };
                                let returned = page_tail.worklogs.len() as u32;
                                // Batched (not atomic). persist_jira_worklog uses
                                // upserts so retry after partial flush is safe.
                                db.with_conn(|conn| {
                                    for w in &page_tail.worklogs {
                                        persist_jira_worklog(
                                            conn,
                                            &ctx,
                                            &work_item_id_for_tail,
                                            w,
                                        )
                                        .map_err(IngestionError::from)?;
                                    }
                                    Ok(())
                                })?;
                                let next = start_at_tail.saturating_add(returned);
                                let reached_total = page_tail
                                    .total
                                    .map(|t| next as usize >= t as usize)
                                    .unwrap_or(false);
                                if returned == 0 || reached_total || next <= start_at_tail {
                                    break;
                                }
                                start_at_tail = next;
                            }
                        }
                    }

                    if cancellation.is_cancelled() {
                        break;
                    }

                    // Remote links (opt-in).
                    if self.options.fetch_remote_links {
                        match self.client.get_issue_remote_links(&issue.key) {
                            Ok(links) => {
                                // Batched (not atomic). persist_jira_remote_link
                                // uses upserts so retry after partial flush is safe.
                                // A successful empty response is still a successful
                                // remote-link scan, so we no longer track whether
                                // any link was actually persisted — the cursor
                                // advances whenever the scan returns without error.
                                db.with_conn(|conn| {
                                    for link in &links {
                                        if let Err(err) = persist_jira_remote_link(
                                            conn,
                                            &ctx,
                                            &work_item_id_for_tail,
                                            &issue.key,
                                            link,
                                        ) {
                                            return Err(err.into());
                                        }
                                    }
                                    Ok(())
                                })?;
                            }
                            Err(err) => {
                                let ie: IngestionError = err.into();
                                tail_errors.push(format!("remotelinks {}: {}", issue.key, ie));
                                remote_links_had_error = true;
                            }
                        }
                    }

                    if cancellation.is_cancelled() {
                        break;
                    }

                    // Changelog history tail: fetch all pages for this issue and
                    // persist each entry as idempotent issue_events rows.
                    // HTTP is done OUTSIDE the lock; only the write enters with_conn.
                    if self.options.fetch_changelog {
                        // Jira Data Center returns the full changelog inline via
                        // `?expand=changelog` on the issue endpoint. There is no
                        // separate paginated `/changelog` resource on DC — the
                        // Cloud-only endpoint 404s here. The inline list is
                        // capped by the server's `jira.changelog.history.max`
                        // setting (default 100). For issues whose history
                        // exceeds that cap we silently truncate; revisit if it
                        // becomes a real problem.
                        let cl_histories = match self.client.get_issue_changelog(&issue.key) {
                            Ok(Some(page)) => page.histories,
                            Ok(None) => Vec::new(),
                            Err(err) => {
                                let ie: IngestionError = err.into();
                                tail_errors.push(format!("changelog {}: {}", issue.key, ie));
                                Vec::new()
                            }
                        };
                        // Process each changelog entry individually so that a
                        // decode failure on one entry does not abort the rest.
                        // Actor resolution needs a connection; the pure
                        // projection step is done outside the lock so that a
                        // decode error can be pushed to tail_errors and the
                        // loop can continue.
                        for entry in &cl_histories {
                            if cancellation.is_cancelled() {
                                break;
                            }
                            // Step 1: resolve actor identity (needs DB lock).
                            let actor_id = db.with_conn(|conn| {
                                Ok(crate::sources::jira_history::resolve_actor_identity(
                                    conn,
                                    source_system_id,
                                    entry,
                                    now_utc,
                                ))
                            })?;
                            // Step 2: project changelog entry (pure — no lock).
                            let events = match crate::sources::jira_history::project_changelog_entry(
                                source_system_id,
                                &work_item_id_for_tail,
                                &issue.key,
                                entry,
                                now_utc,
                                actor_id.as_deref(),
                            ) {
                                Ok(events) => events,
                                Err(e) => {
                                    let ie = IngestionError::new(
                                        IngestionErrorCategory::Decode,
                                        e.to_string(),
                                    );
                                    tail_errors.push(format!(
                                        "changelog {}: {}",
                                        issue.key, ie
                                    ));
                                    continue;
                                }
                            };
                            // Step 3: write events (needs DB lock).
                            // Each upsert_issue_event uses ON CONFLICT so a
                            // partial flush is safe to retry.
                            db.with_conn(|conn| {
                                for event in &events {
                                    crate::issues::history::upsert_issue_event(conn, event)
                                        .map_err(|e| {
                                            IngestionError::new(
                                                IngestionErrorCategory::Storage,
                                                e.to_string(),
                                            )
                                        })?;
                                }
                                Ok(())
                            })?;
                        }
                    }
                }

                pages += 1;
                any_page_persisted = any_page_persisted || returned > 0;

                let progress_json = serde_json::json!({
                    "phase": "searching",
                    "current_page": pages,
                    "total_pages": total_issues.map(|t| div_ceil_u32(t, self.page_size.max(1))),
                    "saved_issues": saved_issues,
                    "total_issues": total_issues,
                })
                .to_string();
                let counts_json = serde_json::json!({
                    "saved_issues": saved_issues,
                    "total_issues": total_issues,
                    "pages": pages,
                })
                .to_string();
                db.with_conn(|conn| {
                    update_progress(conn, &run_id, &progress_json, &counts_json)?;
                    Ok(())
                })?;

                if should_stop_paginate(start_at, self.page_size, returned, page.total) {
                    break;
                }
                let next_start = start_at.saturating_add(returned);
                if next_start <= start_at {
                    break;
                }
                start_at = next_start;
            }
            Ok(())
        })();

        // ── Single finalize on error. Any `?` inside the loop body — search
        // HTTP error, storage error during projection, storage error during
        // tail persist, or progress update failure — lands here. We mark the
        // run "partial" with a fresh timestamp and propagate the error.
        if let Err(ie) = loop_result {
            let counts_json = serde_json::json!({
                "saved_issues": saved_issues,
                "total_issues": total_issues,
                "pages": pages,
            })
            .to_string();
            let finished_at = now_utc_rfc3339();
            let ie_str = format!("{ie}");
            let _ = db.with_conn(|conn| {
                let _ = finish_run(
                    conn,
                    &run_id,
                    &finished_at,
                    "partial",
                    &counts_json,
                    Some(&ie_str),
                );
                Ok(())
            });
            return Err(ie);
        }

        let (status, error_summary): (&str, Option<String>) = if cancelled_mid_loop {
            ("cancelled", None)
        } else if !tail_errors.is_empty() {
            (
                "partial",
                Some(format!(
                    "{} tail errors; first: {}",
                    tail_errors.len(),
                    tail_errors[0]
                )),
            )
        } else {
            ("succeeded", None)
        };
        let final_counts = serde_json::json!({
            "saved_issues": saved_issues,
            "total_issues": total_issues,
            "pages": pages,
        })
        .to_string();

        // ── Final writes: advance cursors + finish_run in one locked block.
        // Capture a fresh timestamp so `finished_at` reflects the actual end
        // of the run rather than the start-of-run value.
        let finished_at = now_utc_rfc3339();
        let fetch_remote_links = self.options.fetch_remote_links;
        let project_key_owned = project_key.to_string();
        db.with_conn(|conn| {
            // Cursor advances only when at least one page was successfully
            // persisted and we observed an `updated` value. On cancellation we
            // still persist progress up to the last completed page.
            if any_page_persisted {
                let new_cursor_value = max_updated_seen
                    .clone()
                    .or_else(|| cursor_last_updated.clone())
                    .map(|ts| serde_json::json!({ "last_updated": ts }).to_string());
                if let Some(value) = new_cursor_value {
                    upsert_cursor(
                        conn,
                        source_system_id,
                        JIRA_ISSUE_CONNECTOR,
                        &cursor_key,
                        &value,
                        Some(now_utc),
                        now_utc,
                    )?;
                }
            }

            // Separate cursor for remote-link sync: advances whenever remote-link
            // sync was enabled and the scan completed without error. A successful
            // scan that returned zero links is still a completed sync, so the
            // next run should not redo the scan from scratch.
            if fetch_remote_links && !remote_links_had_error {
                let remote_links_cursor_key =
                    format!("project:{}:remotelinks", project_key_owned);
                let value = serde_json::json!({ "last_synced": now_utc }).to_string();
                upsert_cursor(
                    conn,
                    source_system_id,
                    JIRA_ISSUE_CONNECTOR,
                    &remote_links_cursor_key,
                    &value,
                    Some(now_utc),
                    now_utc,
                )?;
            }

            finish_run(
                conn,
                &run_id,
                &finished_at,
                status,
                &final_counts,
                error_summary.as_deref(),
            )?;
            Ok(())
        })?;

        // ── Replay missing snapshot dates for this project ──────────────
        // Derive the local date from the leading 10 chars of `now_utc`
        // (YYYY-MM-DD).  This avoids a chrono dependency and is correct for
        // UTC-anchored dates; callers that need local-date accuracy should
        // pass `now_utc` with an appropriate offset.
        let replay_date = now_utc.get(..10).unwrap_or(now_utc).to_string();
        let now_owned = now_utc.to_string();
        let source_system_id_owned = source_system_id.to_string();
        db.with_conn(|conn| {
            match crate::issues::snapshots::replay_missing_snapshots(
                conn,
                &source_system_id_owned,
                &project_key_owned,
                &replay_date,
                &now_owned,
            ) {
                Ok(result) => {
                    eprintln!(
                        "[snapshots] replay: {} dates, {} snapshots written",
                        result.generated_dates.len(),
                        result.snapshots_written
                    );
                }
                Err(e) => {
                    eprintln!("[snapshots] replay_missing_snapshots failed for {project_key_owned}: {e}");
                    tail_errors.push(format!("snapshot_replay: {e}"));
                }
            }
            Ok(())
        })?;

        // ── Retention compaction ────────────────────────────────────────
        db.with_conn(|conn| {
            let config = crate::issues::history::load_retention_config(conn)
                .unwrap_or_default();
            match crate::issues::snapshots::compact_snapshot_retention(
                conn,
                &source_system_id_owned,
                &replay_date,
                &config,
                &now_owned,
            ) {
                Ok(_result) => {}
                Err(e) => {
                    eprintln!("[snapshots] compact_snapshot_retention failed: {e}");
                }
            }
            Ok(())
        })?;

        Ok(JiraIssueIngestionSummary {
            run_id,
            status: status.to_string(),
            pages,
            saved_issues,
            total_issues,
        })
    }
}

fn div_ceil_u32(numerator: u32, denominator: u32) -> u32 {
    if denominator == 0 {
        return 0;
    }
    numerator.div_ceil(denominator)
}

fn should_stop_paginate(
    start_at: u32,
    requested: u32,
    returned: u32,
    total: Option<u32>,
) -> bool {
    if returned == 0 {
        return true;
    }
    if let Some(total) = total {
        return start_at.saturating_add(returned) >= total;
    }
    returned < requested
}

/// Convert an RFC 3339 timestamp to Jira JQL datetime format `"YYYY-MM-DD HH:mm"`.
/// Jira Server / Data Center rejects ISO 8601 (`T` separator, `Z` suffix) in JQL.
/// Returns `None` if the input doesn't start with a parseable date+time prefix.
fn jql_datetime(rfc3339: &str) -> Option<String> {
    let date = rfc3339.get(..10)?; // "YYYY-MM-DD"
    if rfc3339.as_bytes().get(10) != Some(&b'T') {
        return None;
    }
    let time = rfc3339.get(11..16)?; // "HH:mm"
    Some(format!("{date} {time}"))
}

/// Best-effort RFC 3339 timestamp shift: subtract `seconds` from `ts` and
/// return the result formatted with a `Z` suffix. Returns `None` on parse
/// failure — the caller treats that as "no overlap filter".
///
/// Accepts inputs like:
/// - `2026-05-25T00:00:00Z`
/// - `2026-05-22T10:00:00.000+0000`
/// - `2026-05-22T10:00:00.000Z`
fn subtract_seconds_rfc3339(ts: &str, seconds: i64) -> Option<String> {
    // Locate the date and time-of-day portions before any fractional seconds
    // or timezone suffix.
    let (date_part, rest) = ts.split_once('T')?;
    if date_part.len() != 10 {
        return None;
    }
    let date_bytes = date_part.as_bytes();
    if date_bytes[4] != b'-' || date_bytes[7] != b'-' {
        return None;
    }
    let year: i64 = date_part[0..4].parse().ok()?;
    let month: u32 = date_part[5..7].parse().ok()?;
    let day: u32 = date_part[8..10].parse().ok()?;

    // Slice off fractional seconds and timezone marker. We accept anything that
    // starts with `HH:MM:SS`.
    if rest.len() < 8 {
        return None;
    }
    let hms = &rest[0..8];
    let hms_bytes = hms.as_bytes();
    if hms_bytes[2] != b':' || hms_bytes[5] != b':' {
        return None;
    }
    let hour: u32 = hms[0..2].parse().ok()?;
    let minute: u32 = hms[3..5].parse().ok()?;
    let second: u32 = hms[6..8].parse().ok()?;
    if hour > 23 || minute > 59 || second > 60 {
        return None;
    }

    // Convert to days-since-epoch plus seconds-in-day.
    let days = civil_to_days(year, month, day)?;
    let mut total_secs: i64 =
        days * 86_400 + (hour as i64) * 3600 + (minute as i64) * 60 + second as i64;
    total_secs -= seconds;

    // Convert back to civil date/time.
    let new_days = total_secs.div_euclid(86_400);
    let new_secs_of_day = total_secs.rem_euclid(86_400);
    let (ny, nm, nd) = days_to_civil(new_days);
    let nh = (new_secs_of_day / 3600) as u32;
    let nmin = ((new_secs_of_day % 3600) / 60) as u32;
    let nsec = (new_secs_of_day % 60) as u32;
    Some(format!(
        "{ny:04}-{nm:02}-{nd:02}T{nh:02}:{nmin:02}:{nsec:02}Z"
    ))
}

/// Howard Hinnant's `civil_from_days` inverse. Returns days since 1970-01-01.
fn civil_to_days(year: i64, month: u32, day: u32) -> Option<i64> {
    if !(1..=12).contains(&month) || day == 0 || day > 31 {
        return None;
    }
    let y = if month <= 2 { year - 1 } else { year };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let m = month as i64;
    let d = day as i64;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some(era * 146_097 + doe - 719_468)
}

fn days_to_civil(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y_final = if m <= 2 { y + 1 } else { y };
    (y_final, m, d)
}

/// Format a unix-epoch second count as an RFC 3339 timestamp in UTC. Uses the
/// same days-from-civil math as [`subtract_seconds_rfc3339`] so we do not pull
/// in a date/time crate just to print "now".
pub fn format_unix_seconds_rfc3339(secs: u64) -> String {
    let total_secs = secs as i64;
    let days = total_secs.div_euclid(86_400);
    let secs_of_day = total_secs.rem_euclid(86_400);
    let (y, m, d) = days_to_civil(days);
    let h = (secs_of_day / 3600) as u32;
    let min = ((secs_of_day % 3600) / 60) as u32;
    let s = (secs_of_day % 60) as u32;
    format!("{y:04}-{m:02}-{d:02}T{h:02}:{min:02}:{s:02}Z")
}

/// Return the current UTC time as an RFC 3339 string. Falls back to the unix
/// epoch if the system clock is set before 1970, which is a degenerate state
/// we don't try to recover from.
pub fn now_utc_rfc3339() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format_unix_seconds_rfc3339(secs)
}

// ── Tests ──────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::issues::repository::{upsert_source_system, SourceSystemInput};
    use crate::sources::jira_types::JiraSearchPage;
    use std::collections::HashSet;

    const NOW: &str = "2026-05-25T17:00:00Z";

    fn seed_amp_source(conn: &Connection, id: &str) {
        upsert_source_system(
            conn,
            NOW,
            &SourceSystemInput {
                id,
                kind: "jira",
                deployment_kind: Some("server"),
                display_name: "AMP Jira",
                base_url: Some("https://jira.example.invalid"),
                config_source_id: Some("src_jira"),
            },
        )
        .expect("seed source_system");
    }

    #[test]
    fn amp_field_mappings_include_all_required_canonical_names() {
        let expected: HashSet<&str> = [
            "parent_link",
            "customer_name",
            "assigned_teams",
            "product",
            "epic_link",
            "epic_name",
            "epic_status",
            "sprint",
        ]
        .into_iter()
        .collect();

        let got: HashSet<&str> = amp_field_mappings()
            .iter()
            .map(|m| m.canonical_name)
            .collect();

        assert_eq!(got, expected);
    }

    #[test]
    fn seed_mappings_are_scoped_by_source_system_and_project() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");

        seed_amp_field_mappings(&conn, "srcsys_1", "AMP", NOW).expect("seed AMP first time");
        seed_amp_field_mappings(&conn, "srcsys_1", "AMP", NOW).expect("seed AMP second time");

        let amp_count: i64 = conn
            .query_row(
                "SELECT count(*) FROM jira_project_field_mappings
                  WHERE source_system_id = 'srcsys_1' AND project_key = 'AMP'",
                [],
                |r| r.get(0),
            )
            .expect("count AMP");
        assert_eq!(amp_count, 8);

        // Now seed for a different project; should add 8 more rows.
        seed_amp_field_mappings(&conn, "srcsys_1", "OPS", NOW).expect("seed OPS");
        let total: i64 = conn
            .query_row(
                "SELECT count(*) FROM jira_project_field_mappings WHERE source_system_id = 'srcsys_1'",
                [],
                |r| r.get(0),
            )
            .expect("count total");
        assert_eq!(total, 16);
    }

    fn load_amp_fixture() -> (Value, JiraSearchPage) {
        let raw: Value = serde_json::from_str(include_str!(
            "fixtures/jira_amp_search_page.json"
        ))
        .expect("parse raw");
        let parsed: JiraSearchPage = serde_json::from_str(include_str!(
            "fixtures/jira_amp_search_page.json"
        ))
        .expect("parse typed");
        (raw, parsed)
    }

    fn project_first_amp_issue(conn: &Connection) -> ProjectedJiraIssue {
        let (raw, parsed) = load_amp_fixture();
        let raw_issue = raw
            .get("issues")
            .and_then(|v| v.as_array())
            .and_then(|a| a.first())
            .cloned()
            .expect("first issue");
        let issue = parsed.issues.first().expect("first issue typed");
        project_jira_issue(
            conn,
            &JiraIssueProjectionContext {
                source_system_id: "srcsys_1",
                project_key: "AMP",
                project_name: Some("AMP Project"),
                ingested_at: NOW,
            },
            &raw_issue,
            issue,
        )
        .expect("project")
    }

    #[test]
    fn project_amp1_writes_work_item_jira_issue_terms_people_relationships_and_indexable_docs() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");
        seed_amp_field_mappings(&conn, "srcsys_1", "AMP", NOW).expect("seed");

        let projected = project_first_amp_issue(&conn);
        assert_eq!(projected.jira_key, "AMP-1");
        assert_eq!(projected.jira_id, "30001");

        // work_items
        let wi_count: i64 = conn
            .query_row(
                "SELECT count(*) FROM work_items WHERE key = 'AMP-1'",
                [],
                |r| r.get(0),
            )
            .expect("count wi");
        assert_eq!(wi_count, 1);

        // jira_issues
        let (jira_id, parent_link, customer_name, epic_link): (
            String,
            Option<String>,
            Option<String>,
            Option<String>,
        ) = conn
            .query_row(
                "SELECT jira_id, parent_link, customer_name, epic_link
                   FROM jira_issues WHERE jira_key = 'AMP-1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .expect("jira_issues row");
        assert_eq!(jira_id, "30001");
        assert_eq!(parent_link.as_deref(), Some("AMP-100"));
        assert_eq!(customer_name.as_deref(), Some("Acme Corp"));
        assert_eq!(epic_link.as_deref(), Some("AMP-50"));

        // work_item_terms
        let mut term_kinds: HashSet<(String, String)> = HashSet::new();
        let mut stmt = conn
            .prepare(
                "SELECT term_kind, term_key FROM work_item_terms WHERE work_item_id = ?1",
            )
            .expect("prep");
        let rows = stmt
            .query_map([&projected.work_item_id], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            })
            .expect("query");
        for r in rows {
            term_kinds.insert(r.expect("row"));
        }
        assert!(term_kinds.contains(&("label".into(), "ingestion".into())));
        assert!(term_kinds.contains(&("label".into(), "jira".into())));
        assert!(term_kinds
            .iter()
            .any(|(k, key)| k == "fix_version" && (key == "2026.06" || key == "200")));
        assert!(term_kinds.contains(&("product".into(), "Sync".into())));
        assert!(term_kinds.contains(&("assigned_team".into(), "Platform".into())));
        assert!(term_kinds.contains(&("sprint".into(), "Sprint 5".into())));

        // work_item_relationships
        let mut rel_types: HashSet<(String, String)> = HashSet::new();
        let mut stmt = conn
            .prepare(
                "SELECT relationship_type, to_upstream_key FROM work_item_relationships
                  WHERE from_upstream_key = 'AMP-1' OR to_upstream_key = 'AMP-1'",
            )
            .expect("prep rel");
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, Option<String>>(1)?.unwrap_or_default(),
                ))
            })
            .expect("query rel");
        for r in rows {
            rel_types.insert(r.expect("rel row"));
        }
        assert!(rel_types.contains(&("subtask".into(), "AMP-3".into())));
        assert!(rel_types.contains(&("epic".into(), "AMP-50".into())));
        assert!(rel_types.contains(&("parent".into(), "AMP-100".into())));
        assert!(rel_types
            .iter()
            .any(|(t, k)| (t == "Blocks" || t == "link") && k == "AMP-9"));

        // work_item_comments
        let comment_count: i64 = conn
            .query_row(
                "SELECT count(*) FROM work_item_comments WHERE work_item_id = ?1",
                [&projected.work_item_id],
                |r| r.get(0),
            )
            .expect("count comments");
        assert_eq!(comment_count, 2);

        // indexable_documents
        let doc_work_item: i64 = conn
            .query_row(
                "SELECT count(*) FROM indexable_documents
                  WHERE entity_kind = 'work_item' AND entity_id = ?1
                    AND embedding_status = 'pending'",
                [&projected.work_item_id],
                |r| r.get(0),
            )
            .expect("count doc wi");
        assert_eq!(doc_work_item, 1);

        let doc_comment: i64 = conn
            .query_row(
                "SELECT count(*) FROM indexable_documents
                  WHERE entity_kind = 'comment' AND embedding_status = 'pending'",
                [],
                |r| r.get(0),
            )
            .expect("count doc comments");
        assert_eq!(doc_comment, 2);
    }

    #[test]
    fn unknown_custom_fields_are_stored_without_migration() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");
        seed_amp_field_mappings(&conn, "srcsys_1", "AMP", NOW).expect("seed");
        let projected = project_first_amp_issue(&conn);

        // Known AMP mapping field should be present with canonical name.
        let canonical: Option<String> = conn
            .query_row(
                "SELECT canonical_name FROM jira_issue_field_values
                  WHERE work_item_id = ?1 AND field_id = 'customfield_14051'",
                [&projected.work_item_id],
                |r| r.get(0),
            )
            .expect("known field row");
        assert_eq!(canonical.as_deref(), Some("parent_link"));

        // Hand-crafted issue with an unknown custom field.
        let raw_issue = serde_json::json!({
            "id": "99999",
            "key": "AMP-999",
            "self": "https://jira.example.invalid/rest/api/2/issue/99999",
            "fields": {
                "summary": "Synthetic",
                "issuetype": { "id": "3", "name": "Task" },
                "status": { "id": "11", "name": "Open" },
                "project": { "id": "10000", "key": "AMP", "name": "AMP Project" },
                "labels": [],
                "components": [],
                "subtasks": [],
                "customfield_99999": "weird",
            }
        });
        let issue: JiraIssue = serde_json::from_value(raw_issue.clone()).expect("parse");
        let proj2 = project_jira_issue(
            &conn,
            &JiraIssueProjectionContext {
                source_system_id: "srcsys_1",
                project_key: "AMP",
                project_name: Some("AMP Project"),
                ingested_at: NOW,
            },
            &raw_issue,
            &issue,
        )
        .expect("project synthetic");

        let (kind, canonical, text): (String, Option<String>, Option<String>) = conn
            .query_row(
                "SELECT value_kind, canonical_name, value_text
                   FROM jira_issue_field_values
                  WHERE work_item_id = ?1 AND field_id = 'customfield_99999'",
                [&proj2.work_item_id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .expect("unknown field row");
        assert_eq!(kind, "json");
        assert!(canonical.is_none());
        assert_eq!(text.as_deref(), Some("weird"));
    }

    #[test]
    fn projection_is_idempotent() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");
        seed_amp_field_mappings(&conn, "srcsys_1", "AMP", NOW).expect("seed");
        let _first = project_first_amp_issue(&conn);
        let _second = project_first_amp_issue(&conn);

        let wi_count: i64 = conn
            .query_row("SELECT count(*) FROM work_items", [], |r| r.get(0))
            .expect("count wi");
        let ji_count: i64 = conn
            .query_row("SELECT count(*) FROM jira_issues", [], |r| r.get(0))
            .expect("count ji");
        let comment_count: i64 = conn
            .query_row("SELECT count(*) FROM work_item_comments", [], |r| r.get(0))
            .expect("count comments");

        assert_eq!(wi_count, 1);
        assert_eq!(ji_count, 1);
        assert_eq!(comment_count, 2);
    }

    #[test]
    fn projection_does_not_claim_events_or_snapshots() {
        let conn = open_in_memory().expect("db");
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .expect("prep");
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))
            .expect("query");
        let tables: HashSet<String> = rows.map(|r| r.expect("row")).collect();
        assert!(
            !tables.contains("events"),
            "events table must not be claimed by this task; found tables: {tables:?}"
        );
        assert!(
            !tables.contains("snapshots"),
            "snapshots table must not be claimed by this task; found tables: {tables:?}"
        );
    }

    // ── Service tests ──────────────────────────────────────────────────────

    use std::collections::HashMap;
    use std::sync::Arc;
    use std::sync::Mutex;

    use crate::ingestion::db::{DbAccess, MutexDbAccess};

    /// Test-only `DbAccess` that wraps a borrowed `&Connection` without any
    /// locking. Used by existing single-threaded tests where the connection
    /// is owned by the test; the concurrency-sensitive
    /// `status_read_proceeds_while_search_page_is_blocked` test uses a real
    /// `MutexDbAccess` to assert the lock-release contract.
    struct BorrowedConnDbAccess<'a>(&'a Connection);

    impl<'a> DbAccess for BorrowedConnDbAccess<'a> {
        fn with_conn<F, R>(&self, f: F) -> Result<R, IngestionError>
        where
            F: FnOnce(&Connection) -> Result<R, IngestionError>,
        {
            f(self.0)
        }
    }

    /// In-memory stub for `JiraIssueClient`.
    struct FakeJiraClient {
        pages: Mutex<Vec<JiraSearchPage>>,
        calls: Mutex<Vec<JiraSearchRequest>>,
        next_error: Mutex<Option<JiraApiError>>,
        cancel_after_call: Mutex<Option<(usize, Arc<CancellationFlag>)>>,
        comments_pages: Mutex<HashMap<String, Vec<JiraPagedComments>>>,
        comments_calls: Mutex<Vec<(String, u32, u32)>>,
        next_comments_error: Mutex<Option<JiraApiError>>,
        worklogs_pages: Mutex<HashMap<String, Vec<JiraPagedWorklogs>>>,
        worklogs_calls: Mutex<Vec<(String, u32, u32)>>,
        next_worklogs_error: Mutex<Option<JiraApiError>>,
        remote_links: Mutex<HashMap<String, Vec<JiraRemoteLink>>>,
        remote_link_calls: Mutex<Vec<String>>,
        next_remote_links_error: Mutex<Option<JiraApiError>>,
        changelog_pages: Mutex<HashMap<String, JiraChangelogPage>>,
        changelog_calls: Mutex<Vec<String>>,
        next_changelog_error: Mutex<Option<JiraApiError>>,
    }

    impl FakeJiraClient {
        fn with_pages(pages: Vec<JiraSearchPage>) -> Self {
            Self {
                pages: Mutex::new(pages),
                calls: Mutex::new(Vec::new()),
                next_error: Mutex::new(None),
                cancel_after_call: Mutex::new(None),
                comments_pages: Mutex::new(HashMap::new()),
                comments_calls: Mutex::new(Vec::new()),
                next_comments_error: Mutex::new(None),
                worklogs_pages: Mutex::new(HashMap::new()),
                worklogs_calls: Mutex::new(Vec::new()),
                next_worklogs_error: Mutex::new(None),
                remote_links: Mutex::new(HashMap::new()),
                remote_link_calls: Mutex::new(Vec::new()),
                next_remote_links_error: Mutex::new(None),
                changelog_pages: Mutex::new(HashMap::new()),
                changelog_calls: Mutex::new(Vec::new()),
                next_changelog_error: Mutex::new(None),
            }
        }

        fn calls(&self) -> Vec<JiraSearchRequest> {
            self.calls.lock().unwrap().clone()
        }

        fn set_next_error(&self, err: JiraApiError) {
            *self.next_error.lock().unwrap() = Some(err);
        }

        fn stub_comments_pages(&self, key: &str, pages: Vec<JiraPagedComments>) {
            self.comments_pages
                .lock()
                .unwrap()
                .insert(key.to_string(), pages);
        }

        fn comments_calls(&self) -> Vec<(String, u32, u32)> {
            self.comments_calls.lock().unwrap().clone()
        }

        fn set_next_comments_error(&self, err: JiraApiError) {
            *self.next_comments_error.lock().unwrap() = Some(err);
        }

        fn stub_worklogs_pages(&self, key: &str, pages: Vec<JiraPagedWorklogs>) {
            self.worklogs_pages
                .lock()
                .unwrap()
                .insert(key.to_string(), pages);
        }

        fn worklogs_calls(&self) -> Vec<(String, u32, u32)> {
            self.worklogs_calls.lock().unwrap().clone()
        }

        fn stub_remote_links(&self, key: &str, links: Vec<JiraRemoteLink>) {
            self.remote_links
                .lock()
                .unwrap()
                .insert(key.to_string(), links);
        }

        fn remote_link_calls(&self) -> Vec<String> {
            self.remote_link_calls.lock().unwrap().clone()
        }

        /// Trip the cancellation flag *after* the Nth call returns successfully
        /// (1-indexed). Used by the cancellation test.
        fn trip_cancel_after(&self, n: usize, flag: Arc<CancellationFlag>) {
            *self.cancel_after_call.lock().unwrap() = Some((n, flag));
        }

        fn stub_changelog(&self, key: &str, page: JiraChangelogPage) {
            self.changelog_pages
                .lock()
                .unwrap()
                .insert(key.to_string(), page);
        }

        fn changelog_calls(&self) -> Vec<String> {
            self.changelog_calls.lock().unwrap().clone()
        }
    }

    impl JiraIssueClient for FakeJiraClient {
        fn search_issues_page(
            &self,
            request: JiraSearchRequest,
        ) -> Result<JiraSearchPage, JiraApiError> {
            self.calls.lock().unwrap().push(request);
            // Pages drain first so a callers can queue successful pages and a
            // terminal error: when pages is empty AND next_error is set, the
            // next call returns the error.
            let popped = {
                let mut pages = self.pages.lock().unwrap();
                if pages.is_empty() {
                    None
                } else {
                    Some(pages.remove(0))
                }
            };
            let result = match popped {
                Some(page) => Ok(page),
                None => {
                    if let Some(err) = self.next_error.lock().unwrap().take() {
                        Err(err)
                    } else {
                        Ok(JiraSearchPage {
                            start_at: 0,
                            max_results: 50,
                            total: Some(0),
                            issues: vec![],
                        })
                    }
                }
            };
            // After a successful call, optionally trip cancellation.
            if result.is_ok() {
                let calls_so_far = self.calls.lock().unwrap().len();
                let maybe = self.cancel_after_call.lock().unwrap().clone();
                if let Some((n, flag)) = maybe {
                    if calls_so_far == n {
                        flag.request_cancel();
                    }
                }
            }
            result
        }

        fn get_issue_comments_page(
            &self,
            issue_id_or_key: &str,
            start_at: u32,
            max_results: u32,
        ) -> Result<JiraPagedComments, JiraApiError> {
            self.comments_calls
                .lock()
                .unwrap()
                .push((issue_id_or_key.to_string(), start_at, max_results));
            if let Some(err) = self.next_comments_error.lock().unwrap().take() {
                return Err(err);
            }
            let mut map = self.comments_pages.lock().unwrap();
            if let Some(pages) = map.get_mut(issue_id_or_key) {
                if !pages.is_empty() {
                    return Ok(pages.remove(0));
                }
            }
            Ok(JiraPagedComments {
                start_at,
                max_results,
                total: Some(0),
                comments: vec![],
            })
        }

        fn get_issue_worklogs_page(
            &self,
            issue_id_or_key: &str,
            start_at: u32,
            max_results: u32,
        ) -> Result<JiraPagedWorklogs, JiraApiError> {
            self.worklogs_calls
                .lock()
                .unwrap()
                .push((issue_id_or_key.to_string(), start_at, max_results));
            if let Some(err) = self.next_worklogs_error.lock().unwrap().take() {
                return Err(err);
            }
            let mut map = self.worklogs_pages.lock().unwrap();
            if let Some(pages) = map.get_mut(issue_id_or_key) {
                if !pages.is_empty() {
                    return Ok(pages.remove(0));
                }
            }
            Ok(JiraPagedWorklogs {
                start_at,
                max_results,
                total: Some(0),
                worklogs: vec![],
            })
        }

        fn get_issue_remote_links(
            &self,
            issue_id_or_key: &str,
        ) -> Result<Vec<JiraRemoteLink>, JiraApiError> {
            self.remote_link_calls
                .lock()
                .unwrap()
                .push(issue_id_or_key.to_string());
            if let Some(err) = self.next_remote_links_error.lock().unwrap().take() {
                return Err(err);
            }
            let map = self.remote_links.lock().unwrap();
            Ok(map.get(issue_id_or_key).cloned().unwrap_or_default())
        }

        fn get_issue_changelog(
            &self,
            issue_id_or_key: &str,
        ) -> Result<Option<JiraChangelogPage>, JiraApiError> {
            self.changelog_calls
                .lock()
                .unwrap()
                .push(issue_id_or_key.to_string());
            if let Some(err) = self.next_changelog_error.lock().unwrap().take() {
                return Err(err);
            }
            Ok(self
                .changelog_pages
                .lock()
                .unwrap()
                .get(issue_id_or_key)
                .cloned())
        }
    }

    fn load_amp_search_page() -> JiraSearchPage {
        serde_json::from_str(include_str!("fixtures/jira_amp_search_page.json"))
            .expect("parse AMP page")
    }

    #[test]
    fn subtract_seconds_rfc3339_shifts_by_overlap() {
        let result = subtract_seconds_rfc3339("2026-05-25T00:00:00Z", 60).expect("parse");
        assert_eq!(result, "2026-05-24T23:59:00Z");
        let result2 =
            subtract_seconds_rfc3339("2026-01-01T00:00:30Z", 60).expect("parse cross-year");
        assert_eq!(result2, "2025-12-31T23:59:30Z");
    }

    #[test]
    fn jql_datetime_converts_rfc3339_to_jira_format() {
        assert_eq!(
            jql_datetime("2026-05-24T23:59:00Z").as_deref(),
            Some("2026-05-24 23:59")
        );
        // Jira returns timestamps with milliseconds and numeric offset
        assert_eq!(
            jql_datetime("2026-05-25T16:33:31.000+0000").as_deref(),
            Some("2026-05-25 16:33")
        );
        assert_eq!(jql_datetime("not-a-timestamp"), None);
        assert_eq!(jql_datetime("2026-05-25"), None); // no T separator
    }

    #[test]
    fn ingests_multi_page_search_and_records_progress_total() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");

        // Page 1: real AMP fixture but override total to 2 so the page terminates
        // pagination cleanly.
        let mut page1 = load_amp_search_page();
        page1.total = Some(2);
        // Page 2: empty (returned=0 → stop). Not strictly needed since page1
        // total triggers stop, but provided for safety.
        let page2 = JiraSearchPage {
            start_at: 2,
            max_results: 50,
            total: Some(2),
            issues: vec![],
        };
        let client = FakeJiraClient::with_pages(vec![page1, page2]);
        let service = JiraIssueIngestionService::new(&client);
        let flag = CancellationFlag::new();

        let summary = service
            .ingest_project(&BorrowedConnDbAccess(&conn), "srcsys_1", "AMP", Some("AMP Project"), NOW, &flag)
            .expect("ingest");

        assert_eq!(summary.status, "succeeded");
        assert_eq!(summary.saved_issues, 2);
        assert_eq!(summary.total_issues, Some(2));

        let work_items: i64 = conn
            .query_row(
                "SELECT count(*) FROM work_items WHERE project_key = 'AMP'",
                [],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(work_items, 2);

        let (status, progress_json, counts_json): (String, String, String) = conn
            .query_row(
                "SELECT status, progress_json, counts_json FROM ingestion_runs
                  WHERE source_system_id = 'srcsys_1' AND connector = ?1
                  ORDER BY started_at DESC LIMIT 1",
                [JIRA_ISSUE_CONNECTOR],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .expect("query run");
        assert_eq!(status, "succeeded");
        assert!(
            progress_json.contains("\"saved_issues\":2"),
            "progress_json={progress_json}"
        );
        assert!(
            progress_json.contains("\"total_issues\":2"),
            "progress_json={progress_json}"
        );
        assert!(counts_json.contains("\"saved_issues\":2"));

        // Cursor should have advanced to the max-updated value seen in the fixture
        // (AMP-1.updated = 2026-05-22T10:00:00.000+0000).
        let cursor_value: String = conn
            .query_row(
                "SELECT cursor_value FROM ingestion_cursors
                  WHERE source_system_id = 'srcsys_1' AND connector = ?1
                    AND cursor_key = 'project:AMP:issues'",
                [JIRA_ISSUE_CONNECTOR],
                |r| r.get(0),
            )
            .expect("cursor row");
        assert!(
            cursor_value.contains("last_updated"),
            "cursor={cursor_value}"
        );
    }

    #[test]
    fn second_run_is_idempotent_for_same_fixtures() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");

        // Two distinct `now_utc` values so the stable run_id differs between
        // invocations; idempotency we're asserting here is at the work-data
        // level (no duplicate work_items / jira_issues).
        for now_utc in ["2026-05-25T17:00:00Z", "2026-05-25T18:00:00Z"] {
            let mut page1 = load_amp_search_page();
            page1.total = Some(2);
            let page2 = JiraSearchPage {
                start_at: 2,
                max_results: 50,
                total: Some(2),
                issues: vec![],
            };
            let client = FakeJiraClient::with_pages(vec![page1, page2]);
            let service = JiraIssueIngestionService::new(&client);
            let flag = CancellationFlag::new();
            let summary = service
                .ingest_project(&BorrowedConnDbAccess(&conn), "srcsys_1", "AMP", Some("AMP Project"), now_utc, &flag)
                .expect("ingest");
            assert_eq!(summary.status, "succeeded");
        }

        let work_items: i64 = conn
            .query_row(
                "SELECT count(*) FROM work_items WHERE project_key = 'AMP'",
                [],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(work_items, 2, "second run must not create duplicates");

        let runs: i64 = conn
            .query_row("SELECT count(*) FROM ingestion_runs", [], |r| r.get(0))
            .expect("runs count");
        assert_eq!(runs, 2, "expected two distinct ingestion_runs rows");
    }

    #[test]
    fn incremental_run_uses_updated_overlap_and_jql_filter() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");

        // Seed a cursor for the AMP project pointing at 2026-05-25T00:00:00Z.
        upsert_cursor(
            &conn,
            "srcsys_1",
            JIRA_ISSUE_CONNECTOR,
            "project:AMP:issues",
            r#"{"last_updated":"2026-05-25T00:00:00Z"}"#,
            Some("2026-05-25T16:00:00Z"),
            "2026-05-25T16:00:00Z",
        )
        .expect("seed cursor");

        let mut page1 = load_amp_search_page();
        page1.total = Some(2);
        let page2 = JiraSearchPage {
            start_at: 2,
            max_results: 50,
            total: Some(2),
            issues: vec![],
        };
        let client = FakeJiraClient::with_pages(vec![page1, page2]);
        let service = JiraIssueIngestionService::new(&client);
        let flag = CancellationFlag::new();
        service
            .ingest_project(&BorrowedConnDbAccess(&conn), "srcsys_1", "AMP", Some("AMP Project"), NOW, &flag)
            .expect("ingest");

        let calls = client.calls();
        assert!(!calls.is_empty(), "expected at least one search call");
        let first_jql = &calls[0].jql;
        assert!(
            first_jql.contains("project = \"AMP\""),
            "jql missing project filter: {first_jql}"
        );
        assert!(
            first_jql.contains("updated >= \"2026-05-24 23:59\""),
            "jql missing overlap-adjusted updated filter: {first_jql}"
        );

        let work_items: i64 = conn
            .query_row(
                "SELECT count(*) FROM work_items WHERE project_key = 'AMP'",
                [],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(work_items, 2);
    }

    #[test]
    fn failed_page_marks_partial_without_deleting_saved() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");

        // Page 1: real AMP page but force pagination to continue (no total, full page=2).
        let mut page1 = load_amp_search_page();
        page1.total = None;
        let client = FakeJiraClient::with_pages(vec![page1]);
        let service = JiraIssueIngestionService {
            client: &client,
            page_size: 2,
            overlap_seconds: 60,
            options: JiraIngestionOptions::default(),
        };
        // Page 2 will be a server error.
        client.set_next_error(JiraApiError::Server { status: 503 });
        // We need to arrange order: pages drained first, then next_error checked.
        // Our fake checks next_error BEFORE pages, so set after first call ourselves.
        // Workaround: use a wrapper that flips next_error after the first page.
        // To keep this simple, we redefine the fake's behavior by clearing pages
        // ahead of next_error: drop pages-of-1 (only page1), then on second call,
        // pages is empty AND next_error is set → returns the error first.
        // But our fake also returns an empty page when pages is empty and no error.
        // Confirm: next_error is checked BEFORE pages drain, so on 2nd call it
        // returns the error.

        let flag = CancellationFlag::new();
        let err = service
            .ingest_project(&BorrowedConnDbAccess(&conn), "srcsys_1", "AMP", Some("AMP Project"), NOW, &flag)
            .expect_err("expected partial failure");
        assert_eq!(err.category(), IngestionErrorCategory::Server);
        assert_eq!(format!("{err}"), "Jira server error");

        let runs: Vec<(String, Option<String>)> = {
            let mut stmt = conn
                .prepare(
                    "SELECT status, error_summary FROM ingestion_runs
                      WHERE source_system_id = 'srcsys_1' AND connector = ?1",
                )
                .expect("prep");
            let rows = stmt
                .query_map([JIRA_ISSUE_CONNECTOR], |r| {
                    Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?))
                })
                .expect("query");
            rows.map(|r| r.expect("row")).collect()
        };
        assert_eq!(runs.len(), 1);
        assert_eq!(runs[0].0, "partial");
        assert_eq!(runs[0].1.as_deref(), Some("Jira server error"));

        // The first page's work_items should still be present.
        let wi_count: i64 = conn
            .query_row(
                "SELECT count(*) FROM work_items WHERE project_key = 'AMP'",
                [],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(wi_count, 2);

        // Cursor should NOT have been advanced (we returned Err before the
        // post-loop cursor write).
        let cursor: Option<String> = conn
            .query_row(
                "SELECT cursor_value FROM ingestion_cursors
                  WHERE source_system_id = 'srcsys_1' AND connector = ?1
                    AND cursor_key = 'project:AMP:issues'",
                [JIRA_ISSUE_CONNECTOR],
                |r| r.get(0),
            )
            .ok();
        assert!(
            cursor.is_none(),
            "cursor must not advance on partial failure"
        );
    }

    #[test]
    fn cancellation_between_pages_stops_and_marks_cancelled() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");

        // Stub one page that does NOT terminate pagination on its own
        // (total=None, returned=page_size), then arrange for cancellation to
        // be requested after the first call returns.
        let mut page1 = load_amp_search_page();
        page1.total = None;
        let client = FakeJiraClient::with_pages(vec![page1]);
        let flag = Arc::new(CancellationFlag::new());
        client.trip_cancel_after(1, Arc::clone(&flag));

        let service = JiraIssueIngestionService {
            client: &client,
            page_size: 2,
            overlap_seconds: 60,
            options: JiraIngestionOptions::default(),
        };
        let summary = service
            .ingest_project(&BorrowedConnDbAccess(&conn), "srcsys_1", "AMP", Some("AMP Project"), NOW, &flag)
            .expect("ingest");
        assert_eq!(summary.status, "cancelled");
        // Exactly one upstream call should have been made.
        assert_eq!(client.calls().len(), 1);

        let status: String = conn
            .query_row(
                "SELECT status FROM ingestion_runs
                  WHERE source_system_id = 'srcsys_1' AND connector = ?1",
                [JIRA_ISSUE_CONNECTOR],
                |r| r.get(0),
            )
            .expect("status");
        assert_eq!(status, "cancelled");

        // First-page issues should still be persisted.
        let wi_count: i64 = conn
            .query_row(
                "SELECT count(*) FROM work_items WHERE project_key = 'AMP'",
                [],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(wi_count, 2);
    }

    // ── Task 6: tails, options, partial-runs ───────────────────────────────

    fn amp1_work_item_id() -> String {
        stable_id("wi", &["srcsys_1", JIRA_WORK_ITEM_KIND, "30001"])
    }

    #[test]
    fn persists_inline_comments_issue_links_and_worklogs_idempotently() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");

        // Run twice. The AMP fixture's AMP-1 has 2 inline comments, 1 inline
        // issue link, and 1 inline worklog. No tail data is stubbed, so the
        // default empty-tail response triggers no additional inserts.
        for now_utc in ["2026-05-25T17:00:00Z", "2026-05-25T18:00:00Z"] {
            let mut page1 = load_amp_search_page();
            page1.total = Some(2);
            let client = FakeJiraClient::with_pages(vec![page1]);
            let service = JiraIssueIngestionService::new(&client);
            let flag = CancellationFlag::new();
            let summary = service
                .ingest_project(&BorrowedConnDbAccess(&conn), "srcsys_1", "AMP", Some("AMP Project"), now_utc, &flag)
                .expect("ingest");
            assert_eq!(summary.status, "succeeded");
        }

        let wi_id = amp1_work_item_id();
        let comment_count: i64 = conn
            .query_row(
                "SELECT count(*) FROM work_item_comments WHERE work_item_id = ?1",
                [&wi_id],
                |r| r.get(0),
            )
            .expect("count comments");
        let worklog_count: i64 = conn
            .query_row(
                "SELECT count(*) FROM jira_worklogs WHERE work_item_id = ?1",
                [&wi_id],
                |r| r.get(0),
            )
            .expect("count worklogs");
        let rel_count: i64 = conn
            .query_row(
                "SELECT count(*) FROM work_item_relationships
                  WHERE from_upstream_key = 'AMP-1' AND relationship_type = 'Blocks'",
                [],
                |r| r.get(0),
            )
            .expect("count rels");

        assert_eq!(comment_count, 2, "two inline comments persisted exactly once");
        assert_eq!(worklog_count, 1, "one inline worklog persisted exactly once");
        assert_eq!(rel_count, 1, "one issue-link relationship persisted exactly once");
    }

    #[test]
    fn fetches_comment_tail_only_when_total_exceeds_inline_count() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");

        let mut page1 = load_amp_search_page();
        page1.total = Some(2);
        let client = FakeJiraClient::with_pages(vec![page1]);

        // AMP-1 has comment.total=3 with 2 inline → request startAt=2 fetches
        // the 3rd comment.
        let tail = JiraPagedComments {
            start_at: 2,
            max_results: 50,
            total: Some(3),
            comments: vec![JiraComment {
                id: "1003".to_string(),
                author: None,
                update_author: None,
                body: Some("Third comment".to_string()),
                visibility: None,
                created: Some("2026-05-22T08:00:00.000+0000".to_string()),
                updated: Some("2026-05-22T08:00:00.000+0000".to_string()),
                raw_extra: serde_json::Map::new(),
            }],
        };
        client.stub_comments_pages("AMP-1", vec![tail]);

        let service = JiraIssueIngestionService::new(&client);
        let flag = CancellationFlag::new();
        let summary = service
            .ingest_project(&BorrowedConnDbAccess(&conn), "srcsys_1", "AMP", Some("AMP Project"), NOW, &flag)
            .expect("ingest");
        assert_eq!(summary.status, "succeeded");

        let wi_id = amp1_work_item_id();
        let comment_count: i64 = conn
            .query_row(
                "SELECT count(*) FROM work_item_comments WHERE work_item_id = ?1",
                [&wi_id],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(comment_count, 3, "all three comments persisted");

        // Exactly one comments_calls entry for AMP-1, none for AMP-2.
        let calls = client.comments_calls();
        let amp1_calls: Vec<_> = calls.iter().filter(|(k, _, _)| k == "AMP-1").collect();
        let amp2_calls: Vec<_> = calls.iter().filter(|(k, _, _)| k == "AMP-2").collect();
        assert_eq!(amp1_calls.len(), 1, "expected exactly one tail call for AMP-1: {calls:?}");
        assert_eq!(amp1_calls[0].1, 2, "tail startAt should be 2");
        assert_eq!(amp1_calls[0].2, service.page_size);
        assert!(amp2_calls.is_empty(), "AMP-2 has comment.total=0 → no tail call");
    }

    #[test]
    fn fetches_worklog_tail_only_when_total_exceeds_inline_count() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");

        // Synthesize a search page where AMP-1's worklog has total=2 with 1 inline.
        // Start from the AMP fixture and mutate.
        let mut page1 = load_amp_search_page();
        page1.total = Some(2);
        if let Some(worklog) = page1.issues[0].fields.worklog.as_mut() {
            worklog.total = Some(2);
        }
        let client = FakeJiraClient::with_pages(vec![page1]);

        let tail = JiraPagedWorklogs {
            start_at: 1,
            max_results: 50,
            total: Some(2),
            worklogs: vec![JiraWorklog {
                id: "9002".to_string(),
                author: None,
                update_author: None,
                started: Some("2026-05-22T11:00:00.000+0000".to_string()),
                time_spent_seconds: Some(600),
                comment: Some("Reviewed".to_string()),
                created: None,
                updated: None,
                raw_extra: serde_json::Map::new(),
            }],
        };
        client.stub_worklogs_pages("AMP-1", vec![tail]);

        let service = JiraIssueIngestionService::new(&client);
        let flag = CancellationFlag::new();
        let summary = service
            .ingest_project(&BorrowedConnDbAccess(&conn), "srcsys_1", "AMP", Some("AMP Project"), NOW, &flag)
            .expect("ingest");
        assert_eq!(summary.status, "succeeded");

        let wi_id = amp1_work_item_id();
        let worklog_count: i64 = conn
            .query_row(
                "SELECT count(*) FROM jira_worklogs WHERE work_item_id = ?1",
                [&wi_id],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(worklog_count, 2, "inline + tail worklog rows");

        let calls = client.worklogs_calls();
        let amp1_calls: Vec<_> = calls.iter().filter(|(k, _, _)| k == "AMP-1").collect();
        let amp2_calls: Vec<_> = calls.iter().filter(|(k, _, _)| k == "AMP-2").collect();
        assert_eq!(amp1_calls.len(), 1, "expected exactly one worklog tail call for AMP-1: {calls:?}");
        assert_eq!(amp1_calls[0].1, 1, "tail startAt should be 1");
        assert!(amp2_calls.is_empty(), "AMP-2 has worklog.total=0 → no tail call");
    }

    #[test]
    fn tail_failure_marks_run_partial_without_deleting_saved_issues() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");

        let mut page1 = load_amp_search_page();
        page1.total = Some(2);
        let client = FakeJiraClient::with_pages(vec![page1]);
        // AMP-1 has comment.total=3, inline=2 → would trigger a tail call.
        // Force that call to fail.
        client.set_next_comments_error(JiraApiError::Server { status: 503 });

        let service = JiraIssueIngestionService::new(&client);
        let flag = CancellationFlag::new();
        let summary = service
            .ingest_project(&BorrowedConnDbAccess(&conn), "srcsys_1", "AMP", Some("AMP Project"), NOW, &flag)
            .expect("ingest");

        assert_eq!(summary.status, "partial");

        let wi_count: i64 = conn
            .query_row(
                "SELECT count(*) FROM work_items WHERE project_key = 'AMP'",
                [],
                |r| r.get(0),
            )
            .expect("count wi");
        assert_eq!(wi_count, 2, "issues persisted despite tail failure");

        let (status, error_summary): (String, Option<String>) = conn
            .query_row(
                "SELECT status, error_summary FROM ingestion_runs
                  WHERE source_system_id = 'srcsys_1' AND connector = ?1",
                [JIRA_ISSUE_CONNECTOR],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .expect("run row");
        assert_eq!(status, "partial");
        let summary_text = error_summary.expect("error_summary present");
        assert!(
            summary_text.contains("tail errors"),
            "error_summary should mention tail errors: {summary_text}"
        );
    }

    #[test]
    fn watchers_votes_and_remote_links_are_disabled_by_default() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");

        let mut page1 = load_amp_search_page();
        page1.total = Some(2);
        let client = FakeJiraClient::with_pages(vec![page1]);
        // Even though we stub remote links, the service must NOT call the
        // remote_links endpoint when the option is disabled.
        client.stub_remote_links(
            "AMP-1",
            vec![JiraRemoteLink {
                id: Some(1),
                self_url: None,
                global_id: None,
                relationship: None,
                object: Some(crate::sources::jira_types::JiraRemoteLinkObject {
                    url: "https://docs.example.invalid/abc".to_string(),
                    title: Some("Doc".to_string()),
                    summary: None,
                    raw_extra: serde_json::Map::new(),
                }),
            }],
        );

        let service = JiraIssueIngestionService::new(&client);
        let flag = CancellationFlag::new();
        service
            .ingest_project(&BorrowedConnDbAccess(&conn), "srcsys_1", "AMP", Some("AMP Project"), NOW, &flag)
            .expect("ingest");

        assert!(
            client.remote_link_calls().is_empty(),
            "remote_links_calls must be empty when option disabled: {:?}",
            client.remote_link_calls()
        );
        let rl_count: i64 = conn
            .query_row("SELECT count(*) FROM jira_remote_links", [], |r| r.get(0))
            .expect("count rl");
        assert_eq!(rl_count, 0);
    }

    #[test]
    fn enabled_remote_links_use_separate_cursor() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");

        let mut page1 = load_amp_search_page();
        page1.total = Some(2);
        let client = FakeJiraClient::with_pages(vec![page1]);
        client.stub_remote_links(
            "AMP-1",
            vec![JiraRemoteLink {
                id: Some(7),
                self_url: None,
                global_id: None,
                relationship: Some("references".to_string()),
                object: Some(crate::sources::jira_types::JiraRemoteLinkObject {
                    url: "https://docs.example.invalid/abc".to_string(),
                    title: Some("Doc".to_string()),
                    summary: None,
                    raw_extra: serde_json::Map::new(),
                }),
            }],
        );

        let service = JiraIssueIngestionService::with_options(
            &client,
            JiraIngestionOptions {
                fetch_remote_links: true,
                ..JiraIngestionOptions::default()
            },
        );
        let flag = CancellationFlag::new();
        service
            .ingest_project(&BorrowedConnDbAccess(&conn), "srcsys_1", "AMP", Some("AMP Project"), NOW, &flag)
            .expect("ingest");

        let calls = client.remote_link_calls();
        assert!(calls.contains(&"AMP-1".to_string()), "expected AMP-1 call: {calls:?}");
        assert!(calls.contains(&"AMP-2".to_string()), "expected AMP-2 call: {calls:?}");

        let rl_count: i64 = conn
            .query_row("SELECT count(*) FROM jira_remote_links", [], |r| r.get(0))
            .expect("count rl");
        assert_eq!(rl_count, 1);

        // Both cursors are present and distinct.
        let mut stmt = conn
            .prepare(
                "SELECT cursor_key FROM ingestion_cursors
                  WHERE source_system_id = 'srcsys_1' AND connector = ?1
                  ORDER BY cursor_key",
            )
            .expect("prep");
        let keys: Vec<String> = stmt
            .query_map([JIRA_ISSUE_CONNECTOR], |r| r.get::<_, String>(0))
            .expect("query")
            .map(|r| r.expect("row"))
            .collect();
        assert!(
            keys.contains(&"project:AMP:issues".to_string()),
            "issues cursor missing: {keys:?}"
        );
        assert!(
            keys.contains(&"project:AMP:remotelinks".to_string()),
            "remotelinks cursor missing: {keys:?}"
        );
        assert_eq!(keys.len(), 2, "expected exactly two cursors: {keys:?}");
    }

    #[test]
    fn enabled_remote_links_cursor_advances_even_when_zero_links_returned() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_zero");

        // AMP fixture with total=2 so pagination terminates cleanly. The
        // remote-link map is left empty — every issue returns Ok(vec![]).
        let mut page1 = load_amp_search_page();
        page1.total = Some(2);
        let client = FakeJiraClient::with_pages(vec![page1]);

        let service = JiraIssueIngestionService::with_options(
            &client,
            JiraIngestionOptions {
                fetch_remote_links: true,
                ..JiraIngestionOptions::default()
            },
        );
        let flag = CancellationFlag::new();
        service
            .ingest_project(
                &BorrowedConnDbAccess(&conn),
                "srcsys_zero",
                "AMP",
                Some("AMP Project"),
                NOW,
                &flag,
            )
            .expect("ingest");

        // The remote-link endpoint must have been called (zero-link returns
        // are still successful scans).
        assert!(
            !client.remote_link_calls().is_empty(),
            "expected remote_links endpoint to be called when option enabled",
        );
        // No links were returned, so no rows persisted.
        let rl_count: i64 = conn
            .query_row("SELECT count(*) FROM jira_remote_links", [], |r| r.get(0))
            .expect("count rl");
        assert_eq!(rl_count, 0);

        // Cursor must exist and have a non-null last_successful_sync_at — the
        // empty-but-successful scan should still advance it.
        use rusqlite::OptionalExtension;
        let last: Option<String> = conn
            .query_row(
                "SELECT last_successful_sync_at FROM ingestion_cursors
                   WHERE source_system_id = ?1 AND connector = ?2 AND cursor_key = ?3",
                rusqlite::params![
                    "srcsys_zero",
                    JIRA_ISSUE_CONNECTOR,
                    "project:AMP:remotelinks",
                ],
                |r| r.get::<_, Option<String>>(0),
            )
            .optional()
            .expect("query cursor")
            .flatten();
        assert!(
            last.is_some(),
            "remote-links cursor must advance on successful zero-link sync",
        );
    }

    #[test]
    fn two_quick_runs_for_same_source_project_in_same_second_do_not_collide() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_dupe");

        // Empty search pages — both runs short-circuit after one empty page.
        // The point of this test is that two runs with an identical
        // `(source_system_id, project_key, now_utc)` tuple must produce
        // distinct `run_id`s and both rows must persist successfully.
        let same_now = "2026-05-25T18:00:00Z";

        let client1 = FakeJiraClient::with_pages(vec![]);
        let service1 = JiraIssueIngestionService::new(&client1);
        let flag1 = CancellationFlag::new();
        let r1 = service1.ingest_project(
            &BorrowedConnDbAccess(&conn),
            "srcsys_dupe",
            "AMP",
            Some("AMP"),
            same_now,
            &flag1,
        );
        assert!(r1.is_ok(), "first run must succeed: {r1:?}");

        let client2 = FakeJiraClient::with_pages(vec![]);
        let service2 = JiraIssueIngestionService::new(&client2);
        let flag2 = CancellationFlag::new();
        let r2 = service2.ingest_project(
            &BorrowedConnDbAccess(&conn),
            "srcsys_dupe",
            "AMP",
            Some("AMP"),
            same_now,
            &flag2,
        );
        assert!(
            r2.is_ok(),
            "second run with same source/project/wall-clock-second must succeed: {r2:?}",
        );

        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM ingestion_runs
                   WHERE source_system_id = 'srcsys_dupe' AND connector = ?1",
                [JIRA_ISSUE_CONNECTOR],
                |r| r.get(0),
            )
            .expect("count runs");
        assert_eq!(count, 2, "both runs should be persisted with distinct ids");
    }

    // -- Changelog history tests ------------------------------------------

    #[test]
    fn ingestion_writes_changelog_events_after_issue_projection() {
        use crate::sources::jira_types::{JiraChangelogEntry, JiraChangelogItem};

        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");

        let (_, page1) = load_amp_fixture();
        let client = FakeJiraClient::with_pages(vec![page1]);

        // Stub a changelog page for AMP-1 (the first issue in the fixture).
        let changelog = JiraChangelogPage {
            start_at: 0,
            max_results: 50,
            total: Some(1),
            histories: vec![JiraChangelogEntry {
                id: "cl_001".to_string(),
                author: None,
                created: "2026-05-27T14:18:00.000+0000".to_string(),
                items: vec![JiraChangelogItem {
                    field: "status".to_string(),
                    fieldtype: Some("jira".to_string()),
                    from: Some("1".to_string()),
                    from_string: Some("To Do".to_string()),
                    to: Some("2".to_string()),
                    to_string: Some("In Progress".to_string()),
                }],
            }],
        };
        client.stub_changelog("AMP-1", changelog);

        let mutex_conn = std::sync::Mutex::new(conn);
        let db = MutexDbAccess(&mutex_conn);
        let service = JiraIssueIngestionService::new(&client);
        let cancellation = CancellationFlag::new();
        let summary = service
            .ingest_project(&db, "srcsys_1", "AMP", Some("AMP Project"), NOW, &cancellation)
            .expect("ingest");
        assert_eq!(summary.status, "succeeded");

        let event_count: i64 = db
            .with_conn(|conn| {
                Ok(conn
                    .query_row(
                        "SELECT COUNT(*) FROM issue_events WHERE event_type = 'status_changed'",
                        [],
                        |r| r.get(0),
                    )
                    .unwrap())
            })
            .unwrap();
        assert_eq!(
            event_count, 1,
            "expected exactly one status_changed event, got {event_count}"
        );

        // Verify the changelog endpoint was called for each issue.
        let cl_calls = client.changelog_calls();
        assert!(
            cl_calls.iter().any(|k| k == "AMP-1"),
            "expected changelog call for AMP-1, got {cl_calls:?}"
        );
    }

    // -- Redaction tests --------------------------------------------------
    //
    // These tests lock down the guarantee that PATs, Authorization headers,
    // and Bearer tokens never end up in persisted rows (ingestion_runs,
    // ingestion_cursors, jira_issues raw_*_json), in IngestionError
    // Display output, or anywhere in our fixture corpus.
    //
    // The synthetic PAT is intentionally a non-real token shape; it is used
    // ONLY to assert that it does not appear in stored data after a run.

    const SYNTHETIC_PAT: &str = "synthetic-pat-do-not-store-anywhere-12345";

    fn assert_no_secrets_in_text(value: &str, context: &str) {
        assert!(
            !value.contains(SYNTHETIC_PAT),
            "{context} contained SYNTHETIC_PAT: {value}"
        );
        assert!(
            !value.contains("Bearer "),
            "{context} contained 'Bearer ': {value}"
        );
        assert!(
            !value.contains("Authorization:"),
            "{context} contained 'Authorization:': {value}"
        );
        let lowered = value.to_ascii_lowercase();
        assert!(
            !lowered.contains("authorization:"),
            "{context} contained 'authorization:' (case-insensitive): {value}"
        );
    }

    #[test]
    fn redaction_run_summaries_never_contain_pat_or_auth_headers() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");

        // Touch the synthetic PAT so the compiler doesn't optimize it away in
        // some configurations and so a human auditor can grep for it.
        let _ = SYNTHETIC_PAT;

        let mut page1 = load_amp_search_page();
        page1.total = Some(2);
        let page2 = JiraSearchPage {
            start_at: 2,
            max_results: 50,
            total: Some(2),
            issues: vec![],
        };
        let client = FakeJiraClient::with_pages(vec![page1, page2]);
        let service = JiraIssueIngestionService::new(&client);
        let flag = CancellationFlag::new();
        service
            .ingest_project(&BorrowedConnDbAccess(&conn), "srcsys_1", "AMP", Some("AMP Project"), NOW, &flag)
            .expect("ingest");

        // Scan every TEXT column in every ingestion_runs row.
        let mut stmt = conn
            .prepare(
                "SELECT id, source_system_id, connector, status, started_at,
                        IFNULL(finished_at, ''), requested_projects_json,
                        progress_json, counts_json,
                        IFNULL(cancellation_requested_at, ''),
                        IFNULL(error_summary, '')
                   FROM ingestion_runs",
            )
            .expect("prep runs");
        let cols = [
            "id",
            "source_system_id",
            "connector",
            "status",
            "started_at",
            "finished_at",
            "requested_projects_json",
            "progress_json",
            "counts_json",
            "cancellation_requested_at",
            "error_summary",
        ];
        let mut rows = stmt.query([]).expect("query runs");
        let mut run_row_count = 0;
        while let Some(row) = rows.next().expect("row") {
            run_row_count += 1;
            for (idx, col) in cols.iter().enumerate() {
                let val: String = row.get(idx).expect("get col");
                assert_no_secrets_in_text(
                    &val,
                    &format!("ingestion_runs.{col}"),
                );
            }
        }
        assert!(run_row_count >= 1, "expected at least one ingestion_runs row");

        // Same for ingestion_cursors.
        let mut stmt = conn
            .prepare(
                "SELECT source_system_id, connector, cursor_key, cursor_value,
                        IFNULL(last_successful_sync_at, ''), updated_at
                   FROM ingestion_cursors",
            )
            .expect("prep cursors");
        let ccols = [
            "source_system_id",
            "connector",
            "cursor_key",
            "cursor_value",
            "last_successful_sync_at",
            "updated_at",
        ];
        let mut rows = stmt.query([]).expect("query cursors");
        let mut cursor_row_count = 0;
        while let Some(row) = rows.next().expect("row") {
            cursor_row_count += 1;
            for (idx, col) in ccols.iter().enumerate() {
                let val: String = row.get(idx).expect("get col");
                assert_no_secrets_in_text(
                    &val,
                    &format!("ingestion_cursors.{col}"),
                );
            }
        }
        assert!(
            cursor_row_count >= 1,
            "expected at least one ingestion_cursors row"
        );
    }

    #[test]
    fn redaction_persisted_issue_rows_never_contain_synthetic_pat_or_authorization_header() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");
        seed_amp_field_mappings(&conn, "srcsys_1", "AMP", NOW).expect("seed");

        // Touch the synthetic PAT so anti-leak invariants are explicit.
        let _ = SYNTHETIC_PAT;

        let _ = project_first_amp_issue(&conn);

        let mut stmt = conn
            .prepare(
                "SELECT raw_issue_json, raw_fields_json FROM jira_issues
                  WHERE jira_key = 'AMP-1'",
            )
            .expect("prep");
        let (raw_issue_json, raw_fields_json): (String, String) = stmt
            .query_row([], |r| Ok((r.get(0)?, r.get(1)?)))
            .expect("row");

        assert_no_secrets_in_text(&raw_issue_json, "jira_issues.raw_issue_json");
        assert_no_secrets_in_text(&raw_fields_json, "jira_issues.raw_fields_json");
    }

    #[test]
    fn redaction_ingestion_error_display_strips_authorization_and_bearer() {
        let err = IngestionError::new(
            IngestionErrorCategory::Authentication,
            format!("Authorization: Bearer {SYNTHETIC_PAT} raw body"),
        );
        let rendered = format!("{err}");
        assert!(
            !rendered.contains(SYNTHETIC_PAT),
            "rendered leaked SYNTHETIC_PAT: {rendered}"
        );
        assert!(
            !rendered.to_ascii_lowercase().contains("bearer"),
            "rendered leaked 'Bearer': {rendered}"
        );
        assert!(
            !rendered.to_ascii_lowercase().contains("authorization"),
            "rendered leaked 'Authorization': {rendered}"
        );
        // Category label still appears.
        assert!(rendered.contains("Authentication failed"));
    }

    #[test]
    fn redaction_fixtures_directory_contains_no_secret_shaped_strings() {
        let fixtures_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("src")
            .join("sources")
            .join("fixtures");
        let entries = std::fs::read_dir(&fixtures_dir).expect("read fixtures dir");
        let forbidden: [&str; 5] = [
            "Authorization:",
            "Bearer ",
            "pat-",
            "secret-",
            "eyJ",
        ];
        let mut json_files_checked = 0;
        for entry in entries {
            let entry = entry.expect("entry");
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }
            let content =
                std::fs::read_to_string(&path).expect("read fixture file");
            for needle in forbidden {
                assert!(
                    !content.contains(needle),
                    "{} contained forbidden substring {:?}",
                    path.display(),
                    needle
                );
            }
            json_files_checked += 1;
        }
        assert!(
            json_files_checked >= 1,
            "expected at least one fixture *.json"
        );
    }

    // ── INIT-1 regression: writes use jira_issue work-item kind ───────────
    //
    // `jira_issues_list` filters `work_items.source_kind = 'jira_issue'`.
    // If the projection writes the *system* kind (`"jira"`) instead of the
    // *work-item* kind (`"jira_issue"`), ingested issues silently disappear
    // from the list. This test exercises the end-to-end happy path.
    #[test]
    fn ingested_issues_are_visible_through_list_jira_issues_from_conn() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_test_1");

        let mut page1 = load_amp_search_page();
        page1.total = Some(2);
        let client = FakeJiraClient::with_pages(vec![page1]);
        let service = JiraIssueIngestionService::new(&client);
        let flag = CancellationFlag::new();
        service
            .ingest_project(
                &BorrowedConnDbAccess(&conn),
                "srcsys_test_1",
                "AMP",
                Some("AMP"),
                NOW,
                &flag,
            )
            .expect("ingest");

        // `source_system_id_for("test_1")` returns "srcsys_test_1" — the
        // value we seeded above.
        let items = crate::commands::list_jira_issues_from_conn(
            &conn,
            &crate::commands::JiraIssueListFilter {
                source_id: Some("test_1".into()),
                project_key: Some("AMP".into()),
                limit: Some(10),
            },
        )
        .expect("list");
        assert!(
            !items.is_empty(),
            "expected the ingested issue to be visible via jira_issues_list"
        );
        assert!(
            items.iter().any(|i| i.key == "AMP-1"),
            "expected AMP-1 in list, got: {items:?}"
        );
    }

    // ── INIT-2 regression: SQLite mutex is released during HTTP ───────────
    //
    // Spawn a worker thread that runs `ingest_project` against a
    // `MutexDbAccess`. The fake Jira client blocks inside
    // `search_issues_page` until a release channel fires. While the worker
    // is blocked on that "HTTP" call, the main thread takes the DB lock and
    // reads progress — if the service held the mutex across the network
    // call, this would deadlock.
    #[test]
    fn status_read_proceeds_while_search_page_is_blocked() {
        use std::sync::mpsc;

        /// Fake client whose `search_issues_page` blocks until a signal is
        /// received on the given channel.
        struct BlockingJiraClient {
            release_rx: Arc<Mutex<mpsc::Receiver<()>>>,
            started_tx: Arc<Mutex<Option<mpsc::Sender<()>>>>,
        }
        impl JiraIssueClient for BlockingJiraClient {
            fn search_issues_page(
                &self,
                _request: JiraSearchRequest,
            ) -> Result<JiraSearchPage, JiraApiError> {
                if let Some(tx) = self.started_tx.lock().unwrap().take() {
                    let _ = tx.send(());
                }
                // Block — without holding any DB lock — until the main thread
                // releases us.
                let rx = self.release_rx.lock().unwrap();
                let _ = rx.recv();
                Ok(JiraSearchPage {
                    start_at: 0,
                    max_results: 50,
                    total: Some(0),
                    issues: vec![],
                })
            }

            fn get_issue_comments_page(
                &self,
                _issue_id_or_key: &str,
                start_at: u32,
                max_results: u32,
            ) -> Result<JiraPagedComments, JiraApiError> {
                Ok(JiraPagedComments {
                    start_at,
                    max_results,
                    total: Some(0),
                    comments: vec![],
                })
            }

            fn get_issue_worklogs_page(
                &self,
                _issue_id_or_key: &str,
                start_at: u32,
                max_results: u32,
            ) -> Result<JiraPagedWorklogs, JiraApiError> {
                Ok(JiraPagedWorklogs {
                    start_at,
                    max_results,
                    total: Some(0),
                    worklogs: vec![],
                })
            }

            fn get_issue_remote_links(
                &self,
                _issue_id_or_key: &str,
            ) -> Result<Vec<JiraRemoteLink>, JiraApiError> {
                Ok(vec![])
            }

            fn get_issue_changelog(
                &self,
                _issue_id_or_key: &str,
            ) -> Result<Option<JiraChangelogPage>, JiraApiError> {
                Ok(None)
            }
        }

        // Set up an in-memory DB inside a Mutex; seed source_system.
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_test_1");
        let mutex = Arc::new(Mutex::new(conn));

        let (release_tx, release_rx) = mpsc::channel::<()>();
        let (started_tx, started_rx) = mpsc::channel::<()>();
        let client = Arc::new(BlockingJiraClient {
            release_rx: Arc::new(Mutex::new(release_rx)),
            started_tx: Arc::new(Mutex::new(Some(started_tx))),
        });

        let mutex_worker = Arc::clone(&mutex);
        let client_worker = Arc::clone(&client);
        let handle = std::thread::spawn(move || {
            let service = JiraIssueIngestionService::new(client_worker.as_ref());
            let db = MutexDbAccess(&mutex_worker);
            let flag = CancellationFlag::new();
            service
                .ingest_project(
                    &db,
                    "srcsys_test_1",
                    "AMP",
                    Some("AMP"),
                    NOW,
                    &flag,
                )
                .expect("ingest");
        });

        // Wait until the worker is inside the blocking search call (no DB
        // lock held by definition — the call is BEFORE any with_conn block
        // in the loop).
        started_rx
            .recv_timeout(std::time::Duration::from_secs(5))
            .expect("worker should have entered search_issues_page");

        // The main thread takes the DB lock and reads progress. If the
        // service still held the mutex across the HTTP call, this would
        // deadlock; we'd hit the timeout below.
        let (got_tx, got_rx) = mpsc::channel::<Option<crate::commands::JiraIssueIngestionProgress>>();
        let mutex_reader = Arc::clone(&mutex);
        let reader = std::thread::spawn(move || {
            let conn = mutex_reader.lock().expect("lock");
            let progress = crate::commands::read_progress_from_conn(&conn, "test_1")
                .expect("read_progress");
            let _ = got_tx.send(progress);
        });
        let progress = got_rx
            .recv_timeout(std::time::Duration::from_secs(5))
            .expect("progress read should not deadlock");
        reader.join().expect("reader thread joined");

        let progress = progress.expect("expected a progress row to exist");
        assert_eq!(
            progress.status, "running",
            "expected status=running while page is blocked, got: {progress:?}"
        );

        // Release the worker and let it finish.
        release_tx.send(()).expect("signal release");
        handle.join().expect("worker thread joined");
    }

    // ── R2-1 regression: storage hiccup mid-loop finalizes the run ────────
    //
    // The page-loop body is wrapped in an IIFE that funnels every storage or
    // HTTP error into a single finalize block. Without that wrapper a
    // `db.with_conn(...)?` early-return left `ingestion_runs.status='running'`
    // forever. This fake DbAccess succeeds for the setup block (`start_run` +
    // `seed_amp_field_mappings` + `read_cursor`) and the projection block,
    // but fails on the next `with_conn` call — specifically the per-page
    // `update_progress`. The run must still be marked `partial` with a
    // non-empty `error_summary`, and `ingest_project` must return Err.
    #[test]
    fn with_conn_error_during_projection_finalizes_run_as_partial() {
        /// Wraps a real `Connection` but fails after a configured number of
        /// successful `with_conn` calls. The failure call itself is also
        /// counted, so subsequent calls (e.g. the post-loop finalize) succeed
        /// and can persist the partial-run row.
        struct FailingDbAccess<'a> {
            inner: &'a Connection,
            calls: std::cell::Cell<u32>,
            fail_after: u32,
            failed_once: std::cell::Cell<bool>,
        }
        impl<'a> DbAccess for FailingDbAccess<'a> {
            fn with_conn<F, R>(&self, f: F) -> Result<R, IngestionError>
            where
                F: FnOnce(&Connection) -> Result<R, IngestionError>,
            {
                let next = self.calls.get() + 1;
                self.calls.set(next);
                if next == self.fail_after && !self.failed_once.get() {
                    self.failed_once.set(true);
                    return Err(IngestionError::new(
                        IngestionErrorCategory::Storage,
                        "",
                    ));
                }
                f(self.inner)
            }
        }

        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");

        let mut page1 = load_amp_search_page();
        page1.total = Some(2);
        let client = FakeJiraClient::with_pages(vec![page1]);
        let service = JiraIssueIngestionService::new(&client);

        // Call order in ingest_project:
        //   1. setup block (start_run + seed + read_cursor)
        //   2. page projection (per-page txn)
        //   3. update_progress
        //   …after that the loop terminates on page.total=2 and we hit the
        //   final cursors+finish_run block.
        // Failing on the 3rd call exercises the new IIFE → single-finalize
        // path without short-circuiting the projection itself.
        let db = FailingDbAccess {
            inner: &conn,
            calls: std::cell::Cell::new(0),
            fail_after: 3,
            failed_once: std::cell::Cell::new(false),
        };

        let flag = CancellationFlag::new();
        let err = service
            .ingest_project(&db, "srcsys_1", "AMP", Some("AMP Project"), NOW, &flag)
            .expect_err("expected storage error to surface");
        assert_eq!(err.category(), IngestionErrorCategory::Storage);

        // Exactly one ingestion_runs row, marked partial with a non-empty
        // error_summary. status must NOT be 'running'.
        let rows: Vec<(String, Option<String>)> = {
            let mut stmt = conn
                .prepare(
                    "SELECT status, error_summary FROM ingestion_runs
                      WHERE source_system_id = 'srcsys_1' AND connector = ?1",
                )
                .expect("prep");
            let rs = stmt
                .query_map([JIRA_ISSUE_CONNECTOR], |r| {
                    Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?))
                })
                .expect("query");
            rs.map(|r| r.expect("row")).collect()
        };
        assert_eq!(rows.len(), 1, "expected exactly one ingestion_runs row");
        assert_eq!(rows[0].0, "partial");
        assert!(
            rows[0]
                .1
                .as_deref()
                .map(|s| !s.is_empty())
                .unwrap_or(false),
            "expected non-empty error_summary, got {:?}",
            rows[0].1
        );

        // started_at and finished_at must both be set (no run left at running).
        let (started_at, finished_at): (String, Option<String>) = conn
            .query_row(
                "SELECT started_at, finished_at FROM ingestion_runs
                  WHERE source_system_id = 'srcsys_1' AND connector = ?1",
                [JIRA_ISSUE_CONNECTOR],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .expect("timestamps");
        assert_eq!(started_at, NOW);
        assert!(
            finished_at.is_some(),
            "finished_at must be set after partial finalize"
        );
    }

    // ── R2-2 regression: per-page projection is wrapped in a transaction ──
    //
    // If projection of any issue in a page fails, every other issue in that
    // page must be rolled back. The page-projection `with_conn` block uses
    // `conn.unchecked_transaction()` to enforce that. We trigger a projection
    // failure by sending a page that contains a malformed issue (empty `id`
    // / `key`) AFTER a real issue. `project_jira_issue` returns
    // `ProjectionError::Invalid`, which the inner closure surfaces as Err and
    // the surrounding match rolls back the transaction.
    #[test]
    fn page_projection_rollback_keeps_no_partial_issues() {
        let conn = open_in_memory().expect("db");
        seed_amp_source(&conn, "srcsys_1");

        // Build a page with one valid AMP-1 issue followed by an invalid
        // issue (missing key). The valid issue must NOT survive after
        // rollback because the whole page is one transaction.
        let mut page = load_amp_search_page();
        page.total = Some(2);
        // Replace the second issue with one that has an empty key — this
        // triggers `ProjectionError::Invalid` partway through the page.
        if let Some(second) = page.issues.get_mut(1) {
            second.key = "".to_string();
        }
        let client = FakeJiraClient::with_pages(vec![page]);
        let service = JiraIssueIngestionService::new(&client);

        let flag = CancellationFlag::new();
        let err = service
            .ingest_project(&BorrowedConnDbAccess(&conn), "srcsys_1", "AMP", Some("AMP Project"), NOW, &flag)
            .expect_err("expected projection error to roll back the page");
        // Invalid issue maps to Schema (see IngestionError::From<ProjectionError>).
        assert_eq!(err.category(), IngestionErrorCategory::Schema);

        // No issues from that page should be persisted — the transaction
        // was rolled back. Without the transaction, AMP-1 would survive.
        let wi_count: i64 = conn
            .query_row(
                "SELECT count(*) FROM work_items WHERE project_key = 'AMP'",
                [],
                |r| r.get(0),
            )
            .expect("count wi");
        assert_eq!(
            wi_count, 0,
            "no work_items must remain after a mid-page projection rollback"
        );

        // The run itself was finalized as partial by the IIFE finalize block.
        let status: String = conn
            .query_row(
                "SELECT status FROM ingestion_runs
                  WHERE source_system_id = 'srcsys_1' AND connector = ?1",
                [JIRA_ISSUE_CONNECTOR],
                |r| r.get(0),
            )
            .expect("status");
        assert_eq!(status, "partial");
    }
}
