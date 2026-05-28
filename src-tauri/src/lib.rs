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
