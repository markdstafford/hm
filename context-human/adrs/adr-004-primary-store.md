---
created: 2026-05-21
last_updated: 2026-05-21
status: accepted
decided_by: null
superseded_by: null
---

# ADR 004: Primary store — SQLite + sqlite-vec

## Status

Accepted

## Context

`hm` stores structured data (issues, PRs, roadmap items, objectives, events, daily snapshots) and vector embeddings (for natural-language search, dedupe candidate generation, and "related" queries) on each user's machine. We need to decide the storage engine.

Constraints:

- Local, single-file backup-friendly storage is desirable
- Tens of thousands of structured rows; tens of thousands of vectors at projected scale
- Ingestion is mutation-heavy (poll-loop updates)
- Time-travel queries are needed for objectives and roadmap history (see ADR-005)

## Decision

`hm` uses **SQLite** plus the **sqlite-vec** extension, both in a single database file. Structured data and vector embeddings live together; queries cross-cut both without leaving the database.

Time-travel is satisfied by an event-sourced model plus daily snapshot tables (ADR-005), not by storage-layer versioning.

## Consequences

**Positive:**
- Single file: trivial to back up, inspect, copy, move
- Twenty-five years of mature tooling — CLI, GUIs, migration frameworks
- OLTP-friendly transactions across structured and vector data atomically
- `sqlite-vec` brute-force KNN is fast at this scale; no ANN tuning needed
- Strong constraints available (foreign keys, unique, check) if we want them
- Rust integration via `rusqlite` is mature

**Negative:**
- `sqlite-vec` ANN index types are still maturing; brute-force is fine for now but won't scale to millions of vectors
- No native time-travel ("as of T"); we build snapshots explicitly (ADR-005)
- Less analytical-query speed than a columnar store for large aggregations (not an issue at this scale)

## Alternatives considered

### Option 1: LanceDB

Columnar/Arrow-based vector + structured database with built-in dataset versioning.

**Pros:**
- Native dataset versioning gives "as of" queries at the storage layer for free
- Columnar storage is fast for analytical queries
- Native Rust library; first-class fit with Tauri
- Better ANN scaling beyond ~100k vectors

**Cons:**
- OLAP-shaped storage — mutation-heavy ingestion creates version churn that requires periodic compaction
- No storage-level constraints; foreign keys and uniqueness become application concerns
- Multiple files per dataset (manifest + data fragments + indexes) rather than one file
- Younger ecosystem, smaller tooling community
- SQL ergonomics via DataFusion are less ubiquitous than SQLite's

**Why not chosen:** Lance's killer feature — native versioning — doesn't save effort for `hm` because we want day-aligned snapshots for the UI, not raw version metadata (see ADR-005). Without that pull factor, SQLite's OLTP fit, single-file simplicity, and mature tooling win at this scale.

### Option 2: Dual-engine (SQLite for structured, LanceDB for vectors)

Use each engine for its strengths.

**Pros:**
- Best vector performance available at scale
- Best OLTP for structured data
- Each engine optimized for its workload

**Cons:**
- Two engines to learn, operate, and maintain
- No cross-engine transactions — consistency becomes an application responsibility
- More complexity for unclear v1 benefit; vector volume is small

**Why not chosen:** Two engines is real complexity. Adopting it preemptively for a scale we don't have is over-engineering. The escape hatch is reversible: if vector workload outgrows `sqlite-vec`, we can introduce LanceDB behind the candidate-generator interface (ADR-007) without disturbing the rest of the data model.
