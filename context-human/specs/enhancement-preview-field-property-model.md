---
created: 2026-05-31
last_updated: 2026-05-31
status: complete
issue: 79
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Preview field property model

## What

`hm` needs the item preview field region to become a real, reusable property model instead of entity-specific detail markup. This enhancement adds a two-tier field area to preview details: tier 1 fields render inline under the identity region, while populated tier 2 and tier 3 fields sit behind a `More fields (N)` disclosure.
The model must hide empty fields in every tier. The disclosure count includes only populated secondary fields, so the preview never promises blank content. The field region also adapts to the measured preview width: tier 1 remains inline and wraps, while expanded secondary fields render in two columns on roomy surfaces and one column on narrow surfaces.
Field tiering is configurable per source. Each source ships sensible defaults, and a pinned field override forces a property into tier 1 for that source. Pinned fields show a small pin marker so the user can tell the field was promoted. Every rendered field reuses the collection list's entity-owned cell renderers so a status, person, label, date, or key looks the same in rows, previews, and embedded preview cards.
This enhancement targets Jira issue previews first and adds the generic seams future GitHub issues, GitHub PRs, hygiene suggestions, reports, and embedded previews can use later.
## Why

Real work items carry many fields, and most sources are sparse. A Jira issue can expose dozens of fields, but fields such as sprint, resolution, epic name, votes, and customer may be empty for most issues. Showing every declared field creates a wall of blank values and pushes useful content out of view.
The preview needs the opposite behavior: show the few fields people need to scan first, keep secondary fields available, and omit empty values entirely. Elena should see type, priority, project, assignee, and a pinned team field immediately. Priya should be able to expand secondary planning fields only when they matter. Tarek should see the same status badge and assignee rendering he already learned in the collection row.
Per-source tier assignment matters because Jira installations differ. One source may treat `Team` as central, another may not use it at all. Source-level defaults plus pinning let `hm` adapt without hard-coding one organization's field priorities into the preview component.
## Personas

- **Elena: EM** — scans issue previews during triage and wants ownership, status, priority, and her team's pinned field visible without expanding a dense detail panel.
- **Priya: PM** — reviews planning context and wants secondary fields available when present, without losing the title, description, comments, and connections regions.
- **Tarek: Team member** — explores unfamiliar issues and benefits when preview fields look and behave like the collection row cells he already uses.
- **Future source implementer** — needs to add GitHub, PR, report, or custom Jira field previews by declaring properties and defaults, not by forking preview layout code.
- **Maintainer** — needs tests that lock in hide-empty behavior, disclosure counts, responsive layout, source defaults, pinning, and renderer reuse before write-side previews depend on this region.
## Narratives

### Elena scans a compact side peek

Elena opens the Jira issues collection and selects an issue. The side peek opens at its saved width. Under the key, status, and title, the field region shows compact inline fields: Type, Priority, Project, Assignee, and a pinned Team field with a small pin marker.
The issue has no sprint and no resolution, so neither field appears. Elena sees `More fields (4)` because four populated secondary fields are available. She leaves the disclosure closed and reads the description and latest activity without scrolling through blank rows.
### Priya expands planning fields in a roomy preview

Priya opens the same issue in a bottom peek while reviewing roadmap context. The preview is wide enough for expanded fields to use two columns. She opens `More fields (4)` and sees populated secondary fields such as labels, updated date, epic, and fix version.
The fields use the same cell treatments as the collection list: labels appear as tags, dates use the existing relative-time renderer, and the issue key remains monospace. Priya closes the disclosure when she is done, and the rest of the preview returns to its compact shape.
### Tarek narrows a preview and keeps the same content

Tarek drags the side peek narrower while comparing two issues. The preview remeasures the available width. Tier 1 fields still render inline and wrap across lines. Expanded secondary fields switch from two columns to one column.
No field disappears because of width. Only empty fields stay hidden. Tarek can trust that narrowing the preview changed layout, not content priority.
### A source default promotes a team field

A future source setup defines Jira field tier defaults for one configured Jira source. The source maps Type, Priority, Project, and Assignee to tier 1, and maps Team to tier 2 by default. Elena pins Team for that source.
After pinning, every issue preview from that source promotes Team to tier 1 when the field has a value. The Team field shows a pin marker. Issues from a different Jira source keep their own defaults and do not inherit Elena's source-specific override.
## User stories

**Elena scans tier 1 fields**
- Elena can open a Jira issue preview and see populated tier 1 fields inline under the identity region.
- Elena can see tier 1 fields wrap instead of clipping when the preview is narrow.
- Elena can see that pinned tier 1 fields include a pin marker.
- Elena does not see empty fields in tier 1.
**Priya opens secondary fields**
- Priya can see a `More fields (N)` disclosure when populated tier 2 or tier 3 fields exist.
- Priya can expand the disclosure to inspect populated secondary fields.
- Priya can collapse the disclosure again.
- Priya sees `N` count only populated secondary fields.
- Priya does not see the disclosure when no populated secondary fields exist.
**Tarek relies on consistent renderers**
- Tarek sees status, labels, people, dates, keys, numbers, and text through the same cell renderers used by collection rows.
- Tarek can compare row and preview values without learning a second visual language.
- Tarek does not see fake placeholders such as `—` for fields that are empty.
**Future source implementer configures tiers**
- Future implementer can declare source-level default tier assignments for an entity's preview fields.
- Future implementer can pin a field for a specific source to force it into tier 1.
- Future implementer can add fields without changing the preview layout component.
- Future implementer can rely on normalization when persisted tier config references stale or missing fields.
**Maintainer verifies behavior**
- Maintainer can run unit and component tests covering field partitioning, hide-empty logic, disclosure counts, pinning, renderer reuse, and responsive class/state changes.
- Maintainer can add future entity previews through the same contract without copying Jira-specific detail layout code.
## Goals

- Add a generic preview field model to the collection entity contract.
- Support preview field tiers `1`, `2`, and `3` while rendering tiers 2 and 3 together behind one `More fields (N)` disclosure.
- Render populated tier 1 fields inline under the preview identity region.
- Hide empty fields in all tiers as mandatory behavior.
- Count only populated secondary fields in `More fields (N)`.
- Hide the `More fields` disclosure when there are no populated secondary fields.
- Support per-source tier defaults for preview fields.
- Support per-source pinning that forces a field into tier 1.
- Render a pin marker for pinned fields that have values and render in tier 1.
- Reuse the entity's collection cell renderers for preview field values.
- Use measured preview width or existing `preview.sizeClass` metadata to switch secondary fields between one and two columns.
- Keep tier 1 inline and wrapping across side peek, bottom peek, full page, and future embedded hosts.
- Implement Jira issue preview fields first.
- Preserve existing status history behavior in the Jira detail while adding the new field region above lower-detail sections.
- Use existing design-system tokens and primitives only.
- Cover field model helpers, Jira defaults, preview rendering, disclosure behavior, and accessibility with tests.
## Non-goals

- No user-facing settings UI for editing preview tiers or pinning in this enhancement. The data model must allow it, but the control surface lands later.
- No inline field editing from the preview.
- No changes to collection row property visibility, sorting, grouping, filtering, or named-view behavior.
- No new source ingestion behavior.
- No Jira write-back, custom-field editing, comments posting, or transition actions.
- No grouped secondary field layout such as People / Planning / Tracking.
- No per-view tier assignments. Tier assignment is per source for this enhancement.
- No configurable description clamp length, comment count, or region order.
- No mixed-entity collection support.
- No new icon family or non-token color treatment.
## Design spec

### Preview anatomy after this enhancement

The Jira issue detail body follows the preview concept anatomy:
```plain text
┌──────────────────────────────────────────────┐
│ [Jira issue] AMP-1043 · Open                 │  identity
│ Fix generated relationship labels            │
├──────────────────────────────────────────────┤
│ Type Bug   Priority P3   Project AMP         │  fields: tier 1 inline
│ 📌 Team Platform   Assignee Elena            │
│ ▸ More fields (4)                            │  populated secondary fields
├──────────────────────────────────────────────┤
│ Status history                               │  existing lower section remains
│ …                                            │
└──────────────────────────────────────────────┘
```
The exact lower sections continue to evolve through the preview concept work. This issue owns only the field property model and its placement below identity and above longer detail sections.
### Field rows and labels

A preview field is a compact label/value pair. The label uses muted text. The value uses the entity-owned cell renderer. The pair should remain readable when rendered inline:
```plain text
Priority  [P3]
Assignee  Elena
Updated   2h ago
```
If the existing row cell renderer includes its own compact value only, the preview wrapper supplies the label. If a renderer was written only for rows and assumes row-only spacing, adapt it through a small preview wrapper instead of duplicating value logic.
### Tier 1 inline region

Tier 1 fields render as a compact flex wrap under the title. They are separated by consistent gaps and may wrap to additional lines when the measured width is narrow. Tier 1 never switches to a table or grid.
Pinned fields that render in tier 1 include a small neutral pin icon before the label or value. The pin marker uses icon shape, not accent color, so it remains clear across user themes.
### Secondary disclosure

Secondary fields are all populated tier 2 and tier 3 fields after pinning is applied. They sit behind one disclosure labelled `More fields (N)`. The collapsed state shows only the disclosure row. The expanded state shows fields below it.
The disclosure must be keyboard operable and expose expanded/collapsed state through native `` semantics or a Radix disclosure/collapsible primitive if one exists or is added. The label should remain `More fields (N)` in both states unless implementation finds a clearer existing pattern. A chevron may rotate to show state.
### Secondary layout

Expanded secondary fields use the measured content width, not the nominal surface name:
- **Roomy:** two columns for field pairs.
- **Compact:** one column for field pairs.
Use the existing `EntityPreviewMetadata` supplied by `Detail` and `FullPagePreview` where possible. If current metadata is not available in a host, the field region should still render safely in one column.
### Hide-empty behavior

Empty fields are omitted entirely before tier partitioning. Empty means the renderer has no meaningful value to show, not just a falsy JavaScript value. For example:
- `null`, `undefined`, and empty strings are empty.
- Empty arrays are empty.
- Whitespace-only strings are empty.
- Numeric `0` is populated.
- Boolean `false` is populated if a future field uses booleans.
- `Unassigned` may be shown for assignee only if the entity treats missing assignee as a meaningful value. Otherwise the assignee field is empty and hidden.
The entity contract should provide an `isPreviewFieldEmpty` override when generic emptiness is not enough.
### Per-source defaults and pinning

The preview component does not decide which fields matter. It receives normalized preview field config for the item and source.
Suggested default behavior for Jira issue previews:

Field
Default tier
Notes

`priority`
1
Hide if missing.

`project_key`
1
Monospace value.

`assignee`
1
Treat according to entity emptiness rule.

`status`
1
May be omitted from fields if identity already includes status; avoid duplicate rendering if identity owns status.

`labels`
2
Count only when non-empty.

`updated_at_source`
2
Relative time cell.

`key`
identity
Do not duplicate in fields by default.

`title`
identity
Do not duplicate in fields.

The issue asks for Jira defaults of type, priority, project, and assignee. The current ingested/listed Jira property set does not expose an issue type field in `JiraIssueListItem`. Implementation should add type to the preview contract only when the local data and bindings expose it. Until then, the Jira default should use available fields and leave type as a follow-up rather than rendering fake data.
Pinning applies after defaults. If a source pins `team`, and `team` is populated, the field renders in tier 1 even if its default tier is 2 or 3. If a pinned field is empty, it remains hidden.
### Accessibility

- The field region has an accessible name such as `Issue fields`.
- The disclosure button has an accessible label that includes the populated secondary count.
- The disclosure exposes expanded state.
- Pinned fields expose the pin marker in accessible text, for example `Pinned Team`.
- Icon-only pin and chevron glyphs are decorative unless they carry accessible meaning through text.
- The region has no axe violations in compact and roomy layouts.
## Tech spec

### Prerequisites and references

- Issue #79 — `feat(preview): two-tier field property model with per-source pinning`.
- `context-human/concepts/preview.md` — canonical preview anatomy, fields model, hide-empty rule, pinning, responsiveness, and cell-renderer reuse.
- `context-agent/collections/collection-read.md` — collection entity contract, detail hosts, preview metadata, row cell contract, and preview surfaces.
- `context-human/specs/feature-collection-viewer-foundation.md` — generic collection viewer and Jira entity adapter.
- `context-human/specs/enhancement-property-visibility-sub-panel.md` — existing property config normalization and renderer reuse patterns.
- ADR-002 — Tauri + React architecture.
- ADR-003 — local-first, single-user v1.
- ADR-008 — settings split. Per-source shared config belongs in SQLite; user preferences do not store source field defaults.
- ADR-011 and `context-human/concepts/edits.md` — preview actions and future edits follow the local working-set model, though this enhancement is read-only.
- `context-agent/design-system.md` — token, primitive, icon, and accessibility contracts.
### System design

```plain text
React collection layer
├── views/collection/types.ts
│   ├── EntityContract.previewFields
│   ├── PreviewFieldDefinition
│   └── PreviewFieldConfig
├── views/collection/preview/
│   ├── PreviewFields.tsx
│   ├── fieldModel.ts
│   └── fieldModel.test.ts
├── views/collection/Detail.tsx / FullPagePreview.tsx
│   └── already supply EntityPreviewMetadata
└── entities/jira-issue/
    ├── previewFields.ts
    ├── detail.tsx
    └── previewFields.test.tsx
```
The generic preview field component should live under the collection layer, not under Jira. Jira supplies field definitions and defaults. The generic component handles normalization, partitioning, disclosure, responsive layout, and accessibility.
### Contract additions

Extend the read-side entity contract with optional preview field data:
```typescript
export type PreviewFieldTier = 1 | 2 | 3;

export type PreviewFieldConfig = {
  property: TProperty;
  tier: PreviewFieldTier;
  pinned?: boolean;
};

export type PreviewFieldDefinition = {
  property: TProperty;
  label?: string;
  renderCell?: CellRenderer;
  isEmpty?: (item: TItem) => boolean;
  pinEligible?: boolean;
};

export type PreviewFieldSourceConfig = {
  sourceId: string | null;
  fields: PreviewFieldConfig[];
};
```
Add optional fields to `EntityContract`:
```typescript
previewFields?: PreviewFieldDefinition[];
defaultPreviewFields?: PreviewFieldConfig[];
resolvePreviewFieldConfig?: (item: TItem) => PreviewFieldConfig[];
```
If `resolvePreviewFieldConfig` is absent, the preview field component uses `defaultPreviewFields`. If preview fields are absent, entity details keep rendering without the field region.
### Normalization rules

Create pure helpers, likely in `src/views/collection/preview/fieldModel.ts`:
- `normalizePreviewFieldConfig(properties, defaults, sourceConfig)` drops unknown properties.
- It appends missing known preview fields using entity defaults.
- It coerces invalid tiers to the entity default tier or tier 2.
- It applies pinning by setting effective tier to 1 for pinned fields.
- It preserves config order where possible.
- It never creates config for identity-only fields unless the entity includes them in `previewFields`.
Create partitioning helpers:
- `isPreviewFieldPopulated(item, field)` uses field-specific `isEmpty` first, then generic emptiness.
- `partitionPreviewFields(item, definitions, config)` returns `{ tierOne, secondary, hiddenEmpty }`.
- `secondary.length` drives `More fields (N)`.
### Jira issue implementation

Add `src/entities/jira-issue/previewFields.ts` with Jira preview definitions. Start with fields currently exposed by `JiraIssueListItem` and the existing property definitions:
- `priority`
- `project_key`
- `assignee`
- `labels`
- `updated_at_source`
- optionally `status` if identity does not render it or if duplicate rendering is acceptable after design review
Do not invent a Jira type value until ingestion/list bindings expose it. Record that as a follow-up in the spec or implementation notes if it remains missing.
Update `src/entities/jira-issue/index.tsx` to attach preview field definitions and default config to the entity contract.
Update `JiraIssueDetail` to render:
1. Identity: key, title, status badge.
2. `PreviewFields` with Jira definitions, effective config, item, and preview metadata.
3. Existing status history section.
The detail component currently accepts only `{ item }` even though the generic entity detail props include optional `preview`. Update the prop type to include `preview?: EntityPreviewMetadata` so responsive field layout can use measured width and size class.
### Per-source config storage

This enhancement should not build the user-facing settings UI for tier assignment or pinning. It should still define the shape that later settings or source configuration code can persist.
Recommended shared setting key:
```plain text
preview_fields.config
```
Recommended versioned shape:
```typescript
type PreviewFieldsConfig = {
  version: 1;
  sources: Array;
  }>;
};
```
Implementation may defer Rust commands and SQLite persistence until the UI that edits this config lands. For issue #79, a typed frontend model plus entity defaults is enough if no caller can yet mutate source-level config. If persistence is added now, use shared settings per ADR-008 and keep it separate from per-user preferences.
### Responsive behavior

Use existing preview metadata first:
- `preview.sizeClass === "compact"` should render secondary fields in one column.
- Roomier classes should render secondary fields in two columns when width is sufficient.
- If `preview.width` is present, prefer a measured threshold over surface name.
The implementation should not hard-code side peek as compact or full page as roomy. Resizable peeks can cross thresholds.
### Design-system requirements

- Use Lucide `Pin` or `PinIcon` for pinned fields if already available through `lucide-react`.
- Use neutral text/subtext colors for pin markers.
- Use `Button` or a plain token-styled button for disclosure; do not add a new primitive unless needed.
- Use existing `Badge`, `Tag`, and cell renderers for values.
- Use token utilities only. No hardcoded hex values or arbitrary pixel sizes.
- If a reusable disclosure/collapsible primitive is added, update `context-agent/design-system.md` in the implementation PR.
### Testing plan

Add or update tests for:
- Pure helper normalization drops unknown fields, appends missing defaults, and preserves valid order.
- Pinning forces effective tier 1 without mutating the stored default tier.
- Empty values are omitted for `null`, `undefined`, empty strings, whitespace-only strings, and empty arrays.
- Numeric `0` and boolean `false` remain populated.
- Disclosure count includes only populated tier 2 and tier 3 fields.
- No disclosure renders when secondary count is zero.
- `PreviewFields` renders tier 1 inline fields and expands/collapses secondary fields.
- Pinned fields show accessible pinned text.
- Jira issue preview uses existing cell renderers for priority, labels, project, assignee, and updated date.
- Compact metadata renders secondary fields in one column; roomy metadata renders them in two columns.
- `JiraIssueDetail` preserves status history loading, error, empty, and populated states.
- Component tests include an axe check for the preview field region.
### Risks and follow-ups

- Current Jira list bindings may not expose issue type, Team, epic, fix version, or other rich custom fields. This enhancement must not fake them. Add follow-up issues for ingestion and bindings if needed.
- Source-level pinning cannot be user-edited until a later settings/control surface exists.
- Some existing cell renderers may assume row-only layout. Adapt them through wrappers while keeping value formatting shared.
- If the disclosure primitive is hand-rolled, keyboard and ARIA behavior must be tested carefully.
## Task decomposition

### Story 1: Add the generic preview field model

**Description:** Define the contract and pure helpers that let any entity declare preview fields, defaults, source overrides, and pinning.
**Tasks:**
1. Add preview field types to `src/views/collection/types.ts` or a focused preview module.
	- Acceptance criteria:
		- Types cover field tiers, field definitions, config rows, and pinned state.
		- Existing entity contracts continue to compile without preview fields.
	- Dependencies: none.
2. Add pure field-model helpers under `src/views/collection/preview/fieldModel.ts`.
	- Acceptance criteria:
		- Helpers normalize defaults and overrides.
		- Helpers drop unknown properties and append missing known properties.
		- Helpers compute effective tier after pinning.
		- Helpers partition populated tier 1 and secondary fields.
	- Dependencies: task 1.
3. Add unit tests for normalization, pinning, and hide-empty semantics.
	- Acceptance criteria:
		- Tests cover stale properties, missing defaults, invalid tiers, pinned fields, empty values, `0`, and `false`.
		- Tests fail before the helper implementation and pass after it.
	- Dependencies: task 2.
### Story 2: Build the shared `PreviewFields` component

**Description:** Render the field model in a reusable UI component with inline tier 1 fields, a secondary disclosure, responsive layout, and accessible pinned markers.
**Tasks:**
1. Add `src/views/collection/preview/PreviewFields.tsx`.
	- Acceptance criteria:
		- Tier 1 fields render inline and wrap.
		- Secondary fields render only after activating `More fields (N)`.
		- `N` counts only populated secondary fields.
		- No disclosure renders when `N` is zero.
	- Dependencies: Story 1.
2. Add responsive secondary layout using preview metadata.
	- Acceptance criteria:
		- Compact metadata renders secondary fields in one column.
		- Roomy measured width renders secondary fields in two columns.
		- Missing metadata falls back to a safe one-column layout.
	- Dependencies: task 1.
3. Add accessibility behavior and tests.
	- Acceptance criteria:
		- Disclosure is keyboard operable and exposes expanded state.
		- Field region has an accessible name.
		- Pinned fields expose pinned meaning through accessible text.
		- Component has no axe violations in the tested states.
	- Dependencies: task 1.
### Story 3: Wire Jira issue preview fields

**Description:** Attach Jira preview field definitions and defaults, then render the shared field region in `JiraIssueDetail`.
**Tasks:**
1. Add Jira preview field definitions.
	- Acceptance criteria:
		- Definitions reuse existing Jira property labels and cell renderers where possible.
		- Definitions do not include issue type or custom fields unless bindings expose them.
		- Field-specific emptiness rules are explicit for arrays, strings, and assignee behavior.
	- Dependencies: Story 1.
2. Attach Jira preview defaults to the Jira entity contract.
	- Acceptance criteria:
		- Default tier 1 includes available high-value fields such as priority, project, and assignee.
		- Default secondary fields include available labels and updated date.
		- Identity fields are not duplicated by default.
	- Dependencies: task 1.
3. Update `JiraIssueDetail` to accept preview metadata and render `PreviewFields`.
	- Acceptance criteria:
		- Identity remains at the top.
		- Field region appears below identity and above status history.
		- Existing status history behavior and tests still pass.
	- Dependencies: task 2 and Story 2.
4. Add Jira-specific component tests.
	- Acceptance criteria:
		- Tests show populated Jira fields render through existing cells.
		- Empty Jira fields are omitted.
		- Secondary fields expand and collapse.
		- Status history states still render correctly.
	- Dependencies: task 3.
### Story 4: Prepare per-source pinning seams

**Description:** Define the source-level config shape and resolution seam without requiring a user-facing pinning UI.
**Tasks:**
1. Add a typed source preview-field config model.
	- Acceptance criteria:
		- Model includes `version`, `sourceId`, `entityId`, property, tier, and `pinned`.
		- Model is documented near the resolver or in tests.
	- Dependencies: Story 1.
2. Add a resolver seam for effective preview config.
	- Acceptance criteria:
		- Entity defaults work when no source config exists.
		- Source config can override tiers for the matching entity/source.
		- Pinned source fields resolve to tier 1 when populated.
	- Dependencies: task 1.
3. Add tests for source config resolution.
	- Acceptance criteria:
		- Tests cover no config, matching source config, non-matching source config, and pinning.
		- Tests do not require a persisted database setting unless persistence is implemented in this issue.
	- Dependencies: task 2.
### Story 5: Verify and document implementation context

**Description:** Run focused checks and update durable agent context if implementation changes shared UI contracts.
**Tasks:**
1. Run targeted frontend tests for preview fields and Jira detail.
	- Acceptance criteria:
		- New field-model tests pass.
		- New `PreviewFields` tests pass.
		- Updated Jira detail tests pass.
	- Dependencies: Stories 1-4.
2. Run broader validation appropriate for the changed surface.
	- Acceptance criteria:
		- `npm test` passes, or failures are documented with exact causes.
		- `npm run lint` passes if code changes include new TypeScript/React code.
	- Dependencies: task 1.
3. Update `context-agent/design-system.md` only if implementation adds or changes shared primitives, tokens, or patterns.
	- Acceptance criteria:
		- No update is made if the implementation only composes existing primitives.
		- Any new disclosure/collapsible primitive or shared preview field pattern is documented in the same PR.
	- Dependencies: Stories 2-4.