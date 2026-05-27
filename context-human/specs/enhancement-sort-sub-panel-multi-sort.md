---
created: 2026-05-27
last_updated: 2026-05-27
status: complete
issue: 42
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Sort sub-panel with multi-sort

## What

`hm` needs the collection view-settings `Sort` sub-panel to become a real control surface. This enhancement replaces the `Coming in #42` placeholder with multi-level sort controls for the active collection view.
After this enhancement, a user can open the Jira issue collection, open view settings, drill into `Sort`, and add one or more sort levels. Each level has a drag handle, position number, property picker, ascending/descending toggle, and remove button. The collection body re-sorts immediately after any change. Sort levels apply in stack order: level 1 is the primary sort, level 2 breaks ties, level 3 breaks ties left by level 2, and so on.
The active view stores sort levels in the existing typed `ViewConfig.sort` array. Clearing all sort levels returns the body to the entity's `defaultSort`. Selection is preserved while sort changes; the selected row stays selected and only moves to its new position.
## Why

Named views, layout controls, and property visibility give users places to shape a collection, but they still cannot control row order. That leaves common work modes awkward: Elena cannot scan by status and then update time, Priya cannot bring high-priority work to the top, and Tarek cannot order issues by assignee or key while reading details.
Multi-sort is the next useful view-setting slice because order is central to how people scan issue lists. It also proves that active-view config can drive the collection display order, preview navigation order, and top-sheet summaries from one shared sort helper. Once this ships, every collection list can respect saved sort rules without adding entity-specific branches to the generic body.
## Personas

- **Elena: EM** — wants to group her attention by issue status, then see the most recently updated items within each status.
- **Priya: PM** — wants to sort Jira issues by priority and updated time while preparing roadmap or status context.
- **Tarek: Team member** — wants to sort by assignee or issue key while exploring unfamiliar work, then keep his selected row as he changes sort priority.
- **Future collection implementer** — needs reusable sort config, comparator plumbing, and panel controls that work for later GitHub issues, pull requests, hygiene suggestions, and audit entries.
- **Maintainer** — needs tested sort helper behavior and display-order consistency before grouping and filtering start changing the same collection pipeline.
## Narratives

### Elena sorts status ties by update time

Elena opens `Jira issues` and picks her `Team triage` view. The list is still in the default Jira order, so she opens view settings and clicks `Sort`. The panel shows no active sort levels and an `+ Add sort` button.
She adds `Status` as the first sort level and keeps it ascending. Then she adds `Updated` as the second level and switches it to descending. The list reorders while the menu stays open: statuses become the primary buckets, and items inside the same status show newest updates first.
Elena clicks back to the top sheet and sees the sort summary now reads `Status ↑`. The full detail of the stack stays in the `Sort` panel, while the top sheet gives a compact cue that the view is sorted.
### Priya changes sort priority by dragging levels

Priya opens a saved view that sorts by `Updated ↓` and then `Priority ↑`. For her review, priority should lead. She opens the sort panel and drags the `Priority` row above `Updated`.
The position numbers update from `1.` and `2.` to match the new priority. The body re-sorts immediately, and the selected row remains selected in its new location. Priya does not need to click Apply or reopen detail.
### Tarek removes sort and returns to the default order

Tarek adds several sort levels while exploring the issue list. After a few minutes, he wants to return to the product default: newest source updates first for Jira issues. He opens `Sort` and clicks `Clear all sort`.
The sort rows disappear, `+ Add sort` becomes available again, and the body returns to the Jira entity's default sort. The top-sheet sort summary returns to `None`.
## User stories

**Elena creates a multi-level sort**
- Elena can open the `Sort` sub-panel from the existing view-settings menu.
- Elena can see one row for each active sort level.
- Elena can add a sort level with `+ Add sort`.
- Elena can choose the property for each level from sortable entity properties.
- Elena can toggle each level between ascending and descending.
- Elena sees the body re-sort immediately after adding a level, changing a property, or changing direction.
- Elena sees the top-sheet summary show the first sort level and direction.
**Priya reorders sort priority**
- Priya can drag sort levels to change priority.
- Priya sees level position numbers update after reordering.
- Priya sees the collection order update to match the new priority stack.
- Priya can reorder with keyboard-accessible drag behavior where the existing drag pattern supports it.
- Priya can remove a single sort level without clearing the others.
**Tarek clears sort safely**
- Tarek can click `Clear all sort` when at least one level is active.
- Tarek does not see `Clear all sort` when no sort levels exist.
- Tarek sees the collection return to the entity's `defaultSort` after clearing sort.
- Tarek keeps the same selected row when sort changes, as long as the row still exists.
- Tarek sees `+ Add sort` disable when every sortable property is already used.
**Future collection implementer reuses the model**
- Future implementer can mark which entity properties are sortable.
- Future implementer can provide property comparators without changing `Body` or `SortPanel` internals.
- Future implementer can rely on one display-order helper for `Body`, preview navigation, and position text.
- Future implementer can add a richer property picker later without changing the stored `ViewConfig.sort` shape.
## Goals

- Replace `SortPanel` placeholder content with functional multi-sort controls.
- Render one row per active `ViewConfig.sort` level.
- Show drag handle, position number, property select, direction toggle, and remove button for each level.
- Add `+ Add sort`, disabled when every sortable property is already in the stack.
- Add `Clear all sort`, visible only when at least one sort level exists.
- Persist sort changes to the active view through the existing config patch path.
- Apply sort changes immediately to the collection body.
- Preserve selection while rows reorder.
- Use a shared comparator helper so body order, preview navigation, and `M of N` position all match.
- Fall back to the entity's `defaultSort` after all configured sort levels compare equal, or when no sort levels are active.
- Add entity-level property comparators for Jira issue properties that are safe to sort.
- Keep stale or invalid persisted sort properties from crashing the menu or body.
- Use existing design-system tokens, Radix primitives, and the `@dnd-kit` sortable setup already introduced by property visibility.
- Cover comparator behavior, panel interactions, config persistence, body sorting, preview navigation order, and end-to-end sort behavior with tests.
## Non-goals

- No formula properties.
- No relation-property sorting.
- No per-group sort overrides.
- No grouped body rendering; issue #43 owns grouping.
- No filter controls; issue #44 owns filtering.
- No conditional color controls.
- No changes to Jira ingestion, Jira API calls, credentials, source configuration, or AI providers.
- No database schema changes beyond storing the existing `ViewConfig.sort` JSON in collection views.
- No mixed-entity collection sorting.
- No server-side sorting for this issue; the current collection body sorts the loaded local item array.
- No custom null-placement UI. Entity comparators define safe null handling.
## Design spec

### Information architecture

This enhancement stays inside the existing Jira issue collection page and view-settings menu.
```plain text
Jira issues
└── Collection header
    ├── View chips
    └── View settings menu
        ├── Top sheet
        └── Sort panel
```
The `Sort` top-sheet row already exists from the view-settings menu shell. Clicking it now shows functional controls instead of placeholder copy. The panel remains generic: it reads the active entity's sortable properties, reads `ViewConfig.sort`, and patches only `sort` when the user makes changes.
### Sort panel chrome

The panel keeps the shared sub-panel shell:
```plain text
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
The back arrow returns to the top sheet. The close button dismisses the whole menu. `Esc` follows the existing menu behavior and closes from any panel.
### Empty sort state

When the active view has no sort levels, the panel shows concise empty text and the add button:
```plain text
No sort applied. Rows use the default order for this collection.

+ Add sort
```
Do not show an empty list frame. Do not show `Clear all sort` in this state.
### Sort level row

Each level row contains, left to right:
- A drag handle labelled `Reorder sort level {position}`.
- A position label, such as `1.` or `2.`.
- A property picker.
- A direction toggle.
- A remove button labelled `Remove sort level {position}` or `Remove {property label} sort`.
Rows use the same compact menu rhythm as the property visibility panel: tokenized borders, small text, and hover states that do not introduce new colors.
### Property picker

The Jira issue property list is short enough for a flat select. The select options should include sortable properties only. For Jira issues, the initial sortable set should include:
- `Key`
- `Title`
- `Status`
- `Assignee`
- `Updated`
- `Priority`
- `Project key`
`Labels` should remain unsorted unless implementation defines a clear comparator, such as first label then count. Prefer excluding it for this issue if that behavior is ambiguous.
A property can appear only once in the sort stack. If a row currently uses `Status`, other rows should not offer `Status` as an available replacement unless selecting the current row's existing value. This prevents duplicate sort levels that would never add useful tie-breaking behavior.
If a persisted sort level references a stale property, normalization should drop it before rendering. If a stale property reaches the summary or panel, show safe fallback text and avoid crashes.
### Direction toggle

The direction control is a single button, not two separate buttons. It flips between:
- `↑ Asc`
- `↓ Desc`
The visible label shows the current direction. A tooltip can show the alternate action, such as `Switch to descending` when the current direction is ascending. If the existing tooltip pattern is cumbersome, use an `aria-label` that names the action and keep the visible label simple.
### Add sort

`+ Add sort` appends a new level using the first sortable property that is not already in the stack. The default direction is `asc`, unless the entity provides a property-specific preferred default. For Jira `Updated`, `desc` is acceptable if implementation adds explicit metadata; otherwise use `asc` consistently and let the user toggle it.
The button disables when every sortable property is already used. Disabled copy or tooltip should be brief, such as `All sortable properties are already used`.
### Clear all sort

`Clear all sort` removes all levels. It appears only when at least one level is active. It should sit at the bottom-right of the panel body so it reads as a secondary destructive action, not the primary path.
Clearing sort does not clear row selection or close previews. It returns display order to `entity.defaultSort`.
### Drag reorder

Drag-and-drop reorder uses the existing `@dnd-kit/core` and `@dnd-kit/sortable` dependency set. Reuse the property visibility panel's sensor and handle patterns where possible.
Pointer drag starts from the handle, not the whole row. Keyboard drag should work with the same accessible pattern used by property visibility. Reordering patches only `sort` and preserves layout, property visibility, group, filters, and conditional color.
### Top-sheet summary

The top-sheet summary remains compact. It shows only the first sort level plus direction, such as `Status ↑` or `Updated ↓`. If no levels exist, it shows `None`.
This is intentionally not a full stack summary. The detailed stack lives in the sub-panel.
### Body order and preview order

The active view's sort stack determines the collection display order. The same sorted item array must drive:
- Rows rendered by `Body`.
- Side and bottom detail navigation.
- Full-page preview navigation.
- `M of N` position text.
- Keyboard navigation through rows.
This avoids a confusing state where rows appear in one order but preview up/down moves through a different order.
### Accessibility

- The panel has a clear `Sort` heading through `PanelHeader`.
- Drag handles have accessible names and keyboard support consistent with property visibility.
- Position numbers are visible and available to assistive tech.
- Property selects have labels that include the level number, such as `Sort property for level 1`.
- Direction toggles announce the current value and action.
- Remove buttons include either the level number or property label.
- `+ Add sort` and `Clear all sort` are keyboard reachable.
- The disabled add button communicates why it is disabled.
- The panel has no axe violations in component tests.
## Tech spec

### Prerequisites and references

- Issue #37 and `context-human/specs/feature-collection-viewer-foundation.md` for the generic collection viewer, row/detail split, and Jira issue entity adapter.
- Issue #39 and `context-human/specs/enhancement-view-settings-menu-shell.md` for the menu shell, typed `ViewConfig`, top-sheet summary, and panel navigation.
- Issue #40 and `context-human/specs/enhancement-layout-sub-panel.md` for active config driving body display and preview navigation.
- Issue #41 and `context-human/specs/enhancement-property-visibility-sub-panel.md` for `@dnd-kit` drag patterns and active-view property config wiring.
- `context-agent/collections/collection-read.md`, especially `Sort sub-panel`, `Body`, `Persistence`, and `Entity contract`.
- `context-agent/design-system.md` for collection menu behavior and the UI maintenance contract.
- ADR-002 for the Tauri + React architecture.
- ADR-003 for local-first single-user behavior.
- ADR-004 for SQLite as the primary local store.
- ADR-008 for view data in SQLite and active-view preference in the preferences file.
### Data model

`ViewConfig.sort` already uses this shape:
```typescript
export type SortDirection = "asc" | "desc";

export type SortLevelConfig = {
  property: string;
  direction: SortDirection;
};
```
No new database table is needed. The active collection view persists the JSON config through `collectionViewSave`, as existing layout and property visibility controls do.
Normalize `sort` more strictly than the current permissive parsing:
- Keep only rows with a current sortable property id.
- Keep only valid directions.
- Drop duplicate properties after the first valid occurrence.
- Preserve valid persisted order.
- Do not synthesize default sort levels. An empty array means `entity.defaultSort`.
### Entity contract changes

Add sortable property metadata to the generic entity contract. One clear shape is:
```typescript
export type PropertyComparator = (a: TItem, b: TItem) => number;

export type SortableProperty = {
  property: TProperty;
  compare: PropertyComparator;
  defaultDirection?: SortDirection;
};

export type EntityContract = {
  // existing fields...
  sortableProperties?: SortableProperty[];
};
```
Keep `sortableProperties` optional so existing tests and future entities do not need immediate migration. If an entity omits it, the sort panel should show a safe empty state such as `No sortable properties available` and `Body` should use `defaultSort`.
For Jira issues, define comparators in or near `src/entities/jira-issue/compare.ts`:
- `key`: string compare, null/empty last if needed.
- `title`: string compare.
- `status`: string compare.
- `assignee`: display-name string compare with unassigned last.
- `updated_at_source`: date compare with null last.
- `priority`: string or rank compare, depending on available data.
- `project_key`: string compare.
Prefer existing helpers (`compareStrings`, `compareDates`, `compareNullLast`) and add small helpers where needed. Direction should be applied by the generic comparator builder, not by duplicating asc/desc versions for every property.
### Comparator helper

Add `src/views/collection/sort.ts`.
Expected public API:
```typescript
export function buildCollectionComparator(
  levels: SortLevelConfig[],
  entity: EntityContract,
): (a: TItem, b: TItem) => number;

export function sortCollectionItems(
  items: TItem[],
  entity: EntityContract,
  levels: SortLevelConfig[],
): TItem[];
```
Comparator behavior:
1. Read valid sort levels in order.
2. For each level, find the entity comparator for that property.
3. Compare `a` and `b`.
4. If the result is non-zero, return it or its negation based on direction.
5. If the result is zero, continue to the next level.
6. After the last configured level, return `entity.defaultSort(a, b)`.
`sortCollectionItems` should copy the input array before sorting. It must not mutate the item array from data hooks.
If no valid configured levels exist, `sortCollectionItems` should return a copy sorted by `entity.defaultSort`.
### Body and page wiring

Move the current `sortCollectionItems` export out of `Body.tsx` or re-export it from there for compatibility. The important behavior is that every caller passes active sort levels.
Update `Body` props:
```typescript
type Props = {
  items: TItem[];
  entity: EntityContract;
  properties?: PropertyConfig[];
  sort?: SortLevelConfig[];
  selectedId: string | null;
  density?: ViewDensity;
  onSelect: (item: TItem) => void;
};
```
`Body` sorts with `activeConfig.sort` and renders rows in that order.
Update `useCollectionViewer` so `displayItems` is computed from `issues`, `jiraIssueEntity`, and `activeConfig.sort`. Pass the same `activeConfig.sort` into `Body`. This keeps selected index, detail navigation, keyboard navigation, and row render order aligned.
### Sort panel component

Update `src/views/collection/menu/sub-panels/SortPanel.tsx` props to accept:
```typescript
type Props = {
  entity: EntityContract;
  config: ViewConfig;
  onPatchConfig: (config: ViewConfig) => void | Promise;
  onBack: () => void;
  onClose: () => void;
};
```
`SortPanel` should use `patchViewConfig(config, { sort: nextSort })` so unrelated config fields are preserved.
Add small pure helpers, either in `ViewConfig.ts` or a new sort helper module:
- `availableSortProperties(entity, currentSort, currentProperty?)`
- `addSortLevel(config, entity)`
- `setSortProperty(sort, index, property)`
- `toggleSortDirection(sort, index)`
- `removeSortLevel(sort, index)`
- `moveSortLevel(sort, fromIndex, toIndex)`
- `clearSort(sort)` or direct empty array patch
Prefer pure helpers for order math so component tests do not need to simulate every drag edge case.
### View settings menu wiring

Update `ViewSettingsMenu` to pass `entity`, `normalizedConfig`, and `handlePatchConfig` into `SortPanel`, matching the pattern used by `LayoutPanel` and `PropertyVisibilityPanel`.
The top-sheet summary can continue to use `summarizeViewConfig`; ensure normalization removes stale/duplicate sort entries before summary generation.
### Error handling and stale config

Sort config is user-owned JSON stored in SQLite. Treat it as untrusted input:
- Do not assume properties still exist.
- Do not assume directions are valid.
- Do not assume sort levels are unique.
- Do not throw from render when config is invalid.
- Prefer repair during normalization and save the repaired config the next time the user changes the active view.
If the current entity has no sortable properties, render a safe panel message and leave `+ Add sort` disabled.
### Design-system maintenance

Update `context-agent/design-system.md` only if implementation changes a shared collection menu behavior, shared drag-row pattern, select pattern, tooltip pattern, or comparator/display-order contract documented there. If the work stays within the already documented sort-panel behavior, no design-system update is required.
### Testing plan

**Unit and component tests**
- `buildCollectionComparator` sorts a fixture by two levels: level 1 primary, level 2 tie-breaker.
- `buildCollectionComparator` applies descending direction by negating the property comparator result.
- `buildCollectionComparator` falls back to `entity.defaultSort` after all configured levels tie.
- `sortCollectionItems` does not mutate the original item array.
- Sort normalization drops stale properties, invalid directions, and duplicate properties.
- Jira issue comparators cover strings, dates, null updated values, unassigned assignees, and default Jira sort fallback.
- `SortPanel` renders empty state and `+ Add sort` when no levels exist.
- Clicking `+ Add sort` appends the first unused sortable property.
- `+ Add sort` disables when every sortable property is used.
- Property select changes only the target level and avoids duplicate property choices.
- Direction toggle flips `asc` to `desc` and `desc` to `asc`.
- Remove deletes one level and preserves the rest.
- `Clear all sort` empties the sort array and is visible only when sort is active.
- Drag reorder updates the sort level array correctly.
- `SortPanel` patches only `sort` and preserves layout, property visibility, group, filters, and conditional color.
- `ViewSettingsMenu` opens `Sort` and no longer shows `Coming in #42`.
- The sort panel has no axe violations.
- `Body` receives active sort levels and renders in sorted order.
- `useCollectionViewer` uses the same sorted order for rows and preview navigation.
**Playwright / end-to-end**
- Open the Jira viewer and open view settings.
- Open `Sort`.
- Add three sort levels.
- Change a property and toggle direction.
- Reorder levels by drag and see row order change.
- Remove a level via `✕` and see rows re-sort.
- Clear all sort and see the entity default order restored.
- Reload and verify the active view keeps its sort config if deterministic collection-view persistence is available in the harness.
If the e2e harness cannot seed deterministic Jira rows or cannot exercise real Tauri persistence, keep focused unit/page coverage and document the manual verification path.
### Verification commands

Run targeted checks first, then broader checks:
```bash
npm test -- sort
npm test -- ViewConfig
npm test -- SortPanel
npm test -- Body
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
## Task decomposition

- [ ] **Story: Add reusable sort metadata and comparator helpers**
	- **Description:** Give collection entities a generic way to declare sortable properties and use those declarations to build a multi-level comparator.
	- **Acceptance criteria:**
		- [ ] `EntityContract` supports optional sortable property metadata.
		- [ ] Jira issue entity declares sortable properties and comparators for key, title, status, assignee, updated, priority, and project key where data supports them.
		- [ ] `buildCollectionComparator` applies levels in stack order.
		- [ ] Descending levels invert the matching property comparator result.
		- [ ] Equal configured levels fall back to `entity.defaultSort`.
		- [ ] Sorting copies the input array and does not mutate hook data.
		- [ ] Tests cover two-level sort, descending, fallback, stale levels, and immutability.
	- **Dependencies:** Existing entity contract and Jira compare helpers.
	- [ ] **Task: Extend collection sort types**
		- Add sortable property metadata types and optional `sortableProperties` to `EntityContract`.
	- [ ] **Task: Add Jira sortable metadata**
		- Define Jira property comparators using existing compare helpers and safe null handling.
	- [ ] **Task: Add shared sort module**
		- Implement `buildCollectionComparator` and `sortCollectionItems` in `src/views/collection/sort.ts`.
	- [ ] **Task: Add comparator tests**
		- Cover primary/secondary levels, direction, default fallback, invalid levels, and immutable sorting.
- [ ] **Story: Normalize and patch active sort config safely**
	- **Description:** Treat persisted `ViewConfig.sort` as user-owned JSON and keep it valid for the current entity.
	- **Acceptance criteria:**
		- [ ] Normalization keeps only current sortable properties.
		- [ ] Normalization drops invalid directions.
		- [ ] Normalization drops duplicate property levels after the first valid occurrence.
		- [ ] Normalization preserves valid persisted order.
		- [ ] Empty sort remains empty and means default sort.
		- [ ] Pure helpers can add, update, toggle, remove, reorder, and clear sort levels.
		- [ ] Sort patches preserve unrelated config fields.
		- [ ] Tests cover stale, duplicate, invalid, and helper behavior.
	- **Dependencies:** Story 1 sortable metadata.
	- [ ] **Task: Update ****`normalizeViewConfig`**
		- Filter `sort` through current entity sortable metadata and valid directions.
	- [ ] **Task: Add sort config helpers**
		- Implement add, property update, direction toggle, remove, move, and clear helpers.
	- [ ] **Task: Add normalization and helper tests**
		- Cover repair behavior and preservation of unrelated config sections.
- [ ] **Story: Build the functional Sort panel**
	- **Description:** Replace placeholder copy with the visible sort stack and controls bound to the active view config.
	- **Acceptance criteria:**
		- [ ] The panel renders `PanelHeader` with title `Sort`.
		- [ ] Empty sort shows concise empty copy and `+ Add sort`.
		- [ ] Active sort renders one row per level.
		- [ ] Each row shows drag handle, position number, property picker, direction toggle, and remove button.
		- [ ] Property picker lists sortable properties and prevents duplicates.
		- [ ] Direction toggle flips between `↑ Asc` and `↓ Desc`.
		- [ ] `+ Add sort` appends the first unused sortable property.
		- [ ] `+ Add sort` disables when every sortable property is used.
		- [ ] `Clear all sort` appears only when sort is active and empties the stack.
		- [ ] Tests cover rendering, add, property change, direction toggle, remove, clear, disabled add, and accessibility.
	- **Dependencies:** Stories 1-2.
	- [ ] **Task: Update ****`SortPanel`**** props and rendering**
		- Accept entity, config, and patch callback; render rows from normalized `config.sort`.
	- [ ] **Task: Implement controls**
		- Wire property picker, direction toggle, add, remove, and clear actions through pure helpers.
	- [ ] **Task: Wire ****`ViewSettingsMenu`**
		- Pass active entity, config, and patch callback into `SortPanel`.
	- [ ] **Task: Add panel tests**
		- Cover user interactions, patch payloads, no-duplicate options, empty state, and axe.
- [ ] **Story: Add drag-and-drop sort level reordering**
	- **Description:** Let users change sort priority by dragging level rows while keeping keyboard accessibility aligned with existing drag patterns.
	- **Acceptance criteria:**
		- [ ] Pointer drag starts from the handle.
		- [ ] Dragging a row updates the `sort` array order.
		- [ ] Position numbers update after reorder.
		- [ ] Keyboard drag works with the existing accessible `@dnd-kit` pattern where supported.
		- [ ] Drag operations patch only `sort`.
		- [ ] Tests cover pure reorder math and component drag wiring.
	- **Dependencies:** Functional Sort panel.
	- [ ] **Task: Reuse sortable setup**
		- Reuse `@dnd-kit/core` and `@dnd-kit/sortable` patterns from property visibility.
	- [ ] **Task: Implement drag-end mapping**
		- Convert active/over ids into sort array reorder helper calls.
	- [ ] **Task: Add reorder tests**
		- Cover helper behavior and component-level handle setup.
- [ ] **Story: Apply active-view sort to collection display order**
	- **Description:** Make the collection body and preview navigation honor active view sort levels from one shared sorted array.
	- **Acceptance criteria:**
		- [ ] `useCollectionViewer` computes `displayItems` with `activeConfig.sort`.
		- [ ] `Body` receives and uses the same active sort levels.
		- [ ] Rows render in the configured multi-sort order.
		- [ ] Detail `M of N`, up/down buttons, full-page preview, and keyboard navigation use the same order.
		- [ ] Selection is preserved when sort changes and the selected item still exists.
		- [ ] Clearing sort returns to `entity.defaultSort`.
		- [ ] Tests cover row order, navigation order, selection preservation, and default fallback.
	- **Dependencies:** Stories 1-2.
	- [ ] **Task: Thread sort into ****`Body`**
		- Add a `sort` prop and use the shared sort helper.
	- [ ] **Task: Update collection page display order**
		- Compute `displayItems` from active sort and pass the same sort to `Body`.
	- [ ] **Task: Add integration tests**
		- Cover `Body`, `useCollectionViewer`, preview navigation, and selected row behavior.
- [ ] **Story: Verify and document the enhancement**
	- **Description:** Add focused coverage and run relevant checks for sort panel behavior and sorted collection display.
	- **Acceptance criteria:**
		- [ ] Unit and component tests cover comparator helpers, config normalization, panel controls, drag reorder, body sorting, and page wiring.
		- [ ] Playwright covers add, reorder, remove, clear, and visible row-order changes if deterministic data is available.
		- [ ] `npm test` passes.
		- [ ] `npm run lint` passes.
		- [ ] `npm run build` passes.
		- [ ] Any skipped e2e or manual Tauri checks are documented with a reason.
		- [ ] `context-agent/design-system.md` is updated only if shared UI contracts change.
	- **Dependencies:** Stories 1-5.
	- [ ] **Task: Add focused test coverage**
		- Add or update tests for `sort`, `ViewConfig`, `SortPanel`, `Body`, `ViewSettingsMenu`, and `CollectionViewerPage`.
	- [ ] **Task: Add Playwright coverage**
		- Extend the collection viewer e2e flow with deterministic fixture data if the harness supports it.
	- [ ] **Task: Run verification**
		- Run targeted tests, then `npm test`, `npm run lint`, and `npm run build`.
	- [ ] **Task: Update durable context if needed**
		- Update `context-agent/design-system.md` only if implementation changes shared sort-panel, drag-row, select, or display-order contracts.
## Open questions and implementation notes

- The issue mentions a flat select is fine for Jira because the list is short. Use the existing form/select primitive if available; do not add a new select library.
- Decide whether `Updated` should default to `desc` when added. Consistent `asc` is simpler; property-level `defaultDirection` is more pleasant for dates if implemented cleanly.
- Decide whether Jira `Priority` has a reliable rank in the current list item. If only a display string exists, string sort is acceptable for this issue, but note that true Jira priority order may need source metadata later.
- Exclude `Labels` from the initial sortable property set unless implementation defines an unambiguous comparator.
- Existing `defaultJiraSort` returns `0` when updated times tie. That is acceptable as the entity fallback unless implementation can add a stable secondary fallback, such as key, without changing product expectations.
- Browser-only Playwright may not exercise real Tauri SQLite persistence. If so, verify persistence through component/page tests and document the limitation for e2e.