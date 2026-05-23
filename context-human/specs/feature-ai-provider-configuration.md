---
created: 2026-05-23
last_updated: 2026-05-23
status: draft
issue: 7
specced_by: markdstafford
implemented_by: markdstafford
superseded_by: null
---

# AI provider configuration

## What

`hm` needs a configurable AI provider layer based on ADR-006. This feature adds the Rust schema, storage, runtime resolver, and Settings UI needed to configure credentials, endpoints, profiles, and task routing without changing code.

Users define credentials, connect those credentials to provider endpoints, create model profiles, and route named `hm` tasks (like `issue.triage` or `chat.answer`) to the right profile. The Rust core resolves the full provider path at call time through a single `ai_call(task_name, request)` abstraction.

Configuration follows ADR-008: secret values live in the OS keychain or come from environment variables; non-secret provider metadata lives in SQLite shared settings. The Settings panel gains an AI providers tab with editors for the four config layers and a profile smoke-test button.

## Why

`hm` will use AI for ticket enrichment, duplicate classification, roadmap extraction, chat answers, retrieval reranking, and status drafts. These tasks do not all need the same model — some should use fast, low-cost models while others need stronger models or provider-specific features.

A hardcoded provider would block organization policy changes and make outages harder to work around. A shared provider layer lets `hm` add AI features safely: each call names a task, and configuration decides which approved profile handles it. A smoke-test button catches missing keys, wrong URLs, and routing mistakes before a later feature fails.

## Personas

- **Elena: EM** — wants reliable AI-backed triage and reporting. She needs `hm` to use approved providers and fail early when configuration is wrong.
- **Priya: PM** — benefits when roadmap extraction and status summaries use the model tier selected for those tasks. She should not need to understand API keys to trust that setup has been checked.
- **Tarek: Team member** — experiments with local and organization-approved models. He needs a settings UI that shows how a task gets routed without forcing him to edit files by hand.
- **Future AI feature implementer** — calls one Rust API with a task name. They should not reimplement provider lookup, secret loading, or request formatting.

## Narratives

### Elena verifies the strong triage model

Elena opens Settings and selects AI providers. The credentials list shows an Anthropic key stored in the keychain and an OpenAI-compatible gateway key loaded from an environment variable. Neither secret value is visible.

She opens the profiles section and sees `triage-authoring` using an Anthropic endpoint and a high-quality model. She clicks Smoke test. `hm` sends a minimal prompt through the same resolver used by future AI calls and shows a success result with the profile, model, and latency.

Elena checks the routing matrix and confirms `issue.triage` routes to `triage-authoring`, while `intent.classify` routes to a cheaper OpenAI-compatible model.

### Tarek fixes a broken endpoint

Tarek adds a new OpenAI-compatible endpoint for an internal gateway. He enters the base URL, selects the protocol, and links it to an existing credential. He creates a profile, chooses the endpoint, enters the model, and selects an OpenAI-compatible runner.

When he runs a smoke test, the request fails with a concise message: "Endpoint returned 401. Check the selected credential." The error does not include the key, headers, or request body. Tarek replaces the credential secret and retries. The smoke test succeeds, and the routing matrix lets him assign `chat.answer` to the new profile.

### A future feature routes an AI task

A developer builds roadmap extraction. They define a task name `roadmap.extract` and call the provider abstraction with the prompt. At runtime, `hm` loads current provider config, validates the routing path, loads the secret, and dispatches to the profile's runner. If the route is missing, the call returns a typed error: "No AI profile is routed for roadmap.extract."

## User stories

**Elena verifies the strong triage model**

- Elena can see her credentials listed with source and status but no secret values visible
- Elena can open profiles and see which endpoint and model each uses
- Elena can smoke-test a profile and see success with profile, model, and latency
- Elena can check the routing matrix to confirm which profile handles each task
- Elena can route AI tasks to profiles using dotted task names like `issue.triage`

**Tarek fixes a broken endpoint**

- Tarek can add a new endpoint with base URL, protocol, and credential reference
- Tarek can create a profile linking an endpoint, model, and runner
- Tarek can smoke-test a profile and see a safe error message with a suggested fix
- Tarek can replace a credential secret and re-run the smoke test
- Tarek can assign a task to a profile in the routing matrix

**A future feature routes an AI task**

- Future implementer can call `ai_call(task_name, request)` without knowing storage details
- Future implementer can see a typed safe error when a route is missing
- Future implementer can trust that resolution loads fresh config at call time

## Goals

- Add typed Rust and TypeScript models for ADR-006's four config layers
- Store credential metadata and non-secret config in SQLite shared settings
- Store secret values in OS keychain through existing secret commands
- Support environment-variable credentials without copying secrets into SQLite
- Add an AI providers Settings tab with sections for credentials, endpoints, profiles, and routing
- Add validation for missing references, duplicate names, and unsupported combinations
- Add a profile smoke-test action using the same resolver as normal calls
- Add `ai_call(task_name, request)` as a Rust service method
- Exercise Anthropic native and OpenAI-compatible runners in tests
- Keep provider behavior local-first and single-user

## Non-goals

- No full chat interface, ticket enrichment workflow, or retrieval pipeline
- No source-system provider setup for GitHub, Jira, or docs
- No settings import/export UI
- No secret display after save
- No automatic provider discovery from cloud accounts
- No billing, quota, or cost dashboard
- No guarantee that every protocol has a production runner yet — unsupported must fail clearly

## Design spec

### Information architecture

Settings sidebar after this feature:
```
Settings
├── General
├── Appearance
└── AI providers
```

### AI providers layout

```
AI providers
├── Header: AI providers
│   └── Description: Configure credentials, endpoints, model profiles, and task routing.
├── Credentials section
│   ├── Empty state or credential list (name, kind, source, status)
│   └── Add / edit / replace secret / delete
├── Endpoints section
│   ├── Empty state or endpoint list (name, protocol, host, credential)
│   └── Add / edit / delete
├── Profiles section
│   ├── Empty state or profile list (name, runner, model, endpoint, smoke-test state)
│   └── Add / edit / smoke test / delete
└── Routing section
    ├── Task-to-profile matrix (task name, profile select)
    └── Add / edit / delete route
```

### Empty states

- No credentials: "Add a credential before creating endpoints. Secrets are stored in the OS keychain or read from environment variables."
- No endpoints: "Add an endpoint that points to an approved provider or gateway."
- No profiles: "Create a profile by choosing an endpoint, model, and runner."
- No routes: "Route AI tasks to profiles. Future features call task names such as issue.triage."

### Smoke-test states

Not run → Running → Success (profile, model, latency, short preview) or Error (safe summary + suggested fix like "Check base URL" or "Check credential")

## Tech spec

### Introduction and overview

**Prerequisites:**
- ADR-006 (AI provider abstraction)
- ADR-008 (settings split)
- Issue #4 — settings storage primitives (shared settings + secrets)
- Issue #5 — settings panel shell

**Goals:**
- Provider resolution at call time (not only startup)
- All runner tests use mock HTTP servers, no real credentials
- Secret values never in SQLite, logs, errors, or generated bindings

### System design and architecture

```
┌────────────────────────────────────────────────────────┐
│ React                                                   │
│  SettingsPanel → AiProvidersSettings                   │
│    CredentialsSection / EndpointsSection /              │
│    ProfilesSection / RoutingSection / SmokeTestStatus  │
│  src/aiProviders/ (types, validation, storage wrappers)│
└─────────────────────────┬──────────────────────────────┘
                          │ generated bindings
┌─────────────────────────┴──────────────────────────────┐
│ Rust                                                    │
│  src-tauri/src/ai/                                     │
│    config.rs      schema, defaults, serde, validation  │
│    errors.rs      safe Display, typed variants         │
│    resolver.rs    route→profile→endpoint→credential    │
│    credentials.rs keychain/env secret loading          │
│    service.rs     ai_call + smoke_test_profile         │
│    runners/                                            │
│      anthropic.rs                                      │
│      openai.rs                                         │
│  commands: ai_provider_config_get/save,                │
│    ai_credential_secret_set/delete,                    │
│    ai_profile_smoke_test, (ai_call internal)           │
└────────────────────────────────────────────────────────┘
```

### Detailed design

**Provider config schema (stored as single versioned shared setting `ai.providers.config`):**
```rust
pub struct AiProviderConfig {
    pub version: u16,              // starts at 1
    pub credentials: Vec<AiCredential>,
    pub endpoints: Vec<AiEndpoint>,
    pub profiles: Vec<AiProfile>,
    pub routing: BTreeMap<String, String>,  // task_name → profile_name
}
```

Credentials: `name`, `kind` (ApiKey, BearerToken, AwsIamProfile), `source` (Keychain { key_ref } or Env { var_name }). Env stores only the variable name, never the value.

Endpoints: `name`, `protocol` (Anthropic, OpenAiCompatible), `base_url`, `credential_ref`.

Profiles: `name`, `endpoint_ref`, `model`, `runner` (AnthropicDirect, OpenAiCompatibleDirect), `settings` (serde_json::Value for model-specific options, must not contain secrets).

**Validation rules:**
- Names unique within each layer
- References must resolve within config
- Unsupported protocol/runner combos rejected
- Settings rejects known secret-shaped keys

**Runtime resolver:** Reads latest config from shared settings at call time. Follows routing → profile → endpoint → credential. Loads secret from keychain or env. Does not hold SQLite lock during keychain/env work.

**Request/response model:**
```rust
pub struct AiRequest {
    pub system: Option<String>,
    pub messages: Vec<AiMessage>,
    pub max_output_tokens: Option<u32>,
    pub temperature: Option<f32>,
}
pub struct AiResponse {
    pub text: String,
    pub model: String,
    pub profile: String,
    pub usage: Option<AiUsage>,
}
```

**Runners:**
- Anthropic direct: Messages API, API-key header from secret, text-only for now
- OpenAI-compatible direct: `/chat/completions`, Bearer auth from secret, text-only for now

**Smoke test:** Same resolver/runner path as normal calls. Minimal prompt ("reply with ok"). Result includes status, profile, model, elapsed, preview or safe error.

### Security, privacy, and compliance

- Secrets never in SQLite, TOML, source files, generated bindings, logs, tests, or error strings
- Authorization headers redacted in all errors
- No telemetry or remote error reporting
- Reasonable request timeouts to prevent hangs from bad config

### Testing plan

**Rust:**
- Schema: defaults, serde round-trip, validation errors
- Resolver: each missing-reference path
- Credentials: keychain (in-memory store) and env source
- Runners: mock HTTP server for Anthropic and OpenAI-compatible success/error
- Redaction: assert known fake secrets don't appear in safe errors
- Binding generation updated for new commands

**Frontend:**
- Validation: duplicate names, missing refs, invalid URLs, unsupported combos
- Components: AI providers tab, empty states, add/edit/delete flows, routing, smoke-test states
- Mocked bindings, no real Tauri IPC
- Axe smoke coverage

**E2E:**
- Playwright: open Settings, navigate to AI providers, verify tab heading and empty state

### Risks

- Provider APIs differ more than common request model allows — keep first AiRequest text-only, extend later
- Secrets leak through errors or tests — centralize error mapping, add redaction tests
- Settings UI too dense — use four stacked sections first, move to detail panels if needed
- Env credentials behave differently in packaged app — treat missing vars as safe errors, document
- Unsupported provider kinds confuse users — only show supported choices in UI, fail clearly for schema-only kinds

## Task list

- [ ] **Story: Provider config model and validation**
  - [ ] **Task: Add Rust AI config schema**
    - **Description**: Add typed structs/enums for credentials, endpoints, profiles, routing, defaults, and serde support.
    - **Acceptance criteria**:
      - [ ] AiProviderConfig with version, credentials, endpoints, profiles, routing
      - [ ] CredentialSource supports keychain and env without storing secrets
      - [ ] Protocol and runner enums cover Anthropic and OpenAI-compatible
      - [ ] Missing shared setting maps to empty version-1 config
      - [ ] Serde round-trip tests pass
    - **Dependencies**: None
  - [ ] **Task: Add validation helpers**
    - **Description**: Validate full provider config before save and before runtime resolution.
    - **Acceptance criteria**:
      - [ ] Duplicate names rejected within each layer
      - [ ] Missing references rejected with distinct safe errors
      - [ ] Unsupported protocol/runner combos rejected
      - [ ] Settings rejects known secret-shaped keys
      - [ ] Unit tests cover valid and invalid configs
    - **Dependencies**: Config schema
  - [ ] **Task: Persist config through shared settings**
    - **Description**: Typed helpers for read/write of `ai.providers.config` in shared settings.
    - **Acceptance criteria**:
      - [ ] Missing config returns empty defaults
      - [ ] Save validates first
      - [ ] Load validates stored config
      - [ ] In-memory SQLite tests cover all paths
    - **Dependencies**: Config schema, validation

- [ ] **Story: Credential secret operations**
  - [ ] **Task: Add AI credential secret helpers**
    - **Description**: Map credential names to keychain keys and load secrets from keychain or env.
    - **Acceptance criteria**:
      - [ ] Deterministic keychain key format: `ai.credentials.<name>`
      - [ ] Env credentials read variable at call time
      - [ ] Missing secrets return distinct safe errors
      - [ ] Tests use in-memory secret store
    - **Dependencies**: Config schema
  - [ ] **Task: Expose secret set/delete commands**
    - **Description**: UI-facing commands for AI credential secrets.
    - **Acceptance criteria**:
      - [ ] `ai_credential_secret_set` and `ai_credential_secret_delete` exist
      - [ ] Commands validate names, return safe errors
      - [ ] TypeScript bindings regenerated
      - [ ] Error strings don't include fake secrets in tests
    - **Dependencies**: Credential helpers

- [ ] **Story: Runtime resolver and runners**
  - [ ] **Task: Add provider resolver**
    - **Description**: Resolve task_name to profile, endpoint, credential, and loaded secret.
    - **Acceptance criteria**:
      - [ ] Reads latest config at call time
      - [ ] Follows routing → profile → endpoint → credential
      - [ ] Missing errors are distinct and safe
      - [ ] No SQLite lock held during keychain/env work
      - [ ] Unit tests cover success and each failure path
    - **Dependencies**: Config persistence, credential helpers
  - [ ] **Task: Add AI request/response models and service API**
    - **Description**: AiRequest, AiResponse, and ai_call service method.
    - **Acceptance criteria**:
      - [ ] Text-only request model with system, messages, max_tokens, temperature
      - [ ] Response includes text, model, profile, usage
      - [ ] ai_call resolves config at call time
      - [ ] Unsupported runner errors are safe
      - [ ] Unit tests with fake runner
    - **Dependencies**: Resolver
  - [ ] **Task: Implement Anthropic direct runner**
    - **Description**: Minimal Anthropic Messages API runner.
    - **Acceptance criteria**:
      - [ ] Builds valid text request
      - [ ] Auth header from secret, never logged
      - [ ] Mock-server tests for success and error
    - **Dependencies**: Service API
  - [ ] **Task: Implement OpenAI-compatible direct runner**
    - **Description**: Minimal /chat/completions runner.
    - **Acceptance criteria**:
      - [ ] Builds valid request
      - [ ] Bearer auth from secret, never logged
      - [ ] Mock-server tests for success and error
    - **Dependencies**: Service API
  - [ ] **Task: Add profile smoke-test command**
    - **Description**: Smoke-test method and Tauri command using same resolver/runner path.
    - **Acceptance criteria**:
      - [ ] `ai_profile_smoke_test` Tauri command exists
      - [ ] Uses same path as normal calls
      - [ ] Result includes status, profile, model, elapsed, preview or safe error
      - [ ] TypeScript bindings regenerated
    - **Dependencies**: Anthropic runner, OpenAI runner

- [ ] **Story: AI providers Settings UI**
  - [ ] **Task: Add frontend types, validation, and storage wrappers**
    - **Description**: TypeScript models, client validation, and command wrappers.
    - **Acceptance criteria**:
      - [ ] Types mirror Rust schema
      - [ ] Defaults handle missing config
      - [ ] Client validation covers duplicates, missing refs, invalid URLs
      - [ ] Unit tests with mocked bindings
    - **Dependencies**: Final command names from Rust tasks
  - [ ] **Task: Add AI providers tab to Settings**
    - **Description**: Extend settings sidebar with AI providers category.
    - **Acceptance criteria**:
      - [ ] Sidebar includes General, Appearance, AI providers
      - [ ] Tab loads config when selected
      - [ ] Loading, empty, error, loaded states visible and keyboard reachable
      - [ ] Existing tabs unaffected
      - [ ] Component tests and axe coverage
    - **Dependencies**: Frontend types
  - [ ] **Task: Build credentials and endpoints sections**
    - **Description**: Forms and list rows for credential metadata and endpoints.
    - **Acceptance criteria**:
      - [ ] Add/edit/delete credentials with keychain or env source
      - [ ] Set/replace secrets without revealing saved values
      - [ ] Add/edit/delete endpoints
      - [ ] Dependency validation prevents deleting used credentials
      - [ ] Component tests cover flows
    - **Dependencies**: AI providers tab
  - [ ] **Task: Build profiles and smoke-test section**
    - **Description**: Profile forms and smoke-test UI.
    - **Acceptance criteria**:
      - [ ] Add/edit/delete profiles
      - [ ] Runner validation based on protocol
      - [ ] Smoke-test shows not-run/running/success/error states
      - [ ] Dependency validation prevents deleting used endpoints
      - [ ] Component tests with mocked commands
    - **Dependencies**: AI providers tab, smoke-test command
  - [ ] **Task: Build routing matrix**
    - **Description**: Task-to-profile route editing.
    - **Acceptance criteria**:
      - [ ] Add/edit/delete route rows
      - [ ] Dotted task names accepted
      - [ ] Missing/duplicate tasks rejected
      - [ ] Missing profiles rejected
      - [ ] Component tests cover CRUD and validation
    - **Dependencies**: Profiles section

- [ ] **Story: Validation and documentation**
  - [ ] **Task: Update bindings and agent context**
    - **Description**: Regenerate bindings, document AI module in agent context.
    - **Acceptance criteria**:
      - [ ] src/bindings.ts includes all AI provider commands
      - [ ] code-map.md documents AI module, settings key, commands, runner pattern
      - [ ] testing.md documents mock-server strategy and limitations
    - **Dependencies**: All command tasks
  - [ ] **Task: Add e2e smoke coverage**
    - **Description**: Playwright path for AI providers tab.
    - **Acceptance criteria**:
      - [ ] Opens Settings, selects AI providers
      - [ ] Verifies tab heading and empty state
      - [ ] No real keychain or credentials needed
    - **Dependencies**: AI providers tab
  - [ ] **Task: Run validation checks**
    - **Description**: All project checks pass.
    - **Acceptance criteria**:
      - [ ] cargo test passes
      - [ ] npm run lint passes
      - [ ] npm test passes
      - [ ] npm run build passes
      - [ ] npm run test:e2e passes or limitation documented
    - **Dependencies**: All tasks
