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
