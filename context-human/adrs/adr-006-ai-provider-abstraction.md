---
created: 2026-05-21
last_updated: 2026-05-21
status: accepted
decided_by: null
superseded_by: null
---

# ADR 006: AI provider abstraction

## Status

Accepted

## Context

`hm` uses AI for several tasks: rewriting thin tickets into structured triages, answering chat questions, extracting roadmap items from docs, classifying duplicates, and more. These tasks have different latency, quality, and cost profiles. The user's org may have policies about which providers can see which data.

We need an architecture for AI calls that doesn't lock `hm` to a single provider, model, or vendor API.

Constraints:

- Org policies may restrict certain providers from seeing certain data classes
- Different tasks benefit from different model tiers — cheap fast for classification, slower stronger for triage authoring
- Credentials vary by provider (API key, IAM role, OAuth, etc.)
- The provider landscape changes faster than `hm`'s release cycle
- Provider-specific features matter for some tasks (extended thinking, beta headers, etc.)

## Decision

`hm` has a configurable provider layer modeled on the `autocatalyst` pattern. Configuration declares four layers:

1. **Credentials** — one entry per credential (API key, IAM profile, etc.), with secret material loaded from env vars or the OS keychain
2. **Endpoints** — one entry per provider endpoint (named, with base URL and protocol), each pointing at a credential
3. **Profiles** — one entry per (endpoint, model, runner) combination, with model-specific settings (effort, thinking mode, etc.)
4. **Routing** — a map from task name (e.g., `issue.triage`, `chat.answer`, `intent.classify`) to a profile

Any approved provider can serve any task, subject to routing. Swapping providers is a config change, not a code change.

## Consequences

**Positive:**
- Provider changes don't require code edits
- Tasks tier naturally — classification routes to a cheap model, authoring routes to a strong one
- New providers extend the endpoints + profiles list; nothing else changes
- Org-policy constraints are expressible as routing rules
- Users familiar with `autocatalyst` recognize the pattern immediately

**Negative:**
- Adds an indirection layer; debugging a misrouted task means tracing through config
- Config schema is broader than a "one provider, hardcoded" approach
- Multiple credential types mean multiple loading paths to test and maintain

## Alternatives considered

### Option 1: Hardcoded single-provider client

Pick one AI provider in code; configure only the API key.

**Pros:**
- Simplest possible setup
- Minimal config schema

**Cons:**
- Provider lock-in
- No way to honor org data-routing policies
- A provider outage takes `hm` down
- Can't tier by task type — every task pays the same model cost

**Why not chosen:** Lock-in is unacceptable when org policies and the provider landscape both change faster than the codebase does.

### Option 2: Generic "OpenAI-compatible" client only

Use the OpenAI API spec as a lingua franca; any provider that implements it works.

**Pros:**
- Simpler than full provider abstraction
- Covers most current providers

**Cons:**
- Excludes providers whose APIs don't conform (Anthropic native, Bedrock native, etc.)
- Can't express provider-specific features cleanly (extended thinking, vendor beta headers)
- Anthropic and OpenAI native APIs diverge in ways that matter for triage-quality tasks

**Why not chosen:** Some tasks need provider-specific features, and forcing every call into a single-protocol abstraction means the lowest common denominator wins everywhere. The provider layer is exactly where we want vendor-native variation.
