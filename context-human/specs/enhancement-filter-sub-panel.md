---
created: 2026-05-27
last_updated: 2026-05-27
status: implementing
issue: 44
issue_url: [https://github.com/markdstafford/hm/issues/44](https://github.com/markdstafford/hm/issues/44)
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Filter sub-panel

## What

`hm` needs the collection view-settings `Filter` sub-panel to become a real control surface. This enhancement replaces the `Coming in #44` placeholder with filter rows that are bound to the active named view.
After this enhancement, a user can open the Jira issue collection, open view settings, drill into `Filter`, add one or more filter rows, choose a property, choose an operator that fits that property's value type, set a value when the operator needs one, and remove or clear filters. Filter changes apply immediately to the collection body and persist in the active view's existing `ViewConfig.filters` array.
The collection rendering pipeline applies filters first, then sort, then group, then row rendering. Multiple filters combine with AND in v1. A row with an incomplete value is safe: it does not crash the view and does not apply until it has enough input.
## Why

Named views are only useful if each view can show a focused subset of the source data. Sorting and grouping help a user scan a list, but they do not remove irrelevant rows. Filtering lets Elena keep a triage view focused on open work, Priya isolate a project or priority, and Tarek narrow an unfamiliar list to work assigned to a person or updated in a recent window.
This enhancement completes the first configurable collection display pipeline. The shell, layout, property visibility, sort, and group controls already prove that active-view config can change how a collection is displayed. Filters add the missing first pass and make each saved view capable of controlling what appears, not just how it appears.
## Personas

- **Elena: EM** — wants views like `Open team triage` and `Unassigned recent work` so she can review only issues that need attention.
- **Priya: PM** — wants to filter Jira issues by project, status, priority, and updated date before a roadmap review.
- **Tarek: Team member** — wants to narrow a large Jira issue list by assignee or title while exploring unfamiliar work.
- **Future collection implementer** — needs reusable filter metadata, predicates, and value controls that future entities can use without Jira-specific branches in the generic collection body.
- **Maintainer** — needs tested predicate behavior, config normalization, and display-order behavior before richer filter logic such as OR groups lands.
## Narratives

### Elena filters triage to open assigned work

Elena opens `Jira issues` and selects her `Team triage` view. The list is grouped by status, but it still includes issues that are already done and issues owned by other people. She opens view settings, clicks `Filter`, and clicks `+ Add filter`.
A new row appears with a sensible default property and operator. Elena changes the property to `Status`, chooses `is`, and picks `Open` from the value popover. The list updates immediately, and the top-sheet summary changes from `None` to `1 active`.
Elena adds a second row for `Assignee contains Alice`. The body narrows again. When she closes the menu and reopens the view later, both filters are still part of that named view.
### Priya reviews recently updated project work

Priya wants to understand what changed in project `AMP` during the last month. She opens the `Filter` panel on her roadmap review view. She adds `Project is AMP`, then adds `Updated is within Past month`.
The date filter uses a relative-date value control because `is within` needs a moving time window. The body applies both filters with AND, so Priya sees only AMP issues updated during the past month. Her existing sort by updated date and grouping by status still apply after the filter pass.
Priya clicks `Clear all filters` while exploring. The rows return to the broader view, the top-sheet summary returns to `None`, and no source-system data changes.
### Tarek experiments safely with text filters

Tarek is looking for issue titles that mention flaky behavior. He adds a `Title contains flaky` filter. Matching is case-insensitive, so rows with `Flaky test`, `flaky retriever`, and `FLAKY worker` remain visible.
He deletes the input text while thinking. The row stays visible in the panel, but the body returns to the unfiltered set because an empty `contains` value is incomplete. Tarek does not lose the row, and the app does not show an error.
He clicks the row's remove button when he decides the filter is not useful. The active view updates immediately.
## User stories

**Elena builds a focused view**
- Elena can open the `Filter` sub-panel from the existing view-settings menu.
- Elena can click `+ Add filter` and see a new row with a default filterable property and default operator.
- Elena can change the row's property and see the operator and value reset to valid defaults for that property.
- Elena can choose an operator that matches the selected property's filter kind.
- Elena can set a value when the operator needs one.
- Elena sees the collection body update immediately after each complete filter change.
- Elena sees multiple complete filters combine with AND.
- Elena sees the top-sheet `Filter` summary update to `N active`.
- Elena can close and reopen the view and keep the saved filters.
**Priya filters by date and categorical properties**
- Priya can filter categorical properties with an option popover that shows option labels and colors or icons where available, including multi-value selection for `contains` / `does not contain`.
- Priya can filter date properties with a date picker for absolute-date operators.
- Priya can filter date properties with a relative-date popover for `is within`.
- Priya can combine `Project is AMP` with `Updated is within Past month` and see only rows that match both.
- Priya can clear all filters with one action.
**Tarek edits and removes filters safely**
- Tarek can filter text fields with a textbox.
- Tarek can remove one filter row without affecting the others.
- Tarek can leave an operator value blank without crashing the body.
- Tarek sees incomplete value filters ignored until complete.
- Tarek can use keyboard navigation in the filter panel without moving row selection behind the menu.
**Future collection implementer reuses filtering**
- Future implementer can declare which entity properties are filterable.
- Future implementer can map each filterable property to a filter kind, operator set, value reader, and option source.
- Future implementer can use shared predicate helpers for text, number, categorical, tags, date, person, and checkbox-like values.
- Future implementer can add entity-specific filterable properties without changing `Body` internals.
## Goals

- Replace the `FilterPanel` placeholder with functional filter controls.
- Add generic filter row types for property, operator, value, and active state.
- Add operator definitions per filter kind, matching `context-agent/collections/collection-read.md`.
- Add predicate helpers that evaluate a filter row against an item.
- Apply filters before sort and group in every display-order path.
- Keep `Body`, preview navigation, keyboard navigation, and `M of N` based on the same filtered display item set.
- Add filterable property metadata to the collection entity contract.
- Declare Jira v1 filterable properties for `key`, `title`, `status`, `assignee`, `updated_at_source`, `priority`, `project_key`, and `labels`.
- Implement generic tags / multi-select predicates and value types, and expose Jira `labels` as a v1 multi-select / tags filter because label data is available.
- Render one editable row per active filter.
- Render `+ Add filter` below the active rows.
- Render `Clear all filters` only when at least one filter row exists.
- Persist filter changes through the existing `onPatchConfig(viewId, config)` path and `collectionViewSave`.
- Normalize persisted filters so stale properties, invalid operators, and malformed values cannot break the collection view.
- Keep styles on existing design-system tokens, Radix primitives, and collection menu patterns.
- Use the existing `DatePicker` primitive for absolute date filter values.
- Cover predicates, config normalization, panel interactions, body rendering, display order, persistence, accessibility, and e2e behavior with tests.
## Non-goals

- No AND/OR groups, nested filter logic, or user-controlled boolean expression builder.
- No quick-filter chip bar above the list.
- No filter templates or saved filter sets outside named views.
- No relation, rollup, or formula property filters.
- No source-system mutation. Filtering only changes local view presentation.
- No server-side filtering against Jira for this issue; the current collection body filters the loaded local item array. Local SQLite may still be queried for filter option lists.
- No changes to Jira ingestion, credentials, source configuration, AI providers, or app preferences beyond active-view config persistence.
- No new normalized database tables for filters.
- No conditional color controls.
- No mixed-entity collection filtering.
## Design spec

### Information architecture

This enhancement stays inside the existing Jira issue collection page and view-settings menu.
```plain text
Jira issues
└── Collection header
    ├── View chips
    └── View settings menu
        ├── Top sheet
        └── Filter panel
            ├── Filter rows
            ├── Add filter action
            └── Clear all filters action
```
The `Filter` top-sheet row already exists from the view-settings menu shell. Clicking it now shows functional controls instead of placeholder copy. The panel remains generic: it reads the active entity's filterable properties, reads `ViewConfig.filters`, and patches only `filters` when the user changes filtering.
### Filter panel chrome

The panel keeps the shared sub-panel shell:
```plain text
┌─────────────────────────────────────────────┐
│  ←  Filter                              [X] │
├─────────────────────────────────────────────┤
│  Status         is          Open        ✕  │
│  Updated        is within   Past month  ✕  │
│  Assignee       is not empty            ✕  │
│                                             │
│  + Add filter                               │
│                                             │
│                          Clear all filters  │
└─────────────────────────────────────────────┘
```
The back arrow returns to the top sheet. The close button dismisses the whole menu. `Esc` follows the existing menu behavior and closes from any panel.
When no filters exist, the body should use low-noise empty text such as `No filters yet. Add a filter to narrow this view.` Then show `+ Add filter` below it.
### Filter row layout

Each row has four logical controls:
1. **Property control** — a popover or compact select containing filterable properties.
2. **Operator control** — a popover or compact select containing only valid operators for the selected property.
3. **Value control** — rendered only when the operator needs a value.
4. **Remove control** — an icon button labelled `Remove filter` or `Remove {property} filter`.
Rows should fit the existing menu width. Use truncation for long property or option labels. Keep the remove button click target reachable and visually separate from value controls.
Changing the property resets the operator and value to valid defaults for the new property. Changing the operator resets or coerces the value when the old value no longer fits the new operator. Empty / not-empty operators hide the value control.
### Property picker

The property picker lists the active entity's filterable properties in entity order. Each option shows the property's icon where available and its label. Select, person, and multi-select option providers should query local SQLite for distinct non-empty option values when the view-settings menu or `Filter` panel opens, then fall back to the loaded item array only when a direct query or richer source metadata is not available.
Jira v1 exposes these filterable properties:

Property id
Label
Filter kind
Notes

`key`
Key
Text
Case-insensitive text matching.

`title`
Title
Text
Case-insensitive text matching.

`status`
Status
Select
Options queried from local SQLite when the view-settings menu or `Filter` panel opens, for example via a distinct non-empty status query, unless richer source metadata is available.

`assignee`
Assignee
Person
Options queried from local SQLite like the other categorical/person rows, plus empty / unassigned handling through empty / not-empty operators.

`updated_at_source`
Updated
Date
Absolute and relative date operators.

`priority`
Priority
Select
Options queried from local SQLite unless source metadata exists.

`project_key`
Project
Select
Options queried from local SQLite or configured Jira project metadata.

`labels`
Labels
Multi-select
Label data is available and Jira v1 must support label filtering with multi-select / tags predicates. Query distinct labels from SQLite for stable options.

The shared filter layer should still keep tags / multi-select predicates generic so future entities can reuse them without Jira-specific branches.
### Operator sets

Operator definitions must mirror `context-agent/collections/collection-read.md`; if that agent context still omits `contains` / `does not contain` for single-valued select filters, update it alongside implementation so the durable context matches this spec.

Filter kind
Operators
Value control

Text / title
`contains`, `does not contain`, `is`, `is not`, `starts with`, `ends with`, `is empty`, `is not empty`
Textbox, hidden for empty / not-empty.

Number
`=`, `≠`, `>`, `
Numeric input, hidden for empty / not-empty.

Select / status / categorical
`contains`, `does not contain`, `is`, `is not`, `is empty`, `is not empty`
Option popover: one value for `is` / `is not`, checkable multi-value selection for `contains` / `does not contain`, hidden for empty / not-empty.

Multi-select / tags
`contains`, `does not contain`, `is empty`, `is not empty`
Multi-select popover, hidden for empty / not-empty.

Date / updated / created
`is`, `is before`, `is after`, `is on or before`, `is on or after`, `is within`, `is empty`, `is not empty`
Date picker for absolute operators; relative-date popover for `is within`; hidden for empty / not-empty.

Person / assignee
`contains`, `does not contain`, `is empty`, `is not empty`
Person picker, hidden for empty / not-empty.

Checkbox
`is`, `is not`
No separate value control; the operator carries checked / unchecked meaning.

The default operator is the first operator for the selected property's filter kind. Empty / not-empty operators are complete without a value.
### Value controls

**Text value** uses a compact textbox. Matching is case-insensitive for text predicates. Trimming should be used for completion checks, but the input should not fight the user while they type.
**Number value** uses a numeric input. An empty field makes the row incomplete. Invalid numbers do not apply and do not crash.
**Select value** uses a nested popover. Options show label, color, and icon where the entity provides them. Options should come from source metadata or distinct local SQLite queries when possible; loaded-row discovery is only a fallback. Options appear in stable sorted order, with empty values represented by the empty / not-empty operators rather than a selectable blank option. `contains` and `does not contain` accept one or more selected option values even for single-valued properties.
**Multi-select / tags value** uses a nested popover with checkable options. Generic predicate support treats `contains` as any-overlap. Jira labels use this control in v1, with options queried from the local SQLite label data.
**Date value** uses the existing `DatePicker` primitive for absolute operators. The saved value should be a local date string in `YYYY-MM-DD` form. Date comparisons should compare calendar dates rather than raw timestamp strings when the operator is date-only.
**Relative date value** uses a nested popover for `is within`. V1 options are `Today`, `Past week`, `Past month`, and `Next week`. `Past month` is required by the issue tests. Relative windows evaluate against the current local date; tests must inject a fixed `now`.
**Person value** uses a person picker. For Jira assignees, options come from source metadata or distinct local SQLite queries over assignee fields, falling back to assignee display names present in the loaded entities. The empty / not-empty operators handle unassigned rows.
### Add, remove, and clear behavior

`+ Add filter` inserts one row with:
- A stable generated id.
- The first available filterable property.
- That property's default operator.
- A default value only when the value control can provide one safely; otherwise an empty value that makes the row incomplete until edited.
- `active: true`.
If no filterable properties exist, the panel shows an empty state and disables or hides `+ Add filter`.
The row remove button deletes only that row. `Clear all filters` deletes every row and is visible only when at least one row exists. Neither action changes source-system data.
### Top-sheet summary

The top-sheet `Filter` row shows:
- `None` when no complete active filters exist.
- `1 active` for one complete active filter.
- `N active` for multiple complete active filters.
If the config contains incomplete rows, count only rows that are active and complete enough to apply. This keeps the summary aligned with the body.
### Filtered body rendering

The display pipeline is:
1. Filter.
2. Sort.
3. Group.
4. Render.
A row remains visible only when every applicable active filter returns true. Incomplete active filters are ignored. Filters with stale property ids or invalid operators should be dropped during normalization; if one reaches predicate evaluation, treat it as ignored rather than failing closed.
When filters remove all rows, the empty state should distinguish the case from no loaded data. Use copy such as `No matching Jira issues` and `Try changing or clearing filters for this view.`
Selection and preview behavior must follow the filtered display item set:
- If the selected row still matches, keep it selected.
- If the selected row no longer matches, select the first displayed row or clear selection when there are no displayed rows.
- Preview navigation, arrow keys, full-page `j` / `k`, and `M of N` use filtered rows only.
- Group section headers are still skipped by navigation.
### Accessibility

- The panel title is visible and labelled through `PanelHeader`.
- Property, operator, and value controls have accessible labels that include the row purpose, such as `Filter property`, `Filter operator`, and `Filter value`.
- Remove buttons have accessible labels.
- `+ Add filter` and `Clear all filters` are keyboard reachable.
- Nested popovers expose selected state for selected options.
- Text and number inputs do not trigger collection row navigation while focused.
- `Esc` closes the current popover according to Radix behavior, then the panel/menu when focus returns to the outer menu.
- Component tests should include axe coverage for the panel in common states.
## Tech spec

### Prerequisites and references

- Issue #39 and `context-human/specs/enhancement-view-settings-menu-shell.md` for the menu shell, panel state, top-sheet summaries, and config patch path.
- Issue #40 and `context-human/specs/enhancement-layout-sub-panel.md` for display density and preview surfaces.
- Issue #42 and `context-human/specs/enhancement-sort-sub-panel-multi-sort.md` for sort helpers and display-order expectations.
- Issue #43 and `context-human/specs/enhancement-group-sub-panel-smart-buckets.md` for grouped body behavior and flattened navigation order.
- `context-human/specs/feature-date-picker-primitive.md` for the reusable absolute date input.
- `context-agent/collections/collection-read.md`, especially `Filter sub-panel`, `Body`, and `Entity contract`.
- `context-agent/design-system.md` for tokens, `PanelHeader`, nested popovers, menu styling, keyboard behavior, and the design-system maintenance contract.
- ADR-002 for the Tauri + React architecture.
- ADR-003 for local-first single-user behavior.
- ADR-004 for SQLite as the primary local store.
- ADR-008 for the split between view data in SQLite and active-view preference in the preferences file.
### Filter config and row types

`ViewConfig` already contains:
```typescript
export type FilterConfig = {
  id: string;
  property: string;
  operator: string;
  value: unknown;
  active: boolean;
};
```
Keep this persisted shape for compatibility, but add typed helpers under `src/views/collection/filter/` so runtime code does not handle raw `unknown` values directly.
Add `src/views/collection/filter/types.ts` with suggested types:
```typescript
export type FilterKind =
  | "text"
  | "number"
  | "select"
  | "multi-select"
  | "date"
  | "person"
  | "checkbox";

export type FilterValueControl =
  | "none"
  | "text"
  | "number"
  | "single-select"
  | "multi-select"
  | "date"
  | "relative-date"
  | "person";

export type RelativeDateValue =
  | "today"
  | "past-week"
  | "past-month"
  | "next-week";

export type FilterOption = {
  id: string;
  label: string;
  color?: string;
  icon?: React.ReactNode;
};

export type FilterOptionContext = {
  items: TItem[];
  optionsByProperty?: Partial>;
};

export type FilterableProperty = {
  property: TProperty;
  kind: FilterKind;
  getValue: (item: TItem) => unknown;
  options?: (context: FilterOptionContext) => FilterOption[];
};
```
Do not make the persisted JSON depend on React nodes. React-specific option icons belong in runtime metadata only.
### Operator registry

Add `src/views/collection/filter/operators.ts`.
Each operator definition should include:
- `id` — persisted operator id.
- `label` — UI label.
- `kind` or applicable filter kinds.
- `valueControl` — the control to render.
- `requiresValue` — whether an empty value makes the row incomplete.
- Optional value normalization for operator-specific value shapes.
Suggested exported APIs:
```typescript
export function operatorsForKind(kind: FilterKind): FilterOperator[];
export function defaultOperatorForKind(kind: FilterKind): FilterOperator;
export function operatorFor(kind: FilterKind, operatorId: string): FilterOperator | null;
export function operatorRequiresValue(operator: FilterOperator): boolean;
```
Use stable operator ids such as `contains`, `does-not-contain`, `is`, `is-not`, `starts-with`, `ends-with`, `empty`, `not-empty`, `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `before`, `after`, `on-or-before`, `on-or-after`, and `within`.
### Predicate evaluation

Add `src/views/collection/filter/predicates.ts`.
Suggested exported APIs:
```typescript
export type FilterEvaluationContext = {
  now?: Date;
  locale?: string;
  timeZone?: string;
};

export function isFilterComplete(row: FilterConfig, entity: EntityContract): boolean;
export function filterMatchesItem(args: {
  row: FilterConfig;
  item: TItem;
  entity: EntityContract;
  allItems?: TItem[];
  context?: FilterEvaluationContext;
}): boolean;

export function filterCollectionItems(args: {
  items: TItem[];
  entity: EntityContract;
  filters: FilterConfig[];
  context?: FilterEvaluationContext;
}): TItem[];
```
Predicate requirements:
- Text `contains` is case-insensitive substring matching.
- Text `is` and `is not` compare normalized strings.
- Empty text means null, undefined, or a trimmed empty string.
- Number comparisons ignore incomplete or non-numeric filter values.
- Select `contains` matches when the item's stable option id or label is in the selected value set; `does not contain` matches when it is not in that selected value set.
- Select `is` / `is not` compare one stable option id or label based on the entity's value reader.
- Multi-select `contains` returns true when any selected filter value overlaps the item's values.
- Date absolute operators compare local calendar dates.
- Date `is within Past month` includes dates from one month ago through today using local calendar boundaries.
- Person `contains` / `does not contain` compare stable ids when present, otherwise display labels.
- Empty / not-empty operators never require a value.
- Malformed rows are ignored, not treated as failing every item.
### Entity contract changes

Extend `src/views/collection/types.ts` with `filterableProperties?: FilterableProperty[]`.
Filter metadata should be independent from grouping and sorting metadata. A display property may be sortable but not filterable, filterable but not groupable, or have a different filter kind than its display `kind`. For example, Jira `assignee` currently renders as text but should filter as `person`.
Add helper functions in the filter module or `ViewConfig.ts`:
```typescript
export function availableFilterProperties(entity): FilterableProperty[];
export function filterablePropertyFor(entity, propertyId): FilterableProperty | null;
export function defaultFilterForEntity(entity): FilterConfig | null;
export function normalizeFilterRows(input, entity): FilterConfig[];
export function addFilter(config, entity): FilterConfig[];
export function updateFilterProperty(rows, rowId, property, entity): FilterConfig[];
export function updateFilterOperator(rows, rowId, operator, entity): FilterConfig[];
export function updateFilterValue(rows, rowId, value): FilterConfig[];
export function removeFilter(rows, rowId): FilterConfig[];
export function clearFilters(): FilterConfig[];
```
`normalizeViewConfig` should use `normalizeFilterRows` instead of accepting any row with string `property` and `operator`.
Normalization rules:
- Drop filters whose property is not currently filterable.
- Drop filters whose operator is invalid for the property's filter kind.
- Preserve valid row ids; generate ids only for new rows created by UI helpers.
- Default missing `active` to `true` only if the row otherwise looks like a user-created row; otherwise drop malformed rows.
- Normalize invalid values to an incomplete empty value rather than throwing.
- Preserve row order.
### Jira filterable metadata

Update `src/entities/jira-issue/index.tsx` or a new `filterable.ts` helper to declare Jira filterable properties.
Initial metadata:
```typescript
const FILTERABLE_PROPERTIES = [
  { property: "key", kind: "text", getValue: (item) => item.key },
  { property: "title", kind: "text", getValue: (item) => item.title },
  { property: "status", kind: "select", getValue: (item) => item.status_name, options: statusOptions },
  { property: "assignee", kind: "person", getValue: (item) => item.assignee_display_name, options: assigneeOptions },
  { property: "updated_at_source", kind: "date", getValue: (item) => item.updated_at_source },
  { property: "priority", kind: "select", getValue: (item) => item.priority_name, options: priorityOptions },
  { property: "project_key", kind: "select", getValue: (item) => item.project_key, options: projectOptions },
  { property: "labels", kind: "multi-select", getValue: (item) => item.labels, options: labelOptions },
];
```
Option helpers should prefer `optionsByProperty` values loaded from local SQLite distinct queries when the view-settings menu or `Filter` panel opens. If richer source metadata or SQLite option rows are not available, helpers may return stable unique non-empty values from the loaded item list as a fallback. Sort options alphabetically unless an existing entity order exists. Do not include blank options; use empty / not-empty operators for missing values.
For Jira, add a small option-loading helper or existing IPC query path that can fetch distinct non-empty values for status, priority, project, assignee, and labels from SQLite without filtering the collection rows in SQL. This is option discovery only; predicate evaluation still runs against the loaded local item array.
### Filter panel implementation

Update `src/views/collection/menu/sub-panels/FilterPanel.tsx` to accept:
```typescript
type Props = {
  entity: EntityContract;
  items: TItem[];
  optionContext?: FilterOptionContext;
  config: ViewConfig;
  onPatchConfig: (config: ViewConfig) => void;
  onBack: () => void;
  onClose: () => void;
};
```
`items` lets option controls fall back to current select/person/tag option lists. `optionContext` should carry SQLite-derived option lists when available. If threading loaded items into the generic menu is too broad, pass only `optionContext`, but keep option derivation out of global state.
Recommended subcomponents:
- `FilterRow.tsx` — renders one row and delegates value control rendering.
- `FilterPropertyPopover.tsx` — property picker.
- `FilterOperatorPopover.tsx` — operator picker.
- `FilterValueControl.tsx` — switches by operator `valueControl`.
- `FilterOptionPopover.tsx` — reusable single-select and person option popover.
- `FilterMultiSelectPopover.tsx` — reusable multi-select popover for generic tags support.
- `RelativeDatePopover.tsx` — relative date options for `is within`.
The panel should patch filters through:
```typescript
onPatchConfig(patchViewConfig(config, { filters: nextFilters }));
```
This preserves layout, property visibility, sort, group, and conditional color settings.
Update `ViewSettingsMenu` to pass the active entity, active config, loaded collection items or option context, and patch callback into `FilterPanel`.
### Display-order integration

Update every path that derives display items:
- `src/features/collection-viewer/useCollectionViewer.tsx`
- `src/views/collection/Body.tsx`
- Any tests or helpers that independently sort/group items
The shared flow should be:
```typescript
const filteredItems = filterCollectionItems({
  items: issues,
  entity: jiraIssueEntity,
  filters: activeConfig.filters,
});

const sortedItems = sortCollectionItems(filteredItems, jiraIssueEntity, activeConfig.sort);
const groupedItems = activeConfig.group.property
  ? bucketCollectionItems({ items: sortedItems, entity: jiraIssueEntity, group: activeConfig.group })
  : [];
const displayItems = activeConfig.group.property
  ? flattenBucketedGroups(groupedItems, { collapsedGroupKeys })
  : sortedItems;
```
`Body` should receive the filtered item set, or accept `filters` and apply the same helper internally. Prefer applying filtering once in `useCollectionViewer` and passing already-filtered items to `Body` only if that keeps `Body` and navigation in sync. If `Body` keeps owning sort/group rendering, add tests that prove its rows match `displayItems` from `useCollectionViewer`.
When filters change, clear collapsed group keys only if the active grouping property changes or if a collapsed bucket disappears. Do not clear collapses on every filter keystroke unless maintaining stable collapsed state becomes complex.
### Empty-state behavior

`Body` currently shows `No Jira issues yet` when it receives no items. After filters land, distinguish these states:
- Source list is empty before filtering: `No Jira issues yet`.
- Source list has items but filtered list is empty: `No matching Jira issues`.
This can be implemented by passing `unfilteredCount` or an `emptyReason` into `Body`, or by rendering the filtered empty state in `useCollectionViewer` before `Body`.
### Persistence

No database schema change is required. Filters live inside the existing `collection_views.config_json` through `ViewConfig.filters`.
The active view's config patch path is already established:
`FilterPanel` → `onPatchConfig(viewId, config)` → `handlePatchViewConfig` → `buildConfigPatchView` → `collectionViewSave`.
Add or update tests to prove filter patches preserve unrelated config fields.
### Date and time handling

Use local calendar boundaries for date-only comparisons and relative windows. Tests must inject a fixed `now` into predicate helpers to avoid failures at midnight, month boundaries, or timezone changes.
Store absolute date values as `YYYY-MM-DD`. Store relative date values as stable ids such as `past-month`.
If Jira timestamps include time zones, convert them to local dates before date-only comparisons. Do not compare timestamp strings lexicographically.
### Design-system context update

Implementation should update `context-agent/design-system.md` so the collection implementation notes no longer list `Filter` as `Coming in #44`. Add a concise note for the real filter panel, value controls, config patch path, and display pipeline.
## Test plan

### Unit tests

Add focused unit tests for:
- `operatorsForKind` returns the exact operator list for each filter kind.
- `defaultOperatorForKind` returns the first operator for each kind.
- `normalizeFilterRows` drops stale properties and invalid operators.
- `normalizeFilterRows` preserves valid row order and values.
- `addFilter` inserts a row with the first filterable property and its default operator.
- `updateFilterProperty` resets operator and value to valid defaults.
- `updateFilterOperator` resets or preserves value only when valid.
- `removeFilter` removes one row.
- `clearFilters` returns an empty list.
- `patchViewConfig` patches filters while preserving layout, property visibility, sort, and group.
Predicate coverage:
- Text `contains` is case-insensitive substring matching.
- Text `does not contain`, `starts with`, `ends with`, `is`, and `is not` use normalized strings.
- Empty text and not-empty text handle null, undefined, and whitespace.
- Number comparison operators evaluate numeric values and ignore invalid inputs.
- Select `contains`, `does not contain`, `is`, `is not`, empty, and not-empty evaluate option values.
- Date absolute operators compare local calendar dates.
- Date `is within Past month` works with an injected fixed `now`.
- Multi-select `contains` returns true on any overlap.
- Multi-select `does not contain` returns true when no selected value overlaps.
- Person `contains` and `does not contain` evaluate assignee names or ids.
- Incomplete filters do not apply.
### Component tests

Add or update component tests for:
- `FilterPanel` renders the empty state and `+ Add filter`.
- Adding a filter renders a row with property, operator, value, and remove controls.
- Changing property changes available operators and value control type.
- Text value edits patch `ViewConfig.filters`.
- Select/status value popover patches the selected option.
- Person picker patches the selected person.
- Date picker patches an absolute date value.
- Relative-date popover patches `past-month`.
- Empty / not-empty operators hide value controls.
- Removing one filter keeps other rows.
- `Clear all filters` empties the list and hides itself.
- The top-sheet summary shows `None`, `1 active`, and `N active` accurately.
- The panel has no axe violations in common states.
### Page and display-order tests

Add or update tests for:
- `useCollectionViewer` applies filters before sort and group.
- `Body` renders only filtered rows.
- Group counts reflect filtered rows.
- Preview navigation uses filtered rows only.
- `M of N` uses filtered rows only.
- Selection is preserved when the selected row still matches a changed filter.
- Selection moves to the first displayed row or clears when the selected row no longer matches.
- Filtered-empty state appears when source items exist but no row matches.
- View config persistence saves filters and restores them through normalization.
### Playwright

Add or extend collection viewer e2e coverage if the harness can seed deterministic rows:
1. Open `Jira issues`.
2. Open view settings and drill into `Filter`.
3. Add `Status is Open`.
4. Verify only open issues remain.
5. Add `Assignee contains Alice` or another deterministic assignee.
6. Verify the list narrows further.
7. Remove the assignee filter.
8. Verify the broader status-filtered set returns.
9. Clear all filters.
10. Verify the full set returns.
11. Reload or switch views and return, if persistence is deterministic in the harness, and verify saved filters restore.
If Playwright cannot seed deterministic Jira rows or cannot exercise real Tauri persistence, keep focused unit/page coverage and document the manual verification path.
### Verification commands

Run targeted checks first, then broader checks:
```bash
npm test -- filter
npm test -- ViewConfig
npm test -- FilterPanel
npm test -- Body
npm test -- CollectionViewerPage
npm test
npm run lint
npm run build
```
If Playwright coverage is added or changed, also run the focused e2e test:
```bash
npm run test:e2e -- collection
```
No Rust binding generation is expected unless implementation changes Tauri commands or generated IPC types.
## Task decomposition

- [ ] **Story: Add filter metadata and operator registry**
	- **Description:** Give collection entities a generic way to declare filterable properties and expose operator definitions for each filter kind.
	- **Acceptance criteria:**
		- [ ] `EntityContract` supports optional `filterableProperties` metadata.
		- [ ] Filter metadata includes a property reference, filter kind, item value reader, and optional option provider.
		- [ ] `src/views/collection/filter/types.ts` defines filter kinds, value controls, option shape, and relative date values.
		- [ ] `src/views/collection/filter/operators.ts` declares the operator set from `collection-read.md`.
		- [ ] Operator definitions include labels, value control type, and value requirement.
		- [ ] Tests cover operator lists and defaults for text, number, select, multi-select, date, person, and checkbox kinds.
	- **Dependencies:** Existing entity contract and typed `ViewConfig`.
	- [ ] **Task: Extend collection entity types**
		- Add `FilterableProperty` and optional `filterableProperties` to `src/views/collection/types.ts`.
	- [ ] **Task: Add filter type module**
		- Create `src/views/collection/filter/types.ts` with filter kinds, option shape, and value-control types.
	- [ ] **Task: Add operator registry**
		- Create `operators.ts` with operator lists, lookup helpers, and default operator helpers.
	- [ ] **Task: Add operator tests**
		- Verify the registry exactly matches the required table.
- [ ] **Story: Normalize and edit filter config safely**
	- **Description:** Treat persisted `ViewConfig.filters` as user-owned JSON and keep it valid for the current entity.
	- **Acceptance criteria:**
		- [ ] Normalization drops filters with stale or non-filterable property ids.
		- [ ] Normalization drops filters with operators invalid for the selected property's filter kind.
		- [ ] Normalization preserves valid ids, row order, active state, and compatible values.
		- [ ] Adding a filter inserts the first filterable property and its default operator.
		- [ ] Changing property resets operator and value to valid defaults.
		- [ ] Changing operator updates value shape safely.
		- [ ] Removing one filter and clearing all filters are pure helper operations.
		- [ ] Filter patches preserve unrelated config fields.
		- [ ] Summary counts only active complete filters.
		- [ ] Tests cover stale config, invalid config, helper behavior, patch preservation, and summary counts.
	- **Dependencies:** Story 1 filter metadata and operator registry.
	- [ ] **Task: Add filter config helpers**
		- Implement normalization, add, update, remove, clear, completion, and summary helpers.
	- [ ] **Task: Update ****`normalizeViewConfig`**
		- Replace permissive filter row normalization with metadata-aware normalization.
	- [ ] **Task: Update top-sheet summary logic**
		- Count only active complete filters and keep `None` / `1 active` / `N active` copy.
	- [ ] **Task: Add config tests**
		- Cover valid rows, stale rows, malformed rows, incomplete rows, and patch preservation.
- [ ] **Story: Add shared predicate evaluation**
	- **Description:** Evaluate active filters against collection items with reusable predicates for every filter kind.
	- **Acceptance criteria:**
		- [ ] `filterMatchesItem` evaluates one complete filter row against one item.
		- [ ] `filterCollectionItems` AND-combines every applicable active complete filter.
		- [ ] Incomplete filters are ignored.
		- [ ] Malformed filters that survive normalization are ignored.
		- [ ] Text predicates are case-insensitive where required.
		- [ ] Date predicates use local calendar dates and injected `now` in tests.
		- [ ] Multi-select `contains` uses any-overlap.
		- [ ] Tests cover each operator family and edge cases.
	- **Dependencies:** Stories 1-2.
	- [ ] **Task: Add predicate module**
		- Create `src/views/collection/filter/predicates.ts` with text, number, select, multi-select, date, person, and checkbox evaluation.
	- [ ] **Task: Add date utilities**
		- Implement local-date parsing, comparison, and relative-window helpers with injectable `now`.
	- [ ] **Task: Add predicate tests**
		- Cover the issue-required cases: text `contains`, date `is within Past month`, and multi-select `contains` any-overlap, plus the rest of the operator table.
- [ ] **Story: Declare Jira filterable properties**
	- **Description:** Expose Jira issue properties that the generic filter panel can use in v1.
	- **Acceptance criteria:**
		- [ ] Jira declares filterable metadata for `key`, `title`, `status`, `assignee`, `updated_at_source`, `priority`, `project_key`, and `labels`.
		- [ ] Jira exposes `labels` as a v1 multi-select / tags filter.
		- [ ] Status, priority, project, assignee, and label options derive stable unique options from local SQLite distinct queries, source metadata, or loaded rows as a fallback.
		- [ ] Assignee filters treat missing values as empty / unassigned.
		- [ ] Tests cover Jira metadata, option derivation, and labels inclusion.
	- **Dependencies:** Story 1.
	- [ ] **Task: Add Jira filter metadata**
		- Define filterable properties in `src/entities/jira-issue/index.tsx` or a dedicated helper module.
	- [ ] **Task: Add option providers**
		- Implement stable option helpers for status, priority, project, assignee, and labels.
	- [ ] **Task: Add SQLite option loading**
		- Query distinct non-empty option values from local SQLite when the view-settings menu or `Filter` panel opens, then pass them to filter option helpers.
	- [ ] **Task: Add Jira filter metadata tests**
		- Verify filterable ids, filter kinds, value readers, option ordering, and labels inclusion.
- [ ] **Story: Build the functional Filter panel**
	- **Description:** Replace placeholder copy with filter rows and controls bound to the active view config.
	- **Acceptance criteria:**
		- [ ] The panel renders `PanelHeader` with title `Filter`.
		- [ ] The empty state appears when no filter rows exist.
		- [ ] `+ Add filter` adds a default row.
		- [ ] Each row renders property, operator, value, and remove controls.
		- [ ] Property picker lists filterable properties in entity order.
		- [ ] Operator picker lists valid operators for the selected property only.
		- [ ] Value controls match the selected operator's value-control type.
		- [ ] Empty / not-empty operators hide value controls.
		- [ ] Row edits patch only `ViewConfig.filters`.
		- [ ] `Clear all filters` appears only when rows exist and removes every row.
		- [ ] Tests cover rendering, row edits, patch payloads, remove, clear, empty state, no-filterable state, keyboard use, and axe.
	- **Dependencies:** Stories 1-4 and existing `DatePicker` primitive.
	- [ ] **Task: Update ****`FilterPanel`**** props and rendering**
		- Accept entity, items or option context, config, and patch callback; render rows from normalized filters.
	- [ ] **Task: Build property and operator controls**
		- Add nested popovers or compact selects for choosing filter property and operator.
	- [ ] **Task: Build value controls**
		- Add text, number, single-select, multi-select, date, relative-date, and person value controls.
	- [ ] **Task: Wire config patching**
		- Patch only `filters` through `patchViewConfig(config, { filters })`.
	- [ ] **Task: Wire ****`ViewSettingsMenu`**
		- Pass active entity, loaded items and/or SQLite-backed option context, normalized config, and patch callback into `FilterPanel`.
	- [ ] **Task: Add panel tests**
		- Cover add, edit, operator switch, value controls, remove, clear, summaries, no-filterable state, and accessibility.
- [ ] **Story: Apply filters in the collection display pipeline**
	- **Description:** Ensure body rows, grouping, selection, preview navigation, and empty states all use the filtered item set.
	- **Acceptance criteria:**
		- [ ] `useCollectionViewer` filters source issues before sorting.
		- [ ] Grouping receives the filtered sorted rows.
		- [ ] `Body` renders the same filtered rows used by preview navigation.
		- [ ] Group section counts reflect filtered rows.
		- [ ] Preview navigation skips filtered-out rows.
		- [ ] `M of N` counts filtered rows only.
		- [ ] Selection is preserved when still visible and repaired when filtered out.
		- [ ] The UI distinguishes no loaded data from no filter matches.
		- [ ] Tests cover filter-before-sort, filter-before-group, selection repair, preview order, and filtered-empty state.
	- **Dependencies:** Stories 2-3.
	- [ ] **Task: Thread filter pass into ****`useCollectionViewer`**
		- Derive `filteredItems`, then sort, group, and flatten from that array.
	- [ ] **Task: Align ****`Body`**** rendering**
		- Pass the filtered rows into `Body` or add a `filters` prop while keeping one source of truth for display order.
	- [ ] **Task: Update empty states**
		- Render `No matching Jira issues` when source rows exist but filters remove all rows.
	- [ ] **Task: Add display-order tests**
		- Cover body rows, group counts, preview navigation, keyboard movement, and selection repair.
- [ ] **Story: Verify persistence and durable context**
	- **Description:** Add focused coverage, run relevant checks, and update durable context for the shipped Filter panel.
	- **Acceptance criteria:**
		- [ ] View config save calls include the updated filters array.
		- [ ] Reloading or remounting with saved config restores filter rows and applies them.
		- [ ] Playwright covers status + assignee filtering if deterministic data is available.
		- [ ] `npm test` passes.
		- [ ] `npm run lint` passes.
		- [ ] `npm run build` passes.
		- [ ] Any skipped e2e or manual Tauri checks are documented with a reason.
		- [ ] `context-agent/design-system.md` no longer lists `Filter` as `Coming in #44` after implementation ships.
	- **Dependencies:** Stories 1-6.
	- [ ] **Task: Add persistence tests**
		- Cover save payloads, normalization on load, and unrelated config preservation.
	- [ ] **Task: Add Playwright coverage**
		- Extend the collection viewer e2e flow with deterministic fixture data if the harness supports it.
	- [ ] **Task: Run verification**
		- Run targeted tests, then `npm test`, `npm run lint`, and `npm run build`.
	- [ ] **Task: Update durable context**
		- Update `context-agent/design-system.md` and `context-agent/collections/collection-read.md` implementation notes to reflect the shipped functional Filter panel, including labels support and select `contains` / `does not contain` operators.
## Open questions and implementation notes

- Label data is available, so Jira `labels` are in scope for v1 as a multi-select / tags filter. Keep the implementation generic so the same predicates and controls work for future tag-like properties.
- Jira assignees may have display names but not stable account ids in the current projected list. Prefer account ids if they exist in the binding; otherwise use display names and document that duplicate display names can collide until richer assignee metadata lands.
- Status and priority option ordering should use source metadata when available. Otherwise prefer distinct local SQLite option queries and sort options alphabetically; loaded-row option discovery is only a fallback.
- Date filters use local calendar dates. Tests must inject a fixed `now` so they do not fail at midnight, month boundaries, or timezone changes.
- `is within Past month` should be inclusive of today and the local date one month ago. If product later wants rolling 30 days instead of calendar month subtraction, update predicates and copy together.
- If predicate evaluation becomes slow on large local arrays, future work can add memoized predicate compilation or push row filtering closer to SQLite. That is out of scope for issue #44; this issue uses SQLite only for option discovery.
- Browser-only Playwright may not exercise real Tauri SQLite persistence. If so, verify persistence through component/page tests and document the limitation for e2e.