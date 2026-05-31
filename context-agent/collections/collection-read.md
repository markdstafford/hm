# Collection — read

The read-side UX contract for any `hm` collection: a configurable list of one entity type, organized through a Notion-style view-settings menu, with named views the user can save, switch, and delete. This doc covers display, configuration, and navigation. Mutations are covered in `collection-write.md`. Domain-specific behavior (hygiene-suggestion entity, audit-log-entry entity, etc.) lives in `collection-enhance.md` and `collection-history.md`.

A collection holds one entity type at a time. Mixed-entity collections (e.g. Jira + GitHub issues side-by-side in one list) are deferred — when they land, they extend rather than break the contract here.

## Page layout

The collection viewer mounts in the app shell's main pane. Two rows above the body:

```
┌──────────────────────────────────────────────────────────────────────┐
│ [ All ] [ Mine ] [ Recently updated ] [ + ]            [ ⚙ settings ]│  view chips row (32px)
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─ row 1 ─────────────────────────────────────────────────────┐    │
│  │ ☐  left properties …          right properties …             │    │
│  └──────────────────────────────────────────────────────────────┘    │
│  ┌─ row 2 ─────────────────────────────────────────────────────┐    │  body (flex-1)
│  │ ☐  left properties …          right properties …             │    │
│  └──────────────────────────────────────────────────────────────┘    │
│  …                                                                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

The view chips row and the settings-icon are on **one vertical row**: chips stack left, settings icon anchors right. Both elements vertically center within the row.

The body renders rows for the active view. The active view drives every read-side decision: sort, group, property visibility, density, preview surface.

## Named views

A **named view** is a saved bundle of every read-side setting (sort, group, property visibility, layout, filter) plus a display name. The user keeps as many as they want; switching views never changes the data, only how it's presented.

### View chips

Each named view renders as a chip in the row above the body. The active chip uses the primary accent; inactive chips use surface. Order in the chip strip follows the user's manual order (drag to reorder is a future polish; v1 ships with creation order).

After the last chip, a trailing `+` chip creates a new named view. Clicking `+`:

1. Clones the currently active view's settings as the starting point.
2. Names the new view `Untitled view` (or `Untitled view 2`, etc. on collision).
3. Activates the new view immediately.
4. Focuses the rename textbox inside the view-settings menu so the user can name it without an extra click.

### Right-click menu on a chip

Right-clicking any chip opens a context menu:

```
┌─────────────────────────┐
│  Rename                 │
│  Duplicate              │
│  Delete                 │
└─────────────────────────┘
```

- **Rename** focuses the rename textbox in the view-settings menu (opening the menu if it's not already open).
- **Duplicate** creates a copy with `(copy)` appended to the name and activates it.
- **Delete** prompts for confirmation if the view is not empty of customization. Deleting the active view falls back to the next view in the strip; if the strip would empty, the system seeds a default view to prevent an empty state.

### First-run defaults

Each entity declares a small set of default views that ship with the app. The defaults are read-only metadata: the user can rename or delete them, but the next first run won't re-seed deleted ones (the deletion is persistent).

## View settings menu

A sliders icon at the right of the chips row opens the view-settings menu. The menu is a popover; clicks outside or `Esc` dismiss it.

The menu is bound to the **active view**. Every change in the menu mutates the active view and takes effect immediately — there is no Apply or Save button. The active view's chip reflects the new state on close.

### Top sheet

```
┌─────────────────────────────────────────────┐
│  View settings                          [X] │   panel title + close
├─────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐  │
│  │ ▭ View name (textbox)                 │  │   rename
│  └───────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│  ◫  Layout              Table · Regular  ›  │
│  ◉  Property visibility       7 of 12    ›  │
│  ⇅  Sort                Updated desc     ›  │
│  ▥  Group               Status           ›  │
│  ⊜  Filter              2 active         ›  │
│  ◐  Conditional color   (Soon)              │
└─────────────────────────────────────────────┘
```

Header: the panel title (`View settings`) on the left, an `X` close button on the right.

Below the header: a single textbox showing the current view name. Editing the textbox renames the active view inline. Blur or `Enter` commits.

Below the textbox: the list of setting categories. Each row carries an icon, a label, the current value summary, and a chevron-right (or no chevron when disabled). Clicking an active row drills into its sub-panel.

Order is **Layout → Property visibility → Sort → Group → Filter → Conditional color**. Disabled rows (Conditional color in v1) render with `Soon` in place of the value and no chevron.

### Sub-panels

Every sub-panel uses the same shell:

```
┌─────────────────────────────────────────────┐
│  ←  Sort                                [X] │   back arrow + title + close
├─────────────────────────────────────────────┤
│  …sub-panel content…                        │
└─────────────────────────────────────────────┘
```

- Top-left: a back-arrow button (`←`) returns to the parent panel. The back arrow is always visible; the user never needs to remember where they are.
- Top-center / left of close: the panel title.
- Top-right: the same `X` close button. Closing from a sub-panel dismisses the entire menu (the back stack is internal-only).
- Body: the sub-panel's controls. Sub-panels can group their controls under small-caps section labels when the controls fall into clear clusters (e.g. Layout has Type tiles, then a Display group of toggles, then Open pages in).

Short option lists with descriptions or per-option iconography render as nested popovers, not inline selects. Example: "Open pages in" in the Layout sub-panel opens a popover with one row per option, each carrying an icon + the option name + a one-line description + a default indicator. Plain enums without per-option detail use a standard select control inline.

### Layout sub-panel

```
┌─────────────────────────────────────────────┐
│  ←  Layout                              [X] │
├─────────────────────────────────────────────┤
│  Type                                       │
│  ┌──────┬──────┬──────┐                     │
│  │Table │Board │ List │                     │
│  └──────┴──────┴──────┘                     │
│  ┌──────┬──────┬──────┐                     │
│  │Gallry│Time. │ Cal. │ all disabled        │
│  └──────┴──────┴──────┘                     │
│                                             │
│  Display                                    │
│  Density          [ Compact | Regular ]     │
│                                             │
│  Open pages in    Side peek (right)      ›  │  opens popover
└─────────────────────────────────────────────┘
```

- **Type**: a grid of tiles. Table is the only active tile in v1. The other tiles render disabled (visible-but-inactive) so the user understands the menu's eventual shape.
- **Density**: a two-button toggle, `Compact` or `Regular`. Density controls vertical row padding; both values keep the same horizontal padding.
- **Open pages in**: opens a nested popover listing the three preview locations.

### Open pages in (nested popover)

```
┌─────────────────────────────────────────────┐
│  ⊟  Side peek (right)                       │
│      Detail opens in a resizable right      │
│      rail, defaulting to 440px wide.        │
│      Default for Table.                     │
│                                             │
│  ⊟  Bottom peek                             │
│      Detail opens in a resizable bottom     │
│      pane, defaulting to 280px tall.        │
│                                             │
│  ⊟  Full page                          ✓    │
│      Detail takes the whole content area.   │
└─────────────────────────────────────────────┘
```

Each option carries a small icon, a name, and a one-line description. The currently selected option shows a checkmark. Picking a row commits and closes the popover.

### Property visibility sub-panel

The row layout in the body is built from a single ordered list of properties. Each property declares which side of the row it sits on — **Left** or **Right**. Within each side, properties render in their order in the list.

```
example property list (in order):  B  E  A  M  O  G  C  I
sides:                              R  L  L  R  L  R  R  L

resulting row layout:
  [ E   A   O   I   ─────────stretch─────────   B   M   G   C ]
   ──left, in list order──                      ──right, in list order──
```

The sub-panel is the only place this ordering is exposed:

```
┌─────────────────────────────────────────────┐
│  ←  Property visibility                 [X] │
├─────────────────────────────────────────────┤
│  Search                                  ⌕  │
├─────────────────────────────────────────────┤
│  Shown                                      │
│  ⋮⋮  Aa  Title                  L  R   👁    │
│  ⋮⋮  ⊙   Status                 L  R   👁    │
│  ⋮⋮  ◉   Issue key              L  R   👁    │
│  ⋮⋮  👤  Assignee               L  R   👁    │
│  ⋮⋮  ⏱   Last updated           L  R   👁    │
│  ⋮⋮  …                                       │
│                                             │
│  Hidden                                Show │
│  ⋮⋮  ⊕   Labels                 L  R   👁̸    │
│  ⋮⋮  🏷   Project key            L  R   👁̸    │
└─────────────────────────────────────────────┘
```

Each row contains, left-to-right:

- A drag handle (`⋮⋮`). Drag to reorder within the list. Reorder respects the L/R partitioning: if a Left property moves above a Right property, both keep their side; only the relative order within the side changes.
- The property's icon and label.
- An `L | R` button group selecting which side of the row the property sits on. Switching sides is an immediate change; no confirm.
- An eye / eye-off button toggling visibility.

The list is partitioned into **Shown** and **Hidden** sections (mirroring Notion's "Shown in table" / "Hidden in table"). Hidden properties dim. The user can drag a property between sections; toggling the eye does the same thing.

A search field at the top filters the list when an entity has many properties (Notion has this; we mirror).

The title property (the stretch property) is always visible. It cannot be hidden, but its side and order are configurable like any other property.

### Sort sub-panel

```
┌─────────────────────────────────────────────┐
│  ←  Sort                                [X] │
├─────────────────────────────────────────────┤
│  ⋮⋮  1.  Status            [ ↑ Asc ]   ✕    │
│  ⋮⋮  2.  Updated           [ ↓ Desc ]  ✕    │
│  ⋮⋮  3.  Priority          [ ↑ Asc ]   ✕    │
│                                             │
│  + Add sort                                 │
│                                             │
│                              Clear all sort │
└─────────────────────────────────────────────┘
```

Sort is multi-level. Levels apply in stack order (the first level is the primary sort, the second breaks ties, and so on).

Each level row contains:

- A drag handle (`⋮⋮`). Drag to reorder levels.
- A position number (`1.`, `2.`, …) for screen-reader clarity.
- A property select (opens a popover when the property list is long enough or carries per-property metadata).
- An asc / desc toggle. The icon flips between `↑ Asc` and `↓ Desc`.
- A remove `✕`.

Below the list, an `+ Add sort` button appends a level with the first non-used property. The button disables when every property is already in the list.

`Clear all sort` removes every level, returning the view to the entity's default sort.

### Group sub-panel

```
┌─────────────────────────────────────────────┐
│  ←  Group                               [X] │
├─────────────────────────────────────────────┤
│  Group by                       Status   ›  │  opens popover
│  Hide empty groups                       ⦿  │  toggle
│                                             │
│                            Remove grouping  │
└─────────────────────────────────────────────┘
```

Grouping is single-level in v1. Two-level grouping (Notion's Group + Sub-group) is a future polish.

- **Group by** opens a popover with `None` plus every groupable property. Each option carries the property's icon and label.
- **Hide empty groups**: a switch. On by default.
- **Remove grouping**: a button visible only when grouping is active. Same effect as picking `None` in the popover.

Continuous-valued properties (numbers, dates, etc.) bucket via property-defined defaults — confidence band into `High / Medium / Low`, dates into `Today / This week / This month / Older`, and similar. The buckets are visible but not user-configurable in v1; configurable buckets are a future polish (Notion supports `Number by` ranges + increments and similar for dates).

### Filter sub-panel

```
┌─────────────────────────────────────────────┐
│  ←  Filter                              [X] │
├─────────────────────────────────────────────┤
│  Status         is          [ Open, … ]  ✕  │
│  Updated        is within   Past month   ✕  │
│  Assignee       is not empty             ✕  │
│                                             │
│  + Add filter                               │
│                                             │
│                          Clear all filters  │
└─────────────────────────────────────────────┘
```

Each filter is one row: property + operator + value + remove. Filters combine with AND in v1 (Notion supports nested AND/OR filter groups up to three layers; that's a future polish).

Operator and value controls depend on the property's type:

- **Text / title**: operators `contains`, `does not contain`, `is`, `is not`, `starts with`, `ends with`, `is empty`, `is not empty`. Value is a textbox; the empty / not-empty operators hide the value.
- **Number**: operators `=`, `≠`, `>`, `<`, `≥`, `≤`, `is empty`, `is not empty`. Value is a numeric input.
- **Select / Status**: operators `contains`, `does not contain`, `is`, `is not`, `is empty`, `is not empty`. Value is a single-select popover of the property's option list, with the option's icon and color where defined.
- **Multi-select / Labels**: operators `contains`, `does not contain`, `is empty`, `is not empty`. Value is a multi-select popover. Jira labels are a v1 filterable property with kind `multi-select`; operators: `contains`, `does not contain`, `is empty`, `is not empty`.
- **Date / Updated / Created**: operators `is`, `is before`, `is after`, `is on or before`, `is on or after`, `is within`, `is empty`, `is not empty`. Value depends on the operator: `is within` opens a relative-date popover (`Today`, `Past week`, `Past month`, `Next week`, …); the others open a date picker.
- **Person / Assignee**: operators `contains`, `does not contain`, `is empty`, `is not empty`. Value is a person picker.
- **Checkbox**: operators `is`, `is not` (i.e. checked / unchecked). No value.

Adding a filter inserts a row pre-populated with the first available property + its default operator. The user adjusts before the filter takes effect.

`Clear all filters` removes every row.

## Body

The body renders rows in display order. Display order applies four passes over the source items, in this order:

1. **Filter** — every item that fails any active filter is removed from the list.
2. **Sort** — remaining items sort by the multi-level sort. Within each sort level, ties fall through to the next level. Items equal at every level fall back to the entity's default secondary sort (typically the issue key).
3. **Group** — when grouping is active, items bucket by the group property. Each bucket renders a small-caps section header with the bucket label + item count. Empty buckets are hidden when `Hide empty groups` is on. Buckets render in property-defined order: categorical properties follow their declared option order; continuous properties follow their smart-bucket order; everything else falls back alphabetical.
4. **Render** — each item renders as one row, top to bottom.

### Row rendering

```
┌──────────────────────────────────────────────────────────────────────┐
│ ☐   [icon] Left prop  [icon] Left prop   …         Right prop  Right │
│     ──────── left side ─────────────[stretch]──── right side ────────│
└──────────────────────────────────────────────────────────────────────┘
```

Left-to-right:

- A checkbox (always present; click-isolated so it does not bubble to row-body click).
- Every visible Left-aligned property, in list order. Each property renders via its **cell component** supplied by the entity.
- The stretch (`flex-1`) gap. The title property carries the stretch when present; otherwise an invisible spacer takes the slack.
- Every visible Right-aligned property, in list order.

Density controls vertical padding (Compact ≈ 4px top + bottom; Regular ≈ 8px). Horizontal padding is constant.

When the active view groups on a property, that property's cell is hidden from each row to avoid redundancy with the section header.

Clicking anywhere on the row body (outside the checkbox) selects the row and opens the detail surface configured for the active view (see "Preview surfaces" below). Clicking another row swaps the selection. Clicking the same row again is a no-op.

## Preview surfaces

The view's selected `Open pages in` option determines where the detail renders. Three options:

### Side peek

A resizable right rail inside the content area. It defaults to 440px wide, clamps to a compact-safe minimum and a maximum that leaves a useful list area, and persists `layout.sidePeekWidth` on the active named view. A visible splitter sits between the list and detail rail. The splitter uses `role="separator"`, `aria-orientation="vertical"`, exposes value min/max/current attributes, supports pointer drag, and supports ArrowLeft/ArrowRight keyboard resize. The list narrows to fill the remainder. The detail header carries an `X` close button. The list remains scrollable and selectable.

### Bottom peek

A resizable bottom pane inside the content area. It defaults to 280px tall, clamps to a compact-safe minimum and a maximum that leaves a useful list area above it, and persists `layout.bottomPeekHeight` on the active named view. A visible splitter sits between the list and detail pane. The splitter uses `role="separator"`, `aria-orientation="horizontal"`, exposes value min/max/current attributes, supports pointer drag, and supports ArrowUp/ArrowDown keyboard resize. The list takes the remaining height above. Otherwise identical to Side peek.

### Full page

```
┌──────────────────────────────────────────────────────────────────────┐
│  ←  Back to list (Esc)             3 of 12   ↑  ↓   j / k            │  nav strip
├──────────────────────────────────────────────────────────────────────┤
│  detail                                                              │
│  …                                                                   │
└──────────────────────────────────────────────────────────────────────┘
```

The list hides; the detail occupies the entire content area. A nav strip at the top carries:

- **Back**: returns to the list view, leaving the previously-selected row highlighted.
- **Position indicator**: `M of N` reflecting the row's position in the current display order.
- **Up / Down arrows**: navigate to the previous / next row.

`Esc` exits Full page. The same up / down navigation is available in every preview surface; only Full page elevates the arrow buttons into a visible nav strip.

### Keyboard navigation

When any row is selected, `↑` and `↓` always navigate the selection through the display order. The navigation honors the active grouping + sort: it walks rows, not buckets. Keyboard navigation is consistent across all three preview surfaces.

## Detail content

The detail component is entity-supplied. The same component renders identically across Side peek, Bottom peek, and Full page; only the surface dimensions change. An entity is responsible for:

- A header strip with the entity's identity (key, title, status, etc.) plus the close affordance the surface provides.
- A body with whatever the entity exposes: a structured panel, a markdown render of a body field, side-by-side comparison, etc. The entity decides.
- Optional mutation affordances when `collection-write.md` is in play (Approve, Edit, Reassign). These are entity-defined.

Detail components receive optional preview metadata from the generic host: `{ surface, width, height, sizeClass }`. The host also sets `data-preview-surface`, `data-preview-size`, `--preview-width`, and `--preview-height` on the detail content frame. Entity previews should adapt to measured width/height or `sizeClass`; they should not assume side peek, bottom peek, and full page map one-to-one to compact or roomy layouts.

## Persistence

Each named view persists to the local store. The user's collection-view configurations are local to their machine.

The active view per entity is per-user state, not part of the view itself. It's stored alongside other UI preferences. On launch, the last-active view for each entity is restored.

Default views shipped with each entity seed on first launch only. Deleting a default view is persistent.

## Entity contract (read side)

Every entity supplied to the collection layer exposes the same surface. The contract has four parts:

1. **Properties** — a flat list of every property the entity exposes. Each property carries an id, a display label, an icon, a kind (`categorical`, `continuous`, or `free-form`), and the cell component that renders it in a row.
2. **Groupable / sortable / filterable subsets** — declarations of which properties can be grouped on, sorted by, and filtered by, plus type-specific helpers (compare function, bucket function for continuous-valued properties, filter operator set).
3. **Detail component** — the React component the preview surfaces render when an item is selected.
4. **Defaults** — the default property list (with side + visibility per property), the default named views (one or more), and the entity's title property (the row's stretch property).

The contract is the seam between the generic collection layer and any specific entity. New entities (Jira issue, hygiene suggestion, audit-log entry, future GitHub issue) only need to supply this contract; the rest of the system follows.

## The current entity: Jira issue

The first concrete entity is Jira issue. It exposes the properties Jira returns (`key`, `title`, `status`, `assignee`, `priority`, `labels`, `updated_at_source`, `project_key`, plus the rest). Each property has a cell renderer matched to its type (badges for status / labels, monospace for the key, relative time for the updated timestamp, etc.). The detail component shows the full issue body with linked PRs and comments. Default views: `All open`, `Mine`, `Recently updated`.

Future entities (hygiene suggestion, audit-log entry, GitHub issue) follow the same contract.

## Out of scope

These appear as visible-but-disabled rows in the view-settings menu or as features deferred entirely:

- **Conditional color** — visible-but-disabled in the menu.
- **Table column widths** — drag-to-resize columns. Notion supports this; we don't yet.
- **Calculate footer** — per-column aggregates (Sum, Count, Average, …). Notion supports this; we don't yet.
- **Two-level group** — Notion's Group + Sub-group. v1 is single-level; future polish.
- **Configurable smart buckets** — the user defines `Number by` ranges and date-bucket sizes. Future polish.
- **AND/OR filter groups** — Notion's nested filter groups (up to three layers). v1 is flat AND only; future polish.
- **Chip drag-reorder** — drag-to-reorder the chip strip. v1 ships with creation order; future polish.
- **Mixed-entity collections** — a single collection that holds, for example, Jira + GitHub issues side-by-side. Each entity ships its own collection view today; mixed-entity is deferred.
- **Locking, automations, AI Autofill, link sharing, search-within-view** — Notion features not in scope.

## Cross-references

- `collection-write.md` — selection, bulk actions, mutation commands, audit log, undo. The write side.
- `collection-enhance.md` — the entity-contract applied to hygiene suggestions, including action sets and reversibility.
- `collection-history.md` — the audit-log-entry entity and the history view.
- `context-agent/design-system.md` — primitives this layer composes (`Popover`, `Select`, `Switch`, `Checkbox`, `Badge`, `ConfidenceChip`, etc.).
