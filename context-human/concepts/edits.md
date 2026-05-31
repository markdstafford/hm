# Edits (write = git)

How `hm` mutates the source system, modelled as version control. Every write — approving a
suggestion, retitling, reassigning, closing, merging, creating or deleting a link, posting a
comment — is a **tracked change in a working set**, which the user reviews and then pushes to the
source. ADR-011 records *why* this model (and what it supersedes); this doc is the **contract** —
the change model, the source-control surface, the lifecycle, and the per-action behavior. The
previews that originate edits are `concepts/preview.md`; the connection edits are
`concepts/connections.md`; the audit log this feeds is ADR-005 / `collection-history.md`.

## The model in one line

Issues are tracked files; an edit is a pending change; you **stage → commit → push**, and **push**
is the only step that touches the source. Until you push, every edit is visible and reversible for
free; the irreversible risk is concentrated at one explicit moment.

## The working set

- **Tracked items.** Every ingested item is a tracked "file." Editing it produces a **pending
  change** rather than an immediate write.
- **Change unit = the issue.** One entry per changed item, aggregating its edits, **expandable to a
  field-level diff** (before → after per changed field). One issue with a retitle + a label change
  is one entry with two diffs — like a file with two hunks. (Per-individual-change entries were
  considered and rejected as noisier.)
- **Change state.** A change is `unstaged`, `staged`, or `committed` (committed-but-unpushed).
- **Durability.** The working set persists — it is the answer to "uncommitted work must never be
  lost." It survives reload; partial work is always represented somewhere the user can see it.

## The source-control surface

A **git affordance in the footer** (with a pending-change count) toggles a **source-control
sidebar**, VS Code style — opening it **replaces the navigation rows** in the sidebar:

```
SOURCE CONTROL (3)                      footer ⎇ 3  ← always-visible count
─ Unstaged ───────────────────────
  ▸ AMP-38   Enrich title + body    + ✕
─ Staged ─────────────────────────
  ▸ AMP-1039 Merge as duplicate     − ✕
─ Committed · unpushed ───────────
  ▸ AMP-1014 Close as resolved        ✕
[ Commit 1 staged ]  [ Push 1 committed ]
```

- Sections for **Unstaged / Staged / Committed·unpushed**; each change can **stage / unstage /
  discard**, and **expand to its field diff**.
- The footer count is the **always-visible face** of the working set — the lost-work defense. A user
  can never forget they have uncommitted changes.
- This replaces `collection-write.md`'s bulk-action bar as the *primary* write surface. The bar may
  survive as one affordance for "push the staged/selected set," but selection-and-confirm is no
  longer the default model (see ADR-011).

## Lifecycle: stage → commit → push

1. **Stage / unstage** — move a change in or out of the set you intend to push. (Whether a new
   change *starts* staged is the **Autostage** setting, below.)
2. **Commit** — group the staged changes into a local checkpoint. The commit is the **audit-log
   entry** (ADR-005 / `collection-history.md`): a durable, local record of intent, made before
   anything reaches the source.
3. **Push** — write the committed changes to the source system. **Push is the source-write
   boundary.** It is the one place confirmation and per-action reversibility warnings live.

Discard removes a pending change. Pre-push **undo is free** — discard or unstage; nothing has left
`hm`. There is no transient "undo toast" race, because the dangerous step is the explicit push, not
each action.

> Single-user note: keeping commit and push as distinct steps is a deliberate choice for the local
> checkpoint/review it buys; ADR-011 flags it as a candidate to collapse if it proves to be ceremony.

## Settings

- **Autostage** *(setting)* — whether a newly made change lands **staged** (ready to push) or
  **unstaged** (held for review). It is the one user-facing knob on the model. (The commit model
  itself — that there *is* a commit step — is not a setting; it's the decided lifecycle.)

## Per-action behavior

- **Edits** (retitle, reassign, enrich, close, merge, create/delete link) always **stage** as
  tracked changes.
- **Outward actions** (post a comment, ping for context) **stage uniformly, for now** — they enter
  the working set like any edit. This is the simple, consistent default. The tension it carries — a
  public comment sitting unpushed is conceptually odd, and some outward actions arguably want to
  fire immediately — is **acknowledged and deferred**, not resolved (see Open).
- **Reject** a suggestion is **not** a source write — it's local-truth suppression
  (`collection-gardener.md`); it doesn't enter the working set.

## Reversibility

The git model reframes reversibility:

- **Before push** — undo is **discard / unstage**, free and always safe, because the change never
  left `hm`.
- **At push** — confirmation applies, and per-action reversibility is surfaced here: some actions
  are cleanly reversible from the audit log (transition back, restore prior assignee/title), some
  are **not** (a posted comment others may have replied to). The non-reversible ones get explicit
  push-time warning.
- **After push** — undo falls back to the source-reverse the audit entry records, which may fail if
  the source has moved on; that's surfaced via the history view (`collection-history.md`).

Concentrating irreversibility at push (instead of after each action) is the main safety win.

## Divergence (conflicts)

While changes sit in the working set, the source can change underneath them (a re-sync, or someone
editing in Jira). A staged change may then conflict or be moot — the same invalidation problem the
gardener handles for stale suggestions (`collection-gardener.md`), now applied to pending writes.
Detecting and resolving this **at push** (git's merge-conflict moment) is **deferred** but named
here as a first-class concern the model must eventually address.

## Out of scope (deferred)

- **Immediate / per-action escape** for outward actions (let a comment fire now instead of staging).
- **Conflict resolution UI** at push.
- **Optimistic display** of staged edits in the preview (pending badges showing the post-push state).
- **Commit messages / rearranging local history** before push.
- **Collapsing commit + push** into one step for a single user (ADR-011 candidate).

## Cross-references

- ADR-011 — the decision and rationale for the staged ("write = git") model; alternatives weighed.
- ADR-005 / `collection-history.md` — the audit log a commit writes; the history/undo view.
- `collection-write.md` — the prior bulk-action-bar write layer this supersedes as primary.
- `concepts/preview.md` — the suggestion action frame (approve/reject/comment) that originates edits.
- `concepts/connections.md` — create/delete-link edits and suppression.
- `context-agent/design-system.md` — the source-control sidebar primitive + footer git affordance.
