---
created: 2026-05-30
last_updated: 2026-05-30
status: proposed
decided_by: null
superseded_by: null
---

# ADR 011: Staged, version-control write model ("write = git")

## Status

Proposed. Emerged from a prototyping session (2026-05-30); see
`context-agent/explorations/preview-*.md`. Needs ratification and should be reviewed via
micromanager per `AGENTS.md` before it is treated as accepted. If accepted, it amends ADR-005's
audit/undo posture and supersedes `collection-write.md`'s bulk-action bar as the *primary* write
surface.

## Context

`hm` mutates a source system (Jira) on the user's behalf: closing, merging, reassigning,
enriching, and linking issues, singly and in batches. The write layer must:

- batch related changes and let the user **review before anything hits the source**;
- make undo safe, given some source actions are effectively irreversible (e.g. a posted
  comment);
- **never silently lose local work** — a half-made set of edits must be visible and durable;
- give the user a mental model for **divergence** (the source changed under a pending edit).

`collection-write.md` specified an immediate-ish model: select rows → bulk-action bar →
confirm modal → write → 8-second undo toast → audit log, with per-action reversibility. That
works, but it has no staging/review step, undo is a source-reverse every time (scary for
irreversible actions), and partial work isn't represented anywhere it can't be lost.

Prototyping found that a **version-control mental model** maps onto this problem almost 1:1 and
resolves all four needs at once.

## Decision

Model writes as version control.

- **Working set.** Issues are tracked "files." An edit (approve a suggestion, retitle,
  reassign, link, close, merge) is a **pending change** in a working set, not an immediate
  write. The unit is the **issue**, expandable to a field-level before/after diff.
- **Source-control surface.** A git icon in the footer toggles a **source-control sidebar**
  (VS Code style — it replaces the nav rows) showing Unstaged / Staged / Committed sections,
  with stage / unstage / discard and diffs.
- **Lifecycle: stage → commit → push.** Stage selects changes; **Commit** groups staged
  changes into a local checkpoint; **Push** writes the committed set to the source. **Push is
  the write-to-source boundary** — the one place confirmation and per-action reversibility
  apply. Pre-push, undo is just discard / unstage (free, always safe).
- **Autostage** is a user **setting** (new changes land staged vs unstaged for review).
- **Outward actions** (post a comment / ping for context) **stage uniformly** for now; an
  immediate / per-action escape is deferred (see Consequences).
- **Audit log** (ADR-005 / collection-history) records each pushed change; the commit history
  and the audit log are the same idea.

The bulk-action bar from `collection-write.md` is no longer the primary write surface. It may
remain as one affordance for "push the staged/selected set," but selection-and-confirm is
replaced by the staged working set as the default model.

## Consequences

**Positive:**
- Nothing is lost: every edit is a visible, durable tracked change; uncommitted work is
  obvious, not hidden behind a transient toast.
- Real review before the source is touched — a diff of exactly what will be written.
- Irreversible risk is concentrated at one explicit **push** moment, instead of scattered
  across every action; pre-push undo is free.
- "Divergence" has ready-made language (conflicts) for the source-changed-under-a-pending-edit
  case (the gardener's stale-suggestion invalidation, applied to writes).
- One coherent model across single and batch edits.

**Negative:**
- More machinery than a button: a working-set store (persisted), a source-control surface, and
  eventually conflict resolution. Implies a new **source-control sidebar** design-system piece
  + a footer git affordance.
- commit-vs-push is arguably ceremony for a single local user; this ADR keeps both, but it is a
  candidate to collapse later.
- Staging an outward action (a public comment sitting unpushed) is conceptually odd; deferred
  rather than resolved.

## Alternatives considered

### Option 1: Immediate / bulk-bar writes (current `collection-write.md`)

Select rows, confirm, write now, undo via toast.

**Pros:** simplest; no working-set state to persist or lose.
**Cons:** no batch review/diff before the source write; undo is a source-reverse every time
(unsafe for irreversible actions); partial work has nowhere durable to live. **Why not:** the
lost-work and review gaps are exactly what the staged model fixes.

### Option 2: A queue without the git framing

Stage edits into a generic "pending changes" queue, drain via a bar.

**Pros:** gets batching and review.
**Cons:** lacks the stage/unstage/commit/conflict vocabulary and the strong "uncommitted work
is tracked, not lost" intuition that makes the model legible. **Why not:** the git framing is
the thing that makes the queue understandable and safe.
