use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::Mutex;

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
    set_source_credential_secret, delete_source_credential, SourceCredentialKind,
};
use crate::ai::service::{smoke_test_profile_with_config, SmokeTestResult};

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
    }
};
