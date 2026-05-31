# Navigation

How a user moves between items in `hm`. The app's purpose is discovering connections across
systems — a report points at issues, an issue at its PRs, a PR back at issues — so the item
viewer is not a set of dead-end cards but a **navigable graph**. This doc defines the two ways a
user moves through that graph and how they fit together. What a single item *shows* is
`concepts/preview.md`; the edges themselves (and creating them) are `concepts/connections.md`.

## Two movement modes

There are exactly two ways to change which item you're looking at, and they converge on the same
preview surface:

- **Edge traversal (drill-through)** — follow a *connection* from the current item to a related
  one. Local, relationship-driven; how you explore a neighbourhood.
- **Lateral jump (⌘K quick switcher)** — teleport to *any* item by searching, regardless of
  connections. Global; how you get somewhere unrelated fast.

The quick switcher is an **on-ramp**: it gets you to an item and hands off to the preview surface,
where drill-through takes over. The two are complementary, not competing — a user finds an entry
point with ⌘K, then drills outward from it.

## Drill-through

Following a connection from an open preview changes what the preview shows. *How* it changes
depends on the **kind of edge** — and this is the load-bearing distinction.

### Focus-drill (single-target edges)

A concrete, single-target edge — "this PR", "duplicate of AMP-1102", "blocked by AMP-1014" —
**swaps the peek content** to that target. A **breadcrumb** records the path and lets the user step
back:

```
┌──────────────────────────────────────────────┐
│ RPT-1  ›  AMP-1087  ›  PR #190           [✕]  │  breadcrumb
├──────────────────────────────────────────────┤
│ …preview of PR #190…                          │
└──────────────────────────────────────────────┘
```

- Each crumb is the item's key; the last is the current item (not a link). Clicking an earlier
  crumb truncates the trail back to it.
- The trail is linear (browser-tab model). It is the simplest thing that keeps "where did I come
  from" answerable, and it survives in a narrow rail where spatial peek-stacking does not.
- Considered and rejected: **stacked / labeled-rail peeks** (Notion peek-over-peek). They cramp a
  narrow desktop rail, and deep multi-hop traversal reads better in the roomy ⌘K overlay than in a
  stack of slivers — so the breadcrumb wins for the rail and the switcher carries depth.

### Set-drill (set-shaped edges)

Some edges point at a *set*, not a single item: "all related", "stale issues", "issues this PR
touches". Following one **re-roots the collection list** to that set — the list itself becomes the
related items, with an affordance to return to the original collection. Set-drill is a **behavior of
a set edge**, not a separate navigation mode the user chooses; it reuses the list's full machinery
(sort, group, filter, selection) on the related items. List re-rooting is specified in
`collection-read.md`; here it is named as what a set edge does.

### Why the edge kind decides the drill

Concrete relationships are usually single-target (this PR, this duplicate-of) → **focus-drill**.
Discovered relationships are inherently set-shaped ("here are the eight things that look related") →
**set-drill / re-root**. The user never picks "focus vs re-root"; the edge's type and arity pick it.
This mirrors the concrete/discovered split in `concepts/connections.md`.

### Dangling edges

A relationship can point at an item `hm` has not ingested (a cross-project reference to an issue
outside the synced set). Such an edge renders **disabled** — visible, marked, not drillable —
rather than breaking or pretending to navigate. The graph being incomplete is normal and must be
legible.

### Cross-system / cross-project drill is uniform

Drilling Jira → GitHub, or AMP → a different Jira project, behaves exactly like a same-source drill.
The breadcrumb and the swap don't care which system the next node lives in — which is the point of a
cross-system viewer.

## Quick switcher (⌘K)

A centered command palette: a **search input**, a **ranked result list**, and a **live preview** of
the highlighted result, side by side.

```
┌── ⌘K ──────────────────────────────────────────────────┐
│ Search items…   ↑↓/jk move · ↵ open · 1–3 open a conn   │
├───────────────────────────┬─────────────────────────────┤
│ AMP-1087  Cardinality…    │  …compact preview of the     │
│ AMP-1014  Create LSP…     │     highlighted item…        │
│ PR #190   feat: ac-prune  │                             │
└───────────────────────────┴─────────────────────────────┘
```

- The preview pane reuses the canonical preview in its compact form (`concepts/preview.md`) — the
  switcher is a *fourth host* of the same component, so the user sees a real rendering, not a stub.

### Keyboard model

- `↑` / `↓` (and `j` / `k`) move the highlight through the results.
- `Enter` **opens** the highlighted item out into the collection surface (the switcher closes;
  drilling continues there).
- `1`–`9` **open the highlighted item's numbered connections** directly — the same land-in-the-
  surface action, one keystroke deeper.
- The first `↓` from the search box, and any `↑/↓/j/k`, **blur the search input** (focus parks on
  the result region) — so the digit keys become connection shortcuts instead of typing into search.
  Click back into the box (or just type) to refine the query.
- List navigation **clamps** (no wrap): `↓` stops at the bottom; `↑`/`k` at the top item returns
  focus to the search box. The first `↓` from search lands on the top result.
- The search input disables browser/OS autocomplete and autocorrect (they otherwise capture the
  arrow keys).

### What it does, and doesn't, do

The switcher is **find-and-jump**. Following a connection from its preview **lands** the target in
the surface — it does **not** support infinite in-palette traversal. A rejected variant let you
drill arbitrarily deep inside the palette; it was dropped because deep exploration belongs in the
breadcrumb surface, and a launcher that becomes a second navigation surface is two things at once.

## Open / deferred

- **The switcher beyond preview + navigation is not fully designed** — only its preview and the
  movement keys above are settled. Result *ranking* and whether matching needs embeddings (semantic
  search) vs lexical key/title match are open; interactive per-keystroke embedding would exceed the
  Grove free tier, implying a local embedder behind the ADR-006 provider abstraction. See
  `context-human/follow-ups.md`.
- **In-palette edge pivots** (filtering the result set to "things connected to this") — a possible
  future, dependent on the connections model and the embedding question.

## Cross-references

- `concepts/preview.md` — what each node renders (and the compact form the switcher hosts).
- `concepts/connections.md` — the edges drilled along; concrete vs discovered.
- `collection-read.md` — the list, display order, and list re-rooting that set-drill reuses.
- `context-human/follow-ups.md` — the ⌘K embedding-cost question.
