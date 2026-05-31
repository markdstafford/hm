# Follow-ups

Human-owned open items surfaced during design/implementation work. These are
decisions or investigations for a person to pick up — not agent working notes.

## ⌘K quick switcher — embeddings & local-embedding cost

Raised 2026-05-30 during the preview/drill-through prototyping session.

Decide whether the ⌘K quick switcher needs **embeddings** (semantic search over
items) or whether **lexical key/title substring matching** is enough.

- If lexical is enough: no embedding dependency, no cost concern.
- If embeddings are needed: interactive, per-keystroke querying would blow past
  the Grove free tier (`embed-v-4-0`: 10 req/min, 50 req/day per model), so we'd
  need a **local embedding option** (on-device model). hm already stores vectors
  via sqlite-vec (#12) and routes provider calls through the ADR-006 provider
  abstraction, so a local embedder would slot in behind that seam.

Suggested starting point: ship lexical match first; only reach for embeddings if
recall is clearly inadequate, and evaluate a local embedder at that point.
