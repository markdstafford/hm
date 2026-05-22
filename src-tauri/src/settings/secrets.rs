use std::sync::Arc;
use crate::settings::error::SettingsError;

pub trait SecretStore: Send + Sync {
    fn set(&self, key: &str, value: &str) -> Result<(), SettingsError>;
    fn get(&self, key: &str) -> Result<Option<String>, SettingsError>;
    fn delete(&self, key: &str) -> Result<(), SettingsError>;
}

pub struct ManagedSecretStore(pub Arc<dyn SecretStore + Send + Sync>);
