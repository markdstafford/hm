---
created: 2026-05-30
last_updated: 2026-05-30
status: proposed
decided_by: null
superseded_by: null
---

# ADR 011: Edits follow the git model

## Context

`hm` mutates the source systems it ingests from (Jira today, GitHub and others as sources are
added) on the user's behalf — closing, reassigning, retitling, enriching, merging, linking,
commenting — both one edit at a time and in batches. A mutation model has to satisfy four things at
once:

- **Batching + review.** Related edits should be reviewable as a set *before* anything reaches a
  source, not committed one irrevocable action at a time.
- **Safe undo.** Some source actions are effectively irreversible (a posted comment others may
  reply to; a workflow transition with no inverse). Undo must not depend on reversing the source
  after the fact.
- **No lost work.** A half-finished set of edits must be durable and visible, never silently
  dropped on navigation, reload, or close.
- **Divergence.** A source can change underneath an in-progress edit (a re-sync, or another person
  editing upstream); the model needs a way to reason about that.

The question this ADR answers: what mutation model gives all four?

## Decision

Edits follow the **git model**. An edit does not write to its source immediately — it becomes a
**pending change in a local working set**. The user **stages** changes, **commits** them locally,
and **pushes**; only **push** writes to a source system. The working set spans many items, and a
commit can group changes to several of them at once, the way a git commit spans files.

Two properties follow directly and are the point of the choice:

- **Push is the only boundary that touches a source**, and therefore the single place where
  confirmation and irreversibility apply.
- **Before push, every change is local and freely reversible** — backing one out is a local
  operation, not a source-reverse.

(How this surfaces — the working-set/review UI, what staging defaults to, how changes are grouped
and diffed — is design, not this decision; it lives in the edits concept doc.)

## Consequences

**Positive:**
- In-progress work is never lost: every edit is a durable, visible local change rather than a
  fire-and-forget action.
- The user reviews exactly what will be written before it is written.
- Irreversible risk is concentrated at one explicit push, instead of scattered across every
  action; before push, undo is local and free.
- Divergence has a ready-made model — conflicts — when a source changes under a pending edit.
- One model spans single and batch edits, and every source system uniformly.

**Negative:**
- More machinery than writing immediately: a persisted working set, a review surface, and
  eventually conflict resolution.
- The stage / commit / push lifecycle is heavier than a single action for a one-off edit.
- Outward, non-document-like actions (a public comment) sit awkwardly as "staged but unsent."
- A local working set can drift from the source the longer it sits unpushed.

## Alternatives considered

### Option 1: Immediate writes

Every action writes to its source the moment the user takes it; there is no working set.

**Pros:**
- Simplest possible model — nothing to persist, review, or lose.
- No new surface to build or learn.
- The source is always the single source of truth; no local/remote skew.

**Cons:**
- No batching or review — the source changes before the user can look at the set as a whole.
- Undo means reversing the source on every action, unsafe (or impossible) for irreversible ones.
- A half-finished set of related edits has nowhere to live.

**Why not chosen:** the review and lost-work requirements are exactly what immediacy cannot
provide, and irreversible actions are dangerous without a staging buffer in front of them.

### Option 2: A bespoke staging queue (not git)

Edits accumulate in a pending queue with an "apply" / "drain" action, but with ad-hoc semantics
invented for this app rather than git's model.

**Pros:**
- Gets batching and a review step — the main wins of staging.
- Lighter to specify than a full version-control surface.
- Free to shape the queue exactly to the app's needs.

**Cons:**
- Invents fresh vocabulary for staging, grouping, undo, and divergence that users must learn from
  scratch.
- Without the git mental model, the relationships between "pending," "applied," and "source state"
  are unclear, and there is no natural language for conflicts.
- Tends to grow into a worse re-implementation of version control as edge cases appear.

**Why not chosen:** the value is in the *familiar* model — stage, unstage, commit, push, conflict
already mean something to the user. A bespoke queue reaches for the same mechanics without the
intuition that makes them safe to operate.
