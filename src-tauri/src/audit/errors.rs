use std::fmt;

#[derive(Clone, PartialEq, Eq)]
pub enum AuditError {
    InvalidInput(&'static str),
    Database,
    NotFound,
}

impl fmt::Display for AuditError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AuditError::InvalidInput(message) => write!(f, "invalid audit input: {message}"),
            AuditError::Database => f.write_str("audit log database operation failed"),
            AuditError::NotFound => f.write_str("audit log entry not found"),
        }
    }
}

impl fmt::Debug for AuditError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AuditError::InvalidInput(message) => {
                f.debug_tuple("InvalidInput").field(message).finish()
            }
            AuditError::Database => f.write_str("Database"),
            AuditError::NotFound => f.write_str("NotFound"),
        }
    }
}

impl std::error::Error for AuditError {}
