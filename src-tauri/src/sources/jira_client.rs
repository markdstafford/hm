use std::fmt;
use std::sync::Arc;

use crate::sources::jira_errors::JiraApiError;

// ── Secret string ─────────────────────────────────────────────────────────────

#[derive(Clone, PartialEq, Eq)]
pub struct SecretString(String);

impl SecretString {
    pub fn new(value: String) -> Self {
        Self(value)
    }

    pub fn expose(&self) -> &str {
        &self.0
    }
}

impl fmt::Debug for SecretString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("[redacted]")
    }
}

// ── Retry and rate-limit policies ─────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RetryPolicy {
    pub max_attempts: usize,
    pub base_delay_ms: u64,
    pub max_delay_ms: u64,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            base_delay_ms: 250,
            max_delay_ms: 1_000,
        }
    }
}

impl RetryPolicy {
    pub fn no_retries_for_tests() -> Self {
        Self {
            max_attempts: 1,
            base_delay_ms: 0,
            max_delay_ms: 0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RateLimitPolicy {
    pub fallback_delay_ms: u64,
    pub max_retry_after_seconds: u64,
}

impl Default for RateLimitPolicy {
    fn default() -> Self {
        Self {
            fallback_delay_ms: 1_000,
            max_retry_after_seconds: 60,
        }
    }
}

// ── Client config ──────────────────────────────────────────────────────────────

#[derive(Clone, PartialEq, Eq)]
pub struct JiraApiClientConfig {
    pub base_url: String,
    pub pat: String,
    pub user_agent: String,
    pub retry_policy: RetryPolicy,
    pub rate_limit_policy: RateLimitPolicy,
}

impl fmt::Debug for JiraApiClientConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("JiraApiClientConfig")
            .field("base_url", &self.base_url)
            .field("pat", &"[redacted]")
            .field("user_agent", &self.user_agent)
            .field("retry_policy", &self.retry_policy)
            .field("rate_limit_policy", &self.rate_limit_policy)
            .finish()
    }
}

// ── Sleeper abstraction ────────────────────────────────────────────────────────

pub trait Sleeper: Send + Sync {
    fn sleep_ms(&self, millis: u64);
}

#[derive(Debug)]
pub struct ThreadSleeper;

impl Sleeper for ThreadSleeper {
    fn sleep_ms(&self, millis: u64) {
        std::thread::sleep(std::time::Duration::from_millis(millis));
    }
}

// ── Client ────────────────────────────────────────────────────────────────────

pub struct JiraApiClient {
    pub(crate) base_url: String,
    pub(crate) pat: SecretString,
    pub(crate) user_agent: String,
    pub(crate) retry_policy: RetryPolicy,
    pub(crate) rate_limit_policy: RateLimitPolicy,
    pub(crate) http: ureq::Agent,
    pub(crate) sleeper: Arc<dyn Sleeper>,
}

impl fmt::Debug for JiraApiClient {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("JiraApiClient")
            .field("base_url", &self.base_url)
            .field("pat", &self.pat)
            .field("user_agent", &self.user_agent)
            .field("retry_policy", &self.retry_policy)
            .field("rate_limit_policy", &self.rate_limit_policy)
            .finish_non_exhaustive()
    }
}

impl JiraApiClient {
    pub fn new(config: JiraApiClientConfig) -> Result<Self, JiraApiError> {
        Self::new_with_sleeper(config, Arc::new(ThreadSleeper))
    }

    pub fn new_with_sleeper(
        config: JiraApiClientConfig,
        sleeper: Arc<dyn Sleeper>,
    ) -> Result<Self, JiraApiError> {
        let base_url = normalize_base_url(&config.base_url)?;
        if config.pat.is_empty() {
            return Err(JiraApiError::InvalidRequest { message: "PAT is required".into() });
        }
        if config.user_agent.trim().is_empty() {
            return Err(JiraApiError::InvalidRequest { message: "user agent is required".into() });
        }
        Ok(Self {
            base_url,
            pat: SecretString::new(config.pat),
            user_agent: config.user_agent,
            retry_policy: config.retry_policy,
            rate_limit_policy: config.rate_limit_policy,
            http: ureq::AgentBuilder::new().build(),
            sleeper,
        })
    }

    #[cfg(test)]
    pub fn base_url_for_tests(&self) -> &str {
        &self.base_url
    }
}

// ── URL normalization ──────────────────────────────────────────────────────────

fn normalize_base_url(input: &str) -> Result<String, JiraApiError> {
    let trimmed = input.trim();
    // Reject path traversal: the `url` crate normalizes `/../` silently, so we
    // must check the raw input before parsing.
    if trimmed.contains("/../") || trimmed.contains("/..") {
        return Err(JiraApiError::InvalidBaseUrl);
    }
    let parsed = url::Url::parse(trimmed).map_err(|_| JiraApiError::InvalidBaseUrl)?;
    match parsed.scheme() {
        "https" => {}
        "http" => {
            let host = parsed.host_str().unwrap_or("");
            if host != "localhost" && host != "127.0.0.1" {
                return Err(JiraApiError::InvalidBaseUrl);
            }
        }
        _ => return Err(JiraApiError::InvalidBaseUrl),
    }
    if !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
        || parsed.host_str().map_or(true, str::is_empty)
    {
        return Err(JiraApiError::InvalidBaseUrl);
    }
    let mut normalized = format!("{}://{}", parsed.scheme(), parsed.host_str().unwrap());
    if let Some(port) = parsed.port() {
        normalized.push_str(&format!(":{port}"));
    }
    let path = parsed.path().trim_end_matches('/');
    if !path.is_empty() {
        normalized.push_str(path);
    }
    Ok(normalized)
}

// ── Tests ──────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    pub(super) fn config(base_url: &str, pat: &str) -> JiraApiClientConfig {
        JiraApiClientConfig {
            base_url: base_url.to_string(),
            pat: pat.to_string(),
            user_agent: "hm-test/0.1.0".to_string(),
            retry_policy: RetryPolicy::no_retries_for_tests(),
            rate_limit_policy: RateLimitPolicy::default(),
        }
    }

    #[test]
    fn constructs_from_normalized_base_url_and_redacts_pat_debug() {
        let client =
            JiraApiClient::new(config(" https://jira.example.invalid/jira/ ", "secret-jira-pat-123"))
                .unwrap();
        assert_eq!(
            client.base_url_for_tests(),
            "https://jira.example.invalid/jira"
        );
        let debug = format!("{client:?}");
        assert!(debug.contains("JiraApiClient"));
        assert!(!debug.contains("secret-jira-pat-123"));
        assert!(debug.contains("[redacted]"));
        assert!(!debug.to_ascii_lowercase().contains("authorization"));
    }

    #[test]
    fn rejects_invalid_or_credential_bearing_base_urls_safely() {
        for url in [
            "not a url",
            "http://jira.example.invalid",
            "https://user:pass@jira.example.invalid",
            "https://jira.example.invalid?token=abc",
            "https://jira.example.invalid/#fragment",
        ] {
            let err = JiraApiClient::new(config(url, "secret-jira-pat-123")).unwrap_err();
            assert!(matches!(err, JiraApiError::InvalidBaseUrl));
            assert!(!format!("{err}").contains("secret-jira-pat-123"));
            assert!(!format!("{err:?}").contains("secret-jira-pat-123"));
        }
    }

    #[test]
    fn localhost_http_is_allowed_for_tests() {
        let client =
            JiraApiClient::new(config("http://127.0.0.1:8080", "secret-jira-pat-123")).unwrap();
        assert_eq!(client.base_url_for_tests(), "http://127.0.0.1:8080");
    }

    #[test]
    fn rejects_path_traversal_urls() {
        // The `url` crate normalizes `/../` silently (e.g. `/../../etc` → `/etc`),
        // so we must reject these in the raw input before parsing.
        for url in [
            "https://jira.example.invalid/../../etc",
            "https://jira.example.invalid/jira/../../etc",
            "https://jira.example.invalid/..",
        ] {
            let err = JiraApiClient::new(config(url, "secret-jira-pat-123")).unwrap_err();
            assert!(
                matches!(err, JiraApiError::InvalidBaseUrl),
                "expected InvalidBaseUrl for {url}, got {err:?}"
            );
        }
    }
}

