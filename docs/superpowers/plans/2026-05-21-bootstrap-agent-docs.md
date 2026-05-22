# Bootstrap Agent Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create AGENTS.md, CLAUDE.md, README.md, and a context-agent/ skeleton at the repository root so humans and AI agents have immediate orientation when they land in this repo.

**Architecture:** AGENTS.md is the canonical shared runbook for all coding agents; CLAUDE.md is a thin Claude Code wrapper that imports it via @AGENTS.md; README.md is a concise human-facing landing page; context-agent/ provides the durable-agent-notes home defined in the runbook. No application scaffold exists yet — no commands are invented before issue #2 defines them.

**Tech Stack:** Markdown only. No build tools, no test runner — acceptance is verified with shell path checks and git diff --check.

---

## File structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `AGENTS.md` | Canonical shared agent runbook: operating loop, context map, project status, boundaries, planned stack, provider notes |
| Create | `CLAUDE.md` | Claude Code entry point; imports AGENTS.md with @AGENTS.md; Claude-specific notes only |
| Create | `README.md` | Human-facing landing page: project description, status, pointers to specs/ADRs, planned stack, development placeholder, license note |
| Create | `context-agent/README.md` | Brief README explaining that this directory holds durable agent context |
| Create | `context-agent/wiki/README.md` | Brief README explaining wiki sub-directory purpose |

---

### Task 1: Create AGENTS.md

**Files:**
- Create: `AGENTS.md`

- [ ] **Step 1: Write AGENTS.md**

Create `/Users/mark.stafford/.autocatalyst/workspaces/hm/385c2204-0efa-46b2-881a-821e3e3c1ec3/AGENTS.md` with this exact content:

```markdown
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
```

- [ ] **Step 2: Verify file exists and has expected headings**

```bash
test -f AGENTS.md && grep -c "^## " AGENTS.md
```

Expected output: `6` (six second-level headings: Operating loop, Context map, Current repository status, Project boundaries, Planned stack, Provider notes)

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add AGENTS.md shared agent runbook"
```

---

### Task 2: Create CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Write CLAUDE.md**

Create `/Users/mark.stafford/.autocatalyst/workspaces/hm/385c2204-0efa-46b2-881a-821e3e3c1ec3/CLAUDE.md` with this exact content:

```markdown
# Claude Code instructions for hm

@AGENTS.md

## Claude Code notes

- Treat `AGENTS.md` as the shared source of truth for project instructions.
- Keep this file limited to Claude-specific behavior that cannot apply to other agents.
```

- [ ] **Step 2: Verify @AGENTS.md import is present**

```bash
grep -n "@AGENTS.md" CLAUDE.md
```

Expected output: `3:@AGENTS.md` (import appears on line 3, immediately after the title)

- [ ] **Step 3: Verify CLAUDE.md does not duplicate canonical sections**

```bash
grep -c "Operating loop\|Context map\|Project boundaries\|Planned stack\|Provider notes" CLAUDE.md
```

Expected output: `0` (none of the canonical section headings from AGENTS.md appear in CLAUDE.md)

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md as thin Claude Code wrapper importing AGENTS.md"
```

---

### Task 3: Create README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md**

Create `/Users/mark.stafford/.autocatalyst/workspaces/hm/385c2204-0efa-46b2-881a-821e3e3c1ec3/README.md` with this exact content:

```markdown
# hm

`hm` is a centralized interface to an engineering team's issues, repos, PRs, and roadmap. It helps EMs, PMs, and team members answer questions about roadmap health, eval trends, status updates, and issue triage from one local-first desktop app.

## Status

Early development. The application scaffold is not present yet.

## Design and architecture

- Product spec: `context-human/specs/app.md`
- Architecture decisions: `context-human/adrs/`

## Planned stack

- Tauri desktop app with a Rust core and TypeScript/React UI
- Tailwind v4 design tokens
- SQLite + sqlite-vec local store

## Development

Run, test, and build commands will be added after the app scaffold lands.

## License

No license is declared yet. Revisit before distribution or external contribution.
```

- [ ] **Step 2: Verify file is human-facing only (no agent workflow guidance)**

```bash
grep -c "operating loop\|context-agent\|micromanager\|TDD\|red/green" README.md
```

Expected output: `0` (no agent-only workflow details in the README)

- [ ] **Step 3: Verify linked paths exist**

```bash
test -f context-human/specs/app.md && echo "spec ok" && test -d context-human/adrs && echo "adrs ok"
```

Expected output:
```
spec ok
adrs ok
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README.md human-facing landing page"
```

---

### Task 4: Create context-agent/ skeleton

**Files:**
- Create: `context-agent/README.md`
- Create: `context-agent/wiki/README.md`

- [ ] **Step 1: Write context-agent/README.md**

Create `/Users/mark.stafford/.autocatalyst/workspaces/hm/385c2204-0efa-46b2-881a-821e3e3c1ec3/context-agent/README.md` with this exact content:

```markdown
# context-agent

This directory holds durable context maintained by coding agents, separate from the human-facing product and architecture docs in `context-human/`.

Add files here when you discover implementation context that future agents should not need to rediscover: decisions made, code maps, gotchas, follow-up notes, and workflow reminders.

See `wiki/` for code maps, testing notes, and implementation landmarks.
```

- [ ] **Step 2: Write context-agent/wiki/README.md**

Create `/Users/mark.stafford/.autocatalyst/workspaces/hm/385c2204-0efa-46b2-881a-821e3e3c1ec3/context-agent/wiki/README.md` with this exact content:

```markdown
# wiki

Agent-maintained pages covering code maps, testing notes, debugging notes, and implementation landmarks.

Preferred pages to add as the scaffold grows:

- `code-map.md` — evolving map of source modules, entry points, and key data flows.
- `testing.md` — discovered test commands, test data notes, and red/green workflow reminders.
```

- [ ] **Step 3: Verify skeleton**

```bash
test -f context-agent/README.md && echo "context-agent/README.md ok" && test -f context-agent/wiki/README.md && echo "context-agent/wiki/README.md ok"
```

Expected output:
```
context-agent/README.md ok
context-agent/wiki/README.md ok
```

- [ ] **Step 4: Commit**

```bash
git add context-agent/
git commit -m "docs: add context-agent/ skeleton for durable agent context"
```

---

### Task 5: Verify all acceptance criteria

**Files:** (read-only checks, no modifications)

- [ ] **Step 1: Check all root files exist**

```bash
test -f AGENTS.md && echo "AGENTS.md ok"
test -f CLAUDE.md && echo "CLAUDE.md ok"
test -f README.md && echo "README.md ok"
test -f context-agent/README.md && echo "context-agent/README.md ok"
test -f context-agent/wiki/README.md && echo "context-agent/wiki/README.md ok"
test -f context-human/specs/app.md && echo "specs/app.md ok"
test -d context-human/adrs && echo "adrs/ ok"
```

Expected: all seven lines print `ok`.

- [ ] **Step 2: Confirm CLAUDE.md imports AGENTS.md and does not duplicate it**

```bash
head -5 CLAUDE.md
```

Expected: `@AGENTS.md` appears within the first 5 lines.

```bash
grep -c "Operating loop\|Context map\|Project boundaries\|Planned stack\|Provider notes" CLAUDE.md
```

Expected: `0`

- [ ] **Step 3: Confirm AGENTS.md has the required sections**

```bash
grep "^## " AGENTS.md
```

Expected output:
```
## Operating loop
## Context map
## Current repository status
## Project boundaries
## Planned stack
## Provider notes
```

- [ ] **Step 4: Check for whitespace errors**

```bash
git diff --check HEAD
```

Expected: no output (no whitespace errors).

- [ ] **Step 5: Confirm no invented commands in any new file**

```bash
grep -rn "npm \|yarn \|cargo \|pnpm \|npx " AGENTS.md CLAUDE.md README.md context-agent/
```

Expected: no matches (no scaffold commands invented before issue #2 lands). The only allowed reference to `cargo test` is the single mention in the "Testing once scaffolded" line of AGENTS.md.

Acceptable exception — verify it is scoped to the "once scaffolded" context:
```bash
grep "cargo" AGENTS.md
```

Expected: one line containing `cargo test` within the "Testing once scaffolded:" phrase.
