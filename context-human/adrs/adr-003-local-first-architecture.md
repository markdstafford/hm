---
created: 2026-05-21
last_updated: 2026-05-21
status: accepted
decided_by: null
superseded_by: null
---

# ADR 003: Local-first single-user architecture for v1

## Status

Accepted

## Context

`hm` aggregates data from multiple source systems and presents unified views, maps, and queries. We need to decide whether aggregation happens in a shared backend service that multiple users connect to, or locally in each user's desktop instance.

Constraints:

- ~25 users max in the initial deployment; ~90 tickets/week org-wide — small data volume
- Each user already has full access to all source systems they need
- Source code repos must be on disk for code-level analysis regardless
- Collaboration features (shared annotations, shared views, learned-feedback sharing) are deferred to a future version

## Decision

v1 is fully local, single-user. Each user runs their own `hm` against their own credentials and their own local repo clones. There is no shared backend service, no centralized index, and no cross-user data sharing.

The Tauri Rust core (ADR-002) handles ingestion, storage, and query. The UI talks to it via Tauri commands. All data lives on the user's machine.

## Consequences

**Positive:**
- No backend service to operate, monitor, or secure
- No central index means no central failure point
- Trivial to install and run
- Each user's `hm` sees exactly what their credentials allow — no over-permissioning
- Faster iteration: ship the desktop binary; no backend deploy

**Negative:**
- Each user re-ingests the same upstream data — API calls duplicated across users
- No way to share annotations or "`hm` learned this" feedback between users in v1
- Shared views (e.g., one user opening another's link) render approximately-the-same data, not byte-identical
- Adding collaboration later requires retrofitting a shared coordination layer

## Alternatives considered

### Option 1: Shared backend service

A single `hm` backend ingests data once and serves it to many desktop clients.

**Pros:**
- Efficient API usage — ingest once, serve many
- Natural place to land shared annotations and collaboration features
- Consistent shared views across users

**Cons:**
- Backend service to operate (deploy, monitor, secure, scale)
- New auth and access-control surface
- For 25 users at the projected data volume, operational cost outweighs the efficiency gain
- Source code still has to be on disk per user regardless — a partial backend is awkward

**Why not chosen:** At this scale, the operational overhead of a backend service is real and the efficiency gains are negligible. GitHub's per-user rate limits comfortably handle 25 independent clients. Collaboration features were explicitly deferred out of v1, removing the main reason to centralize.
