use std::fmt;
use std::sync::Arc;

use crate::sources::jira_errors::JiraApiError;
use crate::sources::jira_types::{JiraIssue, JiraProject};

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

    /// Make a single authenticated GET request. No retry.
    fn send_get_once<T: serde::de::DeserializeOwned>(
        &self,
        path_and_query: &str,
    ) -> Result<T, JiraApiError> {
        let url = join_api_path(&self.base_url, path_and_query);
        match self
            .http
            .get(&url)
            .set("Authorization", &format!("Bearer {}", self.pat.expose()))
            .set("Accept", "application/json")
            .set("User-Agent", &self.user_agent)
            .call()
        {
            Ok(resp) => resp.into_json::<T>().map_err(|_| JiraApiError::Decode),
            Err(ureq::Error::Status(status, resp)) => {
                let retry_after = parse_retry_after_header(resp.header("Retry-After"));
                Err(JiraApiError::from_status(status, retry_after))
            }
            Err(ureq::Error::Transport(_)) => Err(JiraApiError::Network),
        }
    }

    /// GET request with retry (currently just calls send_get_once; Task 6 adds retry loop).
    fn get_json<T: serde::de::DeserializeOwned>(
        &self,
        path_and_query: &str,
    ) -> Result<T, JiraApiError> {
        self.send_get_once(path_and_query)
    }

    /// Fetch one issue by key or id with embedded changelog.
    pub fn get_issue_with_changelog(
        &self,
        issue_id_or_key: &str,
    ) -> Result<JiraIssue, JiraApiError> {
        let issue = encode_path_segment(issue_id_or_key)?;
        self.get_json(&format!("/rest/api/2/issue/{issue}?expand=changelog"))
    }

    /// List accessible projects.
    pub fn list_projects(&self) -> Result<Vec<JiraProject>, JiraApiError> {
        self.get_json("/rest/api/2/project")
    }

    #[cfg(test)]
    pub fn base_url_for_tests(&self) -> &str {
        &self.base_url
    }
}

// ── Path segment helpers ──────────────────────────────────────────────────────

pub(crate) fn encode_path_segment(segment: &str) -> Result<String, JiraApiError> {
    if segment.trim().is_empty() || segment.contains('/') || segment.contains("..") {
        return Err(JiraApiError::InvalidRequest {
            message: "invalid Jira path segment".into(),
        });
    }
    Ok(url::form_urlencoded::byte_serialize(segment.as_bytes()).collect())
}

fn join_api_path(base_url: &str, path_and_query: &str) -> String {
    format!("{base_url}{path_and_query}")
}

fn parse_retry_after_header(value: Option<&str>) -> Option<u64> {
    value.and_then(|raw| raw.trim().parse::<u64>().ok())
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
    use std::sync::{Arc, Mutex};
    use std::thread;
    use tiny_http::{Header, Method, Response, Server, StatusCode};

    fn spawn_json_server<F>(handler: F) -> String
    where
        F: Fn(tiny_http::Request) + Send + 'static,
    {
        let server = Server::http("127.0.0.1:0").unwrap();
        let base_url = format!("http://{}", server.server_addr());
        thread::spawn(move || {
            if let Ok(request) = server.recv() {
                handler(request);
            }
        });
        base_url
    }

    fn json_response(
        status: u16,
        body: &'static str,
    ) -> Response<std::io::Cursor<Vec<u8>>> {
        Response::from_string(body)
            .with_status_code(StatusCode(status))
            .with_header(
                Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap(),
            )
    }

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

    #[test]
    fn list_projects_sends_auth_accept_and_user_agent_headers() {
        let seen: Arc<Mutex<Vec<(String, String)>>> = Arc::new(Mutex::new(Vec::new()));
        let seen_clone = Arc::clone(&seen);
        let base_url = spawn_json_server(move |request| {
            assert_eq!(request.method(), &Method::Get);
            assert_eq!(request.url(), "/rest/api/2/project");
            for header in request.headers() {
                seen_clone.lock().unwrap().push((
                    header.field.as_str().to_string(),
                    header.value.as_str().to_string(),
                ));
            }
            request
                .respond(json_response(
                    200,
                    include_str!("fixtures/jira_projects.json"),
                ))
                .unwrap();
        });
        let projects = JiraApiClient::new(config(&base_url, "secret-jira-pat-123"))
            .unwrap()
            .list_projects()
            .unwrap();
        assert_eq!(projects.len(), 2);
        let headers = seen.lock().unwrap();
        assert!(
            headers
                .iter()
                .any(|(k, v)| k.eq_ignore_ascii_case("Authorization")
                    && v == "Bearer secret-jira-pat-123"),
            "Authorization header missing or wrong"
        );
        assert!(
            headers
                .iter()
                .any(|(k, v)| k.eq_ignore_ascii_case("Accept") && v == "application/json"),
            "Accept header missing"
        );
        assert!(
            headers
                .iter()
                .any(|(k, v)| k.eq_ignore_ascii_case("User-Agent") && v == "hm-test/0.1.0"),
            "User-Agent header missing"
        );
    }

    #[test]
    fn get_issue_with_changelog_uses_expand_query_and_decodes_fixture() {
        let base_url = spawn_json_server(|request| {
            assert_eq!(request.method(), &Method::Get);
            assert_eq!(request.url(), "/rest/api/2/issue/HM-1?expand=changelog");
            request
                .respond(json_response(
                    200,
                    include_str!("fixtures/jira_issue_with_changelog.json"),
                ))
                .unwrap();
        });
        let issue = JiraApiClient::new(config(&base_url, "secret-jira-pat-123"))
            .unwrap()
            .get_issue_with_changelog("HM-1")
            .unwrap();
        assert_eq!(issue.key, "HM-1");
        assert!(issue.changelog.is_some());
    }

    #[test]
    fn http_failures_map_to_safe_jira_api_errors() {
        let base_url = spawn_json_server(|request| {
            request
                .respond(json_response(
                    401,
                    r#"{"errorMessages":["Authorization: Bearer secret-jira-pat-123"]}"#,
                ))
                .unwrap();
        });
        let err = JiraApiClient::new(config(&base_url, "secret-jira-pat-123"))
            .unwrap()
            .list_projects()
            .unwrap_err();
        assert_eq!(err, JiraApiError::Unauthorized);
        assert!(!format!("{err}").contains("secret-jira-pat-123"));
    }

    #[test]
    fn encode_path_segment_rejects_slash_and_dotdot() {
        assert!(encode_path_segment("").is_err());
        assert!(encode_path_segment("a/b").is_err());
        assert!(encode_path_segment("../etc").is_err());
        assert!(encode_path_segment("HM-1").is_ok());
        assert!(encode_path_segment("HM 1").is_ok()); // spaces are URL-encoded
    }
}

