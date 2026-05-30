use crate::commands::JsonValue;
use crate::embeddings::repository::ClaimedDocument;

pub const DEFAULT_MAX_INPUTS_PER_REQUEST: usize = 96;
pub const DEFAULT_MAX_ESTIMATED_TOKENS_PER_REQUEST: usize = 8_000;
pub const DEFAULT_MAX_BATCHES_PER_RUN: usize = 50;
pub const DEFAULT_RATE_LIMIT_BACKOFF_SECONDS: u64 = 60;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmbeddingBatchLimits {
    pub max_inputs_per_request: usize,
    pub max_estimated_tokens_per_request: usize,
    pub max_batches_per_run: usize,
    pub rate_limit_backoff_seconds: u64,
}

impl Default for EmbeddingBatchLimits {
    fn default() -> Self {
        Self {
            max_inputs_per_request: DEFAULT_MAX_INPUTS_PER_REQUEST,
            max_estimated_tokens_per_request: DEFAULT_MAX_ESTIMATED_TOKENS_PER_REQUEST,
            max_batches_per_run: DEFAULT_MAX_BATCHES_PER_RUN,
            rate_limit_backoff_seconds: DEFAULT_RATE_LIMIT_BACKOFF_SECONDS,
        }
    }
}

pub struct TextBatch {
    pub docs: Vec<ClaimedDocument>,
    pub texts: Vec<String>,
}

pub fn estimated_tokens(text: &str) -> usize {
    ((text.chars().count() + 3) / 4).max(1)
}

fn setting_usize(settings: &JsonValue, key: &str) -> Option<usize> {
    settings.0.get(key).and_then(|v| v.as_u64()).map(|v| v as usize)
}

fn setting_u64(settings: &JsonValue, key: &str) -> Option<u64> {
    settings.0.get(key).and_then(|v| v.as_u64())
}

pub fn limits_from_settings(settings: &JsonValue) -> EmbeddingBatchLimits {
    let defaults = EmbeddingBatchLimits::default();
    EmbeddingBatchLimits {
        max_inputs_per_request: setting_usize(settings, "max_inputs_per_request")
            .unwrap_or(defaults.max_inputs_per_request)
            .clamp(1, DEFAULT_MAX_INPUTS_PER_REQUEST),
        max_estimated_tokens_per_request: setting_usize(settings, "max_estimated_tokens_per_request")
            .unwrap_or(defaults.max_estimated_tokens_per_request)
            .max(1),
        max_batches_per_run: setting_usize(settings, "max_batches_per_run")
            .unwrap_or(defaults.max_batches_per_run)
            .max(1),
        rate_limit_backoff_seconds: setting_u64(settings, "rate_limit_backoff_seconds")
            .unwrap_or(defaults.rate_limit_backoff_seconds)
            .max(DEFAULT_RATE_LIMIT_BACKOFF_SECONDS),
    }
}

pub fn split_claimed_documents(
    docs: Vec<ClaimedDocument>,
    texts: Vec<String>,
    limits: &EmbeddingBatchLimits,
) -> Vec<TextBatch> {
    let mut batches = Vec::new();
    let mut current_docs = Vec::new();
    let mut current_texts = Vec::new();
    let mut current_tokens = 0usize;

    for (doc, text) in docs.into_iter().zip(texts.into_iter()) {
        let text_tokens = estimated_tokens(&text);
        let would_exceed_count = current_texts.len() >= limits.max_inputs_per_request;
        let would_exceed_tokens =
            !current_texts.is_empty()
                && current_tokens + text_tokens > limits.max_estimated_tokens_per_request;
        if would_exceed_count || would_exceed_tokens {
            batches.push(TextBatch {
                docs: std::mem::take(&mut current_docs),
                texts: std::mem::take(&mut current_texts),
            });
            current_tokens = 0;
        }
        current_tokens += text_tokens;
        current_docs.push(doc);
        current_texts.push(text);
    }

    if !current_texts.is_empty() {
        batches.push(TextBatch { docs: current_docs, texts: current_texts });
    }

    batches
}

#[cfg(test)]
mod tests {
    use super::*;

    fn doc(id: usize) -> ClaimedDocument {
        ClaimedDocument {
            id: format!("doc_{id}"),
            source_system_id: "srcsys_1".into(),
            entity_kind: "jira_issue".into(),
            entity_id: format!("ISSUE-{id}"),
            work_item_id: None,
            title: Some(format!("Issue {id}")),
            body: "body".into(),
            content_hash: format!("hash_{id}"),
        }
    }

    #[test]
    fn splits_200_inputs_into_grove_sized_requests() {
        let docs: Vec<ClaimedDocument> = (0..200).map(doc).collect();
        let texts: Vec<String> = (0..200).map(|i| format!("Body:\nDocument {i}")).collect();
        let limits = EmbeddingBatchLimits {
            max_inputs_per_request: 96,
            max_estimated_tokens_per_request: 8_000,
            max_batches_per_run: 50,
            rate_limit_backoff_seconds: 60,
        };
        let batches = split_claimed_documents(docs, texts, &limits);
        assert_eq!(batches.len(), 3);
        assert_eq!(batches[0].texts.len(), 96);
        assert_eq!(batches[1].texts.len(), 96);
        assert_eq!(batches[2].texts.len(), 8);
    }

    #[test]
    fn splits_before_estimated_token_cap() {
        let docs: Vec<ClaimedDocument> = (0..3).map(doc).collect();
        let text = "x".repeat(20);
        let texts = vec![text.clone(), text.clone(), text];
        let limits = EmbeddingBatchLimits {
            max_inputs_per_request: 96,
            max_estimated_tokens_per_request: 10,
            max_batches_per_run: 50,
            rate_limit_backoff_seconds: 60,
        };
        let batches = split_claimed_documents(docs, texts, &limits);
        assert_eq!(batches.len(), 2);
        assert_eq!(batches[0].texts.len(), 2);
        assert_eq!(batches[1].texts.len(), 1);
    }

    #[test]
    fn reads_limits_from_profile_settings_with_safe_minimums() {
        let settings = JsonValue(serde_json::json!({
            "max_inputs_per_request": 200,
            "max_estimated_tokens_per_request": 12000,
            "max_batches_per_run": 3,
            "rate_limit_backoff_seconds": 10
        }));
        let limits = limits_from_settings(&settings);
        assert_eq!(limits.max_inputs_per_request, 96);
        assert_eq!(limits.max_estimated_tokens_per_request, 12000);
        assert_eq!(limits.max_batches_per_run, 3);
        assert_eq!(limits.rate_limit_backoff_seconds, 60);
    }
}
