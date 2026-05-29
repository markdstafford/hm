---
created: 2026-05-28
last_updated: 2026-05-29
status: complete
issue: 11
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Jira history and daily snapshots

## What

`hm` needs Jira issue history, not only current Jira issue state. This enhancement adds the ADR-005 time-travel layer to Jira issues by ingesting every observable Jira changelog field item into local event rows, materializing one daily snapshot per issue, and showing status transitions in the Jira issue detail view.
Issue #10 already stores Jira current state in `work_items` and `jira_issues`, tracks ingestion runs and cursors, and exposes a Jira issue list/detail surface. Issue #11 builds on that baseline. It does not replace current-state ingestion; it adds event capture, replayable snapshots, retention, and historical query commands that later roadmap health, status reports, and chat answers can use.
## Why

Current issue data answers "what is true now?" but `hm` also needs to answer "what changed?", "when did this become blocked?", and "what did the backlog look like last Tuesday?" ADR-005 chose an event-sourced history table plus daily snapshots because day-level lookups should be fast and replayable.
Jira Data Center already keeps changelog history. Capturing that history locally gives `hm` a durable, queryable record for the full set of field changes Jira exposes, including status transitions and fields that are not yet shown in the detail pane. Snapshots turn that event stream into direct point-in-time reads for analytics and UI.
## Personas

- **Elena: EM** — wants to see how an issue moved through statuses and answer weekly status questions without manually reading Jira history.
- **Priya: PM** — wants to compare roadmap-relevant issue state across dates, especially status, assignee, priority, sprint, product, customer, and resolution changes.
- **Tarek: Team member** — wants an issue detail timeline that explains recent status movement and shows who made each transition.
- **Maintainer** — needs deterministic event projection, replay, retention, and time-travel tests that run against fixtures with no real Jira server or PAT.
- **Future analytics implementer** — needs stable commands and tables for historical issue state so roadmap health, backlog hygiene, and chat retrieval can query history without reimplementing Jira-specific replay.
## Narratives

### Elena reviews why a ticket slipped

Elena opens the Jira viewer and selects `AMP-1043`, a work item that missed this week's plan. The detail pane shows the current status at the top and a status-transition timeline below it.
The timeline shows `To Do → In Progress` on Monday, `In Progress → Blocked` on Wednesday, and `Blocked → In Progress` on Friday. Each transition includes the Jira actor when available and the source timestamp. Elena can explain the slip without opening Jira's history tab.
### Priya checks state on a historical date

Priya wants to know which AMP issues were still unresolved at the end of last quarter. `hm` queries `issue_snapshots` for the target date and project. It reads one row per issue instead of folding every event on demand.
For an issue whose snapshot is missing because `hm` was closed that week, the next ingestion run regenerates the missing snapshot from the event stream and current source data. Priya sees a consistent point-in-time result after replay completes.
### Tarek inspects a noisy changelog

Tarek opens an issue with many Jira field edits. `hm` does not render every raw changelog item in the first UI pass. The detail view focuses on status transitions, while the database still stores every observable Jira changelog field item. Known fields such as assignment, priority, resolution, label, sprint, product, and customer changes get typed event names and snapshot behavior; other observed fields are preserved as generic field-change events for future UI and analytics.
When a changelog author is unavailable, deleted, or hidden by Jira permissions, the event remains useful. It stores the raw display data Jira provided, links to a `source_identities` row when possible, and marks the actor as unknown when Jira returned no actor.
## User stories

**Elena views status history**
- Elena can open a Jira issue detail and see a chronological status-transition timeline.
- Elena can see the previous status, next status, transition timestamp, and actor display name when Jira provides one.
- Elena can see a clear empty state when an issue has no captured status transitions yet.
- Elena can trust repeated syncs not to duplicate timeline entries.
**Priya queries historical state**
- Priya can query Jira issue state for an arbitrary historical date covered by retained snapshots.
- Priya can filter historical state by Jira source, project key, status, coarse state, assignee, priority, labels, sprint, product, and customer where those fields are captured.
- Priya can rely on daily snapshots to use local-day dates while storing event timestamps in UTC.
- Priya can use snapshots even if `hm` was closed on the original date, after replay fills the missing days.
**Tarek understands source events**
- Tarek can distinguish status changes from other captured change types.
- Tarek can trust that captured history is not limited to the sparse fields currently visible in the detail pane.
- Tarek can see actor fallback text for deleted, private, or missing Jira users.
- Tarek can inspect current issue data without the history UI slowing the primary detail render.
**Maintainer validates history safely**
- Maintainer can run fixture-backed tests for changelog ingestion with no real Jira credentials.
- Maintainer can test event idempotency, replay, retention compaction, and arbitrary-date snapshot queries.
- Maintainer can add new event types without breaking the status timeline or snapshot projection.
- Maintainer can verify safe errors and logs for history ingestion, including no PATs, headers, raw private response bodies, or token-shaped strings.
## Goals

- Add SQLite tables for Jira issue events, daily issue snapshots, and history job bookkeeping.
- Ingest Jira changelog pages for each synced issue and store idempotent event rows.
- Capture status transitions as first-class event rows for the issue detail timeline.
- Capture all observable Jira changelog field changes, including fields not currently displayed in the issue detail pane, so history is a complete local record of source-reported field movement.
- Give typed event names and snapshot effects to fields needed for snapshots and analytics: assignment, reporter when present, priority, resolution, labels, components, fix versions, sprint, product, assigned teams, customer, parent/epic fields, due date, and title changes.
- Generate one `issue_snapshots` row per issue per local snapshot date with day-end materialized state.
- Run snapshot generation from the Tauri background worker path after issue/changelog ingestion and at app startup for missed days.
- Regenerate missing snapshots when `hm` was closed for one or more days, using events plus current source-system data from issue #10 tables.
- Add configurable retention with a default of daily snapshots for 1 year, then compact to weekly snapshots beyond that window.
- Add Tauri commands for issue event timeline reads and historical issue-state queries.
- Render a status-transition timeline in the Jira issue detail view using existing design tokens and primitives.
- Cover event ingestion, replay, retention, query, command, and timeline behavior with focused tests.
## Non-goals

- No Jira writes, transitions, comments, assignment changes, or source-system mutations.
- No real-time webhook ingestion; history updates continue through pull-based Jira sync.
- No full historical diff UI for every Jira field in this issue. The first UI renders status transitions only, even though storage captures all observable field changes for future UI expansion.
- No charting package or analytics dashboard.
- No vector embeddings or retrieval changes.
- No GitHub, Slack, roadmap, objective, or PR history tables in this issue, though the model should not block those future entity types.
- No cross-user shared history or remote backend.
- No Jira Cloud-specific changelog behavior beyond preserving deployment kind and failing safely if an unsupported shape appears.
- No user-facing retention settings screen unless an existing settings pattern makes it trivial; typed storage and defaults are required.
## Design spec

### User-visible behavior

The Jira issue detail pane gains a history section below the current summary fields:
```plain text
AMP-1043
Fix the widget
[In Progress] Alice Smith

Status history
├── May 27, 2026 14:18 · Alice Smith
│   To Do → In Progress
├── May 28, 2026 09:42 · Priya Shah
│   In Progress → Blocked
└── May 29, 2026 16:05 · Alice Smith
    Blocked → In Progress
```
The section uses compact typography, `Badge` or token-styled pills for statuses, and existing `text-subtext` metadata styling. It must not introduce a new shared timeline primitive unless another screen also needs it in the same change. If a reusable primitive is introduced, update `context-agent/design-system.md` in the implementation PR.
### Loading and empty states

The current issue detail should render immediately from `JiraIssueListItem`. History loads independently so a slow query does not block the primary detail pane.
States:
```plain text
Loading:   Loading status history…
Empty:     No status changes captured yet. Run Jira sync to import changelog history.
Error:     Could not load status history. Try syncing Jira again.
Partial:   Showing captured history. Some older changelog pages have not synced yet.
```
The UI may show the partial state when the command returns a safe history coverage flag, such as `complete: false` or a cursor that predates the first known changelog page.
### Timeline ordering

The default timeline ordering is newest first so recent movement is visible without scrolling. If implementation finds the existing detail pane reads better oldest first, tests and copy should explicitly assert that choice. The command should return event timestamps and stable event ids so the UI can order deterministically either way.
### Date and time display

Event timestamps are stored in UTC RFC 3339 strings. The UI formats timestamps in the user's local timezone using the existing date formatting helpers. Snapshot dates are date-only ISO strings (`YYYY-MM-DD`) in the user's local snapshot timezone.
### Accessibility

- The history section uses a heading so screen-reader users can jump to it.
- Each timeline row is a list item with readable text such as `To Do to In Progress, changed May 27, 2026 at 2:18 PM by Alice Smith`.
- Color is not the only signal; status names are always visible text.
- Loading uses an accessible status label when a spinner is used.
## Tech spec

### Prerequisites and references

- Issue #8 — Jira source configuration stores server URL, project keys, and credential refs.
- Issue #9 — Jira API client supports issue changelog pagination.
- Issue #10 — Jira current-state ingestion, source-backed work item schema, ingestion runs/cursors, and Jira issue list command exist.
- ADR-004 — SQLite is the primary store.
- ADR-005 — event-sourced history plus daily snapshots is the chosen time-travel model.
- ADR-008 — source metadata lives in SQLite; Jira PAT values remain in the OS keychain.
- `context-agent/design-system.md` — authoritative UI token and primitive guidance.
### Schema

Extend `src-tauri/src/issues/schema.rs` with new tables and indexes. Names below are the contract unless implementation finds a strong reason to use a source-neutral prefix. If renamed, keep command names and docs clear that these rows are issue-history rows.
```sql
CREATE TABLE IF NOT EXISTS issue_events (
  id TEXT PRIMARY KEY,
  source_system_id TEXT NOT NULL REFERENCES source_systems(id),
  issue_id TEXT NOT NULL REFERENCES work_items(id),
  entity_type TEXT NOT NULL,              -- jira_issue for issue #11
  entity_id TEXT NOT NULL,                -- same as issue_id for Jira issues
  source_kind TEXT NOT NULL,              -- jira
  event_type TEXT NOT NULL,               -- status_changed, assignee_changed, field_changed, etc.
  upstream_event_id TEXT,                 -- Jira changelog history id
  upstream_item_id TEXT,                  -- stable per changelog item when available/derived
  field_id TEXT,
  field_name TEXT,
  actor_identity_id TEXT REFERENCES source_identities(id),
  actor_display_name TEXT,
  occurred_at TEXT NOT NULL,              -- UTC RFC 3339 from Jira history.created
  from_string TEXT,
  to_string TEXT,
  from_json TEXT,
  to_json TEXT,
  payload_json TEXT NOT NULL,             -- redacted Jira changelog item/history payload
  ingested_at TEXT NOT NULL,
  UNIQUE(source_system_id, upstream_event_id, upstream_item_id, issue_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_issue_events_issue_time
  ON issue_events(issue_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_issue_events_type_time
  ON issue_events(event_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS issue_snapshots (
  issue_id TEXT NOT NULL REFERENCES work_items(id),
  snapshot_date TEXT NOT NULL,            -- YYYY-MM-DD in configured local snapshot timezone
  source_system_id TEXT NOT NULL REFERENCES source_systems(id),
  source_kind TEXT NOT NULL,              -- jira_issue for issue #11 rows
  key TEXT,
  title TEXT NOT NULL,
  body_hash TEXT,
  state TEXT NOT NULL,
  status_name TEXT,
  status_id TEXT,
  resolution_name TEXT,
  resolution_id TEXT,
  priority_name TEXT,
  priority_id TEXT,
  item_type TEXT,
  project_key TEXT,
  project_name TEXT,
  assignee_person_id TEXT REFERENCES people(id),
  reporter_person_id TEXT REFERENCES people(id),
  labels_json TEXT NOT NULL DEFAULT '[]',
  components_json TEXT NOT NULL DEFAULT '[]',
  fix_versions_json TEXT NOT NULL DEFAULT '[]',
  sprint_names_json TEXT NOT NULL DEFAULT '[]',
  product_names_json TEXT NOT NULL DEFAULT '[]',
  assigned_team_names_json TEXT NOT NULL DEFAULT '[]',
  customer_name TEXT,
  parent_link TEXT,
  epic_link TEXT,
  epic_name TEXT,
  epic_status TEXT,
  created_at_source TEXT,
  updated_at_source TEXT,
  resolved_at_source TEXT,
  due_at_source TEXT,
  snapshot_source TEXT NOT NULL,          -- generated, replayed, compacted_weekly
  generated_at TEXT NOT NULL,
  PRIMARY KEY(issue_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_issue_snapshots_project_date
  ON issue_snapshots(project_key, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_issue_snapshots_source_date
  ON issue_snapshots(source_system_id, snapshot_date);

CREATE TABLE IF NOT EXISTS issue_snapshot_jobs (
  id TEXT PRIMARY KEY,
  source_system_id TEXT REFERENCES source_systems(id),
  job_kind TEXT NOT NULL,                 -- daily_snapshot, replay_missing, retention_compaction
  status TEXT NOT NULL,                   -- running, succeeded, partial, failed, cancelled
  started_at TEXT NOT NULL,
  finished_at TEXT,
  target_start_date TEXT,
  target_end_date TEXT,
  progress_json TEXT NOT NULL,
  error_summary TEXT
);
```
Retention configuration can live in a versioned shared setting, for example `issue_history.retention`, unless implementation already has a typed source-settings home that is a better fit:
```json
{
  "version": 1,
  "daily_days": 365,
  "compact_to_weekly_after_days": 365,
  "weekly_anchor": "monday"
}
```
### Event projection

Add a history projection module near the current Jira ingestion code, for example:
```plain text
src-tauri/src/issues/history.rs          issue_events/snapshots repository helpers
src-tauri/src/sources/jira_history.rs    Jira changelog → issue_events projection
```
Projection rules:
1. Fetch changelog pages through `JiraApiClient::get_issue_changelog_page` or `get_issue_changelog_all` for each issue that was inserted or updated by issue ingestion.
2. For each Jira changelog history entry, create one `issue_events` row per changelog item that Jira exposes, not only items currently shown in the detail pane.
3. Use deterministic ids, derived from source system id, issue id, Jira changelog history id, item index or field id, and event type.
4. Link the actor to `source_identities` through the same people helper used by issue #10 when Jira provides an author. Store `actor_display_name` even when no identity row can be linked.
5. Store raw field values in `from_string` / `to_string` when Jira gives strings. Store structured values in `from_json` / `to_json` when values are JSON-like or when string values need lossless preservation.
6. Keep `payload_json` safe. It may include Jira changelog item content, field id/name, and actor metadata returned by Jira, but must not include PATs, request headers, or raw HTTP envelopes.
7. Re-running ingestion must be idempotent. Existing event rows should not duplicate; if a row is re-seen with richer actor metadata, update the actor fields and payload only if the stable event identity is the same.
Initial typed event mapping:

Jira field
Event type
Snapshot effect

`status`
`status_changed`
Update `status_name`, `status_id`, and coarse `state`

`assignee`
`assignee_changed`
Update `assignee_person_id` when resolvable

`priority`
`priority_changed`
Update priority fields

`resolution`
`resolution_changed`
Update resolution fields and resolved timestamp when available

`summary`
`title_changed`
Update title

`labels`
`labels_changed`
Update labels JSON

`components`
`components_changed`
Update components JSON

`fixVersions`
`fix_versions_changed`
Update fix versions JSON

AMP sprint custom field
`sprint_changed`
Update sprint names JSON

AMP product custom field
`product_changed`
Update product names JSON

AMP assigned teams field
`assigned_teams_changed`
Update assigned teams JSON

AMP customer field
`customer_changed`
Update customer name

AMP parent/epic fields
`relationship_field_changed`
Update parent/epic fields

`duedate`
`due_date_changed`
Update due date

All other observable Jira changelog items must be stored as `field_changed` rows with the original Jira `field`, `fieldtype`, field id/name when present, from/to strings, and safe redacted payload content. These generic events do not need to affect snapshots in issue #11, but they are part of the durable history contract so future detail-pane fields, diff UI, analytics, and retrieval can use the full record without reingesting Jira history.
### Changelog ingestion flow

Issue #10's Jira issue ingestion service should call the history ingestion step after projecting an issue's current fields. The history step should have its own cursor so it can retry independently from current-state ingestion.
Cursor examples:
```plain text
project:AMP:issues
project:AMP:changelog
issue:AMP-1043:changelog
project:AMP:snapshots
project:AMP:retention
```
A practical first implementation may keep an issue-level high-water cursor keyed by issue key or work item id. If Jira changelog history cannot be reliably filtered by updated date, fetch all changelog pages for changed issues and rely on idempotent upserts. This is acceptable at v1 scale and safer than missing old transitions.
Cancellation must be checked between changelog page fetches. A cancelled run should keep already-written event rows and mark the run partial or cancelled with safe progress.
### Snapshot generation and replay

Snapshots are a cache over current issue rows plus event history. The generator should produce the state at the end of each snapshot date.
Recommended approach:
1. Build a baseline from the earliest available current-state row and available changelog events.
2. For each issue and date, apply all events with `occurred_at  Result, String>
issue_snapshots_query(filter: IssueSnapshotQuery) -> Result, String>
issue_history_retention_get() -> Result
issue_history_retention_save(config: IssueHistoryRetentionConfig) -> Result
```
Suggested TypeScript/Rust shapes:
```plain text
JiraIssueStatusTransition {
  event_id: string,
  issue_id: string,
  occurred_at: string,
  actor_display_name: string | null,
  from_status: string | null,
  to_status: string | null,
}

IssueSnapshotQuery {
  snapshot_date: string,
  source_id?: string,
  project_key?: string,
  status_name?: string,
  state?: string,
  assignee_person_id?: string,
  limit?: number,
}

IssueSnapshotListItem {
  issue_id: string,
  snapshot_date: string,
  key: string | null,
  title: string,
  status_name: string | null,
  state: string,
  assignee_display_name: string | null,
  priority_name: string | null,
  project_key: string | null,
}
```
Errors returned through commands must be safe, short, and actionable. Internal storage details can be logged locally only if they do not contain secrets or raw private payloads.
### UI implementation notes

- Extend `JiraIssueDetail` to call the new status timeline command when the selected item changes.
- Keep current detail tests and add timeline tests for loading, empty, success, error, and actor fallback states.
- Use existing `Badge`, `Spinner`, `EmptyState` or inline copy, and token classes.
- Do not hardcode colors outside semantic tokens.
- If a new shared timeline component is introduced under `src/ui/`, update `context-agent/design-system.md` in the implementation PR.
### Testing strategy

Rust tests:
- Schema creates `issue_events`, `issue_snapshots`, `issue_snapshot_jobs`, and indexes.
- Changelog projection maps fixture status changes to idempotent `status_changed` rows.
- Changelog projection maps unknown or currently unused Jira fields to idempotent `field_changed` rows instead of dropping them.
- Actor projection links to `source_identities` when author data exists and stores fallback display text when it does not.
- Re-running projection does not duplicate events.
- Snapshot generation returns expected state for arbitrary historical dates.
- Replay fills missing dates after simulated app downtime.
- Retention compaction keeps daily rows within 365 days and weekly rows beyond.
- Commands return safe errors and sorted results.
TypeScript/React tests:
- `JiraIssueDetail` renders status history when command data is available.
- Empty, loading, error, and partial states render readable copy.
- Timeline rows include accessible status-change text.
- Existing current-state detail fields still render when history is missing or fails to load.
Integration-style tests:
- Fixture-backed Jira ingestion writes current issue rows, changelog event rows, and snapshots in one run.
- Cancelled history ingestion preserves completed events and reports partial progress.
## Task decomposition

### Story 1: Add history storage primitives

**Description:** Add schema and repository helpers for issue events, daily snapshots, snapshot jobs, and retention config.
**Acceptance criteria:**
- `issue_events`, `issue_snapshots`, and `issue_snapshot_jobs` are created by database setup.
- Indexes support issue timeline lookup and date/project snapshot lookup.
- Repository helpers insert, update, and query events and snapshots without exposing raw SQL to UI command code.
- Retention config has typed defaults and round-trips through local shared settings or a better existing local settings home.
- Tests prove schema creation, idempotent event upsert, snapshot upsert, and default retention behavior.
**Dependencies:** Issue #10 schema and database setup.
#### Task 1.1: Extend the SQLite schema

Add the new tables and indexes to `src-tauri/src/issues/schema.rs`. Update schema tests to assert table and column presence.
#### Task 1.2: Add history repository helpers

Create typed Rust structs and helpers for event upsert, event list by issue/type, snapshot upsert, snapshot query, job start/progress/finish, and retention config load/save.
#### Task 1.3: Add safe error mapping

Map storage and projection failures into safe user-facing strings. Ensure raw SQL errors, raw Jira bodies, and token-shaped values do not cross IPC boundaries.
### Story 2: Ingest Jira changelog events

**Description:** Extend Jira ingestion so changed issues also fetch changelog pages and project every observable changelog field item into `issue_events`.
**Acceptance criteria:**
- Changelog pages are fetched through the existing Jira API client.
- Each observable changelog field item becomes one idempotent `issue_events` row, either as a typed event or as a generic `field_changed` event.
- Status, assignee, priority, resolution, title, label, component, fix version, sprint, product, team, customer, parent/epic, and due-date changes are mapped where fixtures cover them.
- Unknown or currently unused fields are preserved as safe `field_changed` rows instead of being dropped.
- Actor identity is linked when possible and safely represented when missing.
- Per-issue or per-project changelog cursors allow retry independent of current issue ingestion.
- Cancellation between changelog pages leaves a safe partial state.
**Dependencies:** Story 1 and existing Jira API client changelog support.
#### Task 2.1: Implement Jira changelog projection

Create a `jira_history` projection module that maps `JiraChangelogEntry` and its items into typed issue event inputs.
#### Task 2.2: Wire history ingestion into Jira sync

Call changelog ingestion from the Jira issue ingestion service after current-state projection. Add progress counts for events and changelog pages.
#### Task 2.3: Add fixture coverage

Add or extend synthetic Jira changelog fixtures for status, assignee, priority, label, known custom field, unknown/custom field preserved as `field_changed`, deleted author, and missing author cases.
### Story 3: Generate and maintain daily snapshots

**Description:** Add snapshot generation, missed-day replay, and retention compaction.
**Acceptance criteria:**
- Snapshot generator materializes end-of-day issue state for a requested date range.
- Missing days are detected on startup or after sync and regenerated.
- Snapshot rows are replaceable and deterministic across repeated runs.
- Retention compaction keeps daily rows for the configured window and weekly rows beyond it.
- Tests cover arbitrary historical date queries, missed-day replay, and compaction.
**Dependencies:** Stories 1 and 2.
#### Task 3.1: Implement snapshot state folding

Build state-folding logic over current issue rows and issue events. Keep the fold deterministic and fixture-testable without Tauri state.
#### Task 3.2: Add replay job logic

Detect gaps between the last successful snapshot cursor and the current local date. Generate missing snapshots and record `issue_snapshot_jobs` progress.
#### Task 3.3: Add retention compaction

Implement daily-to-weekly compaction based on the retention config. Ensure compaction never deletes `issue_events`.
### Story 4: Expose history commands

**Description:** Add IPC commands for status timeline reads, historical snapshot queries, and retention config.
**Acceptance criteria:**
- `jira_issue_status_timeline` returns sorted status transitions for one issue id.
- `issue_snapshots_query` returns bounded historical issue rows for a date and optional filters.
- Retention get/save commands round-trip typed config with validation.
- TypeScript bindings include all new command shapes.
- Command tests cover sorting, filtering, limits, missing issue behavior, and safe errors.
**Dependencies:** Stories 1 and 3; Story 2 for realistic event data.
#### Task 4.1: Add command types and Rust handlers

Define specta types, command functions, and connection-level query helpers.
#### Task 4.2: Generate and update TypeScript bindings

Run the existing binding generation path and commit the updated `src/bindings.ts` if it changes.
#### Task 4.3: Add command tests

Use in-memory SQLite fixtures to test timeline and snapshot query behavior without Tauri app boot.
### Story 5: Render status history in Jira issue detail

**Description:** Update the Jira issue detail pane to load and render status transitions.
**Acceptance criteria:**
- The detail pane still renders current issue fields immediately.
- Status history loads independently and shows loading, empty, success, partial, and error states.
- Timeline rows show previous status, next status, timestamp, and actor fallback.
- Timeline markup is accessible as a named section and list.
- React tests cover all states and existing detail behavior remains green.
**Dependencies:** Story 4.
#### Task 5.1: Add a timeline data hook or loader

Create a small UI data wrapper around the generated command. Keep command invocation isolated from presentation for testability.
#### Task 5.2: Update `JiraIssueDetail`

Render the `Status history` section using existing tokens and primitives. Avoid adding a shared primitive unless there is a second immediate use.
#### Task 5.3: Add UI tests

Mock command results and verify success, empty, loading, error, and accessibility text.
### Story 6: End-to-end validation and documentation updates

**Description:** Verify the history path across ingestion, commands, and UI. Update durable agent context if implementation discovers new code-map or testing details.
**Acceptance criteria:**
- Narrow Rust and UI tests pass for history modules and detail UI.
- Broader `cargo test`, `npm test`, and `npm run lint` are run when practical.
- `context-agent/wiki/testing.md` or another agent context page is updated if new test commands, fixtures, or gotchas are discovered.
- `context-agent/design-system.md` is updated if implementation adds a reusable timeline primitive or changes shared UI patterns.
**Dependencies:** Stories 1 through 5.
#### Task 6.1: Run targeted tests first

Run focused Rust tests for schema/history/projection/snapshots and focused Vitest tests for Jira issue detail.
#### Task 6.2: Run broader checks

Run the repository's broader validation commands when time and environment allow.
#### Task 6.3: Update durable context only when needed

Document newly discovered implementation landmarks, fixture patterns, or design-system changes in agent-facing context files.