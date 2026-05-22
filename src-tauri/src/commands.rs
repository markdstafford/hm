use serde::{Deserialize, Serialize};
use specta::Type;

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
