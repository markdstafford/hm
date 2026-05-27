# Collection — enhance (backlog hygiene)

How the collection contract from `collection-read.md` + `collection-write.md` becomes the backlog-hygiene workbench. This doc covers the hygiene-suggestion entity end-to-end: what it shows, how it groups and sorts, the three detail flavors per suggestion category, the five action verbs, reversibility per action, and the user-visible behavior of the batch-approval flow.

Read `collection-read.md` and `collection-write.md` first. This doc relies on the patterns they specify and only describes hygiene's particulars.

## The hygiene-suggestion entity

A **hygiene suggestion** is a candidate mutation produced by one of the triage engines (duplicate detection, stale identification, ticket enrichment). Each suggestion proposes a specific action against a specific source-system issue, with a confidence score the user judges against.

### What a row shows

The hygiene suggestion exposes these properties; each renders as a cell in the row layout:

| Property | Cell renders | Notes |
| --- | --- | --- |
| `action` | An icon for the action verb (close, merge, reassign, enrich, ping) + the verb's display label. | Categorical. Groupable. |
| `key` | The target issue's key in monospace. | Free-form. Becomes `KEY → KEY` for duplicate merges to show both issues. |
| `title` | The target issue's title. | Free-form. The stretch property (default). |
| `confidence` | The `ConfidenceChip` primitive showing `N%`, accented when ≥ 85%. | Continuous. Groupable via smart buckets. |
| `category` | A `Badge` colored per category (`Duplicate` / `Stale` / `Enrichment`). | Categorical. Groupable. |
| `status` | The target issue's current status from the source system. | Categorical. Groupable. |
| `assignee` | The target issue's current assignee, or `Unassigned`. | Categorical. Groupable. |
| `rationale` | A short one-line explanation of why the engine produced this suggestion. | Free-form. Not in the row by default; visible in the detail. |

### Default property layout

The default property list (in order, with side):

```
action(L) → key(L) → title(L) → assignee(R) → status(R) → category(R) → confidence(R)
```

Which gives the default row layout:

```
[ ☐  ✓ Close as resolved   AMP-1043   Worker pool exits on empty queue  …  Priya Naidu  Open  Stale  92% ]
   ─────── left (action, key, title) ───────[stretch]──── right (assignee, status, category, confidence) ────
```

`rationale` is omitted from the default row. The user can show it via the view-settings menu.

### Default views

Hygiene ships three named views on first launch:

| View | Sort | Group | What it shows |
| --- | --- | --- | --- |
| **All** | Confidence desc | None | Every pending suggestion across all three engines, highest confidence first. |
| **By action** | Confidence desc | Action | Pending suggestions grouped by action verb. |
| **High confidence** | Confidence desc | None | (Future) Filtered to `confidence ≥ 85%` once filter ships. v1 ships this with a hint and no filter applied. |

The user creates additional views via the `+ new view` chip.

### Groupable properties

Hygiene supports grouping by:

- `action` — categorical. Bucket order: `Close as resolved`, `Merge as duplicate`, `Reassign`, `Ping for context`, `Enrich title + body`.
- `category` — categorical. Bucket order: `Duplicate`, `Stale`, `Enrichment`.
- `confidence` — continuous. Smart bucket: `High` (≥ 85%), `Medium` (60–84%), `Low` (< 60%). Bucket order: `High`, `Medium`, `Low`.
- `status` — categorical. Bucket order: from the source system's workflow categories.
- `assignee` — categorical. Bucket order: alphabetical, with `Unassigned` last.

### Sortable properties

Same five plus `key` and `title`. The default sort is `confidence desc` with `key` as the tie-breaker.

### Filterable properties

When filter ships, every property above is filterable using the standard operator set per property kind specified in `collection-read.md`. Hygiene-specific notes:

- Filtering by `category` is how the user constrains a view to a single triage engine.
- Filtering by `confidence ≥ N%` is how the user surfaces the high-confidence subset.

## Detail content

When a row is selected, the detail surface renders one of three layouts based on the suggestion's category. Each layout uses the same header shape:

```
┌────────────────────────────────────────────────────────────────┐
│  [category badge] → [action verb]                              │
│  KEY · Issue title                                             │
│                                            [confidence]  [✕]   │
├────────────────────────────────────────────────────────────────┤
│  …category-specific body…                                      │
│                                                                │
│  ┌─ Rationale ─────────────────────────────────────────────┐   │
│  │ One-line explanation from the engine.                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

The header always carries:

- The category badge + an arrow + the action verb.
- The target issue key + title.
- The confidence chip.
- The close affordance the preview surface provides (`✕` for Side peek and Bottom peek; the nav strip handles close for Full page).

The rationale block always appears at the bottom of the body.

### Duplicate

```
┌────────────────────────────────────────────────────────────────┐
│  [Duplicate] → Merge as duplicate                              │
│  AMP-1149 · Search panel hangs when no results returned        │
│                                              [91%]    [✕]      │
├────────────────────────────────────────────────────────────────┤
│  ┌─ This issue ──────────┐  ┌─ Duplicate of ──────────┐        │
│  │ AMP-1149              │  │ AMP-1102                │        │
│  │ Search panel hangs    │  │ Search panel hangs on   │        │
│  │ when no results …     │  │ empty result set        │        │
│  │ Open · Tarek Hassan   │  │ Open · (unassigned)     │        │
│  │ updated 2026-05-19    │  │ updated 2026-05-12      │        │
│  └───────────────────────┘  └─────────────────────────┘        │
│                                                                │
│  Rationale: Title + component overlap with AMP-1102…           │
└────────────────────────────────────────────────────────────────┘
```

Two issue cards side-by-side: the target on the left, the candidate "duplicate of" on the right. Each card carries the key, title, status, assignee, and last-updated timestamp.

### Stale

```
┌────────────────────────────────────────────────────────────────┐
│  [Stale] → Close as resolved                                   │
│  AMP-1043 · Worker pool exits on empty queue on shutdown       │
│                                              [92%]    [✕]      │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐      │
│  │ AMP-1043                                             │      │
│  │ Worker pool exits on empty queue on shutdown         │      │
│  │ Open · Priya Naidu                                   │      │
│  │ updated 2026-04-12                                   │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                │
│  Last activity: 2026-04-12 (6 weeks ago)                       │
│                                                                │
│  Rationale: Linked PR #482 merged 2026-04-12; issue still …    │
└────────────────────────────────────────────────────────────────┘
```

A single issue card plus a last-activity line. The last-activity line shows the date and the relative age.

### Enrichment

```
┌────────────────────────────────────────────────────────────────┐
│  [Enrichment] → Enrich title + body                            │
│  AMP-1180 · bug                                                │
│                                              [89%]    [✕]      │
├────────────────────────────────────────────────────────────────┤
│  ┌─ Original ────────────┐  ┌─ Proposed ────────────┐          │
│  │ bug                   │  │ Crash on Settings     │          │
│  │                       │  │ open when Jira source │          │
│  │ (body empty or a      │  │ has no credential     │          │
│  │  single screenshot)   │  │                       │          │
│  │                       │  │ ## Steps to reproduce │          │
│  │                       │  │ 1. Add a Jira source… │          │
│  │                       │  │                       │          │
│  │                       │  │ Labels: bug, P1       │          │
│  └───────────────────────┘  └───────────────────────┘          │
│                                                                │
│  Rationale: Body is a single screenshot link; title is…        │
└────────────────────────────────────────────────────────────────┘
```

Side-by-side: the original title and body on the left, the AI-proposed replacement on the right. The proposed side includes the title, the structured body, and any proposed labels. The visual emphasis is on the proposed side (accent-tinted background, subtle border) so the user reads it as the recommendation.

## The five actions

Hygiene exposes five distinct actions. Each declares its label, slot, confirm-modal copy, toast copy, and reversibility per the contract in `collection-write.md`.

| Action id | Display label | Reversibility | Reverse effect |
| --- | --- | --- | --- |
| `close-as-resolved` | Close as resolved | Reversible when the source system allows the inverse transition. The reverse handler transitions the issue back to its prior status. | Re-open to prior status. |
| `merge-as-duplicate` | Merge as duplicate | Reversible. Multi-step: unlink the duplicate relationship, then re-open the merged issue if it was auto-closed. | Restore the issue + remove the link. |
| `reassign` | Reassign | Reversible. Restore the previous assignee. | Reassign back. |
| `enrich-title-and-body` | Enrich title + body | Reversible. Restore the previous title, body, and labels. | Restore prior text + labels. |
| `ping-for-context` | Ping for context | **Not reversible.** Posting a comment in the source system creates an event others may have reacted to; programmatically deleting the comment leaves a `[deleted]` marker and breaks any reply thread. | (none) |

Reversibility is declared per action at registration; the confirm modal, undo toast, and history view all read this declaration.

### Confirm-modal copy

The shell renders the modal; hygiene supplies the copy. For each action:

- **Close as resolved (batch)**: title `Close N issues as resolved?`. Body: `This will transition N issues to a resolved status in Jira and record the changes in the audit log. Reversible if Jira's workflow allows the inverse transition.`
- **Merge as duplicate (batch)**: title `Merge N issues as duplicates?`. Body: `This will link each issue to its proposed canonical and may close the duplicates depending on Jira's workflow. Reversible from the history view.`
- **Reassign (batch)**: title `Reassign N issues?`. Body: `This will change the assignee on N issues. Reversible from the history view.`
- **Enrich title + body (batch)**: title `Apply N enrichments?`. Body: `This will replace the title, body, and labels on N issues with the AI-proposed versions. Reversible from the history view.`
- **Ping for context (batch)**: title `Post N context-request comments?`. Body: `This will post a comment on each issue asking the current owner for context. Comments are not cleanly reversible — review the selection carefully before confirming.`
- **Reject (batch)**: title `Reject N suggestions?`. Body: `This will mark N suggestions as rejected so the triage engines will not re-surface the same pair. Reversible from the history view.`

For mixed selections (one bulk action committing multiple action types — only relevant when "Approve N" includes a mix of actions), the title generalizes to `Approve N suggestions?` and the body lists the action breakdown: `4 close, 2 merge, 1 reassign`. The reversibility line states "Most are reversible from the history view" and identifies which subset is not.

### Toast copy

After each commit:

- Reversible commit: `Approved N suggestions · Written to Jira; logged.` with an `Undo` button.
- Reject commit: `Rejected N suggestions · Not re-surfaced.` with an `Undo` button.
- Non-reversible commit (ping-only or mixed): `Posted N comments · Not reversible.` with no button.

## Bulk-action bar contents

Per `collection-write.md`, the bar slots are entity-defined. Hygiene fills:

| Slot | Content | Condition |
| --- | --- | --- |
| Count | `N selected` | Always. |
| Primary | `Approve N` | When at least one row is selected. |
| Conditional primary | `Approve high-confidence M` | When the selection mixes confidence bands (some ≥ 85%, some < 85%). `M` is the high-confidence subset count. |
| Destructive | `Reject` | When at least one row is selected. |
| Clear | `✕` | When at least one row is selected. |

`Approve N` is the most common action and the only one that auto-routes by the suggestion's intrinsic action verb. Approving a duplicate suggestion runs `merge-as-duplicate`; approving a stale suggestion runs whichever action that stale suggestion proposes (`close-as-resolved` / `reassign` / `ping-for-context`); approving an enrichment runs `enrich-title-and-body`. The user does not pick the action per row — the engine already picked it; the user is approving or rejecting the engine's choice.

`Approve high-confidence M` is the fast-path affordance from the narrative: the user does a quick eye-pass over the selection, ticks confidence ≥ 85% items they trust, and clicks once. The selection re-filters to the high-confidence subset and the same auto-routed apply runs.

## The unified surface

The hygiene page is one collection viewer bound to the hygiene-suggestion entity. There is no separate "duplicate" / "stale" / "enrichment" page; the three engines feed the same list. Users disambiguate via the `category` group (or filter, when filter ships).

The page mounts a sidebar nav item labeled `Backlog hygiene`. The viewer behaves identically to any other collection viewer except for the entity-defined bits above.

### First-run experience

On first launch with no suggestions yet, the body renders an empty state:

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                                                                │
│                                                                │
│                       No suggestions yet                       │
│                                                                │
│     The triage engines have not produced any suggestions       │
│     for this project. Suggestions appear here as the engines   │
│     run.                                                       │
│                                                                │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

The view chips and view-settings menu render normally; only the body is empty.

### Loading state

While the suggestion store loads (or while engines are running for the first time), the body shows a loading state with the same chrome:

```
┌────────────────────────────────────────────────────────────────┐
│  [ All ] [ By action ] [ + ]                          [ ⚙ ]    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│                          Loading…                              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Partial-failure state

When one engine fails but others succeed, the body shows the available suggestions plus a banner at the top:

```
┌────────────────────────────────────────────────────────────────┐
│  ⚠ The duplicate-detection engine is unavailable.              │
│     Showing 16 of (estimated) 23 suggestions.       [ Retry ]  │
├────────────────────────────────────────────────────────────────┤
│  [ rows … ]                                                    │
└────────────────────────────────────────────────────────────────┘
```

The banner is non-blocking; the user can act on the rows that did load. Retry re-runs the failing engine.

## Cross-references

- `collection-read.md` — the display contract this entity slots into.
- `collection-write.md` — the action contract this entity's five actions implement.
- `collection-history.md` — the audit log entries each hygiene action writes.
- `context-human/specs/app.md` — Narratives → Backlog grooming, the canonical user story.
