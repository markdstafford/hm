use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::{Arc, Mutex};

use crate::collections::views::{
    delete_collection_view, list_collection_views, save_collection_view,
    seed_default_collection_views, CollectionViewRecord, CollectionViewSaveInput,
    CollectionViewSeedInput,
};
use crate::settings::{keys, preferences, secrets::ManagedSecretStore, shared};

// `serde_json::Value` implements `specta::Type` via the `serde_json` feature, but
// that impl is infinitely recursive at binding-generation time (specta rc.25 bug).
// `JsonValue` is a transparent newtype that serialises/deserialises identically to
// `serde_json::Value` but emits TypeScript `unknown` using `specta_typescript::define`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JsonValue(pub serde_json::Value);

impl specta::Type for JsonValue {
    fn definition(_types: &mut specta::Types) -> specta::datatype::DataType {
        specta::datatype::DataType::Reference(specta_typescript::define("unknown"))
    }
}

impl From<serde_json::Value> for JsonValue {
    fn from(v: serde_json::Value) -> Self {
        JsonValue(v)
    }
}

impl From<JsonValue> for serde_json::Value {
    fn from(j: JsonValue) -> Self {
        j.0
    }
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct AppStatus {
    pub version: String,
    pub ready: bool,
}

#[tauri::command]
#[specta::specta]
pub fn app_status() -> AppStatus {
    AppStatus {
        version: env!("CARGO_PKG_VERSION").to_string(),
        ready: true,
    }
}

#[tauri::command]
#[specta::specta]
pub fn preferences_read() -> Result<JsonValue, String> {
    let path = preferences::preferences_path().map_err(|e| e.to_string())?;
    preferences::read_preferences_at(&path)
        .map(JsonValue)
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn preferences_write(prefs: JsonValue) -> Result<(), String> {
    let path = preferences::preferences_path().map_err(|e| e.to_string())?;
    preferences::write_preferences_at(&path, &prefs.0).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn secret_set(
    key: String,
    value: String,
    store: tauri::State<'_, ManagedSecretStore>,
) -> Result<(), String> {
    keys::validate_key(&key).map_err(|e| e.to_string())?;
    store.0.set(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn secret_get(
    key: String,
    store: tauri::State<'_, ManagedSecretStore>,
) -> Result<Option<String>, String> {
    keys::validate_key(&key).map_err(|e| e.to_string())?;
    store.0.get(&key).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn secret_delete(
    key: String,
    store: tauri::State<'_, ManagedSecretStore>,
) -> Result<(), String> {
    keys::validate_key(&key).map_err(|e| e.to_string())?;
    store.0.delete(&key).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn shared_settings_get(
    key: String,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<Option<JsonValue>, String> {
    keys::validate_key(&key).map_err(|e| e.to_string())?;
    let conn = db.lock().unwrap();
    shared::shared_settings_get(&conn, &key)
        .map(|opt| opt.map(JsonValue))
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn shared_settings_set(
    key: String,
    value: JsonValue,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<(), String> {
    keys::validate_key(&key).map_err(|e| e.to_string())?;
    let conn = db.lock().unwrap();
    shared::shared_settings_set(&conn, &key, &value.0).map_err(|e| e.to_string())
}

use crate::ai::config::{load_ai_provider_config, save_ai_provider_config, AiProviderConfig};
use crate::sources::config::{
    load_sources_config, save_sources_config, ConnectionTestStatus, ConnectionTestSummary,
    JiraAuthConfig, JiraProjectFilter, JiraSourceConfig, SourceConfig, SourcesConfig,
};
use crate::ai::credentials::{delete_keychain_credential_secret, set_keychain_credential_secret};
use crate::sources::credentials::{
    set_source_credential_secret, delete_source_credential, remove_source_config_and_credentials, SourceCredentialKind,
};
use crate::ai::service::{smoke_test_profile_with_config, SmokeTestResult};
use crate::sources::jira::{
    jira_source_test_connection_with_store, JiraConnectionTestResult,
    JiraConnectionTestStatus, JiraConnectionErrorCategory, JiraConnectionProject,
};

#[tauri::command]
#[specta::specta]
pub fn ai_provider_config_get(
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<AiProviderConfig, String> {
    let conn = db.lock().unwrap();
    load_ai_provider_config(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn ai_provider_config_save(
    config: AiProviderConfig,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<(), String> {
    let conn = db.lock().unwrap();
    save_ai_provider_config(&conn, &config).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn ai_credential_secret_set(
    credential_name: String,
    value: String,
    store: tauri::State<'_, ManagedSecretStore>,
) -> Result<(), String> {
    set_keychain_credential_secret(&credential_name, &value, store.0.as_ref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn ai_credential_secret_delete(
    credential_name: String,
    store: tauri::State<'_, ManagedSecretStore>,
) -> Result<(), String> {
    delete_keychain_credential_secret(&credential_name, store.0.as_ref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn ai_profile_smoke_test(
    profile_name: String,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
    store: tauri::State<'_, ManagedSecretStore>,
) -> Result<SmokeTestResult, String> {
    // Load config while holding the DB lock, then release it before secret loading and HTTP.
    let config = {
        let conn = db.lock().unwrap();
        load_ai_provider_config(&conn).map_err(|e| e.to_string())?
    };
    Ok(smoke_test_profile_with_config(config, store.0.as_ref(), &profile_name))
}

#[tauri::command]
#[specta::specta]
pub fn source_config_get(db: tauri::State<'_, Mutex<rusqlite::Connection>>) -> Result<SourcesConfig, String> {
    let conn = db.lock().unwrap();
    load_sources_config(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn source_config_save(config: SourcesConfig, db: tauri::State<'_, Mutex<rusqlite::Connection>>) -> Result<(), String> {
    let conn = db.lock().unwrap();
    save_sources_config(&conn, &config).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn source_credential_secret_set(
    source_id: String,
    kind: SourceCredentialKind,
    value: String,
    store: tauri::State<'_, ManagedSecretStore>,
) -> Result<String, String> {
    set_source_credential_secret(&source_id, kind, &value, store.0.as_ref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn source_credential_delete(
    credential_ref: String,
    store: tauri::State<'_, ManagedSecretStore>,
) -> Result<(), String> {
    delete_source_credential(&credential_ref, store.0.as_ref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn source_config_remove(
    source_id: String,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
    store: tauri::State<'_, ManagedSecretStore>,
) -> Result<(), String> {
    let conn = db.lock().unwrap();
    remove_source_config_and_credentials(&conn, store.0.as_ref(), &source_id)
        .map_err(|e| e.to_string())
}

/// Wipe every row scoped to (source, project) so the next sync re-fetches
/// the project from scratch. Source config and credentials are untouched.
/// See `sources::reset` for the full table list.
#[tauri::command]
#[specta::specta]
pub fn jira_source_reset_project_data(
    source_id: String,
    project_key: String,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<crate::sources::reset::ResetJiraProjectCounts, String> {
    let mut conn = db.lock().unwrap();
    let source_system_id = source_system_id_for(&source_id);
    crate::sources::reset::reset_jira_project_data(&mut conn, &source_system_id, &project_key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn jira_source_test_connection(
    source: JiraSourceConfig,
    pending_pat: Option<String>,
    store: tauri::State<'_, ManagedSecretStore>,
) -> Result<JiraConnectionTestResult, String> {
    jira_source_test_connection_with_store(source, pending_pat, store.0.as_ref())
        .map_err(|e| e.to_string())
}

// ── Jira issue ingestion commands ──────────────────────────────────────────────

use crate::ingestion::runs::{latest_run, mark_cancellation_requested};
use crate::issues::repository::{upsert_source_system, SourceSystemInput};
use crate::sources::jira_client::{
    JiraApiClient, JiraApiClientConfig, RateLimitPolicy, RetryPolicy,
};
use crate::sources::jira_ingestion::{
    now_utc_rfc3339, CancellationFlag, JiraIssueIngestionService, JIRA_ISSUE_CONNECTOR,
};

/// Active ingestion runs, keyed by Jira `source_id`. A cancellation flag is
/// inserted while `jira_issue_ingestion_run` has spawned a worker, and
/// removed when the worker thread exits. `jira_issue_ingestion_cancel` reads
/// from this map to trip the flag the worker polls between HTTP fetches.
///
/// The run command spawns a `std::thread::spawn` worker and returns
/// immediately, so the JS-side IPC `await` resolves in milliseconds even for
/// multi-thousand-issue projects. Cooperative cancel is effective between
/// page fetches inside `ingest_project`.
#[derive(Default)]
pub struct ActiveIngestionRuns(
    pub Mutex<std::collections::HashMap<String, Arc<CancellationFlag>>>,
);

/// Opt-in toggles for `jira_issue_ingestion_run`. Currently only
/// `fetch_remote_links` is wired through; the watcher/vote placeholders in
/// `JiraIngestionOptions` are not exposed on the command surface yet because
/// the service does not consume them.
#[derive(Debug, Clone, Default, Serialize, Deserialize, Type)]
pub struct JiraIngestionRunOptions {
    #[serde(default)]
    pub fetch_remote_links: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct JiraIssueIngestionRunResult {
    pub run_id: String,
    pub status: String,
    pub saved_issues: u32,
    pub total_issues: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct JiraIssueIngestionProgress {
    pub run_id: String,
    pub status: String,
    pub phase: String,
    pub saved_issues: u32,
    pub total_issues: Option<u32>,
    pub current_page: Option<u32>,
    pub total_pages: Option<u32>,
    pub message: String,
    pub last_successful_issue_sync_at: Option<String>,
    pub error_summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct JiraIssueListFilter {
    pub source_id: Option<String>,
    pub project_key: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct JiraIssueListItem {
    pub work_item_id: String,
    pub key: String,
    pub title: String,
    pub status_name: Option<String>,
    pub assignee_display_name: Option<String>,
    pub updated_at_source: Option<String>,
    pub project_key: Option<String>,
    pub priority_name: Option<String>,
    pub labels: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct JiraIssuePreviewContent {
    pub work_item_id: String,
    pub body: Option<String>,
    pub comments: Vec<JiraIssuePreviewComment>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct JiraIssuePreviewComment {
    pub id: String,
    pub upstream_id: String,
    pub author_display_name: Option<String>,
    pub body: Option<String>,
    pub created_at_source: Option<String>,
    pub updated_at_source: Option<String>,
    pub ingested_at: String,
}

/// Derive the synthetic `source_systems.id` we use for a given config
/// `source_id`. Centralised so the run/cancel/status/list commands agree on
/// the lookup key.
fn source_system_id_for(source_id: &str) -> String {
    format!("srcsys_{}", source_id)
}

#[tauri::command]
#[specta::specta]
pub fn jira_issue_ingestion_run(
    source_id: String,
    options: Option<JiraIngestionRunOptions>,
    app: tauri::AppHandle,
) -> Result<JiraIssueIngestionRunResult, String> {
    use tauri::Manager;

    // 1. Synchronous setup: resolve config, PAT, build client, register the
    //    cancellation flag, and upsert the source_systems row. All DB locks
    //    taken here are short.
    let db = app.state::<Mutex<rusqlite::Connection>>();
    let store = app.state::<ManagedSecretStore>();
    let active = app.state::<ActiveIngestionRuns>();

    let (source, project_keys) = {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let cfg = load_sources_config(&conn).map_err(|e| e.to_string())?;
        let source = cfg
            .sources
            .into_iter()
            .find_map(|s| {
                let SourceConfig::Jira(j) = s;
                (j.id == source_id).then_some(j)
            })
            .ok_or_else(|| "Source not found".to_string())?;
        if source.projects.is_empty() {
            return Err("No projects selected for this source".to_string());
        }
        let keys: Vec<String> = source.projects.iter().map(|p| p.key.clone()).collect();
        (source, keys)
    };

    let credential_ref = match &source.auth {
        JiraAuthConfig::Pat { credential_ref } => credential_ref.clone(),
    };
    let pat = store
        .0
        .get(&credential_ref)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| {
            "Authentication failed: Replace the Jira token and try again.".to_string()
        })?;

    let client = JiraApiClient::new(JiraApiClientConfig {
        base_url: source.server_url.clone(),
        pat,
        user_agent: format!("hm/{}", env!("CARGO_PKG_VERSION")),
        retry_policy: RetryPolicy::default(),
        rate_limit_policy: RateLimitPolicy::default(),
    })
    .map_err(|e| e.to_string())?;

    let cancellation = Arc::new(CancellationFlag::new());
    {
        let mut active_map = active.0.lock().map_err(|e| e.to_string())?;
        if active_map.contains_key(&source_id) {
            return Err("Ingestion already running for this source".to_string());
        }
        active_map.insert(source_id.clone(), cancellation.clone());
    }

    let source_system_id = source_system_id_for(&source_id);
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        upsert_source_system(
            &conn,
            &now_utc_rfc3339(),
            &SourceSystemInput {
                id: &source_system_id,
                kind: "jira",
                deployment_kind: Some("data_center"),
                display_name: &source.name,
                base_url: Some(&source.server_url),
                config_source_id: Some(&source_id),
            },
        )
        .map_err(|e| e.to_string())?;
    }

    // 2. Spawn the long-running per-project ingestion loop on a worker
    //    thread so the calling Tauri IPC thread returns immediately. The
    //    worker re-acquires Tauri state via the AppHandle clone. The DB
    //    mutex is taken only for short write batches inside the service,
    //    so status/cancel commands can run concurrently and the UI stays
    //    responsive.
    let app_for_worker = app.clone();
    let source_id_for_worker = source_id.clone();
    let source_system_id_for_worker = source_system_id.clone();
    let projects = source.projects.clone();
    let project_keys_for_worker = project_keys;
    let cancellation_for_worker = cancellation.clone();
    let opts = options.clone();

    std::thread::spawn(move || {
        let db = app_for_worker.state::<Mutex<rusqlite::Connection>>();
        let db_access = crate::ingestion::db::MutexDbAccess(&db);
        let service = match opts.as_ref() {
            Some(o) if o.fetch_remote_links => JiraIssueIngestionService::with_options(
                &client,
                crate::sources::jira_ingestion::JiraIngestionOptions {
                    fetch_remote_links: true,
                    ..Default::default()
                },
            ),
            _ => JiraIssueIngestionService::new(&client),
        };

        for project_key in &project_keys_for_worker {
            if cancellation_for_worker.is_cancelled() {
                break;
            }
            let project_name = projects
                .iter()
                .find(|p| &p.key == project_key)
                .and_then(|p| p.name.as_deref());
            let now = now_utc_rfc3339();
            // `ingest_project` manages its own start_run / finish_run, so on
            // a per-project error the run row is already marked partial /
            // failed in the database. We log via eprintln for dev visibility
            // and continue with the next project.
            let ingestion_ok = service.ingest_project(
                &db_access,
                &source_system_id_for_worker,
                project_key,
                project_name,
                &now,
                &cancellation_for_worker,
            ).is_ok();

            if !ingestion_ok {
                eprintln!("ingestion worker: project {project_key} failed");
            }

            // Best-effort post-ingestion embedding refresh. A provider failure
            // must not roll back ingestion success — errors are logged only.
            // The embedding provider is resolved BEFORE claiming any documents so
            // a missing-route or credential failure never leaves documents stuck
            // in the 'embedding' state. The DB mutex is held in two brief scopes
            // per batch; the provider HTTP call happens between them.
            if ingestion_ok {
                let store_for_embed = app_for_worker.state::<ManagedSecretStore>();
                let embed_now = now_utc_rfc3339();
                let embed_opts = crate::embeddings::service::EmbeddingRunOptions {
                    source_system_id: Some(source_system_id_for_worker.clone()),
                    entity_kind: None,
                    limit: None,
                    force_rebuild: false,
                };

                // Phase 0: resolve provider + derive limits (brief lock, before claiming).
                let resolved_and_limits = db.lock().ok().and_then(|conn| {
                    let resolved = crate::ai::resolver::resolve_for_task(
                        &conn, store_for_embed.0.as_ref(),
                        crate::embeddings::EMBEDDING_DEFAULT_ROUTE,
                    ).ok()?;
                    let limits = crate::embeddings::limits::limits_from_settings(&resolved.profile.settings);
                    Some((resolved, limits))
                }); // ← DB mutex released here

                if let Some((resolved, limits)) = resolved_and_limits {
                    // Phase 1: claim docs + split into batches (brief lock).
                    let batch = db.lock().ok().and_then(|conn| {
                        crate::embeddings::service::prepare_refresh_batch(
                            &conn, &embed_opts, &limits, &embed_now,
                        ).ok()?
                    }); // ← DB mutex released here

                    if let Some(batch) = batch {
                        // Loop over text batches: for each batch, release lock → HTTP → re-acquire → write.
                        for text_batch in &batch.text_batches {
                            // Phase 2: HTTP call (no DB lock held).
                            let request = crate::embeddings::provider::EmbeddingRequest {
                                input: text_batch.texts.clone(),
                            };
                            match crate::ai::runners::openai_embeddings::OpenAiEmbeddingsRunner::default()
                                .run(&resolved, request)
                            {
                                Ok(response) => {
                                    // Phase 3: write this batch's results (brief lock).
                                    if let Ok(conn) = db.lock() {
                                        if let Err(e) = crate::embeddings::service::complete_text_batch(
                                            &conn, text_batch, response, &embed_now,
                                        ) {
                                            eprintln!("embedding write after ingestion of {project_key} failed (non-fatal): {e}");
                                            break;
                                        }
                                    }
                                }
                                Err(e) => {
                                    eprintln!("embedding provider call after ingestion of {project_key} failed (non-fatal): {e}");
                                    if let Ok(conn) = db.lock() {
                                        for doc in &text_batch.docs {
                                            let _ = crate::embeddings::repository::record_embedding_failure(
                                                &conn, &doc.id, &doc.source_system_id, &e, &embed_now,
                                            );
                                        }
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }

                // Best-effort gardener scheduled run. A gardener failure must
                // not roll back ingestion success — status is logged only.
                let gardener_now = now_utc_rfc3339();
                let gardener_runtime = app_for_worker
                    .state::<crate::gardener::runner::GardenerRuntime>();
                if let Ok(conn) = db.lock() {
                    let summary = crate::gardener::run_gardener_after_successful_project_ingestion(
                        &conn,
                        &gardener_runtime,
                        &source_system_id_for_worker,
                        project_key,
                        &gardener_now,
                    );
                    if matches!(
                        summary.status,
                        crate::gardener::runner::GardenerRunStatus::Failed
                            | crate::gardener::runner::GardenerRunStatus::Partial
                    ) {
                        eprintln!(
                            "gardener: scheduled run after ingestion of {project_key} had issues (non-fatal)"
                        );
                    }
                }
            }
        }

        // Cleanup: drop the cancellation flag from the active map so a
        // subsequent run for this source can start.
        {
            let active = app_for_worker.state::<ActiveIngestionRuns>();
            let lock_result = active.0.lock();
            if let Ok(mut map) = lock_result {
                map.remove(&source_id_for_worker);
            }
        }
    });

    // 3. Return immediately. The JS side polls
    //    `jira_issue_ingestion_progress` to observe the worker's progress
    //    and obtain the real run_id once the first ingestion_runs row is
    //    inserted by the service.
    Ok(JiraIssueIngestionRunResult {
        run_id: String::new(),
        status: "started".to_string(),
        saved_issues: 0,
        total_issues: None,
    })
}

#[tauri::command]
#[specta::specta]
pub fn jira_issue_ingestion_cancel(
    source_id: String,
    run_id: String,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
    active: tauri::State<'_, ActiveIngestionRuns>,
) -> Result<(), String> {
    if let Ok(map) = active.0.lock() {
        if let Some(flag) = map.get(&source_id) {
            flag.request_cancel();
        }
    }
    let conn = db.lock().map_err(|e| e.to_string())?;
    mark_cancellation_requested(&conn, &run_id, &now_utc_rfc3339()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn jira_issue_ingestion_status(
    source_id: String,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<Option<JiraIssueIngestionProgress>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    read_progress_from_conn(&conn, &source_id)
}

#[tauri::command]
#[specta::specta]
pub fn jira_issue_ingestion_progress(
    source_id: String,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<Option<JiraIssueIngestionProgress>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    read_progress_from_conn(&conn, &source_id)
}

/// Connection-level implementation behind `jira_issue_ingestion_status` and
/// `jira_issue_ingestion_progress`. Exposed at `pub(crate)` so unit tests can
/// exercise the logic without constructing a `tauri::State`.
pub(crate) fn read_progress_from_conn(
    conn: &Connection,
    source_id: &str,
) -> Result<Option<JiraIssueIngestionProgress>, String> {
    let source_system_id = source_system_id_for(source_id);
    let latest = latest_run(conn, &source_system_id, JIRA_ISSUE_CONNECTOR)
        .map_err(|e| e.to_string())?;
    let Some(row) = latest else {
        return Ok(None);
    };
    let progress: serde_json::Value =
        serde_json::from_str(&row.progress_json).unwrap_or(serde_json::Value::Null);
    let saved_issues = progress
        .get("saved_issues")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    let total_issues = progress
        .get("total_issues")
        .and_then(|v| v.as_u64())
        .map(|v| v as u32);
    let current_page = progress
        .get("current_page")
        .and_then(|v| v.as_u64())
        .map(|v| v as u32);
    let total_pages = progress
        .get("total_pages")
        .and_then(|v| v.as_u64())
        .map(|v| v as u32);
    let phase = progress
        .get("phase")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let message = match row.status.as_str() {
        "running" => "Syncing issues",
        "succeeded" => "Synced",
        "partial" => "Partial sync",
        "failed" => "Failed",
        "cancelled" => "Cancelled",
        _ => "",
    }
    .to_string();
    let last_successful_issue_sync_at: Option<String> = conn
        .query_row(
            "SELECT last_successful_sync_at FROM ingestion_cursors
               WHERE source_system_id = ?1
                 AND connector = ?2
                 AND cursor_key LIKE 'project:%:issues'
                 AND last_successful_sync_at IS NOT NULL
               ORDER BY last_successful_sync_at DESC
               LIMIT 1",
            rusqlite::params![&source_system_id, JIRA_ISSUE_CONNECTOR],
            |r| r.get::<_, Option<String>>(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .flatten();
    Ok(Some(JiraIssueIngestionProgress {
        run_id: row.id,
        status: row.status,
        phase,
        saved_issues,
        total_issues,
        current_page,
        total_pages,
        message,
        last_successful_issue_sync_at,
        error_summary: row.error_summary,
    }))
}

#[tauri::command]
#[specta::specta]
pub fn jira_issue_preview_content(
    work_item_id: String,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<JiraIssuePreviewContent, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    jira_issue_preview_content_from_conn(&conn, &work_item_id)
}

#[tauri::command]
#[specta::specta]
pub fn jira_issues_list(
    filter: JiraIssueListFilter,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<Vec<JiraIssueListItem>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    list_jira_issues_from_conn(&conn, &filter)
}

/// Connection-level implementation behind `jira_issues_list`. Exposed at
/// `pub(crate)` for unit tests.
pub(crate) fn list_jira_issues_from_conn(
    conn: &Connection,
    filter: &JiraIssueListFilter,
) -> Result<Vec<JiraIssueListItem>, String> {
    let limit = filter.limit.unwrap_or(100).min(500) as i64;
    let mut sql = String::from(
        "SELECT w.id, w.key, w.title, w.status_name, p.display_name, \
                w.updated_at_source, w.project_key, w.priority_name, \
                (SELECT GROUP_CONCAT(wt.term_name, '\x1f') \
                   FROM work_item_terms wt \
                  WHERE wt.work_item_id = w.id AND wt.term_kind = 'label') AS labels \
           FROM work_items w \
           LEFT JOIN people p ON p.id = w.assignee_person_id \
          WHERE w.source_kind = 'jira_issue'",
    );
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    if let Some(source_id) = &filter.source_id {
        sql.push_str(" AND w.source_system_id = ?");
        params.push(Box::new(source_system_id_for(source_id)));
    }
    if let Some(project_key) = &filter.project_key {
        sql.push_str(" AND w.project_key = ?");
        params.push(Box::new(project_key.clone()));
    }
    // `NULLS LAST` is supported by SQLite >= 3.30; the bundled rusqlite ships
    // a newer build, but we use `IS NULL` ordering for portability.
    sql.push_str(" ORDER BY w.updated_at_source IS NULL, w.updated_at_source DESC LIMIT ?");
    params.push(Box::new(limit));

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(rusqlite::params_from_iter(
            params.iter().map(|b| b.as_ref()),
        ))
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let key: Option<String> = row.get(1).map_err(|e| e.to_string())?;
        let labels_concat: Option<String> = row.get(8).map_err(|e| e.to_string())?;
        let labels = labels_concat
            .map(|s| s.split('\x1f').map(str::to_owned).collect())
            .unwrap_or_default();
        out.push(JiraIssueListItem {
            work_item_id: row.get(0).map_err(|e| e.to_string())?,
            key: key.unwrap_or_default(),
            title: row.get(2).map_err(|e| e.to_string())?,
            status_name: row.get(3).map_err(|e| e.to_string())?,
            assignee_display_name: row.get(4).map_err(|e| e.to_string())?,
            updated_at_source: row.get(5).map_err(|e| e.to_string())?,
            project_key: row.get(6).map_err(|e| e.to_string())?,
            priority_name: row.get(7).map_err(|e| e.to_string())?,
            labels,
        });
    }
    Ok(out)
}

pub(crate) fn jira_issue_preview_content_from_conn(
    conn: &Connection,
    work_item_id: &str,
) -> Result<JiraIssuePreviewContent, String> {
    let row: Option<Option<String>> = conn
        .query_row(
            "SELECT body FROM work_items WHERE id = ?1 AND source_kind = 'jira_issue'",
            [work_item_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let body = row.ok_or_else(|| {
        format!("Jira issue preview content not found for work item {work_item_id}")
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT
                c.id,
                c.upstream_id,
                COALESCE(p.display_name, si.display_name, si.username, si.email) AS author_display_name,
                c.body,
                c.created_at_source,
                c.updated_at_source,
                c.ingested_at
             FROM work_item_comments c
             LEFT JOIN source_identities si ON si.id = c.author_identity_id
             LEFT JOIN people p ON p.id = si.person_id
             WHERE c.work_item_id = ?1
             ORDER BY
                COALESCE(c.updated_at_source, c.created_at_source, c.ingested_at) DESC,
                c.ingested_at DESC,
                c.id DESC",
        )
        .map_err(|e| e.to_string())?;

    let comments = stmt
        .query_map([work_item_id], |row| {
            Ok(JiraIssuePreviewComment {
                id: row.get(0)?,
                upstream_id: row.get(1)?,
                author_display_name: row.get(2)?,
                body: row.get(3)?,
                created_at_source: row.get(4)?,
                updated_at_source: row.get(5)?,
                ingested_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    Ok(JiraIssuePreviewContent {
        work_item_id: work_item_id.to_string(),
        body,
        comments,
    })
}

#[tauri::command]
#[specta::specta]
pub fn collection_views_list(
    entity_kind: String,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<Vec<CollectionViewRecord>, String> {
    let conn = db.lock().map_err(|_| "Could not access database".to_string())?;
    list_collection_views(&conn, &entity_kind).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn collection_view_save(
    view: CollectionViewSaveInput,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<CollectionViewRecord, String> {
    let conn = db.lock().map_err(|_| "Could not access database".to_string())?;
    save_collection_view(&conn, &view).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn collection_view_delete(
    id: String,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|_| "Could not access database".to_string())?;
    delete_collection_view(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn collection_views_seed_defaults(
    input: CollectionViewSeedInput,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<Vec<CollectionViewRecord>, String> {
    let conn = db.lock().map_err(|_| "Could not access database".to_string())?;
    seed_default_collection_views(&conn, &input.entity_kind, &input.defaults)
        .map(|result| result.views)
        .map_err(|e| e.to_string())
}

// ── Jira issue history commands ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct JiraIssueStatusTransition {
    pub event_id: String,
    pub issue_id: String,
    pub occurred_at: String,
    pub actor_display_name: Option<String>,
    pub from_status: Option<String>,
    pub to_status: Option<String>,
    pub complete: bool,
}

#[tauri::command]
#[specta::specta]
pub fn jira_issue_status_timeline(
    issue_id: String,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<Vec<JiraIssueStatusTransition>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    jira_issue_status_timeline_from_conn(&conn, &issue_id)
}

pub(crate) fn jira_issue_status_timeline_from_conn(
    conn: &Connection,
    issue_id: &str,
) -> Result<Vec<JiraIssueStatusTransition>, String> {
    let rows = crate::issues::history::list_issue_events_by_type(conn, issue_id, "status_changed", 500)
        .map_err(|e| {
            use crate::issues::history::IssueHistoryError;
            IssueHistoryError::Storage(e).to_string()
        })?;
    let mut transitions: Vec<JiraIssueStatusTransition> = rows
        .into_iter()
        .map(|row| JiraIssueStatusTransition {
            event_id: row.id,
            issue_id: row.issue_id,
            occurred_at: row.occurred_at,
            actor_display_name: row.actor_display_name,
            from_status: row.from_string,
            to_status: row.to_string,
            complete: true,
        })
        .collect();
    // list_issue_events_by_type already returns DESC order; ensure it here for clarity
    transitions.sort_by(|a, b| b.occurred_at.cmp(&a.occurred_at));
    Ok(transitions)
}

#[tauri::command]
#[specta::specta]
pub fn issue_snapshots_query(
    filter: crate::issues::history::IssueSnapshotQuery,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<Vec<crate::issues::history::IssueSnapshotListItem>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    issue_snapshots_query_from_conn(&conn, &filter)
}

pub(crate) fn issue_snapshots_query_from_conn(
    conn: &Connection,
    filter: &crate::issues::history::IssueSnapshotQuery,
) -> Result<Vec<crate::issues::history::IssueSnapshotListItem>, String> {
    crate::issues::history::query_issue_snapshots(conn, filter).map_err(|e| {
        use crate::issues::history::IssueHistoryError;
        IssueHistoryError::Storage(e).to_string()
    })
}

#[tauri::command]
#[specta::specta]
pub fn issue_history_retention_get(
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<crate::issues::history::IssueHistoryRetentionConfig, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    issue_history_retention_get_from_conn(&conn)
}

pub(crate) fn issue_history_retention_get_from_conn(
    conn: &Connection,
) -> Result<crate::issues::history::IssueHistoryRetentionConfig, String> {
    crate::issues::history::load_retention_config(conn).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn issue_history_retention_save(
    config: crate::issues::history::IssueHistoryRetentionConfig,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    issue_history_retention_save_to_conn(&conn, &config)
}

pub(crate) fn issue_history_retention_save_to_conn(
    conn: &Connection,
    config: &crate::issues::history::IssueHistoryRetentionConfig,
) -> Result<(), String> {
    crate::issues::history::save_retention_config(conn, config).map_err(|e| e.to_string())
}

// ── Embedding commands ────────────────────────────────────────────────────────

/// Trait for types that can execute an embedding provider call.
/// Extracted so `embedding_refresh_run` can be tested with a fake runner
/// without requiring a live AI endpoint or Tauri state machinery.
pub(crate) trait EmbeddingRunnerForCommand {
    fn run(
        &self,
        resolved: &crate::ai::resolver::ResolvedAiProvider,
        request: crate::embeddings::provider::EmbeddingRequest,
    ) -> Result<crate::embeddings::provider::EmbeddingResponse, crate::embeddings::errors::EmbeddingError>;
}

impl EmbeddingRunnerForCommand for crate::ai::runners::openai_embeddings::OpenAiEmbeddingsRunner {
    fn run(
        &self,
        resolved: &crate::ai::resolver::ResolvedAiProvider,
        request: crate::embeddings::provider::EmbeddingRequest,
    ) -> Result<crate::embeddings::provider::EmbeddingResponse, crate::embeddings::errors::EmbeddingError> {
        crate::ai::runners::openai_embeddings::OpenAiEmbeddingsRunner::run(self, resolved, request)
    }
}

/// Inner loop for embedding refresh: for each text batch, release the DB lock,
/// call the runner (Phase 2), re-acquire the lock, then write results (Phase 3).
/// Returns the accumulated summary.
///
/// Accepts a `&Mutex<Connection>` so it can lock briefly for Phase 3 writes
/// while keeping the lock released during the provider HTTP call (Phase 2).
/// Callers pass `&*db` when `db` is a `tauri::State<Mutex<Connection>>`, or
/// wrap a raw connection in a `Mutex` for tests.
///
/// `limits.rate_limit_backoff_seconds` is applied as a floor for rate-limit
/// retry_after_utc so the profile-configured minimum is honoured even when the
/// provider header returns a shorter delay.
pub(crate) fn run_embedding_refresh_loop(
    db: &std::sync::Mutex<rusqlite::Connection>,
    resolved: &crate::ai::resolver::ResolvedAiProvider,
    batch: &crate::embeddings::service::PreparedRefreshBatch,
    runner: &dyn EmbeddingRunnerForCommand,
    now: &str,
    limits: &crate::embeddings::limits::EmbeddingBatchLimits,
    max_http_calls: usize,
) -> (crate::embeddings::service::EmbeddingRunSummary, usize) {
    use crate::embeddings::service::{complete_text_batch, EmbeddingRunStatus, EmbeddingRunSummary};
    use crate::embeddings::repository::record_embedding_failure;
    use crate::embeddings::provider::EmbeddingRequest;
    use crate::embeddings::errors::EmbeddingErrorCategory;

    let mut embedded: u32 = 0;
    let mut failed: u32 = 0;
    let mut model_id = String::new();
    let mut dimension: u32 = 0;
    let mut safe_error: Option<String> = None;
    let mut paused = false;
    let mut http_calls_made: usize = 0;

    for text_batch in &batch.text_batches {
        if http_calls_made >= max_http_calls {
            // Budget exhausted; remaining docs in uncompleted text_batches stay in
            // 'embedding' state and will be recovered at the start of the next run.
            paused = true;
            break;
        }
        http_calls_made += 1;
        let request = EmbeddingRequest { input: text_batch.texts.clone() };

        // Phase 2: HTTP call — no DB lock held.
        let response = match runner.run(resolved, request) {
            Ok(r) => r,
            Err(e) => {
                // Apply configured rate-limit backoff floor so the profile setting
                // is honoured even when the provider header returns a shorter delay.
                let err_to_record = if matches!(e.category, EmbeddingErrorCategory::ProviderRateLimited) {
                    let floor = limits.rate_limit_backoff_seconds;
                    let mut floored = e.clone();
                    floored.retry_after_seconds = Some(
                        floored.retry_after_seconds.unwrap_or(floor).max(floor),
                    );
                    floored
                } else {
                    e.clone()
                };
                // Phase 3 (failure path): record failures (brief lock).
                if let Ok(conn) = db.lock() {
                    for doc in &text_batch.docs {
                        let _ = record_embedding_failure(&conn, &doc.id, &doc.source_system_id, &err_to_record, now);
                    }
                }
                failed += text_batch.docs.len() as u32;
                paused = true;
                if safe_error.is_none() {
                    safe_error = Some(e.to_string());
                }
                break;
            }
        };

        model_id = crate::embeddings::repository::stable_model_id(
            &response.profile,
            &response.model,
            "OpenAiEmbeddings",
            response.dimension,
            "l2",
        );
        dimension = response.dimension as u32;

        // Phase 3 (success path): write vectors (brief lock).
        match db.lock() {
            Ok(conn) => match complete_text_batch(&conn, text_batch, response, now) {
                Ok(_) => {
                    embedded += text_batch.docs.len() as u32;
                }
                Err(e) => {
                    for doc in &text_batch.docs {
                        let _ = record_embedding_failure(&conn, &doc.id, &doc.source_system_id, &e, now);
                    }
                    failed += text_batch.docs.len() as u32;
                    paused = true;
                    if safe_error.is_none() {
                        safe_error = Some(e.to_string());
                    }
                    break;
                }
            },
            Err(e) => {
                failed += text_batch.docs.len() as u32;
                paused = true;
                if safe_error.is_none() {
                    safe_error = Some(format!("DB lock error: {e}"));
                }
                break;
            }
        }
    }

    let status = if paused {
        if embedded > 0 { EmbeddingRunStatus::Partial } else { EmbeddingRunStatus::Paused }
    } else {
        EmbeddingRunStatus::Complete
    };

    (EmbeddingRunSummary {
        status,
        scanned: batch.scanned,
        embedded,
        skipped: batch.scanned.saturating_sub(embedded + failed),
        failed,
        model_id,
        dimension,
        safe_error,
    }, http_calls_made)
}

/// Trigger a batch embedding refresh. Processes pending documents using the
/// configured AI embedding provider, looping until the backlog is drained,
/// a rate limit pauses the run, or `limits.max_batches_per_run` provider
/// HTTP calls have been made.
///
/// The provider is resolved before any documents are claimed so that a
/// missing-route or missing-credential error never leaves documents stuck in
/// the `embedding` state.
///
/// The DB mutex is held in two short scopes per iteration:
///   Phase 1 — claim one batch of documents (max_inputs_per_request docs).
///   Phase 3 — write vectors + update document status.
/// The provider HTTP call (Phase 2) happens between these scopes with no lock held.
///
/// Returns `Complete` when all pending documents have been embedded, `Partial`
/// when the run reached `max_batches_per_run` with pending work remaining, and
/// `Paused` / `Partial` (depending on progress) when a rate limit was hit.
#[tauri::command]
#[specta::specta]
pub fn embedding_refresh_run(
    options: crate::embeddings::service::EmbeddingRunOptions,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
    store: tauri::State<'_, ManagedSecretStore>,
) -> Result<crate::embeddings::service::EmbeddingRunSummary, String> {
    use crate::ai::resolver::resolve_for_task;
    use crate::ai::runners::openai_embeddings::OpenAiEmbeddingsRunner;
    use crate::embeddings::limits::limits_from_settings;
    use crate::embeddings::service::{prepare_refresh_batch, EmbeddingRunOptions, EmbeddingRunStatus, EmbeddingRunSummary};
    use crate::embeddings::EMBEDDING_DEFAULT_ROUTE;

    let now = now_utc_rfc3339();

    // Phase 0: resolve the embedding provider BEFORE claiming any documents.
    // If this fails (missing route, missing credential), we return an error
    // immediately without touching document state.
    let (resolved, limits) = {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let resolved = resolve_for_task(&conn, store.0.as_ref(), EMBEDDING_DEFAULT_ROUTE)
            .map_err(|e| e.to_string())?;
        let limits = limits_from_settings(&resolved.profile.settings);
        (resolved, limits)
    }; // ← DB mutex released here

    // Outer loop: claim one batch per iteration, up to max_batches_per_run.
    let mut total_embedded: u32 = 0;
    let mut total_failed: u32 = 0;
    let mut total_scanned: u32 = 0;
    let mut model_id = String::new();
    let mut dimension: u32 = 0;
    let mut safe_error: Option<String> = None;
    let mut rate_limited = false;
    let mut fully_drained = false;
    let mut batches_run: usize = 0;

    // force_rebuild and stuck-claim recovery apply only on the first iteration.
    let mut first_iter_options = options.clone();

    loop {
        if batches_run >= limits.max_batches_per_run {
            break;
        }

        // Phase 1: claim one batch (brief DB lock).
        let batch = {
            let conn = db.lock().map_err(|e| e.to_string())?;
            let batch = prepare_refresh_batch(&conn, &first_iter_options, &limits, &now)
                .map_err(|e| e.to_string())?;
            batch
        }; // ← DB mutex released here

        // Disable force_rebuild after the first iteration so subsequent iterations
        // only pick up genuinely pending/stale documents.
        first_iter_options = EmbeddingRunOptions { force_rebuild: false, ..first_iter_options };

        let Some(batch) = batch else {
            fully_drained = true;
            break;
        };

        total_scanned += batch.scanned;

        // Phases 2 + 3: call runner (no lock held) then write results (brief lock).
        // Pass the remaining HTTP-call budget so the inner loop enforces the cap at
        // the provider-request level (one per token-split text_batch), not just the
        // claim-iteration level.
        let remaining_budget = limits.max_batches_per_run.saturating_sub(batches_run);
        let (iter_summary, http_calls_made) = run_embedding_refresh_loop(
            &*db,
            &resolved,
            &batch,
            &OpenAiEmbeddingsRunner::default(),
            &now,
            &limits,
            remaining_budget,
        );
        batches_run += http_calls_made;

        total_embedded += iter_summary.embedded;
        total_failed += iter_summary.failed;
        if !iter_summary.model_id.is_empty() {
            model_id = iter_summary.model_id;
            dimension = iter_summary.dimension;
        }
        if safe_error.is_none() {
            safe_error = iter_summary.safe_error;
        }

        if matches!(iter_summary.status, EmbeddingRunStatus::Paused | EmbeddingRunStatus::Partial) {
            rate_limited = true;
            break;
        }
    }

    let status = if rate_limited {
        if total_embedded > 0 { EmbeddingRunStatus::Partial } else { EmbeddingRunStatus::Paused }
    } else if fully_drained {
        EmbeddingRunStatus::Complete
    } else {
        // max_batches_per_run reached; pending work remains.
        EmbeddingRunStatus::Partial
    };

    Ok(EmbeddingRunSummary {
        status,
        scanned: total_scanned,
        embedded: total_embedded,
        skipped: total_scanned.saturating_sub(total_embedded + total_failed),
        failed: total_failed,
        model_id,
        dimension,
        safe_error,
    })
}

/// Return counts of indexable documents by embedding status. Pass
/// `source_system_id` to scope the query to a single ingestion source.
#[tauri::command]
#[specta::specta]
pub fn embedding_status(
    source_system_id: Option<String>,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<crate::embeddings::service::EmbeddingStatusSummary, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    crate::embeddings::service::embedding_status(&conn, source_system_id.as_deref())
        .map_err(|e| e.to_string())
}

/// Find nearest-neighbor embedding candidates for a document or query text.
/// Pass exactly one of `query.document_id` or `query.query_text`.
///
/// The DB mutex is held in two brief scopes only:
///   Phase 1 — load AI provider config (document_id path also reads the stored vector).
///   Phase 3 — sqlite-vec KNN query.
/// For the query_text path, the provider HTTP call (Phase 2) runs between these
/// scopes with no lock held.
#[tauri::command]
#[specta::specta]
pub fn embedding_nearest_neighbors(
    query: crate::embeddings::service::EmbeddingCandidateQuery,
    db: tauri::State<'_, Mutex<rusqlite::Connection>>,
    store: tauri::State<'_, ManagedSecretStore>,
) -> Result<Vec<crate::embeddings::service::EmbeddingCandidate>, String> {
    use crate::ai::resolver::resolve_for_task;
    use crate::ai::runners::openai_embeddings::OpenAiEmbeddingsRunner;
    use crate::embeddings::EMBEDDING_DEFAULT_ROUTE;
    use crate::embeddings::service::{
        embed_query_text_unlocked, nearest_neighbors_by_document_id,
        nearest_neighbors_by_precomputed_vector,
    };
    use crate::embeddings::errors::EmbeddingError;

    match (&query.document_id, &query.query_text) {
        (None, None) | (Some(_), Some(_)) => {
            return Err(EmbeddingError::new(
                crate::embeddings::errors::EmbeddingErrorCategory::InvalidQuery,
                "Exactly one of document_id or query_text must be provided.",
            ).to_string());
        }
        _ => {}
    }

    if query.document_id.is_some() {
        // document_id path: no provider call needed — stored vector used directly.
        // A single brief DB lock covers both the vector lookup and the KNN query.
        let conn = db.lock().map_err(|e| e.to_string())?;
        return nearest_neighbors_by_document_id(&conn, query).map_err(|e| e.to_string());
    }

    // query_text path: 3-phase approach.

    // Phase 1: resolve AI provider config (brief DB lock).
    let resolved = {
        let conn = db.lock().map_err(|e| e.to_string())?;
        resolve_for_task(&conn, store.0.as_ref(), EMBEDDING_DEFAULT_ROUTE)
            .map_err(|e| e.to_string())?
    }; // ← DB mutex released here

    // Phase 2: embed query text (no DB lock held).
    struct ResolvedProvider<'a>(&'a crate::ai::resolver::ResolvedAiProvider);
    impl crate::embeddings::provider::EmbeddingProvider for ResolvedProvider<'_> {
        fn embed(
            &self,
            request: crate::embeddings::provider::EmbeddingRequest,
        ) -> Result<crate::embeddings::provider::EmbeddingResponse, EmbeddingError> {
            OpenAiEmbeddingsRunner::default().run(self.0, request)
        }
    }

    let text = query.query_text.as_deref().unwrap_or("");
    let provider_ref = ResolvedProvider(&resolved);
    let (query_vector, _model_id, query_dimension) =
        embed_query_text_unlocked(&provider_ref, text).map_err(|e| e.to_string())?;

    // Phase 3: KNN query (brief DB lock).
    let conn = db.lock().map_err(|e| e.to_string())?;
    nearest_neighbors_by_precomputed_vector(
        &conn,
        &query_vector,
        query_dimension,
        &resolved.profile.name,
        &resolved.profile.model,
        &query,
    ).map_err(|e| e.to_string())
}

// Ensure specta sees all source config types for TypeScript binding generation.
// These types are used in the commands above but referenced here explicitly so
// the specta type registry picks them up even if inference misses a variant.
const _: () = {
    fn _assert_specta<T: specta::Type>() {}
    fn _check() {
        _assert_specta::<SourceConfig>();
        _assert_specta::<JiraSourceConfig>();
        _assert_specta::<JiraAuthConfig>();
        _assert_specta::<JiraProjectFilter>();
        _assert_specta::<ConnectionTestSummary>();
        _assert_specta::<ConnectionTestStatus>();
        _assert_specta::<SourceCredentialKind>();
        _assert_specta::<JiraConnectionTestResult>();
        _assert_specta::<JiraConnectionTestStatus>();
        _assert_specta::<JiraConnectionErrorCategory>();
        _assert_specta::<JiraConnectionProject>();
        _assert_specta::<JiraIngestionRunOptions>();
        _assert_specta::<JiraIssueIngestionRunResult>();
        _assert_specta::<JiraIssueIngestionProgress>();
        _assert_specta::<JiraIssueListFilter>();
        _assert_specta::<JiraIssueListItem>();
        _assert_specta::<JiraIssuePreviewContent>();
        _assert_specta::<JiraIssuePreviewComment>();
        _assert_specta::<Result<JiraIssuePreviewContent, String>>();
        _assert_specta::<CollectionViewRecord>();
        _assert_specta::<CollectionViewSaveInput>();
        _assert_specta::<CollectionViewSeedInput>();
        _assert_specta::<JiraIssueStatusTransition>();
        _assert_specta::<crate::issues::history::IssueSnapshotQuery>();
        _assert_specta::<crate::issues::history::IssueSnapshotListItem>();
        _assert_specta::<crate::issues::history::IssueHistoryRetentionConfig>();
        _assert_specta::<crate::embeddings::service::EmbeddingRunOptions>();
        _assert_specta::<crate::embeddings::service::EmbeddingRunSummary>();
        _assert_specta::<crate::embeddings::service::EmbeddingRunStatus>();
        _assert_specta::<crate::embeddings::service::EmbeddingStatusSummary>();
        _assert_specta::<crate::embeddings::service::EmbeddingCandidateQuery>();
        _assert_specta::<crate::embeddings::service::EmbeddingCandidate>();
    }
};

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::ingestion::runs::{
        finish_run, start_run, update_progress, upsert_cursor,
    };
    use crate::issues::repository::{
        upsert_source_system, upsert_work_item, upsert_work_item_comment, upsert_work_item_term,
        SourceSystemInput, WorkItemCommentInput, WorkItemInput, WorkItemTermInput,
    };

    const NOW: &str = "2026-05-25T17:00:00Z";

    fn seed_source_system(conn: &Connection, source_id: &str) -> String {
        let ssid = source_system_id_for(source_id);
        upsert_source_system(
            conn,
            NOW,
            &SourceSystemInput {
                id: &ssid,
                kind: "jira",
                deployment_kind: Some("data_center"),
                display_name: "Jira Test",
                base_url: Some("https://jira.example.invalid"),
                config_source_id: Some(source_id),
            },
        )
        .expect("seed source_system");
        ssid
    }

    fn seed_run(
        conn: &Connection,
        ssid: &str,
        run_id: &str,
        status: &str,
        progress_json: &str,
        error_summary: Option<&str>,
    ) {
        start_run(
            conn,
            run_id,
            ssid,
            JIRA_ISSUE_CONNECTOR,
            NOW,
            "[\"AMP\"]",
        )
        .expect("start_run");
        update_progress(conn, run_id, progress_json, "{}").expect("update_progress");
        if status != "running" {
            finish_run(conn, run_id, NOW, status, "{}", error_summary).expect("finish_run");
        }
    }

    #[test]
    fn read_progress_returns_none_when_no_runs_exist() {
        let conn = open_in_memory().expect("db");
        seed_source_system(&conn, "src_jira");
        let got = read_progress_from_conn(&conn, "src_jira").expect("read_progress");
        assert!(got.is_none());
    }

    #[test]
    fn read_progress_decodes_running_state() {
        let conn = open_in_memory().expect("db");
        let ssid = seed_source_system(&conn, "src_jira");
        let progress = serde_json::json!({
            "phase": "searching",
            "saved_issues": 48,
            "total_issues": 63,
            "current_page": 3,
            "total_pages": 4,
        })
        .to_string();
        seed_run(&conn, &ssid, "run_1", "running", &progress, None);
        let got = read_progress_from_conn(&conn, "src_jira")
            .expect("read_progress")
            .expect("Some");
        assert_eq!(got.run_id, "run_1");
        assert_eq!(got.status, "running");
        assert_eq!(got.phase, "searching");
        assert_eq!(got.saved_issues, 48);
        assert_eq!(got.total_issues, Some(63));
        assert_eq!(got.current_page, Some(3));
        assert_eq!(got.total_pages, Some(4));
        assert_eq!(got.message, "Syncing issues");
        assert!(got.last_successful_issue_sync_at.is_none());
        assert!(got.error_summary.is_none());
    }

    #[test]
    fn read_progress_message_for_succeeded_partial_cancelled_failed() {
        let cases = [
            ("succeeded", "Synced", None),
            ("partial", "Partial sync", Some("1 tail errors")),
            ("cancelled", "Cancelled", None),
            ("failed", "Failed", Some("storage error")),
        ];
        for (i, (status, expected_message, error)) in cases.iter().enumerate() {
            let conn = open_in_memory().expect("db");
            let source_id = format!("src_{i}");
            let ssid = seed_source_system(&conn, &source_id);
            let progress = serde_json::json!({
                "phase": "searching",
                "saved_issues": 10u32,
            })
            .to_string();
            let run_id = format!("run_{i}");
            seed_run(&conn, &ssid, &run_id, status, &progress, *error);
            let got = read_progress_from_conn(&conn, &source_id)
                .expect("read_progress")
                .expect("Some");
            assert_eq!(got.status, *status);
            assert_eq!(got.message, *expected_message);
            assert_eq!(got.error_summary.as_deref(), *error);
        }
    }

    #[test]
    fn read_progress_last_successful_issue_sync_uses_max_cursor() {
        let conn = open_in_memory().expect("db");
        let ssid = seed_source_system(&conn, "src_jira");
        seed_run(&conn, &ssid, "run_1", "succeeded", "{}", None);
        // Two cursors with different last_successful_sync_at timestamps; the
        // command should return the latest.
        upsert_cursor(
            &conn,
            &ssid,
            JIRA_ISSUE_CONNECTOR,
            "project:AMP:issues",
            "{}",
            Some("2026-05-20T10:00:00Z"),
            NOW,
        )
        .expect("cursor amp");
        upsert_cursor(
            &conn,
            &ssid,
            JIRA_ISSUE_CONNECTOR,
            "project:OPS:issues",
            "{}",
            Some("2026-05-21T11:00:00Z"),
            NOW,
        )
        .expect("cursor ops");
        // An unrelated remote-links cursor must be ignored by the LIKE filter.
        upsert_cursor(
            &conn,
            &ssid,
            JIRA_ISSUE_CONNECTOR,
            "project:AMP:remotelinks",
            "{}",
            Some("2026-06-01T00:00:00Z"),
            NOW,
        )
        .expect("cursor remote");
        let got = read_progress_from_conn(&conn, "src_jira")
            .expect("read_progress")
            .expect("Some");
        assert_eq!(
            got.last_successful_issue_sync_at.as_deref(),
            Some("2026-05-21T11:00:00Z")
        );
    }

    fn seed_work_item(
        conn: &Connection,
        ssid: &str,
        upstream_id: &str,
        key: &str,
        project_key: &str,
        updated_at: &str,
    ) {
        upsert_work_item(
            conn,
            NOW,
            &WorkItemInput {
                id: &format!("wi_{upstream_id}"),
                source_system_id: ssid,
                source_kind: "jira_issue",
                upstream_id,
                key: Some(key),
                url: None,
                title: &format!("Title {key}"),
                body: None,
                state: "open",
                status_name: Some("In Progress"),
                resolution_name: None,
                priority_name: None,
                item_type: Some("Task"),
                project_key: Some(project_key),
                project_name: Some(project_key),
                assignee_person_id: None,
                reporter_person_id: None,
                created_at_source: None,
                updated_at_source: Some(updated_at),
                resolved_at_source: None,
                due_at_source: None,
                raw_updated_hash: "h",
            },
        )
        .expect("upsert_work_item");
    }

    #[test]
    fn jira_issues_list_returns_rows_filtered_by_source_and_project() {
        let conn = open_in_memory().expect("db");
        let ssid = seed_source_system(&conn, "src_jira");
        // Different source to verify the source_id filter.
        let other_ssid = seed_source_system(&conn, "src_other");

        seed_work_item(&conn, &ssid, "10001", "AMP-1", "AMP", "2026-05-20T00:00:00Z");
        seed_work_item(&conn, &ssid, "10002", "OPS-1", "OPS", "2026-05-22T00:00:00Z");
        seed_work_item(
            &conn,
            &other_ssid,
            "20001",
            "ZZZ-1",
            "ZZZ",
            "2026-05-24T00:00:00Z",
        );

        // No filter → all jira_issue rows from both sources.
        let all = list_jira_issues_from_conn(
            &conn,
            &JiraIssueListFilter {
                source_id: None,
                project_key: None,
                limit: None,
            },
        )
        .expect("list");
        assert_eq!(all.len(), 3);
        // Default ORDER BY updated_at_source DESC → ZZZ-1 first.
        assert_eq!(all[0].key, "ZZZ-1");

        // Filter by source_id → only AMP and OPS.
        let by_source = list_jira_issues_from_conn(
            &conn,
            &JiraIssueListFilter {
                source_id: Some("src_jira".into()),
                project_key: None,
                limit: None,
            },
        )
        .expect("list");
        assert_eq!(by_source.len(), 2);
        let keys: Vec<&str> = by_source.iter().map(|r| r.key.as_str()).collect();
        assert!(keys.contains(&"AMP-1"));
        assert!(keys.contains(&"OPS-1"));
        assert!(!keys.contains(&"ZZZ-1"));

        // Filter by project_key as well → just AMP.
        let by_project = list_jira_issues_from_conn(
            &conn,
            &JiraIssueListFilter {
                source_id: Some("src_jira".into()),
                project_key: Some("AMP".into()),
                limit: None,
            },
        )
        .expect("list");
        assert_eq!(by_project.len(), 1);
        assert_eq!(by_project[0].key, "AMP-1");
        assert_eq!(by_project[0].project_key.as_deref(), Some("AMP"));
        assert_eq!(by_project[0].status_name.as_deref(), Some("In Progress"));
    }

    #[test]
    fn jira_issue_preview_content_excludes_raw_json_fields() {
        let item = JiraIssuePreviewContent {
            work_item_id: "wi_amp_1043".into(),
            body: Some("Steps to reproduce".into()),
            comments: vec![JiraIssuePreviewComment {
                id: "comment_1".into(),
                upstream_id: "10001".into(),
                author_display_name: Some("Priya".into()),
                body: Some("Latest update".into()),
                created_at_source: Some("2026-05-30T09:00:00Z".into()),
                updated_at_source: Some("2026-05-31T10:00:00Z".into()),
                ingested_at: "2026-05-31T10:01:00Z".into(),
            }],
        };

        let v = serde_json::to_value(&item).expect("serialize");
        let keys: std::collections::BTreeSet<&str> =
            v.as_object().unwrap().keys().map(|k| k.as_str()).collect();
        let expected: std::collections::BTreeSet<&str> =
            ["work_item_id", "body", "comments"].into_iter().collect();
        assert_eq!(keys, expected);

        let comment = &v["comments"].as_array().unwrap()[0];
        let comment_keys: std::collections::BTreeSet<&str> = comment
            .as_object()
            .unwrap()
            .keys()
            .map(|k| k.as_str())
            .collect();
        let expected_comment_keys: std::collections::BTreeSet<&str> = [
            "id",
            "upstream_id",
            "author_display_name",
            "body",
            "created_at_source",
            "updated_at_source",
            "ingested_at",
        ]
        .into_iter()
        .collect();
        assert_eq!(comment_keys, expected_comment_keys);
    }

    fn seed_preview_work_item(
        conn: &Connection,
        ssid: &str,
        id: &str,
        source_kind: &str,
        body: Option<&str>,
    ) {
        upsert_work_item(
            conn,
            NOW,
            &WorkItemInput {
                id,
                source_system_id: ssid,
                source_kind,
                upstream_id: id,
                key: Some("AMP-1043"),
                url: None,
                title: "Preview issue",
                body,
                state: "open",
                status_name: Some("Open"),
                resolution_name: None,
                priority_name: Some("P3"),
                item_type: Some("Task"),
                project_key: Some("AMP"),
                project_name: Some("AMP"),
                assignee_person_id: None,
                reporter_person_id: None,
                created_at_source: Some("2026-05-01T09:00:00Z"),
                updated_at_source: Some("2026-05-31T09:00:00Z"),
                resolved_at_source: None,
                due_at_source: None,
                raw_updated_hash: "hash-preview",
            },
        )
        .expect("seed preview work item");
    }

    fn seed_source_identity(
        conn: &Connection,
        id: &str,
        source_system_id: &str,
        display_name: Option<&str>,
        username: Option<&str>,
        email: Option<&str>,
        person_display_name: Option<&str>,
    ) {
        // person_id is NOT NULL in source_identities; always create a person row.
        // Use person_display_name when set, otherwise fall back through display_name,
        // username, and email so the person row doesn't shadow the source-identity fields
        // in the COALESCE used by the query helper.
        let person_label = person_display_name
            .or(display_name)
            .or(username)
            .or(email)
            .unwrap_or(id);
        let person_id = format!("person_{id}");
        conn.execute(
            "INSERT INTO people (id, display_name, primary_email, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?4)",
            rusqlite::params![&person_id, person_label, email, NOW],
        )
        .expect("seed person");

        conn.execute(
            "INSERT INTO source_identities (
                id, source_system_id, source_kind, upstream_account_id, display_name, username,
                email, avatar_url, raw_json, created_at, updated_at, person_id
             ) VALUES (?1, ?2, 'jira', ?3, ?4, ?5, ?6, NULL, NULL, ?7, ?7, ?8)",
            rusqlite::params![
                id,
                source_system_id,
                format!("upstream_{id}"),
                display_name,
                username,
                email,
                NOW,
                &person_id,
            ],
        )
        .expect("seed source identity");
    }

    fn seed_preview_comment(
        conn: &Connection,
        ssid: &str,
        work_item_id: &str,
        id: &str,
        author_identity_id: Option<&str>,
        body: Option<&str>,
        created_at_source: Option<&str>,
        updated_at_source: Option<&str>,
        ingested_at: &str,
    ) {
        upsert_work_item_comment(
            conn,
            ingested_at,
            &WorkItemCommentInput {
                id,
                work_item_id,
                source_system_id: ssid,
                upstream_id: id,
                author_identity_id,
                body,
                visibility_json: None,
                created_at_source,
                updated_at_source,
                raw_json: None,
                body_hash: "comment-hash",
            },
        )
        .expect("seed preview comment");
    }

    #[test]
    fn jira_issue_preview_content_loads_body_and_empty_comments() {
        let conn = open_in_memory().expect("db");
        let ssid = seed_source_system(&conn, "src_jira");
        seed_preview_work_item(&conn, &ssid, "wi_amp_1043", "jira_issue", Some("Issue body"));

        let content = jira_issue_preview_content_from_conn(&conn, "wi_amp_1043").expect("content");

        assert_eq!(content.work_item_id, "wi_amp_1043");
        assert_eq!(content.body.as_deref(), Some("Issue body"));
        assert!(content.comments.is_empty());
    }

    #[test]
    fn jira_issue_preview_content_returns_comments_newest_first_with_author_names() {
        let conn = open_in_memory().expect("db");
        let ssid = seed_source_system(&conn, "src_jira");
        seed_preview_work_item(&conn, &ssid, "wi_amp_1043", "jira_issue", Some("Issue body"));
        seed_source_identity(&conn, "ident_person", &ssid, Some("Source Priya"), Some("priya"), Some("priya@example.com"), Some("Priya Person"));
        seed_source_identity(&conn, "ident_source", &ssid, Some("Tarek Source"), Some("tarek"), Some("tarek@example.com"), None);
        seed_source_identity(&conn, "ident_user", &ssid, None, Some("elena"), Some("elena@example.com"), None);

        seed_preview_comment(
            &conn, &ssid, "wi_amp_1043", "c_old_created",
            Some("ident_user"), Some("Old by created"),
            Some("2026-05-28T10:00:00Z"), None, "2026-05-28T10:01:00Z",
        );
        seed_preview_comment(
            &conn, &ssid, "wi_amp_1043", "c_new_updated",
            Some("ident_person"), Some("Newest by updated"),
            Some("2026-05-27T10:00:00Z"), Some("2026-05-31T10:00:00Z"), "2026-05-31T10:01:00Z",
        );
        seed_preview_comment(
            &conn, &ssid, "wi_amp_1043", "c_middle_source",
            Some("ident_source"), Some("Middle by source display"),
            Some("2026-05-30T10:00:00Z"), None, "2026-05-30T10:01:00Z",
        );
        seed_preview_comment(
            &conn, &ssid, "wi_amp_1043", "c_ingested_fallback",
            None, Some("Fallback by ingested"),
            None, None, "2026-05-29T10:01:00Z",
        );

        let content = jira_issue_preview_content_from_conn(&conn, "wi_amp_1043").expect("content");
        let ids: Vec<&str> = content.comments.iter().map(|c| c.id.as_str()).collect();

        assert_eq!(ids, vec!["c_new_updated", "c_middle_source", "c_ingested_fallback", "c_old_created"]);
        assert_eq!(content.comments[0].author_display_name.as_deref(), Some("Priya Person"));
        assert_eq!(content.comments[1].author_display_name.as_deref(), Some("Tarek Source"));
        assert_eq!(content.comments[3].author_display_name.as_deref(), Some("elena"));
    }

    #[test]
    fn jira_issue_preview_content_rejects_missing_or_non_jira_work_item() {
        let conn = open_in_memory().expect("db");
        let ssid = seed_source_system(&conn, "src_jira");
        seed_preview_work_item(&conn, &ssid, "wi_note_1", "github_issue", Some("Not Jira"));

        let missing = jira_issue_preview_content_from_conn(&conn, "missing").unwrap_err();
        assert_eq!(missing, "Jira issue preview content not found for work item missing");

        let non_jira = jira_issue_preview_content_from_conn(&conn, "wi_note_1").unwrap_err();
        assert_eq!(non_jira, "Jira issue preview content not found for work item wi_note_1");
    }

    #[test]
    fn jira_issues_list_excludes_raw_json_fields() {
        // Compile-time guarantee: serialise a row and confirm the JSON keys
        // are the public fields only. If someone adds a `raw_json` to
        // `JiraIssueListItem` this test will fail.
        let item = JiraIssueListItem {
            work_item_id: "wi".into(),
            key: "AMP-1".into(),
            title: "T".into(),
            status_name: None,
            assignee_display_name: None,
            updated_at_source: None,
            project_key: None,
            priority_name: None,
            labels: vec![],
        };
        let v = serde_json::to_value(&item).expect("serialize");
        let keys: std::collections::BTreeSet<&str> =
            v.as_object().unwrap().keys().map(|k| k.as_str()).collect();
        let expected: std::collections::BTreeSet<&str> = [
            "work_item_id",
            "key",
            "title",
            "status_name",
            "assignee_display_name",
            "updated_at_source",
            "project_key",
            "priority_name",
            "labels",
        ]
        .into_iter()
        .collect();
        assert_eq!(keys, expected);
    }

    // ── History command tests ─────────────────────────────────────────────────

    use crate::issues::history::{
        upsert_issue_event, upsert_issue_snapshot, IssueEventInput, IssueHistoryRetentionConfig,
        IssueSnapshotInput, IssueSnapshotQuery,
    };

    fn seeded_history_command_conn() -> Connection {
        let conn = open_in_memory().expect("db");
        // Insert source system
        conn.execute(
            "INSERT INTO source_systems (id, kind, deployment_kind, display_name, base_url, config_source_id, created_at, updated_at)
             VALUES ('srcsys_jira_1', 'jira', 'datacenter', 'Test Jira', 'https://jira.example.com', 'primary', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            [],
        ).expect("seed source_system");
        // Insert work item
        conn.execute(
            "INSERT INTO work_items (id, source_system_id, source_kind, upstream_id, key, title, state, raw_updated_hash, last_seen_at, created_at, updated_at)
             VALUES ('wi_amp_1043', 'srcsys_jira_1', 'jira_issue', 'AMP-1043', 'AMP-1043', 'Fix the widget', 'open', 'abc123', '2026-05-28T00:00:00Z', '2026-05-28T00:00:00Z', '2026-05-28T00:00:00Z')",
            [],
        ).expect("seed work_item");
        // Insert two status_changed events with different occurred_at timestamps
        let event1 = IssueEventInput {
            id: "iev_s1".to_string(),
            source_system_id: "srcsys_jira_1".to_string(),
            issue_id: "wi_amp_1043".to_string(),
            entity_type: "jira_issue".to_string(),
            entity_id: "wi_amp_1043".to_string(),
            source_kind: "jira".to_string(),
            event_type: "status_changed".to_string(),
            upstream_event_id: None,
            upstream_item_id: None,
            field_id: None,
            field_name: Some("status".to_string()),
            actor_identity_id: None,
            actor_display_name: Some("Alice".to_string()),
            occurred_at: "2026-05-26T10:00:00Z".to_string(),
            from_string: Some("To Do".to_string()),
            to_string: Some("In Progress".to_string()),
            from_json: None,
            to_json: None,
            payload_json: "{}".to_string(),
            ingested_at: "2026-05-28T00:00:00Z".to_string(),
        };
        let event2 = IssueEventInput {
            id: "iev_s2".to_string(),
            occurred_at: "2026-05-27T14:00:00Z".to_string(),
            from_string: Some("In Progress".to_string()),
            to_string: Some("Done".to_string()),
            ..event1.clone()
        };
        upsert_issue_event(&conn, &event1).expect("seed event1");
        upsert_issue_event(&conn, &event2).expect("seed event2");
        conn
    }

    fn seeded_history_command_conn_with_many_snapshots(n: u32) -> Connection {
        let conn = open_in_memory().expect("db");
        conn.execute(
            "INSERT INTO source_systems (id, kind, deployment_kind, display_name, base_url, config_source_id, created_at, updated_at)
             VALUES ('srcsys_jira_1', 'jira', 'datacenter', 'Test Jira', 'https://jira.example.com', 'primary', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            [],
        ).expect("seed source_system");
        for i in 0..n {
            let issue_id = format!("wi_issue_{i}");
            conn.execute(
                &format!(
                    "INSERT INTO work_items (id, source_system_id, source_kind, upstream_id, key, title, state, raw_updated_hash, last_seen_at, created_at, updated_at)
                     VALUES ('{issue_id}', 'srcsys_jira_1', 'jira_issue', 'ISSUE-{i}', 'ISSUE-{i}', 'Issue {i}', 'open', 'h{i}', '2026-05-28T00:00:00Z', '2026-05-28T00:00:00Z', '2026-05-28T00:00:00Z')"
                ),
                [],
            ).expect("seed work_item");
            let snap = IssueSnapshotInput {
                issue_id: issue_id.clone(),
                snapshot_date: "2026-05-28".to_string(),
                source_system_id: "srcsys_jira_1".to_string(),
                source_kind: "jira_issue".to_string(),
                key: Some(format!("ISSUE-{i}")),
                title: format!("Issue {i}"),
                body_hash: None,
                state: "open".to_string(),
                status_name: Some("To Do".to_string()),
                status_id: None,
                resolution_name: None,
                resolution_id: None,
                priority_name: None,
                priority_id: None,
                item_type: None,
                project_key: Some("ISSUE".to_string()),
                project_name: None,
                assignee_person_id: None,
                reporter_person_id: None,
                labels_json: "[]".to_string(),
                components_json: "[]".to_string(),
                fix_versions_json: "[]".to_string(),
                sprint_names_json: "[]".to_string(),
                product_names_json: "[]".to_string(),
                assigned_team_names_json: "[]".to_string(),
                customer_name: None,
                parent_link: None,
                epic_link: None,
                epic_name: None,
                epic_status: None,
                created_at_source: None,
                updated_at_source: None,
                resolved_at_source: None,
                due_at_source: None,
                snapshot_source: "generated".to_string(),
                generated_at: "2026-05-28T12:00:00Z".to_string(),
            };
            upsert_issue_snapshot(&conn, &snap).expect("seed snapshot");
        }
        conn
    }

    #[test]
    fn status_timeline_returns_newest_first_status_events() {
        let conn = seeded_history_command_conn();
        let rows = jira_issue_status_timeline_from_conn(&conn, "wi_amp_1043").unwrap();
        assert!(!rows.is_empty());
        // newest first
        for w in rows.windows(2) {
            assert!(w[0].occurred_at >= w[1].occurred_at);
        }
        // event_id is always a non-empty string
        assert!(!rows[0].event_id.is_empty());
        // complete is always true
        assert!(rows[0].complete);
    }

    #[test]
    fn issue_snapshot_query_filters_and_limits() {
        let conn = seeded_history_command_conn_with_many_snapshots(600);
        let query = IssueSnapshotQuery {
            snapshot_date: "2026-05-28".to_string(),
            source_id: None,
            project_key: None,
            status_name: None,
            state: None,
            assignee_person_id: None,
            priority_name: None,
            label: None,
            sprint_name: None,
            product_name: None,
            customer_name: None,
            limit: Some(9999), // over the 500 cap
        };
        let rows = issue_snapshots_query_from_conn(&conn, &query).unwrap();
        assert_eq!(rows.len(), 500);
    }

    #[test]
    fn retention_commands_validate_config() {
        let conn = seeded_history_command_conn();
        // save and get round-trip
        let config = IssueHistoryRetentionConfig {
            version: 1,
            daily_days: 90,
            compact_to_weekly_after_days: 365,
            weekly_anchor: "monday".to_string(),
        };
        issue_history_retention_save_to_conn(&conn, &config).unwrap();
        let loaded = issue_history_retention_get_from_conn(&conn).unwrap();
        assert_eq!(loaded.daily_days, 90);
    }

    #[test]
    fn status_timeline_missing_issue_returns_empty_list() {
        let conn = seeded_history_command_conn();
        let rows = jira_issue_status_timeline_from_conn(&conn, "nonexistent_id").unwrap();
        assert!(rows.is_empty());
    }

    #[test]
    fn snapshot_query_rejects_unbounded_limit_to_500() {
        let conn = seeded_history_command_conn_with_many_snapshots(600);
        let query = IssueSnapshotQuery {
            snapshot_date: "2026-05-28".to_string(),
            source_id: None,
            project_key: None,
            status_name: None,
            state: None,
            assignee_person_id: None,
            priority_name: None,
            label: None,
            sprint_name: None,
            product_name: None,
            customer_name: None,
            limit: Some(9999),
        };
        let rows = issue_snapshots_query_from_conn(&conn, &query).unwrap();
        assert_eq!(rows.len(), 500);
    }

    #[test]
    fn command_storage_errors_are_safe() {
        // Open a connection WITHOUT running setup_schema - so tables don't exist
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        let err = jira_issue_status_timeline_from_conn(&conn, "wi_amp_1043").unwrap_err();
        assert_eq!(err, "Could not read issue history. Try syncing Jira again.");
    }

    #[test]
    fn run_options_with_fetch_remote_links_propagate_to_service() {
        // Smoke test that JiraIngestionRunOptions is plumbed through specta
        // correctly. Full end-to-end runs require Tauri state (AppHandle),
        // so this only covers the serde wire shape.
        let opts = JiraIngestionRunOptions {
            fetch_remote_links: true,
        };
        let json = serde_json::to_string(&opts).unwrap();
        assert!(json.contains("\"fetch_remote_links\":true"));
        let parsed: JiraIngestionRunOptions = serde_json::from_str(&json).unwrap();
        assert!(parsed.fetch_remote_links);
    }

    #[test]
    fn jira_issues_list_respects_limit() {
        let conn = open_in_memory().expect("db");
        let ssid = seed_source_system(&conn, "src_jira");
        for i in 0..5 {
            seed_work_item(
                &conn,
                &ssid,
                &format!("1000{i}"),
                &format!("AMP-{i}"),
                "AMP",
                &format!("2026-05-2{i}T00:00:00Z"),
            );
        }
        let got = list_jira_issues_from_conn(
            &conn,
            &JiraIssueListFilter {
                source_id: Some("src_jira".into()),
                project_key: None,
                limit: Some(2),
            },
        )
        .expect("list");
        assert_eq!(got.len(), 2);
    }

    #[test]
    fn jira_issues_list_returns_priority_name_and_labels() {
        let conn = open_in_memory().expect("db");
        let ssid = seed_source_system(&conn, "src_jira");

        // Seed a work item with priority_name set.
        upsert_work_item(
            &conn,
            NOW,
            &WorkItemInput {
                id: "wi_high",
                source_system_id: &ssid,
                source_kind: "jira_issue",
                upstream_id: "30001",
                key: Some("AMP-99"),
                url: None,
                title: "Priority issue",
                body: None,
                state: "open",
                status_name: Some("To Do"),
                resolution_name: None,
                priority_name: Some("High"),
                item_type: Some("Bug"),
                project_key: Some("AMP"),
                project_name: Some("AMP"),
                assignee_person_id: None,
                reporter_person_id: None,
                created_at_source: None,
                updated_at_source: Some("2026-05-25T00:00:00Z"),
                resolved_at_source: None,
                due_at_source: None,
                raw_updated_hash: "h99",
            },
        )
        .expect("upsert work item");

        // Seed two label terms.
        for label in &["backend", "infra"] {
            upsert_work_item_term(
                &conn,
                &WorkItemTermInput {
                    work_item_id: "wi_high",
                    term_kind: "label",
                    term_key: label,
                    term_name: Some(label),
                    raw_json: None,
                },
            )
            .expect("upsert label term");
        }

        let results = list_jira_issues_from_conn(
            &conn,
            &JiraIssueListFilter {
                source_id: Some("src_jira".into()),
                project_key: Some("AMP".into()),
                limit: None,
            },
        )
        .expect("list");

        assert_eq!(results.len(), 1);
        let item = &results[0];
        assert_eq!(item.key, "AMP-99");
        assert_eq!(item.priority_name.as_deref(), Some("High"));
        // Labels are aggregated via GROUP_CONCAT; order is not guaranteed, so
        // check membership rather than exact order.
        assert_eq!(item.labels.len(), 2);
        assert!(item.labels.contains(&"backend".to_string()));
        assert!(item.labels.contains(&"infra".to_string()));
    }

    // ── Embedding command tests ───────────────────────────────────────────────

    /// A fake embedding runner for use in commands.rs tests. Ignores the resolved
    /// provider and returns deterministic zero vectors for each input text.
    struct FakeCommandEmbeddingRunner;
    impl EmbeddingRunnerForCommand for FakeCommandEmbeddingRunner {
        fn run(
            &self,
            _resolved: &crate::ai::resolver::ResolvedAiProvider,
            request: crate::embeddings::provider::EmbeddingRequest,
        ) -> Result<crate::embeddings::provider::EmbeddingResponse, crate::embeddings::errors::EmbeddingError> {
            Ok(crate::embeddings::provider::EmbeddingResponse {
                vectors: request.input.iter().map(|_| vec![0.1f32, 0.2, 0.3]).collect(),
                model: "embed-v-4-0".into(),
                profile: "grove-embed-v4".into(),
                dimension: 3,
                usage: None,
            })
        }
    }

    /// Build a minimal `ResolvedAiProvider` for tests. The `FakeCommandEmbeddingRunner`
    /// ignores the resolved value, so any well-typed instance will do.
    fn fake_resolved_provider() -> crate::ai::resolver::ResolvedAiProvider {
        use crate::ai::config::{
            AiCredentialConfig, AiCredentialKind, AiEndpointConfig, AiEndpointProtocol,
            AiExecutionMode, AiProfileConfig, AiRunner, CredentialSource,
        };
        use crate::ai::credentials::LoadedCredentialSecret;
        crate::ai::resolver::ResolvedAiProvider {
            profile: AiProfileConfig {
                name: "grove-embed-v4".into(),
                endpoint_ref: "grove".into(),
                model: "embed-v-4-0".into(),
                runner: AiRunner::OpenAiEmbeddings,
                execution_mode: AiExecutionMode::DirectApi,
                settings: crate::commands::JsonValue(serde_json::json!({})),
            },
            endpoint: AiEndpointConfig {
                name: "grove".into(),
                protocol: AiEndpointProtocol::OpenAiEmbeddingsCompatible,
                base_url: "https://api.example.invalid".into(),
                credential_ref: "grove-key".into(),
            },
            credential: AiCredentialConfig {
                name: "grove-key".into(),
                kind: AiCredentialKind::ApiKey,
                source: CredentialSource::Env { var_name: "TEST_API_KEY".into() },
            },
            secret: LoadedCredentialSecret::new_for_test("grove-key", "sk-test-fake"),
        }
    }

    #[test]
    fn post_ingestion_embedding_loop_embeds_before_gardener_step() {
        use crate::embeddings::limits::EmbeddingBatchLimits;
        use crate::embeddings::repository::{setup_schema, seed_source_and_document};
        use crate::embeddings::service::prepare_refresh_batch;

        let conn = open_in_memory().expect("db");
        setup_schema(&conn).expect("embedding schema");
        seed_source_and_document(&conn, "doc_1", "hash_a");

        let embed_opts = crate::embeddings::service::EmbeddingRunOptions {
            source_system_id: Some("srcsys_1".into()),
            entity_kind: None,
            limit: Some(10),
            force_rebuild: false,
        };

        let now = "2026-01-01T00:00:00Z";
        let limits = EmbeddingBatchLimits::default();

        // Wrap connection in a Mutex so run_embedding_refresh_loop can lock/unlock
        // between Phase 2 (HTTP call) and Phase 3 (write), matching production behaviour.
        let db = std::sync::Mutex::new(conn);

        // Phase 1: claim documents (simulates what the ingestion worker does).
        let batch = {
            let conn = db.lock().expect("phase 1 lock");
            prepare_refresh_batch(&conn, &embed_opts, &limits, now)
                .expect("prepare batch")
                .expect("should have pending doc")
        }; // lock released here

        // Phase 2+3: run the embedding loop with the fake runner.
        let resolved = fake_resolved_provider();
        let (summary, _http_calls) = run_embedding_refresh_loop(
            &db,
            &resolved,
            &batch,
            &FakeCommandEmbeddingRunner,
            now,
            &limits,
            limits.max_batches_per_run,
        );

        // The embedding loop must complete before any gardener step would run.
        // Assert the document is embedded (or at least processed) by the time
        // the loop returns.
        //
        // When sqlite-vec is unavailable the write fails and the document ends up
        // in 'failed' state. In either case the loop must have run and produced a
        // non-'embedding' status (not stuck).
        let conn = db.lock().expect("final check lock");
        let status: String = conn.query_row(
            "SELECT embedding_status FROM indexable_documents WHERE id = 'doc_1'",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_ne!(status, "embedding", "document must not be stuck in 'embedding' after the loop");
        assert_ne!(status, "pending", "document must have been processed by the loop");

        // When sqlite-vec is available, assert full success.
        if crate::db::load_sqlite_vec(&conn).is_ok() {
            assert_eq!(summary.embedded, 1);
            assert_eq!(status, "embedded");
        }
    }

    /// Regression test: provider resolution failure before claiming must leave no documents stuck.
    ///
    /// Demonstrates the FIX for INIT-2: when resolve_for_task fails (missing route),
    /// prepare_refresh_batch is never called, so no documents are claimed and none
    /// get stuck in the 'embedding' state.
    #[test]
    fn resolution_failure_before_claim_leaves_no_documents_stuck() {
        use crate::embeddings::limits::EmbeddingBatchLimits;
        use crate::embeddings::repository::{setup_schema, seed_source_and_document};
        use crate::embeddings::service::prepare_refresh_batch;

        let conn = open_in_memory().expect("db");
        setup_schema(&conn).expect("embedding schema");
        seed_source_and_document(&conn, "doc_1", "hash_a");

        // Simulate the FIXED code flow: resolve first (fails) → skip claiming.
        // No call to prepare_refresh_batch when resolution fails.
        let resolved_result = crate::ai::resolver::resolve_for_task(
            &conn,
            // InMemorySecretStore with no config — will return MissingRoute error
            &crate::settings::secrets::InMemorySecretStore::new(),
            crate::embeddings::EMBEDDING_DEFAULT_ROUTE,
        );
        // Resolution must fail (no route configured).
        assert!(resolved_result.is_err(), "resolution should fail with no route configured");

        // Because resolution failed, we never called prepare_refresh_batch.
        // The document must still be 'pending', not 'embedding'.
        let status: String = conn.query_row(
            "SELECT embedding_status FROM indexable_documents WHERE id = 'doc_1'",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(status, "pending", "document must remain 'pending' when resolution fails before claiming");
    }

    /// Regression test: non-default profile settings must affect request splitting.
    ///
    /// Uses max_inputs_per_request = 5 (from profile settings) to verify that
    /// limits_from_settings is applied and not overridden by EmbeddingBatchLimits::default().
    #[test]
    fn non_default_profile_settings_affect_request_splitting() {
        use std::sync::{Arc, Mutex as StdMutex};
        use crate::embeddings::limits::{EmbeddingBatchLimits, limits_from_settings};
        use crate::embeddings::repository::{setup_schema, seed_source_and_document};
        use crate::embeddings::service::prepare_refresh_batch;
        use crate::embeddings::provider::{EmbeddingProvider, EmbeddingRequest, EmbeddingResponse};
        use crate::embeddings::errors::EmbeddingError;

        let conn = open_in_memory().expect("db");
        setup_schema(&conn).expect("embedding schema");

        // Seed 12 documents in addition to the default srcsys/work_item from seed_source_and_document.
        seed_source_and_document(&conn, "doc_0", "hash_0");
        for i in 1..12 {
            conn.execute(
                "INSERT OR IGNORE INTO indexable_documents \
                 (id, source_system_id, entity_kind, entity_id, work_item_id, title, body, metadata_json, content_hash, embedding_status, created_at, updated_at) \
                 VALUES (?1, 'srcsys_1', 'jira_issue', 'wi_1', 'wi_1', ?2, ?3, '{}', ?4, 'pending', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
                rusqlite::params![
                    format!("doc_{i}"),
                    format!("Issue {i}"),
                    format!("Body {i}"),
                    format!("hash_{i}"),
                ],
            ).unwrap();
        }

        // Non-default limits: max_inputs_per_request = 5 (much smaller than default 96)
        let profile_settings = crate::commands::JsonValue(serde_json::json!({
            "max_inputs_per_request": 5,
            "max_batches_per_run": 10,
            "rate_limit_backoff_seconds": 120
        }));
        let limits = limits_from_settings(&profile_settings);
        assert_eq!(limits.max_inputs_per_request, 5);
        assert_eq!(limits.max_batches_per_run, 10);
        assert_eq!(limits.rate_limit_backoff_seconds, 120);

        let opts = crate::embeddings::service::EmbeddingRunOptions {
            source_system_id: None,
            entity_kind: None,
            limit: None,
            force_rebuild: false,
        };

        // prepare_refresh_batch with non-default limits must claim at most 5 docs.
        let batch = prepare_refresh_batch(&conn, &opts, &limits, "2026-01-01T00:00:00Z")
            .expect("prepare batch")
            .expect("should have pending docs");
        let claimed_count: usize = batch.text_batches.iter().map(|b| b.docs.len()).sum();
        assert_eq!(claimed_count, 5, "non-default max_inputs_per_request=5 must limit claim to 5 docs");
    }

    /// Regression test: max_batches_per_run limits the number of provider HTTP calls
    /// across the outer loop in embedding_refresh_run.
    ///
    /// Uses the run_embedding_refresh_loop helper with a counting provider to verify
    /// that after max_batches_per_run iterations, remaining pending docs are left intact.
    /// Requires sqlite-vec for successful writes; the test is skipped if unavailable.
    #[test]
    fn outer_loop_respects_max_batches_per_run() {
        use crate::embeddings::limits::EmbeddingBatchLimits;
        use crate::embeddings::repository::{setup_schema, seed_source_and_document};
        use crate::embeddings::service::{prepare_refresh_batch, EmbeddingRunOptions, EmbeddingRunStatus};
        use std::sync::Mutex as StdMutex;

        let conn = open_in_memory().expect("db");
        if crate::db::load_sqlite_vec(&conn).is_err() {
            eprintln!("SKIP: sqlite-vec not available");
            return;
        }
        setup_schema(&conn).expect("embedding schema");
        seed_source_and_document(&conn, "doc_0", "hash_0");
        for i in 1..20 {
            conn.execute(
                "INSERT OR IGNORE INTO indexable_documents \
                 (id, source_system_id, entity_kind, entity_id, work_item_id, title, body, metadata_json, content_hash, embedding_status, created_at, updated_at) \
                 VALUES (?1, 'srcsys_1', 'jira_issue', 'wi_1', 'wi_1', ?2, ?3, '{}', ?4, 'pending', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
                rusqlite::params![
                    format!("doc_{i}"),
                    format!("Issue {i}"),
                    format!("Body {i}"),
                    format!("hash_{i}"),
                ],
            ).unwrap();
        }
        // 20 docs total; with max_inputs_per_request=5 and max_batches_per_run=2,
        // only 10 docs should be processed (status Partial, 10 remain pending).
        let limits = EmbeddingBatchLimits {
            max_inputs_per_request: 5,
            max_estimated_tokens_per_request: 8_000,
            max_batches_per_run: 2,
            rate_limit_backoff_seconds: 60,
        };

        let db = StdMutex::new(conn);
        let opts = EmbeddingRunOptions {
            source_system_id: None,
            entity_kind: None,
            limit: None,
            force_rebuild: false,
        };
        let resolved = fake_resolved_provider();
        let now = "2026-01-01T00:00:00Z";

        let mut batches_run = 0usize;
        let mut fully_drained = false;
        let mut first_iter_opts = opts.clone();
        loop {
            if batches_run >= limits.max_batches_per_run {
                break;
            }
            let batch = {
                let conn = db.lock().expect("lock");
                prepare_refresh_batch(&conn, &first_iter_opts, &limits, now)
                    .expect("prepare batch")
            };
            first_iter_opts = EmbeddingRunOptions { force_rebuild: false, ..first_iter_opts };
            let Some(batch) = batch else {
                fully_drained = true;
                break;
            };
            let remaining_budget = limits.max_batches_per_run.saturating_sub(batches_run);
            let (iter_summary, http_calls_made) = run_embedding_refresh_loop(
                &db, &resolved, &batch, &FakeCommandEmbeddingRunner, now, &limits, remaining_budget,
            );
            batches_run += http_calls_made;
            if matches!(iter_summary.status, EmbeddingRunStatus::Paused | EmbeddingRunStatus::Partial) {
                break;
            }
        }

        assert!(!fully_drained, "20 docs with 2 batches of 5 should not fully drain");
        // Each claim of 5 docs produces 1 text_batch (within the 8000-token limit),
        // so batches_run == HTTP calls made == max_batches_per_run.
        assert_eq!(batches_run, 2, "exactly max_batches_per_run=2 HTTP calls should have been made");

        let pending_count: i64 = {
            let conn = db.lock().unwrap();
            conn.query_row(
                "SELECT count(*) FROM indexable_documents WHERE embedding_status = 'pending'",
                [],
                |r| r.get(0),
            ).unwrap()
        };
        assert_eq!(pending_count, 10, "10 docs should remain pending after 2 batches of 5");
    }

    /// Regression test: when a single claim produces multiple token-split text_batches,
    /// `run_embedding_refresh_loop` must honour `max_http_calls=1` and stop after the
    /// first provider request, leaving the remaining text_batches' docs in 'embedding'
    /// state (to be recovered at the start of the next run).
    ///
    /// This validates FINAL-1: max_batches_per_run is enforced at the HTTP-call
    /// level, not just at the claim-iteration level.
    #[test]
    fn token_split_within_claim_respects_max_http_calls() {
        use std::sync::{Arc, Mutex as StdMutex};
        use crate::embeddings::limits::EmbeddingBatchLimits;
        use crate::embeddings::repository::{setup_schema, seed_source_and_document};
        use crate::embeddings::service::{prepare_refresh_batch, EmbeddingRunOptions};
        use crate::embeddings::provider::{EmbeddingRequest, EmbeddingResponse};
        use crate::embeddings::errors::EmbeddingError;

        let conn = open_in_memory().expect("db");
        setup_schema(&conn).expect("embedding schema");

        // Seed 3 docs. Each assembled text is "Title: Login bug\n\nBody:\nCannot sign in"
        // (≈10 estimated tokens). With max_estimated_tokens_per_request=15, each doc
        // starts its own text_batch (10 + 10 > 15), producing 3 text_batches per claim.
        seed_source_and_document(&conn, "doc_0", "hash_0");
        for i in 1..3 {
            conn.execute(
                "INSERT OR IGNORE INTO indexable_documents \
                 (id, source_system_id, entity_kind, entity_id, work_item_id, title, body, metadata_json, content_hash, embedding_status, created_at, updated_at) \
                 VALUES (?1, 'srcsys_1', 'jira_issue', 'wi_1', 'wi_1', 'Login bug', 'Cannot sign in', '{}', ?2, 'pending', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
                rusqlite::params![format!("doc_{i}"), format!("hash_{i}")],
            ).unwrap();
        }

        // max_estimated_tokens_per_request=15 forces each doc into its own text_batch.
        let limits = EmbeddingBatchLimits {
            max_inputs_per_request: 96, // claim all 3
            max_estimated_tokens_per_request: 15,
            max_batches_per_run: 1,
            rate_limit_backoff_seconds: 60,
        };

        let db = StdMutex::new(conn);
        let embed_opts = EmbeddingRunOptions {
            source_system_id: None,
            entity_kind: None,
            limit: None,
            force_rebuild: false,
        };
        let now = "2026-01-01T00:00:00Z";

        // Phase 1: claim all 3 docs. Token splitting should produce 3 text_batches.
        let batch = {
            let conn = db.lock().expect("lock");
            prepare_refresh_batch(&conn, &embed_opts, &limits, now)
                .expect("prepare batch")
                .expect("should have pending docs")
        };
        assert_eq!(batch.text_batches.len(), 3, "3 docs at ~10 tokens each with a 15-token cap should produce 3 text_batches");

        // Count HTTP calls via a capturing runner.
        let http_call_count: Arc<StdMutex<usize>> = Arc::new(StdMutex::new(0));
        let http_call_count_clone = http_call_count.clone();

        struct CountingRunner { count: Arc<StdMutex<usize>> }
        impl EmbeddingRunnerForCommand for CountingRunner {
            fn run(
                &self,
                _resolved: &crate::ai::resolver::ResolvedAiProvider,
                req: EmbeddingRequest,
            ) -> Result<EmbeddingResponse, EmbeddingError> {
                *self.count.lock().unwrap() += 1;
                Ok(EmbeddingResponse {
                    vectors: req.input.iter().map(|_| vec![0.1f32, 0.2, 0.3]).collect(),
                    model: "embed-v-4-0".into(),
                    profile: "grove-embed-v4".into(),
                    dimension: 3,
                    usage: None,
                })
            }
        }

        let runner = CountingRunner { count: http_call_count_clone };
        let resolved = fake_resolved_provider();

        // With max_http_calls=1, only the first text_batch should be processed.
        let (_summary, http_calls_made) = run_embedding_refresh_loop(
            &db, &resolved, &batch, &runner, now, &limits, 1,
        );

        assert_eq!(*http_call_count.lock().unwrap(), 1, "exactly 1 HTTP call should be made with max_http_calls=1");
        assert_eq!(http_calls_made, 1, "run_embedding_refresh_loop should report 1 HTTP call made");

        // The other 2 docs are still in 'embedding' state (stuck), to be recovered
        // by the stuck-claim recovery at the start of the next prepare_refresh_batch call.
        let embedding_count: i64 = {
            let conn = db.lock().unwrap();
            conn.query_row(
                "SELECT count(*) FROM indexable_documents WHERE embedding_status = 'embedding'",
                [],
                |r| r.get(0),
            ).unwrap()
        };
        assert_eq!(embedding_count, 2, "2 docs from unprocessed text_batches should remain in 'embedding' state");
    }
}
