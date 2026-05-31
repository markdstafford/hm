# Item preview

The canonical way `hm` renders a single collection item for inspection. Every collection viewer
(`collection-read.md`) opens a selected row into a preview; this doc defines what the preview
shows, how it adapts to the item's *shape* and to the *space* it's given, and how its content is
configured. It is the read-side counterpart the gardener's suggestions and the write layer both
build on.

Three companion docs carry the parts that are large enough to stand alone: navigation *between*
previews is `concepts/navigation.md`; the relationships region and creating links is
`concepts/connections.md`; mutating an item is `concepts/edits.md` (with ADR-011 for the rationale).
This doc owns the preview itself — its regions, its field model, and how it composes across the
different entity kinds a collection can hold.

## Principles

- **One component, many hosts.** The same preview renders in a side peek, a bottom peek, a full
  page, the ⌘K result pane, and *embedded inside another item's preview* (a referenced issue inside
  a suggestion). A field looks identical everywhere; only the surrounding chrome and the available
  width change. "Looks the same everywhere" is a hard goal, not an aspiration — it is what lets a
  user trust that the AMP-1043 they see inside a duplicate suggestion is the same AMP-1043 they'd
  open standalone.
- **Show what's there, hide what isn't.** Real backlogs are sparse; a preview that renders every
  declared field is a wall of blanks. Empty content never renders.
- **Adapt to space, don't assume it.** The preview is laid out responsively and degrades from a
  roomy full page to a 280px bottom peek without losing its identity region or its primary fields.
- **The shape drives the content.** A Jira issue, a report, a GitHub PR, and a hygiene suggestion
  are genuinely different objects. The preview is a contract each entity fills, not a fixed
  issue-shaped template.

## Anatomy

A preview is a vertical stack of regions, top to bottom. Each region is independent and hides when
it has nothing to show.

```
┌────────────────────────────────────────────────────┐
│ [kind]  KEY · status                                │  ① identity
│ Title of the item                                   │
├────────────────────────────────────────────────────┤
│ Type Bug   Priority P4   Project AMP   📌 Team …    │  ② fields — tier 1 inline
│ ▸ More fields (7)                                   │       tier 2/3 disclosed
├────────────────────────────────────────────────────┤
│ DESCRIPTION                                         │  ③ body — clamped
│ first lines of the body…                            │
│ [Show more]                                         │
├────────────────────────────────────────────────────┤
│ COMMENTS (4)                                        │  ④ activity — recent 2
│ Priya · 2026-05-19  …latest comment…                │
│ [Show all 4 comments]                               │
├────────────────────────────────────────────────────┤
│ CONNECTIONS                                         │  ⑤ relationships
│ 🔗 blocks   AMP-1017  Refine CLI options…           │      (concepts/connections.md)
│ ✦ similar   AMP-800   Deprecate LSP…        83% rel │
│ + Add link                                          │
└────────────────────────────────────────────────────┘
```

The five regions: **identity**, **fields**, **description**, **comments**, **connections**. An
entity supplies whichever it has; the order is fixed so the preview reads the same across kinds.

### ① Identity

A `kind` badge, the item's key in monospace, its current source-system status, and the title. The
title is the one always-present element. The badge tells the user what *kind* of thing they're
looking at (Jira issue, suggestion, report, PR) — important because a single collection can mix
kinds and because previews embed inside one another.

## ② Fields

Fields are the heart of the read experience, and the place sparsity and configuration bite hardest.

### The tier model

Every field declares a **tier**:

- **Tier 1** — always shown, rendered inline as a compact wrap directly under the title. For a Jira
  issue the defaults are *type, priority, project, assignee*.
- **Tier 2 / Tier 3** — secondary detail, collapsed behind a **"More fields (N)"** disclosure. N
  counts only *populated* fields, so the disclosure never promises blanks.

Tiering is the answer to "the issue carries 30 fields but the preview must stay scannable." It
replaced two rejected alternatives: a flat grid (every populated field at once — a wall), and a
fully grouped People/Planning/Tracking layout (more structure than a compact preview wants).
Two-tier is the baseline; grouping remains available as a future density option but is not the
default.

### Hide-empty (mandatory)

A field with no value is omitted entirely, in every tier. This is not cosmetic. On a representative
AMP backlog: sprint is empty on essentially every issue; epic *name* is set on a few percent;
resolution only exists once an issue is closed; votes and customer are routinely empty. A preview
that rendered the declared schema would be mostly dashes. Empty-but-meaningful is handled where it
matters specifically (an empty *body* renders a muted "No description" — see ③ — because "this
issue has no description" is the signal the enrichment engine acts on).

### Per-source configuration & pinning

Which fields sit in which tier is **configurable data, defaulted per source system** — not a
hard-coded list. The defaults ship sensible; the user adapts them to what their source actually
uses.

A **pinned** field is the per-source override: pinning forces a field into tier 1 regardless of its
default ("for this Jira source, always show Team"), and it renders with a pin marker so the user
knows it's promoted. Pinning is the concrete mechanism behind "this source always shows this
field." Tier *assignment* is the per-source-configurable layer; the preview component only decides
*how* a tier discloses, never *which* fields are important.

### Cell rendering

Each field renders through a type-appropriate cell (the same cells the collection list uses, per
`collection-read.md`'s property contract): status and labels as badges, the key as monospace, dates
as relative time, people as names (or avatars where space allows), numbers plain. Reusing the
list's cells is part of "looks the same everywhere" — a status badge in the row, the preview, and
an embedded card are one renderer.

### Responsiveness

The field area is two-column on a roomy surface and collapses to a single column when the surface is
narrow (the threshold keys off the *measured* width, since peeks are resizeable — see Surfaces).
Tier 1 stays inline and wraps; the disclosure stays a disclosure. No field is dropped for width
alone — only emptiness drops a field.

## ③ Description

The body renders under a **Description** heading, **clamped** to a few lines by default with a
**Show more / Show less** toggle. The toggle appears only when the body is long enough to truncate;
short bodies render in full with no affordance. A long body must never crowd out the fields,
comments, and connections beneath it — especially in a compact peek — so the clamp is the default
state, not an opt-in. An empty body renders a muted **"No description"** rather than collapsing the
region away, because absence is signal.

Body text is the source's description (Jira markup / Markdown rendered per the stack's markdown
pipeline). The proposed *replacement* of a body is an edit, shown as a diff inside an enrichment
suggestion (see Composition), not here.

## ④ Comments

Comments render under a **Comments (N)** heading showing the **two most recent** by default, each
with author + date + body, newest first, and a **"Show all N comments"** toggle that expands the
rest (and a "Show fewer" to recollapse). Recency-first because the latest comment is usually the one
that decides a triage call — e.g. a stale issue whose last comment is "this is probably moot now"
is exactly the signal that issue should be closed.

Comments are read-only here; *posting* a comment is an outward action handled by the edit layer
(`concepts/edits.md`).

## ⑤ Connections

The relationships region — concrete links, hm-local links, and embedding-discovered candidates,
each drillable and (for suggestions) promotable to a real link. It is large enough to have its own
doc; see `concepts/connections.md`. It always renders last so the preview reads identity →
attributes → narrative → relationships.

## Composition across item shapes

The collection layer holds different entity kinds, and the preview adapts while reusing the regions
above. The composition rule: **reuse the canonical preview for issue-like items; wrap it in a frame
for items that are *about* other items.**

### Issue-like items (Jira issue, GitHub issue, PR)

Render the full anatomy with whatever they populate. A GitHub PR's "fields" are repo/state/author;
a GitHub issue's are repo/state/labels; a Jira issue's are the rich set above. Same regions, same
cells, different field inventories.

### Report

A report is a summary entity: a small set of headline fields (scope, counts) and a **connections**
region of *highlighted* items; no body, no comments. Drilling a highlight opens that item's preview
(`concepts/navigation.md`).

### Hygiene suggestion (the action frame)

A hygiene suggestion is **not an issue** — it is a proposed *action* wrapping one or two issue
references. Its preview is an **action frame** around issue content that is *curated to the
decision*, with drill always available. The frame:

```
┌──────────────────────────────────────────────────────────┐
│ [Duplicate] → Merge as duplicate                  91% ▰▰▰ │  frame header
├──────────────────────────────────────────────────────────┤
│ …category-specific, curated body…                         │
├──────────────────────────────────────────────────────────┤
│ RATIONALE  one line from the engine                       │
├──────────────────────────────────────────────────────────┤
│                              [ Comment ] [ Reject ] [ Verb ]│  actions
└──────────────────────────────────────────────────────────┘
```

The header is `[category badge] → action verb` plus a confidence chip. The footer carries the
primary action (the verb), Reject, and the outward Comment action; all three route through the edit
layer (`concepts/edits.md`) — approving stages a change, rejecting suppresses the suggestion,
commenting stages a comment.

Every embedded issue renders as a **short, consistent identity card** — never a bespoke mini-layout:

```
┌─ identity card ───────────────────────┐
│ AMP-1039 · Closed · Major-P3        ↗ │   row 1: key · status · priority
│ Need help identifying generated rels… │   row 2: title
└───────────────────────────────────────┘
```

Row 1 is `key · status · priority`; row 2 is the title. Nothing trails the title. The whole card
drills into that issue's full preview (the `↗` and the key/title are all live). The **decision
context sits below the card**, and is the only thing that differs by category:

- **Duplicate** — two identity cards side by side ("This issue" / "Duplicate of"), each with its
  **description** beneath it. The user compares substance directly; they only drill if the
  descriptions don't settle it. (A bare key/title pair would force a click-through on every pair —
  the description-below is what makes the call possible in place.)
- **Stale** — one identity card, with **description + assignee + last activity + last comment**
  beneath it. These are the "is this still alive?" signals; the last comment is frequently the
  deciding one.
- **Enrichment** — one identity card, then a **before → after diff of only the changing fields**
  (title, body, labels, priority, type), old struck through, new shown. Enrichment is about *what
  changes*, so the layout is a field diff, not two full issue dumps.

This **refines, rather than replaces,** the three detail layouts sketched in `collection-enhance.md`:
the three shapes are the same (two-card / single-card+activity / original-vs-proposed), but each is
now built from the shared identity card + a curated context block instead of bespoke markup — so the
issue content inside a suggestion stays consistent with the standalone issue preview.

## Surfaces

Where a preview opens is the existing view-settings **"Open pages in"** choice from
`collection-read.md` — **side peek**, **bottom peek**, **full page** — selected per named view, not
by an ad-hoc control. That baseline stands; two refinements:

- **Precision resize.** The side peek (width) and the bottom peek (height) are drag-resizeable. The
  preview's responsive behavior keys off the resulting size, so narrowing a side peek collapses the
  fields to one column and may push the user toward a different surface.
- **The ⌘K result pane is a fourth host** for the same preview component, in its compact form
  (`concepts/navigation.md`).

Surface choice and content interact: wide content — the duplicate two-card layout, an enrichment
diff — reads better in a bottom peek or full page than in a narrow side rail. Resizeable peeks let
the user make that trade per item rather than forcing one width on every preview.

## Visual conventions

- **Categorical meaning is carried by icon shape, not by a chosen accent color.** The user selects
  their own theme/accent; an accent must not be co-opted to mean a category (e.g. a link type).
  Where a set of values must be told apart at a glance, give them distinct *icons*.
- **Secondary emphasis uses a theme-neutral "secondary highlight"** — a muted bordered chip — for
  things like relevance and confidence hints, never an accent. This requires a design-system token;
  see the maintenance note in `context-agent/design-system.md`.

## The preview contract

An entity that plugs into the collection layer supplies, for the preview:

1. **Identity** — kind, key, status, title.
2. **Fields** — the field list with per-field tier, cell renderer, and pin-eligibility; tier
   defaults are per-source-configurable data, not baked into the component.
3. **Body** — optional; rendered clamped.
4. **Comments** — optional; rendered recent-first, collapsed.
5. **Connections** — the edge set (`concepts/connections.md`).
6. **Composition** — for items that *wrap* other items (suggestion, report), the frame + the
   per-category context block; the embedded items reuse this same contract.

This is the seam between the generic preview and any specific entity. New kinds (a future GitHub
issue, an audit-log entry) only fill the contract; the preview, its surfaces, and its embedding
behavior follow.

## Out of scope

- **Inline field editing from the preview** — a write affordance; see `concepts/edits.md`.
- **Mixed-entity previews** (one preview showing two kinds at once) — deferred alongside
  mixed-entity collections in `collection-read.md`.
- **Configurable clamp length / number of recent comments / region order** — future polish.
- **Grouped-tier field layout** as a per-view option — possible later; two-tier is the baseline.

## Cross-references

- `concepts/navigation.md` — drilling between previews and the ⌘K switcher.
- `concepts/connections.md` — the connections region and link creation.
- `concepts/edits.md` + ADR-011 — the staged ("write = git") mutation model the frame's actions feed.
- `collection-read.md` — the viewer that opens previews; the property/cell contract; "Open pages in".
- `collection-enhance.md` — the hygiene-suggestion entity whose three detail layouts this refines.
- `context-agent/design-system.md` — primitives, the secondary-highlight token, peek resize.
