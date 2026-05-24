use crate::ai::errors::AiError;
use crate::ai::resolver::ResolvedAiProvider;
use crate::ai::service::{AiRequest, AiResponse};

pub trait AiRunnerClient: Send + Sync {
    fn run(&self, resolved: &ResolvedAiProvider, request: AiRequest) -> Result<AiResponse, AiError>;
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
    fn run(&self, resolved: &ResolvedAiProvider, _request: AiRequest) -> Result<AiResponse, AiError> {
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
