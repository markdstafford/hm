use serde::{Deserialize, Serialize};
use specta::Type;
use crate::settings::keys;
use crate::sources::errors::SourceError;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub enum SourceCredentialKind {
    JiraPat,
}

#[derive(Clone)]
pub struct SourceSecretValue(String);

impl std::fmt::Debug for SourceSecretValue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("SourceSecretValue([redacted])")
    }
}

impl SourceSecretValue {
    pub fn expose_for_jira_client(&self) -> &str {
        &self.0
    }
}

/// Validate a source_id using the same character rules as `settings::keys::validate_key`.
fn validate_source_id(source_id: &str) -> Result<(), SourceError> {
    keys::validate_key(source_id)
        .map_err(|e| SourceError::InvalidConfig(e.to_string()))
}

/// Build the deterministic credential ref for a source credential.
///
/// Returns `"source.jira.<source_id>.pat"` for `SourceCredentialKind::JiraPat`.
pub fn source_credential_ref(source_id: &str, kind: SourceCredentialKind) -> Result<String, SourceError> {
    validate_source_id(source_id)?;
    let ref_str = match kind {
        SourceCredentialKind::JiraPat => format!("source.jira.{source_id}.pat"),
    };
    Ok(ref_str)
}

/// Validate that a credential ref matches the expected pattern.
///
/// Accepts `"source.jira.<source_id>.pat"` where source_id is non-empty and valid.
pub fn validate_source_credential_ref(credential_ref: &str) -> Result<(), SourceError> {
    // Expected format: "source.jira.<source_id>.pat"
    let prefix = "source.jira.";
    let suffix = ".pat";
    if !credential_ref.starts_with(prefix) || !credential_ref.ends_with(suffix) {
        return Err(SourceError::InvalidConfig(
            format!("invalid credential ref format: {credential_ref}"),
        ));
    }
    let source_id = &credential_ref[prefix.len()..credential_ref.len() - suffix.len()];
    validate_source_id(source_id)
}

/// Write a source credential secret to the secret store, returning the credential ref.
pub fn set_source_credential_secret(
    source_id: &str,
    kind: SourceCredentialKind,
    value: &str,
    store: &dyn crate::settings::secrets::SecretStore,
) -> Result<String, SourceError> {
    let credential_ref = source_credential_ref(source_id, kind)?;
    store
        .set(&credential_ref, value)
        .map_err(|e| SourceError::Storage(e.to_string()))?;
    Ok(credential_ref)
}

/// Load a source credential secret from the secret store.
///
/// Returns `SourceError::MissingCredential` when the key is not found.
pub fn load_source_credential_secret(
    credential_ref: &str,
    store: &dyn crate::settings::secrets::SecretStore,
) -> Result<SourceSecretValue, SourceError> {
    validate_source_credential_ref(credential_ref)?;
    let value = store
        .get(credential_ref)
        .map_err(|e| SourceError::Storage(e.to_string()))?
        .ok_or_else(|| SourceError::MissingCredential("credential not found".into()))?;
    Ok(SourceSecretValue(value))
}

/// Remove a source from config and delete all credentials it owns.
///
/// Loads the current config, deletes each credential ref owned by the source,
/// removes the source from config, and saves the updated config.
/// Treats missing credentials as a safe no-op.
pub fn remove_source_config_and_credentials(
    conn: &rusqlite::Connection,
    store: &dyn crate::settings::secrets::SecretStore,
    source_id: &str,
) -> Result<(), crate::sources::errors::SourceError> {
    use crate::sources::config::{load_sources_config, save_sources_config};

    // 1. Load current config
    let mut config = load_sources_config(conn)?;

    // 2. Find the source and extract its credential refs
    let credential_refs: Vec<String> = config.sources.iter()
        .filter(|s| s.id() == source_id)
        .flat_map(|s| match s {
            crate::sources::config::SourceConfig::Jira(jira) => {
                match &jira.auth {
                    crate::sources::config::JiraAuthConfig::Pat { credential_ref } => {
                        vec![credential_ref.clone()]
                    }
                }
            }
        })
        .collect();

    // 3. Delete credential refs (treat missing as no-op)
    for cref in &credential_refs {
        delete_source_credential(cref, store)?;
    }

    // 4. Remove the source from config
    config.sources.retain(|s| s.id() != source_id);

    // 5. Save updated config
    save_sources_config(conn, &config)
}

/// Delete a source credential from the secret store.
///
/// Treats "not found" as a safe no-op.
pub fn delete_source_credential(
    credential_ref: &str,
    store: &dyn crate::settings::secrets::SecretStore,
) -> Result<(), SourceError> {
    validate_source_credential_ref(credential_ref)?;
    store
        .delete(credential_ref)
        .map_err(|e| SourceError::Storage(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::secrets::SecretStore as _;

    fn sample_jira_config(id: &str) -> crate::sources::config::JiraSourceConfig {
        crate::sources::config::JiraSourceConfig {
            id: id.to_string(),
            name: "Test Jira".into(),
            enabled: true,
            server_url: "https://jira.example.com".into(),
            auth: crate::sources::config::JiraAuthConfig::Pat {
                credential_ref: format!("source.jira.{id}.pat"),
            },
            projects: vec![],
            last_connection_test: None,
            created_at: "2024-01-01T00:00:00Z".into(),
            updated_at: "2024-01-01T00:00:00Z".into(),
        }
    }

    #[test]
    fn remove_jira_source_deletes_metadata_and_owned_credential_only() {
        let conn = crate::db::open_in_memory().unwrap();
        let store = crate::settings::secrets::InMemorySecretStore::new();
        let cfg = crate::sources::config::SourcesConfig {
            version: 1,
            sources: vec![
                crate::sources::config::SourceConfig::Jira(sample_jira_config("src_remove")),
                crate::sources::config::SourceConfig::Jira(sample_jira_config("src_keep")),
            ],
        };
        crate::sources::config::save_sources_config(&conn, &cfg).unwrap();
        store.set("source.jira.src_remove.pat", "remove-secret").unwrap();
        store.set("source.jira.src_keep.pat", "keep-secret").unwrap();

        remove_source_config_and_credentials(&conn, &store, "src_remove").unwrap();

        let next = crate::sources::config::load_sources_config(&conn).unwrap();
        assert_eq!(next.sources.len(), 1);
        assert!(next.sources.iter().any(|s| s.id() == "src_keep"));
        assert_eq!(store.get("source.jira.src_remove.pat").unwrap(), None);
        assert_eq!(store.get("source.jira.src_keep.pat").unwrap(), Some("keep-secret".into()));
    }

    #[test]
    fn jira_pat_credential_ref_is_deterministic() {
        assert_eq!(source_credential_ref("src_abc", SourceCredentialKind::JiraPat).unwrap(), "source.jira.src_abc.pat");
        assert!(source_credential_ref("bad id", SourceCredentialKind::JiraPat).is_err());
    }

    #[test]
    fn stores_loads_and_deletes_jira_pat_without_debug_leak() {
        let store = crate::settings::secrets::InMemorySecretStore::new();
        let credential_ref = set_source_credential_secret("src_abc", SourceCredentialKind::JiraPat, "jira-pat-value", &store).unwrap();
        assert_eq!(credential_ref, "source.jira.src_abc.pat");
        let loaded = load_source_credential_secret(&credential_ref, &store).unwrap();
        assert_eq!(loaded.expose_for_jira_client(), "jira-pat-value");
        assert!(!format!("{loaded:?}").contains("jira-pat-value"));
        delete_source_credential(&credential_ref, &store).unwrap();
        assert!(load_source_credential_secret(&credential_ref, &store).is_err());
    }

    #[test]
    fn deleting_missing_source_credential_is_safe_noop() {
        let store = crate::settings::secrets::InMemorySecretStore::new();
        delete_source_credential("source.jira.src_missing.pat", &store).unwrap();
    }
}
