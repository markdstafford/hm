# Collection — write

The write-side UX contract for any `hm` collection: how the user selects rows, runs actions in batch, confirms destructive operations, sees results, and reverses them. This doc covers the surfaces and interactions that flow from "I want to do something to these rows" to "the change is committed and reversible." Mutation routing to source systems and the audit-log storage shape are referenced here but specified in their own places.

This is the layer that turns a read-only collection into a workbench. Every entity that supports actions plugs into the same surfaces; entity-specific action definitions live in `collection-enhance.md` (hygiene suggestion) and `collection-history.md` (audit-log entry).

## Selection

Each row in the collection carries a checkbox at its leftmost position. Selection is independent of detail focus: ticking the checkbox does not open the detail surface; clicking the row body opens the detail without affecting the checkbox.

The user multi-selects by ticking checkboxes. The system tracks an ordered set of selected row ids per collection. Selection survives:

- View switches via chips.
- Sort, group, and filter changes within the same view.
- Preview surface changes (Side peek ↔ Bottom peek ↔ Full page).

Selection does **not** survive:

- Entity switches via sidebar navigation (each entity has its own selection set).
- Closing the collection page and returning to it.

### Selecting a single row

Ticking one checkbox selects one row. The bulk-action bar appears once at least one row is selected.

### Selecting many rows

The user ticks multiple checkboxes. The system supports two acceleration affordances as future polish — they are not in the v1 baseline but worth listing here so the contract anticipates them:

- **Shift-click range select**: shift-clicking a checkbox selects every row between the last-ticked checkbox and the shift-clicked one, honoring display order.
- **Select all in this group**: a checkbox in each group header that toggles every row inside.

Neither ships in v1. v1 ships with individual toggle only.

### Clearing selection

Three ways to clear:

- The `✕` button on the bulk-action bar.
- Switching entities (selection is per-entity and resets on entity switch).
- Approving or rejecting the current selection (the selected items are consumed; the bar dismisses).

## Bulk-action bar

The bar floats at the bottom-center of the content area, just above the shell footer. It appears when the selection has at least one row and dismisses when the selection clears.

```
                  ┌─────────────────────────────────────────────────┐
                  │  4 selected   [ Approve 4 ]  [ Approve high 2 ]  │
                  │                          [ Reject ]  [ ✕ ]      │
                  └─────────────────────────────────────────────────┘
```

The bar is positioned absolutely (`fixed; bottom: <footer + gap>; left: 50%; transform: translateX(-50%)`). It does not push or reflow the content beneath it. Its width fits the contents; it never spans the full width.

The bar's contents are entity-defined. The shell offers four slot kinds the entity fills:

| Slot | Purpose | Style |
| --- | --- | --- |
| Count | A label showing how many rows are selected. | `N selected`, plain text. |
| Primary | The most likely action on the selection. | Primary button. |
| Conditional primary | A second primary that appears only when the selection meets a condition (e.g. the selection mixes high- and low-confidence items). | Secondary button. |
| Destructive | The destructive complement to the primary (Reject, Delete, etc.). | Ghost button labeled in destructive color, or destructive variant. |
| Clear | Cancels the selection. | Icon button with `✕`. |

An entity declares which slots it uses. The shell only renders the slots the entity fills.

### Entity-defined affordances

For the **hygiene suggestion** entity (specified in `collection-enhance.md`):

- Count: `N selected`
- Primary: `Approve N`
- Conditional primary: `Approve high-confidence M` (only when the selection mixes high- and low-confidence items)
- Destructive: `Reject`
- Clear: `✕`

Future entities (Jira issue with inline quick-edit, GitHub issue, audit-log entry) declare their own slot contents.

## Confirm modal

Every bulk action — including reversible ones — confirms before committing. The confirm modal is a single `AlertDialog` styled per the design system. It blocks until the user confirms or cancels.

```
┌─────────────────────────────────────────────────────────┐
│  Approve 4 suggestions?                                 │
│                                                         │
│  This will write 4 changes to Jira and record them in   │
│  the audit log. Reversible from the history view.       │
│                                                         │
│                              [ Cancel ]  [ Approve ]    │
└─────────────────────────────────────────────────────────┘
```

The modal has four parts:

- **Title** — the action with the count. Verb-first.
- **Body** — a one- or two-line description of what will happen. Mentions the audit log when relevant. Mentions reversibility when relevant.
- **Cancel button** — left of the primary button. Ghost variant.
- **Primary or destructive button** — right of cancel. The variant matches the action kind: primary for approval-style actions, destructive (red) for reject- or delete-style actions.

When a single action has both a fully-reversible and a non-reversible variant — for example, rejecting a duplicate-suggestion (reversible) vs. permanently dismissing a stale issue (non-reversible) — the body text declares which case applies, and the modal style reflects the destructive variant when reversal is not possible.

### Confirm-modal copy variants

The shell handles the modal structure; the entity supplies the copy. Per-action copy lives with the entity's action definition. Examples for the hygiene suggestion entity are in `collection-enhance.md`.

## Undo toast

Once the confirm modal closes and the action commits, the system shows a toast in the bottom-right of the window. The toast carries:

- A one-line summary of what happened.
- An `Undo` button.
- An auto-dismiss timer (8 seconds).

```
                                          ┌──────────────────────────────────┐
                                          │  Approved 4 suggestions          │
                                          │  Written to Jira; logged.        │
                                          │                          [ Undo ]│
                                          └──────────────────────────────────┘
```

Pressing `Undo` within the 8-second window calls the action's reverse handler (see "Reversibility" below) and dismisses the toast. After 8 seconds, the toast fades and undo is no longer one-click — the user must use the history view (`collection-history.md`) to reverse.

If a second action commits while a previous toast is still showing, the previous toast dismisses immediately and a new toast appears for the latest action. The action that was dismissed is still reversible via the history view.

If an action is **not reversible** (see below), the toast omits the `Undo` button and shows a non-action notice in its place.

## Action contract

Every action an entity exposes is registered with the system before the entity's collection view mounts. The contract has these parts:

- **Id** — a stable string. The audit log records this id with every entry.
- **Display label** — the verb the user sees on the button and in the confirm-modal title.
- **Confirm-modal copy** — the description shown in the body of the confirm modal. May reference the selection count.
- **Toast copy** — the one-line summary and the description shown in the post-action toast.
- **Apply handler** — the function that performs the action against the source system (typically a Tauri command call). Returns the action's effect description, which the audit log records.
- **Reversibility** — see below.
- **Slot** — which bulk-action-bar slot the action lives in (primary, conditional primary, destructive). The entity may also expose actions outside the bar (e.g. an action triggered from the detail surface); those skip the bar but follow the same contract.

## Reversibility

Reversibility is a property of each action, declared at registration time.

An action is **reversible** when it can be undone from the audit-log entry alone — the system has enough captured state to put the source system back to where it was. Reversible actions ship with a **reverse handler** alongside their apply handler.

An action is **non-reversible** when it cannot be reliably undone. Examples: posting a comment in a source system that other people may have replied to; performing a workflow transition that the source system's workflow does not allow returning from.

Reversibility surfaces in three places:

1. **The confirm modal body** mentions reversibility when the action is reversible, and warns when it is not. Non-reversible actions can also force the destructive button variant for extra friction.
2. **The undo toast** shows an `Undo` button only when the action is reversible. Non-reversible commits get a toast without the button.
3. **The history view** (specified in `collection-history.md`) shows the undo affordance per entry; non-reversible entries render the affordance disabled.

Reversibility is a per-action declaration, not a per-entry decision. An action is reversible or not for its entire lifetime. When real-world conditions make a reversible action effectively non-reversible (e.g. the source system has moved on), the reverse handler returns an error that the user sees via the history view.

## Audit log

Every mutation an action commits — single or batch — writes to a local audit log. The audit log is the substrate that enables undo, the history view, and the user's own retrospective ("what did I change yesterday?").

The audit log captures, per entry:

- The action id and a human-readable label.
- The id of the entity instance the action targeted (e.g. the Jira issue key, the suggestion id).
- Enough state to reverse the action when the action is reversible. The exact shape is per-action; the entity decides.
- A batch id grouping every entry that committed together (one click on `Approve N` produces N entries with the same batch id).
- A timestamp.
- The source feature that initiated the action (`hygiene-batch`, `inline-quick-edit`, `manual`, …).
- Reversal status: whether the entry has been reversed, and if so by which subsequent entry.

The audit log is visible to the user via the history view (`collection-history.md`). It is local to the user's machine. No remote logging.

### Batch grouping

Every action committed as a batch shares one batch id. The history view uses the batch id to render group-by-batch sections and to expose a per-batch `Undo batch` affordance (specified in `collection-history.md`).

A single-action commit (e.g. a Jira inline quick-edit on one row) creates an entry with a unique batch id that contains only itself.

## Out of scope

The write side ships in v1 with the surfaces and patterns above. These features are not in scope:

- **Shift-click range select** and **select-all-in-group** checkboxes — future polish.
- **Inline quick-edit** of source-system fields (status, assignee, labels) from the row itself — future polish on individual entity surfaces.
- **Multi-step actions with intermediate confirmation** (e.g. an action that needs the user to pick a target before committing). v1 supports actions that commit on a single confirm.
- **Background queueing or rate-limiting** of bulk actions against slow source systems. v1 commits actions synchronously; the user sees the toast after every action in the batch returns.
- **Per-user audit-log retention policies**. v1 keeps everything; future polish adds retention preferences.
- **Cross-machine audit-log sync**. The log is local-only.

## Cross-references

- `collection-read.md` — display, configuration, named views. The read side of the collection.
- `collection-enhance.md` — the action set, reversibility, and confirm-modal copy for the hygiene suggestion entity.
- `collection-history.md` — the audit-log entry as a first-class entity, viewable via the history page.
- `context-agent/design-system.md` — `AlertDialog`, `Toast`, `Button` variants this layer composes.
