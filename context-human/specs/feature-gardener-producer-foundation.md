---
created: 2026-05-30
last_updated: 2026-05-30
status: implementing
issue: 69
issue_url: [https://github.com/markdstafford/hm/issues/69](https://github.com/markdstafford/hm/issues/69)
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Gardener producer foundation

## What

`hm` needs the producer-side foundation for backlog hygiene suggestions. This feature adds the gardener runner, engine contract, SQLite persistence, suppression store, watermark, settings plumbing, and a reference engine that proves the full path from trigger to viewer.
The gardener is not one of the real triage engines. It is the shared core that the duplicate, stale, and enrichment engines plug into later. The runner owns common behavior: dispatch, dependency checks, single-flight execution, pipeline advancement, suggestion persistence, suppression, state transitions, and failure isolation. Each engine declares its own behavior through a contract instead of adding engine-specific branches to the runner.
After this feature, a trivial reference engine can run from an ingestion-complete event or an explicit on-demand request. It emits a fixed hygiene suggestion into SQLite, and the `Backlog hygiene` page reads that real suggestion store instead of the fixture data created for issue 47.
## Why

Backlog hygiene currently has a consumer surface, but no producer. The page can render duplicate, stale, and enrichment suggestions, yet it still relies on local fixture rows. Users and future engine implementers need a real suggestion lifecycle before the actual engines can ship.
The three real engines have different inputs and costs. Duplicate detection depends on embeddings, stale detection depends on history, and enrichment depends on an AI provider. A shared gardener foundation keeps those engines thin and prevents each one from re-implementing persistence, suppression, gating, state transitions, and audit integration differently.
This feature also enforces the local-first scheduling model from ADR-009. The gardener reacts to completed ingestion and explicit user requests. It does not add a wall-clock scheduler, daemon, or second heartbeat.
## Personas

- **Elena: EM** — wants backlog hygiene suggestions to appear from real local processing instead of demo data, with rejected items staying hidden unless she explicitly asks to re-run.
- **Future triage engine implementer** — needs a declarative engine contract and runner hooks so duplicate, stale, and enrichment engines can plug in without copying lifecycle code.
- **Maintainer** — needs state transitions, idempotency, suppression, and single-flight behavior covered by tests before expensive or source-mutating engines depend on them.
- **Backlog hygiene UI implementer** — needs a typed Tauri read command and data hook that return real pending suggestions in the existing hygiene-suggestion entity shape.
- **Security reviewer** — needs confirmation that the gardener stores suggestion metadata and local truth only, never source tokens, provider credentials, or raw secret-shaped values.
## Narratives

### Elena sees a real suggestion after sync

Elena opens `hm` after configuring Jira ingestion. She runs sync from the existing ingestion flow. When ingestion finishes, the gardener runner receives the completion signal and checks which engines are enabled.
The reference engine is enabled and has no external dependency, so the runner starts it. The engine emits one fixed suggestion, the runner persists it as `pending`, advances the gardener watermark, and records the run result. Elena opens `Backlog hygiene` and sees the suggestion in the same collection viewer that previously showed fixtures.
The page still looks like the hygiene surface she already knows. Rows show action, key, title, assignee, status, category, and confidence. The difference is the source: the page is reading SQLite through the real suggestion store.
### Elena rejects a suggestion and it stays hidden

Elena rejects the reference suggestion from a future action surface, or a test path records the equivalent suppression. The generalized suppression store records the engine, target key, reason, and timestamp.
On the next scheduled gardener run, the reference engine emits the same candidate. The runner checks suppression before writing a pending suggestion and hides it. The suggestion does not reappear in `Backlog hygiene`, so Elena does not have to dismiss the same recommendation every time ingestion runs.
Later, Elena explicitly requests an on-demand run for that target. Because on-demand requests are a direct human override, the runner bypasses suppression and lets the suggestion surface again.
### A future duplicate engine plugs in

A developer implements duplicate detection after embeddings land. They declare an engine contract with `id: duplicate`, category `duplicate`, dependency `embeddings`, accepted triggers `scheduled` and `on_demand`, a one-stage pipeline, a terminal human gate, pair-shaped suppression keys, and a duplicate suggestion payload.
The runner does not need duplicate-specific lifecycle code. It checks the dependency, coalesces concurrent triggers, passes the delta into the engine, consults suppression for the pair, supersedes any older pending duplicate suggestion for the same pair, persists the new one, and reports any engine failure without blocking other engines.
The developer tests the duplicate algorithm separately. The shared runner tests still cover the generic invariants.
## User stories

**Elena sees real gardener output**
- Elena can run Jira ingestion and have the gardener react when ingestion completes.
- Elena can open `Backlog hygiene` and see pending suggestions loaded from SQLite, not fixture data.
- Elena can see an empty state when no pending suggestions exist.
- Elena can trigger an on-demand gardener run for a target through a Tauri command or implementation test seam.
- Elena can trust that a second immediate scheduled run does not duplicate the same pending suggestion.
**Future triage engine implementer plugs into the runner**
- Future implementer can define an engine contract with id, category, dependencies, accepted triggers, pipeline stages, approval policy, suppression key shape, cost/run policy, and emitted suggestion shape.
- Future implementer can register a new engine without editing persistence, suppression, watermark, or single-flight code.
- Future implementer can declare dependencies and have a missing dependency disable only that engine.
- Future implementer can choose scheduled, on-demand, or both trigger types.
- Future implementer can define one-stage and two-stage pipelines with optional gates.
**Maintainer validates lifecycle behavior**
- Maintainer can run unit tests for valid and invalid suggestion state transitions.
- Maintainer can verify idempotent supersede: re-emitting over the same target or pair replaces the prior pending suggestion instead of creating a duplicate.
- Maintainer can verify suppression hides suggestions during scheduled runs and is bypassed by on-demand runs.
- Maintainer can verify single-flight behavior coalesces a second trigger while an engine is active.
- Maintainer can verify gated expensive stages do not run during a scheduled sweep.
**Backlog hygiene UI implementer removes fixtures**
- UI implementer can call a typed Tauri command that lists pending hygiene suggestions in the existing `HygieneSuggestion` shape.
- UI implementer can replace `useHygieneSuggestions()` fixture reads with the real command while keeping the existing entity contract and detail renderers.
- UI implementer can keep fixture data only in tests or local development helpers, not in the default app data path.
- UI implementer can show loading, empty, and safe error states from the real command.
**Security reviewer checks data handling**
- Security reviewer can confirm gardener settings live in SQLite shared settings per ADR-008.
- Security reviewer can confirm suppressions are local truth keyed by source identity, not by transient local row ids.
- Security reviewer can confirm suggestions store issue metadata and recommendation payloads but no Jira PATs, AI provider tokens, auth headers, or raw secret-shaped values.
- Security reviewer can confirm command errors are redacted and safe for display.
## Goals

- Add a Rust gardener module under `src-tauri/src/gardener/`.
- Define the declarative engine contract for id, category, dependencies, accepted triggers, ordered pipeline stages, gates, approval policy, suppression key shape, cost/run policy, and emitted suggestion payload.
- Add runner support for scheduled ingestion-complete triggers and explicit on-demand triggers.
- Keep the runner thin: it owns common invariants and never branches on duplicate/stale/enrichment-specific logic.
- Enforce per-engine single-flight execution with trigger coalescing.
- Execute pipelines one stage at a time, pausing at gates and skipping gated expensive stages during scheduled sweeps.
- Persist hygiene suggestions in SQLite as derived/cache data per ADR-010.
- Store suggestion lifecycle state separately from the target issue's source-system status.
- Implement lifecycle states: `detected`, `generating`, `pending`, `applied`, `rejected`, and `suppressed`.
- Implement idempotent emission by superseding an existing pending suggestion for the same engine and suppression key.
- Add a gardener watermark that records the last processed source change event or timestamp per engine/source scope.
- Add a generalized suppression store for issue-shaped and pair-shaped suppressions.
- Consult suppressions before scheduled emission and bypass them for on-demand emission.
- Reuse issue #45's audit log for committed source-system actions; do not add a second audit surface.
- Read per-engine enable/disable and policy from SQLite shared settings.
- Add a reference engine with no real dependency that emits one deterministic suggestion.
- Replace the default `useHygieneSuggestions()` data source with the real suggestion store.
- Register new Tauri commands and regenerate TypeScript bindings.
- Cover state transitions, supersede, suppression, single-flight, pipeline walking, reference-engine integration, and UI data replacement with tests.
## Non-goals

- No implementation of the real duplicate engine. Issue 13 owns duplicate detection.
- No implementation of the real stale engine. Issue 14 owns stale identification.
- No implementation of the real enrichment engine. Issue 15 owns thin-ticket detection and AI generation.
- No backlog hygiene settings UI tab. This feature reads settings; a separate issue writes them through UI.
- No wall-clock scheduler, daemon, OS scheduled task, or always-on background process.
- No multi-source engine behavior. The contract must not hard-assume Jira, but v1 runs against Jira-derived work items.
- No new audit-log surface. Source-system commits continue to use issue 45's audit log.
- No Jira write-back from the reference engine.
- No source-system credentials, AI provider credentials, or tokens stored in gardener tables.
- No cross-user or cross-machine sync of suppressions, settings, suggestions, or learned feedback.
- No rich cost/budget dashboard beyond reading the policy fields needed by the runner.
## Design spec

### Product behavior

The visible product change is small but important: `Backlog hygiene` switches from fixture-backed rows to real persisted suggestions. Users should not need to learn a new page. The collection viewer, view chips, row layout, grouping, sorting, filtering, and detail renderers stay the same.
The reference engine's suggestion may be clearly marked as reference/test output in its rationale so early builds do not imply that a real triage engine has analyzed the user's backlog. If the product copy needs to hide reference output outside development builds, the implementation may gate registration of the reference engine behind a debug-only or test-only setting while still proving the end-to-end pipeline in integration tests.
### Trigger model

The gardener supports two trigger types:

Trigger
Source
Behavior

`scheduled`
Ingestion completes
Runs enabled engines that accept scheduled triggers and have their dependencies available. Consults suppressions. Advances the gardener watermark after successful processing.

`on_demand`
Explicit command from UI or tests
Runs one enabled engine over a targeted scope. Bypasses suppression because the user explicitly asked to re-check the target. Does not require a wall-clock cadence.

The ingestion service owns cadence. The gardener only reacts. If the app is closed, no gardener work runs; on reopen, ingestion catches up and the gardener processes the resulting delta.
### Engine contract

Each engine declares this shape. Field names can follow Rust naming conventions, but the concepts are required.

Field
Required behavior

`id`
Stable engine id such as `reference`, `duplicate`, `stale`, or `enrichment`.

`category`
Hygiene category emitted to the viewer. The reference engine may use a safe category such as `stale` only if its payload renders honestly.

`dependencies`
Declares services or data layers needed to run. Missing dependencies disable this engine only.

`accepted_triggers`
Lists `scheduled`, `on_demand`, or both.

`pipeline`
Ordered stages. Each stage has a compute step and optional gate metadata.

`approval_policy`
Declares whether the terminal stage waits for human approval or can auto-commit. v1 reference output should be pending, not auto-mutating.

`suppression_key`
Declares issue-shaped or pair-shaped keys. Keys use source identifiers where available.

`cost` / `run_policy`
Helps the runner decide whether a trigger should run the engine and whether a stage is allowed during sweeps.

`emits`
Describes the hygiene suggestion payload the stage produces.

The runner treats these fields as data. Adding a new engine must not require adding `if duplicate`, `if stale`, or `if enrichment` branches to runner lifecycle code.
### Pipeline and gates

The runner walks each engine's stages in order:
1. Load the delta or target scope.
2. Run the current stage's compute step.
3. Persist candidate or suggestion state.
4. If the stage has a gate, pause and surface the suggestion for human action.
5. If there is no gate, advance to the next stage or terminal state.
Scheduled sweeps must not run gated expensive stages. For example, the future enrichment engine may proactively detect thin issues, but AI generation behind a gate must wait for policy or explicit human action.
The reference engine can use a one-stage pipeline with a terminal human gate:
```plain text
reference: [ emit fixed suggestion → approve/reject gate ]
```
### Suggestion lifecycle

Suggestion state is distinct from the target Jira issue's `status`.
```plain text
detected → generating → pending → applied
                         ├────→ rejected
                         └────→ suppressed
```
Rules:
- `detected` means an engine found a candidate that is not yet fully reviewable.
- `generating` means an expensive or asynchronous generation step is in progress.
- `pending` means the suggestion is ready for human review in `Backlog hygiene`.
- `applied` means a future action handler committed the suggestion to the source system.
- `rejected` means the user rejected it.
- `suppressed` means the runner hid it because suppression matched during a scheduled run.
Invalid transitions return safe errors and must not mutate storage.
### Idempotency and supersede

Engines may see the same target repeatedly as ingestion catches up or a user re-runs a target. The runner must not create duplicate pending suggestions for the same engine and suppression key.
When an engine emits a candidate whose key matches an existing pending suggestion:
1. Mark the old pending suggestion as superseded or replace it in a way that preserves enough history for debugging.
2. Write the new suggestion payload with a new `updated_at`.
3. Return one pending suggestion in list results.
Terminal suggestions remain terminal. A new upstream change may produce a new pending suggestion later if suppression and policy allow it.
### Suppression

Suppression is local truth and survives rebuilds. Records include:
- Engine id.
- Suppression key kind: issue or pair.
- Target source identity or pair of source identities.
- Reason, such as `rejected`, `not_duplicate`, or `manual_suppression`.
- Recorded timestamp.
- Optional note or actor field if the existing local model has a place for it.
Scheduled runs consult suppression before writing or surfacing a pending suggestion. On-demand runs bypass suppression.
### Watermark

The gardener records its own cursor, separate from ingestion cursors. It answers: "this engine processed source changes through this event id or timestamp."
The watermark can live in a dedicated table or in shared settings if the implementation keeps the schema typed and testable. It must be scoped enough to prevent one engine or source from incorrectly advancing another engine's work. At minimum, scope by engine id and source id.
On a successful scheduled run, the runner advances the watermark. If an engine fails, that engine's watermark must not advance past unprocessed work. Other engines may still advance their own watermarks.
### Backlog hygiene data source

`useHygieneSuggestions()` should read real persisted suggestions through a Tauri command. The command returns pending suggestions in the current frontend `HygieneSuggestion` shape, including:
- `id`
- `action`
- `key`
- `title`
- `confidence`
- `category`
- `status`
- `assignee`
- `rationale`
- category-specific detail payloads
The hook keeps the existing loading, empty, and error behavior. The default app path must no longer return fixture rows. Fixture data can remain for unit tests and Storybook-like development paths.
## Tech spec

### Prerequisites and references

- GitHub issue 69 — `feat(gardener): producer foundation`.
- ADR-009 — gardener architecture, event-driven scheduling, runner/engine split.
- ADR-010 — single-store data layering and derived/local-truth categories.
- ADR-003 — local-first desktop architecture.
- ADR-004 — SQLite primary store.
- ADR-008 — shared settings in SQLite and credentials outside the DB.
- `context-agent/collections/collection-gardener.md` — operational contract.
- `context-agent/collections/collection-enhance.md` — hygiene suggestion entity.
- `context-agent/wiki/data-layers.md` — recompute dependency map.
- Issue 10 — Jira ingestion heartbeat and cursors.
- Issue 11 — event/history and watermark pattern.
- Issue 45 — audit log for committed actions.
- Issue 47 — fixture-backed hygiene read rendering to replace.
### System architecture

```plain text
┌───────────────────────────────────────────────────────────────┐
│ React                                                         │
│  features/backlog-hygiene/data.ts                            │
│    useHygieneSuggestions() → commands.hygieneSuggestionsList  │
│                                                               │
│  entities/hygiene-suggestion/*                               │
│    existing row/detail contract remains the UI shape          │
└──────────────────────────┬────────────────────────────────────┘
                           │ generated bindings
┌──────────────────────────┴────────────────────────────────────┐
│ Tauri commands                                                │
│  hygiene_suggestions_list                                     │
│  gardener_run_on_demand                                       │
│  gardener_record_suppression, if needed for tests/action seam │
└──────────────────────────┬────────────────────────────────────┘
                           │
┌──────────────────────────┴────────────────────────────────────┐
│ Rust gardener module                                          │
│  contract.rs      engine contract types                       │
│  engine.rs        Engine trait and emitted candidate types     │
│  runner.rs        trigger dispatch, single-flight, pipeline    │
│  repository.rs    suggestions, suppressions, watermark queries │
│  schema.rs        DDL and schema assertions                    │
│  settings.rs      per-engine policy from shared settings       │
│  reference.rs     deterministic reference engine               │
│  commands.rs      IPC-facing list/run helpers                  │
└──────────────────────────┬────────────────────────────────────┘
                           │
┌──────────────────────────┴────────────────────────────────────┐
│ SQLite                                                        │
│  gardener_suggestions          derived/cache                  │
│  gardener_suggestion_events?   optional debug/history         │
│  gardener_suppressions         local truth                    │
│  gardener_watermarks           cursor / derived progress      │
│  shared_settings               engine enable/policy           │
│  audit_log                     existing committed-action log   │
└───────────────────────────────────────────────────────────────┘
```
### Rust module details

Add `src-tauri/src/gardener/mod.rs` and register it from `lib.rs`.
Suggested files:
- `contract.rs` — serializable contract structs and enums:
	- `GardenerEngineId`
	- `SuggestionCategory`
	- `GardenerTrigger`
	- `GardenerDependency`
	- `PipelineStageSpec`
	- `GatePolicy`
	- `ApprovalPolicy`
	- `SuppressionKeySpec`
	- `EngineCost`
	- `RunPolicy`
- `engine.rs` — trait seam for engines:
	- `fn contract(&self) -> EngineContract`
	- `fn compute(&self, context: EngineRunContext, stage: PipelineStageId) -> Result, GardenerError>`
- `runner.rs` — orchestration:
	- dependency checks
	- enabled-policy checks
	- single-flight guard by engine id
	- scheduled and on-demand dispatch
	- pipeline walking
	- suppression consult
	- idempotent persistence
	- watermark advancement
- `repository.rs` — typed SQLite helpers for suggestions, suppressions, and watermarks.
- `schema.rs` — DDL and column-presence assertions.
- `settings.rs` — shared settings load/validate/default behavior.
- `reference.rs` — no-dependency reference engine.
- `commands.rs` — Tauri command wrappers.
### SQLite schema

Column names may evolve during implementation, but the schema must preserve these semantics.
#### `gardener_suggestions`

Derived/cache table. May be dropped and rebuilt as long as local truth remains intact.

Column
Type
Meaning

`id`
`TEXT PRIMARY KEY`
Stable local suggestion id.

`engine_id`
`TEXT NOT NULL`
Producer engine.

`category`
`TEXT NOT NULL`
`duplicate`, `stale`, `enrichment`, or reference-compatible category.

`state`
`TEXT NOT NULL`
Lifecycle state.

`action_id`
`TEXT NOT NULL`
Hygiene action verb such as `close-as-resolved`.

`source_id`
`TEXT NULL`
Source system id when known.

`target_source_kind`
`TEXT NOT NULL`
Stable source kind, e.g. `jira_issue`.

`target_upstream_id`
`TEXT NOT NULL`
Immutable upstream id when known.

`target_display_key`
`TEXT NOT NULL`
Human-readable key, e.g. `AMP-1043`.

`suppression_key_json`
`TEXT NOT NULL`
Canonical issue or pair key used for idempotency and suppression.

`confidence`
`INTEGER NOT NULL`
0–100.

`title`
`TEXT NOT NULL`
Target title for row display.

`status`
`TEXT NULL`
Source-system status for row display.

`assignee`
`TEXT NULL`
Display assignee or null.

`rationale`
`TEXT NOT NULL`
Short explanation.

`payload_json`
`TEXT NOT NULL`
Category-specific detail payload.

`superseded_by`
`TEXT NULL`
New suggestion id when superseded.

`created_at`
`TEXT NOT NULL`
UTC timestamp.

`updated_at`
`TEXT NOT NULL`
UTC timestamp.

`terminal_at`
`TEXT NULL`
UTC timestamp for terminal state.

Indexes:
- `(state, updated_at DESC)` for pending-list reads.
- `(engine_id, suppression_key_json, state)` for idempotent supersede.
- `(source_id, target_source_kind, target_upstream_id)` for invalidation after upstream changes.
#### `gardener_suppressions`

Local-truth table. Must survive rebuilds.

Column
Type
Meaning

`id`
`TEXT PRIMARY KEY`
Stable suppression id.

`engine_id`
`TEXT NOT NULL`
Engine that owns the suppression.

`key_kind`
`TEXT NOT NULL`
`issue` or `pair`.

`key_json`
`TEXT NOT NULL`
Canonical source-identity key.

`reason`
`TEXT NOT NULL`
`rejected`, `not_duplicate`, or similar.

`recorded_at`
`TEXT NOT NULL`
UTC timestamp.

Unique index:
- `(engine_id, key_kind, key_json)` so repeated rejects update or no-op instead of duplicating.
#### `gardener_watermarks`

Cursor table. If implementation uses `shared_settings`, it still needs equivalent semantics and tests.

Column
Type
Meaning

`engine_id`
`TEXT NOT NULL`
Engine scope.

`source_id`
`TEXT NOT NULL`
Source scope.

`cursor_kind`
`TEXT NOT NULL`
`event_id`, `timestamp`, or implementation-specific cursor type.

`cursor_value`
`TEXT NOT NULL`
Last processed cursor value.

`updated_at`
`TEXT NOT NULL`
UTC timestamp.

Primary key:
- `(engine_id, source_id, cursor_kind)`
### Commands and bindings

Add Tauri commands and include them in both `collect_commands!` lists in `src-tauri/src/lib.rs`.
Required commands:
- `hygiene_suggestions_list(filter?)` — returns pending suggestions for the Backlog hygiene page.
- `gardener_run_on_demand(input)` — runs one enabled engine over a target scope and returns a run summary.
Useful implementation/test command:
- `gardener_record_suppression(input)` — records a suppression. If this is too product-facing for v1, keep it `pub(crate)` and test through repository/runner APIs.
Regenerate `src/bindings.ts` after commands are registered.
### Ingestion-complete integration

When a Jira ingestion worker finishes a successful project run, it should invoke the gardener scheduled path with the relevant source/project scope. This call is best-effort. A gardener failure must not roll back ingestion success.
The integration must not hold the SQLite mutex across external work. Follow the ingestion `DbAccess` pattern: acquire the connection for short reads/writes, release it during compute work, and reacquire for persistence.
If the implementation cannot cleanly call the runner from the existing worker without risking lock contention, add a narrow internal event seam first and document the limitation in code. Do not add a polling scheduler to compensate.
### Reference engine behavior

The reference engine exists to prove plumbing, not product intelligence.
Default contract:
- `id`: `reference`
- `category`: choose the existing hygiene category that best matches the payload, likely `stale`, or add a non-production mapping hidden from normal users.
- `dependencies`: none
- `accepted_triggers`: `scheduled`, `on_demand`
- `pipeline`: one stage with a terminal human gate
- `approval_policy`: human review required
- `suppression_key`: issue-shaped
- `cost`: cheap
- `run_policy`: incremental-safe
The emitted suggestion should be deterministic in tests. If a real Jira work item exists in the target scope, attach to that item. If no work item exists, integration tests may seed a local work item and run the engine against it. Avoid shipping a fake `AMP-*` row into a user's production database when no local issue exists.
### Settings

Use SQLite shared settings for policy. Suggested key:
```plain text
gardener.policy.v1
```
Suggested JSON value:
```json
{
  "engines": {
    "reference": {
      "enabled": true,
      "scheduled": true,
      "on_demand": true
    },
    "duplicate": {
      "enabled": true,
      "scheduled": true,
      "on_demand": true
    },
    "stale": {
      "enabled": true,
      "scheduled": true,
      "on_demand": true
    },
    "enrichment": {
      "enabled": true,
      "scheduled": true,
      "on_demand": true,
      "generation_policy": "eager_all",
      "first_run_cap": 25,
      "per_sweep_cap": 10
    }
  }
}
```
This feature only needs to read settings and provide defaults. The settings UI is out of scope.
### Frontend changes

Update `src/features/backlog-hygiene/data.ts`:
- Replace default fixture loading with `commands.hygieneSuggestionsList`.
- Map generated binding types into the existing `HygieneSuggestion` TypeScript type.
- Preserve loading, empty, and error state behavior.
- Keep fixture helpers for tests by dependency injection or explicit test imports.
Update tests:
- Assert the hook calls the command and renders returned rows.
- Assert empty command results show the existing empty state.
- Assert command errors render a safe error state.
- Assert fixture rows are not used by the default app path.
### Error handling and redaction

Add a `GardenerError` type with safe display messages. Errors may include categories such as:
- Invalid engine contract.
- Disabled engine.
- Missing dependency.
- Invalid transition.
- Database error.
- Pipeline stage failed.
- Suppression key invalid.
Do not include raw SQL strings, source-system tokens, auth headers, provider credentials, or raw upstream error bodies in displayed errors.
### Testing strategy

Rust unit tests:
- State-machine transition validity.
- Idempotent supersede for same engine/key.
- Suppression consult for scheduled runs.
- Suppression bypass for on-demand runs.
- Single-flight coalescing for concurrent triggers.
- Pipeline walking for one-stage and two-stage engines.
- Gated stage pause behavior.
- Missing dependency disables only the affected engine.
- Disabled engine produces no suggestions.
- Watermark advances after success and does not advance for failed engines.
Rust integration tests:
- Seed a local work item, run the reference engine through a simulated ingestion-complete trigger, and read the persisted suggestion through the list command.
- Run the same scheduled trigger twice with no new delta and assert only one pending suggestion appears.
- Record suppression, run scheduled, and assert the suggestion is hidden.
- Run on-demand after suppression and assert the suggestion appears.
- Simulate a source status change and assert a matching pending suggestion resolves or invalidates.
Frontend tests:
- `BacklogHygienePage` renders command-backed rows.
- `useHygieneSuggestions()` returns loading, data, empty, and error states.
- Fixture data is only used in tests or explicit development paths.
- Existing hygiene entity row/detail tests keep passing with command-backed data.
Verification commands:
- `npm test`
- `npm run lint`
- `npm run build`
- `cargo test` from `src-tauri`
## Task decomposition

### Story 1: Add gardener storage and lifecycle primitives

Description: Build the SQLite schema, typed repository helpers, lifecycle state model, and safe error type that all runner behavior depends on.
Acceptance criteria:
- `gardener_suggestions`, `gardener_suppressions`, and gardener watermark storage exist with schema assertions.
- Repository helpers can insert, list, supersede, transition, suppress, and read watermarks.
- Invalid lifecycle transitions return safe errors without mutating rows.
- Suppression keys use stable source identity data where available.
- Unit tests cover schema setup, lifecycle transitions, idempotent supersede, and suppression uniqueness.
Dependencies:
- ADR-004 primary store.
- ADR-010 data category rules.
- Existing SQLite setup in `src-tauri/src/db/mod.rs`.
Tasks:
- Add `src-tauri/src/gardener/schema.rs`.
- Add `src-tauri/src/gardener/repository.rs`.
- Add `src-tauri/src/gardener/errors.rs`.
- Wire schema setup into DB initialization.
- Write repository and state-machine unit tests.
### Story 2: Define the engine contract and runner

Description: Add the declarative engine contract, engine trait seam, and runner that handles triggers, dependency checks, pipeline walking, single-flight, suppression, idempotency, and watermarks.
Acceptance criteria:
- Engine contracts can declare dependencies, triggers, stages, gates, approval policy, suppression key shape, cost, run policy, and emitted payload.
- Runner dispatches only enabled engines that accept the current trigger.
- Runner isolates per-engine failure.
- Runner coalesces overlapping triggers for the same engine.
- Runner pauses at gates and does not run gated expensive stages during scheduled sweeps.
- Runner advances watermarks after successful scheduled runs and leaves failed engine watermarks unchanged.
- Unit tests cover one-stage and two-stage pipelines, suppression behavior, single-flight, and missing dependencies.
Dependencies:
- Story 1 storage primitives.
- ADR-009 gardener architecture.
Tasks:
- Add `contract.rs` with enums and validation.
- Add `engine.rs` with engine trait and emission types.
- Add `runner.rs` with trigger dispatch and pipeline execution.
- Add `settings.rs` with default policy loading.
- Write runner unit tests with fake engines.
### Story 3: Implement the reference engine and ingestion trigger seam

Description: Add a deterministic no-dependency engine and connect successful ingestion completion to the scheduled gardener path without adding a second scheduler.
Acceptance criteria:
- Reference engine emits a valid pending hygiene suggestion for a seeded target.
- Scheduled ingestion-complete trigger invokes the runner best-effort.
- Gardener failure does not roll back ingestion success.
- A second scheduled run with no new delta does not create duplicate pending suggestions.
- Tests can simulate ingestion completion without real Jira credentials.
Dependencies:
- Story 2 runner.
- Existing Jira ingestion commands and worker.
Tasks:
- Add `reference.rs`.
- Register the reference engine in the gardener engine registry.
- Add an internal scheduled-run entry point callable from ingestion.
- Hook successful ingestion completion into the scheduled entry point.
- Write integration tests with seeded local work items.
### Story 4: Expose commands and replace the hygiene fixture data path

Description: Add typed Tauri commands for listing suggestions and running on-demand, regenerate bindings, and update Backlog hygiene to read real data by default.
Acceptance criteria:
- `hygiene_suggestions_list` returns pending suggestions in the frontend `HygieneSuggestion` shape.
- `gardener_run_on_demand` runs one enabled engine over a target scope and returns a safe summary.
- Commands are registered in both `collect_commands!` lists.
- `src/bindings.ts` includes the new commands and types.
- `useHygieneSuggestions()` reads the real command by default.
- Default app behavior no longer shows fixture suggestions.
- Frontend tests cover data, empty, loading, and error states.
Dependencies:
- Story 1 repository list helpers.
- Story 2 runner.
- Existing hygiene entity and Backlog hygiene page from issue 47.
Tasks:
- Add `gardener/commands.rs`.
- Register commands in `src-tauri/src/lib.rs`.
- Regenerate TypeScript bindings.
- Update `src/features/backlog-hygiene/data.ts`.
- Update Backlog hygiene tests to mock command-backed data.
### Story 5: Complete verification and documentation handoff

Description: Validate the full path and leave implementation notes for future engine work.
Acceptance criteria:
- Reference engine suggestion appears in `Backlog hygiene` through the real store.
- Rejected or recorded suppression hides scheduled suggestions.
- On-demand run bypasses suppression.
- Disabled reference engine produces no suggestions.
- Watermark advances after a successful run.
- `npm test`, `npm run lint`, `npm run build`, and `cargo test` pass or any failures are documented with exact reasons.
- Durable implementation notes are added to `context-agent/` if code maps or data-layer details changed.
Dependencies:
- Stories 1–4.
Tasks:
- Run targeted Rust gardener tests.
- Run targeted Backlog hygiene frontend tests.
- Run broader repository checks.
- Update `context-agent/wiki/code-map.md` with gardener module landmarks.
- Update `context-agent/wiki/data-layers.md` if final table names or rebuild rules differ from this spec.
## Open questions and risks

- **Reference engine visibility:** Product builds should avoid implying that a reference suggestion came from a real triage engine. Prefer debug/test-only registration unless implementation has a clear honest label.
- **Watermark source:** Issue 11's history/event model may affect whether watermarks use event ids or timestamps. If event ids are available, prefer them. If not, use timestamps with clear precision and ordering tests.
- **Locking:** Ingestion currently runs long work in a background worker. The gardener must avoid holding the SQLite mutex across compute or provider calls.
- **Suppression write path:** The issue asks for suppression written by reject and "not a duplicate," but those UI actions may not exist in this issue. Implement repository support now and expose only the command/test seam needed to verify behavior.
- **Provider behavior:** This foundation does not call AI providers. Future enrichment behavior still depends on provider availability, routing policy, and cost caps from ADR-006 and ADR-009.