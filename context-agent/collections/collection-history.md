# Collection — history

The history view: how the user reviews and reverses past mutations beyond the 8-second toast window. This doc covers the audit-log-entry as a first-class entity slotted into the collection contract, plus the per-entry and per-batch Undo affordances that distinguish history from any other collection.

Read `collection-read.md`, `collection-write.md`, and `collection-enhance.md` first. The history view reuses the same chrome as any other collection viewer; only the entity, the actions, and a handful of group-aware affordances differ.

## What the history view is

A sidebar nav item labeled `History` (or `Activity`) opens a collection viewer bound to the audit-log-entry entity. Every mutation written by any action — hygiene batch approvals, inline quick-edits, manual changes — surfaces here as one entry per affected target.

The user opens history for two reasons:

- **Recovery.** Undo an action whose toast has already dismissed.
- **Retrospect.** See what changed yesterday, what was approved together, who reassigned what.

Both are served by the same surface: a list of audit-log entries with the standard collection affordances (named views, view-settings menu, preview surfaces) plus history-specific Undo controls.

## The audit-log-entry entity

Each entry corresponds to one mutation against one target in the source system. A batch action produces many entries sharing one batch id; a single action produces a single entry with a batch id of one.

### What a row shows

| Property | Cell renders | Notes |
| --- | --- | --- |
| `action` | An icon + the action's display label (`Closed as resolved`, `Reassigned`, …). | Categorical. Groupable. |
| `target` | The target issue's key in monospace + a truncated title. | Free-form. The stretch property (default). |
| `source_feature` | A `Badge` indicating which feature initiated the action (`Hygiene batch`, `Inline edit`, `Manual`). | Categorical. Groupable. |
| `batch_id` | Hidden by default; surfaced via group-by-batch. | Free-form. Groupable. |
| `reversible` | A `Badge` (`Reversible` or `Final`). | Categorical. Groupable. |
| `reverted` | A `Badge` (`Reverted` or none). | Categorical. Groupable. |
| `created_at` | A relative time string (`6 min ago`, `Yesterday 14:32`). | Continuous. Groupable via smart buckets. |
| `actor` | Always the local user in single-user mode; shown for future multi-user. | Categorical. |

### Default property layout

```
action(L) → target(L) → reverted(R) → reversible(R) → source_feature(R) → created_at(R)
```

`batch_id` is hidden by default; the user surfaces it via group-by-batch (see below).

### Default views

The history viewer ships with four named views:

| View | Sort | Group | What it shows |
| --- | --- | --- | --- |
| **All** | `created_at` desc | None | Every entry, newest first. |
| **By date** | `created_at` desc | `created_at` (smart buckets: `Today`, `Yesterday`, `This week`, `Earlier`) | Time-bucketed feed. |
| **By batch** | `created_at` desc | `batch_id` | Group rendered per batch so the user can undo or audit a whole batch at once. |
| **Reversible only** | `created_at` desc | None | Quick access to entries that can be undone. v1 implements this as a group filter on `reversible = true`; once filter ships proper, it becomes a real filter view. |

### Smart bucket for `created_at`

When grouping by `created_at`, the buckets are:

- `Today`
- `Yesterday`
- `Earlier this week`
- `Earlier this month`
- `Older`

Each bucket carries a count in the section header, matching the standard pattern.

## Per-entry Undo

Every row carries an Undo affordance on its right side. The affordance is one of three states:

- **Enabled** — the entry is `reversible` and `reverted` is false. The button renders as a small icon button (`↶`) or text button (`Undo`) per the row density.
- **Disabled (final)** — the entry is not reversible. The button renders dimmed with a tooltip explaining why (e.g. "Comment posts can't be cleanly undone").
- **Disabled (already reverted)** — the entry has been reverted by a later entry. The row also carries a `Reverted` badge. Clicking the badge or hovering the disabled button reveals which entry reverted this one and offers a link to jump to it.

Pressing an enabled Undo button confirms via the same `AlertDialog` pattern from `collection-write.md`:

```
┌─────────────────────────────────────────────────────────┐
│  Undo this change?                                      │
│                                                         │
│  This will reverse: Closed AMP-1043 as resolved.        │
│  Re-opens the issue to its previous status.             │
│                                                         │
│                              [ Cancel ]  [ Undo ]       │
└─────────────────────────────────────────────────────────┘
```

The confirm modal cites the specific change and what reversing it will do. On confirm, the reverse handler runs and the system writes a new audit-log entry that records the reversal. The original entry updates its `reverted` flag and links to the reversal entry; both stay in the log.

If the reverse handler fails (e.g. the source system has moved on and the inverse transition is no longer allowed), the system shows an error toast naming the failure and leaves the original entry untouched.

## Per-batch Undo

When the user groups by `batch_id`, each batch's section header carries a batch-level Undo affordance:

```
┌──────────────────────────────────────────────────────────────────────┐
│  ▼ BATCH 2026-05-25 14:32 · 6 entries · Hygiene batch    [ Undo all ]│
├──────────────────────────────────────────────────────────────────────┤
│  ↶  Closed as resolved   AMP-1043   …                                │
│  ↶  Closed as resolved   AMP-1018   …                                │
│  ↶  Closed as resolved   AMP-987    …                                │
│  ↶  Merged as duplicate  AMP-1149 → AMP-1102   …                     │
│  ↶  Merged as duplicate  AMP-1163 → AMP-1140   …                     │
│  ↶  Reassigned           AMP-1052   …                                │
└──────────────────────────────────────────────────────────────────────┘
```

`Undo all` reverses every entry in the batch in reverse chronological order (last-applied first, so dependencies unwind cleanly). The confirm modal lists the entries:

```
┌─────────────────────────────────────────────────────────┐
│  Undo this batch?                                       │
│                                                         │
│  This will reverse 6 changes from the Hygiene batch at  │
│  14:32 on 2026-05-25. 5 entries are reversible; 1 is    │
│  non-reversible and will be skipped.                    │
│                                                         │
│  Reversible changes:                                    │
│  • Closed AMP-1043, AMP-1018, AMP-987                   │
│  • Merged AMP-1149 → AMP-1102                           │
│  • Merged AMP-1163 → AMP-1140                           │
│  • Reassigned AMP-1052                                  │
│                                                         │
│  Skipped (non-reversible):                              │
│  • Posted comment on AMP-844                            │
│                                                         │
│                              [ Cancel ]  [ Undo batch ] │
└─────────────────────────────────────────────────────────┘
```

The user sees exactly what will reverse and what will not before confirming. The system writes one reversal entry per reversed action — the batch undo is itself a batch in the audit log (every reversal entry shares a new batch id).

Partial failure during a batch undo is non-fatal: each entry's reverse runs independently, and the user sees a summary toast at the end (`Reversed 4 of 5 changes; 1 failed`). Failed entries stay un-reverted; the user can retry from history.

## Standard collection affordances

Beyond the Undo specifics, the history view behaves like any other collection viewer:

- View chips at the top with the four default named views plus `+`. The user creates their own (`Last hour`, `Just enrichments`, …) once filter ships.
- View-settings menu with the standard sub-panels.
- Property visibility, sort (multi-level), group (single-level + smart buckets).
- Preview surfaces (Side peek / Bottom peek / Full page) showing the full audit-log-entry detail.

### History detail

Selecting a row opens the entry detail in the active preview surface:

```
┌────────────────────────────────────────────────────────────────┐
│  [Hygiene batch] → Closed as resolved                          │
│  AMP-1043 · Worker pool exits on empty queue on shutdown       │
│                                              [Reversible] [✕]  │
├────────────────────────────────────────────────────────────────┤
│  When            2026-05-25 14:32 (6 min ago)                  │
│  Batch           6 entries · [open in By batch view]           │
│  Source feature  Hygiene batch                                 │
│  Status          Active                                        │
│                                                                │
│  ┌─ Change ─────────────────────────────────────────────┐      │
│  │ Before:  Status = Open                               │      │
│  │ After:   Status = Done                               │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                │
│                                                       [ Undo ] │
└────────────────────────────────────────────────────────────────┘
```

The detail shows when, what batch, which source feature, current status, and a before/after diff of the affected fields. The Undo button is a copy of the row's Undo affordance — same confirm flow.

### Empty state

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                       No history yet                           │
│                                                                │
│         Changes you make from hm appear here. The audit        │
│         log records the before / after of every change and     │
│         supports undo for reversible actions.                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

Before the user has run a single mutation, the history is empty. The empty state explains what will populate it.

## Out of scope

- **Cross-machine history sync.** History is local-only.
- **Retention policies.** v1 keeps everything; the user prunes manually if at all.
- **History export.** No "export to CSV" or similar in v1.
- **Comment / annotation on entries.** The user cannot annotate a past entry to explain why they approved it.
- **Re-do** (the inverse of Undo, re-applying a reversed change). Possible in principle but not in scope; the user re-applies via the source feature if needed.

## Cross-references

- `collection-read.md` — display, configuration, named views.
- `collection-write.md` — the action and audit-log contracts this view consumes.
- `collection-enhance.md` — the hygiene-suggestion entity whose actions populate most of the early history.
