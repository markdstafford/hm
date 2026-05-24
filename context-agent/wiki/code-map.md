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

## Settings UI (added 2026-05-22)

### Module layout

```
src/
  preferences.ts       AppPreferences type, ThemeMode, DEFAULT_PREFERENCES, normalizePreferences, mergePreferences, resolvedPreferences
  preferences.test.ts  Unit tests for normalize/merge helpers (pure functions, no Tauri dependency)
  theme.ts             applyTheme(mode, _prefersDark) — sets/removes data-theme on <html>; applyFonts(uiFont, monoFont) — overrides --font-sans/--font-mono CSS vars on :root
  windowState.ts       restoreWindowState(prefs), registerWindowListeners(onStateCapture) — listeners debounced 500ms; both guarded for non-Tauri environments
  settings/
    settingsTypes.ts       SettingsCategory, SettingsPanelProps
    settingsStorage.ts     loadPreferences(), savePreferences(current, patch) — wraps Tauri commands with normalize + merge logic
    SettingsPanel.tsx      Radix Dialog shell: sidebar (General category), content area, close button, Escape handler, cross-fade animation
    GeneralSettings.tsx    Radix Select controls for themeMode, uiFont, monoFont; SettingRow layout component
    SettingsPanel.test.tsx Component tests: render, open/close, controls, onUpdatePreferences calls, axe
```

### App.tsx integration

App.tsx owns `AppPreferences` state. On mount: `loadPreferences()` → `setPrefs()` → `restoreWindowState()`. Also on mount (Tauri only): `registerWindowListeners()` registers debounced move/resize handlers that call `savePreferences` and `setPrefs` — a `prefsRef` keeps the callbacks current without stale closures. On themeMode change: `applyTheme()` + media-query listener cleanup. On font change: `applyFonts()`. `updatePreferences(patch)` merges + writes via `savePreferences` + surfaces save errors in a timed alert. SettingsPanel receives `prefs` and `onUpdatePreferences` as props.

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
| `jira.rs` | `JiraConnectionTestResult`, `JiraConnectionTestStatus`, `JiraConnectionErrorCategory`, `JiraConnectionProject`; `jira_source_test_connection_with_store` adapter (returns `Unavailable` until issue #9); `JiraProjectClient` trait seam; `map_client_error` for safe error mapping |

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

**UI** (`src/settings/sources/`): `SourcesSettings.tsx`, `SourceList.tsx`, `AddSourceFlow.tsx`, `JiraSourceForm.tsx`, `ConnectionTestStatus.tsx`, `ProjectMultiSelect.tsx`

**Settings wiring**: `settingsTypes.ts` includes `"sources"`; `SettingsPanel.tsx` inserts Sources between Appearance and AI providers.

### Security policy for sources

- Jira PATs live only in transient React state and OS keychain
- SQLite stores only credential refs (`source.jira.<id>.pat`), never PAT values
- `source_config_remove` deletes the owned keychain credential when a source is removed
- `jira_source_test_connection` command has no DB state parameter to prevent lock contention during future network calls

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

### Settings UI layout

```
src/aiProviders/
  types.ts              domain type aliases from generated bindings
  defaults.ts           EMPTY_AI_PROVIDER_CONFIG, RUNNER_LABELS, EMPTY_STATES
  validation.ts         validateAiProviderConfig() — client-side validation mirrors Rust rules
  storage.ts            async command wrappers with Tauri env guard

src/settings/
  AiProvidersSettings.tsx      container: loads config, auto-saves on each change
  aiProviders/
    CredentialsSection.tsx     credentials CRUD + keychain secret set (secret never enters config)
    EndpointsSection.tsx       endpoint CRUD with credential picker
    ProfilesSection.tsx        profile CRUD + per-row smoke test with NotRun/Running/Success/Error states
    RoutingSection.tsx         task-to-profile routing CRUD with dotted-name validation
```
