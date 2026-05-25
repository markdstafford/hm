//! Connection-access trait for ingestion services.
//!
//! Ingestion services must release the SQLite mutex between HTTP fetches so
//! status / cancel commands can read progress mid-run. To enable that without
//! threading a raw `Mutex<Connection>` through every service, services call
//! short-lived closures via a [`DbAccess`] trait. Each invocation locks the
//! mutex, runs the closure, and drops the guard before any further HTTP
//! work.
//!
//! Two implementations are provided:
//!
//! - [`MutexDbAccess`] — the production wiring used by the Tauri command. It
//!   wraps the `Mutex<Connection>` that lives in `tauri::State`.
//! - In tests, code typically constructs a fresh in-memory `Connection`,
//!   wraps it in a `std::sync::Mutex`, and passes a `MutexDbAccess` so the
//!   same locking discipline is exercised under test.

use crate::ingestion::errors::{IngestionError, IngestionErrorCategory};

/// Short-lived borrow of a SQLite connection. The closure runs while the
/// underlying lock is held; the lock is released as soon as it returns.
pub trait DbAccess {
    fn with_conn<F, R>(&self, f: F) -> Result<R, IngestionError>
    where
        F: FnOnce(&rusqlite::Connection) -> Result<R, IngestionError>;
}

/// Production wiring around a `Mutex<Connection>`.
pub struct MutexDbAccess<'a>(pub &'a std::sync::Mutex<rusqlite::Connection>);

impl<'a> DbAccess for MutexDbAccess<'a> {
    fn with_conn<F, R>(&self, f: F) -> Result<R, IngestionError>
    where
        F: FnOnce(&rusqlite::Connection) -> Result<R, IngestionError>,
    {
        let guard = self
            .0
            .lock()
            .map_err(|_| IngestionError::new(IngestionErrorCategory::Storage, ""))?;
        f(&guard)
    }
}
