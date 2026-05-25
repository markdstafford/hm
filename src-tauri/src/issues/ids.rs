//! Deterministic id and content-hash helpers for ingestion.
//!
//! `stable_id` produces a `{prefix}_{hash:016x}` string from a set of parts,
//! joined by a unit-separator (`\u{1f}`) so reordering parts changes the hash.
//! Hashes use `std::collections::hash_map::DefaultHasher`, which is
//! deterministic within a single Rust version — sufficient for ids that only
//! need stability across a single binary build (local-first app).
//!
//! `content_hash` is the same idea for arbitrary text: equal strings produce
//! equal hashes; different strings produce different hashes.

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

const UNIT_SEPARATOR: char = '\u{1f}';

/// Compute a deterministic id of the form `{prefix}_{hash:016x}` from the
/// supplied parts, joined by unit-separator characters.
pub fn stable_id(prefix: &str, parts: &[&str]) -> String {
    let mut hasher = DefaultHasher::new();
    for (idx, part) in parts.iter().enumerate() {
        if idx > 0 {
            UNIT_SEPARATOR.hash(&mut hasher);
        }
        part.hash(&mut hasher);
    }
    let hash = hasher.finish();
    format!("{prefix}_{hash:016x}")
}

/// Compute a deterministic content hash for a string. Equal strings produce
/// equal hashes; different strings produce different hashes.
pub fn content_hash(value: &str) -> String {
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stable_ids_are_deterministic_and_prefixed() {
        let a = stable_id("wi", &["src-1", "jira", "ABC-1"]);
        let b = stable_id("wi", &["src-1", "jira", "ABC-1"]);
        let c = stable_id("wi", &["src-1", "jira", "ABC-2"]);

        assert_eq!(a, b, "same prefix+parts must yield the same id");
        assert_ne!(a, c, "different last part must yield a different id");
        assert!(
            a.starts_with("wi_"),
            "id must start with the supplied prefix; got {a}"
        );
    }

    #[test]
    fn content_hash_changes_when_text_changes() {
        let a = content_hash("hello world");
        let b = content_hash("hello world");
        let c = content_hash("hello world!");

        assert_eq!(a, b, "equal strings must produce equal hashes");
        assert_ne!(a, c, "different strings must produce different hashes");
    }
}
