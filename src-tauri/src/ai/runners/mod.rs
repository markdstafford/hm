use crate::ai::errors::AiError;
use crate::ai::resolver::ResolvedAiProvider;
use crate::ai::service::{AiRequest, AiResponse};

pub mod anthropic_messages;
pub mod openai_chat_completions;
pub mod openai_embeddings;

pub trait AiRunnerClient: Send + Sync {
    fn run(&self, resolved: &ResolvedAiProvider, request: AiRequest)
        -> Result<AiResponse, AiError>;
}

pub struct DirectApiRunner;

impl AiRunnerClient for DirectApiRunner {
    fn run(
        &self,
        resolved: &ResolvedAiProvider,
        request: AiRequest,
    ) -> Result<AiResponse, AiError> {
        match (&resolved.profile.runner, &resolved.profile.execution_mode) {
            (
                crate::ai::config::AiRunner::AnthropicMessages,
                crate::ai::config::AiExecutionMode::DirectApi,
            ) => anthropic_messages::AnthropicMessagesRunner::default().run(resolved, request),
            (
                crate::ai::config::AiRunner::OpenAiChatCompletions,
                crate::ai::config::AiExecutionMode::DirectApi,
            ) => openai_chat_completions::OpenAiChatCompletionsRunner::default()
                .run(resolved, request),
            (crate::ai::config::AiRunner::OpenAiEmbeddings, _) => Err(AiError::InvalidConfig(
                "OpenAiEmbeddings runner is not yet implemented in DirectApiRunner".into(),
            )),
        }
    }
}

#[cfg(test)]
pub struct FakeRunner {
    text: String,
}

#[cfg(test)]
impl FakeRunner {
    pub fn new(text: &str) -> Self {
        Self { text: text.into() }
    }
}

#[cfg(test)]
impl AiRunnerClient for FakeRunner {
    fn run(
        &self,
        resolved: &ResolvedAiProvider,
        _request: AiRequest,
    ) -> Result<AiResponse, AiError> {
        Ok(AiResponse {
            text: self.text.clone(),
            model: resolved.profile.model.clone(),
            profile: resolved.profile.name.clone(),
            runner: resolved.profile.runner.clone(),
            execution_mode: resolved.profile.execution_mode.clone(),
            usage: None,
        })
    }
}
