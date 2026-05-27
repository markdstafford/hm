---
created: 2026-05-27
last_updated: 2026-05-27
status: implementing
issue: 39
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# View settings menu shell

## What

`hm` needs the first working view-settings menu for collection views. This enhancement replaces the disabled sliders icon in `CollectionHeader` with a live popover menu bound to the active named view.
The menu has a top sheet with a rename textbox and six category rows: `Layout`, `Property visibility`, `Sort`, `Group`, `Filter`, and `Conditional color`. Clicking an enabled category drills into a sub-panel with a back arrow, the panel title, a close button, and a short placeholder body. The real controls for those sub-panels land in issues #40-#44; this issue ships the navigation shell, rename flow, config schema, summary text, persistence round-trip, click-outside dismissal, and `Esc` dismissal.
After this enhancement, a user can open view settings from the Jira issue collection, rename the active view inline, navigate into each enabled stub panel, return to the top sheet, and close the menu from any panel. The active view's `config_json` stores a typed default configuration instead of an opaque empty blob, so later issues can add real controls without redefining persistence.
## Why

Named views already give users places to save alternate collection configurations, but the settings affordance still says "coming next." The next step is to make that affordance real without taking on the full complexity of layout, visibility, sort, group, and filter editing in one large change.
Shipping the shell first creates the user-facing structure and the technical seam future issues need. It proves the menu placement, panel navigation, rename commit behavior, active-view binding, and config persistence before sub-panels start mutating the collection body. This keeps issues #40-#44 smaller and reduces the chance that each sub-panel implements its own chrome or persistence pattern.
## Personas

- **Elena: EM** — wants to rename active Jira issue views in the same place where she will later adjust layout, sort, and filters.
- **Priya: PM** — wants the collection viewer to feel intentional and stable as configurable views become visible in the product.
- **Tarek: Team member** — wants to explore the available view settings categories, understand what is coming, and back out without losing context.
- **Future collection implementer** — needs a reusable menu shell, typed view config, and panel structure that later collection entities can use.
- **Maintainer** — needs tested menu navigation and config round-trip behavior before later issues add stateful sub-panel controls.
## Narratives

### Elena renames a view from the settings menu

Elena opens `hm` and goes to the Jira issue collection. The named view chips are above the issue list, and the sliders icon now behaves like an active button. She clicks it and sees a compact `View settings` panel anchored at the right end of the collection header.
The top sheet shows a textbox with the active view name. Elena changes `Mine` to `Assigned to me` and presses `Enter`. The active chip updates immediately, and the renamed view persists through the existing collection view save path.
She clicks outside the menu. The menu closes, and the issue list remains where it was.
### Tarek explores the menu shell

Tarek creates a scratch view and opens the view-settings menu. He sees six rows in order: `Layout`, `Property visibility`, `Sort`, `Group`, `Filter`, and `Conditional color`. Each enabled row has an icon, a label, a current-value summary, and a chevron.
He clicks `Sort`. The menu drills into a `Sort` panel with a back arrow on the left and a close button on the right. The panel body says `Coming in #42`, making it clear that the shell exists but the controls are deferred.
Tarek clicks the back arrow and returns to the top sheet. He presses `Esc`, and the entire menu closes.
### Priya verifies that the menu is safe to ship

Priya opens the menu on each default view. The top-sheet summaries reflect the typed default config: layout is `Table · Regular`, property visibility shows the number of visible properties out of total properties, sort and group say `None` unless the config declares values, and filter says `None` when no filters are active.
The disabled `Conditional color` row says `Soon` and has no chevron. Clicking it does nothing. Priya can see the future shape without encountering a half-working control.
## User stories

**Elena renames the active view**
- Elena can open the view-settings menu from the sliders icon in the collection header.
- Elena can see a rename textbox prefilled with the active view's display name.
- Elena can commit a rename by blurring the textbox.
- Elena can commit a rename by pressing `Enter`.
- Elena sees the active chip update after the rename commits.
- Elena cannot save an empty or whitespace-only view name.
**Tarek navigates the menu shell**
- Tarek can see category rows in the required order: Layout, Property visibility, Sort, Group, Filter, Conditional color.
- Tarek can click `Layout`, `Property visibility`, `Sort`, `Group`, or `Filter` and see the matching sub-panel.
- Tarek can use the back arrow in a sub-panel to return to the top sheet.
- Tarek can click the close button in the top sheet or any sub-panel to dismiss the menu.
- Tarek can press `Esc` in any panel to dismiss the menu.
- Tarek can click outside the menu to dismiss it.
**Future implementer extends the shell**
- Future implementer can add real controls to a sub-panel without changing the menu's panel navigation or header chrome.
- Future implementer can read and patch a typed `ViewConfig` from the active view.
- Future implementer can persist config changes through `collectionViewSave`.
- Future implementer can rely on top-sheet summary helpers for the rows later controls mutate.
## Goals

- Add `src/views/collection/ViewConfig.ts` with the full view config shape needed for layout, property visibility, sort, group, filters, and conditional color placeholders.
- Provide default `ViewConfig` values for collection views and a normalizer for older `{}` configs.
- Update collection view list/save mapping so `config_json` round-trips as the typed config without losing unknown future keys.
- Replace the disabled `CollectionHeader` settings icon with a live trigger.
- Add `src/views/collection/menu/ViewSettingsMenu.tsx` as the popover container and panel state owner.
- Add `PanelHeader`, `TopSheet`, and stub sub-panel components under `src/views/collection/menu/`.
- Support panel state values: `top`, `layout`, `property-visibility`, `sort`, `group`, and `filter`.
- Render the top sheet category rows with icon, label, summary, disabled state where relevant, and chevron for enabled rows.
- Commit rename changes on blur and `Enter` through the existing `onRename` handler.
- Persist active-view config patches through `collectionViewSave` whenever the menu changes config.
- Dismiss the menu on outside click, `Esc`, and close-button click.
- Keep styles on existing design-system tokens and Radix primitives.
- Update `context-agent/design-system.md` because the shared collection header pattern changes from a placeholder settings icon to a live menu pattern.
- Cover rename, panel navigation, dismissal, config summary, persistence, accessibility, and Playwright behavior with tests.
## Non-goals

- No real sub-panel controls for layout, property visibility, sort, group, or filter. Those land in #40-#44.
- No collection body changes based on config beyond summary text and persistence.
- No property reorder, visibility toggles, sort editing, group editing, filter editing, preview-surface changes, or density changes.
- No conditional color controls. The row is visible but disabled with `Soon`.
- No changes to Jira ingestion, source configuration, credentials, AI providers, or app preferences beyond existing active-view behavior.
- No new normalized database tables for view settings.
- No mixed-entity collections.
- No redesign of named view chips or chip context-menu CRUD.
## Design spec

### Information architecture

This enhancement stays within the existing Jira issue collection page. It does not add a new route, sidebar item, or global settings category.
```plain text
Jira issues
└── Collection header
    ├── View chips
    └── View settings trigger
        └── View settings menu
            ├── Top sheet
            ├── Layout panel
            ├── Property visibility panel
            ├── Sort panel
            ├── Group panel
            └── Filter panel
```
The menu is bound to the active view. If the active chip changes while the menu is open, the menu should either close or refresh to the new active view. Prefer closing on active-view change for this shell because it avoids stale rename and config state.
### Trigger and placement

`CollectionHeader` replaces the disabled settings placeholder with an enabled `IconButton` using the existing `SlidersHorizontal` icon. Its accessible label should be `Open view settings` or equivalent.
The menu opens as a popover anchored to the trigger near the title-bar end of the content area. It should align to the right edge of the trigger so the panel stays visually attached to the collection header. Use a width around 320-360px unless existing popover constraints require a slightly different size.
The trigger remains in the same 32px header row. View chips stay left; the settings trigger stays right.
### Menu container behavior

`ViewSettingsMenu` owns:
- `open`: whether the popover is visible.
- `panel`: `top`, `layout`, `property-visibility`, `sort`, `group`, or `filter`.
- Draft rename text for the active view.
- The active view config and patch callback.
Opening the menu always starts at `panel: "top"`. Closing resets panel state to `top` for the next open.
Dismissal rules:
- Click the trigger while closed: open at the top sheet.
- Click outside the popover: close the menu.
- Press `Esc`: close the menu from any panel.
- Click the close `X`: close the menu from any panel.
- Click a sub-panel back arrow: return to the top sheet without closing.
### Top sheet

The top sheet uses this structure:
```plain text
┌─────────────────────────────────────────────┐
│  View settings                          [X] │
├─────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐  │
│  │ View name                             │  │
│  │ Mine                                  │  │
│  └───────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│  ◫  Layout              Table · Regular  ›  │
│  ◉  Property visibility       7 of 12    ›  │
│  ⇅  Sort                         None    ›  │
│  ▥  Group                        None    ›  │
│  ⊜  Filter                       None    ›  │
│  ◐  Conditional color            Soon       │
└─────────────────────────────────────────────┘
```
The header shows `View settings` and a close icon button.
The rename textbox:
- Is labelled `View name`.
- Is controlled from the active view's display name.
- Commits on blur.
- Commits on `Enter`.
- Trims whitespace before save.
- Rejects an empty trimmed value and restores the last valid active-view name or shows an inline error.
- Does not commit on every keystroke.
The category rows render in this exact order:
1. Layout
2. Property visibility
3. Sort
4. Group
5. Filter
6. Conditional color
Enabled rows have an icon, label, current-value summary, and chevron-right. Disabled rows render with the same row rhythm but use `Soon`, dimmed styling, no chevron, and no click action.
### Current-value summaries

Summaries read from the active view's normalized `ViewConfig`.
- **Layout:** `Table · Compact` or `Table · Regular`.
- **Property visibility:** `N of M`, where `N` is visible properties and `M` is total configured or entity-declared properties.
- **Sort:** first sort level's property label plus arrow, such as `Updated ↓`; otherwise `None`.
- **Group:** group property label; otherwise `None`.
- **Filter:** `N active` for one or more active filters; otherwise `None`.
- **Conditional color:** always `Soon` in this issue.
If a config references a property id that the current entity no longer exposes, the summary should fall back safely: use the id as text only if no label exists, or use `Unknown property`. Do not crash the menu.
### Sub-panels

Every enabled sub-panel shares the same chrome:
```plain text
┌─────────────────────────────────────────────┐
│  ←  Sort                                [X] │
├─────────────────────────────────────────────┤
│  Coming in #42                              │
└─────────────────────────────────────────────┘
```
`PanelHeader` renders:
- Back arrow button on sub-panels only.
- Panel title.
- Close `X` button on all panels.
Stub panel body copy:
- `LayoutPanel`: `Coming in #40`
- `PropertyVisibilityPanel`: `Coming in #41`
- `SortPanel`: `Coming in #42`
- `GroupPanel`: `Coming in #43`
- `FilterPanel`: `Coming in #44`
The body should be plain, low-noise text. It should not look like a disabled form.
### Accessibility

- The trigger has a clear accessible label.
- The popover content has a labelled title.
- Focus moves into the menu when it opens, following the existing Radix popover behavior.
- `Esc` closes from top sheet and sub-panels.
- The close button is keyboard reachable and has an accessible label such as `Close view settings`.
- Sub-panel back buttons have labels such as `Back to view settings`.
- Category rows are buttons when enabled and non-interactive when disabled.
- The rename input is labelled and supports `Enter`.
- The menu has no axe violations in component tests.
## Tech spec

### Prerequisites and references

- Issue #38 and `context-human/specs/feature-named-views-and-view-chips.md` for named views, chip CRUD, active-view preferences, and `collection_views`.
- `context-agent/collections/collection-read.md`, especially `View settings menu`, `Top sheet`, `Sub-panels`, `Persistence`, and `Entity contract`.
- `context-agent/design-system.md` for tokens, `IconButton`, `Popover`, menu styling rules, and the design-system maintenance contract.
- ADR-002 for the Tauri + React architecture.
- ADR-003 for local-first single-user behavior.
- ADR-004 for SQLite as the primary local store.
- ADR-008 for the split between view data in SQLite and active-view preference in the preferences file.
### View config model

Add `src/views/collection/ViewConfig.ts`.
Suggested shape:
```typescript
export type LayoutType = "table";
export type ViewDensity = "compact" | "regular";
export type PreviewSurface = "side-peek" | "bottom-peek" | "full-page";

export type PropertyVisibilityConfig = {
  property: string;
  side: "left" | "right";
  visible: boolean;
};

export type SortDirection = "asc" | "desc";

export type SortLevelConfig = {
  property: string;
  direction: SortDirection;
};

export type GroupConfig = {
  property: string | null;
  hideEmptyGroups: boolean;
};

export type FilterConfig = {
  id: string;
  property: string;
  operator: string;
  value: unknown;
  active: boolean;
};

export type ConditionalColorConfig = {
  enabled: false;
  rules: [];
};

export type ViewConfig = {
  layout: {
    type: LayoutType;
    density: ViewDensity;
    preview: PreviewSurface;
  };
  propertyVisibility: PropertyVisibilityConfig[];
  sort: SortLevelConfig[];
  group: GroupConfig;
  filters: FilterConfig[];
  conditionalColor: ConditionalColorConfig;
};
```
The exact field names may differ if implementation finds a clearer convention, but the config must cover layout, density, preview surface, property visibility, sort levels, grouping, filters, and conditional color as a disabled placeholder.
Add helpers:
- `defaultViewConfig(entity)` — builds a full config from the entity's default properties.
- `normalizeViewConfig(config, entity)` — accepts `unknown`, upgrades `{}` to defaults, preserves valid known fields, and falls back safely for invalid fields.
- `summarizeViewConfig(config, entity)` — returns the top-sheet summary strings.
- `patchViewConfig(config, patch)` — merges small updates without dropping unknown future keys if the chosen representation supports them.
Older collection views may have `{}` in `config_json` from issue #38. They must normalize to a full default config at read time. The app may persist the normalized config when the user first saves a rename or config patch, but it should not require a migration to use old views.
### Persistence and command mapping

The existing SQLite table stores config in `collection_views.config_json`. Do not add normalized settings tables for this issue.
Update the TypeScript mapping around `fromCollectionViewRecord` and `toCollectionViewSaveInput` so:
- Listed views expose `config` as a normalized `ViewConfig` for the current entity when consumed by the collection viewer.
- Saved views write a serializable config object back through the existing `collectionViewSave` command.
- Unknown config payloads fail safely and use defaults rather than crashing the page.
- Existing Rust validation still requires valid JSON.
If the generic collection-view type remains entity-agnostic, keep raw `config: unknown` at the generic boundary and normalize in the collection page/menu where the entity contract is available.
### UI components

Add these files:
- `src/views/collection/menu/ViewSettingsMenu.tsx`
- `src/views/collection/menu/PanelHeader.tsx`
- `src/views/collection/menu/TopSheet.tsx`
- `src/views/collection/menu/sub-panels/LayoutPanel.tsx`
- `src/views/collection/menu/sub-panels/PropertyVisibilityPanel.tsx`
- `src/views/collection/menu/sub-panels/SortPanel.tsx`
- `src/views/collection/menu/sub-panels/GroupPanel.tsx`
- `src/views/collection/menu/sub-panels/FilterPanel.tsx`
Suggested props for `ViewSettingsMenu`:
```typescript
type ViewSettingsMenuProps = {
  activeView: CollectionView | null;
  entity: EntityContract;
  onRenameView: (viewId: string, displayName: string) => void | Promise;
  onPatchConfig: (viewId: string, config: ViewConfig) => void | Promise;
};
```
The component may expose trigger composition if it fits Radix better:
```typescript

  ...

```
Either shape is acceptable if `CollectionHeader` owns layout and the menu owns open/panel state.
### Collection header wiring

Update `src/views/collection/CollectionHeader.tsx` so it receives the active view and entity data needed by the settings menu. The header should remain generic; it must not import Jira-specific defaults or Jira issue types.
Possible prop additions:
```typescript
activeView: CollectionView | null;
entity: EntityContract;
onPatchViewConfig: (viewId: string, config: ViewConfig) => void | Promise;
```
If generics make that prop shape awkward, move the `ViewSettingsMenu` composition into `CollectionViewerPage` and pass a `settingsSlot` or `settingsTrigger` into `CollectionHeader`. Prefer the least coupled shape that keeps `CollectionHeader` reusable.
### Collection viewer wiring

Update `src/features/collection-viewer/CollectionViewerPage.tsx` to:
1. Continue loading Jira issues, collection views, and preferences as it does today.
2. Determine the active `CollectionView` from `views` and `activeViewId`.
3. Normalize the active view config with `jiraIssueEntity`.
4. Pass active view, entity, rename handler, and config patch handler to the settings menu.
5. Persist rename commits through the existing `handleRename`.
6. Persist config patches by saving the active view with the updated config through `collectionViewSave`.
7. Keep the body rendering behavior unchanged for this issue.
Config patch failures should not corrupt local state. Prefer save-first-then-update unless a tested rollback path exists. Show a safe inline error such as `Could not save collection view` if a save fails.
### Error handling

- Do not expose raw SQL, local file paths beyond normal app paths, stack traces, tokens, or source-system secrets.
- If the active view is missing, the settings trigger may be disabled with a tooltip such as `Create or load a view first`.
- If config normalization fails, use defaults and log a safe warning.
- If rename save fails, leave the input at the last saved name or restore it after the failed commit.
- If config save fails, keep the menu open and show a small safe error if an existing feedback primitive is available.
### Design-system maintenance

Update `context-agent/design-system.md` in the implementation PR. The current doc says the settings icon is disabled until issue #39. It should instead document:
- `CollectionHeader` uses a live settings trigger.
- `ViewSettingsMenu` is the canonical collection view-settings menu shell.
- Top sheet and sub-panel chrome rules.
- Rename textbox commit behavior.
- Category row order and summary conventions.
- The disabled `Conditional color` row behavior.
### Testing plan

**Unit tests**
- `ViewConfig` normalizes `{}` to a full default config.
- `ViewConfig` preserves or safely ignores unknown/invalid fields without crashing.
- Summary helpers return `Table · Regular`, `N of M`, sort summary, group summary, filter summary, and `Soon` correctly.
- Rename textbox commits `onRenameView` on blur.
- Rename textbox commits `onRenameView` on `Enter`.
- Rename textbox rejects blank names.
- Clicking each enabled top-sheet category moves to the matching panel.
- Clicking a disabled `Conditional color` row does not change panel state.
- Clicking the back arrow returns to the top sheet.
- Clicking close dismisses the menu.
- Pressing `Esc` dismisses the menu from top sheet and sub-panels.
- Clicking outside dismisses the menu.
- Stub panels render the correct title and `Coming in #NN` body.
- Component rendering has no axe violations.
**Page/component integration tests**
- `CollectionHeader` renders an enabled settings trigger when an active view exists.
- Opening the menu shows the active view name and top-sheet summaries.
- Renaming through the menu updates the chip label.
- A config patch calls `collectionViewSave` with the active view id and updated config.
- Switching active chips while the menu is open closes or refreshes the menu according to the chosen implementation.
- Existing chip create, duplicate, delete, and active-view preference tests continue to pass.
**Playwright / end-to-end**
- Open the Jira viewer and click the settings icon.
- Rename the active view in the menu and see the chip update.
- Drill into Layout, Property visibility, Sort, Group, and Filter; each shows the correct title and placeholder body.
- Use the back arrow from each sub-panel to return to the top sheet.
- Click the close `X` and see the menu close.
- Reopen the menu, open a sub-panel, press `Esc`, and see the menu close.
- Reopen the menu and click outside it; the menu closes.
### Verification commands

Run targeted checks first, then broader checks:
```bash
npm test -- ViewConfig
npm test -- ViewSettingsMenu
npm test -- TopSheet
npm test -- CollectionHeader
npm test -- CollectionViewerPage
npm test
npm run lint
npm run build
```
If generated bindings change, run the repository's binding generation path before final verification. The current helper is documented in `src-tauri/src/lib.rs` as `cargo test generate_typescript_bindings`.
## Task decomposition

- [ ] **Story: Model typed collection view config**
	- **Description:** Add the `ViewConfig` shape, defaulting, normalization, patching, and summary helpers that convert old `{}` configs into the structure future sub-panels will mutate.
	- **Acceptance criteria:**
		- [ ] `src/views/collection/ViewConfig.ts` exports a typed config covering layout, density, preview surface, property visibility, sort, group, filters, and conditional color.
		- [ ] Default config is derived from the entity's default property list.
		- [ ] Existing `{}` configs normalize to a full default config.
		- [ ] Invalid or partial configs fail safely and do not crash the collection page.
		- [ ] Summary helpers return the strings needed by the top sheet.
		- [ ] Unit tests cover defaults, normalization, summaries, and safe fallback behavior.
	- **Dependencies:** Existing `EntityContract` and collection view type.
	- [ ] **Task: Define the config types**
		- Create `ViewConfig.ts` with the config type, supporting union types, and exported helper signatures.
	- [ ] **Task: Implement defaults and normalization**
		- Build defaults from the entity contract and normalize unknown persisted config values into a safe typed config.
	- [ ] **Task: Implement summaries**
		- Add summary helpers for layout, property visibility, sort, group, filter, and conditional color.
	- [ ] **Task: Add config tests**
		- Cover empty config upgrade, partial config merge, invalid config fallback, and each top-sheet summary.
- [ ] **Story: Build the view-settings menu shell**
	- **Description:** Add the popover menu, top sheet, shared panel header, and stub sub-panels with navigation and dismissal behavior.
	- **Acceptance criteria:**
		- [ ] Clicking the settings trigger opens the menu at the top sheet.
		- [ ] The top sheet shows the rename textbox and category rows in the required order.
		- [ ] Enabled category rows navigate to the correct stub sub-panel.
		- [ ] `Conditional color` renders as disabled with `Soon` and no chevron.
		- [ ] Sub-panels show a back arrow, title, close button, and correct `Coming in #NN` copy.
		- [ ] Back returns to the top sheet.
		- [ ] Close, outside click, and `Esc` dismiss the menu.
		- [ ] Component tests cover navigation, dismissal, and accessibility.
	- **Dependencies:** Story 1 summary helpers.
	- [ ] **Task: Create ****`ViewSettingsMenu`**
		- Implement Radix popover composition, `open` state, `panel` state, close handling, and trigger wiring.
	- [ ] **Task: Create ****`PanelHeader`**
		- Add shared header chrome for top sheet and sub-panels, with accessible back and close buttons.
	- [ ] **Task: Create ****`TopSheet`**
		- Render rename input, category rows, summaries, disabled conditional color row, and panel navigation callbacks.
	- [ ] **Task: Create stub sub-panels**
		- Add Layout, Property visibility, Sort, Group, and Filter panels with the shared header and placeholder body text.
	- [ ] **Task: Add menu tests**
		- Test opening, category navigation, back, close, outside click, `Esc`, disabled row behavior, and axe accessibility.
- [ ] **Story: Wire rename and config persistence**
	- **Description:** Connect the menu to active collection views so rename commits and config patches persist through the existing `collectionViewSave` path.
	- **Acceptance criteria:**
		- [ ] Rename commits on blur and `Enter`.
		- [ ] Blank rename commits are rejected.
		- [ ] Successful rename updates the active chip label.
		- [ ] Active view config is normalized before display.
		- [ ] Config patching saves the active view with updated config.
		- [ ] Save failures show safe errors and do not leave stale optimistic UI that cannot recover.
		- [ ] Tests prove rename and config save calls.
	- **Dependencies:** Stories 1 and 2.
	- [ ] **Task: Extend menu props**
		- Pass active view, entity contract, `onRenameView`, and `onPatchConfig` through the menu boundary.
	- [ ] **Task: Wire rename commit**
		- Reuse the page's existing rename handler and restore the draft input on failed save.
	- [ ] **Task: Wire config patch save**
		- Add a page handler that saves the active view with a normalized updated config via `collectionViewSave`.
	- [ ] **Task: Add integration tests**
		- Cover menu rename updating chips, save calls, blank-name rejection, and safe save-failure behavior.
- [ ] **Story: Replace the collection header placeholder**
	- **Description:** Replace the disabled settings icon in `CollectionHeader` with the live menu trigger while keeping the header reusable and token-based.
	- **Acceptance criteria:**
		- [ ] `CollectionHeader` no longer renders `View settings coming next` when an active view exists.
		- [ ] The settings trigger is enabled and has a clear accessible label.
		- [ ] Header layout remains a single 32px row with chips left and settings right.
		- [ ] The header remains entity-agnostic.
		- [ ] Existing chip CRUD tests continue to pass.
	- **Dependencies:** Story 2 menu component.
	- [ ] **Task: Adjust header API**
		- Add a `settingsSlot`, menu props, or another low-coupling API that lets the header render the live settings menu.
	- [ ] **Task: Update header tests**
		- Replace disabled-placeholder assertions with enabled-trigger and menu-opening assertions.
	- [ ] **Task: Verify chip behavior**
		- Run existing `ViewChips`, `ChipContextMenu`, and `CollectionHeader` tests after the header change.
- [ ] **Story: Document and verify the shared pattern**
	- **Description:** Update durable agent context and add end-to-end verification for the menu shell.
	- **Acceptance criteria:**
		- [ ] `context-agent/design-system.md` describes the live collection view-settings menu shell.
		- [ ] Playwright covers open, rename, sub-panel drill-in, back, close, `Esc`, and outside-click dismissal.
		- [ ] Targeted unit tests, broader unit tests, lint, and build run or any skipped checks are documented.
	- **Dependencies:** Stories 1-4.
	- [ ] **Task: Update design-system context**
		- Replace the issue #39 placeholder note with the shipped menu-shell rules and maintenance guidance.
	- [ ] **Task: Add Playwright coverage**
		- Extend the existing named views e2e path or add a focused view-settings menu test.
	- [ ] **Task: Run verification**
		- Run targeted tests first, then `npm test`, `npm run lint`, and `npm run build` when practical.
## Open questions and implementation notes

- The issue says disabled rows render `Conditional color`; it does not assign a future issue number for that category. Keep it as `Soon` without a sub-panel in this enhancement.
- The issue says placeholders should show "coming soon" for #39, but the category-specific future issues are #40-#44. Use the clearer per-panel copy `Coming in #40` through `Coming in #44`.
- Existing views may already have `{}` config blobs from issue #38. Do not require a database migration to use them.
- The collection body should not react to the typed config yet. Later issues own row density, property visibility, sorting, grouping, filters, and preview surfaces.
- If Radix Popover's default focus behavior conflicts with rename-input focus, prioritize predictable keyboard use: focus the first meaningful control in the menu when it opens.