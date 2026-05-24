use serde::{Deserialize, Serialize};
use specta::Type;

use super::errors::{is_secret_shaped, SourceError};

pub const SOURCES_CONFIG_KEY: &str = "sources.config";

// ── Types ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct SourcesConfig {
    pub version: u16,
    pub sources: Vec<SourceConfig>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "kind")]
pub enum SourceConfig {
    Jira(JiraSourceConfig),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct JiraSourceConfig {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub server_url: String,
    pub auth: JiraAuthConfig,
    pub projects: Vec<JiraProjectFilter>,
    pub last_connection_test: Option<ConnectionTestSummary>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "type")]
pub enum JiraAuthConfig {
    Pat { credential_ref: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct JiraProjectFilter {
    pub key: String,
    pub name: Option<String>,
    pub id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct ConnectionTestSummary {
    pub status: ConnectionTestStatus,
    pub tested_at: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub enum ConnectionTestStatus {
    NotTested,
    Success,
    Error,
    Unavailable,
}

// ── SourceConfig accessors ────────────────────────────────────────────────────

impl SourceConfig {
    pub fn id(&self) -> &str {
        match self {
            SourceConfig::Jira(j) => j.id.as_str(),
        }
    }
}

// ── Default ───────────────────────────────────────────────────────────────────

impl Default for SourcesConfig {
    fn default() -> Self {
        Self {
            version: 1,
            sources: vec![],
        }
    }
}

// ── Normalization ─────────────────────────────────────────────────────────────

impl SourcesConfig {
    /// Normalize all source URLs in-place.
    ///
    /// Returns an error if any source URL cannot be normalized; does not apply
    /// partial normalization (all-or-nothing across sources).
    pub fn normalize(&mut self) -> Result<(), SourceError> {
        for source in &mut self.sources {
            match source {
                SourceConfig::Jira(jira) => {
                    jira.server_url = normalize_jira_server_url(&jira.server_url)?;
                }
            }
        }
        Ok(())
    }
}

// ── Validation ────────────────────────────────────────────────────────────────

impl SourcesConfig {
    pub fn validate(&self) -> Result<(), SourceError> {
        if self.version != 1 {
            return Err(SourceError::InvalidConfig(format!(
                "unsupported config version: {}",
                self.version
            )));
        }

        // Unique source IDs
        let mut seen_ids = std::collections::HashSet::new();
        for source in &self.sources {
            let id = match source {
                SourceConfig::Jira(j) => j.id.as_str(),
            };
            if !seen_ids.insert(id) {
                return Err(SourceError::InvalidConfig(format!(
                    "duplicate source id: {id}"
                )));
            }
        }

        // Per-source validation
        for source in &self.sources {
            match source {
                SourceConfig::Jira(jira) => validate_jira_source(jira)?,
            }
        }

        Ok(())
    }
}

fn validate_jira_source(jira: &JiraSourceConfig) -> Result<(), SourceError> {
    if jira.id.is_empty() {
        return Err(SourceError::InvalidConfig("source id must not be empty".into()));
    }
    if jira.name.is_empty() {
        return Err(SourceError::InvalidConfig("source name must not be empty".into()));
    }

    // Validate server_url
    normalize_jira_server_url(&jira.server_url)?;

    // Validate auth credential_ref format
    match &jira.auth {
        JiraAuthConfig::Pat { credential_ref } => {
            let expected = format!("source.jira.{}.pat", jira.id);
            if *credential_ref != expected {
                return Err(SourceError::InvalidConfig(format!(
                    "Jira source {:?} credential_ref must be {:?} but got {:?}",
                    jira.id, expected, credential_ref
                )));
            }
        }
    }

    // Unique and non-empty project keys
    let mut seen_keys = std::collections::HashSet::new();
    for project in &jira.projects {
        if project.key.is_empty() {
            return Err(SourceError::InvalidConfig(
                "Jira project key must not be empty".into(),
            ));
        }
        if !seen_keys.insert(project.key.as_str()) {
            return Err(SourceError::InvalidConfig(format!(
                "duplicate Jira project key: {}",
                project.key
            )));
        }
    }

    Ok(())
}

// ── URL normalization ─────────────────────────────────────────────────────────

/// Parse and normalize a Jira server URL.
///
/// Rules (from spec):
/// - Trim whitespace.
/// - Must be parseable by `url::Url`.
/// - `https` is required except for `http://localhost` and `http://127.0.0.1`.
/// - No userinfo (credentials in URL).
/// - No query string.
/// - No fragment.
/// - Strip trailing slash.
pub fn normalize_jira_server_url(input: &str) -> Result<String, SourceError> {
    let trimmed = input.trim();
    let parsed = url::Url::parse(trimmed).map_err(|e| {
        SourceError::InvalidConfig(format!("invalid Jira server URL ({e}): {trimmed:?}"))
    })?;

    // Scheme check: https always OK; http only for localhost/127.0.0.1
    match parsed.scheme() {
        "https" => {}
        "http" => {
            let host = parsed.host_str().unwrap_or("");
            if host != "localhost" && host != "127.0.0.1" {
                return Err(SourceError::InvalidConfig(format!(
                    "Jira server URL must use https (http is only allowed for localhost/127.0.0.1): {trimmed:?}"
                )));
            }
        }
        other => {
            return Err(SourceError::InvalidConfig(format!(
                "Jira server URL must use https scheme, got {other:?}: {trimmed:?}"
            )));
        }
    }

    // No credentials in URL
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(SourceError::InvalidConfig(format!(
            "Jira server URL must not contain credentials: {trimmed:?}"
        )));
    }

    // No query string
    if parsed.query().is_some() {
        return Err(SourceError::InvalidConfig(format!(
            "Jira server URL must not include a query string: {trimmed:?}"
        )));
    }

    // No fragment
    if parsed.fragment().is_some() {
        return Err(SourceError::InvalidConfig(format!(
            "Jira server URL must not include a fragment: {trimmed:?}"
        )));
    }

    // Non-empty host
    if parsed.host_str().map_or(true, |h| h.is_empty()) {
        return Err(SourceError::InvalidConfig(format!(
            "Jira server URL must have a non-empty host: {trimmed:?}"
        )));
    }

    // Reconstruct without trailing slash
    let mut result = format!(
        "{}://{}",
        parsed.scheme(),
        parsed.host_str().unwrap_or("")
    );
    if let Some(port) = parsed.port() {
        result.push_str(&format!(":{port}"));
    }
    // Append path without trailing slash
    let path = parsed.path().trim_end_matches('/');
    if !path.is_empty() {
        result.push_str(path);
    }

    Ok(result)
}

// ── Persistence ───────────────────────────────────────────────────────────────

pub fn load_sources_config(conn: &rusqlite::Connection) -> Result<SourcesConfig, SourceError> {
    let Some(value) = crate::settings::shared::shared_settings_get(conn, SOURCES_CONFIG_KEY)
        .map_err(|e| SourceError::Storage(e.to_string()))? else { return Ok(SourcesConfig::default()); };
    reject_secret_shaped_metadata(&value)?;
    let mut config: SourcesConfig = serde_json::from_value(value)
        .map_err(|e| SourceError::InvalidConfig(format!("could not parse stored source config: {e}")))?;
    config.normalize()?;
    config.validate()?;
    Ok(config)
}

pub fn save_sources_config(conn: &rusqlite::Connection, config: &SourcesConfig) -> Result<(), SourceError> {
    let mut normalized = config.clone();
    normalized.normalize()?;
    normalized.validate()?;
    let value = serde_json::to_value(&normalized)
        .map_err(|e| SourceError::InvalidConfig(format!("could not serialize source config: {e}")))?;
    reject_secret_shaped_metadata(&value)?;
    crate::settings::shared::shared_settings_set(conn, SOURCES_CONFIG_KEY, &value)
        .map_err(|e| SourceError::Storage(e.to_string()))
}

// ── Secret-shaped metadata rejection ─────────────────────────────────────────

/// Recursively scan a JSON value for keys that look like secrets.
pub fn reject_secret_shaped_metadata(value: &serde_json::Value) -> Result<(), SourceError> {
    reject_recursive(value, "")
}

fn reject_recursive(value: &serde_json::Value, path: &str) -> Result<(), SourceError> {
    match value {
        serde_json::Value::Object(map) => {
            for (key, val) in map {
                let key_lower = key.to_ascii_lowercase();
                if is_secret_shaped(&key_lower) {
                    return Err(SourceError::InvalidConfig(format!(
                        "source config field looks like a credential and must not be stored in settings (key={path}{key})"
                    )));
                }
                let child_path = if path.is_empty() {
                    format!("{key}.")
                } else {
                    format!("{path}{key}.")
                };
                reject_recursive(val, &child_path)?;
            }
        }
        serde_json::Value::Array(arr) => {
            for (i, item) in arr.iter().enumerate() {
                reject_recursive(item, &format!("{path}[{i}]."))?;
            }
        }
        _ => {}
    }
    Ok(())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_jira_source(id: &str) -> SourceConfig {
        SourceConfig::Jira(JiraSourceConfig {
            id: id.to_string(),
            name: "Test Jira".into(),
            enabled: true,
            server_url: "https://jira.example.com".into(),
            auth: JiraAuthConfig::Pat {
                credential_ref: format!("source.jira.{id}.pat"),
            },
            projects: vec![],
            last_connection_test: None,
            created_at: "2024-01-01T00:00:00Z".into(),
            updated_at: "2024-01-01T00:00:00Z".into(),
        })
    }

    fn sample_jira_source_with_projects(id: &str, keys: Vec<&str>) -> SourceConfig {
        SourceConfig::Jira(JiraSourceConfig {
            id: id.to_string(),
            name: "Test Jira".into(),
            enabled: true,
            server_url: "https://jira.example.com".into(),
            auth: JiraAuthConfig::Pat {
                credential_ref: format!("source.jira.{id}.pat"),
            },
            projects: keys
                .into_iter()
                .map(|k| JiraProjectFilter {
                    key: k.to_string(),
                    name: Some(k.to_string()),
                    id: Some(k.to_string()),
                })
                .collect(),
            last_connection_test: None,
            created_at: "2024-01-01T00:00:00Z".into(),
            updated_at: "2024-01-01T00:00:00Z".into(),
        })
    }

    #[test]
    fn default_config_is_empty_version_one() {
        let cfg = SourcesConfig::default();
        assert_eq!(cfg.version, 1);
        assert!(cfg.sources.is_empty());
    }

    #[test]
    fn normalizes_valid_jira_url_and_rejects_unsafe_urls() {
        assert_eq!(
            normalize_jira_server_url(" https://jira.example.com/ ").unwrap(),
            "https://jira.example.com"
        );
        assert_eq!(
            normalize_jira_server_url("http://localhost:2990/jira/").unwrap(),
            "http://localhost:2990/jira"
        );
        assert!(normalize_jira_server_url("http://jira.example.com").is_err());
        assert!(normalize_jira_server_url("https://user:pass@jira.example.com").is_err());
        assert!(normalize_jira_server_url("https://jira.example.com?token=bad").is_err());
        assert!(normalize_jira_server_url("https://jira.example.com#frag").is_err());
    }

    #[test]
    fn rejects_duplicate_source_ids_and_project_keys() {
        let mut cfg = SourcesConfig {
            version: 1,
            sources: vec![sample_jira_source("src_test"), sample_jira_source("src_test")],
        };
        assert!(cfg
            .validate()
            .unwrap_err()
            .to_string()
            .contains("duplicate source id"));
        cfg.sources = vec![sample_jira_source_with_projects("src_a", vec!["HM", "HM"])];
        assert!(cfg
            .validate()
            .unwrap_err()
            .to_string()
            .contains("duplicate Jira project key"));
    }

    #[test]
    fn stored_metadata_must_not_contain_secret_shaped_fields() {
        let raw = serde_json::json!({"version":1,"sources":[{"kind":"Jira","id":"src_a","pat":"abc"}]});
        let err = reject_secret_shaped_metadata(&raw).unwrap_err();
        // Error describes a credential-shaped key; should mention "credential"
        assert!(err.to_string().contains("credential"), "got: {err}");
    }

    #[test]
    fn valid_config_passes_validation() {
        let cfg = SourcesConfig {
            version: 1,
            sources: vec![sample_jira_source("src_a")],
        };
        cfg.validate().unwrap();
    }

    #[test]
    fn rejects_unsupported_version() {
        let cfg = SourcesConfig { version: 99, sources: vec![] };
        let err = cfg.validate().unwrap_err();
        assert!(err.to_string().contains("unsupported config version"));
    }

    #[test]
    fn load_missing_sources_config_returns_default() {
        let conn = crate::db::open_in_memory().unwrap();
        assert_eq!(load_sources_config(&conn).unwrap(), SourcesConfig::default());
    }

    #[test]
    fn jira_source_round_trips_through_shared_settings_without_secret_value() {
        let conn = crate::db::open_in_memory().unwrap();
        let cfg = SourcesConfig { version: 1, sources: vec![sample_jira_source("src_roundtrip")] };
        save_sources_config(&conn, &cfg).unwrap();
        let raw = crate::settings::shared::shared_settings_get(&conn, SOURCES_CONFIG_KEY).unwrap().unwrap();
        let raw_text = raw.to_string();
        assert!(raw_text.contains("source.jira.src_roundtrip.pat"));
        assert!(!raw_text.contains("jira-pat-value"));
        assert_eq!(load_sources_config(&conn).unwrap(), cfg);
    }
}
