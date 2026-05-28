use std::fmt;

#[derive(Clone, PartialEq, Eq)]
pub enum MutationError {
    InvalidInput(String),
    SourceNotFound(String),
    CredentialMissing(String),
    Jira(String),
    AuditWriteFailedAfterRemoteMutation,
    ReverseUnsupported(String),
    Audit(String),
}

impl fmt::Display for MutationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MutationError::InvalidInput(msg) => write!(f, "invalid mutation input: {msg}"),
            MutationError::SourceNotFound(id) => write!(f, "source not found: {id}"),
            MutationError::CredentialMissing(id) => write!(f, "credential missing for source: {id}"),
            MutationError::Jira(_) => f.write_str("Jira mutation failed"),
            MutationError::AuditWriteFailedAfterRemoteMutation => {
                f.write_str("Jira mutation may have succeeded, but local audit persistence failed")
            }
            MutationError::ReverseUnsupported(reason) => {
                write!(f, "reverse mutation is unsupported: {reason}")
            }
            MutationError::Audit(msg) => write!(f, "audit operation failed: {msg}"),
        }
    }
}

impl fmt::Debug for MutationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MutationError::InvalidInput(msg) => f.debug_tuple("InvalidInput").field(msg).finish(),
            MutationError::SourceNotFound(id) => f.debug_tuple("SourceNotFound").field(id).finish(),
            MutationError::CredentialMissing(id) => f.debug_tuple("CredentialMissing").field(id).finish(),
            MutationError::Jira(_) => write!(f, "Jira([redacted])"),
            MutationError::AuditWriteFailedAfterRemoteMutation => {
                write!(f, "AuditWriteFailedAfterRemoteMutation")
            }
            MutationError::ReverseUnsupported(reason) => {
                f.debug_tuple("ReverseUnsupported").field(reason).finish()
            }
            MutationError::Audit(msg) => f.debug_tuple("Audit").field(msg).finish(),
        }
    }
}

impl std::error::Error for MutationError {}
