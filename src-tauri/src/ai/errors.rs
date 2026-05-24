#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AiError {
    InvalidConfig(String),
    MissingRoute { task_name: String },
    MissingProfile { profile_name: String },
    MissingEndpoint { endpoint_name: String },
    MissingCredential { credential_name: String },
    MissingSecret { credential_name: String, source: &'static str },
    UnsupportedRunner(String),
    Provider(String),
    Timeout,
    Storage(String),
}

impl std::fmt::Display for AiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AiError::InvalidConfig(msg) => write!(f, "invalid AI provider config: {}", redact(msg)),
            AiError::MissingRoute { task_name } => write!(f, "No AI profile is routed for {task_name}."),
            AiError::MissingProfile { profile_name } => write!(f, "AI profile not found: {profile_name}"),
            AiError::MissingEndpoint { endpoint_name } => write!(f, "AI endpoint not found: {endpoint_name}"),
            AiError::MissingCredential { credential_name } => write!(f, "AI credential not found: {credential_name}"),
            AiError::MissingSecret { credential_name, source } => write!(f, "AI credential secret is missing for {credential_name} ({source})."),
            AiError::UnsupportedRunner(msg) => write!(f, "unsupported AI runner: {}", redact(msg)),
            AiError::Provider(msg) => write!(f, "AI provider error: {}", redact(msg)),
            AiError::Timeout => write!(f, "AI provider request timed out"),
            AiError::Storage(msg) => write!(f, "AI provider storage error: {}", redact(msg)),
        }
    }
}

impl std::error::Error for AiError {}

pub(crate) fn redact(input: &str) -> String {
    let lower = input.to_ascii_lowercase();
    if ["sk-", "bearer ", "authorization", "api_key", "token", "secret", "password", "x-api-key"]
        .iter()
        .any(|needle| lower.contains(needle))
    {
        "[redacted]".into()
    } else {
        input.into()
    }
}
