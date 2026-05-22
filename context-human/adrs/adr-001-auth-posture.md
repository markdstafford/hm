---
created: 2026-05-21
last_updated: 2026-05-21
status: accepted
decided_by: null
superseded_by: null
---

# ADR 001: Auth posture

## Status

Accepted

## Context

`hm` is a desktop application that aggregates and acts on data from multiple source systems (GitHub, Jira, internal eval system, doc repos) on behalf of an individual user. We need to decide how authentication and authorization work — both for the user accessing `hm` and for `hm` accessing each upstream system.

v1 is local-only and single-user (see ADR-003). There is no shared backend service, no multi-user UI, and no cross-user data sharing.

Key constraints:

- Each user has existing accounts on the source systems
- Each user's access rights to those systems are already managed by org IT
- `hm` should not need its own user database
- `hm` should not be able to do anything the user couldn't already do themselves

## Decision

`hm` has no user accounts of its own. Each user authenticates to source systems directly using whatever method each system supports (GitHub PAT or OAuth, Jira PAT or basic auth, etc.). API tokens are stored in the macOS keychain.

Authorization is inherited: `hm` operates entirely within the bounds of what each user can already see and do in each source system. There is no shared service account, no privilege elevation, and no mechanism for one user's `hm` to access data another user can't access in the upstream system.

## Consequences

**Positive:**
- No identity store to operate or secure
- No new credentials for users to manage
- Audit trails in source systems show the actual user, not a service account
- Org-level access changes (offboarding, role changes) take effect immediately
- Compliance posture is straightforward: `hm` sees what the user sees; nothing more

**Negative:**
- Each user manages their own tokens; rotation is per-user, not central
- No shared service account means no way to ingest on behalf of users who haven't configured tokens
- Shared/team features will require rethinking when collaboration lands post-v1
- Recovery from a lost or corrupted keychain is manual per user

## Alternatives considered

No realistic alternatives at v1. The local-first single-user architecture (ADR-003) forecloses on shared service accounts, and federated SSO via the user's IdP would add a backend dependency without giving the user any capability they don't already have — the source systems already enforce SSO where the org has it. This decision follows from ADR-003.
