use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::BTreeMap;

use crate::commands::JsonValue;

use super::errors::AiError;

pub const AI_PROVIDER_CONFIG_KEY: &str = "ai.providers.config";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub enum AiCredentialKind {
    ApiKey,
    BearerToken,
    AwsIamProfile,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "type")]
pub enum CredentialSource {
    Keychain { key_ref: String },
    Env { var_name: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct AiCredentialConfig {
    pub name: String,
    pub kind: AiCredentialKind,
    pub source: CredentialSource,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub enum AiEndpointProtocol {
    AnthropicMessages,
    OpenAiChatCompletionsCompatible,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct AiEndpointConfig {
    pub name: String,
    pub protocol: AiEndpointProtocol,
    pub base_url: String,
    pub credential_ref: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub enum AiRunner {
    AnthropicMessages,
    OpenAiChatCompletions,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub enum AiExecutionMode {
    DirectApi,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct AiProfileConfig {
    pub name: String,
    pub endpoint_ref: String,
    pub model: String,
    pub runner: AiRunner,
    pub execution_mode: AiExecutionMode,
    pub settings: JsonValue,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct AiProviderConfig {
    pub version: u16,
    pub credentials: Vec<AiCredentialConfig>,
    pub endpoints: Vec<AiEndpointConfig>,
    pub profiles: Vec<AiProfileConfig>,
    pub routing: BTreeMap<String, String>,
}

impl Default for AiProviderConfig {
    fn default() -> Self {
        Self {
            version: 1,
            credentials: vec![],
            endpoints: vec![],
            profiles: vec![],
            routing: BTreeMap::new(),
        }
    }
}

// ── Persistence helpers ───────────────────────────────────────────────────────

pub fn load_ai_provider_config(conn: &rusqlite::Connection) -> Result<AiProviderConfig, AiError> {
    let Some(value) = crate::settings::shared::shared_settings_get(conn, AI_PROVIDER_CONFIG_KEY)
        .map_err(|e| AiError::Storage(e.to_string()))? else {
        return Ok(AiProviderConfig::default());
    };
    let config: AiProviderConfig = serde_json::from_value(value)
        .map_err(|e| AiError::InvalidConfig(format!("could not parse stored config: {e}")))?;
    config.validate()?;
    Ok(config)
}

pub fn save_ai_provider_config(conn: &rusqlite::Connection, config: &AiProviderConfig) -> Result<(), AiError> {
    config.validate()?;
    let value = serde_json::to_value(config)
        .map_err(|e| AiError::InvalidConfig(format!("could not serialize config: {e}")))?;
    crate::settings::shared::shared_settings_set(conn, AI_PROVIDER_CONFIG_KEY, &value)
        .map_err(|e| AiError::Storage(e.to_string()))
}

// ── Validation helpers ────────────────────────────────────────────────────────

fn validate_unique_names(names: &[&str], kind: &str) -> Result<(), AiError> {
    let mut seen = std::collections::HashSet::new();
    for &name in names {
        if !seen.insert(name) {
            return Err(AiError::InvalidConfig(format!(
                "duplicate {kind} name: {name}"
            )));
        }
    }
    Ok(())
}

fn validate_name(name: &str, kind: &str) -> Result<(), AiError> {
    if name != name.trim() {
        return Err(AiError::InvalidConfig(format!(
            "{kind} name has leading/trailing whitespace: {name:?}"
        )));
    }
    if name.is_empty() || name.len() > 128 {
        return Err(AiError::InvalidConfig(format!(
            "{kind} name must be 1-128 characters: {name:?}"
        )));
    }
    let valid = name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-');
    if !valid {
        return Err(AiError::InvalidConfig(format!(
            "{kind} name may only contain [A-Za-z0-9._-]: {name:?}"
        )));
    }
    Ok(())
}

fn validate_env_name(var_name: &str) -> Result<(), AiError> {
    if var_name.is_empty() {
        return Err(AiError::InvalidConfig(
            "env var name must not be empty".into(),
        ));
    }
    let valid = var_name
        .chars()
        .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_');
    if !valid {
        return Err(AiError::InvalidConfig(format!(
            "env var name may only contain [A-Z0-9_]: {var_name:?}"
        )));
    }
    Ok(())
}

fn validate_task_name(task_name: &str) -> Result<(), AiError> {
    let segments: Vec<&str> = task_name.split('.').collect();
    if segments.len() < 2 {
        return Err(AiError::InvalidConfig(format!(
            "routing task name must have at least 2 dot-separated segments: {task_name:?}"
        )));
    }
    for seg in &segments {
        if seg.is_empty() {
            return Err(AiError::InvalidConfig(format!(
                "routing task name has an empty segment: {task_name:?}"
            )));
        }
        let valid = seg
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '-');
        if !valid {
            return Err(AiError::InvalidConfig(format!(
                "routing task name segment may only contain [a-z0-9_-]: {task_name:?}"
            )));
        }
    }
    Ok(())
}

fn validate_url(base_url: &str) -> Result<(), AiError> {
    let lower = base_url.to_ascii_lowercase();
    let rest = if lower.starts_with("https://") {
        &base_url[8..]
    } else if lower.starts_with("http://") {
        &base_url[7..]
    } else {
        return Err(AiError::InvalidConfig(format!(
            "endpoint base_url must start with http:// or https://: {base_url:?}"
        )));
    };
    // rest is "host" or "host/path" — host must be non-empty
    let host = rest.split('/').next().unwrap_or("");
    if host.is_empty() {
        return Err(AiError::InvalidConfig(format!(
            "endpoint base_url must have a non-empty host: {base_url:?}"
        )));
    }
    Ok(())
}

fn validate_supported_combination(profile: &AiProfileConfig, endpoint: &AiEndpointConfig) -> Result<(), AiError> {
    let ok = matches!(
        (&endpoint.protocol, &profile.runner, &profile.execution_mode),
        (AiEndpointProtocol::AnthropicMessages, AiRunner::AnthropicMessages, AiExecutionMode::DirectApi)
            | (AiEndpointProtocol::OpenAiChatCompletionsCompatible, AiRunner::OpenAiChatCompletions, AiExecutionMode::DirectApi)
    );
    if !ok {
        return Err(AiError::InvalidConfig(format!(
            "unsupported protocol/runner/execution_mode combination in profile {:?}",
            profile.name
        )));
    }
    Ok(())
}

fn validate_settings_no_secrets(value: &serde_json::Value, path: &str) -> Result<(), AiError> {
    match value {
        serde_json::Value::Object(map) => {
            for (key, val) in map {
                let key_lower = key.to_ascii_lowercase();
                if ["api_key", "token", "secret", "authorization", "password"]
                    .iter()
                    .any(|needle| key_lower.contains(needle))
                {
                    return Err(AiError::InvalidConfig(format!(
                        "profile settings key looks like a secret — store credentials via credential_ref instead: {path}.{key}"
                    )));
                }
                let child_path = if path.is_empty() {
                    key.clone()
                } else {
                    format!("{path}.{key}")
                };
                validate_settings_no_secrets(val, &child_path)?;
            }
        }
        serde_json::Value::Array(arr) => {
            for (i, item) in arr.iter().enumerate() {
                validate_settings_no_secrets(item, &format!("{path}[{i}]"))?;
            }
        }
        _ => {}
    }
    Ok(())
}

// ── Main validation ───────────────────────────────────────────────────────────

impl AiProviderConfig {
    pub fn validate(&self) -> Result<(), AiError> {
        // Version check
        if self.version != 1 {
            return Err(AiError::InvalidConfig(format!(
                "unsupported config version: {}",
                self.version
            )));
        }

        // Validate and collect credential names
        let cred_names: Vec<&str> = self
            .credentials
            .iter()
            .map(|c| c.name.as_str())
            .collect();
        validate_unique_names(&cred_names, "credential")?;
        for cred in &self.credentials {
            validate_name(&cred.name, "credential")?;
            if let CredentialSource::Env { var_name } = &cred.source {
                validate_env_name(var_name)?;
            }
        }

        // Validate and collect endpoint names
        let endpoint_names: Vec<&str> = self
            .endpoints
            .iter()
            .map(|e| e.name.as_str())
            .collect();
        validate_unique_names(&endpoint_names, "endpoint")?;
        for endpoint in &self.endpoints {
            validate_name(&endpoint.name, "endpoint")?;
            validate_url(&endpoint.base_url)?;
            if !cred_names.contains(&endpoint.credential_ref.as_str()) {
                return Err(AiError::InvalidConfig(format!(
                    "endpoint {:?} references unknown credential {:?}",
                    endpoint.name, endpoint.credential_ref
                )));
            }
        }

        // Validate and collect profile names
        let profile_names: Vec<&str> = self
            .profiles
            .iter()
            .map(|p| p.name.as_str())
            .collect();
        validate_unique_names(&profile_names, "profile")?;
        for profile in &self.profiles {
            validate_name(&profile.name, "profile")?;
            // Find referenced endpoint
            let endpoint = self
                .endpoints
                .iter()
                .find(|e| e.name == profile.endpoint_ref)
                .ok_or_else(|| {
                    AiError::InvalidConfig(format!(
                        "profile {:?} references unknown endpoint {:?}",
                        profile.name, profile.endpoint_ref
                    ))
                })?;
            validate_supported_combination(profile, endpoint)?;
            validate_settings_no_secrets(&profile.settings.0, "")?;
        }

        // Validate routing
        for (task_name, profile_ref) in &self.routing {
            validate_task_name(task_name)?;
            if !profile_names.contains(&profile_ref.as_str()) {
                return Err(AiError::InvalidConfig(format!(
                    "routing task {:?} references unknown profile {:?}",
                    task_name, profile_ref
                )));
            }
        }

        Ok(())
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn sample_config() -> AiProviderConfig {
        AiProviderConfig {
            version: 1,
            credentials: vec![AiCredentialConfig {
                name: "anthropic-prod".into(),
                kind: AiCredentialKind::ApiKey,
                source: CredentialSource::Keychain {
                    key_ref: "ai.credentials.anthropic-prod".into(),
                },
            }],
            endpoints: vec![AiEndpointConfig {
                name: "anthropic".into(),
                protocol: AiEndpointProtocol::AnthropicMessages,
                base_url: "https://api.anthropic.com/v1".into(),
                credential_ref: "anthropic-prod".into(),
            }],
            profiles: vec![AiProfileConfig {
                name: "triage-authoring".into(),
                endpoint_ref: "anthropic".into(),
                model: "claude-3-5-sonnet-latest".into(),
                runner: AiRunner::AnthropicMessages,
                execution_mode: AiExecutionMode::DirectApi,
                settings: crate::commands::JsonValue(json!({"temperature": 0.2})),
            }],
            routing: {
                let mut m = BTreeMap::new();
                m.insert("issue.triage".into(), "triage-authoring".into());
                m
            },
        }
    }

    fn valid_openai_config() -> AiProviderConfig {
        AiProviderConfig {
            version: 1,
            credentials: vec![AiCredentialConfig {
                name: "openai-env".into(),
                kind: AiCredentialKind::BearerToken,
                source: CredentialSource::Env {
                    var_name: "HM_OPENAI_KEY".into(),
                },
            }],
            endpoints: vec![AiEndpointConfig {
                name: "gateway".into(),
                protocol: AiEndpointProtocol::OpenAiChatCompletionsCompatible,
                base_url: "http://localhost:8080/v1".into(),
                credential_ref: "openai-env".into(),
            }],
            profiles: vec![AiProfileConfig {
                name: "chat-fast".into(),
                endpoint_ref: "gateway".into(),
                model: "gpt-test".into(),
                runner: AiRunner::OpenAiChatCompletions,
                execution_mode: AiExecutionMode::DirectApi,
                settings: crate::commands::JsonValue(json!({})),
            }],
            routing: {
                let mut m = BTreeMap::new();
                m.insert("chat.answer".into(), "chat-fast".into());
                m
            },
        }
    }

    #[test]
    fn default_config_is_empty_version_one() {
        let cfg = AiProviderConfig::default();
        assert_eq!(cfg.version, 1);
        assert!(cfg.credentials.is_empty());
        assert!(cfg.endpoints.is_empty());
        assert!(cfg.profiles.is_empty());
        assert!(cfg.routing.is_empty());
    }

    #[test]
    fn serde_round_trip_preserves_full_config_without_secret_values() {
        let cfg = sample_config();
        let json_str = serde_json::to_string(&cfg).expect("serialize");
        // The config contains "ai.credentials.anthropic-prod" as a key_ref but no actual secret value
        assert!(!json_str.contains("sk-test-secret"));
        let restored: AiProviderConfig = serde_json::from_str(&json_str).expect("deserialize");
        assert_eq!(cfg.version, restored.version);
        assert_eq!(cfg.credentials[0].name, restored.credentials[0].name);
        assert_eq!(cfg.endpoints[0].name, restored.endpoints[0].name);
        assert_eq!(cfg.profiles[0].name, restored.profiles[0].name);
        assert_eq!(cfg.routing, restored.routing);
    }

    #[test]
    fn serialized_enum_values_are_stable() {
        let json_str = serde_json::to_string(&sample_config()).expect("serialize");
        assert!(json_str.contains("AnthropicMessages"));
        assert!(json_str.contains("DirectApi"));

        let oa_str = serde_json::to_string(&valid_openai_config()).expect("serialize");
        assert!(oa_str.contains("OpenAiChatCompletions"));
        assert!(oa_str.contains("OpenAiChatCompletionsCompatible"));
    }

    #[test]
    fn accepts_valid_config() {
        sample_config().validate().unwrap();
        valid_openai_config().validate().unwrap();
    }

    #[test]
    fn rejects_duplicate_credential_names() {
        let mut cfg = sample_config();
        cfg.credentials.push(AiCredentialConfig {
            name: "anthropic-prod".into(),
            kind: AiCredentialKind::ApiKey,
            source: CredentialSource::Keychain {
                key_ref: "ai.credentials.anthropic-prod-2".into(),
            },
        });
        let err = cfg.validate().unwrap_err();
        assert!(matches!(err, AiError::InvalidConfig(_)));
        if let AiError::InvalidConfig(msg) = err {
            assert!(msg.contains("duplicate"), "expected 'duplicate' in: {msg}");
        }
    }

    #[test]
    fn rejects_invalid_name_with_space() {
        let mut cfg = sample_config();
        cfg.profiles[0].name = "bad name".into();
        let err = cfg.validate().unwrap_err();
        assert!(matches!(err, AiError::InvalidConfig(_)));
    }

    #[test]
    fn rejects_invalid_dotted_task_name() {
        let mut cfg = sample_config();
        cfg.routing.clear();
        cfg.routing.insert("issue".into(), "triage-authoring".into());
        let err = cfg.validate().unwrap_err();
        assert!(matches!(err, AiError::InvalidConfig(_)));
        if let AiError::InvalidConfig(msg) = err {
            assert!(
                msg.contains("at least 2"),
                "expected 'at least 2' in: {msg}"
            );
        }
    }

    #[test]
    fn rejects_invalid_http_url() {
        let mut cfg = sample_config();
        cfg.endpoints[0].base_url = "file:///tmp/model".into();
        let err = cfg.validate().unwrap_err();
        assert!(matches!(err, AiError::InvalidConfig(_)));
        if let AiError::InvalidConfig(msg) = err {
            assert!(
                msg.contains("http://") || msg.contains("https://"),
                "expected url scheme error in: {msg}"
            );
        }
    }

    #[test]
    fn rejects_missing_credential_ref() {
        let mut cfg = sample_config();
        cfg.endpoints[0].credential_ref = "nonexistent-cred".into();
        let err = cfg.validate().unwrap_err();
        assert!(matches!(err, AiError::InvalidConfig(_)));
        if let AiError::InvalidConfig(msg) = err {
            assert!(
                msg.contains("nonexistent-cred"),
                "expected credential name in: {msg}"
            );
        }
    }

    #[test]
    fn rejects_missing_endpoint_ref() {
        let mut cfg = sample_config();
        cfg.profiles[0].endpoint_ref = "nonexistent-endpoint".into();
        let err = cfg.validate().unwrap_err();
        assert!(matches!(err, AiError::InvalidConfig(_)));
        if let AiError::InvalidConfig(msg) = err {
            assert!(
                msg.contains("nonexistent-endpoint"),
                "expected endpoint name in: {msg}"
            );
        }
    }

    #[test]
    fn rejects_missing_profile_in_routing() {
        let mut cfg = sample_config();
        cfg.routing.insert("issue.triage".into(), "nonexistent-profile".into());
        let err = cfg.validate().unwrap_err();
        assert!(matches!(err, AiError::InvalidConfig(_)));
        if let AiError::InvalidConfig(msg) = err {
            assert!(
                msg.contains("nonexistent-profile"),
                "expected profile name in: {msg}"
            );
        }
    }

    #[test]
    fn rejects_unsupported_protocol_runner_combo() {
        // OpenAI endpoint + Anthropic runner — invalid combination
        let mut cfg = valid_openai_config();
        cfg.profiles[0].runner = AiRunner::AnthropicMessages;
        let err = cfg.validate().unwrap_err();
        assert!(matches!(err, AiError::InvalidConfig(_)));
        if let AiError::InvalidConfig(msg) = err {
            assert!(
                msg.contains("unsupported"),
                "expected 'unsupported' in: {msg}"
            );
        }
    }

    #[test]
    fn rejects_secret_shaped_settings_keys() {
        let mut cfg = sample_config();
        cfg.profiles[0].settings =
            crate::commands::JsonValue(json!({"api_key": "should-not-be-here"}));
        let err = cfg.validate().unwrap_err();
        assert!(matches!(err, AiError::InvalidConfig(_)));
        if let AiError::InvalidConfig(msg) = err {
            assert!(
                msg.contains("api_key"),
                "expected 'api_key' in: {msg}"
            );
        }
    }

    #[test]
    fn rejects_unsupported_version() {
        let mut cfg = sample_config();
        cfg.version = 99;
        let err = cfg.validate().unwrap_err();
        assert!(matches!(err, AiError::InvalidConfig(_)));
        if let AiError::InvalidConfig(msg) = err {
            assert!(
                msg.contains("unsupported config version"),
                "expected 'unsupported config version' in: {msg}"
            );
        }
    }

    #[test]
    fn missing_shared_setting_returns_default_config() {
        let conn = crate::db::open_in_memory().unwrap();
        assert_eq!(load_ai_provider_config(&conn).unwrap(), AiProviderConfig::default());
    }

    #[test]
    fn save_validates_before_writing() {
        let conn = crate::db::open_in_memory().unwrap();
        let mut invalid = AiProviderConfig::default();
        invalid.version = 99;
        let err = save_ai_provider_config(&conn, &invalid).unwrap_err();
        assert!(err.to_string().contains("unsupported config version"));
        assert!(crate::settings::shared::shared_settings_get(&conn, AI_PROVIDER_CONFIG_KEY).unwrap().is_none());
    }

    #[test]
    fn save_then_load_round_trips_valid_config() {
        let conn = crate::db::open_in_memory().unwrap();
        let config = AiProviderConfig::default();
        save_ai_provider_config(&conn, &config).unwrap();
        assert_eq!(load_ai_provider_config(&conn).unwrap(), config);
    }

    #[test]
    fn invalid_stored_config_returns_typed_safe_error() {
        let conn = crate::db::open_in_memory().unwrap();
        crate::settings::shared::shared_settings_set(
            &conn,
            AI_PROVIDER_CONFIG_KEY,
            &serde_json::json!({"version":99,"credentials":[],"endpoints":[],"profiles":[],"routing":{}}),
        ).unwrap();
        let err = load_ai_provider_config(&conn).unwrap_err();
        assert!(err.to_string().contains("invalid AI provider config"));
    }
}
