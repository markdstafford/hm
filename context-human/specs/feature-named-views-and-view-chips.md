---
created: 2026-05-27
last_updated: 2026-05-27
status: implementing
issue: 38
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Named views and view chips

## What

`hm` needs named collection views so a user can switch between saved configurations of the Jira issue viewer. This feature adds the first visible layer of that model: a chip strip above the collection body, persistent named views in SQLite, and per-user active-view restoration through app preferences.
After this feature, the Jira issue viewer shows three default chips: `All open`, `Mine`, and `Recently updated`. The user can click a chip to make it active, click a trailing `+` chip to create a new view cloned from the current one, and right-click a chip to rename, duplicate, or delete it. View records and the last active view survive app restarts.
The view settings menu is not part of this feature. Each view carries a config blob so the persistence model is ready for issue #39, but the blob stays empty or uses a fixed placeholder. For issue #38, only the view name, chip order, active view, and CRUD behavior are user-controlled; every view still renders the same hardcoded Jira issue layout from the collection viewer foundation.
## Why

The collection viewer foundation can render Jira issues, but it has no user-facing concept of alternate views. The next step is to give users stable places to put different ways of looking at the same collection before the settings menu starts mutating sort, grouping, filters, and property visibility.
Shipping named views first keeps issue #39 smaller and safer. It creates the durable storage seam, the active-view preference, and the header layout without also needing to implement the full settings surface. Users get an immediate sign that the collection viewer is becoming configurable, and later work can focus on what a view controls rather than how views are created, selected, and persisted.
## Personas

- **Elena: EM** — wants fast access to a few recurring Jira issue views, such as all open work and her own assigned items, without rebuilding context each time she opens the app.
- **Priya: PM** — wants the Jira viewer to feel stable and intentional before more advanced roadmap and workstream views depend on the same collection pattern.
- **Tarek: Team member** — wants to create a scratch view while exploring issues and switch back to defaults without losing his place across restarts.
- **Future collection implementer** — needs a reusable named-view persistence and header model that later GitHub issues, PRs, hygiene suggestions, and history views can share.
- **Maintainer** — needs tests around persistence, preference restoration, and chip CRUD before the view settings menu starts changing the config blob.
## Narratives

### Elena switches between default views

Elena opens `hm` and clicks `Jira issues` in the sidebar. Above the issue rows, she sees chips for `All open`, `Mine`, and `Recently updated`, followed by a small `+` chip. `All open` is active by default and uses the primary accent, while the other chips sit quietly in the surface tone.
She clicks `Mine`. The active state moves to that chip and the app writes the active view id to preferences. The issue list itself does not change yet because issue #39 has not added real view settings, but Elena can see that the viewer now has a place for saved configurations.
Later she closes and reopens the app. The Jira viewer restores `Mine` as the active chip. She does not need to remember what she picked last time.
### Tarek creates a scratch view

Tarek is exploring a noisy Jira project and wants a temporary view he can shape later. He clicks the trailing `+` chip. `hm` creates a new named view by copying the currently active view's entity, placeholder config, and next chip position, names it `Untitled view`, persists it, and activates it immediately.
The new chip appears at the end of the strip before `+`. Tarek right-clicks it and chooses `Rename`, changes the name to `Tarek scratch`, and the chip updates in place. The name is saved to SQLite, while the active view id is saved to preferences.
When Tarek restarts `hm`, `Tarek scratch` is still present and active. He can later use issue #39's settings menu to make this view meaningful.
### Priya removes a view she does not use

Priya decides she does not need a copied view anymore. She right-clicks the chip, chooses `Delete`, and sees a confirmation dialog before the destructive action runs. She confirms, and the chip disappears.
If the deleted chip was active, `hm` picks the nearest remaining view in the strip. If the delete would leave the entity with no views, `hm` seeds a safe default view so the collection viewer never opens with an empty chip strip. Deleted default views are not silently recreated on the next launch.
## User stories

**Elena switches between named views**
- Elena can see a chip strip above the Jira issue rows.
- Elena can see the default Jira issue views `All open`, `Mine`, and `Recently updated` on first use.
- Elena can identify the active view because its chip uses the primary tone.
- Elena can click another chip and see the active state move to that chip.
- Elena can restart the app and see the last active Jira issue view restored.
**Tarek manages his own views**
- Tarek can click the trailing `+` chip to create a new view cloned from the current active view.
- Tarek can see the new view appear at the end of the chip strip before `+`.
- Tarek can right-click a chip to open a context menu with `Rename`, `Duplicate`, and `Delete`.
- Tarek can rename a view and see the chip label update after save.
- Tarek can duplicate a view and see the copy activate immediately.
- Tarek can delete a view only after confirming the destructive action.
**Future collection implementer reuses the model**
- Future implementer can define default named views for another entity without rewriting the chip strip.
- Future implementer can persist view records by entity kind.
- Future implementer can store entity-specific serialized view config without changing the base view table.
- Future implementer can restore one active view per entity through preferences.
## Goals

- Add a typed named-view shape under `src/views/collection/views/types.ts`.
- Persist named views in a `collection_views` SQLite table created during app startup schema setup.
- Add Tauri commands and generated TypeScript bindings for listing, saving, and deleting collection views.
- Store the active view id per collection entity in `preferences.collections.activeViewId`.
- Seed default views for an entity on first use, idempotently, without recreating deleted defaults on later launches.
- Add Jira issue default views: `All open`, `Mine`, and `Recently updated`.
- Add a `ViewChips` component that renders view chips, active state, and a trailing `+` chip.
- Add a `ChipContextMenu` component using Radix `ContextMenu` and `AlertDialog` primitives.
- Add a `CollectionHeader` component that places chips on the left and a placeholder settings icon on the right in one vertically centered row.
- Wire `CollectionViewerPage` to load views, seed defaults, restore active view, and persist view CRUD.
- Keep all visual styling on design-system tokens and existing primitives.
- Cover chip rendering, context menu behavior, Rust persistence, page wiring, and restart persistence with tests.
## Non-goals

- No view settings menu behavior; the settings icon is present but opens nothing in this feature.
- No real sort, group, filter, property visibility, density, layout, or preview-surface changes per view.
- No chip drag-to-reorder.
- No inline rename textbox inside the future view settings menu unless implementation needs a temporary rename dialog for issue #38.
- No sub-panels from issues #40-#44.
- No changes to Jira issue ingestion or source configuration.
- No GitHub issue, GitHub PR, hygiene suggestion, or audit-history entity views.
- No mixed-entity collections.
- No credentials, keychain, or AI-provider behavior.
## Design spec

### Information architecture

The feature extends the existing `Jira issues` collection page. It does not add a new route or sidebar item.
```plain text
Personal
├── Inbox
└── Jira issues
    └── Collection header
        ├── View chips
        └── Placeholder settings button
```
The route remains backed by `features/collection-viewer/CollectionViewerPage`. Jira-specific defaults live in `src/entities/jira-issue/defaults.ts`, while generic named-view UI lives under `src/views/collection/`.
### Page layout

The Jira issue page gains one header row above the existing collection body and optional detail rail.
```plain text
┌──────────────────────────────────────────────────────────────────────┐
│ [ All open ] [ Mine ] [ Recently updated ] [ + ]        [ sliders ] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Existing collection body                                            │
│  ┌─ row 1 ─────────────────────────────────────────────────────┐    │
│  │ ☐  AMP-123  Title …                   Open  Unassigned  2h │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Existing detail rail appears on the right when a row is selected.   │
└──────────────────────────────────────────────────────────────────────┘
```
The header row is one horizontal row. Chips align left, the settings icon aligns right, and both are vertically centered. The row should remain visible for loading, empty, and normal list states when view data has loaded; command failures may show the existing safe error state with no secrets or raw SQL.
### View chips

Each view renders as a dense chip using the control-small height from the design system. The active chip uses the primary tone. Inactive chips use the surface tone and move to a stronger surface on hover.
A chip label is the view display name. Long names truncate instead of pushing the settings button off-screen. The chip strip can horizontally scroll or wrap only if existing app-shell constraints require it; the preferred behavior is a single row that preserves the right-aligned settings icon.
The trailing `+` chip is always rendered after the last view. It has an accessible name such as `Create named view`. Clicking it calls `onCreate`.
### Context menu and destructive flow

Right-clicking a view chip opens a Radix context menu with these items in order:
```plain text
Rename
Duplicate
Delete
```
`Rename` lets the user edit the view display name. If the issue #39 settings menu is not available, implementation may use a small dialog or an inline temporary input as long as the final name is persisted and the interaction is keyboard accessible.
`Duplicate` creates a new view with the same entity kind and config blob, a new id, the next position, and a name based on the source view plus `(copy)`. The duplicated view becomes active immediately.
`Delete` opens an `AlertDialog` confirmation before deleting. Confirming deletes the row from SQLite, removes the chip, and chooses a safe active fallback if needed.
### Settings icon placeholder

The right side of `CollectionHeader` shows a sliders/settings icon button. It is intentionally a placeholder for issue #39. It should be visibly enabled only if a harmless no-op is acceptable; otherwise use the existing `IconButton` disabled semantics with a tooltip such as `View settings coming next`.
The placeholder must not open a half-built settings menu.
### Empty, loading, and error states

The feature introduces a view-loading phase in addition to the existing issue-loading phase.
- While views load, keep the page stable and show either skeleton chips or a compact spinner in the header.
- If no views exist after seeding, create a safe default view before rendering the body.
- If view loading or saving fails, show a safe error message such as `Could not load collection views` or surface a non-secret inline failure. Do not expose SQL text, local file paths beyond normal app paths, stack traces, tokens, or source-system secrets.
- Existing Jira issue loading, empty, and error states continue to work below the header.
### Accessibility

- Chip buttons are keyboard reachable and have accessible names based on the view name.
- The active chip exposes selected/current state with `aria-current="true"` or an equivalent accessible pattern.
- The `+` chip has an accessible name that says it creates a named view.
- The context menu uses Radix focus management and keyboard navigation.
- Delete confirmation uses `AlertDialog`, with a clear title and description naming the view being deleted.
- The settings placeholder has an accessible label and tooltip.
## Tech spec

### Prerequisites and references

- Issue #37 and `context-human/specs/feature-collection-viewer-foundation.md` for the existing collection viewer foundation.
- `context-agent/collections/collection-read.md`, especially `Named views`, `View chips`, `Right-click menu on a chip`, `First-run defaults`, `Persistence`, and `Page layout`.
- `context-agent/design-system.md` for tokens, Radix wrappers, `IconButton`, `ContextMenu`, `AlertDialog`, and UI maintenance rules.
- ADR-002 for the Tauri + React architecture.
- ADR-003 for local-first single-user v1.
- ADR-004 for SQLite as the local store.
- ADR-008 for app preferences vs. SQLite data.
### Data model

Add a `collection_views` table to SQLite during startup schema setup.
Suggested shape:
```sql
CREATE TABLE IF NOT EXISTS collection_views (
  id            TEXT PRIMARY KEY,
  entity_kind   TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  position      INTEGER NOT NULL,
  is_default    INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  config_json   TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_collection_views_entity_position
  ON collection_views (entity_kind, position);
```
`entity_kind` should match the entity contract id, such as `jira-issue`. `config_json` remains `{}` or a fixed placeholder in this feature. It must be treated as an opaque serialized blob by generic persistence code so issue #39 can define its contents.
The issue request calls for a serialized config blob, not new normalized settings tables. Do not add sort/filter/group tables for issue #38.
### TypeScript view shape

Create `src/views/collection/views/types.ts` with a generic named-view type similar to:
```typescript
export type CollectionEntityKind = string;

export type CollectionView = {
  id: string;
  entityKind: CollectionEntityKind;
  displayName: string;
  position: number;
  isDefault: boolean;
  config: unknown;
};
```
If implementation prefers wire/domain split types, keep the public UI shape camelCase and map to Rust snake_case at the binding boundary.
### Tauri commands

Add Rust collection-view persistence under `src-tauri/src/collections/views.rs` and register the module from `src-tauri/src/lib.rs` and related `mod.rs` files.
Required commands:
- `collectionViewsList(entity)` — returns all views for the entity ordered by `position ASC, created_at ASC`.
- `collectionViewSave(view)` — upserts a view by id and returns the saved view or `()` if existing conventions prefer void saves.
- `collectionViewDelete(id)` — deletes a view by id.
Use `specta` so `src/bindings.ts` exposes camelCase TypeScript command names, matching existing patterns such as `jiraIssuesList` and `preferencesRead`.
Validation rules:
- Reject empty ids.
- Reject empty or whitespace-only entity kinds.
- Reject empty or whitespace-only display names.
- Clamp or reject negative positions.
- Ensure `config_json` is valid JSON before writing.
- Return safe error strings that do not include secrets.
### Startup migration and schema setup

This repository currently creates schema through `db::setup_schema` and feature-specific schema helpers rather than a standalone migration file for every change. Implement issue #38 consistently with the existing pattern unless a migration runner already exists by implementation time.
`db::setup_schema` should create `collection_views` on app startup and in in-memory test databases. Tests must prove the table exists after `open_in_memory()`.
If a formal migration runner is added before implementation, add the table through that runner instead and keep `setup_schema` behavior for tests aligned.
### Default view seeding

Add `src/views/collection/views/seed.ts` with an idempotent seeding helper. On first launch for a given entity, it creates the entity's default views if the entity has never been seeded.
The important product rule is: deleting a default view is persistent and must not be undone by the next launch. A plain "if no rows exist, insert defaults" check would recreate deleted defaults after a user deletes all views, so use one of these approaches:
1. Store a per-entity seed marker in local preferences or SQLite shared settings, then seed only when the marker is absent.
2. Add a small SQLite seed-state table for collection entities.
3. Use another durable marker that survives deletion of all view rows.
Prefer SQLite for seed state because default view seeding describes collection data, not a user preference. The active view id remains in preferences.
If all views are deleted after seeding, create one safe fallback view as part of the delete flow to prevent an empty strip, but do not recreate every default view.
### Jira default views

Extend `src/entities/jira-issue/defaults.ts` with:
```typescript
export const DEFAULT_VIEWS = [
  { id: "jira-issue-all-open", displayName: "All open", position: 0, isDefault: true, config: {} },
  { id: "jira-issue-mine", displayName: "Mine", position: 1, isDefault: true, config: {} },
  { id: "jira-issue-recently-updated", displayName: "Recently updated", position: 2, isDefault: true, config: {} },
];
```
The exact id prefix may differ, but ids must be stable, unique, and scoped to the entity. These configs are placeholders until issue #39.
### Preferences

Extend `AppPreferences` in `src/preferences/index.ts`:
```typescript
collections?: {
  activeViewId?: Record;
};
```
Update `normalizePreferences`, `mergePreferences`, `resolvedPreferences`, and tests so unknown collection preference keys are handled safely and active view ids survive round trips.
The active view id is per-user UI state under ADR-008. It does not belong in `collection_views` because two users or profiles could prefer different active views over the same persisted view list in a future sync or shared-data model.
### UI components

Add these generic collection components:
- `src/views/collection/ViewChips.tsx`
- `src/views/collection/ChipContextMenu.tsx`
- `src/views/collection/CollectionHeader.tsx`
`ViewChips` props:
```typescript
type ViewChipsProps = {
  views: CollectionView[];
  activeViewId: string | null;
  onPick: (viewId: string) => void;
  onCreate: () => void;
  onContextMenu?: (viewId: string) => void;
};
```
If Radix `ContextMenu.Trigger` makes an explicit `onContextMenu` prop unnecessary, keep the behavior but do not force an awkward prop shape. The issue's intent is that right-clicking a chip opens actions for that view.
`ChipContextMenu` should wrap chips or expose a trigger/content composition that keeps handlers close to the view id:
- `onRename(viewId)`
- `onDuplicate(viewId)`
- `onDelete(viewId)` with confirmation before the final delete
`CollectionHeader` composes the chip strip and placeholder settings button. It should not know Jira-specific defaults.
### Page wiring

Update `src/features/collection-viewer/CollectionViewerPage.tsx` to:
1. Load Jira issues as it does today.
2. Seed and load collection views for `jiraIssueEntity.id`.
3. Load app preferences.
4. Choose the active view in this order:
	- saved `preferences.collections.activeViewId[jiraIssueEntity.id]` when it exists in the loaded view list;
	- first view by position;
	- safe fallback view if no views exist.
5. Persist active-view changes with `savePreferences`.
6. Persist created, renamed, duplicated, and deleted views through Tauri commands.
7. Keep rendering the same collection body regardless of active view config for issue #38.
Avoid coupling view management to Jira issue rows. The page may be Jira-only today, but the named-view model should accept any future collection entity id.
### Error handling

View CRUD failures should not corrupt local state. Prefer optimistic updates only if rollback is simple and tested. Otherwise, save first, then update UI state from the returned/listed data.
If saving the active-view preference fails after selecting a chip, the UI may keep the new active view for the session but should log a safe warning or show a small non-blocking message if an existing feedback primitive is available. Do not block view switching solely because preferences failed to write.
### Testing plan

**Unit tests**
- `ViewChips` renders active chips with the primary tone and inactive chips with the surface tone.
- `ViewChips` calls `onPick` when an inactive chip is clicked.
- `ViewChips` calls `onCreate` when the `+` chip is clicked.
- `ViewChips` exposes useful accessible names and selected/current state.
- `ChipContextMenu` renders `Rename`, `Duplicate`, and `Delete` actions and calls the correct handlers.
- Delete confirmation requires explicit confirmation before calling the delete handler.
- Preferences normalization preserves `collections.activeViewId` and rejects invalid shapes.
**Rust integration tests**
- `open_in_memory()` creates `collection_views` and any seed-state table.
- Saving a view and listing by entity returns it.
- Listing is scoped by entity kind.
- Saving a view with the same id updates name, position, default flag, and config.
- Deleting a view removes it.
- Invalid ids, entity kinds, names, positions, and config payloads fail safely.
- Default seeding is idempotent and does not recreate deleted default views after seed state is marked.
**React/page integration tests**
- `CollectionViewerPage` shows the three Jira default chips after seed/list.
- Clicking each default chip updates active state.
- Active view restoration uses preferences when the saved id still exists.
- If the saved active id no longer exists, the page falls back to the first available view and updates preferences.
- Clicking `+` creates, saves, and activates a new view.
- Duplicating creates a copy and activates it.
- Deleting the active view selects a safe fallback.
- Header layout stays above loading, empty, and populated body states when view data is available.
**Playwright / end-to-end**
- Open the Jira viewer and see `All open`, `Mine`, and `Recently updated` chips.
- Click each chip and see active state move.
- Click `+` and see a new chip appear and become active.
- Right-click the new chip, delete it, confirm, and see it removed.
- Restart the app and verify the deletion and active-view choice persist.
### Verification commands

Run the narrowest checks first, then broader checks if time permits:
```bash
npm test -- ViewChips
npm test -- ChipContextMenu
npm test -- CollectionViewerPage
npm test -- preferences
cd src-tauri && cargo test collection_views
npm test
npm run lint
npm run build
```
If generated bindings change, run the repository's binding generation path before committing. The current test helper is documented in `src-tauri/src/lib.rs` as `cargo test generate_typescript_bindings`.
## Task decomposition

- [ ] **Story: Persist named collection views**
	- **Description:** Add the SQLite schema, Rust persistence module, Tauri commands, and generated TypeScript bindings needed to list, save, and delete named collection views.
	- **Acceptance criteria:**
		- [ ] `collection_views` exists after app startup and in-memory DB setup.
		- [ ] Rust tests cover save, list, update, delete, entity scoping, ordering, and validation.
		- [ ] Tauri command names are registered in runtime and binding generation.
		- [ ] `src/bindings.ts` exposes `collectionViewsList`, `collectionViewSave`, and `collectionViewDelete` or equivalent generated names.
		- [ ] Errors are safe for UI display and contain no secrets.
	- **Dependencies:** Existing SQLite setup and Tauri command patterns.
	- [ ] **Task: Add collection view Rust types and schema**
		- Create `src-tauri/src/collections/views.rs` and any needed `mod.rs` files. Define serializable/specta-compatible request and response types. Add schema creation for `collection_views` and seed-state storage if using SQLite seed markers.
	- [ ] **Task: Implement list/save/delete persistence functions**
		- Write pure Rust functions that operate on `rusqlite::Connection`. Keep SQL parameterized. Store `config_json` as validated JSON text.
	- [ ] **Task: Register Tauri commands and update bindings**
		- Expose commands through `src-tauri/src/commands.rs` or a collection command module consistent with existing conventions. Register them in `lib.rs` and the binding generation test command list. Regenerate `src/bindings.ts`.
	- [ ] **Task: Add Rust tests**
		- Cover table creation, command/persistence behavior, validation, and seed idempotency. Prefer in-memory DB tests for speed.
- [ ] **Story: Model defaults and active-view preferences**
	- **Description:** Add TypeScript named-view types, Jira default views, default seeding, and active-view preference support.
	- **Acceptance criteria:**
		- [ ] `src/views/collection/views/types.ts` exports a reusable named-view shape.
		- [ ] Jira issue defaults include `All open`, `Mine`, and `Recently updated` with stable ids and placeholder configs.
		- [ ] Seeding runs once per entity and does not recreate deleted defaults after deletion.
		- [ ] `AppPreferences` supports `collections.activeViewId` and preserves valid values through normalization and merge.
		- [ ] Tests cover preference normalization and seed behavior.
	- **Dependencies:** Story 1 command bindings for persistent seed/list/save behavior.
	- [ ] **Task: Add TypeScript named-view types**
		- Create the generic collection view type and any helper types used by the UI.
	- [ ] **Task: Add Jira default views**
		- Extend `src/entities/jira-issue/defaults.ts` with the three default view records. Keep config empty or a fixed placeholder.
	- [ ] **Task: Implement seed helper**
		- Create `src/views/collection/views/seed.ts`. Use durable per-entity seed state and command calls to create defaults only on first seed.
	- [ ] **Task: Extend app preferences**
		- Add `collections.activeViewId` to `AppPreferences`, update normalization and merge logic, and add tests in `src/preferences/index.test.ts`.
- [ ] **Story: Render and manage view chips**
	- **Description:** Add the generic chip strip, context menu, delete confirmation, and collection header row.
	- **Acceptance criteria:**
		- [ ] `ViewChips` renders ordered chips plus the trailing `+` chip.
		- [ ] Active and inactive chips use design-system token classes.
		- [ ] `+` calls `onCreate`.
		- [ ] Right-clicking a chip opens a context menu with `Rename`, `Duplicate`, and `Delete`.
		- [ ] Delete requires an `AlertDialog` confirmation.
		- [ ] `CollectionHeader` aligns chips left and the placeholder settings icon right in one row.
		- [ ] Unit tests cover rendering, interactions, and accessible labels.
	- **Dependencies:** Story 2 named-view type.
	- [ ] **Task: Build ****`ViewChips`**
		- Render chip buttons from view data. Add active styling, truncation, keyboard accessibility, and `+` creation behavior.
	- [ ] **Task: Build ****`ChipContextMenu`**
		- Wrap Radix `ContextMenu` through existing UI primitives if available. Add actions and delete confirmation with `AlertDialog`.
	- [ ] **Task: Build ****`CollectionHeader`**
		- Compose `ViewChips` and the placeholder settings `IconButton`. Keep layout generic and token-based.
	- [ ] **Task: Add component tests**
		- Use React Testing Library to cover active/inactive appearance, click behavior, context menu actions, confirmation, and accessible names.
- [ ] **Story: Wire named views into the Jira collection page**
	- **Description:** Connect persistence, defaults, preferences, and header UI to `CollectionViewerPage` while keeping view configs non-functional for issue #38.
	- **Acceptance criteria:**
		- [ ] The Jira collection page loads and seeds views for `jiraIssueEntity.id`.
		- [ ] The page restores active view from preferences when valid.
		- [ ] Clicking a chip updates active state and saves the active id to preferences.
		- [ ] Creating, renaming, duplicating, and deleting views persist through Tauri commands.
		- [ ] Deleting the active view chooses a safe fallback.
		- [ ] Deleting all views does not leave the page without a chip.
		- [ ] The existing collection body and detail rail still work.
	- **Dependencies:** Stories 1, 2, and 3.
	- [ ] **Task: Load views and preferences on mount**
		- Add page state for views, active view id, loading, and errors. Sequence seed/list/preferences so the active view is chosen after views are known.
	- [ ] **Task: Implement create, rename, duplicate, and delete handlers**
		- Use command bindings for view persistence and `savePreferences` for active-view changes. Reload or update local state after successful saves.
	- [ ] **Task: Render ****`CollectionHeader`**
		- Place the header above existing body states. Preserve the existing list/detail layout below it.
	- [ ] **Task: Add page tests**
		- Mock bindings and preference storage to cover default chips, active switching, creation, deletion, active fallback, and persistence calls.
- [ ] **Story: Verify end-to-end behavior**
	- **Description:** Add or update an end-to-end path that proves named views survive restart-like reloads and basic chip actions work in the running app.
	- **Acceptance criteria:**
		- [ ] Playwright sees the three default chips in the Jira viewer.
		- [ ] Playwright can switch active chips.
		- [ ] Playwright can create and delete a view through the UI.
		- [ ] A restart or reload preserves deletion and active-view state.
		- [ ] No console errors appear during the flow.
	- **Dependencies:** Story 4 page wiring and available test harness support for local app state.
	- [ ] **Task: Add Playwright coverage**
		- Create a focused Jira viewer named-views test using existing e2e setup patterns. Seed local state as needed without relying on external Jira credentials.
	- [ ] **Task: Run full verification**
		- Run targeted unit/integration/e2e checks, then `npm test`, `npm run lint`, and `npm run build` when practical. Document any skipped checks and why.
## Open questions and implementation notes

- The issue text says `Rename` should focus the rename textbox in the view-settings menu, but issue #39 owns that menu. For issue #38, a small temporary rename dialog or inline input is acceptable if it is accessible and can be replaced by the settings menu later.
- The issue text mentions a SQLite migration. The current codebase uses startup schema setup helpers. Implement consistently with the codebase unless a migration runner appears before development starts.
- The collection-read contract says deleting a non-empty customized view prompts for confirmation. Because issue #38 has placeholder configs and no real customization state, always confirming delete is simpler and safer.
- The view config blob should remain opaque. Do not design issue #39's config schema in this feature.