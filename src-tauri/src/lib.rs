pub mod ai;
pub mod audit;
pub mod collections;
pub mod mutations;
pub mod commands;
pub mod db;
pub mod ingestion;
pub mod issues;
pub mod settings;
pub mod sources;

/// Run `replay_missing_snapshots` for every configured Jira project at startup.
///
/// This fills any snapshot dates that were missed while hm was closed —
/// before the user runs a manual sync.  Errors are logged and ignored;
/// the function must never prevent the app from starting.
fn startup_replay_missing_snapshots(conn: &rusqlite::Connection) {
    use sources::config::{load_sources_config, SourceConfig};
    use sources::jira_ingestion::now_utc_rfc3339;

    let now = now_utc_rfc3339();
    // Take the leading 10 characters (YYYY-MM-DD) as today's UTC date.
    let today = match now.get(..10) {
        Some(d) => d.to_string(),
        None => return,
    };

    let cfg = match load_sources_config(conn) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[startup] could not load sources config for snapshot replay: {e}");
            return;
        }
    };

    for source in &cfg.sources {
        let SourceConfig::Jira(jira) = source;
        for project in &jira.projects {
            match issues::snapshots::replay_missing_snapshots(
                conn,
                &jira.id,
                &project.key,
                &today,
                &now,
            ) {
                Ok(result) if result.snapshots_written > 0 => {
                    eprintln!(
                        "[startup] replayed {} snapshot(s) for {} / {}",
                        result.snapshots_written, jira.name, project.key
                    );
                }
                Ok(_) => {}
                Err(e) => {
                    eprintln!(
                        "[startup] snapshot replay failed for {}/{}: {e}",
                        jira.name, project.key
                    );
                }
            }
        }
    }
}

use std::sync::{Arc, Mutex};
use tauri::Manager;
use tauri_specta::{collect_commands, Builder};

use settings::preferences::db_path;
use settings::secrets::{KeychainSecretStore, ManagedSecretStore};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::app_status,
        commands::preferences_read,
        commands::preferences_write,
        commands::secret_set,
        commands::secret_get,
        commands::secret_delete,
        commands::shared_settings_get,
        commands::shared_settings_set,
        commands::ai_provider_config_get,
        commands::ai_provider_config_save,
        commands::ai_credential_secret_set,
        commands::ai_credential_secret_delete,
        commands::ai_profile_smoke_test,
        commands::source_config_get,
        commands::source_config_save,
        commands::source_credential_secret_set,
        commands::source_credential_delete,
        commands::source_config_remove,
        commands::jira_source_reset_project_data,
        commands::jira_source_test_connection,
        commands::jira_issue_ingestion_run,
        commands::jira_issue_ingestion_cancel,
        commands::jira_issue_ingestion_status,
        commands::jira_issue_ingestion_progress,
        commands::jira_issues_list,
        commands::collection_views_list,
        commands::collection_view_save,
        commands::collection_view_delete,
        commands::collection_views_seed_defaults,
        commands::jira_issue_status_timeline,
        commands::issue_snapshots_query,
        commands::issue_history_retention_get,
        commands::issue_history_retention_save,
        audit::commands::audit_log_list,
        audit::commands::audit_log_mark_reverted,
        mutations::jira_update_title::jira_update_title,
        mutations::jira_update_title::jira_update_title_reverse,
        mutations::jira_update_labels::jira_update_labels,
        mutations::jira_update_labels::jira_update_labels_reverse,
        mutations::jira_reassign::jira_reassign,
        mutations::jira_reassign::jira_reassign_reverse,
        mutations::jira_close_issue::jira_close_issue,
        mutations::jira_close_issue::jira_close_issue_reverse,
        mutations::jira_link_as_duplicate::jira_link_as_duplicate,
        mutations::jira_link_as_duplicate::jira_link_as_duplicate_reverse,
        mutations::jira_add_comment::jira_add_comment,
    ]);

    #[cfg(debug_assertions)]
    builder
        .export(
            specta_typescript::Typescript::default(),
            "../src/bindings.ts",
        )
        .expect("failed to generate TypeScript bindings");

    tauri::Builder::default()
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);

            // Production SQLite database: ~/Library/Application Support/hm/hm.db on macOS
            let path = db_path().expect("failed to resolve database path");
            std::fs::create_dir_all(path.parent().expect("db path has no parent"))
                .expect("failed to create data dir");
            let conn = db::open_at(&path).expect("failed to open database");

            // Best-effort startup snapshot replay: fills any days that were missed
            // while hm was closed, before the first manual sync of the session.
            startup_replay_missing_snapshots(&conn);

            app.manage(Mutex::new(conn));

            // Production keychain secret store (service namespace "hm")
            app.manage(ManagedSecretStore(Arc::new(KeychainSecretStore::new("hm"))));

            // In-memory map of active Jira ingestion cancellation flags.
            app.manage(commands::ActiveIngestionRuns::default());

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use tauri_specta::{collect_commands, Builder};

    /// Generates src/bindings.ts from the full command list.
    /// Run with: cargo test generate_typescript_bindings
    /// Headless alternative to launching `npm run tauri dev`.
    ///
    /// Spawns a thread with an enlarged stack (16 MiB) because specta's type
    /// traversal of `serde_json::Value` — a self-referential enum — is deeply
    /// recursive and overflows the default 8 MiB test-thread stack.
    #[test]
    fn generate_typescript_bindings() {
        use crate::commands;
        let out_path = concat!(env!("CARGO_MANIFEST_DIR"), "/../src/bindings.ts");
        let handle = std::thread::Builder::new()
            .stack_size(32 * 1024 * 1024) // 32 MiB
            .spawn(move || {
                let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
                    commands::app_status,
                    commands::preferences_read,
                    commands::preferences_write,
                    commands::secret_set,
                    commands::secret_get,
                    commands::secret_delete,
                    commands::shared_settings_get,
                    commands::shared_settings_set,
                    commands::ai_provider_config_get,
                    commands::ai_provider_config_save,
                    commands::ai_credential_secret_set,
                    commands::ai_credential_secret_delete,
                    commands::ai_profile_smoke_test,
                    commands::source_config_get,
                    commands::source_config_save,
                    commands::source_credential_secret_set,
                    commands::source_credential_delete,
                    commands::source_config_remove,
                    commands::jira_source_reset_project_data,
                    commands::jira_source_test_connection,
                    commands::jira_issue_ingestion_run,
                    commands::jira_issue_ingestion_cancel,
                    commands::jira_issue_ingestion_status,
                    commands::jira_issue_ingestion_progress,
                    commands::jira_issues_list,
                    commands::collection_views_list,
                    commands::collection_view_save,
                    commands::collection_view_delete,
                    commands::collection_views_seed_defaults,
                    commands::jira_issue_status_timeline,
                    commands::issue_snapshots_query,
                    commands::issue_history_retention_get,
                    commands::issue_history_retention_save,
                    crate::audit::commands::audit_log_list,
                    crate::audit::commands::audit_log_mark_reverted,
                    crate::mutations::jira_update_title::jira_update_title,
                    crate::mutations::jira_update_title::jira_update_title_reverse,
                    crate::mutations::jira_update_labels::jira_update_labels,
                    crate::mutations::jira_update_labels::jira_update_labels_reverse,
                    crate::mutations::jira_reassign::jira_reassign,
                    crate::mutations::jira_reassign::jira_reassign_reverse,
                    crate::mutations::jira_close_issue::jira_close_issue,
                    crate::mutations::jira_close_issue::jira_close_issue_reverse,
                    crate::mutations::jira_link_as_duplicate::jira_link_as_duplicate,
                    crate::mutations::jira_link_as_duplicate::jira_link_as_duplicate_reverse,
                    crate::mutations::jira_add_comment::jira_add_comment,
                ]);
                builder
                    .export(specta_typescript::Typescript::default(), out_path)
                    .expect("failed to export TypeScript bindings");
            })
            .expect("failed to spawn binding generation thread");
        handle.join().expect("binding generation thread panicked");
    }
}
