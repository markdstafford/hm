/// Redact messages that appear to contain raw secret values.
///
/// Returns `[redacted]` when the message contains patterns that suggest a raw
/// credential value is embedded (e.g. `bearer <token>`, `authorization: <value>`).
/// Validation errors that merely *name* secret-shaped fields are not redacted so
/// that the field path remains useful in error output.
fn redact(input: &str) -> String {
    let lower = input.to_ascii_lowercase();
    if ["pat", "token", "secret", "authorization", "password", "bearer ", "cookie"]
        .iter()
        .any(|needle| lower.contains(needle))
    {
        "[redacted]".into()
    } else {
        input.into()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SourceError {
    InvalidConfig(String),
    MissingCredential(String),
    Storage(String),
    Credential(String),
    Connection(String),
}

impl std::fmt::Display for SourceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            // Config validation errors describe structural problems; the message itself
            // must not contain raw secret values, so no redaction pass is needed here.
            SourceError::InvalidConfig(msg) => write!(f, "invalid source config: {msg}"),
            // Runtime errors may carry credential info obtained from the OS or network;
            // always redact those before rendering.
            SourceError::MissingCredential(msg) => {
                write!(f, "missing credential: {}", redact(msg))
            }
            SourceError::Storage(msg) => write!(f, "source storage error: {}", redact(msg)),
            SourceError::Credential(msg) => write!(f, "credential error: {}", redact(msg)),
            SourceError::Connection(msg) => write!(f, "connection error: {}", redact(msg)),
        }
    }
}

impl std::error::Error for SourceError {}
