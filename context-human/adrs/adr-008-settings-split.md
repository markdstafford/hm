---
created: 2026-05-21
last_updated: 2026-05-21
status: accepted
decided_by: null
superseded_by: null
---

# ADR 008: Settings split

## Status

Accepted

## Context

`hm` has several classes of configuration that differ in lifecycle, sensitivity, and scope. Putting them all in one place leads to friction: app preferences ending up in a database that needs to migrate, secrets in plaintext config files, or "shared" settings stuck in OS-specific user-preference paths where they don't belong.

We need to decide where each class lives.

Constraints:

- API tokens must be secret
- Per-user preferences shouldn't pollute the data store
- Settings that describe the team's data should be queryable alongside that data
- v1 is single-user (ADR-003) — "shared" here means "shared across sessions," not between users

## Decision

Three storage locations, one per class:

1. **Per-user preferences** — window state, theme, view options, recent searches → OS-appropriate config file. On macOS: `~/Library/Application Support/hm/preferences.toml`
2. **Credentials** — API tokens for GitHub, Jira, AI providers → OS keychain
3. **Shared / data-relevant settings** — connected data sources, team identifiers, custom taxonomy, OKR templates, ingestion schedules, doc paths → SQLite database (the same one that holds the data they describe)

## Consequences

**Positive:**
- Secrets never touch config files or the database
- App preferences travel with the OS profile (Time Machine, migration assistant, etc.)
- Data-describing settings are queryable in SQL alongside the data they describe
- Clear policy answers "where does this setting belong?" without judgment calls per setting

**Negative:**
- Three locations to remember (mitigated by clear policy)
- Cross-platform expansion later means re-deciding the per-user-prefs location for Windows/Linux
- A settings export/backup tool would need to read all three locations

## Alternatives considered

### Option 1: Everything in the database

Single source of truth in SQLite.

**Pros:**
- One place to look for any setting
- Settings backup/restore is just the DB file

**Cons:**
- API tokens in the DB are a security regression vs. keychain
- App preferences in the DB pollute the schema and inflate migrations
- Doesn't match OS conventions for user preferences

**Why not chosen:** Mixing secrets with data is a security regression we're not willing to take. The keychain exists for exactly this reason.

### Option 2: Everything in config files

TOML or JSON files for all configuration.

**Pros:**
- Easy to version-control (for shared settings)
- Plain-text auditable

**Cons:**
- Secrets in plaintext is unsafe
- Data-describing settings (which Jira project, which GitHub org) need to be joined with data — files make that awkward
- File-based locking and atomicity are weaker than SQLite transactions

**Why not chosen:** Same secret-handling regression as Option 1, plus operational pain for data-relevant settings. SQLite is the better fit for the third class.
