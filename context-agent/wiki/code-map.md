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
