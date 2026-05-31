# Connections & linking

The relationships region of an item preview, and how a user creates relationships. Connections are
what make the viewer a graph rather than a list of cards: they are the edges `concepts/navigation.md`
drills along, and the raw material the gardener's duplicate engine (#13) turns into suggestions.
This doc defines the **kinds** of connection, how they render, how a discovered candidate becomes a
real link, and the **link-creation** flow. The preview that hosts this region is
`concepts/preview.md`; mutating via these affordances is `concepts/edits.md`.

## Three kinds of connection

Every connection is one of three kinds, and the kind is the central concept:

| Kind | What it is | Lives in | Carries |
| --- | --- | --- | --- |
| **source** | A real link the source system holds — a Jira issue link, a PR→issue reference. | the source (Jira/GitHub) | a relationship type (blocks, relates to, duplicates…) |
| **local** | A link only `hm` holds, because the relationship **spans systems the source can't link** (a Jira issue ↔ a GitHub PR). | `hm` (local truth) | a relationship type |
| **suggested** | An **embedding near-neighbour** (ADR-007) — clearly related but **not yet a link**. | computed, not stored as a link | a **confidence** score |

`source` vs `local` is *where the link can live*: if both endpoints share a real source the link is
written back there (source); if they span systems, only `hm` can record it (local). `suggested` is
the *pre-link* state — a relatedness the system found that the user may choose to make real.

The discovered → suggested → promote-to-real path is the read→write hinge: an embedding says two
issues are related (suggested); the user promotes it; it becomes a source or local link. This is
exactly what the duplicate engine automates into a hygiene suggestion.

### Naming is provisional

`source` / `local` / `suggested` are working names. Alternatives considered: synced/local,
native/bridged, source/hm. "native/external" was explicitly rejected. Settle the naming before this
ships.

## Rendering — the connections region

One **row per connection**, key + title, distinguished by a **leading icon for its kind** (icon
shape, never a chosen accent color — the user themes the app):

```
CONNECTIONS
🔗 blocks       AMP-1017  Refine CLI options to remove LSP…
🔗 implemented  PR #190   feat: add slack :ac-prune: command
🌐 references   GH #189   Add ac-run-recover command…           (local — spans systems)
SUGGESTED
✦ similar       AMP-800   Deprecate LSP from JSCA           83% related  [+ link]
✦ similar       GH #189   Add ac-run-recover command…       58% related  [+ link]
+ Add link
```

- **source** rows lead with a link/chain icon and show the source's relationship label.
- **local** rows lead with a distinct icon (globe / cross-system) — same row shape, different glyph.
- **suggested** rows lead with a sparkle, show a **confidence** as a theme-neutral secondary-highlight
  chip (e.g. `83% related`), and carry a **+ link** promote affordance. They are grouped under a
  small **Suggested** subheading so authoritative links read first and inferred ones don't masquerade
  as real.
- Each row's key/title **drills** (`concepts/navigation.md`). Set-shaped edges ("all related") render
  as a row that re-roots the list rather than focusing a single item.
- Dangling targets (un-ingested) render disabled.

One row per connection — with the title, not just the key — so a user can tell what an edge *is*
without drilling. (An earlier key-only chip layout forced a click-through to identify every edge.)

### Deleting a connection

Any row carries a delete affordance, with kind-dependent meaning:

- Deleting a **source** or **local** link **removes the connection and suppresses it** — the
  gardener won't re-surface the same pair (it writes a suppression record per `collection-gardener.md`).
- Deleting a **suggested** connection **dismisses the suggestion** (suppresses it) without ever
  creating a link.

Removal of a real link is a write and flows through the edit layer (`concepts/edits.md`); dismissing
a suggestion is local-truth suppression.

## Promoting a suggested connection

A suggested edge's **+ link** promotes it to a real link via a small popover that offers the
**contextually correct** option:

- both endpoints share a real source (Jira ↔ Jira) → **create a source link** (written back to the
  source; visible to everyone there);
- the endpoints span systems (Jira ↔ GitHub) → **create a local link** (hm-only; the source can't
  represent it).

The popover lets the user pick the **relationship type** (see the type picker below). Promoting is
the moment a relatedness the machine found becomes a relationship the user asserts; it produces a
change that the edit layer stages.

## Creating a link

Two entry points, one shared flow:

- **Promote** — from a suggested edge's **+ link**; the target is already known, so the flow starts
  at the type picker.
- **Add link** — a **+ Add link** row at the bottom of the connections region; the target is
  unknown, so the flow starts at finding it.

The flow is **target-first**: find the item, then pick the relationship type. (Type-first and a
combined inline-type variant were considered and dropped — committing to *what* before *how* read
most naturally.)

### Step 1 — find the target (a ⌘K twin)

A picker shaped like the quick switcher (`concepts/navigation.md`): a search input, a **ranked**
result list, and a **live preview** of the highlighted candidate; `↑↓` move, `Enter` (or a button)
advances. It is the same find-an-item idiom, with the intent "create a link" rather than "navigate".

**Ranking — relatedness-led, with workspace factored in.** Candidates are ordered by a **single
blended relevance score**: a relatedness signal (embedding / topic proximity — *not* duplicate-grade
similarity) **dominates**, and structural workspace signals (same project, already-linked
neighbours) **add on top** (ADR-007 rerank). Each row shows the dominant reason as a secondary
hint — `83% related`, `same project`, `linked`. So the most likely target — including a genuinely
related item in another system — surfaces first, before the user types, and typing narrows.

### Step 2 — pick the relationship type

A **filterable** list of relationship types, each tagged source vs local by its icon, **ranked by
context**:

- `references` rises when the target is a GitHub item;
- `duplicates` / `relates to` rise when the target is a discovered/related item;
- `blocks` / `is blocked by` rise within the same project;
- base order is usage commonness.

There is **no "Other" escape** — the filter *is* the way to reach any type (an explicit "Other →
modal" was dropped once the list filters). The chosen type + the source/local determination produce
the link, which the edit layer stages.

## Out of scope

- **Final naming** of source / local / suggested.
- **Whether a promoted local link can ever sync to a source** (it can't today — that's what makes it
  local).
- **Bulk linking** / linking from list selection — future; today linking is per-item from the
  preview.
- **Editing an existing link's type** in place — future polish; today it's delete + re-create.

## Cross-references

- `concepts/preview.md` — the preview that hosts the connections region.
- `concepts/navigation.md` — drilling along edges; the ⌘K idiom the find-target picker mirrors.
- `concepts/edits.md` — staging the create/delete-link changes; suppression.
- ADR-007 — two-pass retrieval; the relatedness + structural rerank the ranking uses.
- `collection-gardener.md` — suppression records; the duplicate engine that emits suggested links.
- `context-agent/design-system.md` — the link-type icons + secondary-highlight token.
