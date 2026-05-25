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

use crate::issues::ids::{content_hash, stable_id};
use crate::issues::people::{upsert_source_identity, SourceIdentityInput, UpsertedIdentity};
use crate::issues::repository::{
    upsert_indexable_document, upsert_work_item, upsert_work_item_comment,
    upsert_work_item_relationship, upsert_work_item_term, IndexableDocumentInput, WorkItemInput,
    WorkItemCommentInput, WorkItemRelationshipInput, WorkItemTermInput,
};
use crate::sources::jira_types::JiraIssue;

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

/// Coarse status grouping used for `work_items.state`. Resolved/closed states
/// take priority over the in-progress check so a status like
/// `"Closed (Done)"` lands on the closed bucket.
fn coarse_state(status_name: Option<&str>) -> &'static str {
    let Some(raw) = status_name else { return "unknown" };
    let lower = raw.trim().to_ascii_lowercase();
    if lower.is_empty() {
        return "unknown";
    }
    if lower.contains("closed") {
        return "closed";
    }
    if lower.contains("done") || lower.contains("resolved") {
        return "done";
    }
    if lower.contains("in progress") || lower.contains("review") {
        return "in_progress";
    }
    match lower.as_str() {
        "open" | "to do" | "new" | "backlog" => "open",
        _ => "unknown",
    }
}

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
            source_kind: JIRA_SOURCE_KIND,
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
                source_kind: JIRA_SOURCE_KIND,
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
                source_kind: JIRA_SOURCE_KIND,
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
                source_kind: JIRA_SOURCE_KIND,
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
                source_kind: JIRA_SOURCE_KIND,
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
            let comment_id = stable_id("c", &[ctx.source_system_id, "jira", &comment.id]);
            // Author upsert (best effort).
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
            let visibility_json =
                comment.visibility.as_ref().map(|v| v.to_string());
            let raw_json = serde_json::to_string(comment).ok();

            upsert_work_item_comment(
                conn,
                ctx.ingested_at,
                &WorkItemCommentInput {
                    id: &comment_id,
                    work_item_id: &work_item_id,
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

            // One indexable_document per comment.
            let metadata_json = serde_json::json!({
                "kind": "jira_comment",
                "jira_issue_key": issue.key,
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
                    work_item_id: Some(&work_item_id),
                    title: None,
                    body: comment.body.as_deref().unwrap_or(""),
                    metadata_json: &metadata_json,
                    content_hash: &body_hash,
                },
            )?;
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
}
