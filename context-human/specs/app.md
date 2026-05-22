---
created: 2026-05-20
last_updated: 2026-05-21
---

# hm

## What

`hm` (short for Huginn & Muninn) is a centralized interface to an eng team's issues, repos, PRs, and roadmap. EMs, PMs, and team members use it to answer questions like: whether the roadmap is on track, how eval scores are trending, what's worth flagging in this week's status update, and where issue volume is rising or falling.

The first version of `hm` covers three capabilities. A chat interface for asking questions in plain English. A visual layer that shows how roadmap items, issues, code, and people connect. And issue triage — creating, updating, and grouping issues in batch. A PM asks how eval scores are trending, an EM opens a roadmap-drift map, and a team lead asks `hm` to merge three duplicate issues — all from one tool.

`hm` starts small and internal, with a first deployment scoped to a single eng team. The goal is to put engineering insight in the hands of the whole team, not concentrate it in a leadership dashboard.

## Why

Engineering teams need to move fast and have access to complete data. Today, that data sits in separate systems, so cross-cutting questions either go unanswered or get answered with what was easy to find. With `hm`, getting a complete answer no longer depends on having time or the right relationships — decisions get made on current data, and people answer their own questions instead of waiting for someone else's summary.

## Personas

- **Elena: EM** — manages a team of 6–10 engineers. Owns headcount allocation, quarterly planning, weekly status reporting, and the team's commitments back to product. Wants to spend fewer hours compiling state from Jira tabs and Slack threads.
- **Priya: PM** — owns the product roadmap for the area Elena's team works on. Tracks whether commitments are on track, surfaces risk to leadership, and reconciles what shipped vs. what was promised. Needs to know about slippage before the demo, not after.
- **Tarek: Team member** — an IC engineer, often newly added to an unfamiliar area of the codebase. Needs to figure out who owns what, why a system looks the way it does, and where his work fits the broader plan. Doesn't have time to build that picture by reading every tab.

## Narratives

### Weekly status update

Elena opens `hm` on Friday afternoon to find this week's team status report already drafted. The report walks through what shipped (four merged PRs, two roadmap commitments closed out), what slipped (one design item that didn't make it into review), and notable signal — including a 3-point drop in retrieval eval scores that started Tuesday. She reads it top to bottom and pauses on the slipped item, which she'd thought was further along on Wednesday.

She asks `hm`: "why is the schema design slipping?" The answer points to the last update on the linked design doc and the assignee's comment on the open issue — the work hit an unresolved question about partitioning. That matches what Elena vaguely remembered, but it's missing context she can add: GitHub was down for most of Wednesday morning, so reviews across the team stacked up and the design discussion stalled with it. She edits the report to note that.

She turns to the eval drop next. "What changed in the retrieval pipeline between last Monday and this Tuesday?" `hm` lists three PRs that touched the relevant code paths. Elena pins the most likely candidate as a follow-up in the report, tags Priya on the slipped design item so she sees the same view, and sends the status. It's 4:15pm — the report would have taken her until 6 if she'd written it herself.

### Roadmap health before a review

Priya has a leadership review tomorrow morning. She opens `hm` to the roadmap health view, which already shows Q3 status for the retrieval workstream. `hm` flags four items: one critically off-track, two slipping but recoverable, and one that slipped last week but is now stable. She skips the recovering ones and focuses on the critical item — a customer-facing prompt-router refactor.

She opens the roadmap-drift map to see what depends on the refactor. Three downstream commitments depend on it, and two of those have also slipped a week since Monday. She asks `hm`: "why has this slipped so much?" The answer cites three things: a decision waiting on legal in the linked issue thread, a reviewer on PTO since last Wednesday, and a scope-change comment from the assignee. Only the legal block needs escalation; the other two will resolve within the week.

She sends Elena a note about the legal-blocked item so they're aligned for the review. She exports the map for her slides and writes a two-sentence narrative. Tomorrow's review will get the actual picture, and Priya will have a real answer when leadership asks about downstream impacts.

### Backlog grooming

Elena opens `hm` Monday morning. The backlog hygiene view shows 23 suggestions across her team's label: 5 duplicate merges, 10 stale items needing action, and 8 newly-filed tickets that `hm` has enriched into full triages. Each suggestion includes a proposed action, a confidence score, and a one-line rationale.

The duplicates go fast — four are high-confidence and Elena approves them in a single batch. The fifth is at 60% confidence: the bodies describe similar symptoms but different components, so Elena opens both, decides they're distinct, and tells `hm` not to suggest the pair again. The stale list takes more reading. `hm` proposes close-as-resolved for six issues where the fix has clearly landed, reassign for three whose original owner left the team, and ping-for-context on one idle six months without an obvious resolution. Elena accepts the high-confidence batch and pings a current owner on the ambiguous one.

The enhanced tickets take the longest and are the most valuable. `hm` has taken eight thin reports — most of them just a title and a screenshot — and rewritten each into a structured triage with a precise title, a body covering steps to reproduce and affected files, and proposed type and priority labels. Elena reads each one, accepts six as-is, edits one to downgrade priority, and rejects one where `hm` misidentified the affected module. Total time: 50 minutes — about a third of what the same pass takes by hand.

### Eval regression investigation

Tarek opens `hm` Tuesday morning. The home view flags a regression: retrieval eval scores are down 5 points over the past two weeks. He's been on the retrieval team for three weeks and most of the area is still unfamiliar to him. He clicks into the alert.

The eval-detail page shows the trend chart and a per-suite breakdown of which suites contributed to the drop. Tarek asks `hm`: "what merged in the retrieval service over the past two weeks?" `hm` returns nine PRs with their authors, merge dates, and one-line descriptions. None of the titles obviously match the affected suites, so he opens the map view to see how the PRs relate — which files they touched and which owners they share. Two of the nine touched the same retrieval helper, and the map flags an open issue against that helper from a week ago.

The open issue describes flaky behavior in the helper under a specific load pattern. Tarek can't tell from the description whether it explains the eval drop, but the owner is named and the file is identified. He comments on the issue with what he has — the eval window, the two PRs, the suite breakdown — and pings the owner. By 9:30 he's done what he can from his desk and has a specific person to talk to.

## High-level requirements

### Platform decisions

- Desktop app, macOS first (Apple Silicon; latest two macOS versions)
- UX patterned after Linear: keyboard-first, focused, minimal chrome, fast
- Cross-platform (web, Windows, Linux) is a stretch goal beyond v1
- No mobile target for v1

### Architecture decisions

- Desktop shell: Tauri (Rust core + TypeScript/React UI); same UI code reusable for a future web client
- Fully local, single-user architecture for v1 — no shared backend service; each user runs their own `hm` against their own credentials and their own local repo clones
- Tauri's Rust core handles ingestion, storage, and query; UI talks to it via Tauri commands (IPC)
- Data sources via official APIs (GitHub, Jira, eval system, etc.); push-based updates (webhooks, websockets, server-sent events) where available, polling otherwise
- AI calls go through a configurable provider layer modeled on autocatalyst — multiple credentials, endpoints, and routing profiles let any approved provider serve any task
- Roadmap and other doc-based sources read via configured paths/URLs; AI-assisted extraction turns unstructured content into structured roadmap items
- Collaboration features (shared annotations, learned-feedback sharing, canonical snapshot views) deferred to a future version

### Data decisions

- Primary store: SQLite + sqlite-vec extension in a single database file; structured data and vector embeddings together
- History model: event-sourced for every meaningful change (status transitions, assignments, reviews, etc.); daily snapshot tables materialize point-in-time state for time-travel queries; snapshots are replayable from upstream history if a day is missed
- Status reports: one immutable row per (team, week); objectives and key results follow the same event + snapshot pattern as issues
- Vector search: sqlite-vec brute-force exact KNN, sufficient at this scale; two-pass retrieval for dedupe/related queries (embedding candidates + structural rerank with confidence scoring)
- Settings split: per-user prefs in OS-appropriate config file (macOS: `~/Library/Application Support/hm/preferences.toml`); API tokens in OS keychain; shared settings (data sources, doc paths, taxonomy, OKR templates) in the DB
- On-disk vs in-DB: code repos stay on disk at configured paths; source-system attachments fetched on demand; no `hm`-managed blob storage in v1
- Multi-tenancy: not applicable in v1 — each user runs their own instance

### Security decisions

- Authentication: each user authenticates to source systems directly via the systems' own auth (GitHub PAT or OAuth, Jira PAT or basic auth, etc.); `hm` does not have its own user accounts
- Credential storage: API tokens stored in the macOS keychain; never written to config files or the DB
- Authorization: `hm` inherits whatever each user can already see in each source system — no privilege elevation, no shared service account
- Local data protection: SQLite file lives under the user's home directory; relies on OS file permissions; full-disk encryption (e.g., FileVault on macOS) is assumed at the OS level, not enforced by `hm`
- AI calls: provider credentials handled via the configurable provider layer; sensitive data (issue bodies, code snippets, doc content) routed only through providers permitted by the user's org policy
- No telemetry or usage reporting to external endpoints in v1
- Compliance: internal organization use only; no customer data, no PII outside what's already in the user's source systems
- Audit log: every `hm` mutation to a source system (issue create, comment, edit, label change) is recorded in a local action log for the user's own review

### Operations decisions

- Distribution: signed macOS .app bundle via GitHub releases; Tauri's built-in auto-updater for in-app upgrades
- Logging: local rotated log files under `~/Library/Logs/hm/`; configurable log level
- Telemetry: none in v1 (per Security decisions)
- Error reporting: surfaced in-app to the user; no remote crash reporting in v1
- Backup: the SQLite database is a single file; users rely on OS-level backup (Time Machine, etc.); `hm` does not manage backups itself in v1
- Background work: ingestion polls, daily snapshot job, and AI tasks run on Tauri's async runtime; status visible in the app
- Testing (Rust core): `cargo test` for units, integration, and Tauri command handlers
- Testing (TS/React UI): Vitest + React Testing Library for component tests; Playwright end-to-end against a real Tauri build for critical flows (chat Q&A, a full triage pass, opening a snapshot view); axe-core for keyboard-nav and ARIA accessibility checks
- Testing (cross-boundary): auto-generated TypeScript types from Rust command signatures (via `specta` or equivalent) keep the IPC contract in sync; visual regression testing deferred until UI churn warrants it
- Scaling: not applicable in v1 — single-user local app

## Design guidance

`hm` adopts Episteme's design system as its starting point (see `wiki/design-system.md` in the Episteme repo) and adapts where the use case calls for it. The full token catalog will live in `hm`'s wiki later; this section records the high-level commitments.

### Typography

- UI text: **Inter Variable** — chrome (sidebar, toolbar, buttons, inputs, menus, dialogs)
- Code/monospace: **Fira Code** — code blocks, inline code, file paths, identifiers
- UI type scale: 11 / 12 / 13 / 14 / 16 px (xs / sm / base / md / lg)
- Fonts are user-configurable post-v1 via per-user preferences (ADR-008)

### Colors

- Color space: **oklch** — perceptually uniform; theme adjustments are predictable
- Default palette: **Catppuccin** — Latte (light mode) and Macchiato (dark mode)
- Primary accent: **sapphire** — used for focus rings, selected states, links, primary button backgrounds
- Both modes ship in v1 with equal design weight; default follows `prefers-color-scheme`, user can override
- Configurable color schemes ship as a separate feature (see Related features → Configuration); the architecture supports swappable token sets via a `data-theme` attribute
- WCAG AA contrast verified on all foreground/background pairings

### Spacing

- 4px base unit; discrete spacer set with intentional gaps to discourage over-granular use
- Control heights: 24 / 28 / 32 px (sm / base / lg)
- Sidebar fixed at 244px width

### Icons

- **Lucide React** — 16px for standard UI, 14px inline with text

### Component patterns

- **Primitives**: Radix UI (`@radix-ui/*` for dialog, popover, dropdown-menu, context-menu, tooltip, select) — accessibility primitives only; visual styling applied directly from design tokens
- No shadcn; tokens are the single source of truth for visual styling
- Tokens encoded as CSS custom properties in a Tailwind v4 `@theme {}` block
- Motion bias: fewer, faster transitions. ~100ms for hover/active, ~150ms for entrances, ~100ms for exits, ~250ms only for deliberate layout shifts

## Related features

### Configuration

- **Source configuration** — which orgs/repos/projects/docs `hm` ingests
- **AI provider configuration** — autocatalyst-style multi-provider, multi-profile routing
- **Color scheme configuration** — swap between Catppuccin flavors (Latte / Frappé / Macchiato / Mocha), override the primary accent, or apply a custom palette via a `data-theme` attribute
- **Per-user preferences** — window state, view options, font choices (stored outside the DB)

### Data integration

- **GitHub connector** — repos, PRs, issues, events, reviews; events-based history
- **Jira connector** — issues + changelog; supports Jira Data Center
- **Doc extractor** — AI-assisted extraction of roadmap items, objectives, and key results from git-tracked docs
- **Eval system connector** — ingests scores and trends

### Issue management

- **Triage suggestions** — duplicate detection, stale identification, batch close/reassign/retitle, all with confidence scoring
- **Ticket enrichment** — thin reports (title + screenshot) become structured triages with precise title, body, affected files, and proposed labels
- **Batch actions** — merge, close, reassign, retitle, regroup with one-click approval

### Reports & status

- **Weekly status report** — proactively drafted for the user's team; user reviews, asks clarifying questions, edits, sends
- **Roadmap health view** — pre-populated when the user opens `hm`; flags off-track items with severity
- **Objectives & key results** — tracked with history; time-travel queries answer "why are we off track?"

### Insight, exploration & visualization

_Deferred — these features come after the foundation above. Expected to include the chat interface, eval regression detection, relationship maps, and the roadmap drift map referenced in the narratives._

## Related ADRs

_Decisions surfaced during app planning. Each is significant enough to warrant a recorded rationale._

- [ADR-001: Auth posture](../adrs/adr-001-auth-posture.md) — each user authenticates to source systems directly; `hm` has no accounts of its own
- [ADR-002: Desktop framework](../adrs/adr-002-desktop-framework.md) — Tauri (vs. native Swift, Electron); cross-platform path and UX fit
- [ADR-003: Local-first architecture for v1](../adrs/adr-003-local-first-architecture.md) — each user runs their own instance; no shared backend; collaboration deferred
- [ADR-004: Primary store](../adrs/adr-004-primary-store.md) — SQLite + sqlite-vec in a single file (vs. LanceDB, dual-engine)
- [ADR-005: Event-sourced history + daily snapshots](../adrs/adr-005-history-and-snapshots.md) — how time-travel queries are satisfied
- [ADR-006: AI provider abstraction](../adrs/adr-006-ai-provider-abstraction.md) — configurable provider layer modeled on autocatalyst
- [ADR-007: Two-pass retrieval](../adrs/adr-007-two-pass-retrieval.md) — vector candidate generation + structural rerank with confidence scoring
- [ADR-008: Settings split](../adrs/adr-008-settings-split.md) — per-user prefs in config file, tokens in keychain, shared settings in DB
