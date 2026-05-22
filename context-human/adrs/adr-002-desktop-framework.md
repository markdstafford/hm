---
created: 2026-05-21
last_updated: 2026-05-21
status: accepted
decided_by: null
superseded_by: null
---

# ADR 002: Desktop framework

## Status

Accepted

## Context

`hm` is a desktop application targeting macOS first, with potential expansion to web, Windows, and Linux later. The UX should feel snappy and focused (Linear-inspired). The app needs filesystem access (local git repos), external API calls, and AI inference via a configurable provider layer.

Key constraints:

- macOS-first, Apple Silicon
- Cross-platform expandability is a bonus, not a hard requirement
- UX must feel native and fast
- Single user per running instance

## Decision

`hm` uses **Tauri** (Rust core + TypeScript/React UI) as its desktop framework.

The Rust core handles filesystem access, source-system ingestion, database operations, and AI calls. The WebView frontend hosts a React/TypeScript UI. Communication happens via Tauri commands (IPC).

The same React UI code runs unchanged in a browser, giving us a cheap path to a future web client.

## Consequences

**Positive:**
- Small bundle (~10 MB) and fast startup
- Cross-platform path is the same codebase, not a rewrite
- Web reuse path: the React UI runs unchanged in a browser
- Rust core gives memory safety and good performance for ingestion and indexing
- Active community and modern toolchain

**Negative:**
- Rust learning curve for backend work
- Smaller ecosystem than Electron — fewer plugins, less Stack Overflow coverage
- WebView inconsistencies across platforms (WebKit on macOS, WebView2 on Windows, WebKit-GTK on Linux)
- Less native macOS feel than SwiftUI/AppKit; mitigable with care, but not free

## Alternatives considered

### Option 1: Native macOS (SwiftUI/AppKit)

A fully native macOS app using Apple's frameworks.

**Pros:**
- Best native UX out of the box
- Direct access to macOS-specific UI patterns
- Familiar territory if the team has built native macOS apps before

**Cons:**
- Cross-platform path means a frontend rewrite, possibly a backend rewrite too
- Swift backend is less portable than Rust
- Web reuse path is "build it again"

**Why not chosen:** The cross-platform expandability bonus weighed enough to favor a framework whose UI code is portable from day one. Native macOS optimizes for v1 polish at the cost of v2+ flexibility.

### Option 2: Electron

Mature web-tech-on-desktop framework.

**Pros:**
- Largest community and plugin ecosystem
- Node backend uses familiar JavaScript/TypeScript
- Many production examples (VSCode, Slack, Linear itself)

**Cons:**
- Bundle size 10–20x larger than Tauri (~150–200 MB)
- Higher memory footprint
- Slower startup
- Node backend is less suited than Rust for ingestion and indexing workloads

**Why not chosen:** Bundle size and startup speed matter for a desktop tool that should feel snappy. Tauri's resource profile is meaningfully better, and the Rust backend is a better fit for `hm`'s data work.
