pub mod ai;
pub mod commands;
pub mod db;
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
                ]);
                builder
                    .export(specta_typescript::Typescript::default(), out_path)
                    .expect("failed to export TypeScript bindings");
            })
            .expect("failed to spawn binding generation thread");
        handle.join().expect("binding generation thread panicked");
    }
}
