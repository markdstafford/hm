//! People + source-identity upserts.
//!
//! Each upstream user (Jira account, GitHub login, etc.) becomes a
//! `source_identities` row keyed by the upstream identifiers; multiple
//! identities can later be linked to a canonical `people` row via
//! `identity_links`. For now we create one `people` row per new identity
//! and let the link step happen separately.
//!
//! The match-and-upsert strategy is intentionally conservative: we look up
//! existing identities by `(source_system_id, source_kind, <upstream key>)`
//! tuples in priority order (`upstream_account_id`, then `upstream_name`,
//! then `upstream_key`). The first hit wins. If none of those keys are
//! provided we still allow the call as long as `display_name` is present,
//! synthesising a stable fallback id from it; if even that is missing we
//! refuse the call rather than silently inventing identity data.

use rusqlite::{params, Connection, Error, Result};

use crate::issues::ids::stable_id;

pub struct SourceIdentityInput<'a> {
    pub source_system_id: &'a str,
    pub source_kind: &'a str,
    pub upstream_account_id: Option<&'a str>,
    pub upstream_name: Option<&'a str>,
    pub upstream_key: Option<&'a str>,
    pub username: Option<&'a str>,
    pub email: Option<&'a str>,
    pub display_name: Option<&'a str>,
    pub avatar_url: Option<&'a str>,
    pub raw_json: Option<&'a str>,
}

#[derive(Debug, Clone)]
pub struct UpsertedIdentity {
    pub source_identity_id: String,
    pub person_id: String,
}

/// Treat empty strings as absent so callers can pass thin "" fields without
/// accidentally creating identities keyed on empty upstream values.
fn non_empty(value: Option<&str>) -> Option<&str> {
    value.and_then(|s| if s.is_empty() { None } else { Some(s) })
}

/// Find an existing source identity by the first matching upstream key.
fn find_existing(
    conn: &Connection,
    source_system_id: &str,
    source_kind: &str,
    upstream_account_id: Option<&str>,
    upstream_name: Option<&str>,
    upstream_key: Option<&str>,
) -> Result<Option<(String, String)>> {
    let candidates: [(&str, Option<&str>); 3] = [
        ("upstream_account_id", upstream_account_id),
        ("upstream_name", upstream_name),
        ("upstream_key", upstream_key),
    ];

    for (column, value) in candidates {
        let Some(v) = value else { continue };
        let sql = format!(
            "SELECT id, person_id FROM source_identities
              WHERE source_system_id = ?1 AND source_kind = ?2 AND {column} = ?3"
        );
        let row: Option<(String, String)> = conn
            .query_row(&sql, params![source_system_id, source_kind, v], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .map(Some)
            .or_else(|e| match e {
                Error::QueryReturnedNoRows => Ok(None),
                other => Err(other),
            })?;
        if row.is_some() {
            return Ok(row);
        }
    }
    Ok(None)
}

/// Upsert a source identity (and the backing canonical person if missing).
///
/// Returns the (source_identity_id, person_id) pair. Idempotent: running this
/// twice with the same input does not create duplicate rows.
pub fn upsert_source_identity(
    conn: &Connection,
    now_utc: &str,
    input: &SourceIdentityInput<'_>,
) -> Result<UpsertedIdentity> {
    let upstream_account_id = non_empty(input.upstream_account_id);
    let upstream_name = non_empty(input.upstream_name);
    let upstream_key = non_empty(input.upstream_key);
    let username = non_empty(input.username);
    let email = non_empty(input.email);
    let display_name = non_empty(input.display_name);
    let avatar_url = non_empty(input.avatar_url);
    let raw_json = non_empty(input.raw_json);

    // Require at least one stable identifier to avoid inventing identity data.
    if upstream_account_id.is_none()
        && upstream_name.is_none()
        && upstream_key.is_none()
        && display_name.is_none()
    {
        return Err(Error::InvalidQuery);
    }

    // Canonical display name preference: explicit display_name > username > upstream_name.
    let canonical_display = display_name.or(username).or(upstream_name);

    if let Some((source_identity_id, person_id)) = find_existing(
        conn,
        input.source_system_id,
        input.source_kind,
        upstream_account_id,
        upstream_name,
        upstream_key,
    )? {
        // Update non-empty fields on the existing identity. COALESCE keeps the
        // existing column when the new value is NULL.
        conn.execute(
            "UPDATE source_identities SET
                upstream_account_id = COALESCE(?1, upstream_account_id),
                upstream_name = COALESCE(?2, upstream_name),
                upstream_key = COALESCE(?3, upstream_key),
                username = COALESCE(?4, username),
                email = COALESCE(?5, email),
                display_name = COALESCE(?6, display_name),
                avatar_url = COALESCE(?7, avatar_url),
                raw_json = COALESCE(?8, raw_json),
                updated_at = ?9
              WHERE id = ?10",
            params![
                upstream_account_id,
                upstream_name,
                upstream_key,
                username,
                email,
                canonical_display,
                avatar_url,
                raw_json,
                now_utc,
                source_identity_id,
            ],
        )?;

        // Also refresh the canonical person's display_name / primary_email if missing.
        conn.execute(
            "UPDATE people SET
                display_name = COALESCE(display_name, ?1),
                primary_email = COALESCE(primary_email, ?2),
                updated_at = ?3
              WHERE id = ?4",
            params![canonical_display, email, now_utc, person_id],
        )?;

        return Ok(UpsertedIdentity {
            source_identity_id,
            person_id,
        });
    }

    // Primary id used for stable id derivation: first present upstream key,
    // falling back to a synthesised `anon:<display>` token so we never key on
    // empty strings.
    let primary_owned: String;
    let primary_upstream = match (upstream_account_id, upstream_name, upstream_key) {
        (Some(v), _, _) => v,
        (_, Some(v), _) => v,
        (_, _, Some(v)) => v,
        _ => {
            // display_name presence already validated above.
            primary_owned = format!("anon:{}", display_name.unwrap_or("unknown"));
            primary_owned.as_str()
        }
    };

    let person_id = stable_id(
        "p",
        &[input.source_system_id, input.source_kind, primary_upstream],
    );
    let source_identity_id = stable_id(
        "si",
        &[input.source_system_id, input.source_kind, primary_upstream],
    );

    // Insert the canonical person first (REFERENCES people(id) on source_identities).
    conn.execute(
        "INSERT INTO people (id, display_name, primary_email, created_at, updated_at)
              VALUES (?1, ?2, ?3, ?4, ?4)
         ON CONFLICT(id) DO UPDATE SET
             display_name = COALESCE(people.display_name, excluded.display_name),
             primary_email = COALESCE(people.primary_email, excluded.primary_email),
             updated_at = excluded.updated_at",
        params![person_id, canonical_display, email, now_utc],
    )?;

    conn.execute(
        "INSERT INTO source_identities (
            id, person_id, source_system_id, source_kind,
            upstream_account_id, upstream_name, upstream_key,
            username, email, display_name, avatar_url, raw_json,
            created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)",
        params![
            source_identity_id,
            person_id,
            input.source_system_id,
            input.source_kind,
            upstream_account_id,
            upstream_name,
            upstream_key,
            username,
            email,
            canonical_display,
            avatar_url,
            raw_json,
            now_utc,
        ],
    )?;

    Ok(UpsertedIdentity {
        source_identity_id,
        person_id,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::issues::repository::{upsert_source_system, SourceSystemInput};

    const NOW: &str = "2026-05-25T17:00:00Z";

    fn seed_source_system(conn: &Connection, id: &str) {
        upsert_source_system(
            conn,
            NOW,
            &SourceSystemInput {
                id,
                kind: "jira",
                deployment_kind: Some("cloud"),
                display_name: "Test Jira",
                base_url: Some("https://jira.example.com"),
                config_source_id: Some("primary"),
            },
        )
        .expect("seed source_system");
    }

    #[test]
    fn upserts_jira_source_identity_and_person_once() {
        let conn = open_in_memory().expect("db");
        seed_source_system(&conn, "src-1");

        let input = SourceIdentityInput {
            source_system_id: "src-1",
            source_kind: "jira",
            upstream_account_id: Some("acct-123"),
            upstream_name: Some("alice.atlassian"),
            upstream_key: None,
            username: Some("alice"),
            email: Some("alice@example.com"),
            display_name: Some("Alice Anderson"),
            avatar_url: None,
            raw_json: Some("{}"),
        };

        let first = upsert_source_identity(&conn, NOW, &input).expect("first upsert");
        let second = upsert_source_identity(&conn, NOW, &input).expect("second upsert");
        assert_eq!(first.source_identity_id, second.source_identity_id);
        assert_eq!(first.person_id, second.person_id);

        let identity_count: i64 = conn
            .query_row("SELECT count(*) FROM source_identities", [], |r| r.get(0))
            .expect("identity count");
        let people_count: i64 = conn
            .query_row("SELECT count(*) FROM people", [], |r| r.get(0))
            .expect("people count");
        assert_eq!(identity_count, 1, "single identity row");
        assert_eq!(people_count, 1, "single person row");
    }

    #[test]
    fn different_upstream_account_ids_create_distinct_identities() {
        let conn = open_in_memory().expect("db");
        seed_source_system(&conn, "src-1");

        let a = SourceIdentityInput {
            source_system_id: "src-1",
            source_kind: "jira",
            upstream_account_id: Some("acct-A"),
            upstream_name: Some("alice"),
            upstream_key: None,
            username: None,
            email: None,
            display_name: Some("Alice"),
            avatar_url: None,
            raw_json: None,
        };
        let b = SourceIdentityInput {
            source_system_id: "src-1",
            source_kind: "jira",
            upstream_account_id: Some("acct-B"),
            upstream_name: Some("bob"),
            upstream_key: None,
            username: None,
            email: None,
            display_name: Some("Bob"),
            avatar_url: None,
            raw_json: None,
        };
        upsert_source_identity(&conn, NOW, &a).expect("a");
        upsert_source_identity(&conn, NOW, &b).expect("b");

        let identity_count: i64 = conn
            .query_row("SELECT count(*) FROM source_identities", [], |r| r.get(0))
            .expect("identity count");
        let people_count: i64 = conn
            .query_row("SELECT count(*) FROM people", [], |r| r.get(0))
            .expect("people count");
        assert_eq!(identity_count, 2);
        assert_eq!(people_count, 2);
    }

    #[test]
    fn errors_when_no_identifiers_provided() {
        let conn = open_in_memory().expect("db");
        seed_source_system(&conn, "src-1");

        let input = SourceIdentityInput {
            source_system_id: "src-1",
            source_kind: "jira",
            upstream_account_id: None,
            upstream_name: None,
            upstream_key: None,
            username: None,
            email: None,
            display_name: None,
            avatar_url: None,
            raw_json: None,
        };

        let err = upsert_source_identity(&conn, NOW, &input)
            .expect_err("must error when all identifiers are absent");
        assert!(
            matches!(err, Error::InvalidQuery),
            "expected InvalidQuery, got: {err}"
        );
    }
}
