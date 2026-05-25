---
created: 2026-05-25
last_updated: 2026-05-25
status: implementing
issue: 10
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Jira issue ingestion baseline

## What

`hm` needs its first production ingestion pipeline for work data. This feature ingests Jira Data Center issues from configured Jira sources, persists the current issue state in SQLite, and stores enough Jira-specific field fidelity for AMP and future Jira projects to be queried locally. Jira Cloud is not a supported target for issue #10, but the source metadata should record the Jira deployment kind (`data_center`, `cloud`, or `unknown`) so future Cloud support can explicitly branch on API/auth/user-field differences instead of assuming all Jira sites behave like Data Center. The issue #10 schema must also leave a clear path for issue #11 to add Jira lifecycle events and daily snapshots, but this feature does not capture changelog events or materialize snapshots yet.
Issue #10 establishes the baseline data model for source-backed work items without pretending every source belongs in one table. Jira issues get the concrete implementation now, while shared concepts such as source identity, people, comments, terms, relationships, and indexable documents set precedent for later GitHub PRs, GitHub issues, teams, roadmap items, and retrieval work. For the AMP Jira project, ingestion brings over the requested plain fields, handles inline paginated fields (`comment`, `issuelinks`, `worklog`), and leaves sub-resource-only fields (`watchers`, `votes`, `remotelink`, comment tails) behind explicit opt-in behavior so bulk sync does not accidentally become N+1-heavy.
## Why

The app shell, source configuration, and Jira API client are in place, but `hm` still has no local issue corpus to query. Roadmap health, backlog hygiene, status reports, relationship maps, and future chat answers all require durable local work-item data.
This schema is important because it sets precedent. Jira projects expose different field ids, names, and value shapes, and future GitHub data will share some concepts while needing its own provider-specific details. Issue #10 should therefore normalize common query concepts, preserve raw Jira fidelity, and avoid both AMP-only hardcoding and JSON-only storage.
## Personas

- **Elena: EM** — wants `hm` to answer questions about status, assignments, stale issues, and current Jira data without opening Jira tabs.
- **Priya: PM** — wants roadmap and product fields such as parent links, products, sprints, fix versions, and customer names to survive ingestion so roadmap health can be traced to actual issues.
- **Tarek: Team member** — wants local issue search and context to include comments, relationships, assignees, labels, and teams so he can understand unfamiliar work quickly.
- **Future GitHub ingestion implementer** — needs a source-neutral baseline that can represent PRs, GitHub issues, authors, reviewers, labels, links, and embeddings without copying Jira-specific decisions.
- **Maintainer** — needs fixture-backed ingestion tests, deterministic schema migrations, and safe error handling so sync behavior can change without real Jira credentials in CI.
## Narratives

### Elena syncs AMP issues for the first time

Elena has already configured her Jira source and selected the AMP project. From that source's settings row, she starts the first Jira issue ingestion run. `hm` builds a project-scoped JQL query, requests the configured AMP field list, follows search pagination, and writes each issue into SQLite.
While the sync runs, the source row shows safe progress such as `48 of 63 issues saved`, the current page, and the current phase. Elena can cancel the active run from the same source row; cancellation stops future network requests, persists already-saved pages, and marks the run `partial` or `cancelled` with a safe summary. When the sync finishes, the source list shows the last successful issue sync time and any optional sub-resource sync times. Her PAT never appears in the database, logs, UI, or generated bindings.
### Priya reviews roadmap-relevant issue context

Priya investigates an AMP workstream using the current local issue corpus. `hm` can query the current work item, the issue fields needed to support future status-change event capture, its parent and epic fields, its sprint assignment, and comments ingested from Jira. The schema is ready for issue #11 to add events without changing how current issue rows are identified.
Some fields are Jira-specific custom fields. They are still queryable because `hm` stored canonical AMP mappings where known and also stored raw Jira field values with field metadata. Daily snapshot comparison is not available in issue #10, but the issue identifiers, current-state columns, and planned snapshot shape are defined so issue #11 can add snapshot materialization cleanly.
### Tarek follows a relationship trail

Tarek opens an issue that looks related to his work. `hm` shows linked issues, subtasks, comments, worklogs when enabled, labels, components, and people references. The issue's assignee and reporter are represented as source identities linked to canonical people records, not just display-name strings.
Later, when GitHub ingestion lands, the same person can have a Jira identity, GitHub identity, and Slack identity linked to one canonical person. Tarek's issue context can then show the person behind a Jira assignment, a GitHub PR author, and a Slack discussion without requiring every source to agree on usernames.
## User stories

**Elena syncs AMP issues**
- Elena can run ingestion for a configured Jira source and selected project.
- Elena can ingest all configured issue pages with bounded pagination.
- Elena can see current Jira issue data persisted locally after sync through commands/tests and any future viewer that reads the same local tables.
- Elena can see safe sync errors when Jira auth, permissions, rate limits, schema, network, or decode behavior fails.
- Elena can re-run sync without duplicating issues, comments, links, labels, components, versions, people, worklogs, or indexable documents.
**Priya analyzes roadmap-relevant fields**
- Priya can query AMP fields for parent link, customer name, assigned teams, product, epic link, epic name, epic status, and sprint.
- Priya can query common issue fields such as status, resolution, priority, labels, components, issue type, fix versions, subtasks, watches count, created, updated, due date, and resolution date.
- Priya can inspect current issue state and Jira custom fields locally after sync.
- Priya can rely on the issue #10 schema to support future event and snapshot capture in issue #11 without reworking current issue identity or field mapping.
**Tarek explores relationships and people**
- Tarek can see comments, issue links, subtasks, and optionally worklogs ingested for an issue.
- Tarek can see assignee, reporter, comment author, and worklog author as source identities.
- Tarek can rely on stable canonical person ids even when a source identity is not yet linked to GitHub or Slack.
- Tarek can distinguish unknown, deleted, private, or unmapped upstream users without losing the original source identity payload.
**Future GitHub ingestion implementer extends the model**
- Future GitHub ingestion can add PRs and GitHub issues as source-backed work items instead of creating an unrelated schema.
- Future GitHub ingestion can map GitHub users to the same `people` / `source_identities` model.
- Future GitHub ingestion can add PR-specific tables while sharing comments, labels, relationships, and indexable documents where appropriate.
- Future event, snapshot, and vector work can reuse source-agnostic identifiers and document chunks while retaining source-specific metadata.
**Maintainer validates ingestion safely**
- Maintainer can run schema and ingestion tests against fixtures with no Jira server or PAT.
- Maintainer can run incremental sync tests that prove idempotency and high-water behavior.
- Maintainer can inspect raw Jira payloads in the local database for debugging without finding secrets.
- Maintainer can add a new Jira project field mapping without writing a migration for every new custom field.
## Goals

- Add the first SQLite schema migration set for source-backed work data, separate from `shared_settings`.
- Establish source-neutral core tables for source systems, work items, people, source identities, terms, relationships, comments, and indexable documents.
- Add Jira-specific tables for issue raw payloads, Jira field metadata, Jira project field mappings, Jira custom field values, issue links, worklogs, remote links when enabled, and ingestion cursors.
- Define the schema compatibility points needed for issue #11 to add work-item events and daily snapshots.
- Ingest Jira Data Center issues from configured Jira sources using the issue #9 API client.
- Request AMP's required plain Jira fields through `fields=` on `/rest/api/2/search`.
- Handle Jira search pagination and per-issue tails for inline paginated `comment`, `issuelinks`, and `worklog` collections when the inline `total` exceeds returned items.
- Capture sub-resource-only data behind explicit options, with watchers/votes/remotelinks disabled by default for bulk sync. Each optional sub-resource kind needs its own cursor/last-successful-sync timestamp per source and project or source and issue, as appropriate, so a later opt-in backfill can run independently from the main issue cursor without pretending those resources were already complete.
- Store raw Jira issue JSON for fidelity and debugging while projecting query-critical fields into relational columns.
- Track schema version, source field mappings, ingestion runs, errors, cursors, and per-run counts.
- Prepare deterministic indexable document rows for future sqlite-vec embeddings without adding embeddings in this feature.
- Keep all credentials out of SQLite, logs, errors, fixtures, snapshots, and generated bindings.
- Cover ingestion with Rust unit and integration tests using synthetic Jira fixtures.
## Non-goals

- No Jira changelog event capture, event replay, event-derived history UI, or lifecycle-event analytics; issue #11 owns event capture.
- No daily snapshot materialization or time-travel comparison; issue #11 owns snapshot creation.
- No vector embeddings, sqlite-vec virtual tables, nearest-neighbor search, or duplicate detection implementation; issue #12 owns embedding/indexing behavior.
- No GitHub ingestion, GitHub PR schema beyond extension points, GitHub issue ingestion, or Slack ingestion.
- No automatic identity matching across Jira, GitHub, and Slack beyond creating canonical people and source identity records.
- No write-back to Jira: no issue updates, comments, transitions, assignments, labels, or bulk triage mutations.
- No new source configuration UI beyond minimal status/progress surfaces if already supported by existing settings patterns.
- No Jira issue viewer or issue-detail UI; issue #10 may expose list data for tests/future integration, but the visible UI scope is source-level run/status/cancel progress.
- No attachment download or blob storage.
- No full source health dashboard or background scheduler beyond the minimal command/service needed to run ingestion.
- No Jira OAuth, basic auth, cookie auth, or service-account flow.
- No guarantee that every arbitrary Jira custom field becomes a first-class column.
- No remote sync or shared backend.
## Design spec

This feature is mostly backend work. Any UI changes should be minimal and reuse existing shell/settings patterns.
### User-visible behavior

There is no issue viewer in scope for issue #10. The Jira viewer is out of scope for this issue; the ingestion command, source status surface, schema, and tests are the feature's source of truth. Any issue-list command exists to support tests and future UI integration, not to deliver a new viewer now.
The minimum user-visible surface lives on the configured Jira source itself:
```plain text
Settings / Sources
└── Jira — AMP Data Center
    ├── Status: Syncing issues
    ├── Progress: 48 of 63 issues saved · page 3 of 4 · fetching comments
    ├── Last successful issue sync: 2026-05-25T17:24:12Z (to local time zone)
    ├── Optional sub-resources:
    │   ├── Watchers: Off · never synced
    │   ├── Votes: Off · never synced
    │   └── Remote links: Off · last synced 2026-05-20T09:10:00Z (to local time zone)
    ├── [Run sync now] (visible only while not running)
    └── [Cancel sync] (visible only while running)
```
The progress denominator should use Jira search's `total` when available, so the UI can show `48 of 63` rather than only a spinner. If Jira omits a trustworthy total for a sub-resource tail, show a phase-level count such as `fetching comment tail for AMP-123` and keep the total unknown. The UI must not block schema or ingestion correctness.
### Source setup and sync flow

```plain text
Configured Jira source
├── Run Jira issue ingestion manually from the source row
├── Cancel the active ingestion run from the source row
└── Background service
    ├── Load source metadata from SQLite shared settings
    ├── Load PAT from OS keychain by credential ref
    ├── Load Jira project field mapping for each selected project
    ├── Build project-scoped JQL and requested field list
    ├── Search /rest/api/2/search with pagination
    ├── For each issue page
    │   ├── Upsert source-backed work item current state
    │   ├── Upsert Jira issue raw payload + projected fields
    │   ├── Upsert people/source identities for users
    │   ├── Upsert labels, components, versions, teams, sprint/product fields
    │   ├── Upsert comments / issue links / worklogs returned inline
    │   ├── Fetch inline-paginated tails only when total > returned count
    │   └── Queue/update indexable document rows
    ├── Check cancellation between pages and tail fetches
    └── Write ingestion run summary, progress, and cursor
```
### Progress and error language

Errors should be short, actionable, and safe:
```plain text
Authentication failed: Replace the Jira token and try again.
Access denied: This token cannot read AMP issues.
Schema changed: Jira field customfield_14655 returned an unexpected shape.
Rate limited: Jira asked hm to wait before continuing.
Partial sync: 48 of 52 issues were saved. Retry to fetch the remaining page.
```
The UI and logs may include source id, project key, issue key, field id, endpoint kind, status code, and safe error category. They must not include PATs, authorization headers, raw response bodies containing private content, or token-shaped strings.
## Tech spec

### Prerequisites and references

- Issue #8 — Jira source configuration stores server URL, project keys, and credential refs.
- Issue #9 — Jira Data Center API client supports search, issue fetch, project listing, retries, rate limits, and safe errors.
- Issue #11 — will add Jira changelog-derived events and daily snapshots on top of this baseline.
- ADR-001 — `hm` uses the user's own source-system credentials.
- ADR-003 — local-first single-user v1.
- ADR-004 — SQLite + sqlite-vec primary store.
- ADR-005 — event-sourced history and daily snapshots.
- ADR-007 — two-pass retrieval will combine vector candidates with structural fields.
- ADR-008 — source metadata in SQLite; PATs in keychain.
### Schema principles

1. **Normalize shared concepts, preserve source fidelity.** Put common query fields in source-neutral tables. Store Jira-specific and raw payloads beside them so no Jira data is lost just because it is not common.
2. **Stable internal ids, source ids at the edge.** Internal tables use `hm` ids or integer primary keys. Every source-backed row records `(source_id, source_kind, upstream_id)` with unique constraints for idempotency.
3. **Field mappings are data, not code.** AMP's custom-field ids are seeded mappings, but Jira project mappings are records that can be added or adjusted as other projects are onboarded.
4. **JSON is allowed for fidelity, not as the only query path.** Raw issue and custom field values stay available as JSON, but high-value fields are projected into typed columns or link tables.
5. **People are first-class from day one.** Jira assignees/reporters/authors become `source_identities` linked to a canonical `people` row. GitHub and Slack identities can attach later.
6. **History-ready, not history-capturing.** Current state lives in primary tables in issue #10. Stable work-item ids, source ids, update hashes, and current-state columns must be sufficient for issue #11 to add event and snapshot tables without reshaping current ingestion.
7. **Vector readiness starts with deterministic documents.** Issue #10 creates stable document/chunk rows and text hashes. Issue #12 adds embedding vectors over those rows.
### Proposed SQLite tables

Names can be refined during implementation, but the model should preserve these responsibilities.
All timestamp columns stored as `TEXT` must use UTC ISO 8601 / RFC 3339 strings, for example `2026-05-25T17:24:12Z`. Columns ending in `_source` hold upstream Jira timestamps; plain `created_at` / `updated_at` / `ingested_at` columns hold local `hm` row or ingestion timestamps, so they can differ legitimately.
#### Sources and ingestion bookkeeping

```sql
source_systems(
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,              -- jira, github, slack, docs
  deployment_kind TEXT,            -- jira: data_center, cloud, unknown
  display_name TEXT NOT NULL,
  base_url TEXT,
  config_source_id TEXT,           -- links to SourcesConfig source id when applicable
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(kind, base_url, config_source_id)
)

ingestion_runs(
  id TEXT PRIMARY KEY,
  source_system_id TEXT NOT NULL REFERENCES source_systems(id),
  connector TEXT NOT NULL,         -- jira.issue
  status TEXT NOT NULL,            -- running, succeeded, partial, failed, cancelled
  started_at TEXT NOT NULL,
  finished_at TEXT,
  requested_projects_json TEXT NOT NULL,
  progress_json TEXT NOT NULL,     -- phase, current page, total pages, saved issues, total issues when known
  counts_json TEXT NOT NULL,       -- pages, issues, comments, worklogs, errors
  cancellation_requested_at TEXT,
  error_summary TEXT
)

ingestion_cursors(
  source_system_id TEXT NOT NULL REFERENCES source_systems(id),
  connector TEXT NOT NULL,
  cursor_key TEXT NOT NULL,        -- project AMP, jql hash, etc.
  cursor_value TEXT NOT NULL,
  last_successful_sync_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(source_system_id, connector, cursor_key)
)
```
Cursor keys should be resource-specific, for example `project:AMP:issues`, `project:AMP:comments-tail`, `project:AMP:worklogs-tail`, and `project:AMP:remotelinks`. Optional watcher/vote/remotelink backfills must not advance or depend on the main issue cursor except to know which issues exist locally.
#### People and identities

```sql
people(
  id TEXT PRIMARY KEY,
  display_name TEXT,
  primary_email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

source_identities(
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id),
  source_system_id TEXT NOT NULL REFERENCES source_systems(id),
  source_kind TEXT NOT NULL,        -- jira, github, slack
  upstream_account_id TEXT,
  upstream_name TEXT,
  upstream_key TEXT,
  username TEXT,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  raw_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source_system_id, source_kind, upstream_account_id),
  UNIQUE(source_system_id, source_kind, upstream_name),
  UNIQUE(source_system_id, source_kind, upstream_key)
)

identity_links(
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id),
  source_identity_id TEXT NOT NULL REFERENCES source_identities(id),
  link_confidence TEXT NOT NULL,    -- exact, inferred, manual
  linked_at TEXT NOT NULL,
  UNIQUE(person_id, source_identity_id)
)
```
For Jira Data Center, `accountId`, `name`, and `key` vary by version/config. Store all provided values. If no existing person matches safely, create one canonical person per source identity. Do not infer GitHub or Slack matches in this feature.
#### Source-neutral work items

```sql
work_items(
  id TEXT PRIMARY KEY,
  source_system_id TEXT NOT NULL REFERENCES source_systems(id),
  source_kind TEXT NOT NULL,        -- jira_issue, github_issue, github_pr later
  upstream_id TEXT NOT NULL,        -- Jira numeric id, GitHub node id, etc.
  key TEXT,                         -- AMP-123 or owner/repo#123
  url TEXT,
  title TEXT NOT NULL,
  body TEXT,
  state TEXT NOT NULL,              -- open, in_progress, done, closed, unknown
  status_name TEXT,
  resolution_name TEXT,
  priority_name TEXT,
  item_type TEXT,
  project_key TEXT,
  project_name TEXT,
  assignee_person_id TEXT REFERENCES people(id),
  reporter_person_id TEXT REFERENCES people(id),
  created_at_source TEXT,
  updated_at_source TEXT,
  resolved_at_source TEXT,
  due_at_source TEXT,
  last_seen_at TEXT NOT NULL,
  raw_updated_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source_system_id, source_kind, upstream_id),
  UNIQUE(source_system_id, source_kind, key)
)

work_item_terms(
  work_item_id TEXT NOT NULL REFERENCES work_items(id),
  term_kind TEXT NOT NULL,          -- label, component, fix_version, sprint, assigned_team, product
  term_key TEXT NOT NULL,
  term_name TEXT,
  raw_json TEXT,
  PRIMARY KEY(work_item_id, term_kind, term_key)
)

work_item_relationships(
  id TEXT PRIMARY KEY,
  source_system_id TEXT NOT NULL REFERENCES source_systems(id),
  source_kind TEXT NOT NULL,
  from_work_item_id TEXT REFERENCES work_items(id),
  to_work_item_id TEXT REFERENCES work_items(id),
  from_upstream_key TEXT,
  to_upstream_key TEXT,
  relationship_type TEXT NOT NULL,  -- blocks, relates, subtask, parent, epic, remote, duplicate, PR-linked later
  direction TEXT,
  raw_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source_system_id, source_kind, from_upstream_key, to_upstream_key, relationship_type)
)
```
`state` is intentionally coarse and source-neutral. `status_name`, `resolution_name`, and `priority_name` are the raw or display names from the source for common filtering/display; Jira-specific ids, categories, and raw values remain in Jira tables. The same pattern applies where a provider exposes a useful display string (`priority_name`, `resolution_name`) but not every Jira field should become a normalized cross-provider enum. GitHub PRs can later map `open`, `merged`, `closed`, review state, and draft state without pretending they are Jira statuses.
`raw_updated_hash` is persisted, not just kept in memory, so repeated syncs and app restarts can skip unchanged issue writes without refetching or reparsing every previous payload. Sub-resources need their own persisted hashes or content hashes (`body_hash`, `value_hash`, `raw_hash`, or `content_hash`) because a comment, worklog, or remote link can change independently from the parent issue's projected fields.
Relationship rows should be created for subtasks, parent links, epic links, and issue links whenever Jira provides enough data. If the target issue is already ingested, `to_work_item_id` should point to that row; otherwise preserve `to_upstream_key` so the relationship can be resolved after a later sync.
#### Jira-specific issue tables

```sql
jira_issues(
  work_item_id TEXT PRIMARY KEY REFERENCES work_items(id),
  jira_id TEXT NOT NULL,
  jira_key TEXT NOT NULL,
  self_url TEXT,
  project_id TEXT,
  project_key TEXT,
  project_name TEXT,
  issue_type_id TEXT,
  issue_type_name TEXT,
  status_id TEXT,
  status_name TEXT,
  status_category_key TEXT,
  resolution_id TEXT,
  resolution_name TEXT,
  priority_id TEXT,
  priority_name TEXT,
  watches_count INTEGER,
  votes_count INTEGER,
  parent_link TEXT,
  customer_name TEXT,
  epic_link TEXT,
  epic_name TEXT,
  epic_status TEXT,
  sprint_names_json TEXT,
  product_names_json TEXT,
  assigned_team_names_json TEXT,
  raw_fields_json TEXT NOT NULL,
  raw_issue_json TEXT NOT NULL,
  fields_hash TEXT NOT NULL,
  updated_at_source TEXT,
  ingested_at TEXT NOT NULL,
  UNIQUE(jira_id),
  UNIQUE(jira_key)
)

jira_field_definitions(
  source_system_id TEXT NOT NULL REFERENCES source_systems(id),
  field_id TEXT NOT NULL,           -- customfield_14655, summary, status
  field_name TEXT,
  field_schema_json TEXT,
  is_custom INTEGER NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY(source_system_id, field_id)
)

jira_project_field_mappings(
  source_system_id TEXT NOT NULL REFERENCES source_systems(id),
  project_key TEXT NOT NULL,
  canonical_name TEXT NOT NULL,     -- product, assigned_teams, epic_link, etc.
  field_id TEXT NOT NULL,
  field_name TEXT,
  value_kind TEXT NOT NULL,         -- string, user, option, array, sprint, version, unknown
  required_for_ingestion INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(source_system_id, project_key, canonical_name)
)

jira_issue_field_values(
  work_item_id TEXT NOT NULL REFERENCES work_items(id),
  field_id TEXT NOT NULL,
  field_name TEXT,
  canonical_name TEXT,
  value_kind TEXT NOT NULL,
  value_text TEXT,
  value_number REAL,
  value_datetime TEXT,
  value_json TEXT,
  value_hash TEXT NOT NULL,
  updated_at_source TEXT,
  PRIMARY KEY(work_item_id, field_id)
)
```
`jira_issue_field_values` is the pressure valve for project-specific schemas. AMP fields get canonical names. Unknown fields can still be stored and inspected without schema migrations. The schema intentionally denormalizes low-cardinality Jira display data such as names, labels, components, sprints, products, and teams into issue/term rows instead of creating a fully normalized Jira dimension model; expected local scale is thousands to tens of thousands of issues, and denormalization keeps query and ingestion code simpler while preserving raw JSON for lossless debugging.
#### Comments, worklogs, and source interactions

```sql
work_item_comments(
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL REFERENCES work_items(id),
  source_system_id TEXT NOT NULL REFERENCES source_systems(id),
  upstream_id TEXT NOT NULL,
  author_identity_id TEXT REFERENCES source_identities(id),
  body TEXT,
  visibility_json TEXT,
  created_at_source TEXT,
  updated_at_source TEXT,
  raw_json TEXT,
  body_hash TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  UNIQUE(source_system_id, upstream_id)
)

jira_worklogs(
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL REFERENCES work_items(id),
  source_system_id TEXT NOT NULL REFERENCES source_systems(id),
  upstream_id TEXT NOT NULL,
  author_identity_id TEXT REFERENCES source_identities(id),
  update_author_identity_id TEXT REFERENCES source_identities(id),
  started_at_source TEXT,
  time_spent_seconds INTEGER,
  comment TEXT,
  raw_json TEXT,
  raw_hash TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  UNIQUE(source_system_id, upstream_id)
)

jira_remote_links(
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL REFERENCES work_items(id),
  source_system_id TEXT NOT NULL REFERENCES source_systems(id),
  upstream_id TEXT,
  url TEXT NOT NULL,
  title TEXT,
  relationship TEXT,
  raw_json TEXT,
  raw_hash TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  UNIQUE(source_system_id, work_item_id, url)
)
```
Comments are source-neutral because GitHub and Slack-like discussions can reuse the concept later. Worklogs and remote links are Jira-specific for now.
#### Event and snapshot compatibility

Issue #10 does not fetch Jira changelog pages, persist lifecycle events, or materialize daily snapshots. It must still preserve the prerequisites issue #11 needs:
- stable `work_items.id` values and source/upstream unique constraints;
- current-state fields that can be copied into snapshots;
- source identities for assignees, reporters, comment authors, and worklog authors;
- raw Jira fields and hashes for change detection;
- ingestion cursors and run summaries that can be extended to event/snapshot counts later.
If event or snapshot tables are added in issue #10 to avoid a later migration, they should remain empty and tested only for schema compatibility. Ingestion code must not claim that events or snapshots are available until issue #11 implements capture/materialization.
#### Vector readiness

```sql
indexable_documents(
  id TEXT PRIMARY KEY,
  source_system_id TEXT NOT NULL REFERENCES source_systems(id),
  entity_kind TEXT NOT NULL,        -- work_item, comment, worklog, relationship_summary
  entity_id TEXT NOT NULL,
  work_item_id TEXT REFERENCES work_items(id),
  title TEXT,
  body TEXT NOT NULL,
  metadata_json TEXT NOT NULL,      -- project, status, labels, people ids, source keys
  content_hash TEXT NOT NULL,
  embedding_status TEXT NOT NULL,   -- pending, embedded, stale, skipped
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entity_kind, entity_id, content_hash)
)
```
Do not create vector columns or sqlite-vec tables here. This table defines stable units of text and metadata so issue #12 can add embeddings without re-crawling Jira.
### AMP Jira field list

For AMP, the initial search request should include these fields:
```plain text
summary, status, resolution, assignee, reporter, priority, labels, components,
issuetype, project, description, created, updated, resolutiondate, duedate,
fixVersions, subtasks, watches,
customfield_14051, customfield_14353, customfield_12751, customfield_14655,
customfield_10857, customfield_10858, customfield_10859, customfield_10557,
comment, issuelinks, worklog
```
Seed AMP mappings:

Canonical name
Jira field id
Purpose

---
---:
---

`parent_link`
`customfield_14051`
Parent Link

`customer_name`
`customfield_14353`
Customer Name

`assigned_teams`
`customfield_12751`
Assigned Teams

`product`
`customfield_14655`
Product

`epic_link`
`customfield_10857`
Epic Link

`epic_name`
`customfield_10858`
Epic Name

`epic_status`
`customfield_10859`
Epic Status

`sprint`
`customfield_10557`
Sprint

The mapping table must allow these ids to differ for another Jira project.
### Jira pagination behavior

- Search pages use `/rest/api/2/search` with JQL, `fields`, `startAt`, and `maxResults`.
- Default page size should match the Jira client default unless implementation finds a project-specific reason to tune it.
- Search progress should record `startAt`, `maxResults`, saved issue count, and Jira's reported `total` so status can show concrete progress such as `48 of 63`.
- Inline paginated fields (`comment`, `issuelinks`, `worklog`) are accepted from the search response.
- If an inline collection reports `total > returned_count`, enqueue a per-issue tail fetch for that collection.
- Comment tail fetch uses `/issue/{key}/comment?startAt=...`.
- Worklog tail fetch uses the corresponding Jira worklog sub-resource if the existing client supports it or add support in the client under this feature.
- Issue-link tail behavior should be fixture-tested; Jira Data Center shapes differ. If Jira does not expose a separate tail endpoint for issue links in the target version, record a safe partial marker and do not fail the whole issue.
- Sub-resource-only fields are opt-in:
	- `/issue/{key}/watchers` — disabled by default; `watches` count is stored.
	- `/issue/{key}/votes` — disabled by default; vote count stored when available.
	- `/issue/{key}/remotelink` — disabled by default unless a setting enables remote-link ingestion.
- Each enabled sub-resource kind maintains its own cursor and last-successful-sync timestamp so enabling remote links later can backfill remote links without resetting issue/comment/worklog cursors.
### Incremental sync strategy

Initial implementation may be conservative:
1. For each selected project, run JQL ordered by updated time, for example `project in (...) ORDER BY updated ASC, key ASC`.
2. Persist every returned issue idempotently.
3. Store a cursor per source/project with the max `updated` timestamp and last issue key seen.
4. On the next run, query `updated >= last_successful_updated` with a small overlap window to avoid missing same-timestamp updates.
5. Use hashes on raw fields/comments/worklogs to skip unnecessary writes.
6. Mark missing/deleted issues only if Jira explicitly reports deletion or an issue fetch returns a safe not-found for a previously seen issue. Do not infer deletion from absence in a scoped page.
7. Keep optional sub-resource cursors separate from the issue cursor; a cancelled watcher/vote/remotelink backfill should not roll back a successful issue sync.
### Rust module layout

```plain text
src-tauri/src/ingestion/
  mod.rs
  errors.rs              safe ingestion error types
  ids.rs                 stable id helpers
  runs.rs                ingestion_runs and cursor helpers
  indexable.rs           indexable_documents helpers

src-tauri/src/issues/
  mod.rs
  schema.rs              migrations or schema setup for work item tables
  repository.rs          upsert/query helpers for work items, terms, comments, relationships
  people.rs              people/source identity helpers

src-tauri/src/sources/jira_ingestion.rs
  JiraIssueIngestionService
  AMP field mapping seed
  Jira issue projection code
  inline collection tail handling
```
If the repository's migration system is still minimal, implementation may keep migrations in `db/mod.rs` initially, but table creation and helper code should be separated enough that later migrations do not become one large function.
### Command surface

Add a small command surface for manual/test invocation and existing UI integration:
```rust
jira_issue_ingestion_run(source_id: String) -> Result
jira_issue_ingestion_cancel(source_id: String, run_id: String) -> Result
jira_issue_ingestion_status(source_id: String) -> Result, String>
jira_issue_ingestion_progress(source_id: String) -> Result, String>
jira_issues_list(filter: JiraIssueListFilter) -> Result, String> // test/future UI support, not a viewer requirement
```
The run command must not hold the SQLite mutex while doing network calls. Fetch pages, then take short database locks to write batches, or use a dedicated background-safe database access pattern if one exists by implementation time. Cancellation should be cooperative: set a cancellation flag on the run, check it between page and tail-fetch requests, then persist a final safe run summary.
### Testing plan

- Rust schema tests verify every new table, unique constraint, and foreign key needed for idempotent upserts.
- Rust repository tests cover work item upsert, Jira issue projection, field value updates, comments, links, worklogs, people/source identities, and indexable documents.
- Schema compatibility tests verify the current-state model exposes stable ids and fields needed for future event and snapshot tables.
- Jira fixture tests cover AMP fields, missing optional fields, unknown custom fields, multiple custom-field shapes, deleted/private users, inline comments, inline worklogs, issue links, subtasks, and watches count.
- Pagination tests cover multi-page search, inline collection tail fetching, partial-tail failure behavior, and cursor overlap.
- Idempotency tests run the same fixture twice and assert row counts do not duplicate.
- Incremental tests update a fixture's status/assignee/comment and assert current state and indexable documents update correctly.
- Redaction tests assert PATs, auth headers, and token-shaped strings do not appear in errors, logs, run summaries, database rows, or test snapshots.
- Frontend tests are required only if UI changes are made; use existing Vitest/RTL patterns.
### Risks and mitigations

- **Jira custom fields vary by project.** Mitigate with project field mappings plus raw field storage rather than per-custom-field columns only.
- **Schema overreach could slow implementation.** Mitigate by implementing the baseline tables and AMP projections first, while keeping optional sub-resources disabled by default.
- **History expectations may get ahead of scope.** Mitigate by documenting that issue #10 prepares event/snapshot compatibility while issue #11 owns capture and materialization.
- **N+1 calls can surprise users.** Mitigate with explicit options for watcher/voter/remotelink fetches and tail fetching only when inline totals require it.
- **Identity matching can be wrong.** Mitigate by creating source identities and one-person-per-identity defaults; do not infer cross-source matches until a dedicated identity feature.
- **Raw JSON may contain sensitive issue content.** This is expected local-first behavior, but keep data local, do not log raw payloads, and route future AI use through ADR-006 policies.
## Task list

- [ ] **Story: Schema foundation for source-backed work data**
	- [ ] **Task: Add work-data migrations**
		- **Description**: Create SQLite schema for source systems, ingestion runs/cursors, people/source identities, source-neutral work items, terms, relationships, comments, Jira-specific issue tables, and indexable documents, with stable identifiers suitable for future event and snapshot tables.
		- **Acceptance criteria**:
			- [ ] All tables are created by database setup or migrations in a deterministic order
			- [ ] Foreign keys and unique constraints support idempotent upserts
			- [ ] Existing `shared_settings` and sqlite-vec smoke behavior remains intact
			- [ ] Schema tests verify table presence, key constraints, representative foreign keys, ISO 8601 timestamp storage, per-resource cursors, progress fields, and future event/snapshot compatibility points
		- **Dependencies**: Existing database setup
	- [ ] **Task: Add repository helpers for common entities**
		- **Description**: Implement typed Rust helpers for people, source identities, work items, terms, relationships, comments, and indexable documents.
		- **Acceptance criteria**:
			- [ ] Helpers accept a `rusqlite::Connection` and are testable without Tauri
			- [ ] Upserts are idempotent for source ids and upstream ids
			- [ ] Source identities create or attach to canonical people without cross-source inference
			- [ ] Indexable document writes use content hashes and mark stale rows when content changes
		- **Dependencies**: Work-data migrations
- [ ] **Story: Jira project schema and AMP field projection**
	- [ ] **Task: Seed and load Jira field mappings**
		- **Description**: Add data-backed Jira field definitions and project field mappings, including AMP custom-field ids and canonical names.
		- **Acceptance criteria**:
			- [ ] AMP mappings exist for parent link, customer name, assigned teams, product, epic link, epic name, epic status, and sprint
			- [ ] Mappings are keyed by source system and project key, not hardcoded globally
			- [ ] Unknown custom fields can be stored in `jira_issue_field_values` without a migration
			- [ ] Tests cover adding a second project with different field ids
		- **Dependencies**: Work-data migrations
	- [ ] **Task: Project Jira issue fields into relational rows**
		- **Description**: Convert Jira API issue responses into work item, Jira issue, field value, term, relationship, people, and indexable document rows.
		- **Acceptance criteria**:
			- [ ] All requested AMP plain fields are parsed or safely recorded as absent/unknown
			- [ ] Raw issue JSON and raw fields JSON are stored with hashes
			- [ ] Labels, components, fix versions, sprint, product, and assigned teams become queryable terms
			- [ ] Assignee and reporter become source identities linked to people
			- [ ] Subtasks, parent, epic, and issue links become relationship rows where data is available
		- **Dependencies**: Repository helpers, Jira field mappings
- [ ] **Story: Jira issue ingestion service**
	- [ ] **Task: Implement paginated Jira search ingestion**
		- **Description**: Build `JiraIssueIngestionService` that loads a configured Jira source, resolves the PAT from keychain, searches selected projects with the AMP field list, follows pagination, and writes issue batches.
		- **Acceptance criteria**:
			- [ ] Ingestion uses the issue #9 Jira API client and configured source records
			- [ ] Search requests include the AMP plain fields plus inline collections
			- [ ] Multi-page search fixtures ingest all pages
			- [ ] The database mutex is not held during network calls
			- [ ] Run summaries record status, counts, started/finished times, progress totals such as `48 of 63` when known, and safe error summaries
		- **Dependencies**: Jira issue projection
	- [ ] **Task: Implement incremental cursors and idempotency**
		- **Description**: Store per-source/project cursors and use updated-time overlap so repeated syncs avoid duplicates and reduce work.
		- **Acceptance criteria**:
			- [ ] First sync ingests all matching issues
			- [ ] Second sync with same fixtures does not duplicate rows
			- [ ] Updated issue fixtures update current state and hashes
			- [ ] Cursor records are advanced only after successful page persistence
			- [ ] Partial failures leave enough cursor state for safe retry
			- [ ] Optional watcher/vote/remotelink cursors and last-sync timestamps are tracked separately from the main issue cursor
		- **Dependencies**: Paginated Jira search ingestion
- [ ] **Story: Inline collections and current-state completeness**
	- [ ] **Task: Persist comments, issue links, worklogs, and tail fetches**
		- **Description**: Store inline paginated Jira collections and fetch tails when `total` exceeds the inline returned count, with optional sub-resource-only fetches disabled by default.
		- **Acceptance criteria**:
			- [ ] Inline comments, issue links, and worklogs are persisted idempotently
			- [ ] Comment tail fetches run only when Jira reports more comments than returned inline
			- [ ] Worklog tail fetch behavior is implemented or safely feature-gated with tests documenting the limitation
			- [ ] Watcher/voter/remotelink fetches are not performed unless explicitly enabled
			- [ ] Enabled watcher/voter/remotelink backfills use their own cursor/last-successful-sync state
			- [ ] Tail fetch failures can mark a run partial without discarding already persisted issues
		- **Dependencies**: Paginated Jira search ingestion
	- [ ] **Task: Preserve event and snapshot prerequisites**
		- **Description**: Ensure issue #10 writes stable current-state records, source identities, hashes, and cursors that issue #11 can use to add changelog-derived events and daily snapshots.
		- **Acceptance criteria**:
			- [ ] Work item ids and Jira upstream ids remain stable across repeated syncs
			- [ ] Current-state fields needed for future snapshots are projected into relational columns
			- [ ] Raw fields and hashes are available for future change detection
			- [ ] No command or UI claims event history or daily snapshots are available in issue #10
		- **Dependencies**: Jira issue projection, incremental cursors
- [ ] **Story: Commands, query surface, and validation**
	- [ ] **Task: Expose ingestion and issue-list commands**
		- **Description**: Add Tauri commands for running Jira issue ingestion, cancelling an active run, reading latest ingestion status/progress, and listing local Jira issues for tests or future UI integration.
		- **Acceptance criteria**:
			- [ ] Commands have generated TypeScript bindings
			- [ ] Command errors are safe and human-readable
			- [ ] `jira_issue_ingestion_run` resolves credentials without exposing PATs
			- [ ] `jira_issue_ingestion_cancel` cooperatively stops an active run and leaves already persisted pages intact
			- [ ] `jira_issue_ingestion_status` or `jira_issue_ingestion_progress` can report saved and total issue counts when Jira provides a total
			- [ ] `jira_issues_list` returns current-state issue rows without raw JSON payloads by default
		- **Dependencies**: Jira issue ingestion service
	- [ ] **Task: Add fixture-backed tests and documentation context**
		- **Description**: Add synthetic Jira fixtures and update durable agent context with schema, module layout, commands, and test guidance.
		- **Acceptance criteria**:
			- [ ] Fixtures cover AMP fields, custom fields, users, comments, issue links, worklogs, and pagination
			- [ ] Tests can run without real Jira credentials or network access
			- [ ] Redaction tests prove PATs and auth headers do not leak
			- [ ] `context-agent/wiki/code-map.md` documents new modules and tables
			- [ ] `context-agent/wiki/testing.md` documents targeted test commands
		- **Dependencies**: All implementation tasks
	- [ ] **Task: Run validation checks**
		- **Description**: Run narrow Rust tests first, then broader repository checks where practical.
		- **Acceptance criteria**:
			- [ ] Targeted Rust ingestion/schema tests pass
			- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` passes
			- [ ] `npm run lint` passes if TypeScript/UI files change
			- [ ] `npm test` passes if TypeScript/UI files change
			- [ ] `npm run build` passes or skipped with a clear reason
		- **Dependencies**: All implementation tasks