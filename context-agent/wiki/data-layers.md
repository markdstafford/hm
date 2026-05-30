# Data layers

Last updated: 2026-05-29

How `hm`'s local data is organized into layers, which layers are authoritative, and how a change in one layer cascades into the others. This is the living companion to ADR-010 (the decision) and ADR-009 (the gardener that walks the recompute order at runtime). Update it whenever a new producer or data source lands.

## The three categories

Every table belongs to exactly one category. The category decides how the table is rebuilt, migrated, and backed up.

| Category | Tables (today) | Refresh / rebuild | Backup boundary |
| --- | --- | --- | --- |
| **Source-mirrored** | raw issue payloads, issues, comments, links, labels, components, people, worklogs (#10); the event log (#11, ADR-005) | re-ingest from the source system (incl. Jira changelog) | not backed up — re-ingestable |
| **Derived / cache** | daily snapshots (ADR-005); vector embeddings (#12); suggestions + enrichment proposals (#13/#14/#15) | recompute locally from source-mirrored data | not backed up — recomputable |
| **Local truth** | audit log (#45); suppressions / feedback; settings; named views | cannot be recomputed | **this is the backup boundary** |

Notes:

- The **event log is source-mirrored, not local truth.** Events are ingested from the upstream changelog and can be re-ingested (ADR-005: "re-ingest if needed"). It is the authoritative local copy for time-travel, but it is not irreplaceable.
- **Derived is not free to rebuild.** Snapshots and suggestions are cheap to recompute, but embeddings and AI enrichment cost time and money. "Recomputable" describes correctness, not cost.

## Recompute dependency order

A change to a lower layer invalidates the layers above it. The gardener's incremental runner (ADR-009) walks this order on each delta; a full rebuild walks it from the bottom.

```
source-mirrored (raw issue text, fields, events)
   │
   ├─► embeddings (#12) ──► duplicate candidates ──► duplicate suggestions (#13)
   │
   ├─► snapshots (ADR-005)
   │
   ├─► stale signals (from fields + events) ──► stale suggestions (#14)
   │
   └─► thin-issue detection ──► (AI generation) ──► enrichment suggestions (#15)

suppressions (local truth) ──► filter every suggestion before it is emitted
audit log (local truth)    ──► written when a suggestion is committed
```

## What a change invalidates

The point of the map: not every edit touches every layer. The gardener uses this to route incremental work (ADR-009) and to invalidate stale suggestions.

| Upstream change | Invalidates / triggers |
| --- | --- |
| Issue **body / title** edited | re-embed (#12) → re-run duplicate detection; re-run thin-issue detection; refresh any pending enrichment for that issue |
| Issue **labels / fields** edited | re-run stale signals and thin-issue detection; duplicates unaffected (no text change) |
| Issue **status** changed (e.g. closed) | resolve any pending suggestion whose action already happened; refresh stale signals |
| **New** issue ingested | all engines evaluate it (subject to their accepted triggers and the delta) |
| Issue **deleted** upstream | drop its embeddings and any pending suggestions about it |

## Rebuild and backup

- **Full rebuild:** drop all source-mirrored and derived tables, re-ingest from the source system, then let the gardener recompute derived data. Local-truth tables are untouched, so suppressions, audit history, settings, and views survive.
- **Backup / portability:** only local truth (plus configuration) needs to move between machines. Everything else reconstructs from the source system and local recomputation. Per ADR-003, there is no cross-machine sync in v1; this defines what a manual copy would need to include.
- **Schema migration:** derived tables may be dropped and rebuilt instead of migrated in place. Source-mirrored and local-truth tables follow the normal versioned-migration path (#10's schema versioning).

## Cross-references

- ADR-010 — the single-store, three-category decision this map details.
- ADR-009 — the gardener, whose incremental runner walks the recompute order.
- ADR-004 (SQLite), ADR-005 (events and snapshots), ADR-007 (embeddings + `sqlite-vec`).
- `context-agent/collections/collection-gardener.md` — the producer subsystem that consumes and updates these layers.
