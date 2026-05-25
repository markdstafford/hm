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
