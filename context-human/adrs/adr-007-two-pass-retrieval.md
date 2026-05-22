---
created: 2026-05-21
last_updated: 2026-05-21
status: accepted
decided_by: null
superseded_by: null
---

# ADR 007: Two-pass retrieval

## Status

Accepted

## Context

Several `hm` features need to find related things: duplicate issue candidates, related PRs for an investigation, similar items in the visual map. Each requires both reasonable recall (don't miss real matches) and reasonable precision (don't drown the user in false positives).

Constraints:

- Embedding-only retrieval produces candidates that often look semantically similar but are structurally unrelated (same vocabulary, different components)
- Structural-only retrieval misses valid matches that use different wording
- Confidence scoring is required so the UI can sort high-confidence batches from items needing review

## Decision

Related-finding in `hm` is a two-pass pipeline:

1. **Candidate generation** — embedding-based nearest-neighbor search via `sqlite-vec` returns the top-K candidates by vector similarity.
2. **Structural re-ranking** — combine vector similarity with structural signals (shared title tokens, overlapping affected files, common authors, same workstream/owner, time-window proximity, label overlap) into a per-candidate confidence percentage. Weights are task-specific.

K and the structural weights vary by task: e.g., K=20 for duplicates and K=10 for "related"; duplicates weight overlapping files heavily, "related" weights workstream and owner more.

The UI consumes the reranked, confidence-scored list: high-confidence items can be batched and approved together; low-confidence items get individual review.

The candidate generator is exposed behind an interface so the underlying vector engine can be swapped later (e.g., to LanceDB or sqlite-vec ANN indexes) without changing the re-ranking or scoring code.

## Consequences

**Positive:**
- High recall (vector pass) plus high precision (structural pass)
- Confidence scoring drives the UX pattern: fast on certain items, careful on uncertain ones
- Structural signals are explainable to users ("`hm` suggested this because they share these files")
- One pattern works for duplicates, related, and similar — only weights change

**Negative:**
- More code than a one-pass approach
- Tuning structural weights per task is its own ongoing effort
- Confidence is a heuristic, not a calibrated probability — users should treat it as a hint

## Alternatives considered

### Option 1: Pure vector similarity, no rerank

Trust embedding distance as the only ranking signal.

**Pros:**
- Simpler implementation
- Less per-task tuning

**Cons:**
- High recall, low precision — semantically similar items often aren't related
- No way to explain "why" beyond "the embeddings said so"
- Confidence becomes raw distance, which isn't intuitive to users

**Why not chosen:** Pure vector ranking drowns users in semantically-similar-but-unrelated items, eroding trust in suggestions fast. The user-facing UX (high-confidence batches reviewed quickly) needs a structurally-aware confidence signal.

### Option 2: Pure structural match, no embeddings

Use keyword overlap, shared metadata, etc. without embeddings.

**Pros:**
- No vector infrastructure needed
- Fully explainable

**Cons:**
- Misses matches that use different vocabulary — "login broken" and "authentication failure" share no tokens
- High precision but low recall

**Why not chosen:** Recall matters, especially for duplicates. Missing a real duplicate (the case structural-only would lose) is worse than presenting a low-confidence candidate the user can quickly reject.
