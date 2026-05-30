---
created: 2026-05-29
last_updated: 2026-05-29
status: proposed
decided_by: null
superseded_by: null
---

# ADR 009: Gardener — event-driven triage producer subsystem

## Status

Proposed

## Context

`hm` produces backlog-hygiene suggestions — duplicate merges, stale-issue actions, and thin-ticket enrichments (#13/#14/#15) — and will likely add more producers later. The collection viewer (`collection-read.md`, `collection-enhance.md`) is the uniform *consumer* of these suggestions. This ADR decides how the *producer* side is shaped.

What is driving this decision:

- The three producers differ deeply. They depend on different inputs (vector embeddings #12, event history #11, the AI provider #7), use AI to different degrees (none for stale, generation for enrichment), run in a different number of steps (single-step detection versus detect-then-generate), and span a wide cost range (free heuristics to expensive AI calls).
- ADR-003 makes `hm` a local-first desktop app: there is no always-on backend, the app is opened and closed, and the machine sleeps.
- The consumer is uniform. It shows one list with uniform selection, suppression, reversal, and audit, so every producer must emit a uniform suggestion shape and lifecycle.
- Ingestion (#10) already provides a background service, runs, cursors, idempotent re-sync, and a manual "Run sync now." History (ADR-005) already established event-driven catch-up: missing snapshots are reconstructed on the next ingestion.

The question: do we build one producer per capability, fuse them, or split them into independent services — and what triggers them, given there is no always-on process?

## Decision

`hm` gains a **gardener**: a producer subsystem in the Rust core, composed of a thin **runner** plus pluggable **engines** behind a declarative **engine contract**.

- **One engine per capability** (duplicate, stale, enrichment), mapped one-to-one to the suggestion `category`.
- **The runner is deliberately thin.** It owns only the invariants: suggestion persistence, the suppression store, audit wiring (#45), failure isolation, trigger dispatch, and advancing a state machine whose states it does not itself define. Everything engine-specific is declared as data in the engine contract — dependencies, accepted triggers, an N-stage pipeline with optional human gates, an approval policy, the suppression-key shape, cost, and the emitted suggestion shape. A new engine is a new contract instance with no runner changes, mirroring the consumer's `EntityContract`.
- **Scheduling is event-driven, not scheduled.** The runner reacts to ingestion-complete events and to explicit on-demand requests. There is no wall-clock cron. A gardener watermark plus incremental processing bound the work, and catch-up happens on the next ingestion after the app reopens.
- **Suppression is one generalized mechanism**, consulted before emitting during scheduled runs and bypassed on explicit on-demand requests.
- **Enrichment generation is config-based, defaulting to eager-all-detected**, with a per-sweep and first-run cap.

The full operational contract lives in `context-agent/collections/collection-gardener.md`.

## Consequences

**Positive:**

- New producers slot in as declarative contracts with no runner surgery, reusing the `EntityContract` pattern that already worked on the consumer side (#37).
- The consumer gets a guaranteed-uniform suggestion shape and lifecycle regardless of how an engine works internally.
- The design is robust to the app being closed: catch-up reuses ADR-005's reconstruction pattern, so there is no missed-cron failure mode.
- Cost stays bounded because incrementality processes only the changed delta, not the whole backlog.
- The two-gate enrichment flow (detect, confirm, generate, approve) is one filling of the pipeline field; single-step engines are the degenerate case.

**Negative:**

- The runner, the engine-contract interface, the suggestion schema and state machine, the suppression store, and the watermark are net-new infrastructure that must exist before the first engine, so they need their own foundation issue.
- A thin generic runner adds indirection compared with three bespoke producers; the payoff arrives only once there are multiple engines.
- Eager-default enrichment can spend AI tokens on issues a user never reviews; the config policy and first-run cap reduce this risk but do not remove it.
- The runner advancing engine-defined state machines is more abstract to test than fixed, hard-coded flows.

## Alternatives considered

### Option 1: One engine running multiple rules

A single engine hosts duplicate, stale, and enrichment as internal rules sharing one code path.

**Pros:**
- Fewer moving parts to build initially.
- One place to read for all triage logic.
- No contract abstraction to design.

**Cons:**
- The three have different dependencies and cost profiles forced through one path.
- They already fail independently in the spec (the partial-failure banner names one engine down while others work); a fused engine cannot.
- Internal branching grows combinatorially as producers are added.

**Why not chosen:** The producers differ in dependency, cost, and failure domain. Fusing them means one dependency outage sinks all three, and the branching becomes unmanageable as the roadmap grows.

### Option 2: Independent engine services, no shared runner

Each engine is a self-contained unit that detects, persists, and manages its own suggestions.

**Pros:**
- Maximum isolation between engines.
- Each engine can evolve on its own.
- No shared kernel to coordinate.

**Cons:**
- Each re-implements suppression, audit, persistence, and lifecycle.
- Those re-implementations drift, breaking the uniform consumer.
- More total code than a shared runner plus thin engines.

**Why not chosen:** The uniform consumer is a forcing function — it requires one suggestion contract, which a shared runner guarantees and independent islands cannot without drifting.

### Option 3: Wall-clock scheduler / cron / OS scheduled task

A timer fires gardener runs on a fixed schedule.

**Pros:**
- Conceptually simple ("run nightly").
- Predictable cadence independent of user activity.
- Familiar pattern from server software.

**Cons:**
- ADR-003 is local-first desktop; the app and machine are frequently off.
- A cron that fires while the app is closed does nothing.
- Duplicates the catch-up problem ADR-005 already solved differently.

**Why not chosen:** A cron is unreliable by construction on a desktop app. ADR-005 already chose event-driven catch-up, and #10 explicitly scopes out a background scheduler. Going always-on would require superseding ADR-003.

### Option 4: Eager enrichment generation for everything, no configuration

Always generate AI rewrites for every detected thin issue, with no user control.

**Pros:**
- Matches the Backlog-grooming narrative literally — everything is pre-done.
- No setting to design or explain.
- Simplest mental model for the user.

**Cons:**
- Unbounded AI cost and latency per sweep.
- Dangerous on a large first-run backlog.
- No escape hatch for cost-conscious users.

**Why not chosen:** We kept eager generation as the default because it preserves the narrative, but made it a configurable policy with a cap so cost stays controllable.

## Cross-references

- `context-agent/collections/collection-gardener.md` — the operational contract this ADR decides the shape of.
- ADR-003 (local-first), ADR-005 (events and snapshots), ADR-006 (AI provider), ADR-007 (two-pass retrieval), ADR-010 (data layering).
- #13 / #14 / #15 — the three v1 engines; the gardener foundation precedes them.
