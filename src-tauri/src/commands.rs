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
            if let Err(err) = service.ingest_project(
                &db_access,
                &source_system_id_for_worker,
                project_key,
                project_name,
                &now,
                &cancellation_for_worker,
            ) {
                eprintln!(
                    "ingestion worker: project {project_key} failed: {err}"
                );
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
        _assert_specta::<CollectionViewRecord>();
        _assert_specta::<CollectionViewSaveInput>();
        _assert_specta::<CollectionViewSeedInput>();
        _assert_specta::<JiraIssueStatusTransition>();
        _assert_specta::<crate::issues::history::IssueSnapshotQuery>();
        _assert_specta::<crate::issues::history::IssueSnapshotListItem>();
        _assert_specta::<crate::issues::history::IssueHistoryRetentionConfig>();
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
        upsert_source_system, upsert_work_item, upsert_work_item_term, SourceSystemInput,
        WorkItemInput, WorkItemTermInput,
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
}
