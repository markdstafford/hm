# Testing guide

Last updated: 2026-05-21 (scaffold)

## Commands

| Command | What it runs |
|---------|-------------|
| `npm test` | Vitest unit + component tests in jsdom |
| `npm run lint` | TypeScript type check (`tsc --noEmit`) |
| `cd src-tauri && cargo test` | Rust unit tests |
| `npx playwright install webkit` | First-time setup: install WebKit browser executable |
| `npm run test:e2e` | Playwright e2e against Vite dev server |
| `npm run tauri dev` | Vite dev server + Tauri desktop window |

## Test locations

- `src/App.test.tsx` — component render, theme toggle, axe accessibility smoke
- `src-tauri/src/db/mod.rs` — SQLite schema, migrations table, sqlite-vec load

## Known limitations

### Tauri IPC mocking in Vitest

`@tauri-apps/api` calls require the Tauri runtime. In Vitest (jsdom), mock `./bindings`:
```typescript
vi.mock("./bindings", () => ({
  commands: { appStatus: vi.fn().mockResolvedValue({ version: "0.1.0", ready: true }) },
}));
```

### matchMedia stub in jsdom

jsdom does not implement `window.matchMedia`. The `src/test/setup.ts` includes a stub
that returns `matches: false` for all queries (defaulting tests to Latte/light theme).
Tests that need to simulate dark mode should override the stub as part of their setup.

### Playwright e2e — no Tauri desktop launch

The current Playwright config (`playwright.config.ts`) targets `http://localhost:1420`
(the Vite dev server), not a real Tauri `.app` bundle. To run e2e against the
actual desktop app, install `tauri-driver` and follow the upstream guide:
https://tauri.app/develop/tests/webdriver/

Running `npm run test:e2e` requires `npm run tauri dev` (or `npm run dev`) to be
running in a separate terminal first.

### sqlite-vec extension loading

`sqlite-vec` is loaded via `sqlite3_auto_extension` in `src-tauri/src/db/mod.rs`.
This worked on macOS Apple Silicon in the scaffold run. If loading fails in CI,
the `sqlite_vec_loads_and_reports_version` test is written to warn (not fail).
The sqlite-vec version pinned is `=0.1.9` (stable); the alpha `0.1.10-alpha.4`
had a missing bundled C file (`sqlite-vec-diskann.c`) and was unusable on macOS.

## Adding new Rust commands

1. Add command fn in `src-tauri/src/commands.rs` with `#[tauri::command]` and `#[specta::specta]`.
2. Add the command to `collect_commands![...]` in `src-tauri/src/lib.rs`.
3. Run `npm run tauri dev` once to regenerate `src/bindings.ts`.
4. Use `commands.yourCommand()` from `./bindings` in React.
