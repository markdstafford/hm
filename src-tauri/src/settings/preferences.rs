use crate::settings::error::SettingsError;
use serde_json::Value;
use std::path::{Path, PathBuf};

pub fn preferences_path() -> Result<PathBuf, SettingsError> {
    let project_dirs = directories::ProjectDirs::from("", "", "hm").ok_or_else(|| {
        SettingsError::PathResolution("could not determine config directory".into())
    })?;
    Ok(project_dirs.config_dir().join("preferences.toml"))
}

/// Returns the production database path: ~/Library/Application Support/hm/hm.db on macOS.
pub fn db_path() -> Result<PathBuf, SettingsError> {
    let project_dirs = directories::ProjectDirs::from("", "", "hm").ok_or_else(|| {
        SettingsError::PathResolution("could not determine data directory".into())
    })?;
    Ok(project_dirs.data_dir().join("hm.db"))
}

pub fn read_preferences_at(path: &Path) -> Result<Value, SettingsError> {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Ok(Value::Object(serde_json::Map::new()));
        }
        Err(e) => return Err(SettingsError::from(e)),
    };
    let value: Value =
        toml::from_str(&content).map_err(|e| SettingsError::Serialization(e.to_string()))?;
    if !value.is_object() {
        return Err(SettingsError::InvalidPayload(
            "preferences file top-level must be a TOML table".into(),
        ));
    }
    Ok(value)
}

pub fn write_preferences_at(path: &Path, prefs: &Value) -> Result<(), SettingsError> {
    if !prefs.is_object() {
        return Err(SettingsError::InvalidPayload(
            "preferences value must be an object".into(),
        ));
    }
    let toml_str =
        toml::to_string_pretty(prefs).map_err(|e| SettingsError::Serialization(e.to_string()))?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp_path = path.with_extension("toml.tmp");
    std::fs::write(&tmp_path, &toml_str)?;
    if let Err(e) = std::fs::rename(&tmp_path, path) {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(SettingsError::from(e));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn tmp_prefs_path(dir: &TempDir) -> PathBuf {
        dir.path().join("preferences.toml")
    }

    #[test]
    fn read_returns_empty_object_when_file_missing() {
        let dir = TempDir::new().unwrap();
        let path = tmp_prefs_path(&dir);
        let result = read_preferences_at(&path).unwrap();
        assert_eq!(result, Value::Object(serde_json::Map::new()));
    }

    #[test]
    fn write_then_read_round_trips_object() {
        let dir = TempDir::new().unwrap();
        let path = tmp_prefs_path(&dir);
        let prefs = serde_json::json!({"theme": "dark", "fontSize": 14, "showSidebar": true});
        write_preferences_at(&path, &prefs).unwrap();
        let result = read_preferences_at(&path).unwrap();
        assert_eq!(result["theme"], "dark");
        assert_eq!(result["fontSize"], 14);
        assert_eq!(result["showSidebar"], true);
    }

    #[test]
    fn write_creates_parent_directory() {
        let dir = TempDir::new().unwrap();
        let nested = dir.path().join("a").join("b").join("preferences.toml");
        let prefs = serde_json::json!({"key": "value"});
        write_preferences_at(&nested, &prefs).unwrap();
        assert!(nested.exists());
    }

    #[test]
    fn write_rejects_non_object_payload() {
        let dir = TempDir::new().unwrap();
        let path = tmp_prefs_path(&dir);
        let result = write_preferences_at(&path, &Value::String("bad".into()));
        assert!(result.is_err());
        assert!(!path.exists());
    }
}
