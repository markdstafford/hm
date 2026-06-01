use crate::settings::error::SettingsError;

pub fn validate_key(key: &str) -> Result<(), SettingsError> {
    if key.is_empty() || key.len() > 128 {
        return Err(SettingsError::InvalidKey(
            "key must be 1-128 characters".into(),
        ));
    }
    let valid = key
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-');
    if !valid {
        return Err(SettingsError::InvalidKey(
            "key may only contain ASCII letters, digits, '.', '_', and '-'".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_alphanumeric_with_separators() {
        assert!(validate_key("github.token").is_ok());
        assert!(validate_key("ai_provider-key").is_ok());
        assert!(validate_key("a").is_ok());
        assert!(validate_key(&"a".repeat(128)).is_ok());
    }

    #[test]
    fn rejects_empty_key() {
        assert!(validate_key("").is_err());
    }

    #[test]
    fn rejects_overlong_key() {
        assert!(validate_key(&"a".repeat(129)).is_err());
    }

    #[test]
    fn rejects_whitespace() {
        assert!(validate_key("has space").is_err());
        assert!(validate_key("tab\there").is_err());
    }

    #[test]
    fn rejects_path_separators() {
        assert!(validate_key("path/sep").is_err());
        assert!(validate_key("path\\sep").is_err());
    }

    #[test]
    fn rejects_non_ascii() {
        assert!(validate_key("café").is_err());
        assert!(validate_key("日本語").is_err());
    }

    #[test]
    fn rejects_control_characters() {
        assert!(validate_key("null\0byte").is_err());
        assert!(validate_key("new\nline").is_err());
    }
}
