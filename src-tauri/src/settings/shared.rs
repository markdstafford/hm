use rusqlite::Connection;
use serde_json::Value;
use crate::settings::error::SettingsError;

pub fn shared_settings_set(_conn: &Connection, _key: &str, _value: &Value) -> Result<(), SettingsError> {
    Ok(())
}

pub fn shared_settings_get(_conn: &Connection, _key: &str) -> Result<Option<Value>, SettingsError> {
    Ok(None)
}
