---
created: 2026-05-27
last_updated: 2026-05-27
status: complete
issue: 37
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Collection viewer foundation

## What

`hm` needs a reusable collection viewer that can render a list of source-backed entities and open a read-only detail rail for the selected item. This feature builds the foundation for that viewer and wires Jira issues into it as the first supported entity.
The collection viewer is generic by design. It knows how to render rows from an entity contract, split row properties into left and right zones, show loading/error/empty states, and host a detail component in a fixed right-side rail. Jira-specific behavior lives in a Jira issue entity adapter, not in the collection viewer itself.
After this feature, the sidebar has a `Jira issues` entry. Opening it loads real locally-ingested Jira issues through `commands.jiraIssuesList({ source_id: null, project_key: null, limit: 200 })`, shows each issue's key, title, status, assignee, and updated time, and opens the selected issue in a sparse right rail. The richer collection controls from the collection design docs — named views, chips, view settings, filtering, grouping, multi-sort, selection, bulk actions, and alternate preview surfaces — remain out of scope for this first pass.
## Why

Jira issue ingestion now gives `hm` a local work-item corpus, but users still cannot browse that data in the app. A simple issue list is the next useful step: it proves that the ingestion data can be read through the UI, gives users a way to verify that sync worked, and creates the shared viewer shape that later backlog hygiene, GitHub issues, GitHub pull requests, audit history, and other collection-backed pages can reuse.
The important product choice is to avoid building a Jira-only table. Jira happens to be the first data source with rows available, but the viewer should treat Jira as one entity contract among many. That keeps future GitHub and history work from copying a second list/detail architecture.
## Personas

- **Elena: EM** — wants to open `hm` and quickly scan current work items by key, title, owner, status, and last update without opening Jira tabs.
- **Priya: PM** — wants confidence that Jira ingestion produced browseable local data before later roadmap-health views depend on it.
- **Tarek: Team member** — wants a fast, plain list of issues and a lightweight detail peek while exploring unfamiliar work.
- **Future collection implementer** — needs a generic row/detail foundation that can support GitHub issues, GitHub PRs, hygiene suggestions, and audit history without rewriting the viewer.
- **Maintainer** — needs tests around the generic collection pieces so later view settings and selection features can extend stable contracts instead of refactoring hardcoded Jira UI.
## Narratives

### Elena scans newly ingested Jira issues

Elena opens `hm` after running Jira issue ingestion. The sidebar includes `Jira issues` next to `Inbox`, and the page opens inside the normal app shell. The list is sparse on purpose: each row shows a checkbox placeholder, the Jira key, title, assignee, status, and updated time.
She scans the most recently updated items first because the Jira entity contract's default sort orders by source update time descending. The page does not ask Elena to configure a view or understand a new layout system. It simply shows the current local issue corpus.
### Tarek opens a side rail for context

Tarek sees an issue title that looks related to his work. He clicks the row body, and a right-side detail rail opens at 440px wide. The list narrows to make room, and the selected issue stays in context.
The rail shows the issue key, title, status, assignee, project key, updated time, and any available basic body or label fields. Tarek clicks a second row and the rail swaps to the new issue. He clicks `X`, and the rail closes without changing the list.
### A future GitHub implementer adds another entity

A developer adds GitHub PR browsing later. They create a `github-pr` entity contract with property definitions, cell renderers, default property layout, default sort, and a detail component. The collection viewer itself does not need to know GitHub-specific field names.
The same `Body`, `Row`, and `Detail` components render the PR list and side rail. Jira-specific cells, badges, and missing-field behavior stay isolated in `src/entities/jira-issue/`, so GitHub can make different choices without forking the viewer.
## User stories

**Elena scans newly ingested Jira issues**
- Elena can open a `Jira issues` sidebar item from the normal app shell.
- Elena can see locally-ingested Jira issues loaded through the existing Tauri command.
- Elena can read each issue's key, title, status, assignee, and last updated value in one row.
- Elena can see a useful empty state when no issues have been ingested.
- Elena can see a loading state while the page fetches issues.
- Elena can see a safe error state if the local query fails.
**Tarek opens a side rail for context**
- Tarek can click a row body to open that issue in a right-side detail rail.
- Tarek can close the detail rail with an `X` button.
- Tarek can click another row while the rail is open and see the detail swap.
- Tarek can click the checkbox placeholder without selecting anything or opening detail in this feature.
- Tarek can use the list and rail with keyboard and screen-reader accessible labels for the implemented controls.
**Future collection implementer adds another entity**
- Future implementer can define an `EntityContract` for another entity without editing the generic row renderer.
- Future implementer can define property metadata separately from cell renderers.
- Future implementer can choose a default property layout through `PropertyConfig` values.
- Future implementer can supply an entity-specific detail component hosted by the generic `Detail` rail.
- Future implementer can add later view settings, grouping, sorting, and selection on top of the generic contract.
## Goals

- Add generic collection viewer primitives under `src/views/collection/`.
- Add entity-contract types that are generic over an entity's property and group-field literal types.
- Keep `ViewConfig`, `GroupingConfig`, `SortLevel`, view chips, and persistence out of this feature.
- Render a collection body from an item array, an entity contract, and a hardcoded property layout.
- Render rows using entity-provided cell renderers and `PropertyConfig` side/visibility settings.
- Preserve the left/right property split from `context-agent/collections/collection-read.md`.
- Treat the title/stretch property as the row's flexible content area.
- Add a fixed 440px right-side detail rail hosted by a generic `Detail` component.
- Add a Jira issue entity adapter under `src/entities/jira-issue/`.
- Load real Jira issue rows through `commands.jiraIssuesList` with a default limit of 200.
- Add a `Jira issues` sidebar item that routes to the collection viewer page.
- Use existing design-system primitives and tokens only.
- Cover row rendering, comparator behavior, page accessibility, and click-to-detail behavior with tests.
## Non-goals

- No named views, view chips, `+ new view`, or view persistence.
- No view-settings menu or sub-panels.
- No user-configurable property visibility, ordering, density, sort, group, or filter.
- No multi-sort, grouping, filtering, conditional color, or smart buckets in the UI.
- No selection model, select-all, shift-click, bulk-action bar, mutation actions, or audit-log writes.
- No Jira write-back, status editing, assignee editing, label editing, comments, transitions, or bulk triage.
- No GitHub issue or GitHub PR entity implementation in this feature.
- No mixed-entity collections.
- No bottom peek or full-page preview surface.
- No keyboard navigation between rows beyond normal focus behavior for implemented controls.
- No new ingestion behavior or source configuration changes.
## Design spec

### Information architecture

The app shell sidebar gains a source-backed browsing entry:
```plain text
Personal
├── Inbox
└── Jira issues
```
The visible label may say `Jira issues` because the first shipped entity is Jira-specific. The implementation should still route to `CollectionViewerPage` configured with the Jira issue entity contract. Avoid names like `JiraViewerTable` or generic components under `features/jira-viewer/`.
### Page layout for this feature

Issue #37 implements only the body and side-peek parts of the collection read contract.
```plain text
┌──────────────────────────────────────────────────────────────────────┐
│ Title bar: Jira issues                                               │
├──────────────────────────────────────────────────────────────────────┤
│ Collection page                                                      │
│ ┌──────────────────────────────────────┐ ┌─────────────────────────┐ │
│ │ Rows                                 │ │ Detail rail (440px)     │ │
│ │                                      │ │ [X]                     │ │
│ │ ☐ AMP-123  Title …        Open  2h  │ │ AMP-123                 │ │
│ │ ☐ AMP-124  Title …        Done  1d  │ │ Title                   │ │
│ │ ☐ AMP-125  Title …        Open  3d  │ │ Status · Assignee       │ │
│ │                                      │ │ Body/labels if present  │ │
│ └──────────────────────────────────────┘ └─────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```
When no row is selected, the body uses the full content width. When a row is selected, the rail appears on the right and the list flexes to the remaining width. The rail width is exactly `440px` on wide windows.
### Collection row anatomy

Rows follow the read-side left/right split:
```plain text
[ checkbox ] [ left properties, title stretches ................................ ] [ right properties ]
```
For Jira issues in this feature, the default visible layout is:
```plain text
key(L) → title(L) → assignee(R) → status(R) → updated_at_source(R)
```
`project_key`, `priority`, and `labels` are valid Jira issue properties but hidden by default. They can appear in the detail rail when data is available and become configurable in later view-settings work.
The checkbox is present to preserve the collection row shape, but it is inert for issue #37. Clicking it does not toggle persistent selection and does not open detail. Selection and bulk actions land later.
### Jira issue cells

Jira issue properties render through entity-owned cells:

Property
Default visibility
Side
Cell behavior

`key`
visible
left
Monospace Jira key. Empty keys render as `Unknown key`.

`title`
visible
left
Stretch property. One-line title with truncation.

`status`
visible
right
`Badge` using a neutral/default tone unless a safe workflow category is available.

`assignee`
visible
right
Display name or `Unassigned`.

`updated_at_source`
visible
right
Relative time when parseable; fallback to compact absolute text.

`priority`
hidden
right
Text or badge when available later.

`labels`
hidden
right
Compact tag list when available later.

`project_key`
hidden
right
Monospace project key.

### Detail rail

The generic `Detail` host owns the rail frame and close affordance. The entity owns the body.
For Jira issues, the rail shows:
- Key and title.
- Status badge.
- Assignee, with `Unassigned` fallback.
- Project key when present.
- Last updated source time when present.
- Body/description only when the loaded item provides it.
- Labels only when the loaded item provides them.
Issue #37 should not add a new rich issue-detail fetch unless implementation finds the current list command cannot satisfy the basic rail. If body and labels are not present in `JiraIssueListItem`, the detail rail must omit those sections rather than showing fake data.
### Loading, empty, and error states

The page keeps chrome stable across states:
- Loading: show `Spinner` and/or `Skeleton` rows in the body region.
- Empty: show `EmptyState` with copy such as `No Jira issues yet` and `Run Jira ingestion from Settings → Sources to populate this list.`
- Error: show a safe message such as `Could not load Jira issues` plus the redacted command error. No SQL, raw stack trace, token, or source-system secret may appear.
### Visual and accessibility rules

- Use design-system primitives: `Badge`, `IconButton`, `Spinner`, `EmptyState`, `Skeleton`, and existing shell/navigation primitives.
- Use Tailwind token utilities only. No inline colors, hardcoded theme hex values, or non-token spacing.
- Row buttons must have accessible names that include the issue identity when available.
- The close button uses `IconButton` with label `Close issue detail`.
- The inert checkbox must not mislead screen readers into thinking persistent selection works. Prefer a disabled or no-op control with copy/test coverage that marks selection as not available yet.
## Tech spec

### Prerequisites and references

- Issue #37 — `feat(collections): collection-viewer foundation`.
- `context-agent/collections/collection-read.md` — read-side collection layout, row rendering, side peek, and current Jira issue entity notes.
- `context-agent/design-system.md` — tokens, primitives, app shell patterns, and UI maintenance contract.
- Issue #10 — Jira issue ingestion baseline and `jira_issues_list` command.
- ADR-002 — Tauri with Rust core and React UI.
- ADR-003 — local-first single-user v1.
- ADR-004 — SQLite primary store.
- ADR-008 — source metadata and credentials remain separate; this feature reads only local issue data.
### System design and architecture

```plain text
┌───────────────────────────────────────────────────────────────┐
│ React                                                         │
│  App.tsx                                                      │
│    sidebar route: Jira issues                                 │
│    → features/collection-viewer/CollectionViewerPage          │
│                                                               │
│  views/collection/                                            │
│    types.ts       generic entity/property/cell contracts      │
│    Body.tsx       state wrapper + row list                    │
│    Row.tsx        row layout from property configs            │
│    Detail.tsx     fixed right rail host                       │
│                                                               │
│  entities/jira-issue/                                         │
│    properties.ts  property definitions                        │
│    cells.tsx      Jira property cell renderers                │
│    detail.tsx     JiraIssueDetail body                        │
│    defaults.ts    default property config                     │
│    compare.ts     property comparators/default sort           │
│    index.ts       assembled EntityContract                    │
│                                                               │
│  features/collection-viewer/data.ts                           │
│    useJiraIssues() → commands.jiraIssuesList                  │
└──────────────────────────┬────────────────────────────────────┘
                           │ generated bindings
┌──────────────────────────┴────────────────────────────────────┐
│ Rust                                                          │
│  existing command: jira_issues_list(filter)                   │
│  existing type: JiraIssueListItem                             │
└───────────────────────────────────────────────────────────────┘
```
The collection layer depends on an entity contract. It does not import Jira modules. The collection-viewer feature composes the generic layer with the Jira issue entity and the Jira data hook for this first route.
### Generic collection contracts

`src/views/collection/types.ts` should define only the types needed for issue #37.
Expected shape:
```typescript
export type PropertySide = "left" | "right";
export type PropertyKind = "text" | "number" | "date" | "categorical" | "tags";

export type CellRenderer = (props: {
  item: TItem;
  property: TProperty;
}) => React.ReactNode;

export type PropertyDefinition = {
  id: TProperty;
  label: string;
  kind: PropertyKind;
  icon?: React.ReactNode;
  renderCell: CellRenderer;
  isStretch?: boolean;
};

export type PropertyConfig = {
  property: TProperty;
  side: PropertySide;
  visible: boolean;
};

export type EntityContract = {
  id: string;
  label: string;
  getId: (item: TItem) => string;
  properties: PropertyDefinition[];
  defaultProperties: PropertyConfig[];
  defaultSort: (a: TItem, b: TItem) => number;
  Detail: React.ComponentType;
};
```
Exact names may change during implementation, but the contract must preserve these responsibilities. Do not add future view types in this feature unless needed by tests.
### Body component

`Body.tsx` accepts:
- `items`.
- `entity`.
- Optional `properties`, defaulting to `entity.defaultProperties`.
- `selectedId`.
- `onSelect(item)`.
- Loading/error/empty labels as simple props or local composition in `CollectionViewerPage`.
Behavior:
- Sorts by `entity.defaultSort` for this feature.
- Filters property configs to visible properties.
- Renders `EmptyState` when `items.length === 0`.
- Renders one `Row` per item.
- Does not implement grouping, filters, user sort changes, view chips, or persistence.
### Row component

`Row.tsx` accepts one item, entity contract, property config list, selection state, and `onSelect`.
Behavior:
- Finds each `PropertyDefinition` by id and skips unknown properties safely.
- Preserves config order within the left and right side.
- Renders left properties before the stretch spacer and right properties after it.
- Applies `flex-1` to the stretch/title property.
- Fires `onSelect(item)` when the row body is clicked.
- Keeps the checkbox inert for #37. Checkbox click must stop propagation so it does not open detail.
- Marks the selected row with a token-based visual state.
### Detail component

`Detail.tsx` is a generic right-rail host:
- Width: `440px` on wide windows.
- Border-left using `border-border`.
- Close affordance in the top-right.
- Hosts `entity.Detail` for the selected item.
- Does not know about Jira field names.
The host should be reusable for future side-peek details. Bottom peek and full-page preview are not implemented.
### Jira issue entity adapter

Define a Jira issue item type that starts from `JiraIssueListItem` and can tolerate optional future detail fields:
```typescript
type JiraIssueProperty =
  | "key"
  | "title"
  | "status"
  | "assignee"
  | "updated_at_source"
  | "priority"
  | "labels"
  | "project_key";
```
Files:
- `properties.ts` — declares metadata for every property.
- `cells.tsx` — implements `KeyCell`, `TitleCell`, `StatusCell`, `AssigneeCell`, `UpdatedCell`, and placeholders for hidden/future properties.
- `detail.tsx` — implements `JiraIssueDetail`.
- `defaults.ts` — exports `DEFAULT_PROPERTIES` matching the default visible layout.
- `compare.ts` — exports comparator helpers by property kind and the default Jira issue sort.
- `index.ts` — assembles and exports the `jiraIssueEntity` contract.
The adapter may map backend snake-case fields to property ids internally, but it should not mutate the generated binding type or hide missing backend fields with fake values.
### Data hook

`src/features/collection-viewer/data.ts` exports `useJiraIssues()`.
Behavior:
- Calls `commands.jiraIssuesList({ source_id: null, project_key: null, limit: 200 })` inside an effect.
- Returns `{ issues, loading, error }`.
- Guards non-Tauri/browser test runs with a mockable path or dependency seam used in tests.
- Does not poll or subscribe to ingestion progress in issue #37.
- Does not create data if ingestion has not run.
### App routing

`App.tsx` currently picks one page object for Inbox/settings/showcase. This feature can keep that local page-state pattern rather than introducing a full router.
Add a small page state such as:
```typescript
type MainPage = "inbox" | "jira-issues";
```
The sidebar should render `Inbox` and `Jira issues`, with active state tied to `MainPage`. Settings mode still replaces the sidebar with the settings sidebar, as it does today.
### Security, privacy, and compliance

- This feature reads local SQLite-backed issue rows through an existing command. It does not call Jira directly and does not load credentials.
- Do not show PATs, authorization headers, raw source-system responses, SQL errors with sensitive content, or stack traces in UI.
- If the command returns an error string, present it as a safe high-level message. Keep console logging minimal and non-secret.
- Do not add telemetry or remote reporting.
### Testing plan

- Vitest unit tests for `Row` rendering:
	- one visible left property and one visible right property;
	- all properties visible;
	- all hidden except title;
	- title-only layout stretches correctly;
	- checkbox click does not call `onSelect`.
- Vitest unit tests for Jira issue comparators:
	- strings use deterministic locale compare;
	- numbers sort numerically;
	- ISO date strings sort chronologically;
	- null/missing values sort last for descending updated-time behavior.
- Component test for `CollectionViewerPage`:
	- loading state;
	- empty state;
	- populated rows;
	- click row opens detail rail;
	- close button hides detail rail.
- jest-axe accessibility check on the collection page.
- Playwright smoke when a fixture or seeded local data path exists:
	- open `Jira issues`;
	- see at least one issue;
	- click it;
	- see the detail rail;
	- click `X`;
	- see it close.
### Verification

Target checks for implementation:
```plain text
npm run lint
npm test
npm run build
```
Manual verification when local SQLite has Jira issue data:
```plain text
npm run tauri dev
```
Then navigate to `Jira issues`, confirm real rows appear, click one row, verify a 440px right rail opens, click another row, verify the rail swaps content, close the rail, and check the browser/Tauri console for errors.
### Risks

- `JiraIssueListItem` currently exposes key, title, status, assignee, updated time, and project key. It may not expose body, labels, or priority yet. The detail rail should omit unavailable sections rather than broadening backend scope without intent.
- The route label is Jira-specific because the first entity is Jira. The implementation risk is letting that label leak into generic collection components. Keep generic code under `src/views/collection/` and Jira code under `src/entities/jira-issue/`.
- Playwright smoke tests need deterministic local data. If the existing test harness cannot seed SQLite for Tauri e2e, keep this as a documented manual check or add a test seam rather than depending on a developer's personal database.
## Task list

- [ ] **Story: Generic collection contracts and row rendering**
	- [ ] **Task: Define collection contract types**
		- **Description**: Add `src/views/collection/types.ts` with entity, property, cell renderer, and property layout types for the first read-only collection foundation.
		- **Acceptance criteria**:
			- [ ] `EntityContract` is generic over item type and property literal type.
			- [ ] `PropertyDefinition` includes id, label, kind, optional icon, cell renderer, and stretch marker.
			- [ ] `PropertyConfig` includes property id, side, and visibility.
			- [ ] Future `ViewConfig`, grouping, and sort-level types are not introduced yet.
		- **Dependencies**: None
	- [ ] **Task: Build the collection body component**
		- **Description**: Add `Body.tsx` to render sorted rows from items, an entity contract, and a property layout.
		- **Acceptance criteria**:
			- [ ] Body uses `entity.defaultSort` for issue #37.
			- [ ] Body defaults to `entity.defaultProperties` when no property config is passed.
			- [ ] Body renders an `EmptyState` for an empty item list.
			- [ ] Body renders one row per item using stable entity ids.
			- [ ] No grouping, filtering, view chips, or persistence exists in the component.
		- **Dependencies**: Collection contract types
	- [ ] **Task: Build the collection row component**
		- **Description**: Add `Row.tsx` that reads property definitions, honors left/right/visibility config, and opens detail on row-body click.
		- **Acceptance criteria**:
			- [ ] Visible left properties render in config order.
			- [ ] Visible right properties render in config order.
			- [ ] The stretch/title property receives flexible width.
			- [ ] Unknown or hidden properties do not crash rendering.
			- [ ] Clicking the row body calls `onSelect(item)`.
			- [ ] Clicking the checkbox placeholder does not call `onSelect` and does not persist selection.
			- [ ] Vitest covers the required layout cases.
		- **Dependencies**: Collection contract types
	- [ ] **Task: Build the generic detail rail host**
		- **Description**: Add `Detail.tsx` to render a fixed right-side rail and host the entity-specific detail component.
		- **Acceptance criteria**:
			- [ ] Rail width is exactly 440px on wide windows.
			- [ ] Rail uses token-based border/background styles.
			- [ ] Close affordance uses `IconButton` with `Close issue detail` or equivalent accessible label.
			- [ ] Generic host does not import Jira-specific modules.
		- **Dependencies**: Collection contract types
- [ ] **Story: Jira issue entity adapter**
	- [ ] **Task: Define Jira issue properties and defaults**
		- **Description**: Add Jira issue property metadata and default property layout under `src/entities/jira-issue/`.
		- **Acceptance criteria**:
			- [ ] Properties include `key`, `title`, `status`, `assignee`, `updated_at_source`, `priority`, `labels`, and `project_key`.
			- [ ] Default visible layout is `key(L)`, `title(L)`, `assignee(R)`, `status(R)`, `updated_at_source(R)`.
			- [ ] Hidden properties remain available to the entity contract for later view settings.
			- [ ] Title is marked as the stretch property.
		- **Dependencies**: Collection contract types
	- [ ] **Task: Implement Jira issue cells**
		- **Description**: Add cell renderers for Jira issue properties using existing design-system primitives.
		- **Acceptance criteria**:
			- [ ] Key renders in monospace with safe fallback.
			- [ ] Title truncates and stretches.
			- [ ] Status renders with `Badge`.
			- [ ] Assignee renders display name or `Unassigned`.
			- [ ] Updated renders relative or compact fallback text.
			- [ ] Missing hidden/future fields render as absent or muted fallback, not fake data.
		- **Dependencies**: Jira issue properties
	- [ ] **Task: Implement Jira issue detail component**
		- **Description**: Add `JiraIssueDetail` for the side rail's entity-specific body.
		- **Acceptance criteria**:
			- [ ] Detail shows key, title, status, assignee, project key, and updated time when present.
			- [ ] Body/description appears only when the item provides it.
			- [ ] Labels appear only when the item provides them.
			- [ ] Detail uses token-based layout and existing primitives.
		- **Dependencies**: Jira issue cells/properties
	- [ ] **Task: Implement Jira issue comparators and entity export**
		- **Description**: Add comparator helpers and assemble the `jiraIssueEntity` contract.
		- **Acceptance criteria**:
			- [ ] Comparator tests cover strings, numbers, dates, and missing values.
			- [ ] Default sort orders `updated_at_source` descending with missing dates last.
			- [ ] `index.ts` exports one assembled contract consumed by the page.
		- **Dependencies**: Jira issue properties and detail
- [ ] **Story: Collection viewer page and navigation**
	- [ ] **Task: Add Jira issues data hook**
		- **Description**: Add `useJiraIssues()` that loads rows through `commands.jiraIssuesList`.
		- **Acceptance criteria**:
			- [ ] Hook calls `commands.jiraIssuesList({ source_id: null, project_key: null, limit: 200 })`.
			- [ ] Hook returns `issues`, `loading`, and `error`.
			- [ ] Hook supports component tests without real Tauri IPC.
			- [ ] Hook does not poll or run ingestion.
		- **Dependencies**: Existing generated bindings
	- [ ] **Task: Compose the collection viewer page**
		- **Description**: Add `src/features/collection-viewer/CollectionViewerPage.tsx` that combines the data hook, generic body, detail rail, and Jira issue entity.
		- **Acceptance criteria**:
			- [ ] Page mounts in the app shell main pane.
			- [ ] Loading, empty, error, and populated states render clearly.
			- [ ] `selectedId: string | null` controls the detail rail.
			- [ ] Clicking a row opens detail.
			- [ ] Clicking the rail close button clears selection.
			- [ ] jest-axe passes for the page.
		- **Dependencies**: Generic collection components, Jira issue entity, data hook
	- [ ] **Task: Wire sidebar navigation**
		- **Description**: Update `App.tsx` to route between `Inbox` and `Jira issues` while preserving settings behavior.
		- **Acceptance criteria**:
			- [ ] Sidebar shows `Inbox` and `Jira issues` when not in settings.
			- [ ] Active state follows the current page.
			- [ ] Clicking `Jira issues` renders the collection viewer page.
			- [ ] Opening settings still swaps to the settings sidebar and returns cleanly.
			- [ ] Existing app shell tests are updated.
		- **Dependencies**: Collection viewer page
- [ ] **Story: Validation and handoff**
	- [ ] **Task: Add focused tests for collection foundation**
		- **Description**: Add/adjust Vitest and component tests for row rendering, comparator behavior, page states, and detail open/close.
		- **Acceptance criteria**:
			- [ ] Row layout tests cover the issue #37 cases.
			- [ ] Comparator tests are deterministic.
			- [ ] Page tests cover loading, empty, error, populated, open detail, and close detail.
			- [ ] Accessibility check runs on the page.
		- **Dependencies**: Collection viewer page
	- [ ] **Task: Run verification checks**
		- **Description**: Run the narrow and broad checks practical for this feature.
		- **Acceptance criteria**:
			- [ ] `npm run lint` passes.
			- [ ] `npm test` passes.
			- [ ] `npm run build` passes or any failure is documented.
			- [ ] Manual `npm run tauri dev` verification is performed with local Jira data, or skipped with a clear reason.
		- **Dependencies**: Tests implemented