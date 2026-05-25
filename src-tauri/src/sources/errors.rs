/// Secret-shaped keywords used for redaction.
/// Kept in one place so `errors.rs` and `config.rs` share the same list.
///
/// Short exact-match words (e.g. "pat", "token") must not be checked as
/// substrings because they appear in common identifiers ("template", "pattern").
/// The list is applied as: key_lower == word OR key_lower contains word (for
/// multi-word patterns like "bearer " with a trailing space).
const SECRET_KEYWORDS: &[&str] = &[
    "token",
    "secret",
    "password",
    "authorization",
    "bearer ",
    "cookie",
    "api_key",
    "api-key",
];

/// Short words that must match the full key name (not as a substring).
const SECRET_EXACT_WORDS: &[&str] = &["pat"];

/// Check whether a lowercased string appears to contain a raw credential.
///
/// Returns `true` for messages / keys containing a known secret pattern.
pub(crate) fn is_secret_shaped(lower: &str) -> bool {
    SECRET_EXACT_WORDS.contains(&lower)
        || SECRET_KEYWORDS.iter().any(|needle| lower.contains(needle))
}

/// Redact a message that may contain raw secret values.
///
/// Returns `[redacted]` when the message contains patterns that suggest a raw
/// credential value is embedded. All error variants use this so no caller has to
/// decide whether its message is safe.
pub(crate) fn redact(input: &str) -> String {
    if is_secret_shaped(&input.to_ascii_lowercase()) {
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
            // Config validation messages describe structural problems (field names,
            // format rules). Redact anyway to match the AI error pattern and guard
            // against future callers that might include user-supplied input.
            SourceError::InvalidConfig(msg) => {
                write!(f, "invalid source config: {}", redact(msg))
            }
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
