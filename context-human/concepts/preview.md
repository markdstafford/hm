# Item preview

The canonical way `hm` renders a single collection item for inspection. Every collection viewer
(`collection-read.md`) opens a selected row into a preview; this doc defines what that preview
shows, how it adapts to the item's shape and the available space, and how its content is
configured. Navigation *between* items is `concepts/navigation.md`; the relationships region is
`concepts/connections.md`; mutation is ADR-011 (the staged write model).

The preview is one component, reused across every surface it can open in (side peek, bottom
peek, full page, and the ⌘K result pane) and embedded inside other items' previews. "Looks the
same everywhere" is a goal: a field renders identically whether it is the focused item or a card
inside a duplicate suggestion.

## Anatomy

A preview is a vertical stack of regions, top to bottom:

```
┌────────────────────────────────────────────┐
│ [kind] KEY · status                         │  identity
│ Title                                       │
├────────────────────────────────────────────┤
│ Type  Bug   Priority  P4   …   📌 Team  …   │  fields (tier 1 inline)
│ ▸ More fields (7)                           │  (tier 2/3 disclosed)
├────────────────────────────────────────────┤
│ Description                                 │  body (clamped)
│ …first lines… [Show more]                   │
├────────────────────────────────────────────┤
│ Comments (4)                                │  activity (recent 2)
│ …latest two… [Show all 4]                   │
├────────────────────────────────────────────┤
│ Connections …                               │  see concepts/connections.md
└────────────────────────────────────────────┘
```

Each region hides when it has nothing to show. Regions an entity does not populate (a report has
no comments; a PR has no Jira fields) simply do not render.

## Fields

Fields are presented in **tiers**, not as a flat dump.

- **Tier 1** is a small, always-shown set rendered inline (for a Jira issue: type, priority,
  project, assignee). **Tier 2/3** sit behind a **"More fields (N)"** disclosure.
- **Hide-empty is mandatory.** A field with no value never renders, in any tier. This is not
  polish — real backlogs leave most fields empty (sprint is empty on essentially every issue,
  epic name on a small minority, resolution only once closed); a "show everything" preview is a
  wall of blanks.
- The preview is **responsive**: the field grid collapses from two columns to one when the
  surface is narrow (see Surfaces). Tier 1 stays inline; the rest stays disclosed.

### Tier assignment and per-source configuration

Which fields are tier 1 vs 2 vs 3 is **configurable data**, defaulted per source system, not a
hard-coded list. A **pinned** field is the per-source override: pinning forces a field into tier 1
regardless of its default ("for this Jira source, always show Team"), and it renders with a pin
marker. The default tiers ship sensible; pinning is how a user adapts the preview to what their
source actually uses.

## Description

The body renders under a **Description** heading, **clamped** to a few lines by default with a
**Show more / Show less** toggle. The clamp keeps a long body from dominating a compact preview;
the toggle only appears when the body is long enough to truncate. An empty body renders a muted
"No description" rather than nothing, because "this issue has no description" is itself signal
(it is what the enrichment engine acts on).

## Comments

Comments render under a **Comments (N)** heading showing the **most recent two**, each with
author + date + body, and a **"Show all N comments"** toggle. Recency-first, because the latest
comment is usually the one that decides a triage call ("this is probably moot now").

## Composition across item shapes

The collection layer holds different entity kinds, and a preview adapts to the item's shape while
reusing the same regions:

- **Jira issue / GitHub issue / PR** — the full anatomy above (fields they populate, body,
  comments, connections).
- **Report** — a summary entity: a few headline fields and a connections region of highlighted
  items; no body/comments.
- **Hygiene suggestion** — *not an issue*. A suggestion is an **action frame** wrapping one or two
  issue references, with content **curated to the decision** rather than a generic issue dump.
  This is the most important composition case and is specified below.

### Hygiene-suggestion previews

A suggestion preview is a frame — `[category] → action verb`, a confidence chip, a rationale
block, and approve / reject / comment affordances — around issue content curated per category. A
referenced issue always renders as a **short, consistent identity card** (row 1: `key · status ·
priority`; row 2: title; the whole card drills into that issue's full preview per
`concepts/navigation.md`). The decision-relevant context sits **below** the card, and differs by
category:

- **Duplicate** — two identity cards side by side ("This issue" / "Duplicate of"), each with its
  **description** beneath it, so the user can judge sameness without drilling.
- **Stale** — one card, with **description + assignee + last activity + last comment** beneath it
  (the "is this still alive?" signals).
- **Enrichment** — one card, with a **before → after diff** of only the **changing** fields
  (title, body, labels, priority, type), old struck through.

This supersedes the three fixed detail layouts sketched in `collection-enhance.md`: the layouts
are the same three shapes, but each is built from the shared identity card plus a curated context
block, not bespoke markup, so issue content stays consistent with the standalone preview.

## Surfaces

Where a preview opens is the existing **view-settings "Open pages in"** choice
(`collection-read.md`): **side peek**, **bottom peek**, or **full page**. That baseline stands.
Two refinements:

- The side and bottom peeks are **precision-resizeable** — drag the rail's inner edge (width for
  the side peek, height for the bottom peek). The preview's responsive behavior keys off the
  resulting width.
- The **⌘K result pane** (`concepts/navigation.md`) is a fourth, compact host for the same preview
  component.

Wide content (the duplicate two-card layout) reads better in the bottom peek or full page than in
a narrow side rail; the resizeable peeks let the user make that trade-off per item.

## Visual conventions

- Categorical meaning (link types, item kinds) is carried by **icon shape**, not by a chosen
  accent color — the user picks their theme, so an accent must not be co-opted to mean a category.
- Secondary emphasis (relevance/confidence hints) uses a **theme-neutral "secondary highlight"**
  treatment (a muted bordered chip), not an accent. This needs a design-system token; see the
  maintenance note in `design-system.md`.

## Out of scope

- Inline field editing from the preview — a write affordance; see ADR-011.
- Mixed-entity previews (one preview showing two kinds at once) — deferred with mixed-entity
  collections in `collection-read.md`.
- Per-user reordering of regions; configurable clamp/recent-comment counts — future polish.

## Cross-references

- `concepts/navigation.md` — drilling between previews and the ⌘K switcher.
- `concepts/connections.md` — the relationships region and link creation.
- ADR-011 — the staged ("write = git") mutation model the preview's actions feed.
- `collection-read.md` — the viewer that opens previews and the "Open pages in" surfaces.
- `collection-enhance.md` — the hygiene-suggestion entity whose detail layouts this refines.
- `context-agent/design-system.md` — primitives + the secondary-highlight token + peek resize.
