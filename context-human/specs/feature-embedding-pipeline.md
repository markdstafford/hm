---
created: 2026-05-29
last_updated: 2026-05-29
status: complete
issue: 12
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Embedding pipeline

## What

`hm` needs a reusable embedding pipeline for source-backed text. This feature takes rows from `indexable_documents`, generates vector embeddings through the ADR-006 AI provider layer, and stores those vectors in `sqlite-vec` so later features can ask for nearest-neighbor candidates without re-crawling Jira.
The first supported entity set is Jira issue data produced by issue #10: issue title/body documents and comment documents. The pipeline must stay source-neutral enough that later GitHub PRs, GitHub issues, docs, and roadmap items can use the same queue, provider routing, storage, and nearest-neighbor search path. It should not bake Jira-specific assumptions into vector storage.
Issue #12 is foundational for issue #13 duplicate detection. It does not decide duplicate confidence, merge actions, user review UI, or structural reranking weights. It only makes fresh embeddings available and exposes a tested candidate-generation API over `sqlite-vec`.
## Why

`hm` cannot find duplicate or related work reliably from structured fields alone. Two issues can describe the same bug with different words, labels, or components. ADR-007 solves this with two-pass retrieval: vector search produces high-recall candidates, then a later structural pass reranks them.
Issue #10 already writes deterministic `indexable_documents` rows and marks them `pending` or `stale` when content changes. Without issue #12, those rows never become searchable vectors. This feature closes that gap and gives duplicate detection, related-item exploration, and future chat retrieval a shared candidate-generation foundation.
## Personas

- **Elena: EM** — wants future backlog hygiene suggestions to find likely duplicates even when reporters use different words.
- **Priya: PM** — wants roadmap and issue context to surface related work without relying on exact labels or manually maintained links.
- **Tarek: Team member** — wants local search and future chat answers to find semantically similar issues and comments when he does not know the exact Jira title.
- **Future duplicate-detection implementer** — needs a stable API that returns vector candidates with scores and enough metadata for issue #13's structural reranker.
- **Maintainer** — needs deterministic tests, safe provider errors, and idempotent embedding jobs that do not leak issue content or secrets into logs.
## Narratives

### Elena refreshes embeddings after Jira ingestion

Elena runs Jira issue ingestion for the AMP project. Issue #10 saves current issue data and creates or updates `indexable_documents` rows. When the ingestion run finishes, `hm` starts the embedding job for newly pending and stale documents.
The job routes `embedding.default` through the configured AI provider profile. It batches documents conservatively, records progress, and writes vector rows inside SQLite. If a provider error interrupts the run, Elena sees a safe status such as "Embedding paused: check the embedding provider route." Already embedded documents remain usable, and retrying the job resumes from the remaining pending or stale rows.
### Tarek searches for similar context

Tarek is investigating `AMP-123`, a bug whose title does not match earlier reports. A future feature asks the embedding candidate generator for nearby issue documents. The search returns issues with similar descriptions, including one older ticket with different labels and no direct Jira link.
The result is only a candidate list. It includes vector distance, document ids, entity ids, work item ids, source ids, and content hashes. A later reranker can combine those candidates with labels, projects, teams, dates, and relationships before showing a confidence score to Tarek.
### A provider model changes without reingesting Jira

Priya's organization switches the approved embedding model. The maintainer updates the AI provider configuration so `embedding.default` points to the new profile. `hm` marks existing embeddings from the old model as needing refresh and runs the embedding job again over the existing `indexable_documents`.
The pipeline does not call Jira during this refresh. It reads the local documents, generates new vectors, stores them with the new model identity and dimension, and leaves old vectors ignored or safely removed according to the selected implementation path.
## User stories

**Elena refreshes embeddings after Jira ingestion**
- Elena can run Jira ingestion and have newly created issue/comment documents become eligible for embedding.
- Elena can trigger or rely on a post-ingestion embedding refresh for pending and stale documents.
- Elena can see a safe embedding status for a source or run when embeddings are running, complete, paused, failed, or partially complete.
- Elena can retry after a provider failure without duplicating vector rows or re-embedding already fresh rows.
**Tarek searches for similar context**
- Tarek can query nearest neighbors for an embedded document or ad hoc query text through a Rust service API used by future features.
- Tarek can get candidate results with source id, entity kind, entity id, work item id, document id, content hash, model id, and vector distance.
- Tarek can trust that candidates do not include the source document itself unless the caller explicitly asks for it.
- Tarek can get a clear "embedding unavailable" response when no fresh embedding exists.
**Future duplicate-detection implementer uses the foundation**
- Future duplicate detection can request top-K candidate work items from a source-neutral embedding service.
- Future duplicate detection can filter candidates by source system, entity kind, project metadata, or work item kind before reranking.
- Future duplicate detection can rely on stable document ids and content hashes to detect stale candidate data.
- Future duplicate detection can treat the embedding service as candidate generation only, not as final duplicate confidence.
**Maintainer validates safely**
- Maintainer can run embedding tests with deterministic fake vectors and no provider credentials.
- Maintainer can run sqlite-vec nearest-neighbor tests that prove expected neighbors sort first.
- Maintainer can confirm provider secrets, authorization headers, raw provider bodies, and full issue text are not written to logs or error strings.
- Maintainer can add later entity types without creating Jira-only vector tables.
## Goals

- Add a Rust embedding service abstraction that can call an embedding provider through the ADR-006 resolver and can be replaced by deterministic fakes in tests.
- Extend the AI provider model enough to route `embedding.default` to an embedding-capable profile without breaking existing chat/completions routes.
- Generate embeddings for `indexable_documents.title + body`, with deterministic text assembly and content-hash checks.
- Store vectors in `sqlite-vec` with stable links to `indexable_documents`, source systems, entity ids, work items, model identity, dimension, and content hash.
- Track embedding state transitions on `indexable_documents`: `pending`, `embedding`, `embedded`, `stale`, `failed`, and retryable failure metadata.
- Run embedding refresh after issue ingestion and after changelog-driven re-ingestion from issue #11 when document content changes.
- Provide a nearest-neighbor candidate-generation API over stored vectors.
- Keep the implementation local-first, single-user, and safe for sensitive issue content.
- Cover the pipeline with deterministic fixture tests and sqlite-vec nearest-neighbor tests.
## Non-goals

- No duplicate detection UI, duplicate merge workflow, or duplicate confidence scoring; issue #13 owns that.
- No structural reranking implementation; ADR-007 defines the pattern, but this feature only supplies vector candidates.
- No chat interface, retrieval-augmented generation answers, or user-facing semantic search UI.
- No Jira re-crawl to create embeddings; embeddings are generated from local `indexable_documents`.
- No embedding support for source-system secrets, attachments, binary files, screenshots, or blobs.
- No remote vector database, hosted index, shared backend, or cross-user embedding sync.
- No guarantee that every configured AI provider supports embeddings. Unsupported profiles must fail clearly.
- No provider-specific cost dashboard or token accounting beyond optional usage metadata if a provider returns it.
- No automatic deletion of source records. Source reset behavior should remove dependent embedding rows through existing source-reset paths or explicit cleanup code.
## Design spec

This feature is backend-first. Any UI should be limited to existing source/run status patterns unless implementation finds a small status hook already supported by Settings → Sources.
### User-visible behavior

The ideal source status includes embedding progress only when the app already has a place to show background work:
```plain text
Settings / Sources
└── Jira — AMP Data Center
    ├── Issue sync: succeeded · 428 issues saved
    ├── Embeddings: running · 184 of 612 documents embedded
    ├── Last embedding refresh: 2026-05-29T17:24:12Z (local time)
    └── Embedding warning: Check route embedding.default (only on failure)
```
If no UI status hook exists, command/service status and tests are sufficient. The implementation must not add a broad background-job dashboard for this issue.
### Embedding flow

```plain text
Jira issue ingestion or history re-ingestion
  │
  ├─ upsert indexable_documents
  │    ├─ new content_hash → embedding_status = pending
  │    └─ changed content_hash → old row stale, new row pending
  │
  └─ trigger embedding refresh for source/project when practical
       │
       ▼
Embedding service
  ├─ load AI provider config
  ├─ resolve route embedding.default
  ├─ validate profile supports embeddings and expected dimension
  ├─ claim pending/stale documents in small batches
  ├─ assemble text from title + body
  ├─ call embedding provider with redacted error handling
  ├─ write vectors to sqlite-vec and metadata tables in one short transaction
  └─ mark documents embedded or failed with retry-safe status
```
### Text assembly

Documents use deterministic text so content hashes and embeddings are stable across runs:
```plain text
Title: 

Body:

```
For comment documents without a title:
```plain text
Body:

```
The assembled text is not stored again unless the implementation needs a short debug checksum. Full text already lives in `indexable_documents.body`. Logs and errors must use document ids, entity ids, source ids, content hashes, counts, and safe categories instead of full issue text.
### Status and error language

Safe user-facing errors:
```plain text
No embedding route configured: Add a route for embedding.default.
Unsupported embedding profile: The selected profile cannot create embeddings.
Embedding provider rejected the request: Check the selected credential and model.
Embedding paused: 184 of 612 documents were embedded. Retry to continue.
Embedding dimension changed: Rebuild embeddings for this model before searching.
```
Safe logs may include source id, document id, entity kind, entity id, model name, profile name, dimension, provider status code, and safe category. They must not include secrets, authorization headers, raw provider response bodies, or full document text.
## Tech spec

### Prerequisites and references

- Issue #7 — AI provider abstraction is implemented for chat/completion-style calls.
- Issue #10 — Jira issue ingestion writes deterministic `indexable_documents` rows and marks embedding status `pending` / `stale`.
- Issue #11 — Jira history re-ingestion updates issue documents when changelog-driven current state changes.
- Issue #13 — duplicate detection will consume vector candidates from this feature.
- ADR-004 — SQLite + sqlite-vec is the primary store.
- ADR-006 — AI calls route through configurable credentials, endpoints, profiles, and routing.
- ADR-007 — two-pass retrieval uses vector candidate generation plus structural reranking.
- ADR-008 — shared provider config lives in SQLite; secrets live in keychain or environment variables.
### Provider model changes

The current AI provider code supports text completion runners. Issue #12 needs embedding-capable profile metadata and a service path that returns vectors.
Recommended changes:
```rust
pub enum AiEndpointProtocol {
    AnthropicMessages,
    OpenAiChatCompletionsCompatible,
    OpenAiEmbeddingsCompatible,
}

pub enum AiRunner {
    AnthropicMessages,
    OpenAiChatCompletions,
    OpenAiEmbeddings,
    FakeEmbeddings, // test-only or behind cfg(test)
}

pub struct EmbeddingRequest {
    pub input: Vec,
}

pub struct EmbeddingResponse {
    pub vectors: Vec>,
    pub model: String,
    pub profile: String,
    pub dimension: usize,
    pub usage: Option,
}
```
If the implementation chooses a different enum shape, it must preserve these capabilities:
- A route named `embedding.default` can resolve to an embedding-capable profile.
- Existing chat/completion routes continue to validate and run unchanged.
- Unsupported combinations fail during config validation or resolution with safe errors.
- Tests can inject deterministic vectors without network access.
The first production runner should target OpenAI-compatible embeddings because many gateways expose `/embeddings`. Anthropic native embeddings should not be invented if the API/profile does not support them. A configured Anthropic Messages profile routed to `embedding.default` must fail clearly as unsupported.
### Embedding service module layout

```plain text
src-tauri/src/embeddings/
  mod.rs
  errors.rs              safe EmbeddingError categories and redacted Display
  provider.rs            EmbeddingProvider trait + AI-provider-backed implementation
  repository.rs          document claiming, status updates, vector metadata writes
  service.rs             run refresh, embed batch, nearest-neighbor search
  sqlite_vec.rs          sqlite-vec table setup and query helpers
```
The exact file names may vary, but provider calls, database writes, and sqlite-vec SQL should stay separated enough for deterministic unit tests.
### SQLite schema

Keep `indexable_documents` as the document queue and add vector storage beside it. `sqlite-vec` virtual-table syntax can vary by crate version, so implementation should verify syntax against the installed `sqlite-vec` version. The model responsibilities should be:
```sql
embedding_models(
  id TEXT PRIMARY KEY,                  -- stable hash or profile/model/dimension id
  provider_profile TEXT NOT NULL,
  provider_model TEXT NOT NULL,
  runner TEXT NOT NULL,
  dimension INTEGER NOT NULL,
  distance_metric TEXT NOT NULL,         -- cosine or l2, matching sqlite-vec query behavior
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  UNIQUE(provider_profile, provider_model, runner, dimension, distance_metric)
);

document_embeddings(
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES indexable_documents(id) ON DELETE CASCADE,
  source_system_id TEXT NOT NULL REFERENCES source_systems(id) ON DELETE CASCADE,
  entity_kind TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  work_item_id TEXT REFERENCES work_items(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  model_id TEXT NOT NULL REFERENCES embedding_models(id),
  dimension INTEGER NOT NULL,
  embedded_at TEXT NOT NULL,
  status TEXT NOT NULL,                  -- fresh, stale, failed if separate row tracking is needed
  error_summary TEXT,
  UNIQUE(document_id, content_hash, model_id)
);
```
Vector bytes live in a sqlite-vec virtual table keyed by `document_embeddings.id`, for example:
```sql
vec_document_embeddings(
  embedding_id TEXT PRIMARY KEY,
  embedding FLOAT[dimension]
);
```
If sqlite-vec requires integer row ids, add a stable integer surrogate in `document_embeddings` and keep `embedding_id` as metadata. The important invariant is that vector rows and metadata rows can be joined deterministically and deleted when their document or source is reset.
### Document status lifecycle

`indexable_documents.embedding_status` becomes the queue state:
- `pending` — document has never been embedded for the active embedding model.
- `embedding` — a job has claimed the document. This is transient and must be recoverable if the app exits.
- `embedded` — a fresh vector exists for the document's current content hash and active model.
- `stale` — an older content hash or model is no longer current.
- `failed` — the last attempt failed in a retryable or user-actionable way.
Implementation should also store concise failure details either on `indexable_documents` if a migration is acceptable or in an `embedding_failures` / job table. At minimum, maintainers need document id, source id, attempt count, last attempted time, safe error category, and safe summary.
On startup or before each run, documents stuck in `embedding` from an old process should be returned to `pending` or `failed` according to a conservative timeout.
### Embedding job behavior

The service should expose internal Rust APIs first:
```rust
pub struct EmbeddingRunOptions {
    pub source_system_id: Option,
    pub entity_kind: Option,
    pub limit: Option,
    pub force_rebuild: bool,
}

pub struct EmbeddingRunSummary {
    pub status: EmbeddingRunStatus,
    pub scanned: u32,
    pub embedded: u32,
    pub skipped: u32,
    pub failed: u32,
    pub model_id: String,
    pub dimension: usize,
    pub safe_error: Option,
}

pub fn refresh_embeddings(
    conn: &rusqlite::Connection,
    store: &dyn SecretStore,
    options: EmbeddingRunOptions,
) -> Result;
```
If Tauri commands are useful for manual testing or existing source status, expose a narrow command:
```rust
embedding_refresh_run(options: EmbeddingRunOptions) -> Result
embedding_status(source_system_id: Option) -> Result
```
Do not add a broad user-facing embedding settings UI in this issue. Provider routing remains in the existing AI providers configuration.
### Post-ingestion hooks

Issue #10 ingestion should call the embedding refresh path after successful page/run persistence when practical. It may be synchronous for the first implementation if it is bounded and testable, but the design should allow a background job later.
Required behavior:
- New documents from Jira ingestion become `pending` and are embedded after ingestion or by a manual refresh command.
- Changed documents become `stale` for their old content hash and get a fresh `pending` row or status for the new content hash.
- Changelog-driven re-ingestion from issue #11 uses the same document upsert behavior and therefore the same embedding refresh path.
- A failed embedding provider call must not roll back successful Jira ingestion.
- The SQLite mutex must not be held while waiting on provider HTTP calls. Claim a batch, release DB access, call provider, then take a short transaction to write vectors and statuses.
### Nearest-neighbor API

Expose a source-neutral candidate API for future issue #13 work:
```rust
pub struct EmbeddingCandidateQuery {
    pub document_id: Option,
    pub query_text: Option,
    pub source_system_id: Option,
    pub entity_kinds: Vec,
    pub work_item_kind: Option,
    pub limit: usize,
    pub exclude_entity_id: Option,
}

pub struct EmbeddingCandidate {
    pub document_id: String,
    pub entity_kind: String,
    pub entity_id: String,
    pub work_item_id: Option,
    pub source_system_id: String,
    pub content_hash: String,
    pub model_id: String,
    pub distance: f32,
}

pub fn nearest_neighbors(
    conn: &rusqlite::Connection,
    store: &dyn SecretStore,
    query: EmbeddingCandidateQuery,
) -> Result, EmbeddingError>;
```
When `document_id` is provided, use the stored fresh embedding. When `query_text` is provided, generate an embedding through `embedding.default` but do not store it unless a later feature needs query caching. The API should reject requests that provide neither or both.
### Testing plan

**Rust unit and integration tests:**
- Provider config validation accepts an embedding-capable route for `embedding.default`.
- Provider config validation rejects chat-only profiles for embedding routes or resolution.
- Fake embedding provider returns deterministic vectors for fixed text.
- Text assembly from title/body is deterministic and handles missing titles.
- Repository claiming marks documents `embedding` without claiming the same document twice in one run.
- Successful batch writes metadata rows, sqlite-vec rows, model rows, and marks documents `embedded`.
- Retry after a failed run embeds only remaining pending/failed documents according to retry rules.
- Content-hash change marks prior embedding stale and creates or updates the fresh vector for the new hash.
- Model or dimension change causes refresh/rebuild behavior and does not mix incompatible vectors in one nearest-neighbor query.
- Source reset deletes or ignores dependent embedding rows for that source.
- Redaction tests prove fake secrets, bearer tokens, provider headers, raw provider responses, and full issue bodies do not appear in errors or captured logs.
**sqlite-vec nearest-neighbor tests:**
- A deterministic fixture inserts known vectors and verifies expected nearest neighbors sort first.
- Self-match is excluded by default when searching from a document.
- Filters by source system and entity kind work before or during candidate selection.
- Missing fresh embedding returns a typed safe error.
- sqlite-vec extension unavailable is reported as a safe unsupported-environment error rather than a panic.
**Post-ingestion tests:**
- Jira ingestion fixtures still create `indexable_documents` as before.
- New issue/comment documents become eligible for embedding after ingestion.
- Re-ingestion with changed title/body creates fresh embedding work and does not duplicate current vector rows.
- Embedding failure after ingestion leaves ingestion run success/partial status intact and records embedding failure separately.
**Validation checks for implementation handoff:**
- Targeted Rust embedding tests pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` passes.
- `npm run lint` passes if TypeScript bindings or UI command wrappers change.
- `npm test` passes if frontend code changes.
- `npm run build` passes or any skipped check is explained.
### Risks and mitigations

- **Provider APIs differ for embeddings.** Start with OpenAI-compatible embeddings and make unsupported profiles fail clearly. Keep the provider trait small.
- **Embedding dimensions can change.** Store model identity and dimension with every vector set; reject nearest-neighbor queries that would compare incompatible dimensions.
- **Provider calls can be slow or expensive.** Batch conservatively, support limits, and skip already fresh documents.
- **Issue content can leak through errors.** Centralize redaction and log only ids, hashes, counts, and safe categories.
- **sqlite-vec virtual table syntax may differ by version.** Isolate sqlite-vec SQL in one module and lock behavior with tests against the installed crate.
- **Ingestion should not depend on embeddings.** Treat embedding as a follow-on job; provider failures must not roll back source ingestion.
- **Status values can drift.** Use constants/enums around `embedding_status` and schema tests to avoid unchecked string spread.
## Task list

- [ ] **Story: Provider support for embeddings**
	- [ ] **Task: Extend AI provider config for embedding profiles**
		- **Description**: Add embedding-capable protocol/runner metadata and validation so `embedding.default` can route to a vector-producing profile.
		- **Acceptance criteria**:
			- [ ] Existing chat/completion provider configs remain valid.
			- [ ] `embedding.default` can reference an embedding-capable profile.
			- [ ] Chat-only profiles routed to `embedding.default` fail with a safe unsupported-profile error.
			- [ ] Validation covers missing profile, endpoint, credential, unsupported runner, and invalid route cases.
			- [ ] Unit tests cover valid and invalid embedding configs.
		- **Dependencies**: Existing AI provider config code.
	- [ ] **Task: Add embedding provider trait and fake implementation**
		- **Description**: Introduce an internal trait for embedding batches and deterministic test fakes.
		- **Acceptance criteria**:
			- [ ] Trait accepts a batch of strings and returns vectors, model, profile, dimension, and optional usage.
			- [ ] Fake provider returns deterministic vectors for fixture text.
			- [ ] Errors use safe typed categories.
			- [ ] Tests do not require network or real credentials.
		- **Dependencies**: Embedding config support.
	- [ ] **Task: Implement OpenAI-compatible embedding runner**
		- **Description**: Add a direct API runner for OpenAI-compatible `/embeddings` endpoints through the existing resolver and secret store.
		- **Acceptance criteria**:
			- [ ] Request shape matches OpenAI-compatible embeddings for batched input.
			- [ ] Auth secret is sent on the wire but never logged.
			- [ ] Mock-server tests cover success, provider error, malformed response, and timeout.
			- [ ] Runner validates vector dimension consistency within a response.
		- **Dependencies**: Embedding provider trait.
- [ ] **Story: Embedding storage and queue state**
	- [ ] **Task: Add embedding schema**
		- **Description**: Create embedding model metadata, document embedding metadata, and sqlite-vec vector storage tied to `indexable_documents`.
		- **Acceptance criteria**:
			- [ ] Schema setup creates all embedding tables deterministically.
			- [ ] Vector rows can be joined to document metadata.
			- [ ] Unique constraints prevent duplicate fresh embeddings for the same document/content/model.
			- [ ] Source/document deletes clean up or safely orphan-proof embeddings.
			- [ ] Schema tests cover table presence, constraints, model dimension, and sqlite-vec availability.
		- **Dependencies**: Existing database setup and sqlite-vec loader.
	- [ ] **Task: Implement document claim and status helpers**
		- **Description**: Add repository helpers for claiming pending/stale documents, recording failures, and marking documents embedded.
		- **Acceptance criteria**:
			- [ ] Claiming uses small transactions and avoids duplicate claims in one run.
			- [ ] Stuck `embedding` rows can be recovered safely.
			- [ ] Status transitions cover pending, embedding, embedded, stale, and failed.
			- [ ] Failure records include attempt count, timestamp, category, and safe summary.
			- [ ] Unit tests cover normal, retry, and stale-content paths.
		- **Dependencies**: Embedding schema.
	- [ ] **Task: Implement vector write helpers**
		- **Description**: Persist provider vectors and metadata atomically after each provider batch.
		- **Acceptance criteria**:
			- [ ] Writes create or reuse `embedding_models` rows.
			- [ ] Writes insert/update vector metadata and sqlite-vec rows together.
			- [ ] Dimension mismatch fails safely and does not mark documents embedded.
			- [ ] Re-running with the same content/model is idempotent.
			- [ ] Tests verify stale old vectors are ignored by fresh queries.
		- **Dependencies**: Document status helpers.
- [ ] **Story: Embedding refresh service**
	- [ ] **Task: Build batch refresh workflow**
		- **Description**: Implement `refresh_embeddings` over pending/stale documents with batching, retry-safe summaries, and no long-held SQLite lock during provider calls.
		- **Acceptance criteria**:
			- [ ] Service can filter by source system and entity kind.
			- [ ] Service respects limit and force-rebuild options.
			- [ ] SQLite lock is released before provider HTTP calls.
			- [ ] Partial provider failures preserve already written vectors.
			- [ ] Summary reports scanned, embedded, skipped, failed, model id, dimension, status, and safe error.
		- **Dependencies**: Provider runner, vector write helpers.
	- [ ] **Task: Hook embedding refresh after ingestion**
		- **Description**: Trigger or expose embedding refresh from Jira ingestion and future re-ingestion paths without making ingestion success depend on provider success.
		- **Acceptance criteria**:
			- [ ] New issue/comment documents from Jira ingestion are eligible for refresh.
			- [ ] Changed documents from re-ingestion become stale/pending for the active model.
			- [ ] Embedding failures do not roll back Jira ingestion.
			- [ ] Tests cover successful and failed post-ingestion refresh behavior.
		- **Dependencies**: Batch refresh workflow.
	- [ ] **Task: Add narrow command/status surface if needed**
		- **Description**: Expose manual refresh/status commands only if useful for testing or existing Settings source status.
		- **Acceptance criteria**:
			- [ ] Commands return generated TypeScript bindings when added.
			- [ ] Command errors are safe strings.
			- [ ] No broad embedding settings UI is introduced.
			- [ ] Existing source status UI remains keyboard accessible if touched.
		- **Dependencies**: Batch refresh workflow.
- [ ] **Story: Candidate-generation API**
	- [ ] **Task: Implement nearest-neighbor search for stored documents**
		- **Description**: Query sqlite-vec for top-K candidates using an existing fresh document embedding.
		- **Acceptance criteria**:
			- [ ] Searches by document id return sorted candidates with distances.
			- [ ] Self-match is excluded by default.
			- [ ] Filters by source system and entity kind work.
			- [ ] Missing or stale source embedding returns a typed safe error.
			- [ ] Tests with deterministic vectors verify expected neighbor order.
		- **Dependencies**: Vector write helpers.
	- [ ] **Task: Implement ad hoc query-text candidate search**
		- **Description**: Generate a temporary query vector through `embedding.default` and search without storing the query text/vector.
		- **Acceptance criteria**:
			- [ ] Query accepts text or document id, but not both.
			- [ ] Query text is not stored in SQLite or logs.
			- [ ] Generated query vector dimension must match stored model dimension.
			- [ ] Tests use fake provider and deterministic vectors.
		- **Dependencies**: Nearest-neighbor search for stored documents.
- [ ] **Story: Safety, documentation, and validation**
	- [ ] **Task: Add redaction and unsupported-provider tests**
		- **Description**: Lock down safe error behavior for provider failures, sqlite-vec failures, and unsupported profile combinations.
		- **Acceptance criteria**:
			- [ ] Fake secrets, bearer tokens, auth headers, raw provider bodies, and full issue text never appear in errors/log snapshots.
			- [ ] Unsupported embedding routes fail clearly.
			- [ ] sqlite-vec unavailable returns safe error instead of panic.
		- **Dependencies**: Provider runner, refresh workflow.
	- [ ] **Task: Update durable agent context**
		- **Description**: Document embedding modules, schema, route name, test strategy, and candidate API in `context-agent/wiki/code-map.md` and testing notes as implementation context.
		- **Acceptance criteria**:
			- [ ] Code map names embedding modules and table responsibilities.
			- [ ] Testing notes explain deterministic fake vectors and sqlite-vec nearest-neighbor fixtures.
			- [ ] Notes state that issue #13 owns duplicate scoring/reranking.
		- **Dependencies**: Final implementation module names.
	- [ ] **Task: Run validation checks**
		- **Description**: Run targeted Rust checks first, then broader repository checks where practical.
		- **Acceptance criteria**:
			- [ ] Targeted embedding/provider/sqlite-vec tests pass.
			- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` passes.
			- [ ] `npm run lint` passes if TypeScript bindings or UI code changed.
			- [ ] `npm test` passes if frontend code changed.
			- [ ] `npm run build` passes or skipped with a clear reason.
		- **Dependencies**: All implementation tasks.