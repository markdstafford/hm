---
created: 2026-05-28
last_updated: 2026-05-28
status: implementing
issue: 45
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Collection write data layer

## What

`hm` needs the backend write layer that lets future collection actions mutate Jira issues safely and record what changed. This feature extends the existing Rust Jira API client with write endpoints, adds a local SQLite audit log, and exposes Tauri mutation commands that future UI surfaces can call.
The first supported mutations are Jira issue transitions, duplicate links, title updates, label updates, reassignment, and comments. Each successful mutation writes an audit-log entry with the action id, target issue, before state, after state, reversibility flag, source feature, and batch id. Single-action commits create a one-entry batch; callers can pass an explicit `batch_id` to group several mutations into one logical approval.
This feature has no React UI consumer. Verification happens through Rust unit/integration tests, regenerated TypeScript command bindings, and a small mock-Jira smoke path. After it ships, a future action handler can call `commands.jiraCloseIssue({ id, before, after })`, see the change land in Jira or a mock, and read the matching audit-log row through `commands.auditLogList(...)`.
## Why

The collection viewer is currently read-only. Backlog hygiene, inline quick edits, and later history undo flows all need one trusted backend path for source-system writes instead of separate ad hoc Jira calls.
The audit log is the safety rail for those writes. It gives the user a local record of every change made through `hm`, groups batch approvals, and stores enough state for reversible actions to undo themselves later. Without this layer, UI work such as the bulk action bar and history view could render buttons but would have no reliable way to commit, inspect, or reverse changes.
## Personas

- **Future action-handler implementer** — needs typed Tauri commands for Jira mutations that return audit entry ids and can be called from collection actions.
- **Elena: EM** — needs future backlog-hygiene approvals to update Jira once and leave a recoverable local trail of what changed.
- **Maintainer** — needs write endpoints, retry behavior, audit persistence, and generated bindings covered by tests before any UI depends on them.
- **History-view implementer** — needs a stable `audit_log` schema and list command that can feed the audit-log-entry collection entity.
- **Security reviewer** — needs confidence that Jira PATs, headers, and source-system secrets never appear in audit rows, errors, logs, generated bindings, or test fixtures.
## Narratives

### A future hygiene approval closes stale issues

Elena reviews a backlog hygiene batch and approves three high-confidence stale issues. The future UI passes the same `batch_id` to three `jiraCloseIssue` command calls. Each command validates the issue key and requested transition, calls Jira, and writes one audit row with the prior status and resulting status.
When the batch finishes, the UI can show a toast because every command returned an audit entry id. Later, the history view can group the three entries by `batch_id` and show them as one approval event. If Jira allows the inverse transition, the reverse command can use the captured before state to reopen each issue to its prior status.
### A future duplicate action links and optionally closes an issue

A hygiene suggestion says `AMP-1043` duplicates `AMP-997`. The action handler calls the duplicate mutation command with the source key, target key, and duplicate link type. The command creates the Jira issue link, optionally performs a close transition when the caller requested one, and writes after state that includes the created link metadata and any status change.
If the duplicate action is reversible, the reverse handler has enough metadata to remove the link and return the issue to the captured prior status. If Jira rejects an inverse transition later because the workflow changed, the reverse command returns a safe error and leaves the original audit entry unreverted.
### A maintainer validates write behavior without Jira credentials

A maintainer runs the Rust tests. The Jira client write-method tests use a local mock HTTP server and an injected sleeper, so retry and rate-limit behavior can be asserted without real sleeps or real Jira credentials. Mutation-command tests use a recording mock client and an in-memory SQLite database.
The tests assert request paths, HTTP methods, JSON bodies, retry attempts, audit row content, batch grouping, redaction, and reversibility metadata. No test fixture contains real hostnames, real PATs, real user names, or real issue content.
## User stories

**Future action-handler implementer**
- Can call `jiraCloseIssue` to transition a Jira issue and receive the new audit entry id.
- Can call `jiraLinkAsDuplicate` to create a duplicate relationship and receive the new audit entry id.
- Can call `jiraUpdateTitle`, `jiraUpdateLabels`, `jiraReassign`, and `jiraAddComment` for their respective Jira updates.
- Can pass an explicit `batch_id` so several commands appear as one batch in the audit log.
- Can omit `batch_id` and have the command create a unique one-entry batch.
- Can call reverse commands for reversible actions and have the original audit entry marked as reverted after the reverse succeeds.
**History-view implementer**
- Can list audit entries filtered by `batch_id`, target reference, date range, and `reversible` flag.
- Can read typed `before_state` and `after_state` JSON values without parsing raw database rows.
- Can distinguish reversible, final, and already-reverted entries.
- Can link a reverted entry to the action id that performed the reversal.
**Maintainer validates behavior locally**
- Can test every Jira write method against a mock HTTP server.
- Can test mutation commands against a mock Jira client and in-memory SQLite.
- Can verify generated TypeScript bindings include all new commands.
- Can run cargo tests without a real Jira server, real PAT, or network access beyond [localhost](http://localhost).
**Security reviewer checks data handling**
- Can confirm Jira PATs stay in memory and keychain-backed credential flows only.
- Can confirm audit rows store issue state and action metadata, not Authorization headers, PATs, raw upstream error bodies, or credential references.
- Can confirm command errors are categorized and safe for UI display.
## Goals

- Extend `src-tauri/src/sources/jira_client.rs` with Jira Data Center write methods that reuse the existing retry, rate-limit, error-mapping, and `Sleeper` patterns.
- Add `list_transitions(issue_key)` for discovering workflow transitions.
- Add `transition_issue(issue_key, transition_id, comment?)` for close and reverse-close flows.
- Add `update_issue_fields(issue_key, fields_payload)` for title, labels, and assignee changes.
- Add `create_comment(issue_key, body) -> comment_id` for comments and future context pings.
- Add `create_issue_link(source_key, target_key, link_type)` for duplicate links.
- Add `delete_comment(issue_key, comment_id)` only if it is cheap and naturally fits the client; `ping_for_context` remains non-reversible even if this helper exists.
- Add an `audit_log` SQLite table with the issue-requested columns and indexes.
- Add `src-tauri/src/audit/` with typed audit entries, safe errors, and append/list/mark-reverted commands.
- Add `src-tauri/src/mutations/` with one command family per Jira mutation.
- Derive each audit entry's `reversible` flag from command registration metadata at write time.
- Support explicit and generated `batch_id` values.
- Register all new commands in both `collect_commands!` lists and regenerate `src/bindings.ts`.
- Keep secrets out of audit rows, logs, errors, snapshots, and generated bindings.
- Cover Jira write methods, mutation commands, reversibility, batch grouping, audit-list filters, and redaction with tests.
## Non-goals

- No React UI, bulk action bar, confirm modal, undo toast, or history page in this feature.
- No collection-row selection behavior or action registration UI.
- No source-system writes other than Jira Data Center issue mutations listed here.
- No GitHub mutation commands.
- No background write queue, offline retry queue, or long-running mutation scheduler.
- No cross-machine audit-log sync.
- No per-user audit-log retention policy; v1 keeps all rows.
- No real Jira workflow planner that decides which transition should close or reopen every issue. v1 can use caller-provided transition ids or hard-coded workflow-category tables until future polish queries full Jira workflow configuration.
- No refresh strategy for displayed collection data after a mutation lands; UI features such as issue #46 or backlog hygiene consumers own that behavior.
- No automated deletion of non-reversible comments. Comment deletion may exist as a low-level Jira client helper, but posted comments remain final from the product contract.
## Design spec

This feature has no user-facing React surface. The design work defines backend behavior that future UI surfaces can trust.
### Backend interaction model

```plain text
Future collection action handler
└── commands.jiraCloseIssue({ issueKey, transitionId, before, after, batchId? })
    ├── Resolve Jira source metadata and PAT through existing source settings/keychain paths
    ├── Validate issue key, requested transition, and caller-provided state shape
    ├── JiraApiClient.list_transitions(issueKey) when transition validation is needed
    ├── JiraApiClient.transition_issue(issueKey, transitionId, comment?)
    ├── audit_log_append({ action_id, target_ref, before_state, after_state, reversible, batch_id })
    └── Return audit entry id

Future history view
└── commands.auditLogList({ batchId?, targetRef?, reversible?, createdFrom?, createdTo? })
    ├── Query local SQLite audit_log
    ├── Return typed entries newest first unless filter asks otherwise
    └── Never call Jira while listing history
```
### Action and command mapping

Action id
Tauri command
Jira client calls
Reversible
Reverse command behavior

`jira-close-issue`
`jiraCloseIssue`
`list_transitions`, `transition_issue`
Yes when inverse transition metadata is available
Transition back to the captured prior status using a supplied or discovered inverse transition.

`jira-link-as-duplicate`
`jiraLinkAsDuplicate`
`create_issue_link`, optional `transition_issue`
Yes when link metadata and prior status are captured
Remove the duplicate link if supported by the implementation seam, then reopen if the command closed the issue.

`jira-update-title`
`jiraUpdateTitle`
`update_issue_fields`
Yes
Restore previous title.

`jira-update-labels`
`jiraUpdateLabels`
`update_issue_fields`
Yes
Restore previous label set, not just inverse add/remove deltas.

`jira-reassign`
`jiraReassign`
`update_issue_fields`
Yes
Restore previous assignee, including unassigned state.

`jira-add-comment`
`jiraAddComment`
`create_comment`
No
None. Deleting comments is not a clean undo because replies and Jira history may remain.

Command names may follow the repository's generated binding casing, but exported TypeScript bindings must expose the same set of capabilities.
### Audit-log row content

The `audit_log` table stores one row per target changed by one mutation command.

Column
Type
Meaning

`id`
`TEXT PRIMARY KEY`
Stable audit entry id generated by the backend.

`batch_id`
`TEXT NOT NULL`
Groups entries committed together. Single mutations still get a unique batch id.

`action_id`
`TEXT NOT NULL`
Stable action id such as `jira-close-issue`.

`target_ref`
`TEXT NOT NULL`
Source-qualified target such as `jira:AMP-1043`.

`before_state`
`TEXT NOT NULL`
JSON object with the captured pre-mutation state needed for display and reversal.

`after_state`
`TEXT NOT NULL`
JSON object with the resulting state and source-system identifiers.

`reversible`
`INTEGER NOT NULL`
`1` when this action declares a reverse handler; otherwise `0`.

`reverted_at`
`TEXT NULL`
Timestamp set when a reverse command succeeds.

`reverted_by_action_id`
`TEXT NULL`
Action id or audit entry id for the reversal, matching the implementation's chosen typed model.

`created_at`
`TEXT NOT NULL`
UTC timestamp for when the local mutation committed.

`source_feature`
`TEXT NOT NULL`
Initiator such as `hygiene-batch`, `inline-quick-edit`, `manual`, or `test`.

Indexes:
- `(created_at DESC)` for history feeds.
- `(batch_id)` for batch grouping and undo.
- `(target_ref)` for per-issue history.
### Audit JSON rules

- `before_state` and `after_state` must be JSON objects, not arrays or raw strings.
- State captures only what the action needs for display and reversal.
- Title, labels, status, assignee, link ids, transition ids, and comment ids are allowed.
- Jira PAT values, Authorization headers, keychain credential references, raw upstream response bodies, and unredacted error strings are forbidden.
- Issue body text may appear only when the mutation changes body text in a future command. This issue does not add a body-update mutation.
### Reversibility rules

Reversibility is declared by the mutation command, not decided ad hoc per row. A reversible action writes `reversible = 1` even if a later real-world Jira state makes reversal fail. In that case the reverse command returns a safe error and leaves `reverted_at` unset.
Reverse commands write their own audit entries. After a reverse command succeeds, it marks the original row with `reverted_at` and `reverted_by_action_id`. Batch undo in a future history view should reverse entries in reverse application order, but this feature only needs primitives that make that possible.
### Error behavior

Mutation commands return safe typed errors that the UI can display. Errors may include a category, target issue key, endpoint kind, and HTTP status code. Errors must not include PATs, Authorization headers, raw response bodies, SQL fragments with user data, or token-shaped substrings.
If the Jira API call succeeds and the audit insert fails, the command must return an error that clearly says the source-system mutation may have committed but local audit persistence failed. The implementation should prefer wrapping the Jira call and audit write in a command-level sequence that minimizes this risk and tests the failure path. Jira cannot participate in the SQLite transaction, so the spec should not claim true distributed atomicity.
## Tech spec

### Prerequisites and references

- Issue #45 — `feat(collections): write data layer (audit log + mutation commands)`.
- Issue #16 — existing batch action infrastructure issue, amended by this spec's backend scope.
- `context-agent/collections/collection-write.md` — action contract, reversibility, audit log, batch grouping.
- `context-agent/collections/collection-enhance.md` — hygiene action ids and reversibility expectations.
- `context-agent/collections/collection-history.md` — future audit-log-entry entity and undo behavior.
- `context-human/specs/app.md` → Security decisions → Audit log.
- `context-human/specs/feature-jira-api-client.md` — existing read-only Jira client patterns.
- ADR-002 — Tauri with Rust core and TypeScript/React UI.
- ADR-003 — local-first single-user v1.
- ADR-004 — SQLite primary store.
- ADR-008 — credentials stay in OS keychain; shared source metadata stays in SQLite.
`context-human/wiki/` is not present in this repository. Existing project convention uses `context-agent/wiki/` for durable implementation maps and human-facing specs under `context-human/specs/`; this spec follows that convention.
### Module layout

Add or extend these Rust modules:
```plain text
src-tauri/src/audit/
  mod.rs
  entry.rs          typed AuditLogEntry, filters, state wrappers, specta exports
  errors.rs         AuditError with safe Display strings
  repository.rs     SQLite create/list/mark-reverted helpers
  commands.rs       Tauri command wrappers

src-tauri/src/mutations/
  mod.rs
  registry.rs       action ids, reversibility declarations, batch id helpers
  jira_close_issue.rs
  jira_link_as_duplicate.rs
  jira_update_title.rs
  jira_update_labels.rs
  jira_reassign.rs
  jira_add_comment.rs

src-tauri/src/sources/
  jira_client.rs    add write methods beside existing read methods
  jira_types.rs     request/response structs for transitions, comments, links, updates
  jira_errors.rs    reuse or extend safe error categories
```
A smaller implementation may combine files if readability stays high, but `audit` and `mutations` should be separate module families because history reads audit data without knowing Jira mutation details.
### Jira client write API

Extend `JiraApiClient` with methods shaped like:
```rust
pub fn list_transitions(&self, issue_key: &str) -> Result, JiraApiError>;
pub fn transition_issue(
    &self,
    issue_key: &str,
    transition_id: &str,
    comment: Option,
) -> Result;
pub fn update_issue_fields(
    &self,
    issue_key: &str,
    fields_payload: serde_json::Value,
) -> Result;
pub fn create_comment(
    &self,
    issue_key: &str,
    body: &str,
) -> Result;
pub fn create_issue_link(
    &self,
    source_key: &str,
    target_key: &str,
    link_type: &str,
) -> Result;
pub fn delete_comment(
    &self,
    issue_key: &str,
    comment_id: &str,
) -> Result;
```
Names can change to match repository style. Keep the behavior constraints:
- Use the existing normalized base URL and path-join helpers.
- Add `Authorization: Bearer `, `Accept: application/json`, `Content-Type: application/json` when sending JSON, and the existing user agent.
- Reuse bounded retry behavior for 5xx responses and transient network failures.
- Reuse 429 handling and the `Sleeper` seam.
- Do not retry non-idempotent writes automatically if the first attempt may have reached Jira and the failure does not clearly happen before request submission. For ambiguous failures, return a safe error rather than risk duplicate comments or duplicate links.
- Map 400/401/403/404/409/429/5xx into safe `JiraApiError` categories.
- Keep raw response bodies out of errors.
Endpoint mapping for Jira Data Center 10.3:

Method
Endpoint
Purpose

`GET`
`/rest/api/2/issue/{issueKey}/transitions`
Discover valid transitions.

`POST`
`/rest/api/2/issue/{issueKey}/transitions`
Transition an issue, optionally with an update comment.

`PUT`
`/rest/api/2/issue/{issueKey}`
Update fields such as summary, labels, or assignee.

`POST`
`/rest/api/2/issue/{issueKey}/comment`
Add a comment and return its id.

`POST`
`/rest/api/2/issueLink`
Create a duplicate or related issue link.

`DELETE`
`/rest/api/2/issue/{issueKey}/comment/{commentId}`
Optional helper only.

### Mock-client seam

Add a trait-based seam so mutation-command tests can use a recording Jira client without HTTP. The seam should cover the new write methods and support the existing source connection-test pattern rather than forcing commands to construct `JiraApiClient` directly.
The real implementation resolves source metadata and PATs using existing settings/keychain code, then constructs `JiraApiClient`. Tests can inject a mock that records calls and returns configured responses.
### Audit repository and commands

`audit::repository` owns schema setup and SQL. `db::setup_schema` must call `audit::repository::setup_schema(conn)` or equivalent so in-memory and production databases get the table.
Commands:
- `auditLogAppend(input) -> AuditLogEntry` or internal-only append helper plus command if future UI needs direct writes.
- `auditLogList(filter) -> Vec`.
- `auditLogMarkReverted(id, by_action_id) -> AuditLogEntry`.
If direct `auditLogAppend` would let UI write arbitrary audit entries, keep the Tauri command private or validate `source_feature`/`action_id` against the registry. Mutation commands should be the normal write path.
### Mutation command inputs

Each mutation command should accept enough explicit before/after state to write a useful audit row without a fresh read after every write. When correctness requires validation, the command may fetch or discover state through Jira first.
Minimum input behavior:
- `issue_key` is required and normalized/validated before use.
- `source_feature` is required or defaults to `manual` only for direct command calls.
- `batch_id` is optional; missing values generate a new id.
- Caller-supplied `before` and `after` objects must match the command's expected shape.
- Label updates must capture the full prior and resulting label sets, not only add/remove lists.
- Reassign must distinguish an explicit unassigned target from an omitted value.
### Command registration and bindings

Register new Tauri commands in both places in `src-tauri/src/lib.rs`:
- The runtime `Builder::::new().commands(collect_commands![...])` list.
- The test-only binding-generation command list.
Regenerate `src/bindings.ts` using the existing test helper or debug export path. The generated names must let TypeScript call the audit and mutation commands without hand-written binding edits.
### Data consistency and transactions

SQLite audit writes should happen inside local transactions where possible. Jira writes cannot be transactionally coupled with SQLite. The command sequence should therefore be:
1. Validate input locally.
2. Resolve source credentials.
3. Call Jira.
4. Insert the audit row in SQLite immediately after Jira success.
5. Return the persisted audit entry id.
If step 4 fails, return a specific `AuditWriteFailedAfterRemoteMutation` style error. Tests must cover this case because it is the main consistency risk.
### Security and redaction

- PAT values stay in `SecretString`/keychain-backed paths and only populate request headers in memory.
- `Debug` and `Display` implementations for configs and errors must redact secrets.
- Audit state values are built from command inputs and safe Jira response identifiers only.
- Tests must include token-shaped strings and assert they do not appear in errors or audit rows.
- Mock fixtures must use fake hostnames, fake issue keys, and fake user values.
## Task decomposition

- [ ] **Story: Extend the Jira API client for write methods**
	- **Description:** Add low-level Jira Data Center write methods that follow the existing client style and are testable without real credentials.
	- **Acceptance criteria:**
		- [ ] `JiraApiClient` exposes transition, field update, comment, and issue-link write methods.
		- [ ] Each method builds the expected HTTP method, path, headers, and JSON body.
		- [ ] Safe error mapping covers auth, permission, validation, missing issue, conflict, rate limit, server, decode, and network cases.
		- [ ] Retry behavior is bounded and does not duplicate ambiguous non-idempotent writes.
		- [ ] Tests use a local mock HTTP server and injected sleeper.
	- **Dependencies:** Existing Jira API client from issue #9.
	- [ ] **Task: Add Jira write request and response types**
		- Add typed structs for transitions, transition requests, field update payloads, created comments, and issue-link requests/responses.
		- Acceptance criteria: types deserialize Jira responses needed by command code; unknown fields are ignored; test fixtures contain only fake data.
		- Dependencies: None.
	- [ ] **Task: Add authenticated write helpers to ****`jira_client.rs`**
		- Implement POST, PUT, and optional DELETE helpers that share auth, headers, redaction, rate-limit, and retry code with GET behavior where safe.
		- Acceptance criteria: helpers set `Authorization`, `Accept`, `Content-Type`, and `User-Agent`; helpers reject unsafe paths; helpers do not expose raw response bodies.
		- Dependencies: Jira write request and response types.
	- [ ] **Task: Implement write methods and HTTP tests**
		- Implement `list_transitions`, `transition_issue`, `update_issue_fields`, `create_comment`, `create_issue_link`, and optional `delete_comment`.
		- Acceptance criteria: one mock-server test per method checks method, path, body, headers, success parsing, and representative error mapping.
		- Dependencies: authenticated write helpers.
	- [ ] **Task: Add retry and rate-limit tests for writes**
		- Cover transient 5xx, 429, and ambiguous non-idempotent failure behavior.
		- Acceptance criteria: tests assert sleeper calls for retryable cases and assert non-idempotent methods are not duplicated after ambiguous failures.
		- Dependencies: write methods and HTTP tests.
- [ ] **Story: Add the audit-log storage layer**
	- **Description:** Create the local audit log schema, typed model, safe errors, and list/mark helpers that future history UI can consume.
	- **Acceptance criteria:**
		- [ ] `audit_log` table exists in in-memory and production database setup.
		- [ ] Indexes exist for created time, batch id, and target reference.
		- [ ] Typed audit entries serialize through serde and specta.
		- [ ] List filters support `batch_id`, target reference, date range, and `reversible`.
		- [ ] Mark-reverted updates only the intended row and returns the updated entry.
	- **Dependencies:** ADR-004 SQLite primary store.
	- [ ] **Task: Add ****`audit`**** module and schema setup**
		- Create `src-tauri/src/audit/` with module exports and schema setup called from `db::setup_schema`.
		- Acceptance criteria: database tests prove `audit_log` and all required indexes are created.
		- Dependencies: None.
	- [ ] **Task: Add typed audit entry, filter, and error types**
		- Define `AuditLogEntry`, append inputs, list filters, state JSON wrappers, and `AuditError`.
		- Acceptance criteria: types derive serde and specta where required; `Display` messages are safe for UI display.
		- Dependencies: audit module and schema setup.
	- [ ] **Task: Implement append, list, and mark-reverted repository functions**
		- Implement SQL operations with JSON validation and safe filter composition.
		- Acceptance criteria: tests cover append, newest-first list, each filter, invalid JSON object rejection, and mark-reverted behavior.
		- Dependencies: typed audit entry, filter, and error types.
	- [ ] **Task: Add audit Tauri commands where appropriate**
		- Expose `auditLogList` and `auditLogMarkReverted`; expose or keep internal append based on registry validation.
		- Acceptance criteria: commands are registered, bindings generate, and command-level tests cover success and safe errors.
		- Dependencies: append, list, and mark-reverted repository functions.
- [ ] **Story: Add mutation command infrastructure**
	- **Description:** Add a command layer that validates inputs, calls Jira through an injectable seam, writes audit entries, and returns audit ids.
	- **Acceptance criteria:**
		- [ ] `src-tauri/src/mutations/` contains action ids and reversibility declarations.
		- [ ] Each mutation command validates input before calling Jira.
		- [ ] Each successful mutation writes one audit row with the correct batch id and source feature.
		- [ ] Each command returns the persisted audit entry id.
		- [ ] Tests use a mock Jira client and in-memory SQLite.
	- **Dependencies:** Jira client write methods and audit-log storage layer.
	- [ ] **Task: Define mutation registry and batch id helpers**
		- Centralize action ids, display labels where useful, reversibility flags, and generated batch id behavior.
		- Acceptance criteria: tests prove each command derives `reversible` from registry metadata and missing `batch_id` values generate unique batches.
		- Dependencies: audit-log storage layer.
	- [ ] **Task: Add Jira client trait seam for mutation commands**
		- Define a trait that real and recording Jira clients implement for the write methods.
		- Acceptance criteria: mutation tests can inject a recording mock; production commands can construct the real client from existing source settings and keychain paths.
		- Dependencies: Jira client write methods.
	- [ ] **Task: Implement reversible field mutation commands**
		- Implement `jiraUpdateTitle`, `jiraUpdateLabels`, and `jiraReassign` plus reverse commands.
		- Acceptance criteria: tests assert Jira call sequence, full before/after audit state, reversibility flag, reverse behavior, and mark-reverted behavior.
		- Dependencies: mutation registry, batch id helpers, and Jira client trait seam.
	- [ ] **Task: Implement transition and duplicate mutation commands**
		- Implement `jiraCloseIssue`, `jiraLinkAsDuplicate`, and their reverse paths when metadata is available.
		- Acceptance criteria: tests assert transition validation, duplicate link creation, optional close behavior, audit state, and reverse sequencing.
		- Dependencies: mutation registry, batch id helpers, and Jira client trait seam.
	- [ ] **Task: Implement comment mutation command**
		- Implement `jiraAddComment` as a non-reversible mutation.
		- Acceptance criteria: tests assert comment creation, returned comment id in `after_state`, `reversible = false`, and no reverse command/undo metadata.
		- Dependencies: mutation registry, batch id helpers, and Jira client trait seam.
	- [ ] **Task: Cover audit-write failure after Jira success**
		- Add tests and error handling for the case where Jira commits but SQLite audit insertion fails.
		- Acceptance criteria: command returns a specific safe error stating the remote mutation may have succeeded while audit persistence failed; no secret data appears.
		- Dependencies: reversible field, transition, duplicate, and comment mutation commands.
- [ ] **Story: Register commands and regenerate bindings**
	- **Description:** Make the new backend surface callable from TypeScript and keep generated bindings in sync.
	- **Acceptance criteria:**
		- [ ] Runtime and test `collect_commands!` lists include all new audit and mutation commands.
		- [ ] `src/bindings.ts` is regenerated from Rust signatures.
		- [ ] `npm test` or `npm run lint` confirms generated TypeScript still type-checks.
	- **Dependencies:** Audit-log storage layer and mutation command infrastructure.
	- [ ] **Task: Update ****`src-tauri/src/lib.rs`**** command lists**
		- Add audit and mutation commands to both command registration lists.
		- Acceptance criteria: the app compiles and binding-generation test can see every command.
		- Dependencies: mutation command infrastructure.
	- [ ] **Task: Regenerate ****`src/bindings.ts`**
		- Run the existing binding-generation path and commit the generated file.
		- Acceptance criteria: new command functions appear in `src/bindings.ts` without hand edits.
		- Dependencies: updated command lists.
	- [ ] **Task: Add TypeScript compile smoke coverage**
		- Run the narrowest relevant frontend check after binding generation.
		- Acceptance criteria: `npm test` or `npm run lint` passes with the regenerated bindings.
		- Dependencies: regenerated TypeScript bindings.
- [ ] **Story: Verify redaction, reversibility, and batch behavior end to end**
	- **Description:** Add cross-cutting tests and a mock-Jira smoke path that prove the data layer is safe and usable by future UI.
	- **Acceptance criteria:**
		- [ ] Batch grouping test writes three entries with the same explicit `batch_id`.
		- [ ] Reversibility tests run each reversible mutation and its reverse and assert captured state returns to the prior value in the mock.
		- [ ] Audit-list tests filter by batch id, date range, target ref, and `reversible = true`.
		- [ ] Redaction tests assert token-shaped strings do not appear in audit rows, command errors, or debug output.
		- [ ] Manual smoke instructions describe running against mock Jira and reading audit rows.
	- **Dependencies:** Jira client write methods, audit-log storage layer, mutation commands, and generated bindings.
	- [ ] **Task: Add batch grouping tests**
		- Execute multiple mutation commands with one explicit batch id.
		- Acceptance criteria: audit list returns all entries with the shared batch id and no unrelated rows.
		- Dependencies: mutation command infrastructure.
	- [ ] **Task: Add reversibility tests**
		- Run reversible commands followed by reverse commands against a stateful mock Jira client.
		- Acceptance criteria: mock state returns to pre-mutation values; original audit entries receive `reverted_at` and `reverted_by_action_id`.
		- Dependencies: mutation command infrastructure.
	- [ ] **Task: Add redaction tests**
		- Seed inputs and mock errors with token-shaped strings and ensure they are not persisted or displayed.
		- Acceptance criteria: assertions cover audit JSON, command errors, `Debug` output, and generated fixtures where relevant.
		- Dependencies: Jira client write methods, audit-log storage layer, and mutation command infrastructure.
	- [ ] **Task: Document and run verification commands**
		- Run the targeted checks and record any caveats in the implementation handoff.
		- Acceptance criteria: `cargo test`, `cargo clippy -- -D warnings`, and `npm test` results are known; mock-Jira smoke path is described.
		- Dependencies: Jira client write methods, audit-log storage layer, mutation commands, and generated bindings.
## Verification plan

- Run `cargo test` from `src-tauri` or the repository's established Rust test command.
- Run `cargo clippy -- -D warnings` for Rust lint coverage.
- Regenerate TypeScript bindings through the existing `generate_typescript_bindings` test or debug export path.
- Run `npm test` to confirm TypeScript and Vitest coverage still pass with regenerated bindings.
- Smoke with a mock Jira server: call a mutation command, list audit rows through `auditLogList`, call the reverse command when available, and confirm `reverted_at` is populated.
## Open questions and risks

- Jira transition reversibility depends on workflow configuration. The data layer can capture prior status and inverse transition metadata, but Jira may still reject a later reverse transition.
- Jira issue-link deletion may require additional endpoint support not explicitly requested by issue #45. If duplicate reversal cannot delete links safely in this feature, mark that reverse path unsupported and keep the audit entry honest.
- Automatic retries for non-idempotent writes can duplicate comments or links after ambiguous network failures. The implementation should be conservative and prefer safe errors over duplicate source-system changes.
- A remote Jira mutation can succeed while the local audit insert fails. The command must surface this as a special consistency-risk error because SQLite and Jira cannot share a transaction.