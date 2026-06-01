---
created: 2026-05-31
last_updated: 2026-06-01
status: complete
issue: 82
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Quick switcher shell

## What

`hm` needs a global quick switcher opened with `⌘K`. The switcher is a centered palette with a search input, a ranked result list, and a live compact preview of the current result. It helps a user jump to any locally known item without first navigating to the right collection view.
The first version searches local items with lexical matching only. Jira issues are the first concrete entity source because the collection viewer, preview field model, description/comments regions, and connection-region navigation already exist there. The shell must stay generic so GitHub issues, PRs, reports, suggestions, and future entities can register searchable items later.
Opening a result lands the item in the normal collection surface. The switcher closes, the owning collection page becomes active, the item is selected, and the configured preview surface opens. Number keys `1`–`9` can open numbered connections from the highlighted item's compact preview and land one step deeper in the same surface. The palette is an on-ramp, not a second drill-through surface.
## Why

`hm` is built around connected work items. A user often knows the key, title fragment, or rough name of an item but not where it currently appears in the app. Without a quick switcher, Elena has to click into Jira issues, adjust filters, and search manually before she can inspect an item or follow its connections.
Fast lateral jumps complement drill-through. `⌘K` gets the user to an entry point; the collection preview and breadcrumb model handle deeper exploration. Keeping those roles separate avoids a launcher that turns into a second full navigation surface.
The compact preview is important because search results alone are often ambiguous. Seeing fields, the clamped description, recent comments, and connections for the highlighted result lets Priya choose the right `AMP-1087` without opening several candidates. Numeric connection shortcuts let Tarek jump directly from a known issue to its related PR or blocker when the compact preview exposes that relationship.
## Personas

- **Elena: EM** — jumps to a specific issue during triage or status writing and wants the item to open in her normal Jira collection view with her configured preview surface.
- **Priya: PM** — searches by title fragments during roadmap review and needs the compact preview to disambiguate similar issues before opening one.
- **Tarek: Team member** — uses keyboard-first navigation to move from a known issue to one of its numbered connections without reaching for the pointer.
- **Future entity implementer** — needs a generic search registration contract so GitHub PRs, reports, and suggestions can appear in `⌘K` without hard-coding entity-specific UI.
- **Maintainer** — needs deterministic lexical ranking and keyboard tests before semantic search, embeddings, and more entity types are added.
## Narratives

### Elena jumps to a known issue key

Elena is on the Inbox page while writing a weekly status note. Someone mentions `AMP-1087` in Slack. She presses `⌘K`, types `1087`, and sees `AMP-1087 Cardinality...` as the first result.
The preview pane shows the same compact Jira issue preview she sees elsewhere: identity, tier 1 fields, clamped description, recent comments, and connections. Elena presses `Enter`. The palette closes, the Jira issues page opens, `AMP-1087` is selected, and the detail opens in her saved preview surface.
### Priya disambiguates similar titles

Priya presses `⌘K` and types `LSP`. Several issues have similar titles. The top result preview shows an issue about a deprecated JSCA path, but Priya needs the active planning issue.
She presses `↓` to move focus from the search box into the result region, then uses `j` to move through results. Each move updates the compact preview. When the preview shows the right project, priority, and latest comment, she presses `Enter` to open it in the collection surface.
### Tarek opens a numbered connection

Tarek knows `AMP-1087` is related to a PR but does not remember the PR number. He opens `⌘K`, searches `AMP-1087`, and presses `↓` so the result region has focus. The preview lists connections with numbers, including `1 PR #190 feat: ac-prune`.
Tarek presses `1`. The switcher closes and lands `PR #190` in the normal surface when the target entity is supported locally. If the first implementation only supports Jira issue targets, unsupported PR targets appear disabled or unnumbered so the shortcut cannot fail silently.
### A future entity appears in global search

A future GitHub PR entity registers searchable items with the same quick switcher source contract. Its result rows show `PR #190`, repo, state, and title. Its compact preview uses the same entity `Detail` contract with quick-switcher preview metadata.
The quick switcher does not need GitHub-specific layout code. The entity supplies searchable text, ranking boosts, preview identity, and open behavior. The shared shell handles search state, keyboard movement, preview hosting, and closing.
## User stories

**Elena opens a result from anywhere**
- Elena can press `⌘K` from any main app page to open a centered quick switcher.
- Elena can also activate the sidebar search button to open the same switcher.
- Elena sees the search input focused when the switcher opens.
- Elena can type a key or title fragment and see ranked local results update quickly.
- Elena can press `Enter` to open the active result in its owning collection surface.
- Elena sees the switcher close after opening a result.
- Elena returns to the invoking control or page focus when she closes the switcher without opening anything.
**Priya searches and previews candidates**
- Priya sees result rows with enough identity to distinguish kind, key or number, source, status, and title when available.
- Priya sees a live compact preview for the active result.
- Priya sees the preview update as she moves through results.
- Priya sees empty, loading, and error states that do not collapse the palette.
- Priya does not see browser or OS autocomplete steal arrow keys from the search input.
**Tarek uses the keyboard model**
- Tarek can use `↑` / `↓` and `j` / `k` to move the active result.
- Tarek sees the first `↓` from the search input move focus to the top result.
- Tarek sees the result list clamp at the bottom instead of wrapping.
- Tarek can press `↑` or `k` on the top result to return focus to the search input.
- Tarek can press `Enter` to open the active result.
- Tarek can press `1`–`9` from the result region to open the active result's numbered drillable connections.
- Tarek sees digit keys type into the search input when the search input still has focus.
**Future entity implementer registers search items**
- Future implementer can register entity search sources without changing the quick switcher shell.
- Future implementer can supply lexical search fields, display metadata, preview rendering, and open behavior.
- Future implementer can omit compact preview support temporarily and receive a safe placeholder state.
- Future implementer can mark unsupported or dangling connections so they are visible but not shortcut-openable.
**Maintainer verifies behavior**
- Maintainer can run unit tests for lexical matching, ranking, result clamping, and digit shortcut selection.
- Maintainer can run component tests for dialog focus, keyboard movement, compact preview rendering, and open-result handoff.
- Maintainer can run accessibility checks for the switcher with results, no results, and connection shortcuts.
## Goals

- Add a global `⌘K` quick switcher shell.
- Use a centered overlay with a search input, ranked result list, and live compact preview.
- Open from the keyboard shortcut and the sidebar search button.
- Search locally available items with lexical matching only.
- Rank exact keys and identifiers above prefix matches, title matches, and weaker substring matches.
- Host the canonical entity preview in compact quick-switcher form.
- Show numbered drillable connections for the active result when the entity supplies edges.
- Support `Enter` to open the active result in the normal collection surface.
- Support `1`–`9` to open numbered drillable connections from the active result.
- Blur the search input on result-navigation keys so digit keys become shortcuts after navigation starts.
- Clamp list navigation instead of wrapping.
- Disable browser autocomplete, autocorrect, autocapitalize, and spellcheck on the search input.
- Keep semantic search, embeddings, and provider calls out of this feature.
- Cover search, keyboard behavior, preview hosting, collection handoff, and accessibility with tests.
## Non-goals

- No embedding or semantic search. The first version is lexical only.
- No AI provider calls, local embedder, or ranking model selection.
- No in-palette infinite drill-through or breadcrumb exploration.
- No command execution beyond opening items and numbered connections.
- No fuzzy command registry for app actions such as Settings, New issue, or Create view.
- No source ingestion, sync, or remote search. Results come from local app state or local database commands already available to the app.
- No write actions from the compact preview.
- No new source-system credentials or source configuration flow.
- No mobile layout.
- No custom color categories; use existing tokens and icon-shape rules.
## Design spec

### Palette layout

The switcher opens as a modal overlay centered in the main window. It uses the existing overlay and token system rather than a new visual language.
```plain text
┌── Search items…                         ↑↓/jk move · ↵ open · 1–9 open connection ──┐
├───────────────────────────────────────┬─────────────────────────────────────────────┤
│ [Jira] AMP-1087  Cardinality mismatch │ [Jira issue] AMP-1087 · Open                │
│ [Jira] AMP-1014  Create LSP shim      │ Cardinality mismatch in sync retries        │
│ [PR]   #190      feat: ac-prune       │ Type Bug   Priority P3   Project AMP        │
│                                       │ Description                                 │
│                                       │ first lines… [Show more]                    │
│                                       │ Connections                                  │
│                                       │ 1 PR #190 feat: ac-prune                    │
└───────────────────────────────────────┴─────────────────────────────────────────────┘
```
The shell has three fixed regions:
1. **Search header** — input, placeholder, and short keyboard hint.
2. **Result list** — ranked local matches with active-row styling.
3. **Compact preview** — the active result rendered through the canonical entity preview contract with quick-switcher metadata.
The desktop default should be wide enough for side-by-side results and preview. If the window is too narrow, the result list remains primary and the preview can stack below or collapse behind a clear `Preview` region, but macOS desktop width is the design target.
### Search input

The input placeholder is `Search items…`. The input disables browser assistance:
- `autoComplete="off"`
- `autoCorrect="off"`
- `autoCapitalize="none"`
- `spellCheck={false}`
The input is focused when the palette opens. `Escape` closes the palette. `⌘K` while the palette is open should close it or leave it open and re-focus the input; choose the simpler behavior and test it.
### Result rows

Each result row includes:
- entity kind badge or short label, such as `Jira`, `PR`, or `Report`;
- primary identifier, such as `AMP-1087` or `PR #190`;
- title;
- optional muted context, such as source, repo, project, status, or updated date.
Rows use neutral text and token-based selected styling. Kind meaning should come from text and icon shape, not custom colors.
The active row drives the preview. When the search input still has focus, the top result may be visually active for preview purposes, but focus remains in the input. The first result-navigation key moves focus into the result region.
### Compact preview host

The compact preview is the same entity detail content used by collection previews, hosted with quick-switcher preview metadata. It must not be a separate hand-written summary card.
Rules:
- The preview uses compact sizing even when the palette is wide.
- Empty preview regions remain hidden according to the preview contract.
- Description and comments keep their existing clamped behavior.
- Connections render after comments and before lower diagnostic sections when present.
- Unsupported preview content shows a clear placeholder such as `Preview unavailable for this item type`.
- Loading preview content is scoped to the preview pane and must not block result movement.
The quick switcher is the fourth preview host described in `context-human/concepts/preview.md`. Implementation may need to widen the preview metadata type to include `quick-switcher` while keeping persisted view settings limited to side peek, bottom peek, and full page.
### Numbered connections

The active result's compact preview numbers up to nine drillable connections. Numbering follows the visual order of the connection rows. Disabled or dangling rows remain visible but are not assigned shortcut numbers unless the UI clearly marks the shortcut unavailable.
Pressing a digit while the result region has focus activates that numbered connection:
- A single-target connection lands the target item in its owning collection surface when supported.
- A set-target connection lands in the owning collection with that set re-rooted when supported.
- An unsupported or dangling connection does nothing and should not have an active shortcut.
Digit keys type into the search input while the search input has focus. The user must first move into result navigation with `↓`, `↑`, `j`, or `k` before digits become connection shortcuts.
### Keyboard model

- `⌘K` opens the switcher globally. On non-macOS platforms, display the equivalent as `Ctrl+K` through the existing shortcut formatter if needed.
- `Escape` closes the switcher.
- Typing normal search characters updates the query when the input has focus.
- `↓` from the search input blurs the input, focuses the result region, and lands on the top result.
- `↑` from the search input blurs the input and lands on the top result unless there are no results.
- `j` / `k` from the search input also enter result navigation instead of typing those letters.
- `↓` / `j` moves to the next result until the bottom, then clamps.
- `↑` / `k` moves to the previous result; from the top result it returns focus to the search input.
- `Enter` opens the active result. If focus is in the input and results exist, `Enter` opens the top active result.
- `1`–`9` open numbered connections only when focus is in the result region.
- Pointer hover may update the active result, but keyboard focus remains predictable.
### Empty, loading, and error states

- Empty query may show recent or default local items if available. If no recent-item model exists, show the top lexical corpus sorted by the default entity order or a prompt to search.
- No matches shows `No local items match “query”` and keeps the input focused.
- Loading source data shows a small scoped status in the result list or preview pane.
- Source errors show safe UI copy and do not include tokens, URLs with credentials, raw SQL, or upstream stack traces.
### Opening into the surface

Opening from the switcher must feel the same as selecting a row manually:
1. The switcher closes.
2. The owning main page becomes active.
3. The owning collection's active view and display pipeline remain in control.
4. The target item is selected.
5. The configured preview surface opens.
6. Keyboard focus moves to the collection preview heading, selected row, or another deterministic target covered by tests.
If the active view's filters hide the target item, the first implementation may either clear only the minimum needed scoped filter state or show a temporary scoped root containing the opened item. It must not silently navigate to a page where the target is invisible.
## Tech spec

### Prerequisites and references

- Issue #82 — `feat(navigation): quick switcher (⌘K) shell with compact preview and keyboard model`.
- `context-human/concepts/navigation.md` — quick switcher role, keyboard model, open-to-surface behavior, and deferred embeddings.
- `context-human/concepts/preview.md` — compact preview host and canonical preview regions.
- `context-human/concepts/connections.md` — connection kinds and dangling-edge rules.
- `context-human/specs/enhancement-preview-field-property-model.md` — field tiers and compact preview behavior.
- `context-human/specs/enhancement-breadcrumb-focus-drill-set-edge-reroot.md` — connection rows, single-target focus drill, and set re-rooting behavior that the switcher reuses after landing.
- `context-agent/design-system.md` — overlay, token, keyboard shortcut, icon, and accessibility contracts.
- ADR-002 — Tauri + React architecture.
- ADR-003 — local-first, single-user v1.
- ADR-006 — AI provider abstraction; not used in this lexical-only feature.
- ADR-010 — data layering; quick switcher results should use stable source identifiers when persisted or loaded through commands.
### Current code context

Useful existing seams:
```plain text
src/App.tsx
  owns main page selection and global shell slots; currently mounts Jira collection viewer state.

src/ui/sidebar/ScopeHeader.tsx
  already renders a disabled Search button in the sidebar header.

src/shell/useShortcut.ts and src/shell/keys.ts
  provide global shortcut handling, form-field gating, and shortcut display formatting.

src/features/collection-viewer/useCollectionViewer.tsx
  wraps Jira issues and useEntityCollectionViewer.

src/features/collection-viewer/useEntityCollectionViewer.tsx
  owns selected row, preview open state, active view, display pipeline, focus trail, and re-root stack.

src/views/collection/types.ts
  defines EntityContract, EntityDetailProps, preview metadata, preview fields, and edge resolution.

src/views/collection/preview/PreviewConnections.tsx
  renders connection rows using shared link-kind metadata and callbacks.

src/entities/jira-issue/index.tsx and detail.tsx
  provide the first concrete searchable entity, preview fields, preview content, and edge resolver.
```
### Search source contract

Add a generic quick switcher registration layer in the frontend. Suggested shape:
```typescript
export type QuickSwitcherItem = {
  id: string;
  entityId: string;
  kindLabel: string;
  primaryLabel: string;
  title: string;
  contextLabel?: string;
  statusLabel?: string;
  item: TItem;
  searchableText: string[];
  rankBoosts?: {
    exact?: string[];
    prefix?: string[];
  };
};

export type QuickSwitcherSource = {
  id: string;
  entity: EntityContract;
  items: TItem[];
  toQuickSwitcherItem: (item: TItem) => QuickSwitcherItem;
  openItem: (item: TItem, options?: QuickSwitcherOpenOptions) => void;
};
```
The first source wraps `jiraIssueEntity` and the locally loaded Jira issues. Future sources can be added to the registry without changing the palette shell.
### Lexical matching and ranking

Create pure helpers under a quick-switcher feature folder, for example `src/features/quick-switcher/search.ts`.
Suggested ranking:
1. Exact primary identifier or exact key match.
2. Case-insensitive primary identifier prefix match.
3. Case-insensitive title word-prefix match.
4. Case-insensitive title substring match.
5. Case-insensitive context/source/status substring match.
6. Stable source default order as a tie-breaker.
Normalize query and fields by lowercasing, trimming, collapsing whitespace, and stripping simple punctuation around keys. Do not call embeddings, AI providers, or remote APIs.
### Preview metadata

The current `EntityPreviewMetadata.surface` uses `PreviewSurface`, which is persisted view-setting vocabulary. Add a non-persisted preview host type so quick switcher can identify itself without becoming a view setting:
```typescript
export type EntityPreviewSurface = PreviewSurface | "quick-switcher";

export type EntityPreviewMetadata = {
  surface: EntityPreviewSurface;
  width: number | null;
  height: number | null;
  sizeClass: PreviewSizeClass;
};
```
Only `ViewConfig.layout.preview` should stay limited to `side-peek`, `bottom-peek`, and `full-page`.
### Collection handoff API

Expose a controlled handoff from `useEntityCollectionViewer` so `App` or a quick-switcher coordinator can open an item by entity id and item id.
Suggested extension:
```typescript
export type UseEntityCollectionViewerResult = {
  header: ReactNode;
  body: ReactNode;
  openItemById?: (id: string, options?: { openPreview?: boolean; scopedFallback?: boolean }) => boolean;
  openSetRoot?: (root: ActiveCollectionRoot) => boolean;
};
```
For the first Jira-only version, `useCollectionViewer` can expose `openJiraIssueById`. If the target is hidden by active filters, use a deterministic fallback: either push a temporary scoped root containing the target or surface a scoped empty state that names the active filters. Prefer the scoped root because `Enter` should visibly land on the item.
### Component structure

Suggested files:
```plain text
src/features/quick-switcher/
  QuickSwitcher.tsx
  QuickSwitcher.test.tsx
  search.ts
  search.test.ts
  keyboard.ts
  keyboard.test.ts
  sources.ts
  jiraSource.ts
  types.ts
```
`QuickSwitcher` owns dialog open state, query, active index, focus mode (`input` vs `results`), source aggregation, and preview rendering. Keep search and keyboard state transitions in pure helpers where practical so the edge cases are easy to test.
### Accessibility

- Use the existing `Dialog` primitive or wrap Radix Dialog if the current wrapper is insufficient.
- The dialog title should be `Quick switcher`.
- The search input has an accessible label such as `Search items`.
- The result region should expose listbox-like semantics or a clearly labelled list with roving focus.
- Active result state must be available to assistive tech through `aria-selected`, `aria-activedescendant`, or equivalent.
- The preview pane should be a named region, for example `Preview`.
- Keyboard hints must not be the only way to understand available actions; result rows and connection rows need accessible names.
- `Escape` closes and returns focus to the opener when practical.
- Run axe coverage for default, results, no-results, and numbered-connection states.
### Security and privacy

The quick switcher must not log queries, item titles, descriptions, comments, or connection labels. Search runs locally. Error messages must be safe for display and must not include secrets or raw upstream credential data.
### Testing plan

Targeted checks:
- Unit tests for query normalization and ranking.
- Unit tests for keyboard reducer behavior: input-to-results blur, clamp, top-to-search, `Enter`, and digit shortcuts.
- Component tests for opening via shortcut and sidebar search button.
- Component tests for Jira result rendering and compact preview metadata.
- Component tests for opening a result into the Jira collection viewer.
- Component tests for numbered connection shortcuts, including disabled/dangling rows.
- Accessibility tests with axe for the dialog states.
Broader verification after implementation should include `npm test`, `npm run lint`, and `npm run build` when practical.
## Task decomposition

### Story 1: Add lexical search source and ranking helpers

**Description:** Build the generic quick-switcher data model and deterministic lexical ranking for local items.
**Tasks:**
1. Add quick switcher types and source registration helpers.
	- Acceptance criteria:
		- Types represent source id, entity contract, raw item, display labels, searchable fields, and open callbacks.
		- The shell can aggregate multiple sources into one result list.
		- No entity-specific UI code is required in the generic result list.
	- Dependencies: none.
2. Add a Jira issue quick switcher source.
	- Acceptance criteria:
		- Jira issue results include kind label, key, title, project/status context when available, and stable item id.
		- Searchable fields include key, title, project, status, labels, and assignee when available locally.
		- The source reuses `jiraIssueEntity` for preview and edge resolution.
	- Dependencies: task 1.
3. Implement lexical query normalization and ranking.
	- Acceptance criteria:
		- Exact key/id matches outrank prefix matches.
		- Prefix matches outrank title and context substrings.
		- Matching is case-insensitive and stable for ties.
		- Empty queries return a deterministic local default list or an explicit empty-query state.
	- Dependencies: task 1.
4. Add search unit tests.
	- Acceptance criteria:
		- Tests cover exact key, key prefix, title word prefix, title substring, context substring, no match, empty query, and stable tie order.
		- Tests prove no embedding or provider call is needed.
	- Dependencies: tasks 1-3.
### Story 2: Build the quick switcher overlay and compact preview host

**Description:** Add the centered palette UI with search, results, and canonical compact preview rendering.
**Tasks:**
1. Add `QuickSwitcher` dialog shell.
	- Acceptance criteria:
		- The overlay opens centered with token-based styling.
		- The dialog has title, labelled search input, result region, and preview region.
		- `Escape` closes and focus returns to the opener when practical.
		- Search input disables autocomplete, autocorrect, autocapitalize, and spellcheck.
	- Dependencies: Story 1.
2. Render ranked result rows.
	- Acceptance criteria:
		- Rows show kind, primary identifier, title, and optional context.
		- Active row styling uses design-system tokens.
		- No-results and loading/error states are clear and safe.
		- Pointer selection and keyboard active index stay in sync.
	- Dependencies: task 1.
3. Host entity detail as compact preview.
	- Acceptance criteria:
		- The active result renders through its entity `Detail` component.
		- Preview metadata includes a non-persisted `quick-switcher` surface or equivalent compact host marker.
		- Preview content loading is scoped and does not block result movement.
		- Unsupported preview types show a safe placeholder.
	- Dependencies: task 1.
4. Add overlay and preview component tests.
	- Acceptance criteria:
		- Tests cover open, close, focused input, result rows, no-results state, and compact preview metadata.
		- Tests include axe coverage for at least one populated state and one empty state.
	- Dependencies: tasks 1-3.
### Story 3: Implement keyboard navigation and numbered connection shortcuts

**Description:** Lock the keyboard model from `concepts/navigation.md` into tested state transitions.
**Tasks:**
1. Add keyboard state helpers for focus mode and active result index.
	- Acceptance criteria:
		- Helpers handle input mode, results mode, empty result sets, and clamped movement.
		- `↓`, `↑`, `j`, and `k` blur the search input into result navigation as specified.
		- `↑`/`k` at the top result returns to input focus.
	- Dependencies: Story 2.
2. Wire `Enter` result opening.
	- Acceptance criteria:
		- `Enter` opens the active result from input focus or result focus.
		- `Enter` does nothing safely when there are no results.
		- The switcher closes after a successful open.
	- Dependencies: task 1.
3. Add numbered connection collection from active preview edges.
	- Acceptance criteria:
		- Up to nine drillable edges receive shortcut numbers in visual order.
		- Dangling and unsupported edges are not activatable by digit shortcut.
		- Accessible names include shortcut numbers where visible.
	- Dependencies: Story 2.
4. Wire `1`–`9` shortcuts from result focus.
	- Acceptance criteria:
		- Digit keys type into the search input while input has focus.
		- Digit keys activate numbered edges only while result region has focus.
		- Single-target and supported set-target edges call the correct open handoff.
		- Unsupported edges do not throw or close the switcher.
	- Dependencies: task 3.
5. Add keyboard tests.
	- Acceptance criteria:
		- Tests cover arrow and `j`/`k` movement, blur-search-on-arrow, clamping, top-to-search behavior, `Enter`, input digits, result-region digits, and disabled edge shortcuts.
	- Dependencies: tasks 1-4.
### Story 4: Wire global opening and collection handoff

**Description:** Connect `⌘K`, the sidebar search button, and open-result behavior to the app shell and Jira collection viewer.
**Tasks:**
1. Enable global quick switcher open controls.
	- Acceptance criteria:
		- `⌘K` opens the switcher from main app pages.
		- The sidebar Search button is enabled and opens the switcher.
		- The shortcut prevents browser/WebView default search behavior.
		- Shortcut handling does not break existing `⌘⇧D` showcase shortcut.
	- Dependencies: Story 2.
2. Expose a Jira collection open-by-id handoff.
	- Acceptance criteria:
		- `useCollectionViewer` or its underlying entity viewer can select a Jira issue by id.
		- Opening by id switches to the Jira issues page.
		- The configured preview surface opens for the selected item.
		- If filters hide the item, the implementation uses a tested scoped fallback or clear visible explanation.
	- Dependencies: Story 1.
3. Open quick switcher results into the collection surface.
	- Acceptance criteria:
		- Opening a Jira result closes the switcher and lands on the selected issue.
		- The active named view remains active unless a scoped fallback is needed to show the item.
		- Focus lands predictably after handoff.
	- Dependencies: task 2 and Story 3.
4. Open numbered connections into the collection surface.
	- Acceptance criteria:
		- Supported single-target Jira issue connections land on the target item.
		- Supported set-target Jira issue connections land in a re-rooted collection scope.
		- Unsupported cross-entity targets remain visible but cannot fail silently.
	- Dependencies: task 2 and Story 3.
5. Add integration tests for handoff.
	- Acceptance criteria:
		- Tests open the switcher from Inbox and land on Jira issues.
		- Tests open an item hidden by a filter and verify the chosen fallback.
		- Tests activate a numbered connection and verify the resulting selected item or scoped root.
	- Dependencies: tasks 1-4.
### Story 5: Verify and document the shared UI pattern

**Description:** Finish validation and update durable agent context for the new shared quick-switcher pattern.
**Tasks:**
1. Update `context-agent/design-system.md` if implementation adds or changes shared overlay, preview-host, shortcut, or sidebar-search behavior.
	- Acceptance criteria:
		- The design-system maintenance contract is satisfied.
		- New quick-switcher host rules are documented near overlays, navigation, or preview surfaces as appropriate.
	- Dependencies: Stories 2-4.
2. Add or update durable code-map/testing notes if new quick-switcher source or handoff patterns are introduced.
	- Acceptance criteria:
		- Future agents can find the source registry, ranking helpers, and collection handoff API.
		- Test commands or harness gotchas are recorded in `context-agent/wiki/testing.md` if discovered.
	- Dependencies: Stories 1-4.
3. Run verification.
	- Acceptance criteria:
		- Targeted quick-switcher tests pass.
		- Existing collection viewer tests pass.
		- `npm test`, `npm run lint`, and `npm run build` pass when practical.
		- Any skipped check is documented with the reason.
	- Dependencies: Stories 1-4.
## Open questions and implementation notes

- The issue explicitly defers embeddings. Do not add semantic search in this implementation. Record ranking limitations as follow-up work instead.
- The current app has one mounted collection viewer for Jira issues. A simple Jira-first handoff is acceptable if the source registry and API shape do not block future entities.
- `j` and `k` are specified as navigation keys even from the search input. This means users cannot type those letters while the input is focused if the implementation follows the issue text strictly. If implementation chooses the more common behavior where `j`/`k` type in the input until focus enters the result list, document the deliberate deviation and update `concepts/navigation.md`.
- If opening a filtered-out result would be complex, prefer a temporary scoped root that contains the selected item over silently leaving the user on a hidden row.
- Cross-entity numbered connection opening should remain unsupported until the target entity has a registered collection handoff. Unsupported connections should be visible but not numbered or activatable.