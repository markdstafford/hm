use rusqlite::Connection;
use serde_json::Value;
use crate::settings::{error::SettingsError, keys};

pub fn shared_settings_set(conn: &Connection, key: &str, value: &Value) -> Result<(), SettingsError> {
    keys::validate_key(key)?;
    let value_json = value.to_string();
    conn.execute(
        "INSERT INTO shared_settings (key, value_json, updated_at)
         VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET
             value_json = excluded.value_json,
             updated_at = datetime('now')",
        rusqlite::params![key, value_json],
    )
    .map_err(|e| SettingsError::Database(e.to_string()))?;
    Ok(())
}

pub fn shared_settings_get(conn: &Connection, key: &str) -> Result<Option<Value>, SettingsError> {
    keys::validate_key(key)?;
    let mut stmt = conn
        .prepare("SELECT value_json FROM shared_settings WHERE key = ?1")
        .map_err(|e| SettingsError::Database(e.to_string()))?;
    let result = stmt.query_row(rusqlite::params![key], |row| {
        row.get::<_, String>(0)
    });
    match result {
        Ok(json_str) => {
            let value: Value = serde_json::from_str(&json_str)
                .map_err(|e| SettingsError::Serialization(e.to_string()))?;
            Ok(Some(value))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(SettingsError::Database(e.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    #[test]
    fn set_then_get_returns_value() {
        let conn = open_in_memory().unwrap();
        let v = serde_json::json!({"endpoint": "https://api.example.com"});
        shared_settings_set(&conn, "ai.config", &v).unwrap();
        let result = shared_settings_get(&conn, "ai.config").unwrap();
        assert_eq!(result, Some(v));
    }

    #[test]
    fn get_missing_key_returns_none() {
        let conn = open_in_memory().unwrap();
        let result = shared_settings_get(&conn, "nonexistent").unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn overwrite_updates_value() {
        let conn = open_in_memory().unwrap();
        shared_settings_set(&conn, "k", &serde_json::json!("first")).unwrap();
        shared_settings_set(&conn, "k", &serde_json::json!("second")).unwrap();
        let result = shared_settings_get(&conn, "k").unwrap();
        assert_eq!(result, Some(serde_json::json!("second")));
    }

    #[test]
    fn preserves_json_type_fidelity() {
        let conn = open_in_memory().unwrap();
        let cases: Vec<(&str, Value)> = vec![
            ("obj", serde_json::json!({"a": 1})),
            ("arr", serde_json::json!([1, 2, 3])),
            ("str", serde_json::json!("hello")),
            ("num", serde_json::json!(42)),
            ("float", serde_json::json!(2.5)),
            ("bool", serde_json::json!(true)),
            ("null-val", serde_json::json!(null)),
        ];
        for (key, val) in &cases {
            shared_settings_set(&conn, key, val).unwrap();
            let result = shared_settings_get(&conn, key).unwrap();
            assert_eq!(result.as_ref(), Some(val), "type fidelity failed for key {key}");
        }
    }

    #[test]
    fn set_rejects_invalid_key() {
        let conn = open_in_memory().unwrap();
        let result = shared_settings_set(&conn, "bad key!", &serde_json::json!("v"));
        assert!(result.is_err(), "invalid key should be rejected by set");
        let result = shared_settings_set(&conn, "", &serde_json::json!("v"));
        assert!(result.is_err(), "empty key should be rejected by set");
    }

    #[test]
    fn get_rejects_invalid_key() {
        let conn = open_in_memory().unwrap();
        let result = shared_settings_get(&conn, "has/slash");
        assert!(result.is_err(), "invalid key should be rejected by get");
    }

    #[test]
    fn overwrite_refreshes_updated_at() {
        let conn = open_in_memory().unwrap();
        shared_settings_set(&conn, "ts-key", &serde_json::json!("v1")).unwrap();
        let t1: String = conn
            .query_row(
                "SELECT updated_at FROM shared_settings WHERE key = 'ts-key'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        std::thread::sleep(std::time::Duration::from_secs(1));
        shared_settings_set(&conn, "ts-key", &serde_json::json!("v2")).unwrap();
        let t2: String = conn
            .query_row(
                "SELECT updated_at FROM shared_settings WHERE key = 'ts-key'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert!(t2 > t1, "updated_at should advance on overwrite");
    }
}
