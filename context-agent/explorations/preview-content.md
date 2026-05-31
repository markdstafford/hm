# Preview exploration — content, composition & surfaces

_From a prototyping session on 2026-05-30 (mm:prototyping). Sibling docs:
`preview-navigation.md`, `preview-connections.md`. Write model: ADR-011._

## Preview content (fields)

**Chose:** **two-tier** fields — a small always-shown set (type, priority, project,
assignee + pinned) with the rest behind a "More fields" disclosure. Considered flat
(a wall of fields) and grouped clusters.

Constants (not the axis):

- **hide-empty** is mandatory — real data: sprint always empty, epic_name ~5%, etc.
- the preview is **responsive** (1-col when narrow);
- **pinned fields** are a **per-source config override** that forces a field to
  tier 1;
- **Description** clamps with "Show more"; **Comments** show the latest 2 + "Show
  all".

Tier assignments are the per-source-configurable data; the variants only settled
*how* tiers disclose.

## Multi-shape composition

**Chose:** a hygiene suggestion is an **action frame** (category → verb, confidence,
rationale, approve/reject) wrapping issue refs, with embedded content **curated per
category** + drill always available:

- duplicate — two short identity cards, each with its **description** below
  (compare substance);
- stale — card + **assignee, last activity, last comment** (the "is this dead?"
  signals);
- enrichment — only the **changing fields** as a before/after diff.

Considered a uniform embed mode (reused-preview / mini-card / chip); rejected — the
right content differs per decision. The identity card is short + consistent (row 1:
key · status · priority; row 2: title; the whole card drills); decision context
sits below it.

## Surfaces

**Chose:** keep the existing **view-settings "Open pages in"** choice (side peek /
bottom peek / full page) as the baseline — it's solid. The **only addition** from
prototyping is **precision drag-resize** on the side (width) and bottom (height)
peeks. Surface selection is a setting, not a hotkey. ⌘K's preview pane is a fourth,
compact host.

## Design-system delta (apply when implemented)

- **Precision resize** on side/bottom peeks (`collection-read.md` "Open pages in").

## Open / deferred

- Final per-source default tier assignments (the configurable data behind tiering).
