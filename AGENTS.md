# Agent instructions for hm

## Operating loop

0. Start from the ticket. Restate the requested outcome and identify the files or docs likely to matter.
1. Read the context map below before planning. Use the app spec and ADRs to understand why the current shape exists before changing it.
2. Keep human and agent context separate. Human-facing product and architecture docs live under `context-human/`; durable working notes for agents live under `context-agent/`.
3. Update `context-agent/` as you learn durable implementation context during a feature, especially decisions, code maps, gotchas, and follow-up notes that future agents should not rediscover.
4. Use micromanager for any document expected to be human-facing, including README changes, product specs, ADRs, issue writeups, plans intended for human review, and release notes.
5. Work in small, reversible steps. Prefer incremental changes that can be tested and rolled back independently.
6. Use red/green TDD for behavior changes: add or update a failing test, make it pass, then refactor while tests stay green.
7. Verify with the narrowest relevant check first, then broader checks when available. Do not invent install, run, test, or build commands before the scaffold defines them.

## Context map

- `context-human/specs/app.md` — product summary, requirements, planned stack, testing expectations, and design guidance for human review.
- `context-human/adrs/` — accepted architecture decisions. Read the relevant ADR before changing auth, desktop framework, storage, history, AI provider routing, retrieval, or settings behavior.
- `context-agent/` — durable agent-maintained context. Create it when first needed; keep it separate from human-facing docs.
- `context-agent/wiki/` — agent-maintained code maps, workflow notes, debugging notes, and implementation landmarks. Add concise pages as the codebase takes shape.
- `context-agent/wiki/code-map.md` — preferred home for the evolving code map once the app scaffold exists.
- `context-agent/wiki/testing.md` — preferred home for discovered test commands, test data notes, and red/green workflow notes once tooling exists.
- `AGENTS.md` — this shared agent runbook.
- `CLAUDE.md` — Claude Code wrapper that imports this file.
- `README.md` — concise human-facing repository landing page.

## Current repository status

- The app is in early development.
- The Tauri/React/Rust scaffold is not present yet.
- Do not invent run, test, or build commands until checked-in package or crate configuration defines them.

## Project boundaries

- Preserve the local-first, single-user v1 architecture unless a new ADR supersedes it.
- Keep source-system tokens out of files, logs, and the database. Tokens belong in the OS keychain or environment variables.
- Route AI calls through the provider abstraction described by ADR-006.

## Planned stack

- Desktop shell: Tauri with a Rust core and TypeScript/React UI.
- Styling: Tailwind v4 design tokens; no shadcn.
- Data: SQLite plus sqlite-vec.
- Testing once scaffolded: `cargo test`, Vitest + React Testing Library, Playwright, and axe-core where relevant.

## Provider notes

- Claude Code reads `CLAUDE.md`; this repo's `CLAUDE.md` imports this file.
- Gemini CLI reads `GEMINI.md` by default. If the project later supports Gemini CLI or Antigravity directly, add a thin provider-specific wrapper that imports `AGENTS.md` rather than duplicating this runbook.
