---
created: 2026-05-24
last_updated: 2026-05-24
status: implementing
issue: 8
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Jira source configuration

## What

`hm` needs a Settings tab where a user can configure source systems for ingestion. This enhancement adds a Sources tab to the existing Settings panel and supports Jira Data Center as the first source kind.
A user can add a Jira source, enter the Jira server URL, store a personal access token (PAT) in the OS keychain, test the connection, choose one or more Jira projects, and save the source metadata in SQLite shared settings. The Sources tab also lists configured sources and lets the user edit or remove them.
GitHub sources and document sources use the same source model later, but they are not part of this enhancement.
## Why

The app cannot ingest Jira issues until it knows which Jira server, credential, and projects to use. That configuration is user-entered, local-first, and data-relevant. ADR-008 says source records belong in SQLite shared settings, while credentials belong in the OS keychain.
Adding Jira source configuration now gives later Jira ingestion work a stable setup path. It also exercises the existing settings storage primitives with a source-system credential, not only app preferences or AI provider settings.
## Personas

- **Elena: EM** — connects her team's Jira Data Center project so `hm` can later enrich, triage, and summarize team work without asking her to edit config files.
- **Tarek: Team member** — uses his own Jira PAT and expects `hm` to store it safely on his machine. He wants clear errors when the server URL, token, or project access is wrong.
- **Future Jira feature implementer** — needs a saved source record with server URL, project keys, and credential reference before adding issue sync, changelog sync, and historical snapshots.
- **Future source implementer** — adds GitHub or document sources later and should be able to extend the Sources tab without redesigning the storage model or list/edit/remove behavior.
## Narratives

### Elena adds the team Jira project

Elena opens Settings and selects Sources. The empty state explains that sources tell `hm` which systems to read and that secrets stay in the OS keychain. She clicks Add source and chooses Jira from the source-kind selector.
She enters `https://jira.internal.example.com`, selects PAT as the auth method, and pastes her Jira personal access token. `hm` stores the PAT in the keychain under a generated credential reference. The token field clears after save, and the token value never appears in the source list, database, logs, or generated bindings.
Elena clicks Test connection. When the Jira API client from issue #9 is available, `hm` calls Jira with the saved credential and loads the projects she can see. Until that client lands, the UI can show a clear stub state that validates the form shape but says live testing is not available yet. After a successful test, Elena selects the team projects and saves the source.
### Tarek fixes a bad token

Tarek adds the Jira server URL and pastes an expired PAT. The connection test fails with a short message: "Jira returned 401. Replace the token or check that this PAT can read projects." The message does not include the token, request headers, or raw response body.
He chooses Edit on the source, replaces the PAT, and tests again. The test succeeds, the project selector refreshes, and Tarek saves the source. The list now shows the source name, server host, selected projects, and last test result.
### A future Jira sync uses saved source records

A developer implements Jira issue ingestion. They call a source-configuration service to list enabled Jira sources. Each source record contains the source id, kind, server URL, selected project keys, and a credential reference.
The sync code loads the PAT from the keychain only when it needs to call Jira. It does not read secrets from SQLite, preferences, or React state. If the user later removes a Jira source, the metadata is deleted from shared settings and the source's keychain credential is deleted too.
## User stories

**Elena adds the team Jira project**
- Elena can open Settings and select a Sources category from the sidebar
- Elena can start an Add source flow and choose Jira as the source kind
- Elena can enter a Jira Data Center server URL
- Elena can choose PAT as the auth method
- Elena can paste a PAT and save it to the OS keychain without showing it later
- Elena can test the Jira connection when the Jira API client is available
- Elena can choose one or more Jira projects after a successful connection test
- Elena can save the source and see it in the configured sources list
**Tarek fixes a bad token**
- Tarek can see a safe error when the server URL or PAT is invalid
- Tarek can edit an existing Jira source
- Tarek can replace the PAT without seeing the old token value
- Tarek can re-run the connection test after replacing the credential
- Tarek can save the source after the test succeeds
**A future Jira sync uses saved source records**
- Future Jira sync code can list configured Jira sources through typed Rust helpers
- Future Jira sync code can load source metadata from SQLite shared settings
- Future Jira sync code can load the PAT from keychain by credential reference
- Future Jira sync code can ignore disabled or removed sources
**A future source implementer extends Sources**
- Future implementer can add GitHub or document source kinds to the same source-kind selector
- Future implementer can reuse the list, edit, remove, and shared-settings persistence pattern
- Future implementer can keep kind-specific forms isolated from the source registry model
## Goals

- Add a Sources tab to the existing Settings panel
- Add an Add source flow with a source-kind selector
- Support Jira as the only populated source kind in this enhancement
- Store Jira PAT credentials in the OS keychain through the existing secret storage primitive
- Store source metadata in SQLite shared settings, with credential references instead of secret values
- Support server URL, auth method, generated credential reference, project filters, enabled state, and timestamps for Jira sources
- Add a connection test action that uses the Jira API client from issue #9 when available and provides an explicit stub state until then
- Populate the project multi-select after a successful connection test when the Jira API client is available
- Show a configured-source list with edit and remove actions
- Delete source-owned keychain credentials when a source is removed
- Cover source round-trip persistence, keychain credential behavior, validation, and UI flows with tests
## Non-goals

- No Jira issue ingestion, changelog ingestion, polling, or synchronization
- No GitHub source configuration
- No document source configuration
- No OAuth, basic auth, or username/password auth for Jira
- No source scheduling controls
- No source health dashboard beyond the connection test result shown in Settings
- No settings import/export
- No remote sync or multi-user sharing of source configuration
- No guarantee that live connection testing is implemented before issue #9 lands
## Design spec

### Information architecture

Settings sidebar after this enhancement:
```plain text
Settings
├── General
├── Appearance
├── Sources
└── AI providers
```
Sources sits before AI providers because source-system configuration is a core setup step for the app. AI providers remain available as a separate advanced configuration area.
### Sources tab layout

```plain text
Sources
├── Header: Sources
│   └── Description: Configure the systems hm reads from. Secrets are stored in the OS keychain.
├── Toolbar
│   └── Add source
├── Configured sources list
│   ├── Source row
│   │   ├── Name or host
│   │   ├── Kind: Jira
│   │   ├── Server host
│   │   ├── Projects summary
│   │   ├── Last test status
│   │   └── Edit / Remove
│   └── Empty state
│       └── Add your first source to tell hm where to read work data.
└── Add/edit source panel or inline form
```
### Add source flow

```plain text
Add source
├── Step 1: Choose source kind
│   ├── Jira Data Center (enabled)
│   ├── GitHub (disabled, "coming later")
│   └── Documents (disabled, "coming later")
└── Step 2: Configure Jira
    ├── Source name (optional; defaults to Jira host)
    ├── Server URL
    ├── Auth method: PAT
    ├── PAT input
    ├── Test connection
    ├── Project filter multi-select
    └── Save / Cancel
```
The user should not need to understand ADR-008. The UI should explain the storage split in plain language: "The token is stored in your OS keychain. Server URL and project choices are stored in hm's local database."
### Jira form behavior

- Server URL accepts `https://...` and `http://localhost...` for local test fixtures.
- Server URL is normalized by trimming whitespace and removing trailing slashes.
- Auth method shows PAT as the only enabled option.
- PAT is required for a new source.
- PAT replacement is optional when editing an existing source.
- Saved sources never display the token or a masked token value that implies `hm` can recover it for display.
- Project filter is disabled until a connection test succeeds or saved project metadata already exists.
- Project multi-select shows project key and name when Jira project metadata is available.
- Save is disabled when required fields are invalid.
### Connection test states

```plain text
Not tested
Testing...
Success: Connected to Jira as . Select projects to ingest.
Error: Jira returned 401. Replace the token or check project permissions.
Unavailable: Live connection testing depends on issue #9. The source can be saved, but projects must wait for the Jira API client.
```
All connection-test errors must be safe for logs and UI. They may include status code, high-level category, and suggested fix. They must not include token values, authorization headers, raw response bodies, or full upstream stack traces.
### Remove behavior

Removing a source asks for confirmation because later ingestion features will depend on configured sources. For this enhancement, removal deletes only the source metadata and the source-owned keychain credential. It does not delete ingested Jira data because ingestion is out of scope and does not exist yet.
## Tech spec

### Introduction and overview

**Prerequisites:**
- ADR-002 — Tauri with Rust core and React UI
- ADR-003 — local-first single-user v1
- ADR-004 — SQLite primary store
- ADR-008 — settings split
- Issue #4 — settings storage primitives exist
- Issue #5 — settings panel shell exists
- Issue #9 — Jira API client, soft dependency for live connection testing and project discovery
**Goals:**
- Keep source configuration local and single-user
- Keep Jira PAT values out of SQLite, preferences, logs, errors, frontend persistent state, and generated bindings
- Load source metadata through typed helpers rather than ad hoc `shared_settings_get` calls spread through the UI
- Make the Jira connection test use the same Jira API client that later sync features will use once issue #9 is available
- Let the UI work in a clear limited mode before issue #9 lands
### System design and architecture

```plain text
┌───────────────────────────────────────────────────────────────┐
│ React                                                         │
│  SettingsPanel → SourcesSettings                              │
│    SourceList / AddSourceFlow / JiraSourceForm /              │
│    ProjectMultiSelect / ConnectionTestStatus                  │
│  src/sources/                                                 │
│    types.ts, validation.ts, storage.ts                        │
└───────────────────────────┬───────────────────────────────────┘
                            │ generated bindings
┌───────────────────────────┴───────────────────────────────────┐
│ Rust                                                          │
│  src-tauri/src/sources/                                       │
│    config.rs       schema, serde, validation, shared setting  │
│    credentials.rs  source keychain key creation/deletion      │
│    jira.rs         connection test adapter                    │
│    errors.rs       safe typed errors                          │
│  commands:                                                    │
│    source_config_get / source_config_save                     │
│    source_credential_secret_set / source_credential_delete    │
│    jira_source_test_connection                                │
└───────────────────────────────────────────────────────────────┘
```
The command surface mirrors the AI provider configuration pattern: metadata is saved as one versioned shared setting, while secret writes use source-specific wrappers around the keychain primitive. This keeps validation and key naming centralized.
### Source config schema

Store all source metadata as one versioned shared setting:
```plain text
key: sources.config
```
Rust model shape:
```rust
pub struct SourcesConfig {
    pub version: u16,              // starts at 1
    pub sources: Vec,
}

pub enum SourceConfig {
    Jira(JiraSourceConfig),
}

pub struct JiraSourceConfig {
    pub id: String,                // generated stable id, e.g. src_01...
    pub name: String,              // user label or derived host
    pub enabled: bool,
    pub server_url: String,        // normalized, no trailing slash
    pub auth: JiraAuthConfig,
    pub projects: Vec,
    pub last_connection_test: Option,
    pub created_at: String,
    pub updated_at: String,
}

pub enum JiraAuthConfig {
    Pat { credential_ref: String },
}

pub struct JiraProjectFilter {
    pub key: String,
    pub name: Option,
    pub id: Option,
}

pub struct ConnectionTestSummary {
    pub status: ConnectionTestStatus,
    pub tested_at: String,
    pub message: String,
}
```
`credential_ref` is an opaque reference generated by `hm`, not user-entered text. The production keychain key should include the source id, for example `source.jira..pat`, so deleting a source can delete its owned credential deterministically.
### Validation rules

- `SourcesConfig.version` must be supported.
- Source ids must be unique and stable after creation.
- Source names must be non-empty after deriving a default.
- Jira server URLs must parse as URLs.
- Jira server URLs must use `https`, except `http://localhost` and `http://127.0.0.1` are allowed for local tests.
- Jira server URLs must not contain credentials, query strings, or fragments.
- Jira project keys must be non-empty, unique per source, and safe to display.
- Credential refs must match the source-owned key format.
- Saved metadata must not contain fields with secret-shaped names such as `token`, `pat`, `password`, `secret`, or `authorization`.
### Command behavior

**`source_config_get() -> SourcesConfig`**
- Reads `sources.config` from shared settings.
- Returns an empty version-1 config if missing.
- Normalizes and validates loaded data before returning it.
**`source_config_save(config: SourcesConfig) -> Result`**
- Validates config before saving.
- Writes metadata to SQLite shared settings.
- Rejects any payload that appears to contain a secret value.
**`source_credential_secret_set(source_id: String, kind: SourceCredentialKind, value: String) -> CredentialRef`**
- Validates the source id and credential kind.
- Stores the PAT in the keychain.
- Returns the generated credential ref.
- Does not log or return the secret value.
**`source_credential_delete(credential_ref: String) -> Result`**
- Deletes a source-owned keychain credential.
- Treats missing credentials as a safe no-op.
**`jira_source_test_connection(source: JiraSourceConfig, pending_pat: Option) -> JiraConnectionTestResult`**
- Uses `pending_pat` for unsaved forms when provided, without storing it first.
- Otherwise loads the PAT from keychain using `credential_ref`.
- When issue #9 is implemented, calls the Jira API client to fetch accessible projects through `GET /rest/api/2/project`.
- Before issue #9 is implemented, returns `Unavailable` with a clear message and no network call.
- Maps upstream failures to safe categories: invalid URL, auth failed, forbidden, network error, rate limited, server error, unsupported, unavailable.
The DB lock must not be held while reading from keychain or making network calls.
### Frontend module layout

```plain text
src/sources/
  types.ts            SourceConfig, JiraSourceConfig, test result types
  defaults.ts         empty config and new-source defaults
  validation.ts       URL, project, and metadata validation
  storage.ts          wrappers around generated source commands

src/settings/sources/
  SourcesSettings.tsx
  SourceList.tsx
  AddSourceFlow.tsx
  JiraSourceForm.tsx
  ProjectMultiSelect.tsx
  ConnectionTestStatus.tsx
```
The UI should keep an unsaved PAT only in component state long enough to call the keychain command or connection-test command. It should clear that state after save, cancel, successful credential replacement, or unmount.
### Security, privacy, and compliance

- Jira PAT values live only in transient form state and the OS keychain.
- Jira PAT values must never be stored in SQLite shared settings, app preferences, source files, generated bindings, logs, errors, snapshots, or tests.
- The configured-source list must never display token values.
- Connection-test errors must use safe summaries.
- Remove-source cleanup must delete the source-owned keychain credential.
- No telemetry, remote error reporting, or analytics are added.
### Testing plan

**Rust unit tests:**
- Validate empty config default load.
- Round-trip a Jira source through shared settings.
- Reject metadata that contains secret-shaped fields.
- Normalize server URLs and reject invalid schemes, embedded credentials, queries, and fragments.
- Store, retrieve by credential ref, and delete source PATs using the in-memory secret store.
- Remove-source helper deletes owned credential refs and leaves unrelated credentials alone.
- Connection-test adapter returns `Unavailable` when the Jira API client feature is absent.
- Connection-test adapter maps mock Jira API client outcomes to safe result categories when issue #9 is available.
**Frontend unit and component tests:**
- Settings sidebar includes Sources.
- Empty state and Add source flow render.
- Jira is enabled while GitHub and Documents are disabled or marked coming later.
- Server URL and PAT validation control Save/Test availability.
- PAT field clears after save/cancel.
- Configured-source list shows host, kind, project summary, and last test result without secrets.
- Edit flow can replace a PAT without displaying the old PAT.
- Remove flow confirms, deletes metadata, and calls credential cleanup.
**End-to-end smoke path:**
- Open Settings → Sources → Add source → choose Jira → enter local mock Jira URL and PAT → test connection → choose projects → save → close/reopen Settings → source remains visible.
If the Jira API client from issue #9 is not available yet, the end-to-end path should assert the explicit unavailable connection-test state and verify that safe metadata can still be saved only when no project discovery is required.
### Risks

- Issue #9 may land after this enhancement. Mitigation: ship a clear `Unavailable` state for live test and isolate the Jira client behind an adapter.
- Keychain behavior differs across operating systems and CI. Mitigation: keep production keychain behind the existing trait and use in-memory stores for automated tests.
- Saving a source before live project discovery could create incomplete metadata. Mitigation: allow save only for valid server/auth metadata, keep projects empty, and show that ingestion cannot run until projects are selected.
- Users may rotate Jira PATs outside `hm`. Mitigation: edit flow supports token replacement and safe re-test.
## Task list

- [ ] **Story: Source configuration model and storage**
	- [ ] **Task: Add Rust source config schema and validation**
		- **Description**: Create `src-tauri/src/sources/config.rs` with versioned source config types, Jira source types, URL normalization, project validation, credential-ref validation, and secret-shaped metadata rejection.
		- **Acceptance criteria**:
			- [ ] `SourcesConfig` supports version 1 and a list of Jira sources
			- [ ] Missing config normalizes to an empty version-1 config
			- [ ] Source ids are unique and stable
			- [ ] Jira server URLs are normalized and validated
			- [ ] Project keys are non-empty and unique per source
			- [ ] Metadata with token/password/secret-shaped fields is rejected
		- **Dependencies**: Issue #4 shared settings primitive
	- [ ] **Task: Persist source config in shared settings**
		- **Description**: Add typed helpers and Tauri commands for reading and saving `sources.config` in SQLite shared settings.
		- **Acceptance criteria**:
			- [ ] `source_config_get` returns an empty config when `sources.config` is missing
			- [ ] `source_config_save` validates before writing
			- [ ] Jira source metadata round-trips through SQLite
			- [ ] Secret values are not present in stored JSON
			- [ ] Generated TypeScript bindings include the new commands
		- **Dependencies**: Source config schema and validation
- [ ] **Story: Source-owned Jira credentials**
	- [ ] **Task: Add source credential keychain helpers**
		- **Description**: Add source-specific wrappers around the existing secret store so Jira PATs use generated source credential refs.
		- **Acceptance criteria**:
			- [ ] New Jira sources receive a credential ref such as `source.jira..pat`
			- [ ] PAT values store in keychain through the managed secret store
			- [ ] Missing credentials return safe errors for test connection
			- [ ] Delete treats missing credentials as a no-op
			- [ ] Unit tests use the in-memory secret store
		- **Dependencies**: Source config schema
	- [ ] **Task: Clean up credentials when removing a source**
		- **Description**: Add removal logic that deletes source metadata and its owned keychain credential together from the user's point of view.
		- **Acceptance criteria**:
			- [ ] Removing a Jira source deletes its shared-settings metadata
			- [ ] Removing a Jira source deletes its PAT credential ref
			- [ ] Unrelated credentials are not deleted
			- [ ] Partial cleanup failure returns a safe message and leaves enough state for retry
		- **Dependencies**: Source credential helpers, source config persistence
- [ ] **Story: Jira connection test and project discovery**
	- [ ] **Task: Add Jira connection-test adapter**
		- **Description**: Add a Rust adapter that tests a Jira source with either a pending PAT or saved credential ref and returns safe typed result states.
		- **Acceptance criteria**:
			- [ ] Adapter does not hold the DB lock while reading keychain or making network calls
			- [ ] Before issue #9 lands, adapter returns an explicit `Unavailable` result
			- [ ] When issue #9 is available, adapter fetches accessible projects through the Jira API client
			- [ ] Auth, permission, network, rate limit, and server failures map to safe messages
			- [ ] Errors never include PAT values, headers, or raw response bodies
		- **Dependencies**: Source credential helpers; soft dependency on issue #9
	- [ ] **Task: Return Jira project metadata for the UI**
		- **Description**: Shape successful connection-test responses so the frontend can populate a project multi-select with project key, name, and id.
		- **Acceptance criteria**:
			- [ ] Success result includes project key and name when available
			- [ ] Project keys are deduplicated and sorted consistently
			- [ ] Empty project access returns a safe success-with-no-projects state
			- [ ] Mock-client tests cover populated, empty, and failed responses
		- **Dependencies**: Jira connection-test adapter
- [ ] **Story: Sources Settings UI**
	- [ ] **Task: Add Sources category to Settings panel**
		- **Description**: Extend the Settings sidebar and category routing with a Sources tab.
		- **Acceptance criteria**:
			- [ ] Sidebar shows General, Appearance, Sources, and AI providers
			- [ ] Sources tab has an accessible heading and description
			- [ ] Existing General, Appearance, and AI provider tests still pass
			- [ ] Keyboard navigation and focus behavior remain accessible
		- **Dependencies**: Issue #5 settings panel shell
	- [ ] **Task: Build configured-source list**
		- **Description**: Show current sources with kind, host/name, selected projects, last test status, and edit/remove actions.
		- **Acceptance criteria**:
			- [ ] Empty state prompts the user to add a source
			- [ ] Jira source rows show name or host, server host, project summary, and status
			- [ ] Rows never show PAT values or credential refs as user-facing text
			- [ ] Edit opens the Jira form with metadata loaded
			- [ ] Remove asks for confirmation
		- **Dependencies**: Source config get/save commands
	- [ ] **Task: Build Add source flow and Jira form**
		- **Description**: Add the source-kind selector and Jira-specific form for server URL, PAT auth, connection test, and project selection.
		- **Acceptance criteria**:
			- [ ] Jira is selectable as the only enabled source kind
			- [ ] GitHub and Documents are visible as coming later or omitted deliberately
			- [ ] New-source PAT is required before save or live test
			- [ ] Edit-source PAT replacement is optional
			- [ ] PAT state clears after save, cancel, replacement, and unmount
			- [ ] Save writes metadata and stores/replaces the PAT in keychain
		- **Dependencies**: Source credential commands, source config commands
	- [ ] **Task: Wire connection-test and project multi-select UI**
		- **Description**: Connect the Jira form to `jira_source_test_connection` and populate project choices from successful results.
		- **Acceptance criteria**:
			- [ ] Test button shows not-tested, testing, success, error, and unavailable states
			- [ ] Project multi-select is disabled until project data exists
			- [ ] Successful tests populate project choices
			- [ ] Safe errors show suggested fixes
			- [ ] Unavailable state clearly names the issue #9 dependency
		- **Dependencies**: Jira connection-test commands, Add source flow
- [ ] **Story: Validation, documentation, and handoff**
	- [ ] **Task: Add tests for storage, credentials, UI, and connection-test behavior**
		- **Description**: Cover Rust helpers, frontend validation, component flows, and an end-to-end smoke path where practical.
		- **Acceptance criteria**:
			- [ ] Rust tests cover source config round-trip and keychain PAT behavior
			- [ ] Frontend tests cover Sources tab, Add source, edit, remove, and no-secret rendering
			- [ ] Connection-test tests cover unavailable mode and mock-client results when available
			- [ ] E2E smoke path covers adding and reopening a Jira source or the documented unavailable fallback
		- **Dependencies**: All implementation tasks
	- [ ] **Task: Update durable agent context**
		- **Description**: Update `context-agent/wiki/code-map.md` and testing notes with the source configuration module layout, command names, shared setting key, credential-ref pattern, and test strategy.
		- **Acceptance criteria**:
			- [ ] Code map documents Rust and React source configuration modules
			- [ ] Testing notes document keychain mock strategy and Jira client soft dependency
			- [ ] Source config shared setting key and credential-ref pattern are recorded
		- **Dependencies**: Implementation module layout chosen
	- [ ] **Task: Run validation checks**
		- **Description**: Run narrow checks first, then broader project checks available in the repository.
		- **Acceptance criteria**:
			- [ ] Relevant Rust tests pass
			- [ ] Relevant frontend unit/component tests pass
			- [ ] `npm run lint` passes if still defined
			- [ ] `npm test` passes if still defined
			- [ ] `npm run build` passes if still defined
			- [ ] Any skipped live Jira test is documented with the reason
		- **Dependencies**: All implementation and test tasks