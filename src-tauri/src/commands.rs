use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::Mutex;
use tauri::Manager;

use crate::settings::{keys, preferences, secrets::ManagedSecretStore, shared};

// `serde_json::Value` implements `specta::Type` via the `serde_json` feature, but
// that impl is infinitely recursive at binding-generation time (specta rc.25 bug).
// `JsonValue` is a transparent newtype that serialises/deserialises identically to
// `serde_json::Value` but emits TypeScript `unknown` using `specta_typescript::define`.
#[derive(Debug, Clone, Serialize, Deserialize)]
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
pub fn preferences_read(app: tauri::AppHandle) -> Result<JsonValue, String> {
    let path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("failed to resolve config dir: {e}"))?
        .join("preferences.toml");
    preferences::read_preferences_at(&path)
        .map(JsonValue)
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn preferences_write(app: tauri::AppHandle, prefs: JsonValue) -> Result<(), String> {
    let path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("failed to resolve config dir: {e}"))?
        .join("preferences.toml");
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
