# Code map

Last updated: 2026-05-21 (scaffold)

## Source tree

```
src/                    React + TypeScript frontend
  main.tsx              ReactDOM entry point
  App.tsx               Root component — hello hm view, theme toggle
  App.test.tsx          Vitest component tests + axe accessibility
  styles.css            Tailwind v4 @import + Catppuccin @theme{} tokens
  bindings.ts           Generated TypeScript types for Tauri IPC commands
  test/setup.ts         Vitest global setup (jest-dom, jest-axe matchers, matchMedia stub)

src-tauri/              Tauri 2 Rust core
  src/main.rs           Entry point — calls hm_lib::run()
  src/lib.rs            App setup: specta builder, tauri::Builder, run()
  src/commands.rs       Tauri IPC command handlers (app_status)
  src/db/mod.rs         SQLite open, schema setup, sqlite-vec loader

e2e/                    Playwright end-to-end tests
  hello.spec.ts         Smoke: heading visible, theme toggle present

.github/workflows/
  ci.yml                PR checks: Rust (check/test/clippy) + frontend (lint/test/build)
```

## Key entry points

- `npm run tauri dev` → starts Vite on :1420 and opens the Tauri window
- `lib.rs::run()` → configures specta builder, registers commands, starts Tauri
- `src/bindings.ts` → TypeScript types generated from Rust; regenerated on each debug run

## IPC pattern

Rust commands are decorated with `#[tauri::command]` and `#[specta::specta]`.
The `tauri_specta::Builder` in `lib.rs` collects them and emits `src/bindings.ts`
at debug startup. Use `commands.*` from `./bindings` in React components.

## Theme system

Catppuccin CSS vars are set on `:root` (Latte default) and overridden by
`data-theme="macchiato"` for dark mode. The `@theme {}` block in `styles.css`
maps semantic token names (`--color-background`, `--color-primary`, etc.) to
the active Catppuccin vars. Tailwind utilities like `bg-background`, `text-text`,
and `text-primary` consume these tokens.

## Notable deviations from spec during scaffold

- `sqlite-vec = "=0.1.9"` (not alpha.4 — alpha had a macOS build bug)
- Vite 8 uses `minify: "oxc"` (bundled esbuild removed in Vite 8)
- `src/vite-env.d.ts` added (standard Vite + TypeScript boilerplate)
- `tsconfig.node.json` uses `composite: true` (required by TS project references)
- `tauri.conf.json` `"csp": null` — intentional for development, must be addressed before distribution
- `src-tauri/icons/icon.png` — placeholder, must be replaced with real icons before distribution

## Settings module (added 2026-05-22)

### Module layout

```
src-tauri/src/settings/
  mod.rs             re-exports all sub-modules
  error.rs           SettingsError enum — safe Display strings for all storage failures
  keys.rs            validate_key() — shared validation for all key-based APIs
  preferences.rs     read_preferences_at(path), write_preferences_at(path, prefs), preferences_path()
  secrets.rs         SecretStore trait, InMemorySecretStore, KeychainSecretStore, ManagedSecretStore
  shared.rs          shared_settings_get(conn, key), shared_settings_set(conn, key, value)
```

### Command list

| Rust fn               | TypeScript binding        | Storage           |
|-----------------------|---------------------------|-------------------|
| `app_status`          | `appStatus`               | none              |
| `preferences_read`    | `preferencesRead`         | TOML file         |
| `preferences_write`   | `preferencesWrite`        | TOML file         |
| `secret_set`          | `secretSet`               | OS keychain       |
| `secret_get`          | `secretGet`               | OS keychain       |
| `secret_delete`       | `secretDelete`            | OS keychain       |
| `shared_settings_get` | `sharedSettingsGet`       | SQLite            |
| `shared_settings_set` | `sharedSettingsSet`       | SQLite            |

### Storage paths (macOS)

| Storage class      | Path                                                        |
|--------------------|-------------------------------------------------------------|
| Preferences        | `~/Library/Application Support/hm/preferences.toml`        |
| Keychain namespace | service = `"hm"`, account = the validated key string        |
| SQLite database    | `~/Library/Application Support/hm/hm.db`                   |

The SQLite path uses `app.path().app_data_dir()` (Tauri 2 managed path). On macOS this resolves to `~/Library/Application Support/hm/`. The keychain namespace `"hm"` is a placeholder; it should be updated to the final Tauri bundle identifier before distribution.

### App state pattern

Two pieces of managed Tauri state are registered in `lib.rs::run()`:

- `Mutex<rusqlite::Connection>` — holds the open SQLite connection. Lock, use, and release immediately; never hold the lock while doing keychain or filesystem work.
- `ManagedSecretStore(Arc<dyn SecretStore + Send + Sync>)` — wraps the production `KeychainSecretStore`. Commands receive this via `tauri::State<'_, ManagedSecretStore>`.

### specta JsonValue workaround

`serde_json::Value`'s `specta::Type` implementation in specta rc.25 is infinitely recursive at binding-generation time. Commands use a `JsonValue` newtype (in `commands.rs`) that wraps `serde_json::Value` with transparent serde and emits TypeScript `unknown` via `specta_typescript::define`. This is safe to remove if a future specta version fixes the recursion.

### Security notes

- Secret values are never stored in TOML, SQLite, source files, generated bindings, logs, or test output.
- `SettingsError::Keychain` and `SettingsError::Database` Display implementations intentionally omit internal details.
- `KeychainSecretStore` error messages never include the key value or secret value.

## Settings UI (added 2026-05-22, refactored 2026-05-24 in PR #30)

Settings is a page-mode feature mounted inside the standard `AppShell` (see `context-agent/design-system.md` → "Settings UI patterns" for the canonical contract). The legacy Radix Dialog `SettingsPanel` was removed in PR #30.

### Module layout

```
src/
  preferences/
    index.ts             AppPreferences types, DEFAULT_PREFERENCES, normalize/merge/resolve helpers
    index.test.ts        Unit tests for normalize/merge (pure, no Tauri)
    storage.ts           loadPreferences(), savePreferences(current, patch) — wraps Tauri commands with normalize + merge
  theme.ts               applyColorScheme(), applyFonts() — paint theme + font CSS vars on <html>/:root
  windowState.ts         restoreWindowState(prefs), registerWindowListeners(onStateCapture) — debounced 500ms; non-Tauri-guarded
  features/settings/
    categories.ts                SettingsCategory union + SETTINGS_CATEGORIES metadata + getCategoryLabel
    SettingsSidebar.tsx          NavSection of category NavItems (active = current)
    SettingsPage.tsx             Composes the main pane: dispatches on active category; also exports <SettingsBreadcrumb>
    general/GeneralCategory.tsx        SettingRow + Select for uiFont, monoFont
    appearance/AppearanceCategory.tsx  SettingRow + Select for themeMode / lightTheme / darkTheme / Catppuccin accent
    sources/                            Ported from old src/settings/sources — uses Card + Form primitives
      SourcesCategory.tsx              List + Add flow + JiraSourceForm dispatcher
      SourceList.tsx                   Card-per-row list with AlertDialog confirmation on remove
      AddSourceFlow.tsx                Card-tile picker (Jira active; GitHub/Documents "coming later")
      JiraSourceForm.tsx               Form-primitive wrapped; preserves the existing save/test logic
      ConnectionTestStatus.tsx, ProjectMultiSelect.tsx — unchanged from pre-refactor
    ai-providers/                       New profile-centric flow (replaces 4-section editor)
      AiProvidersCategory.tsx          Orchestrator: load/save, smoke-state, list/form/yaml view switch, remove AlertDialog
      ProfileList.tsx                  Card-per-profile rows with effort pill, routing badges, smoke status, row actions
      ProfileForm.tsx                  Unified add/edit form with cascade-rename warning and routing checkboxes
      YamlAdvancedView.tsx             Textarea editor that round-trips against autocatalyst.yaml ai: section
```

### App.tsx integration

App.tsx owns `AppPreferences` state plus `settingsPage: SettingsCategory | null`. The settings cog flips `settingsPage` to `"general"`; the close-X (rendered via `<IconButton>`) returns to `null`. When `inSettings`, the AppShell's sidebar renders `<SettingsSidebar>`; the main title-bar starts with `<SettingsBreadcrumb>` and ends with the close-X. `updatePreferences(patch)` merges + writes via `savePreferences` and surfaces save errors in a timed alert. AI providers and Sources own their own data loading inside their category components.

### Window state caveats

- `restoreWindowState` and `registerWindowListeners` use dynamic `import("@tauri-apps/api/window")` so they tree-shake cleanly in non-Tauri builds.
- Window state is captured automatically on Tauri `onMoved` and `onResized` events, debounced 500ms. Listeners are registered in a `useEffect` on App mount and cleaned up on unmount.
- `prefsRef` in App.tsx keeps an always-current copy of `prefs` for the window listener callback, avoiding stale-closure issues with debounced async writes.
- Saved positions outside [-2000, 10000] in either axis are ignored to prevent off-screen windows.

## Source configuration (added 2026-05-24, issue #8)

- **Shared setting key**: `sources.config`
- **Credential-ref format**: `source.jira.<source_id>.pat`

### Rust modules (`src-tauri/src/sources/`)

| File | Responsibility |
|------|----------------|
| `mod.rs` | Re-exports `config`, `credentials`, `errors`, `jira` |
| `errors.rs` | `SourceError` enum with redacting `Display`; `is_secret_shaped()` and `redact()` helpers shared by config and credentials |
| `config.rs` | Versioned source config schema (`SourcesConfig`, `SourceConfig::Jira`, `JiraSourceConfig`, `JiraAuthConfig`, `JiraProjectFilter`, `ConnectionTestSummary`, `ConnectionTestStatus`); URL normalization; secret-shaped metadata rejection; `load_sources_config` / `save_sources_config` over shared settings |
| `credentials.rs` | `SourceCredentialKind`; deterministic ref builder; `set_source_credential_secret` / `load_source_credential_secret` / `delete_source_credential` over `SecretStore` trait; `remove_source_config_and_credentials` deletion helper |
| `jira.rs` | `JiraConnectionTestResult`, `JiraConnectionTestStatus`, `JiraConnectionErrorCategory`, `JiraConnectionProject`; `jira_source_test_connection_with_store` adapter — resolves PAT, calls `RealJiraProjectClient`, deduplicates/sorts projects, maps errors via `map_client_error`; `JiraProjectClient` trait seam for test injection |

### Tauri commands

| Command | Notes |
|---------|-------|
| `source_config_get` | Reads `sources.config` from SQLite; empty default if absent |
| `source_config_save` | Validates and writes to SQLite |
| `source_config_remove` | Saves updated SQLite config first, then deletes keychain credential (best-effort; not cross-store atomic) |
| `source_credential_secret_set` | Stores PAT in keychain; returns credential_ref |
| `source_credential_delete` | Removes keychain entry; missing = no-op |
| `jira_source_test_connection` | Does NOT take DB state — no lock held during keychain/future network calls |

All commands appear in both `collect_commands!` invocations in `src-tauri/src/lib.rs`.

### React modules

**Data layer** (`src/sources/`): `types.ts`, `defaults.ts`, `validation.ts`, `storage.ts`

**UI** (`src/features/settings/sources/`): `SourcesCategory.tsx`, `SourceList.tsx`, `AddSourceFlow.tsx`, `JiraSourceForm.tsx`, `ConnectionTestStatus.tsx`, `ProjectMultiSelect.tsx`. The JiraSourceForm uses the `<Form>` compound primitive; the source rows use `<Card>` with an `<AlertDialog>` for destructive confirm.

**Settings wiring**: `src/features/settings/categories.ts` declares the `"sources"` id; `SettingsPage.tsx` dispatches it to `SourcesCategory`. Sidebar order is General → Appearance → Sources → AI providers.

### Security policy for sources

- Jira PATs live only in transient React state and OS keychain
- SQLite stores only credential refs (`source.jira.<id>.pat`), never PAT values
- `source_config_remove` deletes the owned keychain credential when a source is removed
- `jira_source_test_connection` command has no DB state parameter to prevent lock contention during future network calls

## Jira API client (added 2026-05-24, issue #9)

- `src-tauri/src/sources/jira_client.rs` — Reusable blocking Jira Data Center REST client. Normalizes server URLs, holds PATs in a `SecretString` redacting wrapper, sends bearer-authenticated `ureq` GET requests with bounded retry/rate-limit logic, and exposes page-level and all-pages helpers for issue fetch, JQL search, and changelog pagination. All calls are synchronous (blocking) to keep the architecture simple until a background sync scheduler is added.
  - Public methods: `new`, `new_with_sleeper`, `get_issue_with_changelog`, `search_issues_page`, `search_issues_all`, `get_issue_changelog_page`, `get_issue_changelog_all`, `list_projects`
  - `Sleeper` trait injected for tests — use `RecordingSleeper` in tests to assert retry delays without real waits.
  - `MAX_PAGINATION_PAGES = 200` caps all-pages helpers against infinite loops.
- `src-tauri/src/sources/jira_types.rs` — Typed serde structs for Jira Data Center 10.3 response fields: `JiraIssue`, `JiraIssueFields`, `JiraSearchPage`, `JiraChangelogPage`, `JiraChangelogEntry`, `JiraChangelogItem`, `JiraProject`, `JiraUser`, `JiraNamedValue`. All Jira user identity fields are optional (they vary by DC version and config). Unknown fields are ignored.
- `src-tauri/src/sources/jira_errors.rs` — Safe public error enum `JiraApiError`. Maps HTTP/network/decode failures to redacted categories. `Display` never includes PATs, auth headers, raw bodies, or upstream stack traces.
- `src-tauri/src/sources/jira.rs` — Source-settings adapter. Resolves pending or saved PAT, calls `RealJiraProjectClient` (wraps `JiraApiClient::list_projects`), deduplicates and sorts projects by key, and maps `JiraApiError` → `JiraClientError` → `JiraConnectionErrorCategory` for the UI. The `JiraProjectClient` trait seam allows injecting a fake client in Rust tests.

## Jira issue ingestion (added 2026-05-25, issue #10)

End-to-end baseline that ingests Jira issues for the projects configured on a source, projects them into shared work-data tables, persists Jira-specific raw fields, and reports progress through `ingestion_runs` / `ingestion_cursors`. v1 is local-only and single-user; there is no daily snapshot or event capture in this feature (issue #11 owns those) and no embeddings yet (issue #12 owns those).

### Module map

| File | Responsibility |
|------|----------------|
| `src-tauri/src/issues/mod.rs` | Re-exports submodules |
| `src-tauri/src/issues/schema.rs` | Schema DDL for `source_systems`, `ingestion_runs`, `ingestion_cursors`, `people`/`source_identities`/`identity_links`, `work_items`/`work_item_terms`/`work_item_relationships`/`work_item_comments`, `jira_*` tables, and `indexable_documents`; column-presence assertions for migrations |
| `src-tauri/src/issues/ids.rs` | Stable id helpers for `work_items` and related rows; uses FNV-1a (64-bit) — algorithm and constants are byte-stable across Rust releases, so persisted ids and content hashes remain valid after upgrades. Test-vector locks in `mod tests` enforce that. |
| `src-tauri/src/issues/people.rs` | People/source-identity/identity-link upserts and lookups |
| `src-tauri/src/issues/repository.rs` | Cross-cutting upserts: `source_systems`, work-data rows, comment/worklog projection helpers |
| `src-tauri/src/ingestion/mod.rs` | Re-exports submodules |
| `src-tauri/src/ingestion/db.rs` | `DbAccess` trait + `MutexDbAccess` wiring. Ingestion services call `db.with_conn(\|conn\| ...)` to take the SQLite mutex only for short write batches, releasing it across every HTTP call. |
| `src-tauri/src/ingestion/errors.rs` | `IngestionError` + `IngestionErrorCategory`; redacting `Display` and `From` impls for rusqlite/Jira errors |
| `src-tauri/src/ingestion/runs.rs` | `start_run` / `finish_run` / `update_progress`; cursor read/upsert helpers |
| `src-tauri/src/ingestion/indexable.rs` | `indexable_documents` upserts (status starts as `pending`) |
| `src-tauri/src/sources/jira_ingestion.rs` | `JiraIssueIngestionService` orchestrates per-project pagination, projection, comments/worklogs/remote-link tail fetches, cancellation, and run summaries; ships AMP field-mapping seeds and a `FakeJiraClient` for tests |

### Work-data table families

- `source_systems` — one row per configured source (jira/server/cloud), referenced by every `ingestion_*` row.
- `ingestion_runs` / `ingestion_cursors` — run lifecycle + per-project cursors. All TEXT, no secrets.
- `people` / `source_identities` / `identity_links` — identity graph; populated lazily from issue assignees/reporters/comment authors.
- `work_items` / `work_item_terms` / `work_item_relationships` / `work_item_comments` — source-agnostic representation of an issue (stable ids, hashes, current-state columns; ready for future event/snapshot capture). `work_items.source_kind` carries the **work-item** kind (`"jira_issue"`, future `"github_issue"`, `"github_pr"`), NOT the source-system kind. `source_identities.source_kind` carries the **source-system** kind (`"jira"`, `"github"`, `"slack"`). Mixing these silently hides ingested rows from list/filter SQL.
- `jira_issues` / `jira_field_definitions` / `jira_project_field_mappings` / `jira_issue_field_values` / `jira_worklogs` / `jira_remote_links` — Jira-specific projections, including `raw_issue_json` and `raw_fields_json` for forward-compat replay.
- `indexable_documents` — one row per issue (and one per comment); `embedding_status = 'pending'` until issue #12 lands.

### Cursor key conventions

| Cursor key | Used by |
|------------|---------|
| `project:<KEY>:issues` | Primary issue pagination cursor (always written) |
| `project:<KEY>:comments-tail` | Reserved for tail-pull deltas; not written in #10 |
| `project:<KEY>:worklogs-tail` | Reserved for tail-pull deltas; not written in #10 |
| `project:<KEY>:remotelinks` | Written when `JiraIngestionOptions::fetch_remote_links == true` |

### Tauri commands

| Command | Notes |
|---------|-------|
| `jira_issue_ingestion_run` | Runs ingestion for the configured projects of a source. Accepts optional `JiraIngestionRunOptions { fetch_remote_links }` to opt into the remote-links sub-resource. The service releases the SQLite mutex between HTTP fetches via `DbAccess`, so `_status` / `_cancel` work mid-run. |
| `jira_issue_ingestion_cancel` | Sets the in-flight cancellation flag for the source; safe to call when no run is active. |
| `jira_issue_ingestion_status` | Returns the latest run row (status, started/finished, error summary). |
| `jira_issue_ingestion_progress` | Returns `progress_json` for live UI updates. |
| `jira_issues_list` | Returns a paginated list of projected issues for a project (read-only). |

`ActiveIngestionRuns` Tauri state holds `Arc<CancellationFlag>` instances keyed by `source_id` so the cancel command can signal an in-flight run.

### Reminders for future agents

- Issue #10 has **no dedicated viewer**. The only UI is the Settings → Sources row status text plus Run/Cancel buttons.
- No event capture or daily snapshots in this feature — issue #11 owns those. The schema is already event/snapshot-ready: stable `work_item` ids, hash columns, and current-state columns.
- Embeddings are not produced here. `indexable_documents.embedding_status` is always `pending` after ingestion; issue #12 owns the embedding job.
- PATs live only in the OS keychain. SQLite, generated bindings, logs, and run summaries never contain a PAT, an `Authorization` header, or a `Bearer ` token. Redaction is enforced by `IngestionError` Display and by `redaction_*` tests under `sources::jira_ingestion::tests`.
- `jira_issue_ingestion_run` releases the SQLite mutex between HTTP fetches via the `DbAccess` trait in `src-tauri/src/ingestion/db.rs`. Production code wires `MutexDbAccess(&state)`; tests typically use a `BorrowedConnDbAccess` over a single owned connection. The lock is held only during short write batches (page projection, tail-batch persistence, cursor / finish_run updates) — never across a Jira HTTP call. The regression test `status_read_proceeds_while_search_page_is_blocked` locks this invariant in place.
- The page-loop body in `ingest_project` runs inside an IIFE that returns `Result<(), IngestionError>`. Every error path — search HTTP failure, projection storage error, tail persist storage error, progress update failure — falls through to a single finalize block that calls `finish_run("partial", …)` with a freshly-captured `now_utc_rfc3339()`. This guarantees the `ingestion_runs` row never stays stuck at `status='running'` after a storage hiccup. Per-page projection is wrapped in `conn.unchecked_transaction()` so a mid-page failure rolls back the entire page; tail persists (comments / worklogs / remote-links) remain autocommit because each helper uses `ON CONFLICT` upserts that are safe to retry. The success-path `finish_run` also captures a fresh `now_utc_rfc3339()` so `finished_at > started_at` reflects elapsed time. The seed-AMP-mappings failure path uses the same fresh-timestamp treatment.
- UI does not yet expose `fetch_remote_links` opt-in; the `jira_issue_ingestion_run` command parameter and the `runJiraIssueIngestion` storage wrapper accept it for tests and future UI work. The earlier misleading "Optional sub-resources are opt-in via the run options." note on source rows was removed because there is no surface to flip the toggle from Settings yet.

---

## Collection named views (added 2026-05-26, issue #38)

- `src-tauri/src/collections/views.rs` owns SQLite persistence for `collection_views` and the per-entity `collection_view_seed_state` marker.
- `src-tauri/src/commands.rs` exposes collection view IPC commands; `src/bindings.ts` is generated by `cd src-tauri && cargo test generate_typescript_bindings`.
- `src/views/collection/views/types.ts` contains the camelCase UI shape and binding mappers.
- `src/views/collection/views/seed.ts` contains default seeding, active-view fallback, duplicate-name, and preference patch helpers.
- `src/views/collection/ViewChips.tsx`, `ChipContextMenu.tsx`, and `CollectionHeader.tsx` render the generic named-view header.
- `src/features/collection-viewer/CollectionViewerPage.tsx` wires Jira issue defaults, active-view preferences, and CRUD handlers while the issue #38 config blob remains opaque.

---

## AI provider configuration module (added 2026-05-24)

- Shared setting key: `ai.providers.config` stores versioned non-secret provider config only.
- Keychain account format: `ai.credentials.<credential-name>` for AI keychain-backed credentials.
- Rust module: `src-tauri/src/ai/` contains config validation, safe errors, credential loading, resolver, service API, and direct runners.
- Tauri commands: `ai_provider_config_get`, `ai_provider_config_save`, `ai_credential_secret_set`, `ai_credential_secret_delete`, `ai_profile_smoke_test`.
- Internal API: future features call `ai::service::ai_call(conn, secret_store, task_name, request)` and do not inspect storage details.
- Naming: `runner` names wire/request behavior; `execution_mode` names how hm executes the call. This feature implements `DirectApi`; future agent modes should add new execution modes without renaming direct runners.

### AI module layout

```
src-tauri/src/ai/
  mod.rs                module re-exports
  config.rs             AiProviderConfig schema, validation, load/save helpers
  errors.rs             AiError enum, safe Display, redact() helper
  credentials.rs        SecretValue (Debug-redacting), LoadedCredentialSecret, keychain/env secret loading
  resolver.rs           ResolvedAiProvider, resolve_for_task, resolve_for_profile
  service.rs            AiRequest, AiResponse, AiUsage, SmokeTestResult, ai_call, smoke_test_profile
  runners/mod.rs        AiRunnerClient trait, DirectApiRunner dispatcher
  runners/anthropic_messages.rs     AnthropicMessages direct API runner
  runners/openai_chat_completions.rs OpenAI-compatible Chat Completions direct API runner
```

### Settings UI layout (refactored 2026-05-24 in PR #30)

```
src/aiProviders/
  types.ts              domain type aliases from generated bindings
  defaults.ts           EMPTY_AI_PROVIDER_CONFIG, RUNNER_LABELS, EMPTY_STATES
  validation.ts         validateAiProviderConfig() — checks duplicates, ref integrity, secret-shaped settings keys, supported combos
  storage.ts            async command wrappers with Tauri env guard
  yaml/
    serialize.ts        configToYaml() — emits the autocatalyst.yaml-style ai: section shape with ${KEYCHAIN:…} / ${ENV_VAR} sigils
    parse.ts            yamlToConfig() — accepts both unwrapped and ai:-wrapped roots; refuses plaintext secrets, empty configs, secret-shaped settings keys; runs validateAiProviderConfig at the end

src/features/settings/ai-providers/
  AiProvidersCategory.tsx   orchestrator: list/form/yaml view switch, transactional secret + config save, AlertDialog on remove
  ProfileList.tsx           Card-per-profile rows with effort pill, routing badges, smoke status, Edit/Test/Remove IconButtons
  ProfileForm.tsx           unified add/edit form. Bundles credential + endpoint + profile + routing in one Form. Emits a ProfileFormSavePayload with optional pendingSecret so the orchestrator can persist secrets transactionally; preserves unknown profile.settings keys (_yaml_runner, thinking, beta header filters) across form-edit.
  YamlAdvancedView.tsx      textarea editor that round-trips through serialize/parse with cross-reference validation on Apply
```

The legacy four-section editor (`CredentialsSection` / `EndpointsSection` / `ProfilesSection` / `RoutingSection` under `src/settings/aiProviders/`) was deleted in PR #30. Schema notes on the runner-flavor distinction (`anthropic_direct` vs `claude_agent_sdk`) — the binding's `AiRunner` enum only distinguishes anthropic/openai families; the YAML view preserves the original runner spelling via `profile.settings._yaml_runner` for lossless round-trip.

---

## Hygiene suggestion entity (added 2026-05-28, issue #47)

- `src/entities/hygiene-suggestion/` defines the read-side collection entity for duplicate, stale, and enrichment suggestions.
- `src/features/backlog-hygiene/data.ts` is the fixture-backed seam to replace with producer/store output from future duplicate, stale, and enrichment engines.
- `src/features/collection-viewer/useEntityCollectionViewer.tsx` is the generic collection binding used by Jira issues and backlog hygiene; entity-specific wrappers provide load state and copy.

---

## Embedding pipeline (added 2026-05-29, issue #12)

- `src-tauri/src/embeddings/errors.rs` defines safe embedding error categories. Display strings are redacted and must not include provider secrets, Authorization headers, raw provider bodies, or full document text.
- `src-tauri/src/embeddings/provider.rs` defines `EmbeddingProvider`, embedding request/response DTOs, deterministic fake vectors for tests, and the ADR-006-backed `AiEmbeddingProvider` for `embedding.default`.
- `src-tauri/src/ai/runners/openai_embeddings.rs` implements OpenAI-compatible `/embeddings` for profiles using `AiEndpointProtocol::OpenAiEmbeddingsCompatible` and `AiRunner::OpenAiEmbeddings`.
- `src-tauri/src/embeddings/repository.rs` owns queue claiming from `indexable_documents`, model metadata in `embedding_models`, vector metadata in `document_embeddings`, and retry metadata in `embedding_failures`.
- `src-tauri/src/embeddings/sqlite_vec.rs` isolates sqlite-vec virtual table creation and nearest-neighbor SQL.
- `src-tauri/src/embeddings/service.rs` owns refresh summaries, status summaries, and source-neutral candidate generation. It returns vector candidates only; issue #13 owns duplicate scoring and structural reranking.
- Route name: `embedding.default` resolves through the same credentials/endpoints/profiles/routing config as chat tasks. Chat-only profiles routed to `embedding.default` are rejected as unsupported.
- Tauri commands: `embedding_refresh_run`, `embedding_status`, `embedding_nearest_neighbors`.

---

### Grove embedding refresh path

- `src-tauri/src/ai/runners/openai_embeddings.rs` sends OpenAI-compatible `/embeddings` requests with `Authorization`, `api-key`, and `x-api-key` headers for Grove APIM compatibility.
- `src-tauri/src/embeddings/limits.rs` owns embedding request limits: 96 inputs per request by default, estimated-token splitting, maximum batches per run, and a minimum 60 second rate-limit backoff.
- `src-tauri/src/embeddings/service.rs` owns refresh batching and checkpointing. Provider calls happen outside the SQLite mutex; writes and failure records happen under short DB locks.
- `embedding.default` must route to a profile with `runner: OpenAiEmbeddings` and model `embed-v-4-0` for the Grove example.

---

## Jira issue history (added 2026-05-28, issue #11)

- `src-tauri/src/issues/history.rs` — issue event/snapshot repository helpers, retention config load/save (`IssueHistoryRetentionConfig`, key `"issue_history.retention"`), snapshot job lifecycle, `coarse_state` helper, `IssueHistoryError` safe error type.
- `src-tauri/src/issues/snapshots.rs` — pure `fold_events_to_day_end` + `apply_event` (14 typed event types), `generate_snapshots_for_range`, `replay_missing_snapshots` (cursor key: `"project.{KEY}.snapshots"` — dots not colons), `compact_snapshot_retention`.
- `src-tauri/src/sources/jira_history.rs` — pure `project_changelog_entry` maps `JiraChangelogEntry` to `Vec<IssueEventInput>`; `event_type_for_field`; `pub(crate) resolve_actor_identity`.
- Ingestion: after each issue projection, changelog tail loop (guarded by `options.fetch_changelog`, default `true`) fetches pages outside DB lock, writes inside `db.with_conn`. After project sync, replay then compaction run (soft errors).
- New schema tables: `issue_events`, `issue_snapshots`, `issue_snapshot_jobs`.
- New commands: `jira_issue_status_timeline`, `issue_snapshots_query`, `issue_history_retention_get`, `issue_history_retention_save`.
- React: `src/entities/jira-issue/history.ts` — `loadJiraIssueStatusHistory` with `typedError` unwrap + browser fallback. `src/entities/jira-issue/detail.tsx` — Status history section, keyed on `work_item_id`, loading/error/empty/partial/success states.

---

## Jira issue preview content (added 2026-05-31, issue #80)

- React/Rust preview content: `src-tauri/src/commands.rs::jira_issue_preview_content` loads Jira issue body plus local `work_item_comments` for one selected `work_item_id` without remote Jira calls; `src/entities/jira-issue/previewContent.ts` maps generated snake_case DTOs to generic preview-region props; `src/views/collection/preview/PreviewDescription.tsx` and `PreviewComments.tsx` render the reusable clamped description and newest-first recent comments regions used by `src/entities/jira-issue/detail.tsx`.

---

## Gardener producer foundation (added 2026-05-30, issue #69)

- `src-tauri/src/gardener/` owns producer-side hygiene suggestion infrastructure.
- `schema.rs` creates `gardener_suggestions` (derived/cache), `gardener_suppressions` (local truth), and `gardener_watermarks` (derived cursor/progress).
- `repository.rs` owns lifecycle transitions, idempotent supersede, pending-list reads, suppression, watermarks, and target lookup by stable source identity.
- `contract.rs` / `engine.rs` define the declarative engine contract and `GardenerEngine` trait. Add future duplicate/stale/enrichment engines by registering a new engine; do not add engine-specific branches to `runner.rs`.
- `runner.rs` owns trigger dispatch, per-engine single-flight, dependency/policy gates, pipeline walking, suppression consult, failure isolation, and watermark advancement.
- `reference.rs` is a no-dependency deterministic reference engine. It emits honest reference output for an existing local Jira work item only; it does not create fake AMP rows.
- `commands.rs` exposes `hygiene_suggestions_list`, `gardener_run_on_demand`, and `gardener_record_suppression`.
- `src/features/backlog-hygiene/data.ts` is now command-backed; fixtures remain only for tests.

---

## Collection drill-through navigation

- `src/views/collection/navigation/types.ts` defines the generic read-side edge contract used by collection previews. Same-entity single-target edges focus-drill; set edges re-root the collection; dangling edges stay visible and disabled.
- `src/views/collection/navigation/focusTrail.ts` owns pure breadcrumb trail operations. Loops are preserved, so paths such as `A › B › A` are valid graph exploration history.
- `src/views/collection/navigation/rerootStack.ts` owns pure scoped-root push/return behavior for set-edge drill-through.
- `src/views/collection/preview/PreviewBreadcrumb.tsx` renders preview focus crumbs for side, bottom, and full-page preview hosts.
- `src/views/collection/preview/PreviewConnections.tsx` renders connection rows using `LINK_KIND_META` and `SecondaryHighlightChip`; entity details pass callbacks through `EntityDetailProps`.
- `src/features/collection-viewer/useEntityCollectionViewer.tsx` owns focus trail and active root state so entity details stay presentation-focused.
- `src/entities/jira-issue/connections.ts` is the first entity resolver. It does not invent production Jira relationships; tests may supply explicit fixture edges through a test-only `__hmFixtureEdges` property.
