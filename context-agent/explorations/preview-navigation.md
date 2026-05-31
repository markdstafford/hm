# Preview exploration — navigation

_From a prototyping session on 2026-05-30 (mm:prototyping). One of several
concern-split docs from this exploration; siblings: `preview-connections.md`,
`preview-content.md`. The write model is separate — see ADR-011._

## Scope reframe

The starting question ("which Jira fields/layout in the canonical preview") opened
up. The real spine: a collection viewer previews items of **very different shapes**
(Jira issue, hygiene suggestion, report, GitHub PR/issue); the app's point is
**discovering connections across systems**; and previewing must ladder into
**write**. So a preview is a *node in a cross-system navigation graph*, not a
terminal card.

## Drill-through navigation

**Chose:** breadcrumb focus-drill in the peek. Following a concrete single-target
edge swaps the peek to that item; a breadcrumb holds the path. Lowest chrome, fits
any surface width.
Considered: stacked / labeled-rail peeks (cramped in a narrow rail; the roomy ⌘K
overlay does deep traversal better) and list re-root (kept, but only for *set*
edges).

**Also:** following a **set** edge ("all related", "stale issues") re-roots the
list to that set — a behavior, not a variant. Dangling edges (un-ingested targets)
render disabled.

## Quick switcher (⌘K)

**Chose:** find & jump = a launcher that previews. Ranked result list + live preview
of the highlighted item; `↑↓`/`jk` move, `Enter` opens it out into the surface,
`1–9` open its numbered connections. No infinite in-palette traversal — it hands
off to the breadcrumb surface. Lateral-jump and edge-traversal are the two movement
modes; they converge on the same surface.

(Preview/nav aspects validated; the switcher is **not fully designed** — search
quality and whether it needs embeddings are open; see
`context-human/follow-ups.md`.)

## Open / deferred

- ⌘K beyond preview/nav (search quality; embedding cost — follow-up doc).
- Optimistic display of staged edits during a drill (pending badges) — see ADR-011.
