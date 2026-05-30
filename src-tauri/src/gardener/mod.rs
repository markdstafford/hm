pub mod commands;
pub mod contract;
pub mod engine;
pub mod errors;
pub mod reference;
pub mod repository;
pub mod runner;
pub mod schema;
pub mod settings;

/// Return the default set of gardener engines registered for this build.
pub fn default_engines() -> Vec<std::sync::Arc<dyn engine::GardenerEngine>> {
    vec![std::sync::Arc::new(reference::ReferenceEngine)]
}

/// Best-effort gardener scheduled run triggered after a successful project
/// ingestion.  A gardener failure must NOT roll back ingestion success;
/// callers should log the returned status but must not treat it as fatal.
///
/// Known limitation (INIT-5): the caller holds the SQLite connection across the
/// entire run, including engine compute.  The v1 reference engine is cheap and
/// local so this is safe for now.  A future provider-backed engine must
/// refactor this seam to release the connection during compute work.
pub(crate) fn run_gardener_after_successful_project_ingestion(
    conn: &rusqlite::Connection,
    runtime: &runner::GardenerRuntime,
    source_system_id: &str,
    project_key: &str,
    now: &str,
) -> runner::GardenerRunSummary {
    let engines = default_engines();
    let input = runner::ScheduledRunInput {
        source_id: Some(source_system_id.to_string()),
        project_key: Some(project_key.to_string()),
        cursor_kind: "updated_at".to_string(),
        cursor_value: now.to_string(),
        now: now.to_string(),
    };
    runner::run_scheduled(conn, runtime, &engines, input)
}
