# Collection — gardener (the producer side)

How hygiene suggestions get *made*. The four sibling docs describe the **consumer** side — the collection viewer that displays, configures, selects, acts on, and reverses suggestions. This doc describes the **producer** side: the subsystem that tends the backlog and emits the suggestions the viewer consumes.

Read `collection-enhance.md` first — it defines the hygiene-suggestion entity this subsystem produces. Read ADR-003 (local-first), ADR-005 (event-sourced history + snapshots), and ADR-008 (settings split); the scheduling model here is a direct consequence of all three.

## The two halves

The backlog-hygiene feature has a producer half and a consumer half. Naming them apart keeps "hygiene" from meaning two things:

- **The gardener** — the producer subsystem. Tends the backlog, runs analysis, emits suggestions. Lives in the Rust core (ADR-002/003). This doc.
- **Backlog hygiene** — the consumer surface. The collection viewer page where a human reviews suggestions. `collection-read.md` + `collection-enhance.md`.

The gardener is the in-app descendant of the manual `gardening-issues` agent skill (sweep → propose → human-gate → apply → reversal log); the name overlap is intentional.

## Concepts

A deliberate hierarchy — each term names exactly one layer:

```
the gardener            producer subsystem (the umbrella)
  ├── runner            thin orchestration kernel — owns invariants, knows no specifics
  │     └── engine      one per capability: duplicate / stale / enrichment
  │           └── signal    individual checks inside an engine
  ├── suppression       shared "don't re-surface this" memory
  └── audit log         shared record of what was committed (see collection-write.md)
        … emits suggestions →  backlog hygiene viewer (consumer)
```

| Term | Meaning |
| --- | --- |
| **gardener** | The whole producing subsystem: runner + engines + suppression + audit. |
| **runner** | The host that drives engines. Deliberately dumb — owns persistence, suppression, failure isolation, trigger dispatch, and state-machine advancement, but knows nothing engine-specific. |
| **engine** | One capability (duplicate detection, stale identification, enrichment). A pluggable strategy behind the runner. The producer-side mirror of `EntityContract`. |
| **signal** | An individual check inside an engine (e.g. stale's "no activity in N weeks"; duplicate's "shared title tokens"). |
| **engine contract** | The declarative plug an engine fills in (below). |
| **candidate** | An engine's stage-1 output — flagged, not yet reviewable. |
| **stage** | One step in an engine's pipeline. |
| **gate** | A human checkpoint between or after stages. |
| **suggestion** | A candidate that has passed through its engine's pipeline far enough to be reviewed. The entity defined in `collection-enhance.md`. |
| **suppression** | A record that a suggestion (or pair) should not be re-surfaced. |
| **watermark** | The gardener's cursor — "gardened through change-event E / timestamp T." |

## The engine contract

Engines vary wildly — dependencies (vector index vs history vs AI provider), AI role (none vs classify vs generate), stage count (1 vs many), approval model (human-gated vs auto-commit), cost (free heuristic vs expensive AI). The runner absorbs all of that **as data, not branching**: each engine declares its shape, and the runner walks it. N engines = N contract instances, zero runner changes — exactly how the collection viewer takes N `EntityContract`s.

An engine declares:

| Field | Purpose |
| --- | --- |
| `id` / `category` | Maps 1:1 to the suggestion `category` (`duplicate` / `stale` / `enrichment`). |
| `dependencies` | What it needs to run (embeddings #12, history #11, AI provider #7). The runner disables it gracefully and surfaces the partial-failure banner when a dependency is down. |
| `accepted_triggers` | Which triggers it honors — `scheduled`, `on_demand`, or both. |
| `pipeline` | An ordered list of **stages**; each stage is `{ compute step, optional gate }`. 1 stage or 6 — the runner just walks the list. |
| `approval_policy` | Whether the terminal stage requires a human gate or auto-commits (auto-commit still writes the audit log and remains suppressable). |
| `suppression_key` | The shape of this engine's suppression records (issue vs pair). |
| `cost` / `run_policy` | Hints the runner uses to decide whether a given trigger warrants a run (e.g. expensive engines decline interactive sweeps). |
| `emits` | The suggestion shape it produces (consumed by the entity contract in `collection-enhance.md`). |

Design the contract general; implement only the three v1 engines. A six-stage agent or a no-gate auto-classifier are future fillings of the same fields, not new machinery.

## The pipeline model

The two-stage enrichment flow is not a special case — it's the general shape, and the others are degenerate fillings of `pipeline`. (`⟂` = human gate.)

```
stale            [ detect → ⟂approve ]                        1 stage,  terminal gate
duplicate        [ detect → ⟂approve ]                        1 stage,  terminal gate
enrichment       [ detect → ⟂confirm → generate → ⟂approve ]  2 stages, gate before the $$ step + terminal
future agent     [ … N stages …, ⟂ at risky / $$ steps ]      N stages, several gates
future classify  [ classify → commit ]                        1 stage,  no gate (auto-apply)
```

Stale and duplicate promote a candidate straight to a reviewable suggestion (the action is already known). **Only enrichment has a meaningful second stage**, because only enrichment has an expensive generation step. The runner executes a stage's compute, then either pauses at a gate (surfacing the suggestion for human action) or proceeds. Expensive gated stages never run during a sweep — they wait for the gate to be satisfied.

## Scheduling & triggers

**There is no wall-clock scheduler in v1, by design.** ADR-003 is local-first desktop: the app is opened and closed, the machine sleeps, so a cron ("run nightly") is unreliable by construction. ADR-005 already chose the alternative — *"missing snapshots are reconstructed on next ingestion"* — and the gardener reuses it verbatim: event-driven catch-up, not scheduled execution.

### Ownership

| Layer | Owns | Status |
| --- | --- | --- |
| **Ingestion service** (Rust core, #10) | **Cadence — the heartbeat.** When fresh data arrives: on launch, on manual "Run sync now," and on a coarse interval while the app is open. | Exists: background service, ingestion runs, cursors, idempotent re-sync, last-sync timestamps. |
| **Gardener runner** | **Reaction.** Subscribes to "ingestion completed" + explicit on-demand requests, and dispatches engines. No timer of its own. | New, thin. |
| **Engine contract** | **Per-engine run policy** — `accepted_triggers`, `cost`, incremental vs full. | New, declarative. |
| **Settings** (SQLite, ADR-008) | **Tunable policy** — sync interval, which engines auto-run, enrichment generation policy, staleness thresholds. | Settings home reserved. |

One discipline: **one heartbeat, not two.** The gardener does not poll on its own interval — it reacts to each completed sync. Two competing schedulers is the trap to avoid.

### How a scheduled run works

```
ingestion completes → advances its cursor → "issues changed since C"
        ▼
runner wakes → computes its OWN delta: changes since the gardener watermark
        ▼
for each enabled engine where accepted_triggers ∋ scheduled AND dependencies available:
     run over the delta (incremental) or full set (if it declares it needs full context)
        ▼
   engine emits candidates → runner consults suppression → walks the pipeline
        → writes suggestions + audit   (gated/expensive stages wait for their gate)
        ▼
advance watermark; per-engine failures isolated → partial-failure banner
```

Three properties make this safe at desktop scale:

1. **Incrementality is the cost control.** A sweep never re-processes the whole backlog. The ingestion cursors (#10) and event history (#11/ADR-005) say *what changed*; engines run over the delta plus affected neighbors (for duplicates, a changed issue's vector near-neighbors).
2. **Catch-up is free.** Reopen after a week → ingestion catches up → emits one large delta → the gardener processes it in a single reactive pass. No missed-cron problem, because there was never a cron.
3. **Stale-suggestion invalidation.** When an issue in the delta changed, suggestions about it may now be wrong (already closed, body edited). The runner refreshes or invalidates suggestions tied to changed issues on the same pass. Upstream reality — not just human action in the viewer — can resolve a suggestion.

### The on-demand path

A user action in the Jira viewer ("enrich this issue", "find duplicates for this") invokes **one** engine over a **targeted** scope and **ignores suppression** — an explicit human request overrides a prior "don't re-surface." Same runner, same engines, no cadence involved. The on-demand trigger *is* the enrichment "confirm" gate: a proactively-detected enrichment candidate that a human chooses to generate is the same mechanism as an explicitly-requested one.

## The three v1 engines

Brief; the producing logic is owned by its issue.

| Engine | Issue | Dependency | AI | Stages | Suppression key |
| --- | --- | --- | --- | --- | --- |
| **duplicate** | #13 | embeddings (#12) | none (vector + structural rerank) | 1 | pair (`not_duplicate_pairs`) |
| **stale** | #14 | history (#11) | none (heuristic signals) | 1 | issue |
| **enrichment** | #15 | AI provider (#7) | generation | 2 (detect, generate) | issue |

### Enrichment generation policy

Thin-issue *detection* is always proactive and cheap. The expensive AI *generation* stage is **config-based, defaulting to eager-all-detected** — so the "Backlog grooming" narrative stays literally true out of the box (enrichments are pre-done when the user opens the app). The setting (ADR-008) lets a cost-conscious user dial generation down toward capped / subset / on-demand.

Eager-all is safe in steady state because of incrementality: after catch-up, a sweep only generates for *newly*-detected thin issues in the delta. The one case that still wants a ceiling is the **first sweep over a large existing backlog** — the same setting caps it so a first run can't become a token bomb.

## Configuration

All gardener policy is user-configurable, persisted to SQLite (ADR-008, data-relevant settings), written by the settings UI and read by the Rust runner — the same flow as the AI-provider config (#7). A dedicated **Backlog hygiene** settings surface (a tab in the existing settings shell) exposes:

| Setting | Scope | Default |
| --- | --- | --- |
| **Engine enable/disable** | per engine (duplicate / stale / enrichment) | all on |
| **Enrichment generation policy** | enrichment | `eager_all` (dial-downable to capped / subset / on-demand) |
| **First-run / per-sweep generation cap** | enrichment | a sane ceiling so a first sweep over a large backlog can't become a token bomb |
| **Staleness thresholds** | stale | e.g. no-activity weeks (default 6, per #14) |
| **Thin-issue thresholds** | enrichment | e.g. minimum body length (per #15) |
| **Confidence display/bucket cutoffs** | all | High ≥85 / Medium 60–84 / Low <60 (per `collection-enhance.md`) |

A disabled engine does not run on any trigger (scheduled or on-demand) and surfaces no suggestions; its existing suggestions remain until resolved. Changing a threshold takes effect on the next run, not retroactively.

## Suppression

One generalized mechanism, not three. A suppression record — `(engine, target | pair, reason, recorded_at)` — is written by both "reject" (any engine) and "not a duplicate" (#13's feedback table, generalized). The runner consults suppression before emitting any suggestion during a scheduled run. On-demand runs bypass it. This replaces the scattered "reuse or extend #13's table" question left open in #48.

## Persistence & state

- Suggestions persist to SQLite (ADR-004). This doc defines the *shape*; the table DDL is owned by #13/#14/#15.
- Each suggestion carries a lifecycle **`state`** — distinct from `status`, which is the target issue's *Jira* status (`collection-enhance.md`). States: `detected` → `generating` (enrichment in flight) → `pending` (awaiting human) → terminal `applied` / `rejected` / `suppressed`.
- The gardener watermark is one more cursor alongside ingestion's (#10) and the events table (ADR-005).
- **Idempotent emission**: re-running over an issue that already has a pending suggestion supersedes it rather than duplicating.
- Runs are **single-flight** (coalesced per engine) — no overlapping sweeps, and an on-demand request during a sweep does not double-emit.

## Failure handling

- **Per-engine isolation.** One engine's dependency outage or error does not sink the sweep; other engines still emit. The viewer's partial-failure banner reflects per-engine status (`collection-enhance.md`).
- **Retry is implicit.** A failed engine simply runs again on the next heartbeat; there is no bespoke retry queue.
- **Mid-pipeline failure.** A generation that fails leaves the suggestion in `detected`, not `generating`, so the next run (or an on-demand retry) can re-attempt.

## Out of scope

- **A standalone always-on daemon or OS-level scheduled task.** Contradicts ADR-003 and #10's scope. If the app is closed, the gardener does not run until reopen; catch-up handles the gap. "Tend my backlog while the app is closed" is a future ADR reopening ADR-003's always-on assumption, not something smuggled in here.
- **Multi-source engines.** v1 engines are Jira-only. The contract does not hard-assume Jira, but GitHub / other sources are a later dimension.
- **Cross-user / cross-machine sharing** of suppressions or learned feedback. Local-only per ADR-003.
- **Inter-engine dependencies or ordering.** v1 engines are independent; no engine consumes another's output.
- **A budgeting UI beyond the generation-policy setting.** v1 exposes the policy knob; richer cost dashboards are future polish.

## Cross-references

- `collection-enhance.md` — the hygiene-suggestion entity this subsystem produces; the action set and the partial-failure banner.
- `collection-read.md` — the viewer that consumes suggestions.
- `collection-write.md` — the action contract, audit log, and reversibility the gardener's output feeds into.
- `collection-history.md` — the audit-log entries each committed action writes.
- `context-human/specs/app.md` — Narratives → Backlog grooming, the canonical user story this subsystem realizes.
- `context-agent/wiki/data-layers.md` — the recompute dependency map the runner walks.
- ADR-009 (this subsystem's decision record), ADR-010 (data layering).
- ADR-003 (local-first), ADR-004 (SQLite), ADR-005 (events + snapshots), ADR-006 (AI provider), ADR-007 (two-pass retrieval), ADR-008 (settings split).
