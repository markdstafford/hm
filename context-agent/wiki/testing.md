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

## Pre-handoff validation checklist

- Run the narrowest relevant validation first so failures point at the smallest changed surface.
- After targeted checks pass, run the CI job commands affected by the change before handoff.
- For Rust backend or Tauri changes, include these commands unless explicitly skipped with a reason:
  - `cd src-tauri && cargo check`
  - `cd src-tauri && cargo test`
  - `cd src-tauri && cargo clippy -- -D warnings`
- In PR descriptions, issue handoffs, or agent final summaries, list the checks that ran and call out skipped checks with the reason.

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

## Settings tests (added 2026-05-22)

### New Rust tests

| Module                          | Tests                                                             |
|---------------------------------|-------------------------------------------------------------------|
| `settings::preferences`         | round-trip, missing file, parent creation, non-object rejection   |
| `settings::keys`                | accepted/rejected key patterns (7 tests)                          |
| `settings::secrets` (in-memory) | set/get/delete/missing/overwrite (5 tests)                        |
| `settings::secrets` (keychain)  | ignored smoke test — run manually with `-- --ignored`             |
| `settings::shared`              | set/get/missing/overwrite/type fidelity/updated_at (5 tests)      |
| `db::tests`                     | existing 3 tests + `shared_settings` table creation (4 total)     |

### Keychain test strategy

Unit tests for secrets use `InMemorySecretStore` — no OS keychain prompt in CI.
The real keychain path is tested via a single `#[ignore]`-annotated test in `secrets.rs`. To run it locally:
```bash
cd src-tauri && cargo test -- --ignored keychain_smoke_set_get_delete
```

### Binding regeneration (headless)

`src/bindings.ts` is normally regenerated when `npm run tauri dev` starts in debug mode. A test in `lib.rs` provides a headless alternative:
```bash
cd src-tauri && cargo test generate_typescript_bindings
```
This writes `src/bindings.ts` from the current `collect_commands!` list without launching the Tauri app. Note: the test spawns a thread with a 32 MiB stack to avoid a stack overflow caused by a known recursion bug in specta rc.25 type traversal.

### Frontend type checks

After changing commands or bindings, run:
```bash
npm run lint    # tsc --noEmit
npm test        # Vitest
```
If `node_modules` is missing, run `npm install` first.

## Settings UI tests (added 2026-05-22, refactored 2026-05-24 in PR #30)

### Component test locations

| File | Coverage |
|------|----------|
| `src/preferences/index.test.ts` | Pure normalize/merge/resolve helpers — no mocks needed |
| `src/App.test.tsx` | Settings cog flips into page-mode (heading "General", close-X visible), showcase shortcut, axe |
| `src/features/settings/SettingsSidebar.test.tsx` | Renders all 4 categories, aria-current=page on the active one, onPick callback |
| `src/features/settings/SettingsPage.test.tsx` | Dispatches the right category component based on `category` prop |
| `src/features/settings/general/GeneralCategory.test.tsx` | SettingRow + Select renders, onUpdatePreferences called with the right patch, axe |
| `src/features/settings/appearance/AppearanceCategory.test.tsx` | Theme mode / light / dark rows render, change calls onUpdatePreferences, axe |
| `src/features/settings/sources/SourcesCategory.test.tsx` | Empty state, Add source flow, transition into JiraSourceForm |
| `src/features/settings/ai-providers/ProfileList.test.tsx` | Empty state, row rendering, routing badge, edit/test/remove callbacks, axe |
| `src/features/settings/ai-providers/ProfileForm.test.tsx` | Required-field gating, cascade rename, pendingSecret bundling, duplicate-name rejection in edit mode, settings preservation |
| `src/features/settings/ai-providers/YamlAdvancedView.test.tsx` | Initial textarea content, broken-ref rejection, save success path |
| `src/features/settings/ai-providers/AiProvidersCategory.test.tsx` | Empty state, view toggle, transactional secret-then-config save, save-failure rollback, remove cascade |
| `src/aiProviders/yaml/serialize.test.ts` | Sigil emission, protocol/runner shortening, anthropic/openai block grouping, routing, `_yaml_runner` preservation |
| `src/aiProviders/yaml/parse.test.ts` | Round-trip, ref validation, plaintext-secret refusal, empty/non-string sigil refusal, ai: wrapper handling, empty-config refusal, secret-shaped-settings refusal |

The legacy `src/settings/SettingsPanel.test.tsx`, `src/settings/SourcesSettings.test.tsx`, and `src/settings/AiProvidersSettings.test.tsx` were deleted in PR #30 along with the modal-based settings.

### Mock pattern for settings tests

```typescript
vi.mock("../bindings", () => ({
  commands: {
    preferencesRead: vi.fn().mockResolvedValue({ status: "ok", data: {} }),
    preferencesWrite: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  },
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({ setSize: vi.fn(), setPosition: vi.fn() })),
  LogicalSize: vi.fn(),
  LogicalPosition: vi.fn(),
}));
```

### Radix jsdom stubs

Radix Select requires PointerEvent and scrollIntoView — add these in `beforeAll` in test files that use Radix Select:

```typescript
beforeAll(() => {
  (globalThis as any).PointerEvent = window.MouseEvent;
  window.HTMLElement.prototype.hasPointerCapture = () => false;
  window.HTMLElement.prototype.releasePointerCapture = () => {};
  window.HTMLElement.prototype.setPointerCapture = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
});
```

Use `globalThis` (not `global`) — TypeScript in this project doesn't have the Node.js `global` type.

`ResizeObserver` is stubbed globally in `src/test/setup.ts` so Radix `RadioGroup` (and any other Radix component that reads element dimensions) doesn't throw under jsdom. No per-file setup is required.

### E2E settings coverage

`e2e/hello.spec.ts` covers: Inbox empty state, settings opener visible, cog flips into page mode (breadcrumb + General heading + close button), close-X returns to Inbox, and the theme-mode Select updating `data-theme` / `data-theme-mode` immediately (5 tests + 1 skipped tauri-driver gate).

`e2e/ai-providers.spec.ts` covers the profile-centric empty state and the YAML view toggle (textarea value via `toHaveValue`, not text content).

### E2E persistence limitation

Full cross-session preference persistence (change → close → reopen → verify) requires a compiled Tauri `.app` binary and `tauri-driver` with an isolated app-data directory. The current Playwright config targets the Vite dev server only (`http://localhost:1420`), where Tauri IPC commands (`preferencesWrite` / `preferencesRead`) are unavailable. The persistence smoke in `e2e/hello.spec.ts` verifies the UI side (data-theme attribute update) but not file I/O. A `test.todo()` placeholder marks the pending coverage. Document this limitation in any CI configuration that runs `npm run test:e2e`.

## Source configuration tests (added 2026-05-24, issue #8)

### Rust tests

- All Rust source tests use `crate::settings::secrets::InMemorySecretStore`; no OS keychain is touched in automated tests.
- `jira_source_test_connection_with_store` uses the real `JiraApiClient` (via `RealJiraProjectClient`) when a PAT is available; tests inject a fake `JiraProjectClient` via the trait seam.
- `map_client_error` in `jira.rs` is unit-tested with fake `JiraClientError` variants to verify safe category mapping.
- Live network calls are never made in automated tests; mock-server integration tests use `tiny_http::Server::http("127.0.0.1:0")`.

### Frontend sources tests

- `src/sources/validation.test.ts` — pure unit tests for URL normalization, PAT gating, and secret-key detection.
- `src/features/settings/sources/SourcesCategory.test.tsx` — component tests mock `src/bindings.ts` and set `window.__TAURI_INTERNALS__ = {}` to exercise the Tauri code paths.
- Use `vi.mocked(commands.sourceConfigGet).mockResolvedValue(...)` to control what sources are returned per-test.

### Mock pattern for sources tests

```typescript
vi.mock("../bindings", () => ({
  commands: {
    sourceConfigGet: vi.fn().mockResolvedValue({ status: "ok", data: { version: 1, sources: [] } }),
    sourceConfigSave: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    sourceCredentialSecretSet: vi.fn().mockResolvedValue({ status: "ok", data: "source.jira.src_x.pat" }),
    sourceCredentialDelete: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    sourceConfigRemove: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    // In browser-only tests, mock the browser fallback (no Tauri keychain/network)
    jiraSourceTestConnection: vi.fn().mockResolvedValue({
      status: "ok",
      data: {
        status: "Unavailable",
        tested_at: "...",
        message: "Live connection testing is not available in this environment. Use the desktop app to test this connection.",
        category: "Unavailable",
        projects: [],
      },
    }),
  },
}));
```

### E2E smoke path

`e2e/sources.spec.ts` covers: Settings → Sources → Add source → Jira Data Center → fill URL + PAT → Test connection → verify the browser-only unavailable message ("Live connection testing is not available…") is visible → Save → source appears in list. This test requires a Vite dev server for this workspace (`npm run tauri dev`) — it cannot run against a dev server for another workspace. Full keychain and live-network behavior requires a real Tauri build and `tauri-driver`.

## Jira API client tests (added 2026-05-24, issue #9)

### Rust tests

- Synthetic JSON fixtures live in `src-tauri/src/sources/fixtures/`. All files contain only `*.example.invalid` URLs, fake names (`Elena Example`, `Tarek Example`), and invented project keys. Do not copy real Jira responses or real project data into fixtures.
- Run Jira client tests: `cd src-tauri && cargo test sources::jira_client::tests -- --nocapture`
- Run Jira types tests: `cd src-tauri && cargo test sources::jira_types::tests -- --nocapture`
- Run Jira errors tests: `cd src-tauri && cargo test sources::jira_errors::tests -- --nocapture`
- Run source adapter tests: `cd src-tauri && cargo test sources::jira -- --nocapture`
- Mock-server tests use `tiny_http::Server::http("127.0.0.1:0")` — no real Jira server or PAT needed.
- Retry and rate-limit tests inject `RecordingSleeper` so delays are asserted without real waits.
- `MAX_PAGINATION_PAGES = 200` prevents infinite loops; the `search_issues_all_terminates_when_server_omits_total_and_returns_full_pages` test verifies this guard.

### Frontend tests

- `src/sources/defaults.ts` exports `JIRA_UNAVAILABLE_MESSAGE` used by `storage.ts` as the browser-only fallback when `isTauri()` is false.
- `src/features/settings/sources/SourcesCategory.test.tsx` mocks `jiraSourceTestConnection` to return `Unavailable` with the browser fallback message. The `ConnectionTestStatus` component renders `result.message`, so the test exercises the browser-side rendering path.
- Real Jira network and keychain behavior cannot be tested in the browser (Vitest jsdom). Full round-trip connection tests require the desktop app and a real Jira server — this is intentional.

## Jira issue ingestion tests (added 2026-05-25, issue #10)

### Targeted commands

```bash
cd src-tauri && cargo test issues:: -- --nocapture
cd src-tauri && cargo test ingestion:: -- --nocapture
cd src-tauri && cargo test sources::jira_ingestion::tests -- --nocapture
cd src-tauri && cargo test commands::tests -- --nocapture
cd src-tauri && cargo test redaction -- --nocapture
```

The `redaction` filter selects the four `redaction_*` tests in `sources::jira_ingestion::tests`, which lock down the guarantee that PATs, `Authorization` headers, and `Bearer ` tokens never appear in persisted rows (`ingestion_runs`, `ingestion_cursors`, `jira_issues.raw_*_json`), in `IngestionError` `Display` output, or anywhere in the synthetic fixture corpus.

### Fixtures

All ingestion fixtures live under `src-tauri/src/sources/fixtures/` and are 100% synthetic — no real Jira data, no real PATs, no production identifiers.

| File | Used by |
|------|---------|
| `jira_amp_search_page.json` | AMP search-page projection + multi-page ingestion tests |
| `jira_comments_page.json` | Inline-comment projection and comment tail tests |
| `jira_worklogs_page.json` | Inline-worklog projection tests |

`redaction_fixtures_directory_contains_no_secret_shaped_strings` asserts that no fixture contains `Authorization:`, `Bearer `, `pat-`, `secret-`, or `eyJ` (JWT prefix). Update this allowlist if a future fixture legitimately needs one of those substrings.

### Frontend test

```bash
npm test -- src/features/settings/sources/SourcesCategory.test.tsx
```

Covers the source-row status text + Run/Cancel buttons added in #10.

### Binding regeneration

```bash
cd src-tauri && cargo test generate_typescript_bindings -- --exact --nocapture
```

Run this after touching any `#[tauri::command] #[specta::specta]` function so `src/bindings.ts` matches the Rust signatures.

### Clippy gate

`cd src-tauri && cargo clippy -- -D warnings` (and `--all-targets`) passes after the three pre-existing fixes shipped with #10: `field_reassign_with_default` in `ai/config.rs::save_validates_before_writing`, `approx_constant` in `settings/shared.rs::preserves_json_type_fidelity`, and `while_let_loop` in `sources/jira_client.rs::search_issues_all_terminates_when_server_omits_total_and_returns_full_pages` (`#[allow(clippy::while_let_loop)]` preserved — the inner `if count >= … { break; }` early-exit is intentional termination-guard test infrastructure).

---

## AI provider testing (added 2026-05-24)

### Rust tests

- Runner tests use local mock HTTP servers only (`tiny_http::Server::http("127.0.0.1:0")`); no real provider credentials or network calls required.
- Use fake secrets such as `sk-test-secret` only in in-memory stores and mock server assertions; assert they never appear in `Display` errors, `Debug` output, generated bindings, or UI text.
- Regenerate bindings after changing AI commands or specta types: `cd src-tauri && cargo test generate_typescript_bindings`.
- `LoadedCredentialSecret::new_for_test("name", "value")` constructs test secrets without touching the OS keychain.

### Frontend tests

- AI provider tests mock `../../../bindings` command functions and use `vi.resetAllMocks()` + an `installDefaults()` helper in `beforeEach` so per-test `mockImplementation`s don't leak between tests (see `src/features/settings/ai-providers/AiProvidersCategory.test.tsx`).
- `validateAiProviderConfig` is a pure function; `validation.test.ts` tests it without any mocks.
- `storage.ts` guards all Tauri calls with `isTauri()` check; non-Tauri (Vitest jsdom) returns safe fallbacks.

### E2E limitations

- Browser-only Playwright (`http://localhost:1420`) cannot exercise real Tauri keychain or SQLite commands.
- AI provider e2e (`e2e/ai-providers.spec.ts`) covers tab navigation and empty-state rendering only.
- Full credential/profile creation flow requires Tauri IPC — see `tauri-driver` upstream docs if deeper e2e is needed.
- Run `npm run test:e2e` only when `npm run dev` (Vite) is running in a separate terminal.

## Backlog hygiene read-rendering checks (added 2026-05-28, issue #47)

- Entity/unit: `npm test -- src/entities/hygiene-suggestion`
- Page/component: `npm test -- src/features/backlog-hygiene/BacklogHygienePage.test.tsx`
- Generic collection binding: `npm test -- src/features/collection-viewer/useEntityCollectionViewer.test.tsx src/features/collection-viewer/CollectionViewerPage.test.tsx`
- E2E smoke: `npm run test:e2e -- e2e/backlog-hygiene.spec.ts`

---

## Collection write data layer smoke (issue #45)

Backend-only smoke path:

```bash
(cd src-tauri && cargo test mutations -- --nocapture)
(cd src-tauri && cargo test sources::jira_client -- --nocapture)
(cd src-tauri && cargo test generate_typescript_bindings -- --nocapture)
npm run lint
```

The mutation tests use an in-memory SQLite database and a recording Jira client. The Jira HTTP client tests use `tiny_http` bound to `127.0.0.1`; no real Jira credentials or network access are required.

For a manual mock-Jira smoke, start a local HTTP server that implements:
- `GET /rest/api/2/issue/AMP-1043/transitions`
- `POST /rest/api/2/issue/AMP-1043/transitions`
- `PUT /rest/api/2/issue/AMP-1043`
- `POST /rest/api/2/issue/AMP-1043/comment`
- `POST /rest/api/2/issueLink`
- `DELETE /rest/api/2/issueLink/<id>`

Configure a Jira source to `http://127.0.0.1:<port>`, save a fake PAT through the source credential flow, call one generated command such as `commands.jiraUpdateTitle(...)`, then call `commands.auditLogList({ target_ref: "jira:AMP-1043" })` and confirm the returned entry has the expected `batch_id`, `before_state`, `after_state`, and `reversible` flag.
