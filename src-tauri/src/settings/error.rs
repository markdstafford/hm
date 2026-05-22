#[derive(Debug)]
pub enum SettingsError {
    InvalidKey(String),
    InvalidPayload(String),
    PathResolution(String),
    Io(std::io::Error),
    Serialization(String),
    Keychain(String),
    Database(String),
}

impl std::fmt::Display for SettingsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SettingsError::InvalidKey(msg) => write!(f, "invalid key: {msg}"),
            SettingsError::InvalidPayload(msg) => write!(f, "invalid payload: {msg}"),
            SettingsError::PathResolution(msg) => write!(f, "failed to resolve path: {msg}"),
            SettingsError::Io(e) => write!(f, "IO error: {e}"),
            SettingsError::Serialization(msg) => write!(f, "serialization error: {msg}"),
            SettingsError::Keychain(_) => write!(f, "keychain error"),
            SettingsError::Database(_) => write!(f, "database error"),
        }
    }
}

impl std::error::Error for SettingsError {}

impl From<std::io::Error> for SettingsError {
    fn from(e: std::io::Error) -> Self {
        SettingsError::Io(e)
    }
}
