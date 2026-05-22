---
type: feature
status: complete
created: 2026-05-22
last_updated: 2026-05-22
source_issue: [https://github.com/markdstafford/hm/issues/4](https://github.com/markdstafford/hm/issues/4)
related_adrs:
	- ../adrs/[adr-002-desktop-framework.md](http://adr-002-desktop-framework.md)
	- ../adrs/[adr-004-primary-store.md](http://adr-004-primary-store.md)
	- ../adrs/[adr-006-ai-provider-abstraction.md](http://adr-006-ai-provider-abstraction.md)
	- ../adrs/[adr-008-settings-split.md](http://adr-008-settings-split.md)
---
# Feature: Settings storage primitives

## What

`hm` needs its first production settings storage layer. The Rust core will expose three storage primitives that match ADR-008:
1. Per-user preferences stored as TOML in an OS config file.
2. Secret values stored in the OS keychain.
3. Shared, data-relevant settings stored as JSON text in SQLite.
The primitives are exposed through Tauri commands and registered with Tauri Specta so the TypeScript frontend receives checked-in generated bindings. This feature is intentionally foundational. It does not add a settings screen, source connector setup flow, or AI provider configuration form.
## Why

Several planned `hm` features need settings persistence before they can be built safely. Theme, font, view, and window-state preferences need a local preference file. GitHub, Jira, and AI provider credentials need keychain-backed storage. Source configuration, team identifiers, taxonomy, OKR templates, ingestion schedules, and doc paths need to be queryable beside the local data they describe.
Without this layer, later features would either block or create incompatible one-off storage paths. This work also enforces the security posture from the app spec: tokens belong in the OS keychain, not in files, logs, generated bindings, tests, or the database.
## Goals

- Provide production storage primitives for ADR-008's three settings classes.
- Keep Tauri command handlers thin and route behavior through testable Rust modules.
- Treat missing preferences and missing secrets as expected states.
- Add a SQLite `shared_settings` table without breaking the existing migrations smoke table or sqlite-vec smoke test.
- Regenerate `src/bindings.ts` so React code can call the new commands through typed wrappers.
- Cover the behavior with Rust unit tests that run without launching Tauri.
- Avoid CI dependence on a real OS keychain prompt by testing secrets through a mock or in-memory store.
- Document durable implementation context for future agents.
## Non-goals

- No visual settings screen.
- No typed theme, font, or window-state preference schema beyond validating that the top-level preferences payload is an object/table.
- No full AI provider, GitHub, Jira, or source-configuration workflow.
- No settings import/export tool.
- No remote sync or multi-user settings sharing.
- No migration framework beyond the small schema extension needed for `shared_settings`, unless implementation discovers one is required for correctness.
## Personas

- **Elena, EM** — benefits indirectly. Later source configuration and triage features need stable storage before she can connect her team's GitHub/Jira data and use backlog hygiene safely.
- **Priya, PM** — benefits indirectly. Roadmap and OKR configuration need shared settings so `hm` can join configured documents and team identifiers with ingested data.
- **Tarek, team member** — benefits indirectly. His local preferences, such as theme and recent views, should survive restarts without mixing with team data or credentials.
- **Future feature implementer** — the immediate user. They need a simple, documented API that answers: "where does this setting belong, and how do I persist it safely?"
## Narratives

### AI provider setup uses the right storage class

A developer starts implementing AI provider configuration. They need to store an API key, endpoint metadata, model profile, and routing rule. Instead of creating a new config file, they use the settings primitives from this feature.
The API key goes through `secret_set`, which writes to the OS keychain under a stable `hm` service namespace. Endpoint metadata, model profile, and task routing go through `shared_settings_set`, because those values describe how `hm` processes source data and should be queryable beside that data. A user preference like "hide advanced provider fields by default" goes through `preferences_write`, because it affects only the local UI experience.
The developer runs Rust tests. Secrets use an in-memory store, so CI does not show a keychain prompt and no secret value appears in logs. The generated TypeScript bindings include all new commands, so the frontend can call them without hand-written IPC strings.
## User stories

### Story 1: Store local preferences safely

As a future settings UI implementer, I want to read and write a preferences object through a Tauri command so that local UI preferences survive app restarts without entering the database.
Acceptance criteria:
- Reading preferences returns an empty object when the file does not exist.
- Writing preferences creates the parent directory when needed.
- Writing preferences stores TOML at the ADR-008 path on macOS: `~/Library/Application Support/hm/preferences.toml`.
- The write path fails before replacing the existing target file when serialization fails.
- Non-object top-level payloads are rejected.
### Story 2: Store credentials in the OS keychain

As a future connector or AI provider implementer, I want to set, get, and delete secret values by key so that tokens never enter plaintext app files or SQLite.
Acceptance criteria:
- `secret_set(key, value)` stores a secret value in the production OS keychain.
- `secret_get(key)` returns the stored value when present.
- `secret_get(key)` returns `null`/`None` when the key is missing and the underlying keychain crate can distinguish not-found from real failures.
- `secret_delete(key)` removes a key when present and handles missing keys as a safe no-op or clear not-found result.
- Unit tests cover set/get/delete/missing behavior without touching a real keychain.
- Error messages never include secret values.
### Story 3: Store shared settings in SQLite

As a future ingestion or roadmap feature implementer, I want to persist data-relevant settings in SQLite so that source configuration can be queried beside ingested data.
Acceptance criteria:
- Schema setup creates a `shared_settings` table.
- `shared_settings_set(key, value)` writes or overwrites JSON for a key.
- `shared_settings_get(key)` returns the JSON value for a key.
- `shared_settings_get(key)` returns `null`/`None` when a key is missing.
- Existing database tests for the migrations table and sqlite-vec continue to pass.
### Story 4: Use typed frontend bindings

As a frontend implementer, I want generated bindings for settings commands so that React code does not hand-write Tauri IPC command names.
Acceptance criteria:
- `src/bindings.ts` includes generated wrappers for the selected command names.
- Existing `commands.appStatus()` remains available.
- TypeScript compile checks pass once frontend dependencies are installed.
## Requirements

### Storage classes

The implementation must follow ADR-008's split storage model:
- Preferences are per-user, local-only UI settings stored as TOML in the OS config directory.
- Secrets are opaque strings stored in the OS keychain in production.
- Shared settings are data-relevant JSON values stored in SQLite.
### Command surface

Use these Tauri command names unless implementation discovers a Tauri/Specta naming conflict:
- `preferences_read() -> Result`
- `preferences_write(prefs: serde_json::Value) -> Result`
- `secret_set(key: String, value: String) -> Result`
- `secret_get(key: String) -> Result, String>`
- `secret_delete(key: String) -> Result`
- `shared_settings_get(key: String) -> Result, String>`
- `shared_settings_set(key: String, value: serde_json::Value) -> Result`
Generated TypeScript wrappers may use camelCase names, matching the existing `appStatus` binding pattern.
### Key validation

All key-based APIs should share conservative validation:
- Allowed characters: ASCII letters, ASCII numbers, `.`, `_`, and `-`.
- Length: 1 to 128 characters.
- Empty keys, whitespace, path separators, control characters, and unbounded keys are rejected.
This keeps key names safe across keychain, SQLite, logs, and future UI surfaces.
### Preferences payload

- The preferences payload is generic JSON at the command boundary for now.
- The top-level value must be an object so it maps predictably to TOML tables.
- A missing preferences file means `{}`.
- Serialization failures fail before replacing the existing preferences file.
- Implementation uses a config-directory crate such as `directories` rather than hard-coding home-directory logic.
- Lower-level helpers accept an explicit path for tests.
### Secret values

- Secret values are opaque strings.
- Secret values may be empty only if the keychain crate supports that consistently; otherwise empty values are rejected with a clear error.
- Secret values never appear in logs, panic messages, test names, error strings, TOML, SQLite, source files, or generated bindings.
- Production storage uses a stable service namespace, preferably the final Tauri app identifier if one exists. If the identifier is not final, use `hm` and document the choice.
- A trait-backed secret store supports an in-memory implementation for tests and a keychain-backed implementation for production.
### Shared settings values

- Shared settings values are JSON at the command boundary.
- Values are stored as JSON text in SQLite for this primitive layer.
- Writes overwrite by key using an upsert.
- Updates refresh `updated_at`.
- Valid JSON type fidelity is preserved for objects, arrays, strings, numbers, booleans, and null.
### Database and app state

Schema setup creates this table if it does not already exist:
```sql
CREATE TABLE IF NOT EXISTS shared_settings (
    key         TEXT PRIMARY KEY,
    value_json  TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```
Additional database and state requirements:
- Existing in-memory database helpers remain available for tests.
- Production code opens a persistent SQLite database under a Tauri app-data directory or another app-spec-aligned local path under the user home directory.
- Commands that need the database or production storage paths access managed Tauri state rather than global mutable state.
- Database locks are short-lived and are not held while doing keychain or filesystem work.
- The chosen production database path is documented in `context-agent/wiki/code-map.md` or `context-agent/wiki/testing.md` during implementation.
### Security and privacy

- Never write API tokens or other secret values to TOML, SQLite, source files, generated bindings, logs, or test output.
- Do not include secret values in `Debug` output for errors or structs.
- Treat keychain failures as recoverable command errors with safe messages.
- Use OS file permissions and the user home directory for local data, consistent with the v1 local-first posture.
- Do not add telemetry, remote error reporting, external calls, a shared service account, or app-level authentication.
### UX and design

This feature has no user-facing UI. It may enable future settings screens and connector setup flows, but no visual design spec is needed for issue #4.
Developer-facing behavior should still be clear:
- Command names map directly to the storage class.
- Errors say what failed without exposing sensitive values.
- Missing optional data returns an empty object or `null` rather than causing startup failure.
## Technical approach

Recommended Rust module layout:
```plain text
src-tauri/src/settings/
  mod.rs
  error.rs
  keys.rs
  preferences.rs
  secrets.rs
  shared.rs
```
Expected responsibilities:
- `error.rs`: shared error type with safe display strings for command results.
- `keys.rs`: shared key validation.
- `preferences.rs`: TOML file read/write helpers and production path resolution.
- `secrets.rs`: keychain-backed and in-memory secret store implementations.
- `shared.rs`: SQLite-backed shared settings helpers.
- `commands.rs` or an equivalent command module: thin Tauri command wrappers if the existing command file becomes too large.
Recommended testable helpers:
- `read_preferences_at(path) -> Result`
- `write_preferences_at(path, prefs) -> Result`
- `preferences_path() -> Result`
Recommended secret abstraction:
```rust
trait SecretStore {
    fn set(&self, key: &str, value: &str) -> Result;
    fn get(&self, key: &str) -> Result, SettingsError>;
    fn delete(&self, key: &str) -> Result;
}
```
Each command should keep the existing Tauri Specta pattern:
```rust
#[tauri::command]
#[specta::specta]
pub fn command_name(...) -> Result { ... }
```
Expected Rust dependency additions include maintained crates for config path resolution, TOML serialization, keychain access, and temporary directories in tests. Dependency choices should work on macOS Apple Silicon.
## Task decomposition

### Story A: Preferences primitive

#### Task A.1: Add preferences storage helpers

Description: Create a preferences module that reads and writes an object-shaped JSON payload as TOML at an explicit path, with production path resolution kept separate from the file helpers.
Acceptance criteria:
- Missing preferences file returns `{}`.
- Writes create the parent directory when needed.
- Writes store TOML that round-trips back to the original object-shaped JSON value.
- Non-object top-level JSON values are rejected.
- Serialization failure does not replace an existing valid file.
- Production path resolution targets the OS config directory and supports the ADR-008 macOS path `~/Library/Application Support/hm/preferences.toml`.
Dependencies: None.
#### Task A.2: Expose preferences Tauri commands and bindings

Description: Add `preferences_read` and `preferences_write` command wrappers that call the preferences helpers through managed app state or equivalent production path resolution, then regenerate Specta bindings.
Acceptance criteria:
- `preferences_read() -> Result` exists.
- `preferences_write(prefs: serde_json::Value) -> Result` exists.
- Command errors use safe, human-readable strings.
- `src/bindings.ts` includes generated wrappers for both preferences commands.
- Existing `commands.appStatus()` remains available.
Dependencies: Task A.1.
### Story B: Secret primitive

#### Task B.1: Add shared key validation

Description: Create one key validation helper for all key-based settings APIs.
Acceptance criteria:
- Keys with ASCII letters, ASCII numbers, `.`, `_`, and `-` are accepted.
- Keys from 1 to 128 characters are accepted.
- Empty keys, whitespace, path separators, control characters, non-ASCII characters, and overlong keys are rejected.
- Unit tests cover accepted and rejected examples.
Dependencies: None.
#### Task B.2: Add secret store abstraction and in-memory implementation

Description: Define a trait-backed secret store and add an in-memory implementation for unit tests and CI-safe command behavior tests.
Acceptance criteria:
- The trait supports set, get, and delete operations.
- The in-memory store supports set/get/delete/missing behavior.
- Missing secrets return `None` rather than an error.
- Error paths do not include secret values.
- Tests do not touch a real OS keychain.
Dependencies: Task B.1.
#### Task B.3: Add production keychain secret store

Description: Implement the production secret store with a maintained keychain crate and a stable service namespace.
Acceptance criteria:
- Production `secret_set` stores opaque strings in the OS keychain.
- Production `secret_get` returns stored values and maps distinguishable not-found results to `None`.
- Production `secret_delete` removes existing keys and handles missing keys as a safe no-op or clear not-found result.
- Empty secret values are either supported consistently or rejected with a clear safe error.
- The chosen service namespace is documented if it is not the final Tauri app identifier.
Dependencies: Task B.2.
#### Task B.4: Expose secret Tauri commands and bindings

Description: Add `secret_set`, `secret_get`, and `secret_delete` command wrappers that use the configured secret store and shared key validation, then regenerate Specta bindings.
Acceptance criteria:
- `secret_set(key: String, value: String) -> Result` exists.
- `secret_get(key: String) -> Result, String>` exists.
- `secret_delete(key: String) -> Result` exists.
- Command errors never include secret values.
- `src/bindings.ts` includes generated wrappers for all secret commands.
Dependencies: Tasks B.1, B.2, and B.3.
### Story C: Shared settings primitive

#### Task C.1: Add shared settings schema

Description: Extend database setup so the `shared_settings` table exists while preserving existing migrations and sqlite-vec behavior.
Acceptance criteria:
- Schema setup creates `shared_settings` with `key`, `value_json`, and `updated_at` columns.
- Existing migrations smoke table tests continue to pass.
- Existing sqlite-vec smoke tests continue to pass.
- In-memory database helpers remain available for tests.
Dependencies: Task B.1.
#### Task C.2: Add SQLite shared settings helpers

Description: Add helpers for setting and getting JSON values by key in SQLite.
Acceptance criteria:
- `shared_settings_set(key, value)` writes JSON text for a validated key.
- Repeated writes overwrite the existing key using an upsert.
- Writes refresh `updated_at`.
- `shared_settings_get(key)` returns the original JSON value for objects, arrays, strings, numbers, booleans, and null.
- Missing keys return `None`.
- Tests cover set/get/missing/overwrite behavior with in-memory SQLite.
Dependencies: Tasks B.1 and C.1.
#### Task C.3: Expose shared settings Tauri commands and bindings

Description: Add `shared_settings_get` and `shared_settings_set` command wrappers that use managed database state and regenerate Specta bindings.
Acceptance criteria:
- `shared_settings_get(key: String) -> Result, String>` exists.
- `shared_settings_set(key: String, value: serde_json::Value) -> Result` exists.
- Commands use managed Tauri state rather than global mutable state.
- Database locks are not held while doing keychain or filesystem work.
- `src/bindings.ts` includes generated wrappers for both shared settings commands.
Dependencies: Tasks C.1 and C.2.
### Story D: Documentation and validation

#### Task D.1: Document settings implementation context

Description: Update durable agent context with the settings module layout, command list, storage paths, app state pattern, and test strategy.
Acceptance criteria:
- `context-agent/wiki/code-map.md` documents the settings modules, command list, storage paths, and app state pattern.
- `context-agent/wiki/testing.md` documents the new Rust tests, the keychain test strategy, and any frontend dependency setup needed for validation.
- The production SQLite path and keychain namespace choices are recorded.
Dependencies: Tasks A.2, B.4, and C.3.
#### Task D.2: Run validation checks

Description: Run narrow checks first, then broader checks when dependencies are available.
Acceptance criteria:
- `cargo test --manifest-path src-tauri/Cargo.toml` passes.
- If `node_modules` is missing, `npm install` is run before frontend checks.
- `npm run lint` passes or any skipped check is documented with the reason.
- `npm test` passes or any skipped check is documented with the reason.
- `npm run build` passes or any skipped check is documented with the reason.
Dependencies: Tasks A.2, B.4, C.3, and D.1.
## Validation plan

Run narrow checks first:
1. `cargo test --manifest-path src-tauri/Cargo.toml`
2. `npm install` if `node_modules` is missing
3. `npm run lint`
4. `npm test`
5. `npm run build`
Add an ignored real-keychain smoke test only if it is useful to maintainers. It must not run in CI by default. Manually launch the Tauri app and call commands from a temporary debug hook only if binding generation or runtime state needs confirmation.
## Definition of done

- `preferences_read` and `preferences_write` commands exist and round-trip TOML-backed preferences.
- `secret_set`, `secret_get`, and `secret_delete` commands exist and use the OS keychain in production.
- `shared_settings_get` and `shared_settings_set` commands exist and round-trip JSON values in SQLite.
- `shared_settings` schema exists and does not break existing SQLite behavior.
- `src/bindings.ts` includes generated wrappers for all new commands.
- Rust tests cover preferences, key validation, mock secrets, and shared settings.
- Existing `app_status` behavior remains unchanged.
- Agent context documents the new module layout and testing caveats.
- No secret value is written to files, SQLite, logs, test output, or generated bindings.
## Risks and open questions

- The keychain crate may behave differently across macOS local runs and Linux CI. Use trait-backed tests and make any real keychain test opt-in.
- The production SQLite path is not yet defined in code. Choose a Tauri app data path aligned with the local-first app spec and document it.
- Generic JSON preferences are flexible but less self-documenting than a typed `Preferences` struct. This is acceptable for primitives; later preference features can introduce typed fields.
- `src/bindings.ts` currently regenerates during debug app startup. A headless binding-generation command may become useful if CI needs to detect stale IPC bindings without launching a desktop app.
- There is no `context-human/wiki/` yet. This spec relies on the app spec and accepted ADRs as the current human-facing source of truth.
## References

- GitHub issue: [#4 feat(config): settings storage primitives](https://github.com/markdstafford/hm/issues/4)
- App spec: `context-human/specs/app.md`
- ADR-002: Tauri Rust core owns database operations and exposes behavior through Tauri commands.
- ADR-004: SQLite plus sqlite-vec is the primary local store.
- ADR-006: AI provider credentials must be loaded through a provider abstraction that can use keychain-backed secrets.
- ADR-008: preferences, credentials, and shared settings must be stored in separate locations.