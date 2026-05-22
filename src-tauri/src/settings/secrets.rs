use std::collections::HashMap;
use std::sync::Mutex;
use crate::settings::error::SettingsError;

pub trait SecretStore: Send + Sync {
    fn set(&self, key: &str, value: &str) -> Result<(), SettingsError>;
    fn get(&self, key: &str) -> Result<Option<String>, SettingsError>;
    fn delete(&self, key: &str) -> Result<(), SettingsError>;
}

/// In-memory secret store for tests and CI. Never touches the OS keychain.
pub struct InMemorySecretStore {
    store: Mutex<HashMap<String, String>>,
}

impl InMemorySecretStore {
    pub fn new() -> Self {
        InMemorySecretStore {
            store: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for InMemorySecretStore {
    fn default() -> Self {
        Self::new()
    }
}

impl SecretStore for InMemorySecretStore {
    fn set(&self, key: &str, value: &str) -> Result<(), SettingsError> {
        self.store
            .lock()
            .unwrap()
            .insert(key.to_string(), value.to_string());
        Ok(())
    }

    fn get(&self, key: &str) -> Result<Option<String>, SettingsError> {
        Ok(self.store.lock().unwrap().get(key).cloned())
    }

    fn delete(&self, key: &str) -> Result<(), SettingsError> {
        self.store.lock().unwrap().remove(key);
        Ok(())
    }
}

/// Newtype wrapper so `Arc<dyn SecretStore + Send + Sync>` can be used as Tauri managed state.
pub struct ManagedSecretStore(pub std::sync::Arc<dyn SecretStore + Send + Sync>);

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> InMemorySecretStore {
        InMemorySecretStore::new()
    }

    #[test]
    fn set_then_get_returns_value() {
        let s = store();
        s.set("mykey", "myvalue").unwrap();
        assert_eq!(s.get("mykey").unwrap(), Some("myvalue".to_string()));
    }

    #[test]
    fn get_missing_key_returns_none() {
        let s = store();
        assert_eq!(s.get("nonexistent").unwrap(), None);
    }

    #[test]
    fn delete_removes_key() {
        let s = store();
        s.set("mykey", "myvalue").unwrap();
        s.delete("mykey").unwrap();
        assert_eq!(s.get("mykey").unwrap(), None);
    }

    #[test]
    fn delete_missing_key_is_safe_noop() {
        let s = store();
        assert!(s.delete("nonexistent").is_ok());
    }

    #[test]
    fn overwrite_key_returns_new_value() {
        let s = store();
        s.set("mykey", "first").unwrap();
        s.set("mykey", "second").unwrap();
        assert_eq!(s.get("mykey").unwrap(), Some("second".to_string()));
    }
}
