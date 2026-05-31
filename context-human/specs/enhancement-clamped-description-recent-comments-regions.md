---
created: 2026-05-31
last_updated: 2026-05-31
status: complete
issue: 80
issue_url: [https://github.com/markdstafford/hm/issues/80](https://github.com/markdstafford/hm/issues/80)
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Clamped description and recent comments regions

## What

`hm` needs Jira issue previews to render the next two canonical preview regions after identity and fields: **Description** and **Comments**. This enhancement adds a description region below the preview field region and a comments region below description. Both regions follow `context-human/concepts/preview.md` and preserve the existing preview surface behavior across side peek, bottom peek, and full page.
The description region renders the source issue body through the existing Markdown pipeline. It clamps long descriptions by default and exposes `Show more` / `Show less` only when the rendered content is actually truncated. Short descriptions render in full. Empty descriptions render muted text reading `No description` instead of hiding the section, because a missing description is useful signal for triage and enrichment.
The comments region renders read-only Jira comments newest first. It shows the two most recent comments by default, with author, date, and Markdown body for each comment. If more than two comments exist, the region shows `Show all N comments`; expanding reveals the remaining comments in the same newest-first order and offers `Show fewer` to return to the compact view. Posting comments remains outside this enhancement and continues to belong to the edit/write model in ADR-011 and `context-human/concepts/edits.md`.
This enhancement depends on the preview field/tier model from issue #79. The description and comments regions should sit after the new field region and before existing lower-detail sections such as status history. The first implementation target is Jira issue previews, but the component shape should be reusable by future issue-like entities.
## Why

A preview should answer the next triage question without forcing the user to leave the collection. After identity and fields tell Elena what an issue is, the description and latest discussion tell her whether the issue is actionable, stale, or missing basic information.
Long descriptions can dominate a compact preview. Without a clamp, a single heavily templated Jira body pushes comments, connections, and history out of reach. The default collapsed state keeps the preview scannable while still making the full body one click away.
Comments need a similar default. The latest comment often changes the decision: someone may have confirmed the bug, marked it moot, or asked for missing details. Showing the two newest comments first gives Priya and Tarek the most useful activity signal without making them scroll through years of old discussion.
The app already ingests `work_items.body` and `work_item_comments`, but the current Jira list/detail binding exposes only list fields and status history to the frontend. This enhancement closes that read-model gap for preview content while keeping source data read-only.
## Personas

- **Elena: EM** — scans Jira issue previews during backlog triage and needs a compact description plus the latest comments before deciding whether to assign, close, or investigate.
- **Priya: PM** — reviews roadmap issues and needs enough description and recent discussion to understand whether an item still reflects current product intent.
- **Tarek: Team member** — opens unfamiliar issues from a collection and needs readable Markdown, clear empty states, and a way to expand only when he needs more context.
- **Future issue-source implementer** — needs reusable description and comments region contracts for GitHub issues, PRs, and other issue-like sources without copying Jira-specific UI.
- **Maintainer** — needs tests that lock in clamp behavior, newest-first comment ordering, expand/collapse behavior, empty states, and status-history preservation.
## Narratives

### Elena scans a long issue without losing the rest of the preview

Elena opens a Jira issue in a side peek during triage. The preview shows the identity and tier-one fields first. Under them, the description region shows the beginning of a long Jira body and a `Show more` control.
Elena can read enough to identify the issue without the description taking over the rail. She sees the comments heading and the two latest comments below the clamped body. She decides the issue needs follow-up without opening Jira.
When the first lines are not enough, Elena clicks `Show more`. The description expands in place. She clicks `Show less` when she is done, and the preview returns to its compact shape.
### Priya checks recent discussion before a roadmap review

Priya opens an issue in full-page preview. The comments region reads `Comments (5)` and shows the newest two comments first. The top comment is from yesterday and says the customer no longer needs the request.
Priya clicks `Show all 5 comments` to read the older thread. The comments remain newest first, so the expanded list adds older context below the recent comments rather than reordering what she just read. She clicks `Show fewer` before moving to the next issue.
### Tarek sees clear absence instead of blank space

Tarek opens a sparse issue that has no description and no comments. The description region remains visible with muted `No description`. The comments region does not render because there are no comments to inspect.
Tarek understands that the missing description is meaningful. He does not have to wonder whether the preview failed to load the body. Because comments are absent, the preview skips that region and keeps status history close.
### A future GitHub issue source reuses the same regions

A future GitHub issue adapter maps its body and comments into the preview region contract. The generic description component handles clamp and empty text. The generic comments component handles newest-first sorting, default count, and expand/collapse.
The GitHub adapter supplies source-specific author names, dates, and Markdown bodies. It does not fork the preview layout just to get the same behavior Jira already uses.
## User stories

**Elena reads a clamped description**
- Elena can open a Jira issue preview and see a `Description` heading below the field region.
- Elena can read a non-empty short description in full without a toggle.
- Elena can see long descriptions clamped by default.
- Elena can expand a clamped description with `Show more`.
- Elena can collapse an expanded description with `Show less`.
- Elena sees `No description` when the issue body is empty, null, or whitespace-only.
**Priya reviews newest comments first**
- Priya can see a `Comments (N)` heading when an issue has one or more comments.
- Priya sees comments sorted newest first by source update time when present, otherwise source creation time.
- Priya sees the two most recent comments by default.
- Priya can click `Show all N comments` when `N > 2`.
- Priya can click `Show fewer` after expanding all comments.
- Priya does not see a show-all control when there are two or fewer comments.
**Tarek reads comments safely and accessibly**
- Tarek sees each comment's author, date, and body.
- Tarek sees a fallback author such as `Unknown author` when identity data is missing.
- Tarek sees source dates formatted with the app's existing local date/time formatter.
- Tarek can operate description and comments toggles with keyboard and screen reader state.
- Tarek can read Markdown content without scripts, raw HTML behavior, or unsafe source markup.
**Future issue-source implementer reuses region contracts**
- Future implementer can map an item body into a generic preview description region.
- Future implementer can map comments into a generic preview comments region.
- Future implementer can keep source-specific data loading outside the generic visual components.
- Future implementer can reuse newest-first ordering, default count, labels, empty handling, and expand/collapse behavior.
**Maintainer verifies behavior**
- Maintainer can run unit tests for comment sorting, visible-comment partitioning, and empty-body detection.
- Maintainer can run component tests for clamped description toggles and comments expand/collapse.
- Maintainer can verify that existing preview field and status-history tests still pass.
- Maintainer can run accessibility checks for the new preview regions.
## Goals

- Add a Jira preview description region below identity and preview fields.
- Render non-empty issue bodies through the existing Markdown component.
- Clamp long descriptions by default.
- Show `Show more` only when the description overflows the collapsed height.
- Show `Show less` only after the user expands a clamped description.
- Render muted `No description` for empty body values.
- Add a Jira preview comments region below description.
- Load comments for the selected Jira issue from local SQLite data.
- Sort comments newest first by `updated_at_source` when available, falling back to `created_at_source`, then ingestion/order fallback.
- Show two comments by default.
- Show `Show all N comments` only when there are more than two comments.
- Preserve newest-first ordering in collapsed and expanded states.
- Show author, date, and Markdown body for each comment.
- Keep comments read-only.
- Preserve the existing status-history region and its loading, empty, error, partial, and populated states.
- Use existing design-system tokens, headings, buttons, Markdown rendering, focus rings, and local date formatting.
- Keep preview behavior based on measured preview size where layout choices depend on space.
- Cover data loading, ordering, rendering, toggles, empty states, and accessibility with tests.
## Non-goals

- No posting, editing, deleting, or resolving comments.
- No source-system writes or staged edit creation.
- No comment composer UI.
- No configurable description clamp length.
- No configurable default visible comment count.
- No per-user or per-source setting for region order.
- No comment filtering, threading, reactions, attachments, or inline mentions beyond Markdown/text rendering supported by the current renderer.
- No connection region implementation.
- No embedded preview implementation for suggestions beyond avoiding Jira-specific visual assumptions.
- No remote Jira fetch on preview open; this enhancement reads data already ingested into the local store.
- No custom Jira markup renderer beyond the current Markdown pipeline.
## Design spec

### Preview anatomy after this enhancement

The Jira issue preview should read as a vertical stack:
```plain text
┌──────────────────────────────────────────────┐
│ AMP-1043 · Open                              │  identity
│ Fix generated relationship labels            │
├──────────────────────────────────────────────┤
│ Priority P3   Project AMP   Assignee Elena   │  fields from issue #79
│ ▸ More fields (4)                            │
├──────────────────────────────────────────────┤
│ Description                                  │
│ Steps to reproduce…                          │  clamped by default if long
│ Show more                                    │
├──────────────────────────────────────────────┤
│ Comments (4)                                 │
│ Priya · May 30, 2026                         │  newest first
│ This is probably moot now…                   │
│ Tarek · May 29, 2026                         │
│ I can reproduce this on main…                │
│ Show all 4 comments                          │
├──────────────────────────────────────────────┤
│ Status history                               │  existing region remains
└──────────────────────────────────────────────┘
```
The description and comments regions use the same cardless preview style as the existing Jira detail: section headings, token text, token borders where needed, and compact vertical spacing. The regions should not introduce a new shell, new color treatment, or a separate card stack inside the preview.
### Description region

The section heading is `Description`. A populated description renders with the existing `Markdown` component from `src/ui/text/Markdown.tsx` so links, lists, inline code, fenced code, and headings use the established text components.
The collapsed state clamps to a fixed visual height or line count that works in compact previews. The implementation should choose a token-based class such as a line clamp or max-height with overflow hidden. It must detect whether content is actually overflowing before showing `Show more`; short descriptions should not display a no-op toggle.
When expanded, the full Markdown body is visible and the control changes to `Show less`. Collapsing should keep the user in the same preview and not reload the issue. If the selected item changes, the description should reset to collapsed so a long expanded body on one issue does not surprise the next issue.
Empty means `null`, `undefined`, empty string, or whitespace-only string. Empty descriptions render:
```plain text
Description
No description
```
`No description` uses muted text and remains visible in every preview surface.
### Comments region

The comments section renders only when at least one comment exists. The heading is `Comments (N)`, where `N` is the total number of comments loaded for the issue.
Each comment renders as a small article with:
- author display name, falling back to source identity display name, username, email, or `Unknown author`;
- source timestamp, using `updated_at_source` when present, then `created_at_source`;
- Markdown body, or muted `No comment body` only if a stored comment body is empty.
The default visible set is the two newest comments. If total comments are more than two, the region shows a token-styled text button reading `Show all N comments`. Expanded state shows all comments and changes the control to `Show fewer`.
Comments stay newest first in both states. Expanding should reveal older comments below the two already shown, not reverse the timeline.
If the selected item changes, the comments region should reset to collapsed. This keeps preview navigation predictable when moving through rows with keyboard arrows.
### Loading and error behavior

Description is part of the selected issue detail payload. Comments may require a separate local command if the list payload remains small. While comments load, the comments region can show the existing `Spinner` with `Loading comments…` only if the issue has not yet resolved comment data.
If comment loading fails, render a small alert text inside the comments region: `Could not load comments. Try syncing Jira again.` The description region should still render. Status history should still load independently.
If implementation chooses to load body and comments in one detail command, the same rule applies: partial detail data should render what is available and show a scoped error only for the failed region.
### Accessibility

- The description section uses an accessible heading.
- The description toggle is a real button, keyboard operable, and exposes expanded state with `aria-expanded` when applicable.
- The comments section uses an accessible heading that includes the count.
- The comments list uses semantic list or article markup so each comment has a readable author/date/body structure.
- The comments toggle is a real button and exposes expanded state.
- Toggle labels remain visible text, not icon-only controls.
- Markdown content must not create axe violations in collapsed or expanded states.
- Focus stays on the activated toggle when expanding or collapsing.
### Responsive behavior

The regions should adapt to preview width without changing their content rules:
- In side peek, headings and metadata wrap rather than clip.
- In bottom peek, comments can use horizontal room but should remain a single chronological column.
- In full page, the body can use the same max readable width as other detail content if such a pattern exists later; this enhancement should not create a new global max-width primitive.
- Clamp and visible comment count do not change by surface. A roomy full page still starts clamped so the preview anatomy remains predictable.
## Tech spec

### Prerequisites and references

- Issue #79 / `context-human/specs/enhancement-preview-field-property-model.md` — preview field region and metadata are already present in this workspace.
- Issue #80 — `feat(preview): clamped description and recent-first comments regions`.
- `context-human/concepts/preview.md` — canonical preview anatomy for description and comments.
- `context-human/concepts/edits.md` and ADR-011 — comments are read-only here; posting comments belongs to the staged edit/write model.
- `context-agent/collections/collection-read.md` — preview surfaces and entity detail metadata contract.
- `context-agent/design-system.md` — tokens, Markdown, preview surfaces, buttons, focus rings, and accessibility patterns.
- ADR-003 — local-first architecture; preview reads local SQLite data.
- ADR-004 — SQLite primary store.
- ADR-005 — history/snapshots; this enhancement must preserve the status-history region.
### Current state

`src/entities/jira-issue/detail.tsx` currently renders identity, `PreviewFields`, and status history. `JiraIssueListItem` in `src/bindings.ts` exposes `work_item_id`, `key`, `title`, `status_name`, `assignee_display_name`, `updated_at_source`, `project_key`, `priority_name`, and `labels`. It does not expose body or comments.
The local database already has body and comments data:
- `work_items.body` stores the issue body.
- `work_item_comments` stores comment body, author identity, source created/updated timestamps, and raw payload.
- `source_identities` and `people` can provide display names for comment authors.
The implementation should add a focused detail read model rather than overloading the list item with full comments for every row.
### Data and command design

Add a local read command for Jira preview detail content. Suggested command:
```typescript
commands.jiraIssuePreviewContent(workItemId: string): Promise
```
Suggested binding shape:
```typescript
type JiraIssuePreviewContent = {
  work_item_id: string;
  body: string | null;
  comments: JiraIssuePreviewComment[];
};

type JiraIssuePreviewComment = {
  id: string;
  upstream_id: string;
  author_display_name: string | null;
  body: string | null;
  created_at_source: string | null;
  updated_at_source: string | null;
  ingested_at: string;
};
```
The Rust command should:
1. Select `body` from `work_items` by `id` and `source_kind = 'jira_issue'`.
2. Select comments from `work_item_comments` for the same `work_item_id`.
3. Left join `source_identities` and `people` for author display names.
4. Sort in SQL or TypeScript newest first by `COALESCE(updated_at_source, created_at_source, ingested_at)` descending.
5. Return an empty comments array when no comments exist.
6. Return a clear error if the work item is missing or not a Jira issue.
Do not call Jira during preview open. The source of truth for this enhancement is the local store.
If a broader issue detail command already exists by implementation time, extend it instead of adding a duplicate command. Keep the data boundary focused on detail-only fields so collection list loading stays light.
### Frontend component design

Add reusable preview components under `src/views/collection/preview/`:
```plain text
src/views/collection/preview/
├── PreviewDescription.tsx
├── PreviewComments.tsx
├── descriptionModel.ts       optional pure helpers
└── commentsModel.ts          optional pure helpers
```
`PreviewDescription` props:
```typescript
type PreviewDescriptionProps = {
  body: string | null | undefined;
  resetKey?: string;
  collapsedLines?: number;
};
```
Responsibilities:
- detect empty body values;
- render `No description` for empty values;
- render Markdown for populated values;
- clamp populated long content by default;
- measure overflow after render and after width changes;
- show `Show more` / `Show less` only when overflow exists;
- reset expanded state when `resetKey` changes.
Overflow detection can use a `ref` and compare `scrollHeight` to `clientHeight` while collapsed. Use `ResizeObserver` if available in the app's test/runtime environment, or a small effect that rechecks after render and window resize. Tests can mock the measurement path.
`PreviewComments` props:
```typescript
type PreviewComment = {
  id: string;
  authorDisplayName?: string | null;
  body?: string | null;
  createdAtSource?: string | null;
  updatedAtSource?: string | null;
  ingestedAt?: string | null;
};

type PreviewCommentsProps = {
  comments: PreviewComment[];
  resetKey?: string;
  defaultVisibleCount?: number; // default 2
};
```
Responsibilities:
- sort comments newest first through a pure helper;
- hide the whole region when the sorted list is empty;
- render the two newest comments by default;
- render `Show all N comments` only when `N > defaultVisibleCount`;
- render all comments when expanded;
- render `Show fewer` when expanded;
- reset expanded state when `resetKey` changes;
- render Markdown body content and safe fallbacks.
Keep generic preview components source-agnostic. Jira-specific commands and DTO mapping should live under `src/entities/jira-issue/` or the bindings layer.
### Jira detail integration

Update `JiraIssueDetail` to load preview content by `item.work_item_id`. It should maintain separate async state for preview content or a combined local detail state that does not block status history.
Suggested render order:
1. Identity.
2. `PreviewFields` from issue #79.
3. `PreviewDescription` using the loaded body.
4. `PreviewComments` using loaded comments.
5. Existing status history.
If body/comment content is still loading, render the description fallback only when the command resolves. Avoid showing `No description` before knowing whether the body exists. A small detail-content spinner between fields and status history is acceptable, but a region-specific skeleton or spinner is clearer.
When the selected `work_item_id` changes:
- cancel or ignore stale promise results;
- reset description expanded state;
- reset comments expanded state;
- restart comments/detail loading;
- keep status history behavior unchanged.
### Markdown and source markup

Use the existing `Markdown` component. Jira descriptions and comments may not be true Markdown in every deployment. This enhancement accepts the current project stack's Markdown rendering behavior and does not add a Jira-specific renderer.
The implementation must not render raw HTML from Jira as trusted HTML. Images should follow the current Markdown component behavior. Links should use the existing `Link` component.
### Testing plan

Add or update tests for:
- Rust repository/query helper returns body and comments for a work item.
- Rust command returns comments newest first and joins author display names.
- Rust command returns empty comments for an issue with no comments.
- Rust command rejects missing or non-Jira work item ids with a clear error.
- Generated Specta bindings include the new DTOs and command.
- `PreviewDescription` renders `No description` for null, empty, and whitespace body values.
- `PreviewDescription` renders Markdown for populated bodies.
- `PreviewDescription` shows no toggle for short content.
- `PreviewDescription` shows `Show more`, expands, and then shows `Show less` for overflowing content.
- `PreviewDescription` resets expanded state when `resetKey` changes.
- Comment sorting helper orders by `updatedAtSource`, then `createdAtSource`, then `ingestedAt` descending.
- `PreviewComments` hides when there are zero comments.
- `PreviewComments` shows `Comments (1)` or `Comments (2)` with no show-all toggle for one or two comments.
- `PreviewComments` shows the two newest comments and `Show all N comments` when there are more than two.
- `PreviewComments` expands all comments, collapses to two, and preserves newest-first order.
- `PreviewComments` renders author/date/body fallbacks.
- `JiraIssueDetail` renders identity, fields, description, comments, and status history in order.
- Existing status-history loading, error, empty, partial, and populated tests still pass.
- Component tests include axe checks for collapsed and expanded description/comments states.
### Design-system requirements

- Use existing token classes only; no hardcoded hex colors.
- Use existing `Markdown`, `Spinner`, `EmptyState` where appropriate.
- Use plain token-styled buttons or existing button primitives for toggles.
- Do not add a shared collapsible primitive unless implementation discovers a repeated need. If a shared primitive or recurring preview-region pattern is added, update `context-agent/design-system.md` in the same implementation PR.
- Keep focus rings consistent with existing preview field disclosure controls.
### Risks and follow-ups

- Jira body markup may not render perfectly as Markdown. This enhancement intentionally uses the existing Markdown pipeline and can be followed by a Jira-markup renderer only if real data proves the need.
- Some ingested comments may lack source timestamps or author identities. The spec includes fallbacks, but ordering quality depends on ingestion completeness.
- Loading body/comments per selected issue may add one local command per preview navigation. The query is local SQLite and should be fast, but implementation should ignore stale results during rapid keyboard navigation.
- The comments region is read-only. Posting a comment remains unsupported here and must route through the staged edit/write model later.
- The connection region remains unimplemented after this issue.
## Task decomposition

### Story 1: Add the local Jira preview-content read model

**Description:** Expose issue body and comments from the local SQLite store through a focused Jira preview-content command.
**Tasks:**
1. Add Rust DTOs for `JiraIssuePreviewContent` and `JiraIssuePreviewComment`.
	- Acceptance criteria:
		- DTOs include work item id, body, comment ids, author display names, comment body, source timestamps, and ingestion timestamp.
		- DTOs derive the traits needed for Tauri command return values and Specta bindings.
	- Dependencies: none.
2. Add a repository/query helper that loads preview content by `work_item_id`.
	- Acceptance criteria:
		- Query reads `work_items.body` only for `source_kind = 'jira_issue'`.
		- Query joins comments for the same work item.
		- Query joins author display names through source identities and people where available.
		- Query sorts comments newest first by updated, created, then ingested timestamp.
	- Dependencies: task 1.
3. Add the Tauri command and register it in command/binding exports.
	- Acceptance criteria:
		- Frontend can call the command through generated `commands` bindings.
		- Missing or non-Jira work item ids return a clear error string.
		- No source-system API call occurs.
	- Dependencies: task 2.
4. Add Rust tests for the query and command behavior.
	- Acceptance criteria:
		- Tests cover body loading, empty comments, multiple sorted comments, author fallback, and missing issue errors.
		- Tests fail before implementation and pass after it.
	- Dependencies: tasks 2-3.
### Story 2: Build reusable preview description rendering

**Description:** Add a generic preview description region that renders Markdown, shows empty-body signal, and clamps long content with accessible expansion.
**Tasks:**
1. Add `PreviewDescription` under the collection preview module.
	- Acceptance criteria:
		- Component renders a `Description` section heading.
		- Component renders `No description` for null, empty, or whitespace-only bodies.
		- Component renders populated bodies with the existing `Markdown` component.
	- Dependencies: none.
2. Add clamp and overflow detection.
	- Acceptance criteria:
		- Long overflowing content starts collapsed.
		- `Show more` appears only when collapsed content overflows.
		- Activating `Show more` reveals the full body and changes the control to `Show less`.
		- Activating `Show less` restores the collapsed state.
	- Dependencies: task 1.
3. Add reset behavior for preview navigation.
	- Acceptance criteria:
		- Expanded state resets when `resetKey` changes.
		- Stale measurement state does not keep a toggle visible for a short next body.
	- Dependencies: task 2.
4. Add component and accessibility tests.
	- Acceptance criteria:
		- Tests cover empty, short, long, expand/collapse, reset, Markdown rendering, keyboard operation, and axe checks.
	- Dependencies: tasks 1-3.
### Story 3: Build reusable preview comments rendering

**Description:** Add a generic preview comments region that sorts comments newest first, shows two by default, and expands all comments on demand.
**Tasks:**
1. Add pure comment helper functions.
	- Acceptance criteria:
		- Helper sorts by updated, created, then ingested timestamp descending.
		- Helper partitions comments into default visible and hidden sets.
		- Helper preserves stable deterministic order for tied or missing dates.
	- Dependencies: none.
2. Add `PreviewComments` under the collection preview module.
	- Acceptance criteria:
		- Component hides when there are zero comments.
		- Component renders `Comments (N)` for one or more comments.
		- Component renders two newest comments by default.
		- Component renders author, formatted date, and Markdown body for each visible comment.
	- Dependencies: task 1.
3. Add expand/collapse behavior.
	- Acceptance criteria:
		- `Show all N comments` appears only when `N > 2`.
		- Expanding shows all comments newest first.
		- Expanded state shows `Show fewer`.
		- Collapsing returns to the two newest comments.
		- Expanded state resets when `resetKey` changes.
	- Dependencies: task 2.
4. Add component and accessibility tests.
	- Acceptance criteria:
		- Tests cover zero, one, two, and more-than-two comments; newest-first order; expand/collapse; fallbacks; keyboard operation; and axe checks.
	- Dependencies: tasks 1-3.
### Story 4: Integrate description and comments into Jira issue detail

**Description:** Load the local preview content for the selected Jira issue and render the new regions in the canonical preview order.
**Tasks:**
1. Add a frontend data loader for Jira preview content.
	- Acceptance criteria:
		- Loader calls the new local command with `item.work_item_id`.
		- Loader maps snake_case binding DTO fields to component props if needed.
		- Loader ignores stale results when selected item changes quickly.
	- Dependencies: Story 1.
2. Update `JiraIssueDetail` render order.
	- Acceptance criteria:
		- Identity remains first.
		- `PreviewFields` remains below identity.
		- Description renders below fields.
		- Comments render below description.
		- Status history remains below comments.
	- Dependencies: Stories 2-3 and task 1.
3. Add scoped loading and error states.
	- Acceptance criteria:
		- Comment/detail loading does not block identity, fields, or status history.
		- A local preview-content error shows a scoped alert without hiding status history.
		- Empty body after successful load renders `No description`.
	- Dependencies: task 2.
4. Update Jira detail tests.
	- Acceptance criteria:
		- Tests verify identity, fields, description, comments, and status history order.
		- Tests verify body/comment load success, empty body, comment load failure, and item-change reset behavior.
		- Existing status-history tests still pass.
	- Dependencies: tasks 1-3.
### Story 5: Verify, document, and hand off

**Description:** Run focused checks and update durable context only if implementation changes shared contracts or primitives.
**Tasks:**
1. Run targeted Rust and frontend tests.
	- Acceptance criteria:
		- New Rust preview-content tests pass.
		- New preview description/comments tests pass.
		- Updated Jira detail tests pass.
	- Dependencies: Stories 1-4.
2. Run broader validation for the changed surfaces.
	- Acceptance criteria:
		- `npm test` passes, or failures are documented with exact causes.
		- `npm run lint` passes for TypeScript/React changes.
		- Relevant Rust tests pass for command/query changes.
	- Dependencies: task 1.
3. Update durable agent context when needed.
	- Acceptance criteria:
		- `context-agent/design-system.md` is updated if a new shared preview-region pattern, clamp utility, or collapsible primitive is introduced.
		- `context-agent/wiki/code-map.md` or collection notes are updated if the Jira detail read-model command becomes a durable implementation landmark.
		- No context update is made for purely local composition that follows existing documented patterns.
	- Dependencies: Stories 1-4.