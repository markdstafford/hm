//! Deterministic id and content-hash helpers for ingestion.
//!
//! `stable_id` produces `{prefix}_{hash:016x}` from a set of parts joined by
//! a unit-separator (`\u{1f}`). Hashes use FNV-1a (64-bit), which is fixed
//! across Rust versions and platforms — so ids and content hashes written by
//! one binary remain valid after future upgrades.
//!
//! The test-vector locks below assert specific hex outputs for known inputs.
//! Do NOT update them casually: changing the algorithm or constants would
//! break every persisted `stable_id` / `content_hash` value in the database.

const FNV_OFFSET_BASIS: u64 = 0xcbf29ce484222325;
const FNV_PRIME: u64 = 0x100000001b3;
const UNIT_SEPARATOR: u8 = 0x1f;

fn fnv1a_64(bytes: &[u8]) -> u64 {
    let mut hash = FNV_OFFSET_BASIS;
    for &b in bytes {
        hash ^= u64::from(b);
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    hash
}

/// Compute a deterministic id of the form `{prefix}_{hash:016x}` from the
/// supplied parts, joined by unit-separator bytes (`0x1f`).
pub fn stable_id(prefix: &str, parts: &[&str]) -> String {
    let mut buf: Vec<u8> = Vec::new();
    for (idx, part) in parts.iter().enumerate() {
        if idx > 0 {
            buf.push(UNIT_SEPARATOR);
        }
        buf.extend_from_slice(part.as_bytes());
    }
    let hash = fnv1a_64(&buf);
    format!("{prefix}_{hash:016x}")
}

/// Compute a deterministic content hash for a string. Equal strings produce
/// equal hashes; different strings produce different hashes.
pub fn content_hash(value: &str) -> String {
    let hash = fnv1a_64(value.as_bytes());
    format!("{hash:016x}")
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

    /// These vectors lock the algorithm + constants + byte layout. If you find
    /// yourself updating them, you are also breaking every persisted id /
    /// content hash in user databases — open an ADR first.
    #[test]
    fn stable_id_vectors_are_locked_across_releases() {
        assert_eq!(
            stable_id("wi", &["srcsys_1", "jira_issue", "10001"]),
            "wi_c1278496af3abf10"
        );
        assert_eq!(
            stable_id("c", &["srcsys_1", "jira", "1001"]),
            "c_e02e9dff667bedba"
        );
        assert_eq!(content_hash(""), "cbf29ce484222325");
        assert_eq!(content_hash("hello world"), "779a65e7023cd2e7");
    }
}
