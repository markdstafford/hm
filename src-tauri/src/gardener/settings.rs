use crate::gardener::errors::{GardenerError, GardenerErrorCategory};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::BTreeMap;

pub const GARDENER_POLICY_KEY: &str = "gardener.policy.v1";

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct GardenerPolicy {
    pub engines: BTreeMap<String, EnginePolicy>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct EnginePolicy {
    pub enabled: bool,
    pub scheduled: bool,
    pub on_demand: bool,
    pub generation_policy: Option<String>,
    pub first_run_cap: Option<u32>,
    pub per_sweep_cap: Option<u32>,
}

impl GardenerPolicy {
    pub fn default_policy() -> Self {
        let mut engines = BTreeMap::new();
        engines.insert(
            "reference".into(),
            EnginePolicy {
                enabled: true,
                scheduled: true,
                on_demand: true,
                generation_policy: None,
                first_run_cap: None,
                per_sweep_cap: None,
            },
        );
        engines.insert(
            "duplicate".into(),
            EnginePolicy {
                enabled: true,
                scheduled: true,
                on_demand: true,
                generation_policy: None,
                first_run_cap: None,
                per_sweep_cap: None,
            },
        );
        engines.insert(
            "stale".into(),
            EnginePolicy {
                enabled: true,
                scheduled: true,
                on_demand: true,
                generation_policy: None,
                first_run_cap: None,
                per_sweep_cap: None,
            },
        );
        engines.insert(
            "enrichment".into(),
            EnginePolicy {
                enabled: true,
                scheduled: true,
                on_demand: true,
                generation_policy: Some("eager_all".into()),
                first_run_cap: Some(25),
                per_sweep_cap: Some(10),
            },
        );
        GardenerPolicy { engines }
    }
}

pub fn load_gardener_policy(conn: &Connection) -> Result<GardenerPolicy, GardenerError> {
    let result =
        crate::settings::shared::shared_settings_get(conn, GARDENER_POLICY_KEY).map_err(|_| {
            GardenerError {
                category: GardenerErrorCategory::Settings,
                message: "Could not load gardener policy.".into(),
            }
        })?;

    match result {
        None => Ok(GardenerPolicy::default_policy()),
        Some(value) => serde_json::from_value(value).map_err(|_| GardenerError {
            category: GardenerErrorCategory::Settings,
            message: "Could not load gardener policy.".into(),
        }),
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::settings::shared::shared_settings_set;

    #[test]
    fn missing_key_returns_default_policy() {
        let conn = open_in_memory().unwrap();
        let policy = load_gardener_policy(&conn).expect("should succeed");
        // Default contains reference, duplicate, stale, enrichment
        assert!(policy.engines.contains_key("reference"));
        assert!(policy.engines.contains_key("duplicate"));
        assert!(policy.engines.contains_key("stale"));
        assert!(policy.engines.contains_key("enrichment"));
        assert!(policy.engines["reference"].enabled);
        assert!(policy.engines["reference"].scheduled);
        assert!(policy.engines["reference"].on_demand);
        assert!(policy.engines["enrichment"].first_run_cap == Some(25));
        assert!(policy.engines["enrichment"].per_sweep_cap == Some(10));
        assert_eq!(
            policy.engines["enrichment"].generation_policy.as_deref(),
            Some("eager_all")
        );
    }

    #[test]
    fn stored_policy_is_returned() {
        let conn = open_in_memory().unwrap();
        let mut custom = GardenerPolicy::default_policy();
        custom.engines.get_mut("reference").unwrap().enabled = false;
        let value = serde_json::to_value(&custom).unwrap();
        shared_settings_set(&conn, GARDENER_POLICY_KEY, &value).unwrap();

        let loaded = load_gardener_policy(&conn).expect("should succeed");
        assert!(
            !loaded.engines["reference"].enabled,
            "custom value should be returned"
        );
    }

    #[test]
    fn malformed_json_returns_settings_error() {
        let conn = open_in_memory().unwrap();
        // Store intentionally wrong-typed JSON
        let bad = serde_json::json!({"not_engines": true});
        shared_settings_set(&conn, GARDENER_POLICY_KEY, &bad).unwrap();

        let result = load_gardener_policy(&conn);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.category, GardenerErrorCategory::Settings);
        // The error message should be the safe string, not raw JSON
        assert_eq!(err.message, "Could not load gardener policy.");
    }

    #[test]
    fn default_policy_enrichment_has_caps() {
        let policy = GardenerPolicy::default_policy();
        let enrichment = &policy.engines["enrichment"];
        assert_eq!(enrichment.first_run_cap, Some(25));
        assert_eq!(enrichment.per_sweep_cap, Some(10));
        assert_eq!(enrichment.generation_policy.as_deref(), Some("eager_all"));
    }
}
