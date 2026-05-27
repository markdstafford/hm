---
created: 2026-05-27
last_updated: 2026-05-27
status: implementing
issue: 40
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Layout sub-panel

## What

`hm` needs the collection view-settings `Layout` sub-panel to become a real control surface. This enhancement replaces the `Coming in #40` placeholder from the view-settings menu shell with controls for the active view's layout type, row density, and preview.
After this enhancement, a user can open the Jira issue collection, open view settings, drill into `Layout`, and see the intended layout controls. `Table` is the only active layout type. `Board`, `List`, `Gallery`, `Timeline`, and `Calendar` are visible but disabled so the menu shows the future shape without pretending those layouts work.
The user can switch row density between `Compact` and `Regular`, and the collection body updates row vertical padding immediately. The user can also choose the detail preview: `Side`, `Bottom`, or `Full page`. Side keeps the existing 440px right rail. Bottom moves the detail into a 280px bottom pane. Full page hides the list and renders the detail across the content area. Every preview shows the selected item's position and up/down navigation; Full page also shows back navigation and `j` / `k` hints.
## Why

The view-settings menu is visible, but its first row still points to a placeholder. Users can rename views and inspect summaries, yet they cannot change the most basic presentation settings for the collection. The layout panel is the next useful slice because it has immediate, visible effects without requiring property visibility, sorting, grouping, or filtering.
This enhancement also proves that typed view config can drive the collection body. Density and preview are small enough to implement safely, but they exercise the same persistence path later sub-panels will use. Once this ships, a named view can store both how dense rows are and how selected items open.
## Personas

- **Elena: EM** — wants a dense Jira issue list for scanning many work items, but wants regular spacing when reviewing details more slowly.
- **Priya: PM** — wants a wider reading mode for issue details while preparing roadmap or status context.
- **Tarek: Team member** — wants to move through issues with the keyboard while reading details, especially in full-page preview.
- **Future collection implementer** — needs a reusable layout configuration model that later entities can use without adding Jira-specific branches.
- **Maintainer** — needs tests around config updates, previews, and keyboard navigation before more view-settings panels start changing display order.
## Narratives

### Elena makes the list more compact

Elena opens `Jira issues` and sees her saved named views above the collection. She opens view settings, clicks `Layout`, and sees the active `Table` tile plus disabled future layout tiles. The panel summary tells her the current state is `Table · Regular`.
She changes density to `Compact`. The rows tighten vertically while keeping the same columns, horizontal spacing, and selected-row behavior. The menu remains open, the active view saves the change, and the top-sheet summary updates to `Table · Compact` when Elena goes back.
### Priya moves detail to a bottom pane

Priya wants to keep the list wide while reading an issue. She opens `Layout`, clicks `Preview`, and chooses `Bottom` from the nested popover. The popover closes after the choice.
When Priya clicks an issue row, the detail opens in a 280px pane at the bottom of the content area instead of in the right rail. The list stays above it and remains selectable. Priya clicks another row, and the bottom pane updates to that issue.
### Tarek reads in full-page preview

Tarek is stepping through a long list of issues. He opens the layout panel and chooses `Full page` for the active view. Then he clicks an issue row.
The list disappears and the detail fills the collection content area. A top nav strip shows `Back to list (Esc)` on the left and `3 of 18` with up/down buttons and `j` / `k` hints on the right. Tarek presses `j` to move to the next issue, presses `k` to move back, and presses `Esc` to return to the list with the current row still highlighted.
## User stories

**Elena configures row density**
- Elena can open the `Layout` sub-panel from the existing view-settings menu.
- Elena can see `Table` as the selected layout type.
- Elena can see future layout types as disabled tiles.
- Elena can switch density between `Compact` and `Regular`.
- Elena can see row vertical padding update immediately after changing density.
- Elena can return to the top sheet and see the layout summary reflect the selected density.
**Priya configures the preview**
- Priya can open a `Preview` nested popover from the layout panel.
- Priya can see `Side`, `Bottom`, and `Full page` as options with icon, name, description, and selection checkmark.
- Priya can pick an option and see it saved to the active view.
- Priya can open detail in the existing 440px right rail when `Side` is selected.
- Priya can open detail in a 280px bottom pane when `Bottom` is selected.
- Priya can open detail as a full-page view when `Full page` is selected.
**Tarek navigates selected rows with the keyboard**
- Tarek can use `↑` and `↓` to move the selected row while any preview is open.
- Tarek can use `j` and `k` to move selection in Full page preview.
- Tarek can use `Esc` to return from Full page preview to the list.
- Tarek can see an accurate `M of N` position in any preview.
- Tarek can use visible up/down buttons in any preview to move through rows.
- Tarek can return to the list with the current row still highlighted.
**Future collection implementer reuses the model**
- Future implementer can rely on `ViewConfig.layout` to drive row density and preview placement.
- Future implementer can provide another entity detail component and have it render in all three previews.
- Future implementer can add later layout types without changing the basic layout-panel chrome.
## Goals

- Replace `LayoutPanel` placeholder content with the real layout sub-panel.
- Render a `Type` group with six tiles: `Table`, `Board`, `List`, `Gallery`, `Timeline`, and `Calendar`.
- Keep only `Table` enabled and selected for v1.
- Render disabled future layout tiles as visible-but-inactive controls with accessible disabled semantics.
- Render a `Display` group with a two-button density toggle: `Compact` and `Regular`.
- Render a `Preview` row that shows the current preview choice and opens a nested popover.
- Add `PreviewPopover` with three options: `Side`, `Bottom`, and `Full page`.
- Persist density and preview changes to the active view's typed `ViewConfig` through the existing config patch path.
- Apply density to collection row vertical padding only.
- Extend the generic detail host to support side, bottom, and full-page previews.
- Add shared preview navigation with position and up/down buttons, plus a full-page preview component with back navigation and keyboard hints.
- Add keyboard navigation that walks the current display order.
- Keep side and bottom preview close behavior through the existing `X` affordance.
- Keep Full page close behavior through `Back to list (Esc)` and `Esc`.
- Use existing design-system tokens and primitives.
- Cover the panel, popover, density behavior, previews, keyboard navigation, and end-to-end flow with tests.
## Non-goals

- No working `Board`, `List`, `Gallery`, `Timeline`, or `Calendar` layouts.
- No column width controls.
- No Notion-style load limit.
- No property visibility controls; issue #41 owns that panel.
- No sort controls; issue #42 owns that panel.
- No group controls; issue #43 owns that panel.
- No filter controls; issue #44 owns that panel.
- No conditional color controls.
- No changes to named-view chips, chip CRUD, or active-view preference storage except using the existing active view config.
- No changes to Jira ingestion, Jira API calls, credentials, source configuration, or AI providers.
- No entity-specific detail redesign beyond making the existing entity detail render in all previews.
- No mixed-entity collection behavior.
## Design spec

### Information architecture

This enhancement stays inside the existing Jira issue collection page and view-settings menu.
```plain text
Jira issues
└── Collection header
    ├── View chips
    └── View settings menu
        ├── Top sheet
        └── Layout panel
            └── Preview popover
```
The `Layout` top-sheet row is already present from issue #39. Clicking it now shows functional controls instead of placeholder copy. The layout panel remains generic; it reads and patches `ViewConfig.layout` for the active collection view.
### Layout sub-panel chrome

The panel keeps the shared sub-panel shell from the view-settings menu:
```plain text
┌─────────────────────────────────────────────┐
│  ←  Layout                              [X] │
├─────────────────────────────────────────────┤
│  Type                                       │
│  ┌────────┬────────┬────────┐               │
│  │ Table  │ Board  │ List   │               │
│  ├────────┼────────┼────────┤               │
│  │ Gallery│Timeline│Calendar│               │
│  └────────┴────────┴────────┘               │
│                                             │
│  Display                                    │
│  Density          [ Compact | Regular ]     │
│                                             │
│  Preview          Side                    ›  │
└─────────────────────────────────────────────┘
```
The back arrow returns to the top sheet. The close button dismisses the entire view-settings menu. `Esc` still closes the popover menu from any panel, following issue #39 behavior.
### Type tiles

The `Type` group is a 3-column grid. Each tile has an icon and label if suitable icons already exist through Lucide. `Table` is selected and enabled. All other tiles are disabled but visible:
- `Board`
- `List`
- `Gallery`
- `Timeline`
- `Calendar`
Disabled tiles must not trigger config changes. They should communicate that the options are future-tense without using warning or error styling. Use `aria-disabled="true"` or the repository's established disabled button pattern so tooltips and focus behavior remain accessible when applicable.
### Density toggle

The `Display` group contains a density toggle with two options:
```plain text
Density          [ Compact | Regular ]
```
The active option uses the selected/primary treatment established for small segmented controls. The inactive option uses surface styling. Changing density updates `ViewConfig.layout.density` and persists the active view.
Density affects only vertical row padding:
- `Compact`: approximately 4px top and bottom.
- `Regular`: approximately 8px top and bottom.
Horizontal row padding, cell order, detail content, selected-row color, and checkbox behavior do not change.
### Preview row

The row shows the current preview summary and a chevron:
```plain text
Preview    Side              ›
```
The current value labels are:
- `Side`
- `Bottom`
- `Full page`
Clicking the row opens a nested popover anchored to the row. It does not replace the layout panel.
### Preview popover

The nested popover shows one row per preview:
```plain text
┌─────────────────────────────────────────────┐
│  ⊟  Side                         ✓     │
│      Detail opens in a 440px right rail.    │
│                                             │
│  ⊟  Bottom                             │
│      Detail opens in a 280px bottom pane.   │
│                                             │
│  ⊟  Full page                               │
│      Detail takes the whole content area.   │
└─────────────────────────────────────────────┘
```
Each row includes an icon, name, one-line description, and a checkmark when selected. Picking a row commits the config change and closes the nested popover. The outer view-settings menu remains open on the layout panel.
### Previews

The active view's `layout.preview` value determines where selected item detail renders.
#### Side

Side preserves the existing right rail behavior from the collection viewer foundation.
```plain text
┌──────────────────────────────────────┬───────────────────┐
│ rows                                 │ detail rail 440px │
│ selected row highlighted             │ 3 of 18  ↑ ↓  [X] │
└──────────────────────────────────────┴───────────────────┘
```
The rail width is 440px on wide windows. The list remains visible, scrollable, and selectable. The detail host shows `M of N`, up/down buttons, and its `X` close button.
#### Bottom

Bottom moves detail below the list.
```plain text
┌──────────────────────────────────────────────────────────┐
│ rows                                                     │
│ selected row highlighted                                 │
├──────────────────────────────────────────────────────────┤
│ detail pane 280px                     3 of 18  ↑ ↓  [X]  │
└──────────────────────────────────────────────────────────┘
```
The bottom pane height is 280px. The list uses the remaining height above it. The detail host shows `M of N`, up/down buttons, and its `X` close button.
#### Full page

Full page replaces the list with the selected item's detail.
```plain text
┌──────────────────────────────────────────────────────────┐
│ ← Back to list (Esc)            3 of 18   ↑  ↓   j / k   │
├──────────────────────────────────────────────────────────┤
│ detail                                                   │
└──────────────────────────────────────────────────────────┘
```
Every preview includes:
- `M of N` indicator based on the current display order.
- Up and down buttons.
Full page adds:
- `Back to list (Esc)` button on the left.
- `j` / `k` keyboard hint near the navigation buttons.
Full page does not show the detail `X` close button. It closes through the back button or `Esc`. Returning to the list keeps the current row selected and highlighted.
### Keyboard navigation

When any row is selected, `↑` and `↓` move through the current display order. This behavior applies in Side, Bottom, and Full page.
In Full page, `j` and `k` mirror down/up navigation. `Esc` exits Full page and returns to the list. `Esc` should not clear selection in Side or Bottom; their close affordance remains the `X` button.
Keyboard navigation must ignore keypresses when focus is in an input, textarea, or content-editable element. It should not intercept typing in the view-name textbox or future filter fields.
### Empty, loading, and error states

The layout panel can render as long as an active view exists. If no active view exists, keep the settings trigger disabled or show the existing safe missing-view state from issue #39.
Preview changes do not change loading, empty, or error copy for the Jira issue list. If no row is selected, no detail appears. If the active view's config is invalid or missing, normalize to the default layout: `Table`, `Regular`, `Side`.
### Accessibility

- The layout panel has a clear heading through the shared panel header.
- Type tiles are reachable and announce selected/disabled state where appropriate.
- Disabled future layout tiles do not perform actions.
- The density toggle exposes one selected value and supports keyboard activation.
- The `Preview` row is a button with the current value in its accessible name.
- The nested popover uses Radix focus management.
- Each preview option has an accessible name and description.
- The selected preview option exposes selected state and a visible checkmark.
- Preview up/down buttons and Full page back button have descriptive labels.
- Keyboard navigation does not trap focus or break normal tab order.
- Component tests include axe checks for the panel and full-page preview.
## Tech spec

### Prerequisites and references

- Issue #37 and `context-human/specs/feature-collection-viewer-foundation.md` for the original collection body, row rendering, and side detail rail.
- Issue #38 and `context-human/specs/feature-named-views-and-view-chips.md` for named views, active-view preferences, and persisted `collection_views`.
- Issue #39 and `context-human/specs/enhancement-view-settings-menu-shell.md` for `ViewConfig`, `ViewSettingsMenu`, `PanelHeader`, `TopSheet`, config patch persistence, and placeholder sub-panels.
- `context-agent/collections/collection-read.md`, especially `Layout sub-panel`, `Preview`, `Previews`, `Keyboard navigation`, and `Row rendering`.
- `context-agent/design-system.md` for tokens, primitives, `IconButton`, `Popover`, disabled-button semantics, shortcut handling, and collection header patterns.
- ADR-002 for Tauri + React architecture.
- ADR-003 for local-first single-user v1.
- ADR-008 for the split between persisted view data and per-user preferences.
### View config usage

Issue #39 defines a typed `ViewConfig` with a layout section similar to:
```typescript
export type LayoutType = "table";
export type ViewDensity = "compact" | "regular";
export type PreviewSurface = "side-peek" | "bottom-peek" | "full-page";

export type ViewConfig = {
  layout: {
    type: LayoutType;
    density: ViewDensity;
    preview: PreviewSurface;
  };
  // propertyVisibility, sort, group, filters, conditionalColor...
};
```
This enhancement should reuse that model. Do not create a second layout-config type unless it is a narrow UI helper that maps directly to `ViewConfig.layout`.
Expected defaults:
```typescript
layout: {
  type: "table",
  density: "regular",
  preview: "side-peek",
}
```
Config changes should use the existing `onPatchConfig(viewId, config)` path from `ViewSettingsMenu` and `CollectionViewerPage`. The implementation may add helper functions such as `patchLayoutConfig(config, patch)` if that keeps updates small and safe.
### Layout panel components

Update or add these files:
- `src/views/collection/menu/sub-panels/LayoutPanel.tsx`
- `src/views/collection/menu/sub-panels/PreviewPopover.tsx`
Suggested `LayoutPanel` props:
```typescript
type LayoutPanelProps = {
  config: ViewConfig;
  onPatchConfig: (config: ViewConfig) => void | Promise;
  onBack: () => void;
  onClose: () => void;
};
```
If issue #39 already uses a different prop shape for stub panels, extend that shape instead of replacing the menu architecture.
`LayoutPanel` responsibilities:
- Render the shared panel header with title `Layout`.
- Render the `Type` tile grid.
- Render the `Display` section label.
- Render the density segmented toggle.
- Render the `Preview` row.
- Own the nested popover open state or delegate it to `PreviewPopover`.
- Patch only `config.layout` when controls change.
- Leave unrelated config sections untouched.
`PreviewPopover` responsibilities:
- Render the three preview options.
- Accept the current preview value.
- Call `onSelect(preview)` when a row is picked.
- Close after a successful pick.
- Render selected state with both checkmark and accessible state.
### Collection body density

Update the collection row path so `ViewConfig.layout.density` controls vertical padding. Likely files:
- `src/features/collection-viewer/CollectionViewerPage.tsx`
- `src/views/collection/Body.tsx`
- `src/views/collection/Row.tsx`
`CollectionViewerPage` should normalize the active view config and pass density into the generic body. `Body` may pass density to each row. `Row` should map density to token-based classes, for example compact `py-1` and regular `py-2`, if those match existing row rhythm.
Do not let density change horizontal padding, row height tokens outside the row, font size, cell visibility, or detail layout.
### Preview model

Extend the collection detail layer so one selected item can render in three surfaces. Likely files:
- `src/views/collection/Detail.tsx`
- `src/views/collection/FullPagePreview.tsx`
- `src/features/collection-viewer/CollectionViewerPage.tsx`
`Detail.tsx` can become a generic detail host that accepts `surface: "side-peek" | "bottom-peek"` and renders the correct frame, or the page can compose separate side and bottom wrappers around the same entity detail body. Keep the entity detail component unaware of which surface hosts it.
Suggested host props:
```typescript
type DetailProps = {
  item: TItem;
  entity: EntityContract;
  surface: "side-peek" | "bottom-peek";
  index: number;
  total: number;
  canMovePrevious: boolean;
  canMoveNext: boolean;
  onClose: () => void;
  onMovePrevious: () => void;
  onMoveNext: () => void;
};
```
The side and bottom hosts use the navigation props to render the same `M of N` position and up/down controls as Full page, while keeping their `X` close affordance.
`FullPagePreview.tsx` should render the entity's detail component with the full-page nav strip. Suggested props:
```typescript
type FullPagePreviewProps = {
  item: TItem;
  entity: EntityContract;
  index: number;
  total: number;
  canMovePrevious: boolean;
  canMoveNext: boolean;
  onBack: () => void;
  onMovePrevious: () => void;
  onMoveNext: () => void;
};
```
The selected item's index must come from the current display order, not the raw unsorted array. If issue #40 lands before sort/group/filter are implemented, use the same ordered array the body currently renders. Later issues can update that display-order pipeline without changing the preview components.
### Collection viewer page wiring

`CollectionViewerPage` should:
1. Load issues, views, and preferences as it does after issues #37-#39.
2. Determine the active view.
3. Normalize active view config.
4. Pass `config.layout` into the collection body and detail surface selection.
5. Pass layout config and patch handler into `ViewSettingsMenu` / `LayoutPanel`.
6. Track `selectedId` as it does today.
7. Derive `selectedItem`, `selectedIndex`, and `displayItems` from the current body display order.
8. Render one of three selected-detail states:
	- Side detail rail for `side-peek`.
	- Bottom detail pane for `bottom-peek`.
	- Full-page preview for `full-page`.
9. Keep the row highlighted when returning from Full page.
10. Preserve existing loading, empty, and error states.
When the preview changes while an item is already selected, the current selection should remain selected and move to the newly chosen surface.
### Keyboard navigation hook

Add:
- `src/views/collection/useKeyboardNavigation.ts`
Suggested API:
```typescript
type UseKeyboardNavigationArgs = {
  enabled: boolean;
  mode: "side-peek" | "bottom-peek" | "full-page";
  selectedIndex: number;
  total: number;
  onMovePrevious: () => void;
  onMoveNext: () => void;
  onExitFullPage: () => void;
};
```
Behavior:
- No-op when `enabled` is false or no row is selected.
- `ArrowUp` moves previous when possible.
- `ArrowDown` moves next when possible.
- In Full page only, `k` moves previous and `j` moves next.
- In Full page only, `Escape` exits to the list.
- Ignore events from input, textarea, select, and content-editable targets.
- Prevent default scrolling only when the hook handles the key.
- Do not clear selection for `Escape` in Side or Bottom.
If the repository's `useShortcut` hook is a better fit, use it for page-level bindings, but make sure the behavior is scoped to the mounted collection page and respects form-field filtering.
### Persistence and error handling

All layout changes persist through the existing `collectionViewSave` path. Use save-first-then-update unless current code already uses an optimistic pattern with rollback. If save fails, leave the visible value at the last saved config or show a safe non-blocking error if the page already has an inline error pattern.
Do not expose raw SQL, stack traces, local paths beyond normal app paths, tokens, Jira secrets, or source-system payloads in UI errors. Config normalization failures should fall back to `Table · Regular · Side` and log only safe details.
### Design-system maintenance

Implementation should update `context-agent/design-system.md` only if the code introduces a new reusable primitive, changes the shared collection menu pattern, or changes documented component contracts. If the enhancement only fills in the existing documented layout-panel behavior, a design-system update may not be required.
### Testing plan

**Unit and component tests**
- `LayoutPanel` renders `Type`, `Display`, density controls, and the `Preview` row.
- `LayoutPanel` shows `Table` selected and all five non-table tiles disabled.
- Clicking disabled layout tiles does not patch config.
- Clicking `Compact` patches `layout.density` to `compact` and preserves the rest of the config.
- Clicking `Regular` patches `layout.density` to `regular` and preserves the rest of the config.
- `PreviewPopover` renders three options with descriptions.
- `PreviewPopover` marks the current option with a checkmark and selected state.
- Picking each preview option calls the correct value and closes the popover.
- `Row` or `Body` applies compact vs. regular vertical padding and keeps horizontal padding unchanged.
- `Detail` renders side rail at 440px and bottom pane at 280px, each with `M of N` and up/down buttons.
- `FullPagePreview` renders back button, `M of N`, up/down buttons, and `j` / `k` hint.
- `FullPagePreview` calls the correct handlers for back, previous, and next.
- `useKeyboardNavigation` advances and retreats through a fixture list.
- `useKeyboardNavigation` ignores form-field key events.
- `useKeyboardNavigation` handles `Esc` only in Full page.
- Layout panel and full-page preview have no axe violations.
**Page integration tests**
- `CollectionViewerPage` passes active view density to rows.
- Changing density through the layout panel saves the active view config and updates row padding.
- Side opens the existing right rail with `M of N` navigation.
- Bottom opens the bottom pane with `M of N` navigation and leaves the list visible above it.
- Full page hides the list and shows the nav strip.
- Switching preview while a row is selected keeps the same selected item.
- Pressing `j` in Full page selects the next displayed item.
- Pressing `Esc` in Full page returns to the list with the current row highlighted.
- Pressing `ArrowUp` / `ArrowDown` moves selection in Side and Bottom.
**Playwright / end-to-end**
- Open the Jira viewer and open view settings.
- Open the `Layout` panel and verify `Table` is active while `Board`, `List`, `Gallery`, `Timeline`, and `Calendar` are disabled.
- Toggle density and verify row vertical padding changes.
- Choose `Bottom`, click a row, and see a bottom detail pane.
- Choose `Full page`, click a row, and see the list disappear and the nav strip appear.
- Press `j` and see the next item.
- Press `Esc` and see the list return with the row still highlighted.
- Choose `Side` and verify the 440px right rail still works.
### Verification commands

Run targeted checks first, then broader checks:
```bash
npm test -- LayoutPanel
npm test -- PreviewPopover
npm test -- useKeyboardNavigation
npm test -- FullPagePreview
npm test -- CollectionViewerPage
npm test
npm run lint
npm run build
```
If Playwright coverage is added or updated, run the focused e2e test before the broader suite. If generated bindings do not change, no binding generation is needed for this enhancement.
## Task decomposition

- [ ] **Story: Build the functional Layout sub-panel**
	- **Description:** Replace the placeholder layout panel with real layout type, density, and preview controls bound to the active view config.
	- **Acceptance criteria:**
		- [ ] `LayoutPanel` renders the shared sub-panel header with title `Layout`.
		- [ ] The `Type` section renders a 3-column grid with `Table`, `Board`, `List`, `Gallery`, `Timeline`, and `Calendar`.
		- [ ] `Table` is enabled and selected.
		- [ ] The five non-table tiles are visible and disabled.
		- [ ] The `Display` section renders a `Compact` / `Regular` density toggle.
		- [ ] The `Preview` row shows the current preview and opens a nested popover.
		- [ ] Config patches update only `ViewConfig.layout` and preserve unrelated config fields.
		- [ ] Tests cover rendering, disabled tiles, density patching, preview row behavior, and accessibility.
	- **Dependencies:** Issue #39 `ViewSettingsMenu`, typed `ViewConfig`, and config patch persistence.
	- [ ] **Task: Replace the LayoutPanel placeholder**
		- Add the real panel body under `src/views/collection/menu/sub-panels/LayoutPanel.tsx`. Reuse `PanelHeader` and existing menu spacing patterns.
	- [ ] **Task: Add layout type tiles**
		- Render the six layout tiles with token-based selected and disabled states. Keep non-table tiles non-interactive.
	- [ ] **Task: Add density toggle behavior**
		- Wire `Compact` and `Regular` to patch `config.layout.density` through the existing config save callback.
	- [ ] **Task: Add layout panel tests**
		- Cover tile states, density changes, disabled tile no-ops, and axe accessibility.
- [ ] **Story: Add the Preview popover**
	- **Description:** Add a nested popover for choosing where item detail opens.
	- **Acceptance criteria:**
		- [ ] `PreviewPopover` renders `Side`, `Bottom`, and `Full page` with icon, name, and one-line description.
		- [ ] The current value shows a visible checkmark and accessible selected state.
		- [ ] Selecting an option patches `ViewConfig.layout.preview` to the correct value.
		- [ ] Selecting an option closes the nested popover but leaves the view-settings menu open.
		- [ ] Tests cover all option clicks and selected-state rendering.
	- **Dependencies:** Functional `LayoutPanel` and issue #39 popover primitives.
	- [ ] **Task: Build ****`PreviewPopover`**
		- Create `src/views/collection/menu/sub-panels/PreviewPopover.tsx` and wire it to the row in `LayoutPanel`.
	- [ ] **Task: Wire preview config patching**
		- Patch only `config.layout.preview` and preserve other layout and view config values.
	- [ ] **Task: Add popover tests**
		- Verify rendering, accessible labels/descriptions, selected state, close-on-pick, and emitted values.
- [ ] **Story: Apply density to collection rows**
	- **Description:** Make the active view's density value control row vertical padding in the collection body.
	- **Acceptance criteria:**
		- [ ] `CollectionViewerPage` passes normalized active-view density to the collection body.
		- [ ] `Body` and `Row` accept density without becoming Jira-specific.
		- [ ] Compact rows use tighter vertical padding than regular rows.
		- [ ] Density changes do not alter horizontal padding, property order, cell visibility, or detail selection behavior.
		- [ ] Tests prove compact and regular classes or computed row spacing differ as expected.
	- **Dependencies:** Existing collection body and active view config normalization.
	- [ ] **Task: Thread density through the body**
		- Add density props to `CollectionViewerPage`, `Body`, and `Row` using the least invasive generic shape.
	- [ ] **Task: Map density to token classes**
		- Use existing spacing utilities for compact and regular vertical padding.
	- [ ] **Task: Add density tests**
		- Cover row padding updates and ensure unrelated row layout stays stable.
- [ ] **Story: Support side, bottom, and full-page previews**
	- **Description:** Render selected entity detail according to `ViewConfig.layout.preview`.
	- **Acceptance criteria:**
		- [ ] `side-peek` renders the existing 440px right rail with close `X`.
		- [ ] `bottom-peek` renders a 280px bottom pane with close `X`.
		- [ ] `full-page` hides the list and renders detail with a nav strip.
		- [ ] The same entity detail component renders in all three surfaces.
		- [ ] Changing preview while an item is selected keeps the selected item.
		- [ ] Returning from Full page leaves the current row selected and highlighted.
		- [ ] Tests cover all three previews.
	- **Dependencies:** Preview config from the active view and existing entity detail contract.
	- [ ] **Task: Extend ****`Detail`**** for side and bottom surfaces**
		- Update `src/views/collection/Detail.tsx` or add small wrapper components to render the correct side/bottom frames without importing Jira-specific code.
	- [ ] **Task: Add ****`FullPagePreview`**
		- Create `src/views/collection/FullPagePreview.tsx` with back, shared position/up-down navigation, keyboard hints, and entity detail body.
	- [ ] **Task: Wire surface selection in ****`CollectionViewerPage`**
		- Branch rendering based on normalized `config.layout.preview`. Preserve selected item state across surface changes.
	- [ ] **Task: Add preview tests**
		- Cover side, bottom, and full-page rendering, close/back behavior, and selected-row preservation.
- [ ] **Story: Add keyboard navigation for previews**
	- **Description:** Add shared keyboard navigation that walks the current display order while a preview is open.
	- **Acceptance criteria:**
		- [ ] `ArrowUp` and `ArrowDown` move selection in Side, Bottom, and Full page.
		- [ ] `j` and `k` mirror down/up only in Full page.
		- [ ] `Esc` exits Full page and returns to the list.
		- [ ] `Esc` does not clear selection in Side or Bottom.
		- [ ] Navigation clamps at the first and last displayed item.
		- [ ] Keyboard handling ignores form fields and content-editable targets.
		- [ ] Tests cover movement, clamping, mode-specific keys, and ignored targets.
	- **Dependencies:** Display-order derivation and preview wiring.
	- [ ] **Task: Create ****`useKeyboardNavigation`**
		- Add `src/views/collection/useKeyboardNavigation.ts` or use the existing shortcut helper with equivalent behavior and tests.
	- [ ] **Task: Derive navigation state from display order**
		- In `CollectionViewerPage`, compute selected index and move handlers from the ordered items currently shown in the body.
	- [ ] **Task: Wire Full page controls**
		- Connect `FullPagePreview` up/down buttons and `j` / `k` behavior to the same movement handlers.
	- [ ] **Task: Add keyboard navigation tests**
		- Cover fixture lists, no selected item, first/last item clamping, form-field filtering, and `Esc` behavior.
- [ ] **Story: Verify and document the enhancement**
	- **Description:** Add focused test coverage and run the relevant verification commands for the complete layout sub-panel behavior.
	- **Acceptance criteria:**
		- [ ] Unit and component tests cover panel controls, popover behavior, density, previews, and keyboard navigation.
		- [ ] Playwright covers switching to Bottom and Full page, keyboard movement, and return to list.
		- [ ] `npm test` passes.
		- [ ] `npm run lint` passes.
		- [ ] `npm run build` passes.
		- [ ] Any skipped e2e or manual Tauri checks are documented with a reason.
		- [ ] `context-agent/design-system.md` is updated if the implementation changes shared UI contracts.
	- **Dependencies:** Stories 1-5.
	- [ ] **Task: Add focused tests**
		- Add or update tests for `LayoutPanel`, `PreviewPopover`, `Row`/`Body`, `Detail`, `FullPagePreview`, `useKeyboardNavigation`, and `CollectionViewerPage`.
	- [ ] **Task: Add Playwright coverage**
		- Extend the existing collection viewer flow or add a focused layout settings e2e test with deterministic fixture data.
	- [ ] **Task: Run verification**
		- Run targeted tests first, then `npm test`, `npm run lint`, and `npm run build`. Document any skipped checks.
	- [ ] **Task: Update durable context if needed**
		- Update `context-agent/design-system.md` only if implementation changes the shared collection menu or preview contract beyond what is already documented.
## Open questions and implementation notes

- The issue verification text says "Three layout tiles disabled" but names every non-table tile: `Board`, `Timeline`, `Calendar`, `List`, and `Gallery`. Treat this as five disabled non-table tiles.
- If issue #39's `ViewConfig` names differ from this spec, keep the existing implemented names and preserve the behavior: table-only layout, compact/regular density, and side/bottom/full preview.
- If the current collection body does not expose a single display-order array, create the smallest helper needed so body rendering, keyboard navigation, and `M of N` all use the same order.
- The full-page detail should reuse the entity detail body. Do not fork Jira-specific detail rendering just for Full page.
- Playwright coverage may need seeded collection data. If the e2e harness cannot seed local Jira rows yet, add the unit/page coverage and document the manual verification path rather than depending on a developer's personal database.