# Preview exploration — connections & linking

_From a prototyping session on 2026-05-30 (mm:prototyping). Sibling docs:
`preview-navigation.md`, `preview-content.md`. Write model: ADR-011._

## Connections model

**Chose:** one row per link (key + title), each typed by a **leading icon**:

- **source** — lives in the source system (a real Jira/PR link),
- **local** — hm-only, spans systems the source can't link,
- **suggested** — embedding near-neighbor + confidence, not yet a link.

Suggested edges **promote** to a real link via a popover (offers a source link
when both items share a source, else a local link); any edge can be **deleted**,
which removes + suppresses it (suggested → dismiss). The
discovered→suggested→promote-to-concrete path is the read→write hinge.

Considered: unified-typed vs split vs on-demand presentation — folded into "flat,
icon-typed". Naming (source / local / suggested) is provisional.

## Link creation

**Chose:** target-first. A ⌘K-twin "find the item" screen (ranked list + live
preview, `Enter` advances) → a context-aware relationship-type picker (filterable;
"Other" dropped — the filter covers it). Ranking is **relatedness-led with
workspace factored in**: one blended score where an embedding/topic relatedness
dominates and same-project / already-linked add on top (ADR-007 rerank).
Entry points: a suggested edge's "+ link" (promote, target known) and a "+ Add
link" row (target unknown).
Considered: type-first and combined flows (dropped); relatedness-only vs
workspace-only ranking (merged into the blend).

## Design-system deltas (apply when implemented)

- A theme-neutral **"secondary highlight"** token for relevance/confidence hints —
  categorical meaning must not co-opt the user's chosen accent; distinguish by
  **icon shape**, not color.
- **source / local / suggested** link-type icons.

## Open / deferred

- Final naming for source / local / suggested.
- Whether a promoted local link can ever sync to a source.
