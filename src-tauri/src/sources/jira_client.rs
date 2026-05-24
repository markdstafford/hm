use std::fmt;
use std::sync::Arc;

use crate::sources::jira_errors::JiraApiError;
use crate::sources::jira_types::{JiraChangelogEntry, JiraChangelogPage, JiraIssue, JiraProject, JiraSearchPage};

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

/// Maximum number of pages fetched by any `*_all` pagination helper.
/// Prevents infinite loops when a server omits `total` and returns repeating full pages.
const MAX_PAGINATION_PAGES: usize = 200;

// ── Pagination helpers ────────────────────────────────────────────────────────

fn clamp_page_size(max_results: u32) -> u32 {
    max_results.clamp(1, 100)
}

fn should_stop_pagination(
    start_at: u32,
    requested: u32,
    returned: usize,
    total: Option<u32>,
) -> bool {
    if returned == 0 {
        return true;
    }
    let returned_u32 = returned as u32;
    if let Some(total) = total {
        return start_at.saturating_add(returned_u32) >= total;
    }
    returned_u32 < requested
}

// ── Search request ────────────────────────────────────────────────────────────

/// Request parameters for a JQL search.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JiraSearchRequest {
    pub jql: String,
    pub start_at: u32,
    pub max_results: u32,
}

impl JiraSearchRequest {
    pub fn new(jql: impl Into<String>) -> Self {
        Self {
            jql: jql.into(),
            start_at: 0,
            max_results: 50,
        }
    }

    pub fn with_start_at(mut self, start_at: u32) -> Self {
        self.start_at = start_at;
        self
    }

    pub fn with_max_results(mut self, max_results: u32) -> Self {
        self.max_results = clamp_page_size(max_results);
        self
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
            Ok(resp) => {
                let _rate_limit_headers = parse_rate_limit_headers(&resp);
                resp.into_json::<T>().map_err(|_| JiraApiError::Decode)
            }
            Err(ureq::Error::Status(status, resp)) => {
                let retry_after = parse_retry_after_header(resp.header("Retry-After"));
                Err(JiraApiError::from_status(status, retry_after))
            }
            Err(ureq::Error::Transport(_)) => Err(JiraApiError::Network),
        }
    }

    /// GET request with bounded retry loop.
    fn get_json<T: serde::de::DeserializeOwned>(
        &self,
        path_and_query: &str,
    ) -> Result<T, JiraApiError> {
        let attempts = self.retry_policy.max_attempts.max(1);
        let mut last_error: Option<JiraApiError> = None;
        for attempt_index in 0..attempts {
            match self.send_get_once(path_and_query) {
                Ok(value) => return Ok(value),
                Err(err) if err.is_retryable() && attempt_index + 1 < attempts => {
                    let delay_ms = self.delay_for_attempt(attempt_index, &err);
                    self.sleeper.sleep_ms(delay_ms);
                    last_error = Some(err);
                }
                Err(err) => return Err(err),
            }
        }
        Err(last_error.unwrap_or(JiraApiError::Network))
    }

    fn delay_for_attempt(&self, attempt_index: usize, err: &JiraApiError) -> u64 {
        // If Retry-After is present, honor it (capped at max_retry_after_seconds)
        if let Some(retry_after) = err.retry_after_duration() {
            let max_ms = self.rate_limit_policy.max_retry_after_seconds.saturating_mul(1_000);
            return (retry_after.as_millis() as u64).min(max_ms);
        }
        // For rate-limited responses without Retry-After, use conservative fallback delay
        if matches!(err, JiraApiError::RateLimited { .. }) {
            return self.rate_limit_policy.fallback_delay_ms;
        }
        // For transient 5xx / network errors, use exponential backoff
        let exponential = self
            .retry_policy
            .base_delay_ms
            .saturating_mul(1u64 << attempt_index.min(10));
        exponential.min(self.retry_policy.max_delay_ms)
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

    /// Search issues by JQL, one page.
    pub fn search_issues_page(
        &self,
        request: JiraSearchRequest,
    ) -> Result<JiraSearchPage, JiraApiError> {
        let mut serializer = url::form_urlencoded::Serializer::new(String::new());
        serializer.append_pair("jql", &request.jql);
        serializer.append_pair("startAt", &request.start_at.to_string());
        serializer.append_pair("maxResults", &clamp_page_size(request.max_results).to_string());
        self.get_json(&format!("/rest/api/2/search?{}", serializer.finish()))
    }

    /// Search issues by JQL, all pages.
    pub fn search_issues_all(
        &self,
        request: JiraSearchRequest,
    ) -> Result<Vec<JiraIssue>, JiraApiError> {
        let page_size = clamp_page_size(request.max_results);
        let mut start_at = request.start_at;
        let mut issues = Vec::new();
        let mut pages_fetched = 0usize;
        loop {
            if pages_fetched >= MAX_PAGINATION_PAGES {
                break;
            }
            let page = self.search_issues_page(JiraSearchRequest {
                start_at,
                max_results: page_size,
                jql: request.jql.clone(),
            })?;
            let returned = page.issues.len();
            let stop = should_stop_pagination(page.start_at, page.max_results, returned, page.total);
            issues.extend(page.issues);
            pages_fetched += 1;
            if stop {
                break;
            }
            let next_start = start_at.saturating_add(returned as u32);
            if next_start <= start_at {
                break;
            }
            start_at = next_start;
        }
        Ok(issues)
    }

    /// Fetch one changelog page.
    pub fn get_issue_changelog_page(
        &self,
        issue_id_or_key: &str,
        start_at: u32,
        max_results: u32,
    ) -> Result<JiraChangelogPage, JiraApiError> {
        let issue = encode_path_segment(issue_id_or_key)?;
        let max_results = clamp_page_size(max_results);
        self.get_json(&format!(
            "/rest/api/2/issue/{issue}/changelog?startAt={start_at}&maxResults={max_results}"
        ))
    }

    /// Fetch all changelog entries, following pagination.
    pub fn get_issue_changelog_all(
        &self,
        issue_id_or_key: &str,
        max_results: u32,
    ) -> Result<Vec<JiraChangelogEntry>, JiraApiError> {
        let page_size = clamp_page_size(max_results);
        let mut start_at = 0u32;
        let mut histories = Vec::new();
        let mut pages_fetched = 0usize;
        loop {
            if pages_fetched >= MAX_PAGINATION_PAGES {
                break;
            }
            let page = self.get_issue_changelog_page(issue_id_or_key, start_at, page_size)?;
            let returned = page.histories.len();
            let stop =
                should_stop_pagination(page.start_at, page.max_results, returned, page.total);
            histories.extend(page.histories);
            pages_fetched += 1;
            if stop {
                break;
            }
            let next_start = start_at.saturating_add(returned as u32);
            if next_start <= start_at {
                break;
            }
            start_at = next_start;
        }
        Ok(histories)
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

#[derive(Debug, Clone, PartialEq, Eq)]
struct JiraRateLimitHeaders {
    limit: Option<u64>,
    remaining: Option<u64>,
    reset: Option<String>,
    near_limit: Option<bool>,
}

fn parse_rate_limit_headers(resp: &ureq::Response) -> JiraRateLimitHeaders {
    JiraRateLimitHeaders {
        limit: resp.header("X-RateLimit-Limit").and_then(|v| v.parse().ok()),
        remaining: resp
            .header("X-RateLimit-Remaining")
            .and_then(|v| v.parse().ok()),
        reset: resp.header("X-RateLimit-Reset").map(str::to_string),
        near_limit: resp
            .header("X-RateLimit-NearLimit")
            .and_then(|v| v.parse().ok()),
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

    #[test]
    fn search_issues_page_url_encodes_jql_and_pagination() {
        let base_url = spawn_json_server(|request| {
            assert_eq!(request.method(), &Method::Get);
            // JQL "project = HM ORDER BY updated DESC" URL-encoded
            assert_eq!(
                request.url(),
                "/rest/api/2/search?jql=project+%3D+HM+ORDER+BY+updated+DESC&startAt=0&maxResults=50"
            );
            request
                .respond(json_response(
                    200,
                    include_str!("fixtures/jira_search_page.json"),
                ))
                .unwrap();
        });
        let page = JiraApiClient::new(config(&base_url, "secret-jira-pat-123"))
            .unwrap()
            .search_issues_page(JiraSearchRequest::new("project = HM ORDER BY updated DESC"))
            .unwrap();
        assert_eq!(page.issues.len(), 2);
    }

    #[test]
    fn search_issues_all_follows_two_pages_and_stops_on_total() {
        let server = Server::http("127.0.0.1:0").unwrap();
        let base_url = format!("http://{}", server.server_addr());
        thread::spawn(move || {
            let first = server.recv().unwrap();
            assert!(first.url().contains("startAt=0"));
            first
                .respond(json_response(
                    200,
                    r#"{"startAt":0,"maxResults":2,"total":3,"issues":[{"id":"1","key":"HM-1","fields":{}},{"id":"2","key":"HM-2","fields":{}}]}"#,
                ))
                .unwrap();
            let second = server.recv().unwrap();
            assert!(second.url().contains("startAt=2"));
            second
                .respond(json_response(
                    200,
                    r#"{"startAt":2,"maxResults":2,"total":3,"issues":[{"id":"3","key":"HM-3","fields":{}}]}"#,
                ))
                .unwrap();
        });
        let issues = JiraApiClient::new(config(&base_url, "secret-jira-pat-123"))
            .unwrap()
            .search_issues_all(JiraSearchRequest::new("project = HM").with_max_results(2))
            .unwrap();
        assert_eq!(
            issues.iter().map(|i| i.key.as_str()).collect::<Vec<_>>(),
            vec!["HM-1", "HM-2", "HM-3"]
        );
    }

    #[test]
    fn changelog_all_follows_two_pages() {
        let server = Server::http("127.0.0.1:0").unwrap();
        let base_url = format!("http://{}", server.server_addr());
        thread::spawn(move || {
            let first = server.recv().unwrap();
            assert_eq!(
                first.url(),
                "/rest/api/2/issue/HM-1/changelog?startAt=0&maxResults=1"
            );
            first
                .respond(json_response(
                    200,
                    r#"{"startAt":0,"maxResults":1,"total":2,"histories":[{"id":"1","created":"2026-05-01T00:00:00.000+0000","items":[]}]}"#,
                ))
                .unwrap();
            let second = server.recv().unwrap();
            assert_eq!(
                second.url(),
                "/rest/api/2/issue/HM-1/changelog?startAt=1&maxResults=1"
            );
            second
                .respond(json_response(
                    200,
                    r#"{"startAt":1,"maxResults":1,"total":2,"histories":[{"id":"2","created":"2026-05-02T00:00:00.000+0000","items":[]}]}"#,
                ))
                .unwrap();
        });
        let histories = JiraApiClient::new(config(&base_url, "secret-jira-pat-123"))
            .unwrap()
            .get_issue_changelog_all("HM-1", 1)
            .unwrap();
        assert_eq!(histories.len(), 2);
        assert_eq!(histories[0].id, "1");
        assert_eq!(histories[1].id, "2");
    }

    #[test]
    fn search_issues_all_terminates_when_server_omits_total_and_returns_full_pages() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        static REQUEST_COUNT: AtomicUsize = AtomicUsize::new(0);

        // Server always returns a "full" page of 1 with no total — would loop forever without the cap
        let server = Server::http("127.0.0.1:0").unwrap();
        let base_url = format!("http://{}", server.server_addr());
        thread::spawn(move || {
            loop {
                match server.recv() {
                    Ok(request) => {
                        let count = REQUEST_COUNT.fetch_add(1, Ordering::SeqCst) + 1;
                        request
                            .respond(json_response(
                                200,
                                // No "total" field — short-page heuristic won't fire since page is "full"
                                r#"{"startAt":0,"maxResults":1,"issues":[{"id":"1","key":"HM-1","fields":{}}]}"#,
                            ))
                            .unwrap();
                        if count >= MAX_PAGINATION_PAGES + 5 {
                            break; // Allow test to eventually complete even if the guard fails
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        let issues = JiraApiClient::new(config(&base_url, "secret-jira-pat-123"))
            .unwrap()
            .search_issues_all(JiraSearchRequest::new("project = HM").with_max_results(1))
            .unwrap();

        // Should have stopped at MAX_PAGINATION_PAGES (or fewer if stop condition kicked in)
        assert!(
            issues.len() <= MAX_PAGINATION_PAGES,
            "collected {} issues, expected at most {}",
            issues.len(),
            MAX_PAGINATION_PAGES
        );
    }

    #[test]
    fn pagination_stop_conditions_are_bounded() {
        // Empty returned → stop
        assert!(should_stop_pagination(0, 50, 0, Some(100)));
        // Total reached → stop
        assert!(should_stop_pagination(50, 50, 50, Some(100)));
        // Short page without total → stop
        assert!(should_stop_pagination(0, 50, 12, None));
        // Full page without total → continue
        assert!(!should_stop_pagination(0, 50, 50, None));
        // Page size 1, partial returns
        assert!(should_stop_pagination(0, 1, 0, None));
    }

    struct RecordingSleeper {
        sleeps: Arc<Mutex<Vec<u64>>>,
    }

    impl RecordingSleeper {
        fn new() -> (Self, Arc<Mutex<Vec<u64>>>) {
            let sleeps = Arc::new(Mutex::new(Vec::new()));
            (Self { sleeps: Arc::clone(&sleeps) }, sleeps)
        }
    }

    impl Sleeper for RecordingSleeper {
        fn sleep_ms(&self, millis: u64) {
            self.sleeps.lock().unwrap().push(millis);
        }
    }

    #[test]
    fn retries_5xx_then_succeeds_without_real_sleep() {
        let server = Server::http("127.0.0.1:0").unwrap();
        let base_url = format!("http://{}", server.server_addr());
        thread::spawn(move || {
            server.recv().unwrap().respond(json_response(503, "{}")).unwrap();
            server
                .recv()
                .unwrap()
                .respond(json_response(200, include_str!("fixtures/jira_projects.json")))
                .unwrap();
        });
        let (sleeper, recorded_sleeps) = RecordingSleeper::new();
        let mut cfg = config(&base_url, "secret-jira-pat-123");
        cfg.retry_policy = RetryPolicy {
            max_attempts: 2,
            base_delay_ms: 25,
            max_delay_ms: 100,
        };
        let projects = JiraApiClient::new_with_sleeper(cfg, Arc::new(sleeper))
            .unwrap()
            .list_projects()
            .unwrap();
        assert_eq!(projects.len(), 2);
        let sleeps = recorded_sleeps.lock().unwrap().clone();
        assert_eq!(sleeps, vec![25], "expected exactly one delay of 25ms after first 503");
    }

    #[test]
    fn does_not_retry_non_retryable_statuses() {
        let base_url = spawn_json_server(|request| {
            request
                .respond(json_response(403, r#"{"errorMessages":["denied"]}"#))
                .unwrap();
        });
        let (sleeper, recorded_sleeps) = RecordingSleeper::new();
        let err = JiraApiClient::new_with_sleeper(config(&base_url, "secret-jira-pat-123"), Arc::new(sleeper))
            .unwrap()
            .list_projects()
            .unwrap_err();
        assert_eq!(err, JiraApiError::Forbidden);
        assert!(
            recorded_sleeps.lock().unwrap().is_empty(),
            "should not sleep on non-retryable 403"
        );
    }

    #[test]
    fn honors_429_retry_after_and_exhaustion_is_safe() {
        // Single-attempt policy — 429 with Retry-After should be returned immediately
        // (no more attempts left), and no sleep should occur
        let server = Server::http("127.0.0.1:0").unwrap();
        let base_url = format!("http://{}", server.server_addr());
        thread::spawn(move || {
            let response = Response::from_string(r#"{"errorMessages":["rate limited"]}"#)
                .with_status_code(StatusCode(429))
                .with_header(Header::from_bytes(&b"Retry-After"[..], &b"2"[..]).unwrap());
            server.recv().unwrap().respond(response).unwrap();
        });
        let (sleeper, recorded_sleeps) = RecordingSleeper::new();
        let err = JiraApiClient::new_with_sleeper(
            config(&base_url, "secret-jira-pat-123"),
            Arc::new(sleeper),
        )
        .unwrap()
        .list_projects()
        .unwrap_err();
        assert_eq!(
            err,
            JiraApiError::RateLimited {
                retry_after_seconds: Some(2)
            }
        );
        assert!(
            recorded_sleeps.lock().unwrap().is_empty(),
            "one-attempt policy must not sleep after exhausted attempts"
        );
    }

    #[test]
    fn retries_429_without_retry_after_uses_fallback_delay() {
        let server = Server::http("127.0.0.1:0").unwrap();
        let base_url = format!("http://{}", server.server_addr());
        thread::spawn(move || {
            // First request: 429 with no Retry-After header
            let response_429 = Response::from_string(r#"{"errorMessages":["rate limited"]}"#)
                .with_status_code(StatusCode(429));
            server.recv().unwrap().respond(response_429).unwrap();
            // Second request: success
            server
                .recv()
                .unwrap()
                .respond(json_response(200, include_str!("fixtures/jira_projects.json")))
                .unwrap();
        });
        let (sleeper, recorded_sleeps) = RecordingSleeper::new();
        let mut cfg = config(&base_url, "secret-jira-pat-123");
        cfg.retry_policy = RetryPolicy {
            max_attempts: 2,
            base_delay_ms: 5,    // Small to confirm fallback overrides base
            max_delay_ms: 10,
        };
        cfg.rate_limit_policy = RateLimitPolicy {
            fallback_delay_ms: 500,
            max_retry_after_seconds: 60,
        };
        let projects = JiraApiClient::new_with_sleeper(cfg, Arc::new(sleeper))
            .unwrap()
            .list_projects()
            .unwrap();
        assert_eq!(projects.len(), 2);
        let sleeps = recorded_sleeps.lock().unwrap().clone();
        assert_eq!(
            sleeps,
            vec![500],
            "429 without Retry-After should use fallback_delay_ms=500, not base_delay_ms=5"
        );
    }

    #[test]
    fn retries_429_with_retry_after_delay_when_budget_remains() {
        let server = Server::http("127.0.0.1:0").unwrap();
        let base_url = format!("http://{}", server.server_addr());
        thread::spawn(move || {
            // First request: 429 with Retry-After: 1 second
            let response_429 = Response::from_string(r#"{"errorMessages":["rate limited"]}"#)
                .with_status_code(StatusCode(429))
                .with_header(Header::from_bytes(&b"Retry-After"[..], &b"1"[..]).unwrap());
            server.recv().unwrap().respond(response_429).unwrap();
            // Second request: success
            server
                .recv()
                .unwrap()
                .respond(json_response(200, include_str!("fixtures/jira_projects.json")))
                .unwrap();
        });
        let (sleeper, recorded_sleeps) = RecordingSleeper::new();
        let mut cfg = config(&base_url, "secret-jira-pat-123");
        cfg.retry_policy = RetryPolicy {
            max_attempts: 2,
            base_delay_ms: 250,
            max_delay_ms: 1_000,
        };
        let projects = JiraApiClient::new_with_sleeper(cfg, Arc::new(sleeper))
            .unwrap()
            .list_projects()
            .unwrap();
        assert_eq!(projects.len(), 2);
        let sleeps = recorded_sleeps.lock().unwrap().clone();
        // Should sleep for 1000ms (Retry-After: 1 second)
        assert_eq!(sleeps, vec![1_000], "expected one sleep of 1000ms for Retry-After: 1");
    }
}

