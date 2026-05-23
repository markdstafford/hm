---
created: 2026-05-22
last_updated: 2026-05-22
status: complete
issue: 4
specced_by: markdstafford
implemented_by: markdstafford
superseded_by: null
---

# Settings storage primitives

## What

`hm` needs its first production settings storage layer so that later features can persist configuration safely without inventing incompatible one-off storage paths. The Rust core exposes three storage primitives matching ADR-008: per-user preferences stored as TOML in an OS config file, secret values stored in the OS keychain, and shared data-relevant settings stored as JSON text in SQLite.

The primitives are exposed through Tauri commands and registered with Tauri Specta so the TypeScript frontend receives checked-in generated bindings. This feature is intentionally foundational — it does not add a settings screen, source connector setup flow, or AI provider configuration form.

## Why

Several planned features need settings persistence before they can be built safely. Theme, font, view, and window-state preferences need a local preference file. GitHub, Jira, and AI provider credentials need keychain-backed storage. Source configuration, team identifiers, taxonomy, and ingestion schedules need to be queryable beside the local data they describe.

Without this layer, later features would either block or create incompatible storage paths. This work also enforces the security posture from the app spec: tokens belong in the OS keychain, not in files, logs, generated bindings, tests, or the database.

## Personas

- **Elena: EM** — benefits indirectly. Later source configuration and triage features need stable storage before she can connect her team's GitHub/Jira data.
- **Tarek: Team member** — benefits indirectly. His local preferences should survive restarts without mixing with team data or credentials.
- **Future feature implementer** — the immediate user. They need a simple, documented API that answers: "where does this setting belong, and how do I persist it safely?"

## Narratives

### AI provider setup uses the right storage class

A developer starts implementing AI provider configuration. They need to store an API key, endpoint metadata, model profile, and routing rule. Instead of creating a new config file, they use the settings primitives from this feature.

The API key goes through `secret_set`, which writes to the OS keychain under a stable `hm` service namespace. Endpoint metadata, model profile, and task routing go through `shared_settings_set`, because those values describe how `hm` processes source data and should be queryable beside that data. A user preference like "hide advanced provider fields by default" goes through `preferences_write`, because it affects only the local UI experience.

The developer runs Rust tests. Secrets use an in-memory store, so CI does not show a keychain prompt and no secret value appears in logs. The generated TypeScript bindings include all new commands, so the frontend can call them without hand-written IPC strings.

## User stories

**AI provider setup uses the right storage class**

- Future feature implementer can store an API key through `secret_set` without it entering plaintext files
- Future feature implementer can store endpoint metadata through `shared_settings_set` beside the data it describes
- Future feature implementer can store a UI preference through `preferences_write` in the OS config file
- Future feature implementer can run Rust tests without a real keychain prompt
- Future feature implementer can call generated TypeScript bindings for all settings commands without hand-writing IPC strings

## Goals

- Provide production storage primitives for ADR-008's three settings classes
- Keep Tauri command handlers thin and route behavior through testable Rust modules
- Add a SQLite `shared_settings` table without breaking existing migrations or sqlite-vec
- Regenerate `src/bindings.ts` so React code can call new commands through typed wrappers
- Cover behavior with Rust unit tests that run without launching Tauri
- Avoid CI dependence on a real OS keychain prompt

## Non-goals

- No visual settings screen
- No typed theme, font, or window-state preference schema beyond validating that the top-level payload is an object/table
- No full AI provider, GitHub, Jira, or source-configuration workflow
- No settings import/export tool
- No remote sync or multi-user settings sharing

## Tech spec

### Introduction and overview

**Prerequisites:**
- ADR-002 (Tauri) — Rust backend handles all system operations
- ADR-004 (SQLite + sqlite-vec) — primary local store
- ADR-008 (settings split) — preferences, credentials, and shared settings in separate locations

**Goals:**
- All settings commands testable without launching Tauri or touching a real keychain
- Existing database behavior (migrations table, sqlite-vec) unaffected

### System design and architecture

Three storage backends behind a unified command surface:

```
┌─────────────────────────────────────────┐
│ TypeScript (generated bindings)         │
│  preferences_read / preferences_write   │
│  secret_set / secret_get / secret_delete│
│  shared_settings_get / shared_settings_set │
└────────────────┬────────────────────────┘
                 │ Tauri IPC
┌────────────────┴────────────────────────┐
│ Rust commands (thin wrappers)           │
│  → settings/preferences.rs  (TOML file)│
│  → settings/secrets.rs      (keychain) │
│  → settings/shared.rs       (SQLite)   │
└─────────────────────────────────────────┘
```

**Module layout:**
```
src-tauri/src/settings/
  mod.rs
  error.rs        shared error type with safe display strings
  keys.rs         shared key validation (ASCII letters/numbers/._-, 1-128 chars)
  preferences.rs  TOML file read/write, production path resolution
  secrets.rs      trait-backed secret store (keychain + in-memory for tests)
  shared.rs       SQLite-backed shared settings helpers
```

### Detailed design

**Preferences:**
- Missing file returns `{}`
- Writes create parent directory when needed
- Writes store TOML at `~/Library/Application Support/hm/preferences.toml` (macOS)
- Non-object top-level payloads rejected
- Serialization failure does not replace existing valid file

**Secrets:**
- Trait-backed `SecretStore` with `set`, `get`, `delete` operations
- Production implementation uses OS keychain with `hm` service namespace
- In-memory implementation for tests
- Missing secrets return `None`, not an error
- Secret values never appear in logs, errors, or generated code

**Shared settings:**
- `shared_settings` table: `key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now'))`
- Writes use upsert, refresh `updated_at`
- Missing keys return `None`
- JSON type fidelity preserved for all valid JSON types

**Key validation (shared across all APIs):**
- Allowed: ASCII letters, ASCII numbers, `.`, `_`, `-`
- Length: 1–128 characters
- Rejects: empty, whitespace, path separators, control characters, non-ASCII

### Security, privacy, and compliance

- Secret values never written to TOML, SQLite, source files, generated bindings, logs, or test output
- No `Debug` output for errors includes secret values
- No telemetry, remote error reporting, or external calls
- Keychain failures treated as recoverable command errors with safe messages

### Testing plan

- Rust unit tests cover preferences (missing file, round-trip, non-object rejection, serialization failure safety)
- Rust unit tests cover key validation (accepted and rejected patterns)
- Rust unit tests cover in-memory secret store (set/get/delete/missing)
- Rust unit tests cover shared settings (set/get/missing/overwrite with in-memory SQLite)
- Binding generation test verifies all commands appear in `src/bindings.ts`
- No real keychain tests in CI; optional ignored test for manual verification

### Risks

- Keychain crate may behave differently across macOS local runs and Linux CI — mitigated by trait-backed tests
- Production SQLite path not yet defined — choose Tauri app data path, document it
- Generic JSON preferences are flexible but less self-documenting — acceptable for primitives; typed fields come later

## Task list

- [x] **Story: Preferences primitive**
  - [x] **Task: Add preferences storage helpers**
    - **Description**: Create a preferences module that reads and writes an object-shaped JSON payload as TOML at an explicit path, with production path resolution kept separate from the file helpers.
    - **Acceptance criteria**:
      - [x] Missing preferences file returns `{}`
      - [x] Writes create parent directory when needed
      - [x] Writes store TOML that round-trips back to the original object-shaped JSON value
      - [x] Non-object top-level JSON values rejected
      - [x] Serialization failure does not replace existing valid file
      - [x] Production path targets `~/Library/Application Support/hm/preferences.toml`
    - **Dependencies**: None
  - [x] **Task: Expose preferences Tauri commands and bindings**
    - **Description**: Add `preferences_read` and `preferences_write` command wrappers that call the preferences helpers through managed app state, then regenerate Specta bindings.
    - **Acceptance criteria**:
      - [x] `preferences_read() -> Result` exists
      - [x] `preferences_write(prefs: serde_json::Value) -> Result` exists
      - [x] Command errors use safe, human-readable strings
      - [x] `src/bindings.ts` includes generated wrappers for both commands
      - [x] Existing `commands.appStatus()` remains available
    - **Dependencies**: Preferences storage helpers

- [x] **Story: Secret primitive**
  - [x] **Task: Add shared key validation**
    - **Description**: Create one key validation helper for all key-based settings APIs.
    - **Acceptance criteria**:
      - [x] ASCII letters, numbers, `.`, `_`, `-` accepted
      - [x] 1–128 character keys accepted
      - [x] Empty, whitespace, path separators, control characters, non-ASCII, and overlong keys rejected
      - [x] Unit tests cover accepted and rejected examples
    - **Dependencies**: None
  - [x] **Task: Add secret store abstraction and in-memory implementation**
    - **Description**: Define a trait-backed secret store with an in-memory implementation for tests.
    - **Acceptance criteria**:
      - [x] Trait supports set, get, and delete operations
      - [x] In-memory store supports set/get/delete/missing behavior
      - [x] Missing secrets return `None` rather than an error
      - [x] Error paths do not include secret values
      - [x] Tests do not touch a real OS keychain
    - **Dependencies**: Key validation
  - [x] **Task: Add production keychain secret store**
    - **Description**: Implement the production secret store with a keychain crate and stable service namespace.
    - **Acceptance criteria**:
      - [x] Production `secret_set` stores opaque strings in OS keychain
      - [x] Production `secret_get` returns stored values, maps not-found to `None`
      - [x] Production `secret_delete` removes keys, handles missing as safe no-op
      - [x] Service namespace documented
    - **Dependencies**: Secret store abstraction
  - [x] **Task: Expose secret Tauri commands and bindings**
    - **Description**: Add `secret_set`, `secret_get`, and `secret_delete` command wrappers with key validation, then regenerate bindings.
    - **Acceptance criteria**:
      - [x] All three commands exist with correct signatures
      - [x] Command errors never include secret values
      - [x] `src/bindings.ts` includes generated wrappers
    - **Dependencies**: Key validation, secret store abstraction, production keychain store

- [x] **Story: Shared settings primitive**
  - [x] **Task: Add shared settings schema**
    - **Description**: Extend database setup so the `shared_settings` table exists while preserving existing migrations and sqlite-vec behavior.
    - **Acceptance criteria**:
      - [x] Schema creates `shared_settings` with `key`, `value_json`, `updated_at` columns
      - [x] Existing migrations smoke table tests pass
      - [x] Existing sqlite-vec smoke tests pass
      - [x] In-memory database helpers remain available for tests
    - **Dependencies**: Key validation
  - [x] **Task: Add SQLite shared settings helpers**
    - **Description**: Add helpers for setting and getting JSON values by key in SQLite.
    - **Acceptance criteria**:
      - [x] `shared_settings_set(key, value)` writes JSON text for a validated key
      - [x] Repeated writes overwrite using upsert, refresh `updated_at`
      - [x] `shared_settings_get(key)` returns original JSON value with type fidelity
      - [x] Missing keys return `None`
      - [x] Tests cover set/get/missing/overwrite with in-memory SQLite
    - **Dependencies**: Key validation, shared settings schema
  - [x] **Task: Expose shared settings Tauri commands and bindings**
    - **Description**: Add `shared_settings_get` and `shared_settings_set` command wrappers using managed database state, then regenerate bindings.
    - **Acceptance criteria**:
      - [x] Both commands exist with correct signatures
      - [x] Commands use managed Tauri state
      - [x] Database locks not held during keychain or filesystem work
      - [x] `src/bindings.ts` includes generated wrappers
    - **Dependencies**: Shared settings schema, shared settings helpers

- [x] **Story: Documentation and validation**
  - [x] **Task: Document settings implementation context**
    - **Description**: Update durable agent context with settings module layout, command list, storage paths, app state pattern, and test strategy.
    - **Acceptance criteria**:
      - [x] `context-agent/wiki/code-map.md` documents settings modules, commands, storage paths, and app state pattern
      - [x] `context-agent/wiki/testing.md` documents Rust tests, keychain test strategy, and frontend dependency setup
      - [x] Production SQLite path and keychain namespace documented
    - **Dependencies**: All command tasks
  - [x] **Task: Run validation checks**
    - **Description**: Run narrow checks first, then broader checks.
    - **Acceptance criteria**:
      - [x] `cargo test --manifest-path src-tauri/Cargo.toml` passes
      - [x] `npm run lint` passes
      - [x] `npm test` passes
      - [x] `npm run build` passes
    - **Dependencies**: All tasks
