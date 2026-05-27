use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct CollectionViewRecord {
    pub id: String,
    pub entity_kind: String,
    pub display_name: String,
    pub position: i32,
    pub is_default: bool,
    pub config: crate::commands::JsonValue,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct CollectionViewSaveInput {
    pub id: String,
    pub entity_kind: String,
    pub display_name: String,
    pub position: i32,
    pub is_default: bool,
    pub config: crate::commands::JsonValue,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct CollectionViewSeedInput {
    pub entity_kind: String,
    pub defaults: Vec<CollectionViewSaveInput>,
}

pub fn setup_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS collection_views (
            id            TEXT PRIMARY KEY,
            entity_kind   TEXT NOT NULL,
            display_name  TEXT NOT NULL,
            position      INTEGER NOT NULL CHECK (position >= 0),
            is_default    INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
            config_json   TEXT NOT NULL DEFAULT '{}',
            created_at    TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_collection_views_entity_position
          ON collection_views (entity_kind, position, created_at);

        CREATE TABLE IF NOT EXISTS collection_view_seed_state (
            entity_kind TEXT PRIMARY KEY,
            seeded_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    )?;
    Ok(())
}

#[derive(Debug, Clone, PartialEq)]
pub struct SeedResult {
    pub seeded: bool,
    pub views: Vec<CollectionViewRecord>,
}

fn safe_error(message: &str) -> rusqlite::Error {
    rusqlite::Error::InvalidParameterName(message.to_string())
}

fn validate_non_empty(value: &str, field: &str) -> Result<()> {
    if value.trim().is_empty() {
        return Err(safe_error(field));
    }
    Ok(())
}

fn validate_position(position: i32) -> Result<()> {
    if position < 0 {
        return Err(safe_error("position must be zero or greater"));
    }
    Ok(())
}

fn row_to_record(row: &rusqlite::Row<'_>) -> Result<CollectionViewRecord> {
    let config_json: String = row.get(5)?;
    let parsed = serde_json::from_str(&config_json).map_err(|_| safe_error("config_json must be valid JSON"))?;
    let is_default_int: i64 = row.get(4)?;
    Ok(CollectionViewRecord {
        id: row.get(0)?,
        entity_kind: row.get(1)?,
        display_name: row.get(2)?,
        position: row.get(3)?,
        is_default: is_default_int == 1,
        config: crate::commands::JsonValue(parsed),
    })
}

pub fn list_collection_views(conn: &Connection, entity_kind: &str) -> Result<Vec<CollectionViewRecord>> {
    validate_non_empty(entity_kind, "entity_kind is required")?;
    let mut stmt = conn.prepare(
        "SELECT id, entity_kind, display_name, position, is_default, config_json
         FROM collection_views
         WHERE entity_kind = ?1
         ORDER BY position ASC, created_at ASC",
    )?;
    let rows = stmt.query_map([entity_kind.trim()], row_to_record)?;
    rows.collect()
}

pub fn save_collection_view(conn: &Connection, input: &CollectionViewSaveInput) -> Result<CollectionViewRecord> {
    validate_non_empty(&input.id, "id is required")?;
    validate_non_empty(&input.entity_kind, "entity_kind is required")?;
    validate_non_empty(&input.display_name, "display_name is required")?;
    validate_position(input.position)?;
    let config_json = serde_json::to_string(&input.config.0).map_err(|_| safe_error("config must be valid JSON"))?;

    conn.execute(
        "INSERT INTO collection_views (
            id, entity_kind, display_name, position, is_default, config_json, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
            entity_kind = excluded.entity_kind,
            display_name = excluded.display_name,
            position = excluded.position,
            is_default = excluded.is_default,
            config_json = excluded.config_json,
            updated_at = excluded.updated_at",
        params![
            input.id.trim(),
            input.entity_kind.trim(),
            input.display_name.trim(),
            input.position,
            if input.is_default { 1 } else { 0 },
            config_json,
        ],
    )?;

    conn.query_row(
        "SELECT id, entity_kind, display_name, position, is_default, config_json
         FROM collection_views WHERE id = ?1",
        [input.id.trim()],
        row_to_record,
    )
}

pub fn delete_collection_view(conn: &Connection, id: &str) -> Result<()> {
    validate_non_empty(id, "id is required")?;
    conn.execute("DELETE FROM collection_views WHERE id = ?1", [id.trim()])?;
    Ok(())
}

pub fn has_seeded_defaults(conn: &Connection, entity_kind: &str) -> Result<bool> {
    validate_non_empty(entity_kind, "entity_kind is required")?;
    let seeded: Option<String> = conn
        .query_row(
            "SELECT entity_kind FROM collection_view_seed_state WHERE entity_kind = ?1",
            [entity_kind.trim()],
            |row| row.get(0),
        )
        .optional()?;
    Ok(seeded.is_some())
}

pub fn mark_seeded_defaults(conn: &Connection, entity_kind: &str) -> Result<()> {
    validate_non_empty(entity_kind, "entity_kind is required")?;
    conn.execute(
        "INSERT INTO collection_view_seed_state (entity_kind, seeded_at)
         VALUES (?1, datetime('now'))
         ON CONFLICT(entity_kind) DO NOTHING",
        [entity_kind.trim()],
    )?;
    Ok(())
}

pub fn seed_default_collection_views(
    conn: &Connection,
    entity_kind: &str,
    defaults: &[CollectionViewSaveInput],
) -> Result<SeedResult> {
    validate_non_empty(entity_kind, "entity_kind is required")?;
    if has_seeded_defaults(conn, entity_kind)? {
        return Ok(SeedResult {
            seeded: false,
            views: list_collection_views(conn, entity_kind)?,
        });
    }

    for default in defaults {
        if default.entity_kind.trim() != entity_kind.trim() {
            return Err(safe_error("default entity_kind does not match seed entity"));
        }
        save_collection_view(conn, default)?;
    }
    mark_seeded_defaults(conn, entity_kind)?;

    Ok(SeedResult {
        seeded: true,
        views: list_collection_views(conn, entity_kind)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    fn input(id: &str, entity_kind: &str, display_name: &str, position: i32) -> CollectionViewSaveInput {
        CollectionViewSaveInput {
            id: id.to_string(),
            entity_kind: entity_kind.to_string(),
            display_name: display_name.to_string(),
            position,
            is_default: false,
            config: crate::commands::JsonValue(serde_json::json!({ "density": "compact" })),
        }
    }

    #[test]
    fn saving_and_listing_a_view_returns_it_ordered_by_position() {
        let conn = open_in_memory().expect("db should open");
        save_collection_view(&conn, &input("v2", "jira-issue", "Second", 2)).expect("save v2");
        save_collection_view(&conn, &input("v1", "jira-issue", "First", 1)).expect("save v1");

        let rows = list_collection_views(&conn, "jira-issue").expect("list should succeed");

        assert_eq!(rows.iter().map(|r| r.id.as_str()).collect::<Vec<_>>(), vec!["v1", "v2"]);
        assert_eq!(rows[0].config.0, serde_json::json!({ "density": "compact" }));
    }

    #[test]
    fn listing_is_scoped_by_entity_kind() {
        let conn = open_in_memory().expect("db should open");
        save_collection_view(&conn, &input("jira", "jira-issue", "Jira", 0)).expect("save jira");
        save_collection_view(&conn, &input("github", "github-issue", "GitHub", 0)).expect("save github");

        let rows = list_collection_views(&conn, "jira-issue").expect("list should succeed");

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].id, "jira");
    }

    #[test]
    fn saving_existing_id_updates_mutable_fields() {
        let conn = open_in_memory().expect("db should open");
        save_collection_view(&conn, &input("v1", "jira-issue", "Original", 0)).expect("save original");
        let mut updated = input("v1", "jira-issue", "Renamed", 4);
        updated.is_default = true;
        updated.config = crate::commands::JsonValue(serde_json::json!({ "x": 1 }));
        save_collection_view(&conn, &updated).expect("save updated");

        let rows = list_collection_views(&conn, "jira-issue").expect("list should succeed");

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].display_name, "Renamed");
        assert_eq!(rows[0].position, 4);
        assert!(rows[0].is_default);
        assert_eq!(rows[0].config.0, serde_json::json!({ "x": 1 }));
    }

    #[test]
    fn deleting_a_view_removes_it() {
        let conn = open_in_memory().expect("db should open");
        save_collection_view(&conn, &input("v1", "jira-issue", "Delete me", 0)).expect("save");

        delete_collection_view(&conn, "v1").expect("delete should succeed");

        let rows = list_collection_views(&conn, "jira-issue").expect("list should succeed");
        assert!(rows.is_empty());
    }

    #[test]
    fn validation_rejects_empty_values_and_negative_positions() {
        let conn = open_in_memory().expect("db should open");

        assert!(save_collection_view(&conn, &input("", "jira-issue", "Name", 0)).is_err());
        assert!(save_collection_view(&conn, &input("id", "   ", "Name", 0)).is_err());
        assert!(save_collection_view(&conn, &input("id", "jira-issue", "   ", 0)).is_err());
        assert!(save_collection_view(&conn, &input("id", "jira-issue", "Name", -1)).is_err());
        assert!(list_collection_views(&conn, "   ").is_err());
        assert!(delete_collection_view(&conn, "").is_err());
    }

    #[test]
    fn seed_defaults_runs_once_and_does_not_recreate_deleted_defaults() {
        let conn = open_in_memory().expect("db should open");
        let defaults = vec![
            input("jira-issue-all-open", "jira-issue", "All open", 0),
            input("jira-issue-mine", "jira-issue", "Mine", 1),
        ];

        let first = seed_default_collection_views(&conn, "jira-issue", &defaults).expect("first seed");
        assert!(first.seeded);
        delete_collection_view(&conn, "jira-issue-mine").expect("delete default");
        let second = seed_default_collection_views(&conn, "jira-issue", &defaults).expect("second seed");

        assert!(!second.seeded);
        let rows = list_collection_views(&conn, "jira-issue").expect("list should succeed");
        assert_eq!(rows.iter().map(|r| r.id.as_str()).collect::<Vec<_>>(), vec!["jira-issue-all-open"]);
    }

    #[test]
    fn safe_validation_errors_are_ui_safe_strings() {
        let conn = open_in_memory().expect("db should open");
        let err = save_collection_view(&conn, &input("", "jira-issue", "Name", 0))
            .expect_err("empty id should fail")
            .to_string();
        assert!(err.contains("id is required"));
        assert!(!err.to_lowercase().contains("select"));
        assert!(!err.to_lowercase().contains("insert"));
    }
}
