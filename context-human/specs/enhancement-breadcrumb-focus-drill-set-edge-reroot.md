---
created: 2026-05-31
last_updated: 2026-05-31
status: implementing
issue: 81
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Breadcrumb focus-drill and set-edge re-root drill-through

## What

`hm` needs drill-through navigation from item previews. When a preview shows a connection to one concrete target, following that edge swaps the current preview content to the target and records the path in a breadcrumb. When a preview shows a connection to a set of related items, following that edge re-roots the collection list to that set so the user can sort, group, filter, select, and preview the related items as a normal collection.
This enhancement adds the read-side navigation behavior described in `context-human/concepts/navigation.md`. It introduces an entity-owned edge contract, a shared connections region for preview details, focus-drill breadcrumb state for side, bottom, and full-page previews, and a collection re-root stack for set-shaped edges. Dangling edges to un-ingested items remain visible but disabled, with clear copy that explains why the target cannot open.
The work targets the collection viewer first. Jira issue previews are the first concrete consumer because they already have the preview field, description, comment, and detail surface pieces. The implementation should not invent link creation, link deletion, or write-back behavior; it only renders available read-side edges and handles navigation when the target data is already local.
## Why

The collection viewer is useful as a list, but `hm` is meant to expose relationships across systems. A Jira issue may point to a duplicate, a blocking issue, a related PR, or a set of similar work items. If every connection is a dead label, users still have to copy keys into Jira or search manually.
Focus-drill keeps local exploration fast. Elena can open one issue, follow its duplicate link, then follow the related PR without losing the path she took. The breadcrumb answers “how did I get here?” and lets her jump back without re-searching.
Set-drill keeps related-item exploration in the strongest existing surface: the collection list. A set such as “all related issues” is not a single preview. It needs list machinery: display order, grouping, filters, selection, keyboard movement, and the configured preview surface. Re-rooting the list lets the user inspect a related set without building a second mini-list inside the preview.
Dangling edges must be explicit because incomplete local data is normal. If a Jira issue links to a project that was not ingested, hiding the relationship loses signal and clicking a broken row feels like a bug. A disabled row tells the truth: the relationship exists, but `hm` cannot drill into it yet.
## Personas

- **Elena: EM** — reviews triage context and wants to move from an issue to its duplicate, blocker, or related PR while keeping a clear path back to the starting issue.
- **Priya: PM** — follows roadmap-related issue sets and wants those related items to behave like a normal list with her saved sort, group, filter, and preview settings.
- **Tarek: Team member** — explores an unfamiliar area and needs cross-system links to feel uniform whether the next item is a Jira issue, GitHub PR, report, or future entity.
- **Future connections implementer** — needs a generic edge contract and navigation host so source, local, and suggested connection rows can plug in without changing collection navigation again.
- **Maintainer** — needs tests that lock focus-drill, breadcrumb truncation, set re-rooting, dangling disabled rows, display-order integration, and keyboard behavior before more entity types depend on it.
## Narratives

### Elena follows a duplicate chain and returns by breadcrumb

Elena opens the Jira issues collection and selects `AMP-1087`. The side peek shows the normal issue preview and a Connections region near the bottom. One row says `duplicates AMP-1102 Consolidate sync retries`.
She clicks that row. The side peek does not open a second rail. Instead, the content swaps to `AMP-1102`, and a breadcrumb appears above the preview content: `AMP-1087 › AMP-1102`. Elena can still see that she started from `AMP-1087`.
`AMP-1102` has a related PR edge. Elena follows it, and the breadcrumb becomes `AMP-1087 › AMP-1102 › PR #190`. After checking the PR, she clicks `AMP-1087` in the breadcrumb. The breadcrumb truncates back to the first item, and the preview shows `AMP-1087` again.
### Priya re-roots the list to a related set

Priya opens a roadmap issue and sees a set-shaped connection row: `all related issues (8)`. She follows it. The collection list changes from her original `All open` view to the eight related issues.
The row order still follows the active view pipeline: filters first, then sort, then grouping. The preview surface is still the one selected in View settings. The header includes a clear re-root affordance such as `Related to AMP-1087` with a `Back to All open` action.
Priya groups the related set by status and opens two issues in the bottom peek. When she is done, she returns to the original collection. Her original view, selected row, preview open state, and configured layout are restored.
### Tarek sees a dangling cross-project link

Tarek opens an issue that references `SEC-441`, a ticket from a project he has not synced. The connection row appears with the key, title if known, and a disabled treatment. Its hint says `Not ingested`.
Tarek cannot activate the row with click or keyboard. The row remains visible in the Connections region so he knows there is a cross-project dependency. He can decide to add that project to source configuration later, but this enhancement does not open Settings or start ingestion for him.
### A future entity adds drillable edges

A future GitHub PR entity ships. Its detail component declares edges to referenced Jira issues and source commits through the same collection edge contract. The collection viewer does not need GitHub-specific navigation code.
Single-target PR edges focus-drill into the target entity when the target exists locally. Set edges re-root the list when the target set can be resolved. Dangling edges render disabled. The behavior is uniform because the edge kind and target shape drive navigation, not the source system.
## User stories

**Elena focus-drills through single-target edges**
- Elena can see concrete single-target connection rows in an item preview.
- Elena can activate a drillable single-target edge with pointer or keyboard.
- Elena sees the current preview swap to the target item without changing the underlying collection list.
- Elena sees a breadcrumb trail containing each focus-drill hop.
- Elena can click an earlier crumb to return to that item and truncate later crumbs.
- Elena can close the preview and keep the collection list in its previous state.
**Priya re-roots to set edges**
- Priya can see set-shaped connection rows with a label and count when count is known.
- Priya can activate a drillable set edge.
- Priya sees the collection list re-root to the resolved set.
- Priya can use the active view's sort, group, filter, density, selection, keyboard movement, and preview surface on the re-rooted set.
- Priya can return to the prior collection root.
- Priya can nest re-roots only if the implementation keeps a clear stack; otherwise the first version may replace the current root while preserving a one-step return.
**Tarek understands dangling edges**
- Tarek can see an edge even when the target item has not been ingested.
- Tarek sees a disabled state and a short reason such as `Not ingested`.
- Tarek cannot activate dangling rows with pointer, Enter, Space, or numeric shortcuts.
- Tarek does not see an error toast for simply trying to activate a disabled row.
**Future connections implementer supplies edges**
- Future implementer can add entity edges by declaring a resolver or static edge list on the entity contract.
- Future implementer can mark each edge as `single` or `set` so the navigation host chooses focus-drill or list re-root.
- Future implementer can distinguish `source`, `local`, and `suggested` edge kinds for rendering without coupling navigation to storage.
- Future implementer can represent unresolved targets without inventing fake items.
**Maintainer verifies navigation behavior**
- Maintainer can run tests for breadcrumb state, focus-drill target swapping, set re-root stack behavior, display-order integration, disabled dangling rows, and accessibility.
- Maintainer can add more entity types without duplicating navigation state inside each detail component.
## Goals

- Add a generic collection edge contract for preview-hosted connections.
- Support single-target edges that focus-drill by replacing the preview item.
- Render a breadcrumb trail for focus-drill history in side peek, bottom peek, and full-page preview surfaces.
- Let earlier breadcrumb clicks truncate the trail and restore the selected focus item.
- Support set-shaped edges that re-root the collection list to a resolved related item set.
- Preserve the active named view's display pipeline on a re-rooted set: filter, sort, group, render, selection, and preview navigation.
- Provide a clear return affordance from a re-rooted list to the previous collection root.
- Render dangling edges as visible, disabled rows with a reason.
- Keep cross-system and cross-project navigation behavior uniform when target entities are locally available.
- Use the existing link-kind icon mapping and secondary-highlight treatment from the design system.
- Keep read-side navigation local and reversible; do not write to source systems.
- Cover behavior with focused unit and component tests.
## Non-goals

- No `⌘K` quick switcher implementation.
- No global search, result ranking, semantic search, or embedding-cost decisions.
- No in-palette traversal or numeric connection shortcuts inside the quick switcher.
- No link creation, suggested-link promotion, link deletion, suppression, or source write-back.
- No new Jira ingestion scope, GitHub ingestion, or background sync behavior.
- No inline editing from the preview.
- No mixed-entity collection list if the current collection layer cannot render mixed entity rows yet; cross-entity single-target focus-drill may be deferred behind a typed target registry if needed.
- No custom breadcrumb persistence across app restarts.
- No new design-system primitive unless existing primitives cannot meet accessibility needs.
## Design spec

### Preview with breadcrumb

When focus-drill history has more than one item, the preview surface shows a breadcrumb strip above the entity detail content and below the host navigation chrome:
```plain text
┌──────────────────────────────────────────────┐
│ 2 of 12                         ↑ ↓      [X] │  existing detail host chrome
├──────────────────────────────────────────────┤
│ AMP-1087 › AMP-1102 › PR #190                │  focus-drill breadcrumb
├──────────────────────────────────────────────┤
│ [PR] PR #190 · Merged                         │
│ feat: add ac-prune command                    │
│ …canonical preview…                           │
└──────────────────────────────────────────────┘
```
The breadcrumb uses the existing `Breadcrumb` primitive if it fits the compact preview layout. Each crumb label is the target's best identity: Jira key, PR number, report id, or a safe fallback. The last crumb is current and not clickable. Earlier crumbs are buttons, not links, because they mutate local preview state rather than navigate to a route.
Clicking an earlier crumb truncates the trail to that crumb. For example, `A › B › C › D`, click `B`, and the trail becomes `A › B`. The preview content shows `B`.
### Focus-drill behavior

A single-target edge replaces only the preview focus item. It does not alter the collection's root item list, active named view, row display order, or row filters. The originating row remains selected in the underlying list unless the target is also part of that list and the implementation intentionally syncs selected row highlighting. The simplest accepted behavior is: list selection stays anchored to the row that opened the drill chain; breadcrumb owns the focus path.
If the user clicks a different row in the list, the focus-drill trail resets to that row. If the user closes and reopens the preview for the same row, the first implementation may reset the trail; persistence across close is not required.
Keyboard movement through collection rows should reset focus-drill to the newly selected row. Up/down row navigation remains list navigation, not breadcrumb navigation.
### Connections region

The Connections region appears near the bottom of the preview, after comments and before status-history style diagnostic sections when those still exist. It uses one row per edge:
```plain text
Connections
🔗 duplicates    AMP-1102  Consolidate sync retries
🌐 references    PR #190   feat: add ac-prune command
✦ similar        AMP-800   Deprecate LSP from JSCA        83% related
🔗 all related   8 issues                                 Open set
🔗 blocks        SEC-441   External secret rotation        Not ingested
```
Rules:
- `source`, `local`, and `suggested` edge kinds use the shared icon mapping in `src/ui/data/linkKindIcons.tsx`.
- Category meaning comes from icon shape and text, not accent color.
- Suggested edge confidence or relatedness uses `SecondaryHighlightChip`, not primary accent styling.
- Single-target rows show target key and title when known.
- Set rows show a set label and count when known.
- Dangling rows use disabled text and a short reason. They remain focusable only if a tooltip or explanation requires focus; otherwise they are skipped by tab order and marked `aria-disabled`.
- The region has an accessible name such as `Connections`.
This enhancement may add the Connections region only for Jira issue previews if that is the first available source of edge data. The component itself should remain generic.
### Edge target shapes

Each edge has a navigation shape:
- **Single target** — one concrete item. Activating it focus-drills.
- **Set target** — a resolved set of items. Activating it re-roots the collection list.
- **Dangling target** — an unresolved or un-ingested target. It renders disabled.
The user does not choose focus vs re-root. The edge shape decides.
### Set-edge re-root

Activating a set edge changes the collection root from the base item list to the edge's resolved item set. It should feel like opening a scoped collection:
```plain text
[ All open ] [ Mine ] [ Recently updated ] [ + ]       [ view settings ]
Related to AMP-1087 · 8 issues                         [Back to All open]
───────────────────────────────────────────────────────────────────────
☐ AMP-1102  Consolidate sync retries        Open       2h ago
☐ AMP-800   Deprecate LSP from JSCA          Triage     1d ago
```
The re-root banner or header strip should include:
- The set label, for example `Related to AMP-1087`.
- The current count after resolution and before or after filters; use explicit copy such as `8 related items` or `3 matching of 8` if filters hide some.
- A return action, for example `Back to All open`.
The active named view still controls layout. If the view has active filters that hide some related items, the empty state should say `No matching related items` and suggest clearing filters.
### Re-root stack

The minimal acceptable stack is one level: activate a set edge, then return to the prior collection root. A better implementation keeps a stack so a set opened from another set can return step by step. If nested set-drill is supported, the header should show enough context to avoid confusion, for example `Related to AMP-1087 › Stale linked issues`.
Either approach must keep the return action safe and deterministic. Returning restores:
- the prior root item set;
- the prior selected row id if that item still exists;
- whether the preview was open;
- collapsed group state if practical, or a safe expanded default if not.
### Dangling edges

A dangling edge is visible but not drillable. Use this state when:
- the target source item is referenced by key or upstream id but not present in local SQLite;
- the target source is not configured;
- the target set cannot be resolved locally;
- the entity kind is not supported by the current collection target registry.
Copy should be short and specific: `Not ingested`, `Source not configured`, or `Unsupported target`. Do not show raw database ids or upstream API errors in the row.
### Accessibility

- The Connections region is a named section.
- Drillable edge rows are buttons with accessible names that include relationship label, target identity, and action, such as `Open duplicate AMP-1102`.
- Set rows include the set action, such as `Open all related issues, 8 items`.
- Disabled dangling rows expose disabled state and reason.
- Breadcrumb buttons have accessible labels such as `Return to AMP-1087`.
- The current crumb exposes `aria-current="page"` or equivalent.
- Re-root banners use a status or labelled region so screen-reader users understand that the list scope changed.
- Focus remains predictable after activation: focus may move to the preview heading after focus-drill and to the collection body or re-root banner after set-drill.
## Tech spec

### Prerequisites and references

- Issue #81 — `feat(navigation): breadcrumb focus-drill and set-edge re-root drill-through`.
- `context-human/concepts/navigation.md` — focus-drill, set-drill, dangling edges, and movement-mode boundaries.
- `context-human/concepts/preview.md` — canonical preview anatomy and connection-region placement.
- `context-human/concepts/connections.md` — source/local/suggested edge kinds and row rendering rules.
- `context-agent/collections/collection-read.md` — display pipeline, preview surfaces, keyboard movement, and list re-rooting dependency.
- `context-human/specs/enhancement-preview-field-property-model.md` — preview field model prerequisite already present in code.
- `context-human/specs/enhancement-clamped-description-recent-comments-regions.md` — description and comments regions that precede Connections.
- `context-agent/design-system.md` — breadcrumb primitive, link-kind icons, secondary-highlight chip, token rules, and accessibility contracts.
- ADR-002 — Tauri + React architecture.
- ADR-003 — local-first, single-user v1.
- ADR-010 — single-store data layering. Edge references should use stable source identifiers, not regenerated local ids, when persistence is introduced.
- ADR-011 — write actions are out of scope; future link mutations follow the staged write model.
### Current code context

The collection viewer already has these useful seams:
```plain text
src/features/collection-viewer/useEntityCollectionViewer.tsx
  owns active view, display pipeline, selected row, preview open state,
  side/bottom/full preview rendering, keyboard row movement

src/views/collection/Detail.tsx
  hosts side and bottom peeks, supplies EntityPreviewMetadata

src/views/collection/FullPagePreview.tsx
  hosts full-page preview

src/views/collection/types.ts
  owns EntityContract and EntityDetailProps

src/entities/jira-issue/detail.tsx
  renders identity, PreviewFields, PreviewDescription, PreviewComments,
  and status history
```
The preview field model exists. A connections/navigation contract does not yet exist in code. Add the new seams in the collection layer and keep Jira-specific edge resolution in the Jira entity module.
### Proposed module layout

```plain text
src/views/collection/navigation/
  types.ts                    Edge and target types
  focusTrail.ts               Pure breadcrumb/focus-drill helpers
  rerootStack.ts              Pure collection root stack helpers
  focusTrail.test.ts
  rerootStack.test.ts

src/views/collection/preview/
  PreviewConnections.tsx      Shared connections region
  PreviewBreadcrumb.tsx       Compact breadcrumb strip if Breadcrumb needs wrapping
  PreviewConnections.test.tsx

src/entities/jira-issue/
  connections.ts              Jira edge definitions/resolver for first supported edges
  connections.test.ts
```
If a smaller implementation keeps `types.ts` near `src/views/collection/types.ts`, that is acceptable. Keep behavior-specific pure helpers separate enough to test without rendering the full collection page.
### Edge contract

Extend `EntityContract` with optional connection support:
```typescript
export type CollectionEdgeKind = "source" | "local" | "suggested";
export type CollectionEdgeShape = "single" | "set";
export type CollectionEdgeDanglingReason =
  | "not-ingested"
  | "source-not-configured"
  | "unsupported-target"
  | "unresolved";

export type CollectionItemRef = {
  entityId: string;
  sourceId?: string | null;
  sourceKind?: string;
  upstreamId?: string;
  localId?: string;
  displayKey: string;
  title?: string | null;
};

export type SingleTargetEdge = {
  id: string;
  kind: CollectionEdgeKind;
  shape: "single";
  relationship: string;
  targetRef: CollectionItemRef;
  target?: TItem;
  danglingReason?: CollectionEdgeDanglingReason;
  confidence?: number;
};

export type SetTargetEdge = {
  id: string;
  kind: CollectionEdgeKind;
  shape: "set";
  relationship: string;
  label: string;
  count?: number;
  items?: TItem[];
  danglingReason?: CollectionEdgeDanglingReason;
  confidence?: number;
};

export type CollectionEdge =
  | SingleTargetEdge
  | SetTargetEdge;
```
For issue #81, `target?: TItem` and `items?: TItem[]` are enough for same-entity Jira issue drill-through. Cross-entity targets should remain represented by `entityId`; if the collection viewer cannot safely host mixed entity detail yet, mark those edges `unsupported-target` until a typed target registry exists.
Add optional `resolveEdges` to the entity contract:
```typescript
resolveEdges?: (args: {
  item: TItem;
  allItems: TItem[];
}) => CollectionEdge[];
```
This keeps the first version local to the current collection's item corpus. Future source/local/suggested edge storage can replace the resolver internals without changing the preview navigation host.
### Focus trail state

In `useEntityCollectionViewer`, add a focus trail derived from the selected row:
```typescript
type FocusTrailEntry = {
  item: TItem;
  label: string;
};
```
Behavior:
- Selecting a row initializes the trail to `[selected item]` and opens the preview.
- Activating a single edge with `target` appends the target to the trail.
- Activating an earlier crumb truncates the trail to that index.
- The preview host renders the trail's last item, not always `selectedItem`.
- Moving to a different collection row resets the trail to the new selected item.
- Closing the preview can preserve or reset the trail; reopening after row selection must be deterministic. Prefer reset on new row selection and preserve while closed for the same row only if it is simple.
Pure helper tests should cover append, duplicate target handling, truncation, reset, and label fallback. If a user drills from `A` to `B` and then follows an edge back to `A`, allow `A › B › A`; do not silently deduplicate because loops are valid graph paths.
### Preview host changes

`Detail` and `FullPagePreview` should accept optional breadcrumb data and render it outside the entity detail component. The entity detail should not own breadcrumb state.
Potential props:
```typescript
focusTrail?: Array;
onPickFocusCrumb?: (index: number) => void;
```
`Detail` and `FullPagePreview` already own host chrome and pass `EntityPreviewMetadata` to the entity detail. Rendering the breadcrumb there keeps the same breadcrumb across side peek, bottom peek, and full-page surfaces.
### Connections rendering and callbacks

`PreviewConnections` should accept edges and callbacks:
```typescript
type PreviewConnectionsProps = {
  edges: CollectionEdge[];
  onOpenSingle: (edge: SingleTargetEdge) => void;
  onOpenSet: (edge: SetTargetEdge) => void;
};
```
The component decides rendering and disabled state from `edge.shape`, `edge.target`, `edge.items`, and `edge.danglingReason`. It does not mutate collection state directly.
The entity detail needs access to edges and callbacks. There are two acceptable approaches:
1. Add `edges` and edge callbacks to `EntityDetailProps`.
2. Keep entity details pure and render `PreviewConnections` from the generic host after `EntityDetail`.
Prefer option 1 only if connection placement must be inside the entity detail anatomy, after comments. The Jira detail currently renders description/comments/status history internally, so option 1 is likely simpler for issue #81. If so, extend `EntityDetailProps` carefully:
```typescript
export type EntityDetailProps = {
  item: TItem;
  preview?: EntityPreviewMetadata;
  edges?: CollectionEdge[];
  onOpenSingleEdge?: (edge: SingleTargetEdge) => void;
  onOpenSetEdge?: (edge: SetTargetEdge) => void;
};
```
Entities that ignore edges continue to work.
### Set re-root state

Add a collection root stack to `useEntityCollectionViewer`:
```typescript
type CollectionRoot = {
  id: string;
  label: string;
  items: TItem[];
  selectedId: string | null;
  previewOpen: boolean;
};
```
The base root uses the `items` passed into the hook. Activating a set edge with resolved items pushes a new root or replaces the active re-root, depending on chosen scope. The display pipeline then reads from `activeRoot.items` instead of raw `items`.
Important display pipeline rule:
```plain text
activeRoot.items → filterCollectionItems → sortCollectionItems → bucket/group → displayItems
```
Do not re-root after filtering or sorting. The set is the source corpus for the active view, then view settings apply normally.
When returning to the prior root:
- restore `items` from the previous root;
- restore `selectedId` if present and valid;
- restore `previewOpen`;
- clear focus trail to the restored selected item;
- clear row selection only if selected ids no longer exist in the active root, or keep selected ids if the selection model already tolerates hidden rows.
### Jira issue edge resolver for first pass

Use the simplest available local data. If the current `JiraIssueListItem` binding does not expose issue links, PR references, duplicate metadata, or suggested related items, the first implementation should add the generic navigation seams and test with fixture-provided resolver data rather than faking production Jira links.
Possible Jira resolver behavior:
- Resolve same-project key references only if issue-link data is already available in current bindings.
- Resolve set edges such as `same project` only if product accepts that as a temporary local fixture; otherwise keep set-edge tests at the generic collection layer.
- Mark unsupported cross-entity PR edges as `unsupported-target` until a GitHub PR entity and local data exist.
The implementation must not show invented relationships in production UI. It is acceptable for tests and storybook-like fixtures to supply synthetic edges.
### Error and edge-case handling

- If a single edge loses its target between render and activation, do nothing or render a safe disabled update; do not throw.
- If a set edge resolves to an empty set, re-root to an empty scoped collection with clear empty copy rather than erroring.
- If active filters hide every item in a re-rooted set, show the existing filtered-empty state with scoped copy.
- If a drilled target is not part of the base list, row navigation still moves through the base list, not through breadcrumb targets.
- If a set re-root contains ids not present in the current entity contract, drop unsupported items and surface `Unsupported target` for mixed-entity sets until mixed collections exist.
### Testing plan

Add or update tests for:
- Focus trail helper initializes, appends, allows loops, truncates, and resets.
- `Detail` renders breadcrumbs in side and bottom peek surfaces.
- `FullPagePreview` renders breadcrumbs and keeps existing back/keyboard hint behavior.
- `PreviewConnections` renders source/local/suggested icons through shared metadata.
- `PreviewConnections` renders single-target, set-target, confidence, and dangling states.
- Drillable edge rows are keyboard operable and have accessible names.
- Dangling edge rows cannot be activated and expose a reason.
- `useEntityCollectionViewer` single-edge activation swaps preview focus without changing the base list.
- Clicking a row resets the focus trail.
- Breadcrumb click truncates the trail and restores that focus item.
- Set-edge activation re-roots the display pipeline before filter/sort/group.
- Returning from re-root restores the prior root and selection safely.
- Keyboard up/down continues to move through the active display list after re-root.
- Active view settings still control preview surface, density, grouping, sorting, and filtering on re-rooted sets.
- Accessibility checks cover the preview with breadcrumb plus connections and the scoped re-root banner.
### Verification plan

Targeted checks for implementation:
```plain text
npm test -- PreviewConnections
npm test -- useEntityCollectionViewer
npm test -- Detail
npm test -- FullPagePreview
npm run lint
npm test
npm run build
```
Manual verification with fixture or real edge data:
```plain text
npm run tauri dev
```
Then:
1. Open `Jira issues`.
2. Open an issue with connection fixture data.
3. Follow a single-target edge and confirm the preview swaps and breadcrumb appears.
4. Click an earlier crumb and confirm the trail truncates.
5. Follow a set edge and confirm the list re-roots.
6. Apply sort/group/filter settings and confirm they affect the re-rooted set.
7. Return to the original collection and confirm the prior row/preview state is restored.
8. Confirm dangling edges are visible, disabled, and do not throw errors.
### Risks and follow-ups

- Production Jira issue link data may not be available in current bindings. Do not fake production edges; land generic navigation seams and only render real edges when data exists.
- Cross-entity focus-drill needs a target registry and detail component lookup. If that is not present, same-entity drill-through should ship first and cross-entity edges should render disabled as `Unsupported target`.
- Mixed-entity set re-root is out of scope until collection rows can render more than one entity contract.
- Re-rooting while selection is active may create confusing hidden selections. The implementation should either scope selection to the active root or clearly clear selections on re-root.
- Breadcrumbs in compact side peeks can run out of width. Truncate middle crumbs or labels rather than wrapping the host chrome into an unusable height.
- The quick switcher remains separate and unimplemented. Do not let this work grow into global search.
## Task decomposition

### Story 1: Add collection edge and focus-trail primitives

**Description:** Define the generic read-side edge model and pure state helpers for focus-drill breadcrumbs.
**Tasks:**
1. Add edge and target types to the collection layer.
	- Acceptance criteria:
		- Types represent `source`, `local`, and `suggested` edge kinds.
		- Types represent `single`, `set`, and dangling/unresolved targets.
		- Existing entity contracts compile without declaring edges.
	- Dependencies: none.
2. Add optional edge resolver support to `EntityContract` or `EntityDetailProps`.
	- Acceptance criteria:
		- Entities can supply edges for the current item and item corpus.
		- Entities that do not supply edges render unchanged.
		- Edge callbacks are optional and typed.
	- Dependencies: task 1.
3. Add focus-trail helper functions and tests.
	- Acceptance criteria:
		- Helpers initialize from a selected item.
		- Helpers append targets, including loop paths.
		- Helpers truncate to a crumb index.
		- Helpers reset on row selection.
	- Dependencies: task 1.
### Story 2: Render preview breadcrumbs and connection rows

**Description:** Add shared UI for breadcrumb focus paths and preview-hosted connection rows.
**Tasks:**
1. Render focus breadcrumbs in `Detail` and `FullPagePreview`.
	- Acceptance criteria:
		- Breadcrumb appears only when the trail has more than one item.
		- Current crumb is not clickable and exposes current state.
		- Earlier crumbs are keyboard-operable buttons.
		- Side peek, bottom peek, and full page are covered by tests.
	- Dependencies: Story 1.
2. Add `PreviewConnections` for edge rows.
	- Acceptance criteria:
		- Source/local/suggested icons use the shared link-kind metadata.
		- Suggested confidence uses `SecondaryHighlightChip`.
		- Single-target rows call `onOpenSingle` when drillable.
		- Set rows call `onOpenSet` when drillable.
		- Dangling rows render disabled with a reason and do not call callbacks.
	- Dependencies: Story 1.
3. Add accessibility tests for breadcrumbs and connections.
	- Acceptance criteria:
		- Edge rows have descriptive accessible names.
		- Disabled rows expose disabled state and reason.
		- Breadcrumb controls have descriptive labels.
		- Tested preview states have no axe violations.
	- Dependencies: tasks 1 and 2.
### Story 3: Wire focus-drill into the collection viewer

**Description:** Make single-target edge activation swap the preview focus item while preserving the underlying collection list.
**Tasks:**
1. Add focus-trail state to `useEntityCollectionViewer`.
	- Acceptance criteria:
		- Selecting a row initializes the trail to that row.
		- The preview renders the trail's current item.
		- Moving to another row resets the trail.
	- Dependencies: Story 1.
2. Handle single-target edge activation.
	- Acceptance criteria:
		- Activating a drillable edge appends its target and swaps preview content.
		- The base list and active view remain unchanged.
		- Missing targets do not throw and are treated as disabled.
	- Dependencies: task 1 and Story 2.
3. Handle breadcrumb truncation.
	- Acceptance criteria:
		- Clicking an earlier crumb truncates the trail.
		- Preview content updates to that crumb's item.
		- Later crumbs disappear from the breadcrumb.
	- Dependencies: task 1.
4. Add component tests for focus-drill behavior.
	- Acceptance criteria:
		- Tests cover row open, edge drill, breadcrumb return, row reset, and close behavior.
		- Tests prove row display order is not changed by focus-drill.
	- Dependencies: tasks 1-3.
### Story 4: Add set-edge list re-rooting

**Description:** Let set-shaped edges replace the collection root with a related item set while reusing active view settings.
**Tasks:**
1. Add re-root stack helpers and tests.
	- Acceptance criteria:
		- Helpers push or replace a scoped root according to the chosen first-version behavior.
		- Helpers restore the previous root.
		- Helpers preserve valid selected ids and preview-open state.
		- Helpers handle empty sets.
	- Dependencies: Story 1.
2. Thread the active root through the collection display pipeline.
	- Acceptance criteria:
		- Filter, sort, group, and render use `activeRoot.items`.
		- Base collection behavior remains unchanged when no re-root is active.
		- Display count and filtered empty state are correct for scoped roots.
	- Dependencies: task 1.
3. Add a re-root banner or header strip.
	- Acceptance criteria:
		- The UI names the active scoped set.
		- The UI exposes a return action.
		- The return action restores the prior root safely.
		- The banner has accessible status/region semantics.
	- Dependencies: task 2.
4. Handle set-edge activation from `PreviewConnections`.
	- Acceptance criteria:
		- Drillable set edges re-root to their resolved item set.
		- Empty resolved sets show a scoped empty state.
		- Dangling or unsupported set edges remain disabled.
	- Dependencies: task 2 and Story 2.
5. Add tests for re-root display behavior.
	- Acceptance criteria:
		- Tests prove filters run after re-root, not before.
		- Tests prove sort and group apply to re-rooted items.
		- Tests prove keyboard up/down uses re-rooted display order.
		- Tests prove return restores prior root and selection.
	- Dependencies: tasks 2-4.
### Story 5: Add first entity integration without fake production edges

**Description:** Connect the navigation seam to Jira issue previews where real or fixture edge data exists, while keeping unavailable targets honest.
**Tasks:**
1. Add a Jira issue connection resolver module.
	- Acceptance criteria:
		- Resolver consumes only real available fields or explicit test fixture data.
		- Resolver does not invent production relationships.
		- Resolver marks unsupported or un-ingested targets as dangling.
	- Dependencies: Story 1.
2. Render connections from `JiraIssueDetail`.
	- Acceptance criteria:
		- Connections appear after description/comments and before status history or equivalent lower diagnostic sections.
		- Existing preview fields, description, comments, and status-history behavior remain intact.
		- Jira detail tests cover no edges, drillable edges, and dangling edges.
	- Dependencies: Story 2 and task 1.
3. Add fixture data for collection-viewer navigation tests if production data is unavailable.
	- Acceptance criteria:
		- Tests exercise single-target and set-edge navigation without real Jira credentials.
		- Test fixtures are clearly marked and do not appear as real production relationships.
	- Dependencies: task 1.
### Story 6: Verify and update durable context

**Description:** Run focused checks, broader validation, and update agent context only if shared UI contracts change.
**Tasks:**
1. Run targeted frontend tests.
	- Acceptance criteria:
		- Focus-trail helper tests pass.
		- Re-root helper tests pass.
		- `PreviewConnections` tests pass.
		- `Detail`, `FullPagePreview`, and `useEntityCollectionViewer` navigation tests pass.
	- Dependencies: Stories 1-5.
2. Run broad validation.
	- Acceptance criteria:
		- `npm run lint` passes.
		- `npm test` passes.
		- `npm run build` passes or failures are documented with exact causes.
	- Dependencies: task 1.
3. Update `context-agent/design-system.md` if needed.
	- Acceptance criteria:
		- No update is made if implementation only composes existing `Breadcrumb`, link-kind icons, and data chips.
		- Any new shared primitive, prop contract, token, or recurring pattern is documented in the same PR.
	- Dependencies: Stories 2-5.
4. Record implementation notes in `context-agent/wiki/code-map.md` or another durable agent note if new navigation modules land.
	- Acceptance criteria:
		- Future agents can find the edge contract, focus-trail helpers, re-root stack, and Jira resolver without rediscovery.
		- Notes stay agent-facing and do not duplicate this human-facing spec.
	- Dependencies: Stories 1-5.