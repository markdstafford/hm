---
created: 2026-05-28
last_updated: 2026-05-28
status: complete
issue: 47
issue_url: [https://github.com/markdstafford/hm/issues/47](https://github.com/markdstafford/hm/issues/47)
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Hygiene suggestion entity and read rendering

## What

`hm` needs the `Backlog hygiene` page to become a working collection-backed viewer for triage suggestions. This feature replaces the current placeholder rows with a `hygiene-suggestion` entity contract, fixture-backed suggestion data when producer output is unavailable, and a page composer that mounts the existing collection viewer experience for backlog hygiene.
After this feature, a user can open `Backlog hygiene` from the sidebar, browse pending duplicate, stale, and enrichment suggestions, switch between default named views, use the standard collection settings menu to sort, group, filter, adjust row layout, and open the selected suggestion in any supported preview surface. Detail content changes by suggestion category: duplicates show two issue cards, stale suggestions show one issue and last activity, and enrichment suggestions compare original and proposed text.
This is a read-rendering feature. Row selection may work through the collection write UI foundation, but approving, rejecting, undoing, or writing changes back to Jira is out of scope for issue 47 and remains owned by issue 48.
## Why

The app narrative already promises a backlog hygiene view where Elena reviews duplicate, stale, and enrichment suggestions before approving work back to Jira. The collection foundation now has enough read-side capability to show that workbench shape, but `BacklogHygienePage` still renders static placeholder list items. Users need the actual hygiene surface before bulk actions can be meaningful.
Shipping this feature also proves the collection layer can render a second entity type. Jira issues exercised the generic list, view chips, settings, grouping, filtering, preview surfaces, and selection model with source-system records. Hygiene suggestions exercise the same contracts with derived recommendations, confidence scores, action verbs, category-specific detail bodies, and default views tuned for review work.
## Personas

- **Elena: EM** — wants to scan hygiene suggestions by confidence and action before a grooming session, opening details only for ambiguous recommendations.
- **Priya: PM** — wants to understand why the system is proposing stale cleanups or enrichments before she trusts the backlog health signal.
- **Tarek: Team member** — wants to inspect duplicate and enrichment recommendations for work in his area without changing Jira data.
- **Future producer implementer** — needs a stable UI/entity shape that duplicate, stale, and enrichment engines can feed once issues 13, 14, and 15 land.
- **Maintainer** — needs the second collection entity to reuse generic collection contracts instead of adding a backlog-specific table or preview stack.
## Narratives

### Elena reviews high-confidence hygiene work

Elena opens `hm` and clicks `Backlog hygiene` in the sidebar. The page opens with named view chips for `All`, `By action`, and `High confidence`. The default list is sorted by confidence so the most likely recommendations appear first.
She sees rows with the proposed action, issue key, title, assignee, status, category, and confidence. A few rows are grouped under `Close as resolved` after she switches to the `By action` view. She can use the standard settings menu to group by `confidence` and quickly scan `High`, `Medium`, and `Low` sections.
Elena checks the first high-confidence stale suggestion. The detail opens in the configured preview surface and shows the stale category badge, the action verb, the issue identity, confidence, the issue card, last activity, and rationale. She can evaluate the recommendation without leaving the page or mutating Jira.
### Tarek inspects a duplicate recommendation

Tarek sees a row that proposes merging `AMP-1149` into `AMP-1102`. The row key cell shows the relationship as `AMP-1149 → AMP-1102`, and the action cell uses a merge-style Lucide icon with the label `Merge as duplicate`.
He opens the row. The detail view shows two cards side by side: `This issue` and `Duplicate of`. Each card includes key, title, status, assignee, and last updated date when available. The rationale explains why the duplicate detector matched the pair.
Tarek changes the preview setting from side peek to full page and opens another duplicate. The same category-specific content appears in the full-page preview. Keyboard navigation continues to move through rows in the displayed collection order.
### Priya checks proposed enrichment text

Priya filters to the enrichment category because she wants to understand the quality of generated ticket rewrites. A row for `AMP-1180` has a thin original title and a high confidence score.
When Priya opens the detail, the enrichment layout shows `Original` and `Proposed` columns. The original side shows the current title/body state, including empty-body copy when no body exists. The proposed side shows the rewritten title, structured body, and labels. The proposed side has subtle accent treatment so Priya reads it as the recommendation, not as already-applied source-system data.
Priya closes the detail and continues reviewing. No approve, reject, audit-log, or write-back control appears in this feature.
## User stories

**Elena browses hygiene suggestions**
- Elena can open a `Backlog hygiene` sidebar item from the normal app shell.
- Elena can see pending hygiene suggestions in the generic collection viewer.
- Elena can read each suggestion's action, issue key, title, assignee, status, category, and confidence in the row.
- Elena can switch between the default `All`, `By action`, and `High confidence` named views.
- Elena can use the existing collection settings menu to sort, group, filter, change visible properties, change density, and change preview surface.
- Elena can see useful loading, empty, and partial-failure states without losing the collection chrome.
**Tarek opens category-specific detail**
- Tarek can open a duplicate suggestion and see target and canonical issue cards side by side.
- Tarek can open a stale suggestion and see one issue card plus last activity.
- Tarek can open an enrichment suggestion and see original and proposed content side by side.
- Tarek can see a consistent detail header across all categories.
- Tarek can close detail in side and bottom preview surfaces.
- Tarek can use full-page preview for the same category-specific detail content.
**Future producer implementer feeds the page**
- Future producer implementer can replace the fixture data source with duplicate, stale, and enrichment producer output without changing the entity contract shape.
- Future producer implementer can map producer-specific records into the same `HygieneSuggestion` model.
- Future producer implementer can report a partial failure for one producer while still rendering suggestions from other producers.
- Future producer implementer can leave bulk action handlers for issue 48.
**Maintainer validates collection reuse**
- Maintainer can see the hygiene entity registered alongside the existing Jira issue entity without Jira-specific branches in generic collection components.
- Maintainer can test hygiene cell rendering, detail rendering, confidence bucketing, page composition, and accessibility independently.
- Maintainer can verify that selection checkboxes do not imply bulk actions are available yet.
## Goals

- Add `src/entities/hygiene-suggestion/` with types, property definitions, cell renderers, detail components, defaults, and an assembled entity contract.
- Define the hygiene suggestion shape needed by duplicate, stale, and enrichment recommendations while keeping fixture fields easy to replace with producer output from issues 13, 14, and 15.
- Declare properties for `action`, `key`, `title`, `confidence`, `category`, `status`, `assignee`, and `rationale`.
- Render `ActionCell` with a Lucide icon per action verb.
- Render `CategoryCell` with `Badge` tones for `Duplicate`, `Stale`, and `Enrichment`.
- Render `ConfidenceCell` with the existing `ConfidenceChip` primitive.
- Support confidence grouping buckets: `High` for scores `>= 85`, `Medium` for `60–84`, and `Low` for `

Property
Default visibility
Side
Cell behavior

`action`
visible
left
Icon and action label.

`key`
visible
left
Target key in monospace; duplicate merges render `target → canonical`.

`title`
visible
left
Stretch property; target issue title with truncation.

`assignee`
visible
right
Display name or `Unassigned`.

`status`
visible
right
Source issue status text or badge.

`category`
visible
right
Badge for `Duplicate`, `Stale`, or `Enrichment`.

`confidence`
visible
right
`ConfidenceChip` with integer percentage.

`rationale`
hidden
right
Short explanation; available to property visibility and detail.

Selection checkboxes may render through the generic selection layer, but no bulk-action bar should offer hygiene actions in this feature. If the generic bar appears only when actions are registered, do not register hygiene actions yet. If checkboxes are present without actions, ensure tests and accessible labels do not imply that approval is available.
### Default views

Hygiene ships three default named views:

View
Sort
Group
Filter
Notes

`All`
Confidence desc, key asc
None
None
Shows every pending suggestion.

`By action`
Confidence desc, key asc
Action
None
Groups suggestions by proposed action.

`High confidence`
Confidence desc, key asc
None
Confidence `>= 85` when filters are available
Because filters exist in the current collection layer, this view should apply the confidence filter. If implementation discovers filters cannot express numeric `>=`, ship the view unfiltered with a short TODO in code and keep the spec noted in the implementation handoff.

Deleted defaults should follow the existing named-view behavior: do not re-seed deleted defaults after first use unless the generic seed contract already does so for all entities.
### Grouping and sorting

Groupable properties:
- `action` — bucket order: `Close as resolved`, `Merge as duplicate`, `Reassign`, `Ping for context`, `Enrich title + body`.
- `category` — bucket order: `Duplicate`, `Stale`, `Enrichment`.
- `confidence` — bucket order: `High`, `Medium`, `Low`.
- `status` — deterministic source status order when known; otherwise discovered alphabetical buckets.
- `assignee` — alphabetical buckets with `Unassigned` last.
Sortable properties are `action`, `category`, `confidence`, `status`, `assignee`, `key`, and `title`. Confidence sorts numerically. Text and categorical values sort deterministically with missing values last.
When grouping is active, the grouped property's row cell should hide just as it does for Jira issues, so the section header does not repeat in every row.
### Detail header

Every detail variant uses the same header shape:
```plain text
[category badge] → [action verb]
KEY · Issue title                                      [confidence] [close]
```
The close affordance is supplied by side and bottom preview hosts. Full-page preview uses its existing back/navigation strip. The entity detail body should not add a second close button when the host already provides one.
The header must show:
- Category badge.
- Arrow separator.
- Action verb.
- Target key and title.
- Confidence chip.
- Rationale block at the bottom of the body.
### Duplicate detail

Duplicate suggestions render two issue cards side by side:
```plain text
┌─ This issue ──────────┐  ┌─ Duplicate of ──────────┐
│ AMP-1149              │  │ AMP-1102                │
│ Search panel hangs…   │  │ Search panel hangs…     │
│ Open · Tarek Hassan   │  │ Open · Unassigned       │
│ updated 2026-05-19    │  │ updated 2026-05-12      │
└───────────────────────┘  └─────────────────────────┘
```
Each card renders key, title, status, assignee, and updated date when present. Missing values use honest fallbacks such as `Unassigned` or omit the line.
### Stale detail

Stale suggestions render one issue card plus last activity:
```plain text
┌──────────────────────────────────────────────────────┐
│ AMP-1043                                             │
│ Worker pool exits on empty queue on shutdown         │
│ Open · Priya Naidu                                   │
│ updated 2026-04-12                                   │
└──────────────────────────────────────────────────────┘

Last activity: 2026-04-12 (6 weeks ago)
```
If the fixture or producer does not provide a last-activity date, show `Last activity unknown` rather than inventing a date.
### Enrichment detail

Enrichment suggestions render original and proposed columns:
```plain text
┌─ Original ───────────┐  ┌─ Proposed ───────────┐
│ bug                  │  │ Crash on Settings…   │
│ No body yet          │  │ ## Steps to reproduce│
│                      │  │ 1. Add a Jira source │
│                      │  │ Labels: bug, P1      │
└──────────────────────┘  └──────────────────────┘
```
The proposed side uses a subtle primary-tinted surface or border from design-system tokens. It must not look like an already-applied mutation.
### Loading, empty, and partial-failure states

The collection header remains visible once views are loaded.
- **Loading**: show a centered spinner or skeleton rows with accessible label `Loading hygiene suggestions`.
- **Empty**: title `No suggestions yet`; description `The triage engines have not produced any suggestions for this project. Suggestions appear here as the engines run.`
- **Partial failure**: show loaded suggestions plus a non-blocking banner such as `The duplicate-detection engine is unavailable. Showing available suggestions.` Include `Retry` only if the data hook has a real retry path.
- **Full failure**: show a safe empty/error state such as `Could not load hygiene suggestions` without raw stack traces, SQL text, tokens, or source-system secrets.
### Accessibility

- Row open buttons have accessible names that include the action and issue key.
- Duplicate key cells expose readable text, not only an icon or arrow glyph.
- Detail headers use semantic headings where practical.
- Category badges and confidence chips are text-readable.
- Loading states use `role="status"` through `Spinner`.
- Partial-failure banners use `role="status"` or `role="alert"` depending on severity.
- Axe checks pass for the page and each detail variant.
## Tech spec

### Prerequisites and references

- Issue 47: `feat(collections): hygiene-suggestion entity and read rendering`.
- `context-agent/collections/collection-enhance.md`, especially `The hygiene-suggestion entity`, `Detail content`, and `The unified surface`.
- `context-agent/collections/collection-read.md` for named views, settings menu, grouping, filtering, preview surfaces, and page states.
- `context-agent/collections/collection-write.md` for the boundary between selection and bulk actions.
- `context-agent/design-system.md` for tokens, primitives, app shell patterns, `Badge`, `ConfidenceChip`, `EmptyState`, `Spinner`, and accessibility rules.
- `context-human/specs/feature-collection-viewer-foundation.md` and later collection specs for the existing generic collection implementation.
- ADR-002 for Tauri + React architecture.
- ADR-003 for local-first single-user v1.
- ADR-004 for SQLite as the local store.
- ADR-008 for settings and credential separation.
### Current implementation context

`src/features/backlog-hygiene/BacklogHygienePage.tsx` currently exports static `titleBar`, `header`, and `content` placeholders. `src/features/collection-viewer/useCollectionViewer.tsx` currently hardcodes `jiraIssueEntity`, `useJiraIssues()`, Jira copy, and Jira id fields even though the underlying `Body`, `Row`, `Detail`, `FullPagePreview`, `CollectionHeader`, view settings menu, selection hook, sort, group, and filter helpers are generic.
Issue 47 should avoid copying the Jira-specific hook wholesale. Prefer extracting a reusable generic hook/component that accepts:
- `entity`.
- `items`, `loading`, `error`, optional `partialFailures`, and optional `retry`.
- entity-specific loading/empty/error copy.
- id access through `entity.getId(item)` instead of `work_item_id`.
Then Jira issues and backlog hygiene can both bind the same collection viewer composition to different entities and data hooks.
### Hygiene suggestion model

Add `src/entities/hygiene-suggestion/types.ts` with a fixture/producers-friendly shape similar to:
```typescript
export type HygieneCategory = "duplicate" | "stale" | "enrichment";

export type HygieneAction =
  | "close-as-resolved"
  | "merge-as-duplicate"
  | "reassign"
  | "ping-for-context"
  | "enrich-title-and-body";

export type HygieneIssueRef = {
  key: string;
  title: string;
  status?: string | null;
  assignee?: string | null;
  updatedAt?: string | null;
  body?: string | null;
  labels?: string[];
};

export type HygieneSuggestion = {
  id: string;
  category: HygieneCategory;
  action: HygieneAction;
  confidence: number;
  rationale: string;
  target: HygieneIssueRef;
  duplicateOf?: HygieneIssueRef | null;
  lastActivityAt?: string | null;
  proposed?: {
    title?: string | null;
    body?: string | null;
    labels?: string[];
  } | null;
};
```
Exact field names can change during implementation, but the model must support all row cells and the three detail layouts without fake data. Keep fields local to the frontend until a producer-backed Rust type exists.
### Entity files

Add these files:
```plain text
src/entities/hygiene-suggestion/
├── types.ts
├── properties.ts
├── cells.tsx
├── detail.tsx
├── defaults.ts
└── index.tsx
```
Responsibilities:
- `types.ts` declares `HygieneSuggestion`, category/action unions, issue refs, and property ids.
- `properties.ts` declares property metadata helpers, confidence bucket logic, and labels for actions/categories.
- `cells.tsx` renders property cells.
- `detail.tsx` exports `SuggestionDetail` and category-specific `DuplicateDetail`, `StaleDetail`, and `EnrichmentDetail` helpers.
- `defaults.ts` exports `DEFAULT_PROPERTIES` and `HYGIENE_SUGGESTION_DEFAULT_VIEWS`.
- `index.tsx` assembles `hygieneSuggestionEntity` as an `EntityContract`.
### Property contract

Use property ids:
```typescript
export type HygieneSuggestionProperty =
  | "action"
  | "key"
  | "title"
  | "confidence"
  | "category"
  | "status"
  | "assignee"
  | "rationale";
```
Derived values:
- `key`: `target.key`, or `target.key → duplicateOf.key` for duplicate suggestions with a canonical issue.
- `title`: `target.title`.
- `status`: `target.status ?? "No status"` for grouping; row cell can render muted fallback.
- `assignee`: `target.assignee ?? "Unassigned"`.
- `confidence`: clamp display to `0–100` if fixture data is malformed, but keep tests around normal values.
### Default views and config

Default views should use the existing `CollectionView` shape. Their `entityKind` is `hygiene-suggestion`.
`All` config:
- default layout from `defaultViewConfig(entity)`.
- sort: `confidence desc`, `key asc`.
- group: `null`.
- filters: `[]`.
`By action` config:
- sort: `confidence desc`, `key asc`.
- group property: `action`.
- hide empty groups: `true`.
`High confidence` config:
- sort: `confidence desc`, `key asc`.
- group: `null`.
- filter: confidence greater than or equal to `85` if the existing filter operator set supports this.
If the current filter types need small generic additions to support numeric greater-than, make those additions in the generic filter layer with Jira tests kept green. Do not hardcode high-confidence filtering in only the hygiene page.
### Data hook and fixture

Add `src/features/backlog-hygiene/data.ts` exporting `useHygieneSuggestions()`.
Suggested result type:
```typescript
type HygieneSuggestionsResult = {
  suggestions: HygieneSuggestion[];
  loading: boolean;
  error: string | null;
  partialFailures: { source: string; message: string }[];
  retry?: () => void;
};
```
For issue 47, producers may not exist. If no producer/store command exists, add a small JSON or TypeScript fixture beside the feature, such as `src/features/backlog-hygiene/fixture.ts` or `fixtures/hygiene-suggestions.json`, with at least:
- one duplicate suggestion;
- one stale close suggestion;
- one stale reassign or ping suggestion;
- one enrichment suggestion;
- confidence values covering `High`, `Medium`, and `Low` buckets.
The fixture is a UI development fallback, not a product data model. Name the seam clearly so producer issues can replace it with local store reads.
### Collection viewer generalization

Refactor `useCollectionViewer` or add a new generic hook so entity-specific inputs are passed in. A possible shape:
```typescript
export type UseEntityCollectionViewerArgs = {
  active: boolean;
  entity: EntityContract;
  items: TItem[];
  loading: boolean;
  error: string | null;
  copy: {
    loadingLabel: string;
    emptyTitle: string;
    emptyDescription: string;
    errorTitle: string;
  };
  partialFailures?: { source: string; message: string }[];
  retry?: () => void;
};
```
The generic hook must:
- Use `entity.getId(item)` everywhere for selected id, display order, selection, and navigation.
- Use `entity.defaultViews` for seeding.
- Save active view preference under `entity.id`.
- Normalize view config against the active entity.
- Pass active entity to `ViewSettingsMenu`, `Body`, `Detail`, and `FullPagePreview`.
- Keep Jira issue behavior unchanged after refactor.
### Backlog hygiene page composition

Update `BacklogHygienePage` so it composes the generic collection viewer with:
- `hygieneSuggestionEntity`.
- `useHygieneSuggestions()`.
- title bar breadcrumb `Backlog hygiene`.
- loading copy `Loading hygiene suggestions`.
- empty copy from the collection-enhance contract.
- error copy `Could not load hygiene suggestions`.
- partial-failure banner above the body when needed.
The exported shape can remain `{ titleBar, header, content }` if that matches the app shell, or it can follow whatever abstraction is created for Jira issues. Keep the shell slot behavior consistent between Jira issues and backlog hygiene.
### Sidebar routing

Update `src/App.tsx`:
- Extend page state to include `backlog-hygiene`.
- Add a `Backlog hygiene` nav item with an appropriate Lucide icon, such as `Sparkles`, `ListTodo`, or another existing app-shell icon.
- Preserve current settings mode behavior.
- Ensure keyboard selection/navigation is active only for the currently focused collection page.
### Security, privacy, and compliance

- Fixture data must be synthetic. Do not commit real issue titles, real user names, tokens, source URLs with credentials, or internal customer data.
- If a future store command returns errors, display safe high-level UI copy. Do not show raw SQL, stack traces, tokens, authorization headers, or source-system response bodies.
- This feature reads local data only. It must not call Jira or AI providers directly.
- Do not add telemetry or remote reporting.
### Testing plan

Add or update tests:
- `src/entities/hygiene-suggestion/cells.test.tsx`
	- `ActionCell` renders the correct label and an icon for each action.
	- `KeyCell` renders `target → canonical` for duplicate suggestions.
	- `CategoryCell` renders a badge for each category.
	- `ConfidenceCell` renders percentage text via `ConfidenceChip`.
- `src/entities/hygiene-suggestion/detail.test.tsx`
	- Duplicate detail renders both issue cards.
	- Stale detail renders one card and last activity.
	- Enrichment detail renders original and proposed columns.
	- Shared header content appears for all categories.
- `src/entities/hygiene-suggestion/properties.test.ts`
	- Confidence bucket function maps `95 → High`, `75 → Medium`, and `55 → Low`.
	- Action and category bucket orders are stable.
	- Missing assignee buckets as `Unassigned` and sorts last.
- Generic collection refactor tests
	- Existing Jira collection viewer tests still pass.
	- Generic hook uses `entity.getId` instead of Jira-specific `work_item_id`.
	- Default views seed independently for `jira-issue` and `hygiene-suggestion`.
- `src/features/backlog-hygiene/BacklogHygienePage.test.tsx`
	- Page renders fixture suggestions.
	- Opening a row shows the correct detail flavor.
	- Group by `action` renders sections with expected counts.
	- Empty, loading, full-error, and partial-failure states render.
	- Axe passes for the page.
- Playwright smoke
	- Open `Backlog hygiene`.
	- See suggestions.
	- Click a row and see a category-specific detail surface.
	- Change grouping to `category` and see duplicate, stale, and enrichment sections.
### Verification

Target implementation checks:
```plain text
npm run lint
npm test
npm run build
```
Manual verification:
```plain text
npm run tauri dev
```
Then:
1. Open `Backlog hygiene` from the sidebar.
2. Confirm default view chips `All`, `By action`, and `High confidence` appear.
3. Confirm fixture or producer-backed suggestions render.
4. Group by `confidence` and verify `High`, `Medium`, and `Low` appear in that order.
5. Open duplicate, stale, and enrichment suggestions and verify each detail layout.
6. Switch preview surface to side peek, bottom peek, and full page and verify detail content remains correct.
7. Confirm no approve/reject action mutates source data in this feature.
### Risks

- Producer issues may land with a different data shape. Keep a clear mapping layer in `useHygieneSuggestions()` so the entity contract remains stable.
- The current collection viewer hook is Jira-specific. Refactoring it is the highest implementation risk because it can regress Jira issue browsing; protect the refactor with existing Jira tests before adding hygiene behavior.
- The `High confidence` default view depends on numeric filter support. If the current generic filter operators cannot express `>= 85`, implementation may need a small generic filter enhancement or must document the temporary unfiltered fallback.
- Partial-failure behavior is easy to overbuild without producers. Ship a simple banner contract and avoid fake retry behavior unless the data source can retry.
- Fixture data can become stale once producers exist. Keep the fixture small, synthetic, and isolated so it can be removed cleanly.
## Task list

- [ ] **Story: Hygiene suggestion entity contract**
	- [ ] **Task: Define hygiene suggestion types**
		- **Description**: Add `src/entities/hygiene-suggestion/types.ts` with category/action unions, issue refs, proposed enrichment shape, and the `HygieneSuggestion` type.
		- **Acceptance criteria**:
			- [ ] Types support duplicate, stale, and enrichment detail layouts.
			- [ ] Types include stable ids, target issue refs, confidence, category, action, and rationale.
			- [ ] Optional fields use honest `null`/missing handling instead of requiring fake data.
		- **Dependencies**: None
	- [ ] **Task: Define hygiene properties, bucket helpers, and comparators**
		- **Description**: Add property ids, labels, derived value helpers, confidence buckets, action/category bucket orders, and deterministic comparators.
		- **Acceptance criteria**:
			- [ ] Properties include `action`, `key`, `title`, `confidence`, `category`, `status`, `assignee`, and `rationale`.
			- [ ] Confidence bucket maps `>= 85` to `High`, `60–84` to `Medium`, and `< 60` to `Low`.
			- [ ] Groupable properties and bucket order match this spec.
			- [ ] Sortable properties include action, category, confidence, status, assignee, key, and title.
			- [ ] Unit tests cover bucket and comparator behavior.
		- **Dependencies**: Hygiene types
	- [ ] **Task: Implement hygiene cell renderers**
		- **Description**: Add `cells.tsx` with one cell per property using existing design-system primitives.
		- **Acceptance criteria**:
			- [ ] Action cell shows a Lucide icon and action label.
			- [ ] Key cell shows duplicate arrows when `duplicateOf` is present.
			- [ ] Category cell uses `Badge` with stable tones.
			- [ ] Confidence cell uses `ConfidenceChip`.
			- [ ] Assignee and status cells render safe missing-value fallbacks.
			- [ ] Unit tests cover representative sample suggestions.
		- **Dependencies**: Hygiene properties
	- [ ] **Task: Implement hygiene detail variants**
		- **Description**: Add `SuggestionDetail`, `DuplicateDetail`, `StaleDetail`, and `EnrichmentDetail`.
		- **Acceptance criteria**:
			- [ ] Shared header appears for all categories.
			- [ ] Duplicate detail renders target and canonical issue cards side by side.
			- [ ] Stale detail renders one issue card and last activity line.
			- [ ] Enrichment detail renders original and proposed columns.
			- [ ] Rationale appears at the bottom of every detail body.
			- [ ] Detail tests cover all three categories.
		- **Dependencies**: Hygiene cells and types
	- [ ] **Task: Assemble the hygiene entity contract**
		- **Description**: Add `defaults.ts` and `index.tsx` exporting `hygieneSuggestionEntity`.
		- **Acceptance criteria**:
			- [ ] Entity id is `hygiene-suggestion`.
			- [ ] Default property layout matches this spec.
			- [ ] Default views are `All`, `By action`, and `High confidence`.
			- [ ] Entity exposes sortable, groupable, and filterable metadata.
			- [ ] Entity `getRowLabel` includes action and key for accessible row names.
		- **Dependencies**: Hygiene detail, properties, and cells
- [ ] **Story: Reusable collection viewer binding**
	- [ ] **Task: Extract a generic collection viewer hook/component**
		- **Description**: Refactor Jira-specific `useCollectionViewer` logic so Jira issues and hygiene suggestions can use the same collection viewer composition.
		- **Acceptance criteria**:
			- [ ] Generic code accepts an entity contract and item load state.
			- [ ] Generic code uses `entity.getId(item)` for selection, preview navigation, and row keys.
			- [ ] View seeding, active view preferences, config normalization, sorting, filtering, grouping, preview surfaces, and selection work per entity.
			- [ ] Jira issue page behavior and tests remain unchanged.
		- **Dependencies**: Existing collection viewer tests
	- [ ] **Task: Support entity-specific page copy and partial-failure banners**
		- **Description**: Let the generic collection viewer render entity-specific loading, empty, error, and partial-failure copy.
		- **Acceptance criteria**:
			- [ ] Jira copy remains `Jira issues` specific.
			- [ ] Hygiene copy uses `Loading hygiene suggestions`, `No suggestions yet`, and `Could not load hygiene suggestions`.
			- [ ] Partial failures render above available rows without blocking interaction.
			- [ ] No raw error details are exposed in UI.
		- **Dependencies**: Generic collection viewer extraction
	- [ ] **Task: Verify independent default view seeding**
		- **Description**: Ensure `jira-issue` and `hygiene-suggestion` views seed and persist independently.
		- **Acceptance criteria**:
			- [ ] Active view preference keys are scoped by entity id.
			- [ ] Deleting or renaming a Jira issue view does not affect hygiene views.
			- [ ] Tests cover separate seeding for both entity ids.
		- **Dependencies**: Generic collection viewer extraction, hygiene entity defaults
- [ ] **Story: Backlog hygiene page and data source**
	- [ ] **Task: Add fixture-backed hygiene data hook**
		- **Description**: Add `src/features/backlog-hygiene/data.ts` and a small synthetic fixture used when no producer-backed store exists.
		- **Acceptance criteria**:
			- [ ] Hook returns suggestions, loading, error, partial failures, and optional retry.
			- [ ] Fixture includes duplicate, stale, and enrichment suggestions.
			- [ ] Fixture includes high, medium, and low confidence values.
			- [ ] Fixture data is synthetic and contains no real secrets or customer data.
			- [ ] Hook has a clear seam to replace the fixture with producer output.
		- **Dependencies**: Hygiene types
	- [ ] **Task: Replace placeholder BacklogHygienePage**
		- **Description**: Update `BacklogHygienePage.tsx` to render the collection viewer bound to `hygieneSuggestionEntity` and `useHygieneSuggestions()`.
		- **Acceptance criteria**:
			- [ ] Title bar breadcrumb says `Backlog hygiene`.
			- [ ] Header renders view chips and view settings for hygiene suggestions.
			- [ ] Body renders hygiene rows from fixture or producer data.
			- [ ] Opening a row shows the correct category-specific detail.
			- [ ] Loading, empty, error, and partial-failure states render.
			- [ ] Axe passes for the page.
		- **Dependencies**: Generic collection viewer binding, hygiene entity, data hook
	- [ ] **Task: Wire sidebar navigation**
		- **Description**: Add `Backlog hygiene` to the main app sidebar and route it to `BacklogHygienePage`.
		- **Acceptance criteria**:
			- [ ] Sidebar shows `Inbox`, `Jira issues`, and `Backlog hygiene` when not in settings mode.
			- [ ] Active state follows the current page.
			- [ ] Keyboard navigation is active only for the focused collection page.
			- [ ] Existing app shell behavior for settings remains unchanged.
		- **Dependencies**: Backlog hygiene page
- [ ] **Story: Validation and smoke coverage**
	- [ ] **Task: Add focused unit and component tests**
		- **Description**: Add tests for hygiene cells, detail variants, property buckets, default views, page states, and generic collection binding.
		- **Acceptance criteria**:
			- [ ] Cell tests cover all visible default row cells.
			- [ ] Detail tests cover duplicate, stale, and enrichment layouts.
			- [ ] Bucket tests cover confidence thresholds and bucket order.
			- [ ] Page tests cover fixture rendering, grouping by action, detail open/close, empty, loading, full-error, and partial-failure states.
			- [ ] Existing Jira collection tests pass after the generic refactor.
		- **Dependencies**: Entity and page implementation
	- [ ] **Task: Add Playwright smoke flow**
		- **Description**: Add or update an e2e flow for opening backlog hygiene, inspecting a suggestion, and grouping by category.
		- **Acceptance criteria**:
			- [ ] Test opens `Backlog hygiene`.
			- [ ] Test sees fixture-backed suggestions or seeded test data.
			- [ ] Test opens a row and verifies category-specific detail content.
			- [ ] Test groups by `category` and verifies duplicate, stale, and enrichment sections.
			- [ ] Test does not depend on a developer's personal SQLite database.
		- **Dependencies**: Backlog hygiene page, test fixture path
	- [ ] **Task: Run implementation verification**
		- **Description**: Run the repository checks and document any skipped manual verification.
		- **Acceptance criteria**:
			- [ ] `npm run lint` passes.
			- [ ] `npm test` passes.
			- [ ] `npm run build` passes.
			- [ ] Manual `npm run tauri dev` verification is completed or explicitly skipped with a reason.
		- **Dependencies**: All implementation tasks