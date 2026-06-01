use crate::settings::{error::SettingsError, keys};
use std::collections::HashMap;
use std::sync::Mutex;

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
        keys::validate_key(key)?;
        self.store
            .lock()
            .unwrap()
            .insert(key.to_string(), value.to_string());
        Ok(())
    }

    fn get(&self, key: &str) -> Result<Option<String>, SettingsError> {
        keys::validate_key(key)?;
        Ok(self.store.lock().unwrap().get(key).cloned())
    }

    fn delete(&self, key: &str) -> Result<(), SettingsError> {
        keys::validate_key(key)?;
        self.store.lock().unwrap().remove(key);
        Ok(())
    }
}

/// Newtype wrapper so `Arc<dyn SecretStore + Send + Sync>` can be used as Tauri managed state.
pub struct ManagedSecretStore(pub std::sync::Arc<dyn SecretStore + Send + Sync>);

/// Production keychain-backed secret store.
/// Uses service namespace "hm" (documented in context-agent/wiki/code-map.md).
pub struct KeychainSecretStore {
    service: String,
}

impl KeychainSecretStore {
    pub fn new(service: impl Into<String>) -> Self {
        KeychainSecretStore {
            service: service.into(),
        }
    }
}

impl SecretStore for KeychainSecretStore {
    fn set(&self, key: &str, value: &str) -> Result<(), SettingsError> {
        keys::validate_key(key)?;
        let entry = keyring::Entry::new(&self.service, key)
            .map_err(|_| SettingsError::Keychain("failed to access keychain".into()))?;
        entry
            .set_password(value)
            .map_err(|_| SettingsError::Keychain("failed to write secret".into()))
    }

    fn get(&self, key: &str) -> Result<Option<String>, SettingsError> {
        keys::validate_key(key)?;
        let entry = keyring::Entry::new(&self.service, key)
            .map_err(|_| SettingsError::Keychain("failed to access keychain".into()))?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(SettingsError::Keychain("failed to read secret".into())),
        }
    }

    fn delete(&self, key: &str) -> Result<(), SettingsError> {
        keys::validate_key(key)?;
        let entry = keyring::Entry::new(&self.service, key)
            .map_err(|_| SettingsError::Keychain("failed to access keychain".into()))?;
        match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(SettingsError::Keychain("failed to delete secret".into())),
        }
    }
}

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
    fn set_rejects_invalid_key() {
        let s = store();
        assert!(
            s.set("bad key!", "v").is_err(),
            "space in key should be rejected"
        );
        assert!(s.set("", "v").is_err(), "empty key should be rejected");
        assert!(
            s.set("path/sep", "v").is_err(),
            "slash in key should be rejected"
        );
    }

    #[test]
    fn get_rejects_invalid_key() {
        let s = store();
        assert!(
            s.get("bad key!").is_err(),
            "invalid key should be rejected by get"
        );
    }

    #[test]
    fn delete_rejects_invalid_key() {
        let s = store();
        assert!(
            s.delete("bad\nkey").is_err(),
            "control char in key should be rejected by delete"
        );
    }

    #[test]
    fn overwrite_key_returns_new_value() {
        let s = store();
        s.set("mykey", "first").unwrap();
        s.set("mykey", "second").unwrap();
        assert_eq!(s.get("mykey").unwrap(), Some("second".to_string()));
    }

    #[test]
    #[ignore = "requires real OS keychain — run manually with: cargo test -- --ignored keychain_smoke_set_get_delete"]
    fn keychain_smoke_set_get_delete() {
        let s = KeychainSecretStore::new("hm-test");
        s.set("smoke-test-key", "smoke-test-value").unwrap();
        let val = s.get("smoke-test-key").unwrap();
        assert_eq!(val, Some("smoke-test-value".to_string()));
        s.delete("smoke-test-key").unwrap();
        assert_eq!(s.get("smoke-test-key").unwrap(), None);
    }
}
