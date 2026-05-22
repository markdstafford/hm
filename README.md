# hm

`hm` is a centralized interface to an engineering team's issues, repos, PRs, and roadmap. It helps EMs, PMs, and team members answer questions about roadmap health, eval trends, status updates, and issue triage from one local-first desktop app.

## Status

Early development. The application scaffold is present. Features are not yet implemented.

## Design and architecture

- Product spec: `context-human/specs/app.md`
- Architecture decisions: `context-human/adrs/`
- Agent context and code map: `context-agent/wiki/`

## Planned stack

- Tauri 2 desktop app with a Rust core and TypeScript/React UI
- Tailwind v4 design tokens (Catppuccin Latte/Macchiato, sapphire accent)
- SQLite + sqlite-vec local store

## Prerequisites

- macOS (Apple Silicon recommended)
- Node.js 22+
- Rust 1.78+ (`rustup` or Homebrew)
- Tauri system dependencies: `xcode-select --install` and Xcode from the App Store

## Development

```bash
npm install          # install frontend dependencies
npm run tauri dev    # start Vite dev server + launch the Tauri window
```

## Testing

```bash
npm test             # Vitest unit + component tests
npm run lint         # TypeScript type check
cd src-tauri && cargo test   # Rust unit tests
npx playwright install webkit   # first-time setup: install browser executables
npm run test:e2e     # Playwright e2e (requires Vite dev server running)
```

## Build

```bash
npm run build                 # build frontend only (outputs dist/)
cd src-tauri && cargo build   # build Rust core only
npm run tauri build           # full Tauri bundle (outputs src-tauri/target/release/)
```

## License

No license is declared yet. Revisit before distribution or external contribution.
