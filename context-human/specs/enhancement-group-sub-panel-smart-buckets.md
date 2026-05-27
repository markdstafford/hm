---
created: 2026-05-27
last_updated: 2026-05-27
status: implementing
issue: 43
issue_url: [https://github.com/markdstafford/hm/issues/43](https://github.com/markdstafford/hm/issues/43)
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Group sub-panel with smart buckets

## What

`hm` needs the collection view-settings `Group` sub-panel to become a real control surface. This enhancement replaces the `Coming in #43` placeholder with single-level grouping controls for the active collection view.
After this enhancement, a user can open the Jira issue collection, open view settings, drill into `Group`, and choose one groupable property or `None`. The collection body renders rows inside section groups after filtering and sorting but before row rendering. Each section header uses real OpenType small-caps, shows the bucket label plus item count, and includes a chevron button to collapse or expand that group.
The active view stores grouping in the existing typed `ViewConfig.group` object. `Hide empty groups` controls whether buckets with zero matching items appear. Continuous-valued properties use property-defined smart buckets, such as `Today`, `Yesterday`, `This week`, `This month`, and `Older` for Jira updated dates.
## Why

Sorting lets users choose row order, but long issue lists are still hard to scan when related items blend together. Grouping gives users stable visual sections so Elena can scan work by status, Priya can inspect work by project or priority, and Tarek can organize unfamiliar issues by assignee or freshness.
This enhancement also completes another step in the collection display pipeline. The collection body already has a contract for filter, sort, group, and render passes. Grouping proves that active-view config can change both menu state and body structure while keeping preview navigation and selection tied to the same displayed row order.
## Personas

- **Elena: EM** — wants to organize Jira issues into status sections so triage starts with the most relevant workflow bucket.
- **Priya: PM** — wants to inspect Jira work by project, priority, or freshness without changing the underlying Jira data.
- **Tarek: Team member** — wants to group by assignee or status while exploring unfamiliar work and keep detail navigation predictable.
- **Future collection implementer** — needs a reusable group metadata and bucketing contract that later entities can use without Jira-specific branches in the generic collection body.
- **Maintainer** — needs tested grouping, smart-bucket, empty-bucket, row-cell hiding, and display-order behavior before filters and richer collection entities land.
## Narratives

### Elena groups team triage by status

Elena opens `Jira issues` and selects her `Team triage` view. The list is sorted by update time, but open, in-progress, and done issues are mixed together. She opens view settings, clicks `Group`, and chooses `Status` from the `Group by` popover.
The body updates immediately. Rows now appear under section headers such as `To do`, `In progress`, and `Done`, each with an accurate count and a chevron. Elena keeps the menu open, collapses `Done` to reduce noise, scans the remaining visible rows, and notices the `In progress` bucket is smaller than expected.
Because `Status` is now the active grouping property, the status cell disappears from each row. Elena sees the same information once in the section header instead of repeated in every row.
### Priya reviews issues by project and sees empty buckets

Priya wants to check whether one project has fallen quiet. She opens the `Group` panel and chooses `Project key`. Empty groups are hidden by default, so only projects with current rows appear.
She turns `Hide empty groups` off. The body now shows every declared project bucket in the configured order, including buckets with `0` items. Priya can confirm which projects have no matching issues in the current view without changing filters or source data.
### Tarek groups by updated date freshness

Tarek is looking for recently touched Jira issues. He opens `Group` and chooses `Updated`. The property is continuous, so the app uses smart date buckets instead of one section per timestamp.
The body renders `Today`, `Yesterday`, `This week`, `This month`, and `Older`, with recent buckets first. Tarek uses the existing preview navigation to move through rows. Navigation walks issue rows in the displayed order and skips section headers, so the detail pane stays predictable.
## User stories

**Elena groups a collection by a categorical property**
- Elena can open the `Group` sub-panel from the existing view-settings menu.
- Elena can open a `Group by` nested popover.
- Elena can choose `None` or any groupable property from the popover.
- Elena sees grouped sections appear immediately after choosing a property.
- Elena sees section headers with small-caps labels and counts.
- Elena can use a chevron on each section header to collapse or expand that group.
- Elena sees the grouped property's cell hidden from every row.
- Elena can remove grouping with `Remove grouping` or by choosing `None`.
**Priya controls empty bucket visibility**
- Priya sees `Hide empty groups` in the group panel.
- Priya sees empty buckets hidden when the switch is on.
- Priya sees empty buckets rendered with count `0` when the switch is off.
- Priya can change the toggle without clearing the selected group property.
- Priya sees the top-sheet `Group` summary update when the active group property changes.
**Tarek groups by smart buckets**
- Tarek can choose continuous groupable properties that expose smart buckets.
- Tarek sees `updated_at_source` grouped into `Today`, `Yesterday`, `This week`, `This month`, and `Older`.
- Tarek sees date buckets ordered from most recent to oldest.
- Tarek sees preview navigation use the same grouped display order as the body.
- Tarek can return to a flat list by choosing `None`.
**Future collection implementer reuses grouping**
- Future implementer can mark entity properties as groupable.
- Future implementer can provide `bucketKeyFor(item)` and `bucketOrder()` without changing `Body` internals.
- Future implementer can add continuous smart buckets for other entities and property types.
- Future implementer can rely on one display-order helper for body rows, section rendering, and preview navigation.
## Goals

- Replace `GroupPanel` placeholder content with functional grouping controls.
- Render a `Group by` row with the current value and chevron.
- Add `GroupByPopover` with `None` plus every groupable property.
- Show each groupable property option with the property's icon and label.
- Render `Hide empty groups` as a switch bound to `ViewConfig.group.hideEmptyGroups`.
- Render `Remove grouping` only when grouping is active.
- Persist group changes to the active view through the existing config patch path.
- Extend the entity contract with groupable property metadata.
- Declare Jira groupable properties for `status`, `assignee`, `priority`, `project_key`, and `updated_at_source`.
- Keep free-form Jira properties such as `key`, `title`, and `labels` out of the groupable list.
- Add bucket logic that partitions sorted items by the active group property.
- Render section headers with small-caps label and accurate count.
- Render a chevron affordance in each section header that collapses and expands that group's rows.
- Hide empty buckets when `hideEmptyGroups` is true.
- Render empty buckets with count `0` when `hideEmptyGroups` is false.
- Hide the grouped property's row cell to avoid repeated information.
- Preserve selection while grouping changes when the selected row still exists.
- Keep preview navigation walking rows, not section headers.
- Use existing design-system tokens, Radix primitives, and collection menu patterns.
- Cover group config normalization, bucketing, panel interactions, body rendering, row-cell hiding, and end-to-end grouping behavior with tests.
## Non-goals

- No two-level grouping or sub-grouping.
- No user-configurable smart bucket ranges.
- No manual reorder of bucket sections.
- No persistent hide/show control for individual buckets beyond the transient section collapse/expand chevron.
- No per-group sort overrides.
- No grouped aggregate footers or calculations.
- No board, timeline, calendar, or gallery grouping behavior.
- No filter controls; issue #44 owns filtering.
- No conditional color controls.
- No Jira ingestion, Jira API, source configuration, credential, or AI provider changes.
- No database schema changes beyond storing the existing `ViewConfig.group` JSON in collection views.
- No mixed-entity collection grouping.
- No server-side grouping; the current collection body groups the loaded local item array.
## Design spec

### Information architecture

This enhancement stays inside the existing Jira issue collection page and view-settings menu.
```plain text
Jira issues
└── Collection header
    ├── View chips
    └── View settings menu
        ├── Top sheet
        └── Group panel
            └── Group by popover
```
The `Group` top-sheet row already exists from the view-settings menu shell. Clicking it now shows functional controls instead of placeholder copy. The panel remains generic: it reads the active entity's groupable properties, reads `ViewConfig.group`, and patches only `group` when the user changes grouping.
### Group panel chrome

The panel keeps the shared sub-panel shell:
```plain text
┌─────────────────────────────────────────────┐
│  ←  Group                               [X] │
├─────────────────────────────────────────────┤
│  Group by                       Status   ›  │
│  Hide empty groups                       ⦿  │
│                                             │
│                            Remove grouping  │
└─────────────────────────────────────────────┘
```
The back arrow returns to the top sheet. The close button dismisses the whole menu. `Esc` follows the existing menu behavior and closes from any panel.
### Group by row

`Group by` is a button row, not a native select. It shows the current grouping value on the right:
- `None` when no grouping is active.
- The groupable property's label when grouping is active.
- `Unknown property` only as a safe fallback for malformed config that reaches render.
Clicking the row opens a nested popover anchored to the row. The outer view-settings menu stays open.
### Group by popover

The popover lists `None` first, then the active entity's groupable properties. Each property option shows the property's icon and label. The selected option shows a checkmark and accessible selected state.
```plain text
┌─────────────────────────────────────────────┐
│  —   None                              ✓    │
│  ◉   Status                                 │
│  👤  Assignee                               │
│  ◆   Priority                               │
│  🏷  Project key                            │
│  ⏱  Updated                                 │
└─────────────────────────────────────────────┘
```
Picking a row commits the config change and closes the nested popover. Picking `None` sets `ViewConfig.group.property` to `null` and leaves `hideEmptyGroups` unchanged.
### Hide empty groups

`Hide empty groups` uses the existing `Switch` primitive. It is enabled even when grouping is inactive so the user can set the preference before choosing a group property. The default is `true`.
When the switch is on, the body renders only buckets with at least one item. When off, the body renders every bucket from the active property's `bucketOrder()`, including sections with `0` items.
If a groupable property cannot provide a complete bucket order, empty buckets cannot be known reliably. In that case, render only buckets discovered from items and treat `hideEmptyGroups: false` as best effort. Jira's groupable properties in this issue must provide explicit bucket order where source metadata exists or a deterministic fallback order otherwise.
### Remove grouping

`Remove grouping` appears only when `ViewConfig.group.property` is not `null`. It clears the group property and has the same effect as choosing `None` in the popover.
The action is secondary and right-aligned at the bottom of the panel. It should not use destructive color; removing grouping changes view presentation only and does not delete data.
### Top-sheet summary

The top-sheet `Group` row shows the active group property label. If no grouping is active, it shows `None`.
If a persisted config references a stale property, normalization should clear it. If stale config still reaches the summary, use `Unknown property` and avoid crashes.
### Grouped body rendering

The collection display pipeline remains:
1. Filter.
2. Sort.
3. Group.
4. Render.
This issue implements the group pass. The body should sort items first, then partition the sorted item array into buckets for the active group property. Within each bucket, row order remains the sorted order.
When grouping is active, the body renders:
```plain text
▾ Status · To do                               4
  [ ] ISSUE-1  Title ...
  [ ] ISSUE-2  Title ...

▸ Status · Done                                0

▾ Status · In progress                         2
  [ ] ISSUE-3  Title ...
  [ ] ISSUE-4  Title ...
```
The exact header label can omit the property name if the design reads better in code, but the bucket label and count must be clear. Counts reflect the number of rows in that bucket after filter and sort.
The chevron communicates section state: expanded groups use the expanded chevron and show their rows; collapsed groups use the collapsed chevron and hide their rows while keeping the header and count visible. Collapse state is presentation-only, local to the current collection viewer session, and should reset when grouping is cleared or changed to another property. It must not be persisted into `ViewConfig.group`.
### Section header component

`SectionHeader` renders one bucket header with a chevron button for collapsing or expanding that bucket. It uses real OpenType small-caps:
```typescript
style={{ fontVariantCaps: "all-small-caps" }}
```
Do not use faux uppercase or Tailwind `uppercase` as a substitute. Pass mixed-case labels such as `In progress` and let the font render small-caps glyphs.
The header uses tokenized text, border, and spacing. The chevron/button is keyboard reachable and exposes the expanded/collapsed state with standard button semantics, but the header itself is not a row, is not selectable, and is skipped by row keyboard navigation.
### Bucket ordering

Bucket sections render in the active property's order:
- Categorical properties use the entity's declared option order.
- Jira status uses workflow-category order: `To do` → `In progress` → `Done`.
- Continuous properties use their smart-bucket order.
- Date freshness buckets render most recent first.
- Confidence buckets, when future entities add them, render descending: `High` → `Medium` → `Low`.
- Any bucket not explicitly ordered falls back to alphabetical by display label.
Items with missing values should still appear in a stable bucket, such as `Unassigned`, `No priority`, `No project`, or `No updated date`, depending on the property.
### Jira groupable properties

Initial Jira groupable properties:

Property id
Label
Kind
Bucket behavior
Order

`status`
Status
Categorical
Jira status or workflow category bucket
To do → In progress → Done, then declared status order within category if available

`assignee`
Assignee
Categorical
Assignee display name, plus `Unassigned`
Alphabetical by display name, `Unassigned` last unless entity metadata says otherwise

`priority`
Priority
Categorical
Jira priority name, plus `No priority`
Jira priority rank if available; otherwise declared priority order, then alphabetical fallback

`project_key`
Project key
Categorical
Project key, plus `No project`
Declared project order if available, then alphabetical

`updated_at_source`
Updated
Continuous date
`Today`, `Yesterday`, `This week`, `This month`, `Older`, plus `No updated date`
Most recent to oldest, missing last

Non-groupable Jira properties for this issue:
- `key`
- `title`
- `labels`
`labels` is excluded because multi-value grouping needs clearer product behavior than this issue should decide.
### Smart date buckets

`updated_at_source` buckets use the user's local timezone for day boundaries because the app is local-first and single-user. Bucket definitions:
- `Today`: timestamp is on the current local calendar date.
- `Yesterday`: timestamp is on the previous local calendar date.
- `This week`: timestamp is before yesterday and within the current local week.
- `This month`: timestamp is outside this week and within the current local month.
- `Older`: timestamp is before the current local month.
- `No updated date`: missing or invalid timestamp.
Tests should inject or pass a fixed `now` value so these boundaries are deterministic.
### Row rendering with grouped property hidden

When grouping is active, the active group property's cell is hidden from every row. This applies regardless of whether the property is configured as left or right in property visibility.
Hiding the grouped cell must not mutate `ViewConfig.propertyVisibility`. It is a render-time suppression only. If the user removes grouping, the property's row cell returns according to its saved visibility config.
### Selection and preview navigation

Grouping changes the visual body structure, but it does not change item identity. If a row is selected and still exists after grouping changes, it remains selected.
Preview navigation walks rows in the current displayed order. It must skip section headers, empty buckets, and rows hidden inside collapsed groups. `M of N` uses the count of displayed rows, not section headers.
For this issue, display order for navigation is the flattened list of expanded grouped buckets in section order, preserving sorted row order within each expanded bucket. When grouping is inactive, it is the sorted flat list. If the user collapses the group containing the selected row, selection should move to the nearest visible row in the flattened displayed order, or clear if no rows are visible.
### Empty, loading, and error states

Grouping does not change collection loading or fatal error states. If there are no items after filtering, the body uses the existing empty-state pattern.
If grouping is active and every bucket is empty, the body can render the existing empty state when `hideEmptyGroups` is on. When `hideEmptyGroups` is off, render empty section headers with `0` counts if the active property has a known bucket order.
Malformed group config should fall back to no grouping and log only safe details. The UI must not expose raw SQL, local paths, stack traces, Jira tokens, Jira payloads, or source-system secrets.
### Accessibility

- The group panel has a clear `Group` heading through `PanelHeader`.
- The `Group by` row is a button with the current value in its accessible name.
- The nested popover exposes options with accessible names and selected state.
- The `None` option is available by keyboard.
- `Hide empty groups` uses the existing switch semantics and label association.
- `Remove grouping` is keyboard reachable and announces its action.
- Section header chevrons are keyboard reachable buttons with accessible names such as `Collapse In progress` or `Expand Done` and accurate expanded state.
- Section headers are not row-navigation targets.
- Row navigation skips section headers.
- The group panel and grouped body have no axe violations in component tests.
## Tech spec

### Prerequisites and references

- Issue #37 and `context-human/specs/feature-collection-viewer-foundation.md` for the generic collection viewer, row/detail split, and Jira issue entity adapter.
- Issue #39 and `context-human/specs/enhancement-view-settings-menu-shell.md` for `ViewSettingsMenu`, `PanelHeader`, typed `ViewConfig`, top-sheet summary, and config patch persistence.
- Issue #40 and `context-human/specs/enhancement-layout-sub-panel.md` for active config driving body display and preview navigation.
- Issue #41 and `context-human/specs/enhancement-property-visibility-sub-panel.md` for render-time property visibility and row cell suppression patterns.
- Issue #42 and `context-human/specs/enhancement-sort-sub-panel-multi-sort.md` for active sort metadata, `sortCollectionItems`, and display-order alignment.
- `context-agent/collections/collection-read.md`, especially `Group sub-panel`, `Body`, smart buckets, persistence, and entity contract.
- `context-agent/design-system.md` for collection menu behavior, small-caps rules, `Switch`, `Popover`, and design-system maintenance.
- ADR-002 for Tauri + React architecture.
- ADR-003 for local-first single-user behavior.
- ADR-004 for SQLite as the primary local store.
- ADR-008 for view data in SQLite and active-view preference in the preferences file.
### Data model

`ViewConfig.group` already uses this shape from the menu shell:
```typescript
export type GroupConfig = {
  property: string | null;
  hideEmptyGroups: boolean;
};
```
No database table is needed. The active collection view persists the JSON config through `collectionViewSave`, as existing layout, property visibility, and sort controls do.
Expected defaults:
```typescript
group: {
  property: null,
  hideEmptyGroups: true,
}
```
Normalize `group` strictly:
- Keep `property` only when it is `null` or a current groupable property id.
- Clear stale, non-string, or non-groupable property ids to `null`.
- Coerce missing or invalid `hideEmptyGroups` to `true`.
- Preserve `hideEmptyGroups` when clearing stale property ids.
### Entity contract changes

Add groupable property metadata to the generic entity contract. One clear shape is:
```typescript
export type BucketKey = string;

export type BucketDefinition = {
  key: BucketKey;
  label: string;
  emptyLabel?: string;
};

export type GroupableProperty = {
  property: EntityProperty;
  bucketKeyFor: (item: TItem, context?: BucketContext) => BucketKey;
  bucketLabelFor?: (key: BucketKey) => string;
  bucketOrder: (items?: TItem[], context?: BucketContext) => BucketDefinition[];
};

export type BucketContext = {
  now?: Date;
  locale?: string;
  timeZone?: string;
};

export type EntityContract = {
  // existing fields...
  groupableProperties?: GroupableProperty[];
};
```
The exact generic names may follow the current codebase, but the contract must let each entity provide:
- Which properties are groupable.
- How to compute a bucket key for one item.
- How to order and label buckets.
Keep `groupableProperties` optional. If an entity omits it, the group panel should show a safe empty state such as `No groupable properties available`, disable `Group by`, and leave body rendering flat.
### Jira group metadata

Update `src/entities/jira-issue/properties.ts` or the current Jira entity adapter location to declare groupable metadata for:
- `status`
- `assignee`
- `priority`
- `project_key`
- `updated_at_source`
Free-form properties stay non-groupable:
- `key`
- `title`
- `labels`
Use existing Jira list item fields where possible. If priority rank, project order, or status workflow metadata is not available in current list data, use deterministic fallback order and document the limitation in code comments or context notes.
### Bucket helper module

Add `src/views/collection/bucket.ts`.
Expected public API:
```typescript
export type BucketedGroup = {
  key: string;
  label: string;
  items: TItem[];
};

export function bucketCollectionItems(args: {
  items: TItem[];
  entity: EntityContract;
  group: GroupConfig;
  hideEmptyGroups?: boolean;
  context?: BucketContext;
}): BucketedGroup[];

export function flattenBucketedGroups(
  groups: BucketedGroup[],
  options?: { collapsedGroupKeys?: ReadonlySet },
): TItem[];
```
Behavior:
1. If `group.property` is `null`, return one unlabelled or pass-through representation as needed by callers, or let callers skip grouping.
2. Find the active groupable property by id.
3. Build ordered bucket definitions from `bucketOrder(items, context)`.
4. Assign each item to `bucketKeyFor(item, context)`.
5. Preserve input order within each bucket. The input should already be sorted.
6. Include unknown bucket keys after known bucket definitions, sorted by display label.
7. Hide empty buckets when `hideEmptyGroups` is true.
8. Include known empty buckets when `hideEmptyGroups` is false.
9. Return a new data structure without mutating the input array.
10. Keep collapse state out of the bucketing result; callers pass collapsed bucket keys only when flattening for the currently visible row order.
Add helper functions for smart date bucketing:
```typescript
export function bucketUpdatedAtSource(value: string | null | undefined, now: Date): UpdatedAtBucketKey;
export function updatedAtBucketOrder(): BucketDefinition[];
```
These can live in the Jira property module if they are Jira-specific, but keep the generic bucketing engine entity-agnostic.
### Group panel component

Update `src/views/collection/menu/sub-panels/GroupPanel.tsx`.
Suggested props:
```typescript
type GroupPanelProps = {
  entity: EntityContract;
  config: ViewConfig;
  onPatchConfig: (config: ViewConfig) => void | Promise;
  onBack: () => void;
  onClose: () => void;
};
```
`GroupPanel` responsibilities:
- Render the shared `PanelHeader` with title `Group`.
- Render `Group by` row with current summary.
- Render `Hide empty groups` switch.
- Render `Remove grouping` only when grouping is active.
- Patch only `group` via `patchViewConfig`.
- Preserve layout, property visibility, sort, filters, and conditional color.
- Show a safe empty state if no groupable properties exist.
### Group by popover component

Add `src/views/collection/GroupByPopover.tsx` or place it under `src/views/collection/menu/sub-panels/GroupByPopover.tsx` if current menu conventions prefer sub-panel-local files. The issue names `src/views/collection/GroupByPopover.tsx`; use that path unless existing code clearly keeps nested popovers next to their panels.
Suggested props:
```typescript
type GroupByPopoverProps = {
  groupableProperties: GroupableProperty[];
  value: string | null;
  onSelect: (propertyId: string | null) => void;
};
```
Responsibilities:
- Render `None` first.
- Render one option per groupable property.
- Show icon, label, and selected checkmark.
- Close after selection.
- Expose accessible selected state.
### Section header component

Add `src/views/collection/SectionHeader.tsx`.
Suggested props:
```typescript
type SectionHeaderProps = {
  bucketKey: string;
  label: string;
  count: number;
  collapsed: boolean;
  onToggleCollapsed: (bucketKey: string) => void;
};
```
Responsibilities:
- Render a header above each bucket with a chevron button that toggles collapse state.
- Use real OpenType small-caps with `fontVariantCaps: "all-small-caps"`.
- Show `count` with tabular numerals.
- Use the collapsed chevron when collapsed and the expanded chevron when expanded.
- Expose an accessible label and expanded state for the chevron button.
- Use tokenized text, border, and spacing.
- Avoid all-uppercase source strings.
### Body and display-order wiring

Update `src/views/collection/Body.tsx` to honor grouping after sorting.
Suggested prop additions:
```typescript
type BodyProps = {
  items: TItem[];
  entity: EntityContract;
  properties?: PropertyVisibilityConfig[];
  sort?: SortLevelConfig[];
  group?: GroupConfig;
  selectedId: string | null;
  density?: ViewDensity;
  onSelect: (item: TItem) => void;
};
```
Behavior:
1. Sort the items with `sortCollectionItems(items, entity, activeConfig.sort)`.
2. If grouping is inactive, render the sorted flat list as today.
3. If grouping is active, call `bucketCollectionItems` with the sorted items.
4. Track a local `Set` of collapsed bucket keys for the active group property.
5. Render `SectionHeader` before each bucket with collapsed state and a toggle handler.
6. Render the bucket's rows in preserved sorted order only when the bucket is expanded.
7. Pass the active grouped property id to `Row` so it can suppress that cell.
8. Reset collapsed bucket state when grouping is cleared or the group property changes.
If issue #42 already moved display-order computation into `useCollectionViewer` or another helper, keep that architecture. The important invariant is one shared ordered item array or one shared grouped representation drives rows, preview navigation, and position text. When groups are collapsed, the flattened row list for preview navigation includes only rows in expanded groups; section headers and hidden rows are skipped.
### Row rendering change

Update `src/views/collection/Row.tsx` or the current row renderer so it can hide the grouped property cell at render time.
Suggested prop:
```typescript
groupedPropertyId?: string | null;
```
When rendering visible properties, skip a property whose id matches `groupedPropertyId`. Do not change the persisted property visibility config. Do not hide other cells.
### Collection viewer page wiring

`CollectionViewerPage` should:
1. Load issues, views, and preferences as it does after issues #37-#42.
2. Determine the active view.
3. Normalize active view config.
4. Pass `entity`, `config`, and patch handler into `ViewSettingsMenu` / `GroupPanel`.
5. Pass `activeConfig.group` into body display order.
6. Derive preview navigation from the same displayed row order used by the body.
7. Preserve selected item when grouping changes and the item still exists.
8. Keep existing loading, empty, error, density, preview, property visibility, and sort behavior.
If the current page already exposes `displayItems` from `useCollectionViewer`, update that hook so grouping can produce both:
- A grouped render model for `Body`.
- A flattened row list for selection, preview navigation, and `M of N`.
### View settings menu wiring

Update `ViewSettingsMenu` to pass `entity`, normalized `config`, and `handlePatchConfig` into `GroupPanel`, matching the pattern used by `LayoutPanel`, `PropertyVisibilityPanel`, and `SortPanel`.
Update `summarizeViewConfig` if needed so the top-sheet `Group` row reads the active groupable property label or `None`.
### Error handling and stale config

Group config is user-owned JSON stored in SQLite. Treat it as untrusted input:
- Do not assume the property still exists.
- Do not assume the property is groupable.
- Do not assume `hideEmptyGroups` is a boolean.
- Do not throw from render when config is invalid.
- Prefer repair during normalization and save the repaired config the next time the user changes the active view.
If grouping computation throws for one malformed item, prefer assigning that item to an `Unknown` bucket over crashing the whole page. Log only safe details.
### Design-system maintenance

Update `context-agent/design-system.md` in the implementation PR if the code changes the shared collection menu pattern, nested popover pattern, section header pattern, row rendering contract, or display-order contract. At minimum, the current design-system doc lists `Group` as `Coming in #43`; implementation should update that status when this enhancement ships.
### Testing plan

**Unit and component tests**
- `normalizeViewConfig` clears stale or non-groupable `group.property` values.
- `normalizeViewConfig` defaults invalid `hideEmptyGroups` to `true`.
- `summarizeViewConfig` returns a group property label when grouping is active and `None` when inactive.
- `bucketCollectionItems` partitions a mixed-status fixture into documented section order.
- `bucketCollectionItems` preserves input order within each bucket.
- `bucketCollectionItems` includes empty known buckets when `hideEmptyGroups` is false.
- `bucketCollectionItems` hides empty buckets when `hideEmptyGroups` is true.
- `bucketCollectionItems` puts unknown bucket keys after known ordered buckets.
- Smart date bucketing assigns fixed timestamps to `Today`, `Yesterday`, `This week`, `This month`, and `Older` with a fixed `now`.
- Jira group metadata excludes `key`, `title`, and `labels`.
- `GroupPanel` renders `Group by`, `Hide empty groups`, and no `Remove grouping` when inactive.
- `GroupPanel` shows `Remove grouping` when active.
- Choosing a property patches only `group.property` and preserves unrelated config sections.
- Choosing `None` clears only `group.property` and preserves `hideEmptyGroups`.
- Toggling `Hide empty groups` patches only `group.hideEmptyGroups`.
- `GroupByPopover` renders `None` first and groupable properties with icons, labels, and selected state.
- `SectionHeader` uses `fontVariantCaps: "all-small-caps"`, renders accurate count text, and exposes a chevron button with expanded/collapsed state.
- `Body` renders section headers and rows in grouped order.
- `Body` collapses and expands bucket rows when the user toggles a section chevron.
- `Body` renders flat rows when grouping is inactive.
- `Row` hides the grouped property's cell and preserves all other visible cells.
- `ViewSettingsMenu` opens `Group` and no longer shows `Coming in #43`.
- The group panel and grouped body have no axe violations.
**Page integration tests**
- `CollectionViewerPage` passes active group config to the body.
- Changing group property through the menu saves the active view config.
- Grouping by `status` renders `To do`, `In progress`, and `Done` sections with correct counts.
- Toggling a section chevron collapses that group's rows while leaving the header and count visible, then expands them again.
- Toggling `Hide empty groups` changes visible empty sections without changing the selected group property.
- Removing grouping returns to the flat sorted list.
- Selection stays selected when grouping changes and the item still exists.
- Preview `M of N`, up/down buttons, full-page preview, and keyboard navigation use the flattened grouped row order.
- Existing layout, property visibility, and sort tests continue to pass.
**Playwright / end-to-end**
- Open the Jira viewer and open view settings.
- Open `Group`.
- Open `Group by`, choose `Status`, and see sections appear with counts.
- Collapse and expand a status section with its chevron.
- Verify grouped rows no longer show the `Status` cell.
- Toggle `Hide empty groups` off and see empty buckets appear when deterministic fixture data supports an empty status bucket.
- Toggle `Hide empty groups` on and see empty buckets disappear.
- Choose `Updated` and see smart date bucket labels.
- Choose `None` and see the flat list return.
- Reload and verify the active view keeps its group config if deterministic collection-view persistence is available in the harness.
If the e2e harness cannot seed deterministic Jira rows or cannot exercise real Tauri persistence, keep focused unit/page coverage and document the manual verification path.
### Verification commands

Run targeted checks first, then broader checks:
```bash
npm test -- bucket
npm test -- ViewConfig
npm test -- GroupPanel
npm test -- GroupByPopover
npm test -- SectionHeader
npm test -- Body
npm test -- Row
npm test -- ViewSettingsMenu
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

- [ ] **Story: Add reusable group metadata and bucket helpers**
	- **Description:** Give collection entities a generic way to declare groupable properties and use those declarations to bucket a sorted item array.
	- **Acceptance criteria:**
		- [ ] `EntityContract` supports optional groupable property metadata.
		- [ ] Groupable metadata includes a property reference, `bucketKeyFor(item)`, and `bucketOrder()`.
		- [ ] Jira issue entity declares groupable metadata for `status`, `assignee`, `priority`, `project_key`, and `updated_at_source`.
		- [ ] Jira issue entity keeps `key`, `title`, and `labels` non-groupable.
		- [ ] `bucketCollectionItems` partitions items by the active group property.
		- [ ] Bucket helpers preserve sorted order within buckets and do not mutate input arrays.
		- [ ] Tests cover categorical buckets, unknown buckets, empty buckets, ordering, and immutability.
	- **Dependencies:** Existing entity contract and issue #42 display-order helpers.
	- [ ] **Task: Extend collection entity types**
		- Add groupable property metadata types and optional `groupableProperties` to the entity contract.
	- [ ] **Task: Add Jira groupable metadata**
		- Define Jira bucket functions and bucket orders for status, assignee, priority, project key, and updated date.
	- [ ] **Task: Add shared bucket module**
		- Implement `bucketCollectionItems`, unknown-bucket handling, empty-bucket handling, and `flattenBucketedGroups` in `src/views/collection/bucket.ts`.
	- [ ] **Task: Add bucket helper tests**
		- Cover status order, date buckets, empty bucket visibility, unknown keys, preserved row order, and immutable behavior.
- [ ] **Story: Normalize and patch active group config safely**
	- **Description:** Treat persisted `ViewConfig.group` as user-owned JSON and keep it valid for the current entity.
	- **Acceptance criteria:**
		- [ ] Normalization keeps only `null` or current groupable property ids.
		- [ ] Normalization clears stale or non-groupable property ids to `null`.
		- [ ] Normalization defaults invalid `hideEmptyGroups` to `true`.
		- [ ] Group summary returns the active property label or `None`.
		- [ ] Pure helpers can set group property, remove grouping, and toggle empty-bucket visibility.
		- [ ] Group patches preserve unrelated config fields.
		- [ ] Tests cover stale config, invalid config, summaries, and helper behavior.
	- **Dependencies:** Story 1 groupable metadata.
	- [ ] **Task: Update ****`normalizeViewConfig`**
		- Validate `group.property` against current entity groupable metadata and repair invalid values.
	- [ ] **Task: Update config summaries**
		- Ensure top-sheet group summary uses current groupable property labels and safe fallback behavior.
	- [ ] **Task: Add group config helpers**
		- Implement helpers for setting group property, removing grouping, and toggling `hideEmptyGroups`.
	- [ ] **Task: Add normalization and helper tests**
		- Cover valid, stale, duplicate-edge, missing, and malformed group config cases.
- [ ] **Story: Build the functional Group panel and popover**
	- **Description:** Replace placeholder copy with grouping controls bound to the active view config.
	- **Acceptance criteria:**
		- [ ] The panel renders `PanelHeader` with title `Group`.
		- [ ] The panel renders `Group by` with current value and chevron.
		- [ ] `GroupByPopover` lists `None` first, then every groupable property.
		- [ ] Each property option shows icon, label, and selected state.
		- [ ] Choosing a property patches `ViewConfig.group.property`.
		- [ ] Choosing `None` clears `ViewConfig.group.property`.
		- [ ] `Hide empty groups` switch patches `ViewConfig.group.hideEmptyGroups`.
		- [ ] `Remove grouping` appears only when grouping is active and clears the group property.
		- [ ] Tests cover rendering, selection, toggle behavior, remove behavior, no-groupable empty state, and accessibility.
	- **Dependencies:** Stories 1-2.
	- [ ] **Task: Update ****`GroupPanel`**** props and rendering**
		- Accept entity, config, and patch callback; render controls from normalized `config.group`.
	- [ ] **Task: Build ****`GroupByPopover`**
		- Add the nested popover with `None`, groupable options, selected checkmark, and accessible selected state.
	- [ ] **Task: Wire config patching**
		- Patch only `group` and preserve layout, property visibility, sort, filters, and conditional color.
	- [ ] **Task: Wire ****`ViewSettingsMenu`**
		- Pass active entity, normalized config, and patch callback into `GroupPanel`.
	- [ ] **Task: Add panel and popover tests**
		- Cover user interactions, patch payloads, empty state, selected state, and axe.
- [ ] **Story: Render grouped collection sections**
	- **Description:** Make the collection body render section headers and bucketed rows after sorting.
	- **Acceptance criteria:**
		- [ ] `Body` applies grouping after sort and before row render.
		- [ ] Grouped body renders one `SectionHeader` per visible bucket.
		- [ ] Section headers show the bucket label, accurate count, and collapse/expand chevron.
		- [ ] Section chevrons collapse and expand their bucket rows without changing group config.
		- [ ] Empty buckets are hidden when `hideEmptyGroups` is true.
		- [ ] Empty buckets render with count `0` when `hideEmptyGroups` is false and the entity provides bucket order.
		- [ ] Row order within each bucket follows the active sorted order.
		- [ ] Flat body rendering remains unchanged when grouping is inactive.
		- [ ] Tests cover grouped rendering, empty buckets, counts, chevron collapse/expand behavior, and flat fallback.
	- **Dependencies:** Stories 1-2 and issue #42 sort helper.
	- [ ] **Task: Add ****`SectionHeader`**
		- Create `src/views/collection/SectionHeader.tsx` with real OpenType small-caps, count rendering, and an accessible chevron toggle.
	- [ ] **Task: Thread group config into ****`Body`**
		- Add group props, call the shared bucketing helper after sort, and maintain local collapsed bucket state.
	- [ ] **Task: Render section headers and bucket rows**
		- Map bucket groups to header + rows, preserving sorted row order inside each expanded group and hiding rows inside collapsed groups.
	- [ ] **Task: Add body rendering tests**
		- Cover section order, count accuracy, hidden empty buckets, shown empty buckets, chevron collapse/expand behavior, and inactive flat render.
- [ ] **Story: Hide grouped row cells and align preview navigation**
	- **Description:** Suppress the grouped property's row cell and keep selection/preview behavior based on row order, not headers.
	- **Acceptance criteria:**
		- [ ] `Row` accepts the active grouped property id.
		- [ ] `Row` hides only the active grouped property's cell.
		- [ ] Render-time cell hiding does not mutate `ViewConfig.propertyVisibility`.
		- [ ] Removing grouping restores the cell according to saved visibility config.
		- [ ] Preview navigation skips section headers, empty buckets, and rows hidden inside collapsed groups.
		- [ ] `M of N` counts rows only.
		- [ ] Selection is preserved when grouping changes and the selected item still exists.
		- [ ] Tests cover grouped-cell hiding, selection preservation, preview order, collapsed-section navigation, and keyboard navigation order.
	- **Dependencies:** Story 4 and issue #40 preview navigation.
	- [ ] **Task: Update row rendering**
		- Add `groupedPropertyId` to the row renderer and skip that property while preserving all other visible cells.
	- [ ] **Task: Flatten grouped display order for navigation**
		- Ensure `CollectionViewerPage` or `useCollectionViewer` derives preview navigation from flattened bucket rows, excluding rows inside collapsed groups.
	- [ ] **Task: Preserve selection across group changes**
		- Keep selected id stable when regrouping and clear only when the item is no longer in the displayed row set.
	- [ ] **Task: Add row and navigation tests**
		- Cover hidden cell behavior, restored cell behavior, `M of N`, collapsed groups, arrow navigation, and full-page `j` / `k` navigation.
- [ ] **Story: Verify and document the enhancement**
	- **Description:** Add focused coverage, run relevant checks, and update durable context for the shipped Group panel.
	- **Acceptance criteria:**
		- [ ] Unit and component tests cover bucket helpers, config normalization, panel controls, grouped body rendering, section chevron collapse/expand behavior, row-cell hiding, and navigation order.
		- [ ] Playwright covers group by status, section collapse/expand, empty-bucket toggle, smart date grouping if deterministic data is available, and return to `None`.
		- [ ] `npm test` passes.
		- [ ] `npm run lint` passes.
		- [ ] `npm run build` passes.
		- [ ] Any skipped e2e or manual Tauri checks are documented with a reason.
		- [ ] `context-agent/design-system.md` no longer lists `Group` as `Coming in #43` after implementation ships.
	- **Dependencies:** Stories 1-5.
	- [ ] **Task: Add focused test coverage**
		- Add or update tests for `bucket`, `ViewConfig`, `GroupPanel`, `GroupByPopover`, `SectionHeader`, `Body`, `Row`, `ViewSettingsMenu`, and `CollectionViewerPage`.
	- [ ] **Task: Add Playwright coverage**
		- Extend the collection viewer e2e flow with deterministic fixture data if the harness supports it.
	- [ ] **Task: Run verification**
		- Run targeted tests, then `npm test`, `npm run lint`, and `npm run build`.
	- [ ] **Task: Update durable context**
		- Update `context-agent/design-system.md` and, if useful, `context-agent/collections/collection-read.md` implementation notes to reflect the shipped functional Group panel.
## Open questions and implementation notes

- Jira status order depends on what the current local list item exposes. If true workflow status metadata is unavailable, group by status category first (`To do`, `In progress`, `Done`) and use stable alphabetical order within each category.
- Jira priority rank may not be present in current projected rows. If only display names exist, use declared priority metadata if available; otherwise use alphabetical fallback and note that true Jira rank can improve later.
- Project order should use configured project order if available from source settings. If that is not easy to access in the entity adapter, use alphabetical project keys.
- Assignee grouping should include an `Unassigned` bucket. Keep it last unless the entity contract later supports a user-defined person order.
- Date smart buckets use local calendar boundaries. Tests must inject a fixed `now` so they do not fail at midnight, month boundaries, or timezone changes.
- `labels` is intentionally non-groupable because multi-select grouping can mean "one row appears in many buckets" or "group by exact label set." Defer that product choice.
- If issue #42's display-order helper shape differs from this spec, keep the implemented architecture and preserve the invariant: body rows, preview navigation, and `M of N` must use the same order.
- Browser-only Playwright may not exercise real Tauri SQLite persistence. If so, verify persistence through component/page tests and document the limitation for e2e.