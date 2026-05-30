---
created: 2026-05-29
last_updated: 2026-05-29
status: proposed
decided_by: null
superseded_by: null
---

# ADR 010: Single-store data layering and derived-data model

## Status

Proposed

## Context

`hm` now accumulates data in several layers: source-mirrored issue data (#10), event history and daily snapshots (ADR-005), vector embeddings (#12, ADR-007), and the gardener's output — suggestions and enrichment proposals (#13/#14/#15, ADR-009) — alongside suppressions and the audit log (#45).

ADR-004 chose SQLite as the primary store and ADR-007 added the in-process `sqlite-vec` extension. As the number of layers grows, two questions need a recorded answer:

- Do we keep all layers in one store, or split them (for example, a dedicated vector store)?
- How do we reason about which data is authoritative, which is recomputable, and what the rebuild, migration, and backup boundaries are?

Constraints:

- ADR-003 fixes the scale: ~25 users, ~90 tickets/week org-wide. Data volume is small.
- ADR-003 is local-first and single-user; there is no shared backend and no central index.
- Some layers are expensive to recompute (embeddings, AI enrichment); others are cheap (snapshots, suggestions).

## Decision

Keep a **single SQLite database** (with `sqlite-vec`) for all layers, and classify every table into one of three **data categories** that govern its lifecycle.

- **Single store.** One database preserves cross-layer joins (a suggestion joins to its target issue, its embedding, and its audit entries) and transactional consistency. At ADR-003's scale, one store is ample.
- **Three data categories:**
  1. **Source-mirrored** — raw issues, comments, links, people, and the event log (#10, ADR-005). Refreshable by re-ingesting from the source system, including the Jira changelog.
  2. **Derived / cache** — daily snapshots (ADR-005), vector embeddings (#12), suggestions, and enrichment proposals (ADR-009). Recomputable locally from source-mirrored data; may be dropped and rebuilt.
  3. **Local truth** — the audit log (#45), suppressions and feedback, settings, and named views. Originates in `hm`, cannot be recomputed, and is the only data that must be preserved.
- **Lifecycle rules follow from the category.** Derived tables may be dropped on a schema change and rebuilt. The backup and portability boundary is local truth (plus configuration). A full rebuild blows away source-mirrored and derived data, re-ingests, and recomputes, while preserving local truth.
- **The recompute dependency order is explicit** and owned operationally by the gardener's incrementality (ADR-009). The living detail lives in `context-agent/wiki/data-layers.md`.

## Consequences

**Positive:**

- The rebuild story is clear: keep local truth, drop and recompute the rest.
- Schema migrations on derived tables are cheap — drop and rebuild instead of migrate-in-place.
- The backup surface is small and well-defined (local truth only).
- Single-database joins between layers stay simple and transactional.
- At ADR-003 scale, one store has ample headroom, so no premature partitioning.

**Negative:**

- Many tables live in one database, which needs naming and organizational discipline.
- "Just rebuild" is not free for the expensive tiers — re-embedding and re-enriching cost time and money, so derived does not mean disposable-at-no-cost.
- The recompute dependency order must be maintained as engines are added, or incremental updates will miss layers.
- A single file is a single point of corruption; mitigated by the rebuild story and by source systems retaining the upstream record.

## Alternatives considered

### Option 1: Separate datastore per layer

Use a dedicated vector database for embeddings, and possibly separate stores for other layers.

**Pros:**
- Each store is tuned for its access pattern.
- Vector search could use a purpose-built engine.
- Layers scale independently.

**Cons:**
- Loses cross-layer joins and single-transaction consistency.
- Adds operational and dependency overhead to a local-first desktop app.
- `sqlite-vec` already runs in-process and meets the scale.

**Why not chosen:** At ADR-003's scale the join and transactional benefits of one store outweigh any tuning gain, and a second datastore contradicts the local-first, low-operational-overhead posture.

### Option 2: Treat all data as authoritative (no cache tier)

Model every table as a permanent record, with no recomputable category.

**Pros:**
- One uniform mental model for all data.
- No rebuild logic to write.
- Every table is backed up the same way.

**Cons:**
- Forces backing up and migrating data that is trivially recomputable.
- Contradicts ADR-005, which already treats snapshots as a cache.
- Makes schema migrations heavier than necessary.

**Why not chosen:** ADR-005 already established the cache concept for snapshots; extending it to embeddings and suggestions is consistent and reduces migration and backup cost.

### Option 3: No explicit layering model (status quo)

Add tables as features land without a stated category model.

**Pros:**
- No upfront modeling work.
- Maximum flexibility per feature.
- Nothing new to document.

**Cons:**
- Rebuild, backup, and migration decisions become ad hoc per table.
- Easy to back up or migrate recomputable data by mistake.
- New engines have no guidance on where their data fits.

**Why not chosen:** With four-plus layers, an unstated model makes rebuild and backup error-prone. A simple three-category rule is cheap insurance and guides every future engine.

## Cross-references

- ADR-003 (local-first), ADR-004 (SQLite primary store), ADR-005 (events and snapshots), ADR-007 (two-pass retrieval), ADR-009 (gardener).
- `context-agent/wiki/data-layers.md` — the living recompute dependency map.
- #10 (ingestion), #11 (history), #12 (embeddings) — the layers this model classifies.
