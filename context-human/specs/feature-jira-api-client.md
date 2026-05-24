---
created: 2026-05-24
last_updated: 2026-05-24
status: implementing
issue: 9
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Jira API client

## What

`hm` needs a Rust Jira Data Center API client that every later Jira feature can use. The client is pure backend plumbing: it makes authenticated Jira REST calls, parses responses into typed Rust structs, handles pagination, rate limits, retries transient failures, and returns safe errors.
The first client supports Jira Data Center 10.3 with personal access token (PAT) authentication. It covers issue fetch, JQL search, issue changelog pagination, and project listing. It does not add UI, ingestion tables, background jobs, or database writes.
## Why

Jira is one of `hm`'s core data sources. Source configuration already lets a user save a Jira server, PAT credential reference, and project choices, but live connection testing and project discovery are blocked until this client exists.
Later Jira ingestion depends on the same client for issue history. ADR-005 makes Jira changelog data part of the event source for issue history, so `hm` needs one tested, redacting, reusable Jira client instead of scattered ad hoc HTTP calls.
## Personas

- **Future Jira ingestion implementer** — needs a typed client for issues, searches, changelogs, and projects before building sync, event tables, and snapshots.
- **Elena: EM** — indirectly benefits when Jira source setup can test her PAT and list the projects she can see.
- **Tarek: Team member** — indirectly benefits when bad tokens, missing permissions, network failures, and server errors become clear safe messages instead of raw HTTP failures.
- **Maintainer** — needs local fixture tests and mock-server integration tests so Jira behavior can change safely without real Jira credentials in CI.
## Narratives

### Elena tests a Jira source

Elena opens Settings → Sources and tests her saved Jira Data Center source. `hm` loads the PAT from the OS keychain and calls the Jira client to fetch `/rest/api/2/project`.
The request succeeds. `hm` receives typed project records, sorts and deduplicates them, and shows the projects Elena can select for ingestion. The token never appears in logs, errors, generated bindings, SQLite, or the UI.
### A future sync fetches issue history

A developer builds Jira issue ingestion. The sync code reads saved source metadata, loads the PAT by credential reference, and creates a Jira API client with the source's server URL.
The sync searches Jira with project-scoped JQL, follows `startAt`/`maxResults` pagination, and fetches changelog pages for each issue that needs full history. The client returns typed issue, changelog, user, and project records. The ingestion code maps those records into event tables and daily snapshots in a later feature.
### A maintainer debugs rate limiting without secrets

A mock-server integration test returns `429` and Jira-style `X-RateLimit-*` or `Retry-After` headers. The client waits through an injected sleep hook, retries within the configured attempt budget, and returns either success or a safe rate-limit error.
The error includes the status code and category. It does not include the PAT, `Authorization` header, raw response body, or upstream stack trace. The maintainer can assert retry behavior without calling a real Jira server.
## User stories

**Future Jira ingestion implementer**
- Can create a Jira API client from a normalized server URL and PAT value.
- Can fetch one issue by key or id with `expand=changelog`.
- Can search issues with JQL through `/rest/api/2/search` and follow Jira pagination.
- Can fetch an issue's changelog through `/rest/api/2/issue/{id}/changelog` and follow Jira pagination.
- Can list accessible projects through `/rest/api/2/project`.
- Can receive typed response structs for issues, changelog entries, projects, and users.
**Elena tests a Jira source**
- Can run the existing Jira source connection test against the real Jira client once a PAT is available.
- Can see accessible projects after a successful project-list call.
- Can see a safe error when the URL, token, permissions, network, rate limit, or server is wrong.
**Maintainer validates behavior locally**
- Can run unit tests against recorded fixture responses with no network calls.
- Can run integration tests against a local mock Jira server with no real credentials.
- Can test retry and rate-limit behavior without slow real sleeps.
- Can verify safe error redaction for tokens, headers, and raw response bodies.
## Goals

- Add a reusable Rust Jira Data Center 10.3 REST client.
- Support PAT authentication through `Authorization: Bearer `.
- Support `GET /rest/api/2/issue/{id}` with `expand=changelog`.
- Support `GET /rest/api/2/search` with JQL and pagination.
- Support `GET /rest/api/2/issue/{id}/changelog` with pagination.
- Support `GET /rest/api/2/project` for accessible project listing and source setup.
- Add strongly typed serde response structs for issue, changelog entry, project, and user data needed by planned ingestion.
- Respect Jira rate-limit headers when present and use conservative behavior when headers are absent.
- Retry 5xx responses and transient network failures with bounded exponential backoff.
- Return safe typed errors that do not leak secrets or raw upstream details.
- Provide unit tests with recorded fixture responses.
- Provide integration tests with a local mock Jira server.
- Wire the existing Jira source connection-test adapter to the client for project discovery, without adding UI or database writes.
## Non-goals

- No Jira issue ingestion, polling, background sync, database writes, event tables, or snapshots.
- No new React UI or settings layout changes.
- No OAuth, basic auth, username/password auth, cookie auth, or service-account flow.
- No Jira Cloud-specific API behavior unless it also works with Jira Data Center 10.3.
- No writes back to Jira: no create, update, comment, transition, assignment, or label mutation endpoints.
- No attachment download or blob storage.
- No source scheduling, health dashboard, or long-running sync progress reporting.
- No real Jira server or real PAT dependency in automated tests.
## Design spec

This feature has no new user interface. The design work is about backend behavior that existing and future UI can rely on.
### Backend interaction model

```plain text
Existing source settings command
└── jira_source_test_connection(source, pending_pat)
    ├── Resolve PAT from pending form value or keychain credential ref
    ├── Build JiraApiClient(server_url, pat)
    ├── GET /rest/api/2/project
    └── Return Success/Error result with safe message and project metadata

Future Jira ingestion
└── Jira sync service
    ├── Load source metadata from shared settings
    ├── Load PAT from OS keychain
    ├── Build JiraApiClient(server_url, pat)
    ├── Search issues with project-scoped JQL
    ├── Fetch issue details and changelog pages
    └── Persist events/snapshots in a later feature
```
### User-visible behavior through existing source setup

The existing Sources UI keeps its current layout. The behavior changes from an explicit `Unavailable` state to live connection testing when the client can list projects.
Connection-test outcomes should remain short and safe:
```plain text
Success: Connected to Jira. Select projects to ingest.
Authentication failed: Replace the token and test again.
Access denied: Check that the PAT can read Jira projects.
Network error: Check the Jira URL and your network connection.
Rate limited: Wait a moment and try again.
Server error: Jira returned an error. Check the Jira server status.
```
### Security and redaction rules

- The client accepts a PAT value in memory and uses it only to set the `Authorization` header.
- The PAT must not appear in `Debug`, `Display`, logs, test names, snapshots, fixtures, generated bindings, or user-visible messages.
- Errors may include a safe category, HTTP status code, endpoint kind, and suggested fix.
- Errors must not include request headers, raw response bodies, raw URLs containing credentials, upstream stack traces, or token-shaped substrings.
- Fixture files must contain fake Jira data only and must not contain real hostnames, real names, real emails, or real issue content.
## Tech spec

### Prerequisites and references

- Issue #9 — `feat(jira): api client`.
- ADR-002 — Tauri with a Rust core. The Jira client belongs in the Rust side.
- ADR-003 — local-first single-user v1. Calls use the user's own source-system credential.
- ADR-005 — Jira changelog is a future event source for issue history.
- ADR-008 — Jira PAT values stay in the OS keychain; source metadata stays in SQLite shared settings.
- Existing source configuration spec — `enhancement-jira-source-configuration.md` depends on this client for live testing and project discovery.
### Module layout

Add the Jira API client under the Rust sources module:
```plain text
src-tauri/src/sources/
  jira.rs                 existing connection-test adapter and UI result mapping
  jira_client.rs          reusable Jira REST client, request helpers, pagination
  jira_types.rs           serde response structs for Jira issue/project/changelog/user
  jira_errors.rs          safe client error enum and redaction helpers, if split is clearer
```
A smaller implementation may keep `jira_client`, `jira_types`, and `jira_errors` in one module at first if tests stay readable. The public surface should still separate connection-test result types from reusable Jira API types.
### Client API

The client should be usable without Tauri state, SQLite, or keychain access:
```rust
pub struct JiraApiClient {
    base_url: String,
    pat: SecretString,
    http: C,
    retry_policy: RetryPolicy,
    rate_limit_policy: RateLimitPolicy,
}

pub struct JiraApiClientConfig {
    pub base_url: String,
    pub pat: String,
    pub user_agent: String,
    pub retry_policy: RetryPolicy,
    pub rate_limit_policy: RateLimitPolicy,
}

impl JiraApiClient {
    pub fn new(config: JiraApiClientConfig) -> Result;
    pub fn get_issue_with_changelog(&self, issue_id_or_key: &str) -> Result;
    pub fn search_issues_page(&self, request: JiraSearchRequest) -> Result;
    pub fn search_issues_all(&self, request: JiraSearchRequest) -> Result, JiraApiError>;
    pub fn get_issue_changelog_page(&self, issue_id_or_key: &str, start_at: u32, max_results: u32) -> Result;
    pub fn get_issue_changelog_all(&self, issue_id_or_key: &str) -> Result, JiraApiError>;
    pub fn list_projects(&self) -> Result, JiraApiError>;
}
```
Names may change during implementation, but the client must expose page-level methods and all-pages helpers. Page-level methods let later sync jobs checkpoint progress. All-pages helpers keep connection tests and small fixture tests simple.
### HTTP behavior

Use the checked-in `ureq` dependency unless implementation finds a clear reason to change. Keep requests blocking and contained in Rust command/background-worker code until a later ingestion scheduler chooses an async model.
Request rules:
- Join paths to the normalized Jira server URL without allowing path traversal or credential-bearing URLs.
- Add `Authorization: Bearer ` to every request.
- Add an `Accept: application/json` header.
- Add a stable `User-Agent`, for example `hm/0.1.0`.
- URL-encode JQL, pagination, `fields`, and `expand` query parameters.
- Bound `maxResults` to a safe range. Use 50 as the default page size and reject or clamp values above 100 unless Jira Data Center docs require a different limit.
- Treat unknown JSON fields as ignored. Treat required fields missing from fixture-backed structs as decode errors.
Endpoint mapping:

Method
Endpoint
Purpose

`GET`
`/rest/api/2/issue/{id}?expand=changelog`
Fetch one issue with embedded changelog data when Jira returns it

`GET`
`/rest/api/2/search?jql=...&startAt=...&maxResults=...`
Search issues by JQL with pagination

`GET`
`/rest/api/2/issue/{id}/changelog?startAt=...&maxResults=...`
Fetch complete changelog pages

`GET`
`/rest/api/2/project`
List accessible projects for setup and source validation

### Response types

Create typed structs for the fields `hm` needs now or clearly expects for ingestion. Keep extra Jira fields ignored rather than modeling the full Jira API.
Minimum structs:
```rust
pub struct JiraIssue {
    pub id: String,
    pub key: String,
    pub self_url: Option,
    pub fields: JiraIssueFields,
    pub changelog: Option,
}

pub struct JiraIssueFields {
    pub summary: Option,
    pub description: Option,
    pub issue_type: Option,
    pub status: Option,
    pub priority: Option,
    pub assignee: Option,
    pub reporter: Option,
    pub project: Option,
    pub created: Option,
    pub updated: Option,
}

pub struct JiraChangelogPage {
    pub start_at: u32,
    pub max_results: u32,
    pub total: Option,
    pub histories: Vec,
}

pub struct JiraChangelogEntry {
    pub id: String,
    pub author: Option,
    pub created: String,
    pub items: Vec,
}

pub struct JiraProject {
    pub id: Option,
    pub key: String,
    pub name: String,
}

pub struct JiraUser {
    pub account_id: Option,
    pub name: Option,
    pub key: Option,
    pub display_name: Option,
    pub email_address: Option,
    pub active: Option,
}
```
Jira Data Center user identity fields vary by version and configuration. The structs should accept missing user fields without failing the whole response.
### Pagination

`search_issues_all` and `get_issue_changelog_all` should loop until Jira indicates there are no more results. The loop should stop when:
- `startAt + returned_count >= total`, when `total` is present.
- A page returns fewer results than requested, when `total` is absent.
- A page returns zero results.
- A caller-provided page or item cap is reached, if the implementation adds defensive caps.
The client must avoid infinite loops when Jira returns inconsistent pagination metadata.
### Rate limits and retries

Represent retry behavior with an injectable policy so tests do not sleep in real time.
Default behavior:
- Retry transient network errors and HTTP `500`, `502`, `503`, and `504`.
- Treat `401`, `403`, `404`, and `400` as non-retryable.
- Treat `429` as rate-limited. Retry only if the retry policy has attempts left.
- Respect `Retry-After` when present.
- Respect Jira `X-RateLimit-*` headers when present. The exact header names may vary; parse the common `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `X-RateLimit-NearLimit` fields defensively.
- When no rate-limit headers exist, use conservative backoff instead of tight retry loops.
- Use bounded exponential backoff with jitter, for example 250 ms, 500 ms, and 1 s for a total of three attempts.
Tests should inject a fake sleeper/clock to assert delays without waiting.
### Error model

Add a typed error enum whose `Display` implementation is safe:
```rust
pub enum JiraApiError {
    InvalidBaseUrl,
    InvalidRequest { message: String },
    Unauthorized,
    Forbidden,
    NotFound,
    RateLimited { retry_after_seconds: Option },
    Server { status: u16 },
    Network,
    Decode,
}
```
The exact enum can include more context, but all public strings must stay redacted. Raw `ureq` errors, response bodies, and headers should be converted at the boundary.
Map client errors into the existing connection-test categories:

Jira client error
Connection-test category

`InvalidBaseUrl` / invalid request URL
`InvalidUrl`

`Unauthorized`
`AuthFailed`

`Forbidden`
`Forbidden`

`RateLimited`
`RateLimited`

`Server`
`Server`

`Network`
`Network`

`Decode`
`Server` or `Unsupported`, with a safe message

Missing keychain credential
`MissingCredential`

### Connection-test integration

Update `jira_source_test_connection_with_store` so it no longer returns `Unavailable` when a PAT is available. The adapter should:
1. Resolve `pending_pat` or load the saved PAT from the secret store.
2. Build a Jira API client from the source URL and PAT.
3. Call `list_projects()`.
4. Convert returned `JiraProject` values into existing `JiraConnectionProject` values.
5. Deduplicate and sort projects by key.
6. Return `Success` with projects, or a safe `Error` result mapped from `JiraApiError`.
This integration must not hold a DB lock. The current command already receives only source metadata and secret store state, so no database access is needed.
### Testing plan

**Rust unit tests:**
- Parse recorded issue fixture with `expand=changelog`.
- Parse recorded search fixture with multiple issues.
- Parse recorded changelog page fixture.
- Parse recorded project list fixture.
- Tolerate optional Jira user identity fields.
- Build correct endpoint paths and query parameters, including URL-encoded JQL.
- Reject invalid base URLs and unsafe request inputs.
- Redact PAT values, `Authorization` headers, and raw response bodies from `Display` and `Debug` output.
- Stop pagination on total reached, short page, empty page, and inconsistent metadata.
- Map HTTP status codes to safe `JiraApiError` variants.
- Map `JiraApiError` variants to existing connection-test categories.
**Mock-server integration tests:**
- Send PAT auth header and safe user agent to the mock server.
- Fetch an issue with `expand=changelog`.
- Search through at least two paginated pages.
- Fetch changelog through at least two paginated pages.
- List projects and deduplicate/sort connection-test projects.
- Retry transient network or 5xx failures and then succeed.
- Return a safe server error after retry budget is exhausted.
- Respect `429` with `Retry-After` or rate-limit headers through a fake sleeper.
**Existing source configuration tests:**
- Replace tests that expect the issue #9 unavailable state with tests that use a mock Jira client or mock server.
- Keep missing-credential tests.
- Keep no-secret rendering and redaction tests.
- Keep e2e expectations realistic: browser-only Playwright still cannot exercise real Tauri keychain and network behavior.
### Risks

- Jira Data Center response shapes vary by version and plugin configuration. Mitigation: model only needed fields, make identity fields optional, and ignore unknown fields.
- Rate-limit headers may be absent or non-standard. Mitigation: parse known headers defensively and fall back to bounded conservative backoff.
- Blocking HTTP calls can freeze UI if called directly on the frontend command path for slow servers. Mitigation: keep calls inside Rust command code for connection testing now; later ingestion should run in background worker tasks.
- Recorded fixtures can accidentally include sensitive internal data. Mitigation: use synthetic fixtures and review them for hostnames, emails, and tokens before commit.
- Jira's `GET /search` URL length can be too long for large JQL. Mitigation: keep this issue scoped to the requested GET endpoint and leave POST search support as a follow-up if needed.
## Task list

- [ ] **Story: Client module foundation**
	- [ ] **Task: Add Jira client module and configuration types**
		- **Description**: Create the reusable Rust Jira API client module with base URL normalization, PAT handling, user agent configuration, retry policy, and rate-limit policy.
		- **Acceptance criteria**:
			- [ ] Client constructs from a normalized Jira server URL and PAT value
			- [ ] Invalid base URLs return a safe typed error
			- [ ] PAT is held in a debug-redacting wrapper or otherwise cannot appear in `Debug` output
			- [ ] Client code has no dependency on SQLite, Tauri state, or React bindings
			- [ ] Existing source modules compile with the new module exported
		- **Dependencies**: Existing `sources` module and `ureq` dependency
	- [ ] **Task: Add safe Jira API error model**
		- **Description**: Add typed Jira client errors and conversion from HTTP/client failures into redacted public errors.
		- **Acceptance criteria**:
			- [ ] 400, 401, 403, 404, 429, 5xx, network, and decode failures map to distinct safe categories where useful
			- [ ] `Display` output never includes PAT values, authorization headers, raw response bodies, or upstream stack traces
			- [ ] Tests cover redaction with token-shaped and header-shaped upstream strings
			- [ ] Connection-test mapping can consume the new error variants
		- **Dependencies**: Client module foundation
- [ ] **Story: Typed Jira response parsing**
	- [ ] **Task: Add issue, search, changelog, project, and user structs**
		- **Description**: Add serde structs for the Jira Data Center 10.3 fields needed by source setup and planned ingestion.
		- **Acceptance criteria**:
			- [ ] Issue structs parse id, key, selected fields, and optional embedded changelog
			- [ ] Search page structs parse `startAt`, `maxResults`, `total`, and issue list
			- [ ] Changelog page structs parse histories and items
			- [ ] Project structs parse key, name, and optional id
			- [ ] User structs tolerate Data Center identity-field differences
		- **Dependencies**: Client module foundation
	- [ ] **Task: Add synthetic recorded fixture tests**
		- **Description**: Add local JSON fixtures and unit tests for representative Jira Data Center responses.
		- **Acceptance criteria**:
			- [ ] Fixtures are synthetic and contain no real hostnames, emails, tokens, or internal issue text
			- [ ] Issue-with-changelog, search, changelog-page, and project-list fixtures parse successfully
			- [ ] Missing optional user fields do not fail parsing
			- [ ] Missing required fields fail with a safe decode error
		- **Dependencies**: Typed response structs
- [ ] **Story: Jira endpoint methods and pagination**
	- [ ] **Task: Implement issue and project endpoint methods**
		- **Description**: Implement `get_issue_with_changelog` and `list_projects` using safe request construction and typed response parsing.
		- **Acceptance criteria**:
			- [ ] Issue fetch calls `/rest/api/2/issue/{id}` with `expand=changelog`
			- [ ] Project listing calls `/rest/api/2/project`
			- [ ] Requests include PAT bearer auth, `Accept: application/json`, and user agent
			- [ ] Mock-server tests assert method, path, query, and headers without logging the PAT
			- [ ] HTTP failures map to safe `JiraApiError` values
		- **Dependencies**: Client module foundation, response structs, error model
	- [ ] **Task: Implement JQL search pagination**
		- **Description**: Implement page-level and all-pages JQL search through `GET /rest/api/2/search`.
		- **Acceptance criteria**:
			- [ ] Search request URL-encodes JQL and pagination parameters
			- [ ] Default page size is bounded and documented
			- [ ] All-pages helper follows `startAt`/`maxResults` until complete
			- [ ] Pagination stops on total reached, short page, empty page, or inconsistent metadata
			- [ ] Mock-server tests cover at least two pages
		- **Dependencies**: Response structs, endpoint request helper
	- [ ] **Task: Implement changelog pagination**
		- **Description**: Implement page-level and all-pages changelog fetch through `/rest/api/2/issue/{id}/changelog`.
		- **Acceptance criteria**:
			- [ ] Changelog request URL-encodes issue id/key and pagination parameters safely
			- [ ] All-pages helper follows Jira pagination until complete
			- [ ] Empty changelog returns an empty list without error
			- [ ] Mock-server tests cover at least two pages
			- [ ] Decode and server failures return safe errors
		- **Dependencies**: Response structs, endpoint request helper
- [ ] **Story: Rate limits and retries**
	- [ ] **Task: Add bounded retry policy**
		- **Description**: Add retry behavior for transient network errors and 5xx responses with injectable sleep/clock hooks for tests.
		- **Acceptance criteria**:
			- [ ] 500, 502, 503, 504, and transient network failures retry within the attempt budget
			- [ ] 400, 401, 403, and 404 do not retry
			- [ ] Backoff is bounded and configurable
			- [ ] Tests assert retry count without real sleeps
			- [ ] Exhausted retries return a safe final error
		- **Dependencies**: Client request helper and error model
	- [ ] **Task: Respect rate-limit headers**
		- **Description**: Parse Jira rate-limit and retry headers and apply them through the retry/rate-limit policy.
		- **Acceptance criteria**:
			- [ ] 429 maps to a rate-limited error when attempts are exhausted
			- [ ] `Retry-After` is honored when present
			- [ ] Common `X-RateLimit-*` headers are parsed defensively when present
			- [ ] Missing headers fall back to conservative bounded backoff
			- [ ] Mock-server tests cover 429 with retry and 429 exhaustion
		- **Dependencies**: Bounded retry policy
- [ ] **Story: Source connection-test integration**
	- [ ] **Task: Implement ****`JiraProjectClient`**** with the real API client**
		- **Description**: Connect the existing source connection-test seam to the new Jira client for project discovery.
		- **Acceptance criteria**:
			- [ ] `jira_source_test_connection_with_store` uses pending PAT when provided
			- [ ] Saved-source tests load PAT from the secret store when pending PAT is absent
			- [ ] Successful project listing returns `Success` and sorted/deduplicated projects
			- [ ] Missing credential still returns the existing safe missing-credential result
			- [ ] Client errors map to existing safe connection-test categories
		- **Dependencies**: Project endpoint method, error mapping
	- [ ] **Task: Update source tests and user-visible messages**
		- **Description**: Replace issue #9 unavailable expectations with live-client mock behavior while preserving safe source-configuration behavior.
		- **Acceptance criteria**:
			- [ ] Rust source tests no longer expect `Unavailable` when the Jira client is present and a PAT exists
			- [ ] Existing no-secret assertions continue to pass
			- [ ] Frontend tests that only assert the old issue #9 message are updated or narrowed to non-Tauri limitations
			- [ ] Connection-test success and failure messages remain short and actionable
		- **Dependencies**: Real connection-test integration
- [ ] **Story: Validation and documentation**
	- [ ] **Task: Run targeted and broad checks**
		- **Description**: Validate the new client with focused Rust tests first, then existing project checks.
		- **Acceptance criteria**:
			- [ ] Jira client unit tests pass
			- [ ] Jira mock-server integration tests pass
			- [ ] Existing source configuration Rust tests pass
			- [ ] `cd src-tauri && cargo test` passes
			- [ ] `npm run lint` passes if TypeScript bindings or frontend tests change
			- [ ] `npm test` passes if frontend expectations change
			- [ ] Any skipped real-Jira test is documented as intentionally unsupported in CI
		- **Dependencies**: All implementation tasks
	- [ ] **Task: Update durable agent context**
		- **Description**: Record the new Jira client layout, public methods, test strategy, and source connection-test behavior in agent-maintained docs.
		- **Acceptance criteria**:
			- [ ] `context-agent/wiki/code-map.md` lists the Jira client modules and main responsibilities
			- [ ] `context-agent/wiki/testing.md` documents fixture and mock-server strategy
			- [ ] Notes explain that no real Jira server or PAT is needed in automated tests
			- [ ] Notes mention any Jira Data Center response-shape assumptions discovered during implementation
		- **Dependencies**: Module layout and tests complete