---
created: 2026-05-27
last_updated: 2026-05-27
status: implementing
issue: 41
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Property visibility sub-panel

## What

`hm` needs the collection view-settings `Property visibility` sub-panel to become a real control surface. This enhancement replaces the `Coming in #41` placeholder with searchable, draggable property rows that control which properties appear in the collection row, where each property sits, and the order in which row cells render.
After this enhancement, a user can open the Jira issue collection, open view settings, drill into `Property visibility`, and edit the active view's row layout without leaving the collection. They can show or hide non-title properties, move properties between the left and right row zones, and reorder the single canonical property list. The visible row updates immediately and persists with the active named view.
The row layout follows the existing collection read contract: each property has one ordered position and one side, `left` or `right`. A list ordered `B → E → A → M → O → G → C → I` with sides `R, L, L, R, L, R, R, L` renders as `E A O I [stretch] B M G C`. Left properties keep list order, then the stretch area appears, then right properties keep list order.
## Why

Named views and the settings menu already make the collection viewer feel configurable, but users still cannot choose the information density that matters most: which fields are visible in each row. The current default Jira row is useful for first browse, but different jobs need different rows. Elena may want assignee, status, and last update; Priya may want project, priority, and labels; Tarek may want a narrow title-first scan.
This enhancement also turns the `ViewConfig.propertyVisibility` model into live behavior. The layout panel proved that view config can update rows; property visibility is the next larger slice because it exercises ordered arrays, cross-section moves, title-property constraints, and row partitioning.
## Personas

- **Elena: EM** — wants dense rows that show ownership and status while hiding fields she does not use during triage.
- **Priya: PM** — wants rows that emphasize planning fields such as priority, labels, and project key while preserving enough title space to scan quickly.
- **Tarek: Team member** — wants to make unfamiliar issue lists easier to read by moving identifiers and status to predictable sides.
- **Future collection implementer** — needs a generic property-visibility panel that works for GitHub issues, pull requests, hygiene suggestions, and other entities without Jira-specific branches.
- **Maintainer** — needs tested order, visibility, and side helpers before sort, group, and filter panels start relying on the same active-view persistence path.
## Narratives

### Elena hides low-value fields

Elena opens `Jira issues` and opens view settings from the chip row. The top sheet says `Property visibility 5 of 8`, so she opens that panel. She sees a search field, a `Shown` section, and a `Hidden` section. Each property row has a drag handle, icon, label, `← | →` side control, and an eye button.
She hides `Project key` and `Labels` because they are not useful for her weekly triage pass. Each click moves the property into `Hidden`, the row cells disappear from the collection immediately, and the top-sheet summary updates when she returns. The title property stays visible; its eye button is disabled and explains that the title cannot be hidden.
### Priya moves planning fields to the right

Priya uses a Jira view for roadmap review. She opens `Property visibility`, searches for `Priority`, and turns it on. It appears in `Shown` at its existing list position. She switches `Priority` to `→`, then moves it near `Status` with the drag handle.
The collection row changes as she edits. Left-side title and key keep their order. Right-side priority and status render in the order Priya chose, separated from the left side by the stretch area. The change persists when she reloads the app.
### Tarek reorders a scan view with the keyboard

Tarek prefers keyboard-heavy workflows. He opens the property panel, tabs to a drag handle, presses Space to pick up the row, uses the arrow keys to move it, and presses Space again to drop it. The panel announces the movement through the drag library's accessible behavior, and the collection row updates to match the new order.
He drags `Assignee` from `Shown` into `Hidden`, which hides it. He later toggles the eye-off button to show it again; it returns to the shown section without losing its place in the single property list.
## User stories

**Elena controls visible row properties**
- Elena can open `Property visibility` from the existing view-settings menu.
- Elena can see properties split into `Shown` and `Hidden` sections.
- Elena can toggle any non-title property between shown and hidden.
- Elena can see the collection rows update immediately after visibility changes.
- Elena can return to the top sheet and see the visible count summary update.
- Elena can reload the app and see the active view keep its property visibility settings.
**Priya controls row side and order**
- Priya can switch each property's side between `←` and `→`.
- Priya can reorder properties using drag handles.
- Priya can move a property between `Shown` and `Hidden` by dragging it across sections.
- Priya can see side changes affect only row placement, not the property's canonical list order.
- Priya can see left-side and right-side properties preserve canonical list order within each side.
**Tarek uses accessible controls**
- Tarek can filter the property list by label with the search field.
- Tarek can use keyboard-accessible drag and drop to reorder rows.
- Tarek can use labelled controls for the side toggle and visibility toggle.
- Tarek can understand why the title property cannot be hidden through a disabled eye button tooltip.
- Tarek can use the panel without focus traps or broken tab order.
**Future collection implementer reuses the model**
- Future implementer can pass any entity's property definitions to the same panel.
- Future implementer can rely on `ViewConfig.propertyVisibility` as the canonical ordered list for row rendering.
- Future implementer can add entity-specific properties without changing the generic panel chrome.
- Future implementer can rely on normalization to append new properties and drop stale properties safely.
## Goals

- Replace the `PropertyVisibilityPanel` placeholder with a functional sub-panel.
- Render a search field that filters properties by label.
- Render `Shown` and `Hidden` sections with one row per matching property.
- Render property rows in the order stored by `ViewConfig.propertyVisibility`.
- Include a drag handle, property icon, label, `← | →` side control, and eye / eye-off visibility control in each row.
- Disable the title property's eye control and show a tooltip explaining that the title is always visible.
- Allow the title property's side and order to change like any other property.
- Use drag-and-drop reordering with a keyboard sensor, preferably through `@dnd-kit/core` and `@dnd-kit/sortable`.
- Make the drag handle the only pointer activation surface for dragging.
- Support dragging rows within a section to reorder the canonical list.
- Support dragging a row between `Shown` and `Hidden` to toggle visibility while preserving canonical order.
- Patch only `ViewConfig.propertyVisibility` and preserve layout, sort, group, filters, and conditional color config.
- Update `Body`, `Row`, and the collection viewer wiring so active-view property visibility drives row rendering.
- Preserve the documented left/right row partitioning: left visible properties in list order, stretch, then right visible properties in list order.
- Keep the title/stretch property visible; if it is not visible in config because of stale data, normalize it back to visible.
- Keep an invisible spacer when the title/stretch property is configured to the right or absent from the left side so left and right zones remain separated.
- Use existing design-system tokens and primitives.
- Cover panel behavior, row layout, config helpers, page wiring, drag behavior, and accessibility with tests.
## Non-goals

- No per-property column width controls.
- No per-property color, icon, or renderer customization.
- No user-selectable title/stretch property override.
- No new collection entity types.
- No Jira-specific property editing or Jira write-back.
- No bulk row selection or mutation actions.
- No sort, group, filter, or conditional color controls; issues #42-#44 own those panels.
- No changes to layout density or preview surfaces beyond preserving their existing behavior.
- No changes to named-view chip CRUD, active-view preference storage, or collection-view persistence except saving the updated config.
- No backend schema change unless implementation finds the existing `collection_views.config_json` round-trip cannot store the ordered property list.
## Design spec

### Information architecture

This enhancement stays inside the existing Jira issue collection page and view-settings menu.
```plain text
Jira issues
└── Collection header
    ├── View chips
    └── View settings menu
        ├── Top sheet
        └── Property visibility panel
```
The `Property visibility` top-sheet row is already present from issue #39. Clicking it now shows functional controls instead of placeholder copy. The panel remains generic: it reads entity property metadata and patches the active view's `ViewConfig.propertyVisibility`.
### Panel chrome

The panel keeps the shared sub-panel shell:
```plain text
┌─────────────────────────────────────────────┐
│  ←  Property visibility                 [X] │
├─────────────────────────────────────────────┤
│  Search properties                      ⌕  │
├─────────────────────────────────────────────┤
│  Shown                                      │
│  ⋮⋮  Aa  Title                  ←  →   👁    │
│  ⋮⋮  ⊙   Status                 ←  →   👁    │
│  ⋮⋮  ◉   Issue key              ←  →   👁    │
│  ⋮⋮  👤  Assignee               ←  →   👁    │
│                                             │
│  Hidden                                     │
│  ⋮⋮  ⊕   Labels                 ←  →   👁̸    │
│  ⋮⋮  🏷   Project key            ←  →   👁̸    │
└─────────────────────────────────────────────┘
```
The back arrow returns to the top sheet. The close button dismisses the whole view-settings menu. `Esc` keeps the existing popover behavior unless a drag operation is active, in which case the drag library may cancel the drag first.
### Search

The search field sits below the header and above the sections. It filters by property label with case-insensitive substring matching. An empty search shows every property.
When search hides every property in a section, that section shows a small muted empty line such as `No shown properties match` or `No hidden properties match`. The search field never mutates config. Clearing it restores the complete ordered list.
### Property sections

The panel renders from one canonical ordered list, `ViewConfig.propertyVisibility`. The UI partitions that list into `Shown` and `Hidden` sections by `visible`, but does not create two independent orders.
Within each section, rows keep canonical order. Toggling visibility moves the row between sections while the underlying list position remains stable. Dragging a row within or across sections changes the canonical order; dragging across the section boundary also changes `visible` to match the destination section.
### Property row

Each property row contains:
- A drag handle labelled `Reorder {property label}`. Pointer dragging starts only from this handle.
- The entity-provided property icon, with a safe fallback icon if the property has none.
- The property label.
- A compact `← | →` segmented control.
- An icon-only visibility button using eye / eye-off.
The `← | →` control patches only the row's `side`. It does not change the row's list index. The left-arrow option sets `side: "left"` and the right-arrow option sets `side: "right"`. The active side has selected styling and `aria-pressed="true"` or equivalent radio semantics.
The visibility button patches only the row's `visible` value. For non-title properties, the tooltip and accessible label should say either `Hide {label}` or `Show {label}`.
### Title property rule

The entity's stretch property is the title property for this enhancement. For Jira issues, this is `title`.
The title property is always visible. Its eye button renders disabled with a tooltip such as `Title is always visible`. Disabled semantics should follow the existing `IconButton` pattern: keep tooltip eligibility while blocking activation. The title property's side and order remain configurable.
If persisted config marks the title property hidden, config normalization should repair it to `visible: true` before rendering the panel or rows.
### Drag and drop behavior

Use `@dnd-kit/core` and `@dnd-kit/sortable` unless implementation finds an equivalent already used in the repository. If `@dnd-kit` is added, add the smallest required packages to `package.json` and `package-lock.json`.
Drag rules:
- Pointer dragging starts from the handle, not from the whole row.
- Keyboard dragging works with the library's keyboard sensor: Space to pick up, arrow keys to move, Space to drop, Escape to cancel.
- Dragging within `Shown` reorders the canonical property list and keeps the row visible.
- Dragging within `Hidden` reorders the canonical property list and keeps the row hidden.
- Dragging from `Shown` into `Hidden` sets `visible: false` and places the property at the drop position.
- Dragging from `Hidden` into `Shown` sets `visible: true` and places the property at the drop position.
- Search-filtered rows remain draggable if the library can do this safely. The drop should place the moved property relative to the visible neighbor in the full canonical list. If this becomes too brittle, disable drag while search is non-empty and explain it with muted helper text.
### Row rendering

Rows render visible properties from the active view's `propertyVisibility` config, not from hardcoded defaults.
For each row:
1. Start from the normalized ordered property config.
2. Remove hidden properties.
3. Split visible properties into left and right groups by side while preserving list order within each group.
4. Render the left group.
5. Render the stretch property with `flex-1` if it appears in the left group.
6. If no left-side stretch property appears, render an invisible `flex-1` spacer between the left and right groups.
7. Render the right group.
This preserves the documented layout example:
```plain text
property list:  B  E  A  M  O  G  C  I
sides:          R  L  L  R  L  R  R  L
row layout:     E  A  O  I  [stretch]  B  M  G  C
```
The row must not remount existing cell renderers when only a property's side changes. Stable keys should use the property id, not side or array index.
### Persistence and feedback

Every property change patches the active view config through the existing `onPatchConfig(viewId, config)` path. Use the current save behavior from `CollectionViewerPage`; do not introduce a second persistence channel.
If save fails, keep the same failure behavior as other view-config changes: surface the existing safe view error and avoid exposing raw SQL, stack traces, local paths beyond normal app paths, tokens, Jira secrets, or source payloads. If the current page uses save-first-then-update, keep it. If it uses optimistic updates later, this panel should follow that pattern with rollback.
### Accessibility

- The panel has a clear `Property visibility` heading through `PanelHeader`.
- The search input has an accessible name such as `Search properties`.
- `Shown` and `Hidden` are exposed as section headings.
- Drag handles have descriptive labels.
- Keyboard drag works through the drag library's keyboard sensor.
- The side control exposes one selected value per property.
- Eye buttons have descriptive labels and tooltips.
- The disabled title eye button communicates why it is disabled.
- Dragging and toggling do not steal focus from the active row unexpectedly.
- The panel has no axe violations.
## Tech spec

### Prerequisites and references

- Issue #37 and `context-human/specs/feature-collection-viewer-foundation.md` for the generic collection row and entity contract.
- Issue #38 and `context-human/specs/feature-named-views-and-view-chips.md` for named views, persistence, and active-view preferences.
- Issue #39 and `context-human/specs/enhancement-view-settings-menu-shell.md` for `ViewSettingsMenu`, `PanelHeader`, `TopSheet`, `ViewConfig`, summaries, and config patch persistence.
- Issue #40 and `context-human/specs/enhancement-layout-sub-panel.md` for the first real sub-panel and row-config threading pattern.
- `context-agent/collections/collection-read.md`, especially `Property visibility sub-panel` and `Row rendering`.
- `context-agent/design-system.md` for tokens, `IconButton`, `Tooltip`, form controls, disabled-button semantics, and collection menu patterns.
- ADR-002 for the Tauri + React application architecture.
- ADR-003 for local-first single-user v1.
- ADR-008 for settings split: view config belongs in SQLite, not preferences or keychain.
### View config model

The existing model already contains the needed section:
```typescript
export type PropertyVisibilityConfig = {
  property: string;
  side: PropertySide;
  visible: boolean;
};

export type ViewConfig = {
  layout: { type: LayoutType; density: ViewDensity; preview: PreviewSurface };
  propertyVisibility: PropertyVisibilityConfig[];
  sort: SortLevelConfig[];
  group: GroupConfig;
  filters: FilterConfig[];
  conditionalColor: ConditionalColorConfig;
};
```
This enhancement should keep that shape. Add helpers rather than adding a second property-visibility schema.
Expected helper behavior:
- `defaultViewConfig(entity)` seeds one config entry per `entity.defaultProperties` row.
- `normalizeViewConfig(input, entity)` returns one entry for every current `entity.properties` item.
- Unknown persisted properties are dropped.
- Missing current properties are appended from entity defaults.
- The entity stretch property is forced visible.
- Invalid sides fall back to the entity default side or `left`.
- The normalized order preserves valid persisted order first, then appends new defaults.
### Panel component API

Update `src/views/collection/menu/sub-panels/PropertyVisibilityPanel.tsx`.
Suggested props:
```typescript
type PropertyVisibilityPanelProps = {
  entity: EntityContract;
  config: ViewConfig;
  onPatchConfig: (config: ViewConfig) => void | Promise;
  onBack: () => void;
  onClose: () => void;
};
```
`ViewSettingsMenu` should pass the normalized config, entity, and existing patch callback into this panel, mirroring `LayoutPanel`.
Responsibilities:
- Render the shared `PanelHeader` with title `Property visibility`.
- Own search state.
- Derive ordered rows by joining `config.propertyVisibility` to `entity.properties`.
- Render `Shown` and `Hidden` sections.
- Patch `propertyVisibility` on visibility toggle, side toggle, and drag end.
- Preserve unrelated config sections through `patchViewConfig` or an equivalent helper.
### Property row components

Implementation may keep row markup inside `PropertyVisibilityPanel` or extract a small private component such as `PropertyVisibilityRow` in the same folder.
Suggested row props:
```typescript
type PropertyVisibilityRowProps = {
  property: PropertyDefinition;
  config: PropertyVisibilityConfig;
  isTitleProperty: boolean;
  dragHandleProps: unknown;
  onSideChange: (side: PropertySide) => void;
  onVisibilityChange: (visible: boolean) => void;
};
```
Keep the extracted component local unless another panel needs it. Do not create a shared primitive for a one-off row unless the implementation also updates `context-agent/design-system.md`.
### Drag helpers

Add pure helpers near the panel or in `src/views/collection/ViewConfig.ts` if they are broadly useful.
Useful helpers:
- `moveProperty(configs, propertyId, targetIndex)` — returns a reordered copy.
- `setPropertyVisible(configs, propertyId, visible)` — toggles one entry.
- `setPropertySide(configs, propertyId, side)` — changes one entry.
- `applyPropertyDrop(configs, activeId, overId, destinationVisible)` — handles drag-end reorder and optional visibility change.
Pure helpers should be unit-tested without React or `@dnd-kit`.
### Row and body wiring

Update these files:
- `src/views/collection/Body.tsx`
- `src/views/collection/Row.tsx`
- `src/features/collection-viewer/useCollectionViewer.tsx`
- `src/features/collection-viewer/CollectionViewerPage.tsx` only if the all-in-one wrapper needs test support changes.
`useCollectionViewer` should pass `activeConfig.propertyVisibility` to `Body` along with existing density. `Body` should pass that ordered property config into `Row`.
`Row` should already split visible left and right properties. Confirm it preserves list order inside each group and uses stable keys based on property id. Add or adjust tests for the documented `B E A M O G C I` example.
### Summary text

`ViewConfig.summarizeViewConfig` already computes `visibleCount of totalCount`. Confirm it uses normalized config after the title visibility rule is applied. The top-sheet row should update after saves because the active view config changes.
### Package changes

If using `@dnd-kit`, add only the needed packages:
- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities` if required by sortable transforms
No other drag library should be added unless there is a clear reason. Do not add a large table/grid package for this panel.
### Design-system maintenance

Update `context-agent/design-system.md` only if implementation introduces or changes a shared primitive, shared drag-row pattern, shared segmented control, or documented collection menu behavior. If the work stays inside the already documented property-visibility panel behavior, no design-system update is required.
### Testing plan

**Unit and component tests**
- `PropertyVisibilityPanel` renders the shared header, search input, `Shown`, and `Hidden` sections.
- The panel renders one row for every normalized entity property.
- Search filters properties by label and shows section empty text when appropriate.
- Toggling a non-title eye button patches only `propertyVisibility` and preserves unrelated config fields.
- The title eye button is disabled, tooltip-eligible, and does not patch config.
- Switching `←` / `→` patches the selected property's side without changing its list index.
- Dragging within `Shown` reorders properties and keeps them visible.
- Dragging within `Hidden` reorders properties and keeps them hidden.
- Dragging from `Shown` to `Hidden` sets `visible: false`.
- Dragging from `Hidden` to `Shown` sets `visible: true`.
- Pure config helpers preserve unknown unrelated config sections.
- `normalizeViewConfig` appends new entity properties, drops stale persisted properties, and forces the stretch/title property visible.
- `Row` renders the documented `B E A M O G C I` example as `E A O I [stretch] B M G C`.
- `Row` keeps stable cell keys when a property switches sides.
- `Body` receives active-view property visibility from the page and passes it to rows.
- The property panel has no axe violations.
**Page integration tests**
- `ViewSettingsMenu` opens `Property visibility` and no longer shows `Coming in #41`.
- Toggling visibility through the menu calls `onPatchConfig` with the active view id and updated config.
- `useCollectionViewer` passes `activeConfig.propertyVisibility` to `Body` so hidden properties disappear from rows.
- Side changes update row placement without closing the menu or changing selection.
- Property order persists through the existing collection view save path.
**Playwright / end-to-end**
- Open the Jira viewer and open view settings.
- Open `Property visibility`.
- Search for a property by label and verify the list filters.
- Drag a non-title property to a new position and see the row update.
- Toggle a non-title property's visibility and see it disappear from rows.
- Switch a property's side and see it move within the row while keeping list order.
- Try to hide the title property and verify the eye button is disabled.
- Reload and verify the active view keeps the property config.
- Verify keyboard drag works with Space, arrow keys, and Space to drop.
### Verification commands

Run targeted checks first, then broader checks:
```bash
npm test -- ViewConfig
npm test -- PropertyVisibilityPanel
npm test -- Row
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
If the e2e harness cannot seed deterministic Jira rows yet, keep the unit and page coverage and document the manual verification path.
## Task decomposition

- [ ] **Story: Normalize property-visibility config**
	- **Description:** Make `ViewConfig.propertyVisibility` a complete, safe ordered list for the active entity.
	- **Acceptance criteria:**
		- [ ] Normalization returns one property config per current entity property.
		- [ ] Valid persisted order is preserved.
		- [ ] New entity properties append with entity default side and visibility.
		- [ ] Stale persisted properties are dropped.
		- [ ] The title/stretch property is always visible.
		- [ ] Tests cover missing, stale, invalid, and hidden-title config.
	- **Dependencies:** Existing `ViewConfig` helpers and entity contracts.
	- [ ] **Task: Update config normalization**
		- Extend `normalizeViewConfig` and related helpers to repair and complete `propertyVisibility`.
	- [ ] **Task: Add pure property-config helpers**
		- Add helper functions for side updates, visibility updates, and reordering.
	- [ ] **Task: Add helper tests**
		- Cover append, drop, force-title-visible, side fallback, and order preservation.
- [ ] **Story: Build the functional Property visibility panel**
	- **Description:** Replace the placeholder panel with searchable property rows bound to the active view config.
	- **Acceptance criteria:**
		- [ ] The panel renders `PanelHeader` with title `Property visibility`.
		- [ ] The panel renders a `Search properties` input.
		- [ ] The panel renders `Shown` and `Hidden` sections.
		- [ ] Each property row shows drag handle, icon, label, `← | →`, and eye / eye-off controls.
		- [ ] Search filters by label without mutating config.
		- [ ] Empty filtered sections show muted empty text.
		- [ ] Tests cover rendering, filtering, and accessibility.
	- **Dependencies:** Story 1 normalized config.
	- [ ] **Task: Replace the placeholder component**
		- Update `PropertyVisibilityPanel.tsx` to accept entity, config, and patch props.
	- [ ] **Task: Add row rendering**
		- Render property metadata, icons, labels, side controls, and visibility controls using token classes.
	- [ ] **Task: Wire ViewSettingsMenu**
		- Pass normalized config, entity, and existing config patch callback into the panel.
	- [ ] **Task: Add panel rendering tests**
		- Cover sections, rows, search, empty filtered states, and axe.
- [ ] **Story: Implement visibility and side controls**
	- **Description:** Let users show/hide properties and move them between left and right row zones.
	- **Acceptance criteria:**
		- [ ] Non-title eye buttons toggle `visible`.
		- [ ] Toggling visibility moves the row between `Shown` and `Hidden`.
		- [ ] The title eye button is disabled and explains why.
		- [ ] `← | →` changes only `side`.
		- [ ] Side changes do not change canonical list order.
		- [ ] Config patches preserve layout, sort, group, filters, and conditional color.
		- [ ] Tests cover each control and patch payload.
	- **Dependencies:** Functional panel rows and config helpers.
	- [ ] **Task: Add visibility toggle behavior**
		- Patch `propertyVisibility` with a copied array and keep the title protected.
	- [ ] **Task: Add side toggle behavior**
		- Patch the selected property's side without changing list position.
	- [ ] **Task: Add title-property disabled tooltip**
		- Use the existing tooltip/disabled icon-button pattern.
	- [ ] **Task: Add interaction tests**
		- Cover show, hide, title no-op, side update, and unrelated config preservation.
- [ ] **Story: Add drag-and-drop ordering**
	- **Description:** Support pointer and keyboard reordering through drag handles, including moves between shown and hidden sections.
	- **Acceptance criteria:**
		- [ ] Dragging starts from the handle, not the full row.
		- [ ] Pointer drag reorders rows within a section.
		- [ ] Pointer drag across sections toggles visibility and sets the drop order.
		- [ ] Keyboard drag works with Space, arrows, Space, and Escape cancel.
		- [ ] Drag operations patch only `propertyVisibility`.
		- [ ] Tests cover reorder and cross-section visibility changes.
	- **Dependencies:** Functional panel rows and pure reorder helpers.
	- [ ] **Task: Add drag dependencies if needed**
		- Add `@dnd-kit/core`, `@dnd-kit/sortable`, and required utilities to package files if no equivalent exists.
	- [ ] **Task: Wire sensors and sortable contexts**
		- Configure pointer and keyboard sensors with handle activators and section droppables.
	- [ ] **Task: Implement drag-end mapping**
		- Convert library drag results into canonical property-list reorder plus destination visibility.
	- [ ] **Task: Add drag tests**
		- Prefer pure helper tests for order math and component tests for handle setup and keyboard behavior.
- [ ] **Story: Apply active-view property layout to rows**
	- **Description:** Make the collection body and row renderer honor property order, visibility, and side from the active view.
	- **Acceptance criteria:**
		- [ ] `useCollectionViewer` passes `activeConfig.propertyVisibility` into `Body`.
		- [ ] `Body` passes the ordered property config to `Row`.
		- [ ] `Row` partitions visible properties into left and right groups while preserving list order.
		- [ ] The documented `B E A M O G C I` example renders in the expected order.
		- [ ] The title property gets `flex-1` when rendered as the stretch property.
		- [ ] An invisible spacer preserves the stretch when the title is configured to the right.
		- [ ] Side changes do not remount cell renderers.
		- [ ] Tests cover ordering, hidden properties, spacer behavior, and stable keys.
	- **Dependencies:** Normalized config and existing layout density behavior.
	- [ ] **Task: Thread property config through the page**
		- Pass `activeConfig.propertyVisibility` from `useCollectionViewer` to `Body`.
	- [ ] **Task: Verify Row partition behavior**
		- Adjust `Row` only as needed to match the documented row layout.
	- [ ] **Task: Add row layout tests**
		- Cover the issue example, title-only, title-right, and hidden-property cases.
- [ ] **Story: Verify and document the enhancement**
	- **Description:** Add focused coverage and run the relevant checks for the full property-visibility behavior.
	- **Acceptance criteria:**
		- [ ] Unit and component tests cover config helpers, panel controls, drag behavior, row rendering, and page wiring.
		- [ ] Playwright covers opening the panel, search, drag reorder, visibility toggle, side switch, and title no-op if deterministic data is available.
		- [ ] `npm test` passes.
		- [ ] `npm run lint` passes.
		- [ ] `npm run build` passes.
		- [ ] Any skipped e2e or manual Tauri checks are documented with a reason.
		- [ ] `context-agent/design-system.md` is updated only if shared UI contracts change.
	- **Dependencies:** Stories 1-5.
	- [ ] **Task: Add focused test coverage**
		- Add or update tests for `ViewConfig`, `PropertyVisibilityPanel`, `Row`, `Body`, `ViewSettingsMenu`, and `CollectionViewerPage`.
	- [ ] **Task: Add Playwright coverage**
		- Extend the collection viewer e2e flow with deterministic fixture data if the harness supports it.
	- [ ] **Task: Run verification**
		- Run targeted tests, then `npm test`, `npm run lint`, and `npm run build`.
	- [ ] **Task: Update durable context if needed**
		- Update `context-agent/design-system.md` only if implementation adds shared drag-row or segmented-control contracts.
## Open questions and implementation notes

- The repository currently has no `@dnd-kit` dependency. Add it only if implementing drag with that library; otherwise document the equivalent used.
- The current `Row` already splits visible left and right properties and uses property ids for keys. The main expected wiring change is passing `activeConfig.propertyVisibility` from the page into `Body`.
- The current keyboard navigation hook uses `j` / `k` globally for collection row movement. Make sure drag keyboard handling does not fight page-level navigation while the settings popover or a drag operation has focus.
- If search plus drag produces unreliable order math, it is acceptable to disable dragging while search is active and keep side/visibility controls available. The UI should explain this briefly.
- The issue's test note says side changes should update the row without remounting cells. In React tests, verify stable property keys or use a small stateful test cell to prove it is not recreated when side changes.