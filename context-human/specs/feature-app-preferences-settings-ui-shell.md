---
created: 2026-05-22
last_updated: 2026-05-22
status: complete
issue: 5
specced_by: markdstafford
implemented_by: markdstafford
superseded_by: null
---

# App preferences and settings UI shell

## What

`hm` needs its first user-facing settings surface. This feature adds a Linear-style settings panel with sidebar navigation and a General tab for local app preferences. The General tab covers theme mode, UI font, monospace font, and window state persistence.

The settings panel uses the preferences primitive from issue #4. It reads preferences through `preferences_read` at app start and writes changes through `preferences_write`. Changes apply immediately without a save button.

This work replaces the current temporary theme toggle with a persisted preference model and establishes the UI shell that later settings sections can extend.

## Why

The current app has a temporary front page and an in-memory theme toggle. That proves the theme tokens work but does not give users a stable place to configure the app or exercise the preferences primitive in a real user flow.

Theme, font, and window state are local user preferences under ADR-008. They should live in the OS config file, not in SQLite. Adding this panel now validates the settings split before more complex settings screens arrive and sets the interaction pattern for settings in `hm`: fast keyboard access, a stable sidebar, live preview, no remote calls, and no secret values in the preference file.

## Personas

- **Tarek: Team member** — wants `hm` to feel comfortable during long work sessions. He chooses dark mode, keeps the default UI font, and expects those choices to survive restarts.
- **Elena: EM** — moves quickly through keyboard-first tools. She needs settings to open predictably, avoid modal clutter, and not interrupt her flow.
- **Priya: PM** — presents and reviews roadmap views in different lighting conditions. She needs a simple theme selector and readable typography.
- **Future settings implementer** — adds later settings sections. They need a shell with navigation, state handling, and tests they can extend without inventing a second pattern.

## Narratives

### Tarek switches to dark mode

Tarek opens `hm` in the morning and sees the default view following his system appearance. He opens settings, lands on General, and changes Theme from System to Dark. The app shifts to the dark Catppuccin Macchiato theme immediately.

He closes the panel and continues working. Later, he quits and reopens `hm`. The app still uses dark mode because the choice was written through `preferences_write` and loaded during startup.

### Elena checks settings without losing context

Elena is preparing a weekly status report and wants to confirm the app uses the compact font settings she prefers. She opens settings from the app chrome. The panel cross-fades in, keeps the rest of the app visually stable, and focuses the settings title.

She reviews General, changes nothing, and closes the panel with Escape. Focus returns to the element that opened settings. Her current work remains in place.

### A future feature adds AI provider settings

A developer starts adding an AI Provider settings section. They reuse the existing settings shell, add a sidebar item, and render a new content panel beside General. The new section stores tokens through keychain-backed secret commands and provider metadata through shared settings, while General continues to use preferences. They follow the established tests and do not need to redesign panel structure or persistence helpers.

## User stories

**Tarek switches to dark mode**

- Tarek can open a settings panel from the app UI without leaving his current work
- Tarek can navigate settings categories using a sidebar
- Tarek can choose System, Light, or Dark theme mode and see the change immediately
- Tarek can choose a UI font and see app text update immediately
- Tarek can choose a monospace font and see code text update immediately
- Tarek can quit and reopen `hm` and find his theme and font choices preserved

**Elena checks settings without losing context**

- Elena can open settings without navigating away from the current page
- Elena can close settings with Escape and have focus return to the opener
- Elena can reopen `hm` and find her window at the same size and position

**A future feature adds AI provider settings**

- Future settings implementer can add new sidebar categories without redesigning the shell
- Future settings implementer can use the existing persistence pattern for new settings sections
- Future settings implementer can follow established test patterns for new controls

## Goals

- Add a settings panel shell with sidebar navigation and content area
- Add a General tab for theme mode, UI font, monospace font, and window state
- Persist all General settings through `preferences_write` and load them at startup
- Apply theme and font changes immediately without a save button
- Support theme modes system, light, and dark where system follows `prefers-color-scheme`
- Restore persisted window size and position on next app open
- Keep the panel accessible by keyboard and screen reader
- Cover settings with Vitest, React Testing Library, and a Playwright smoke path

## Non-goals

- No source connector setup
- No AI provider configuration
- No credential editing or keychain UI
- No color palette editor beyond the three theme modes
- No settings import/export
- No remote sync of preferences
- No telemetry or remote error reporting

## Design spec

### Panel layout

```
Settings dialog/panel
├── Sidebar (fixed width ~244px)
│   └── General (selected by default)
└── Content
    ├── Header: General
    ├── Description: Local app preferences stored on this Mac
    ├── Appearance section
    │   ├── Theme mode (segmented: System / Light / Dark)
    │   ├── UI font select
    │   └── Monospace font select
    └── Window section
        └── Note: window size and position saved automatically
```

Linear-inspired: focused, minimal chrome, keyboard-first. Uses Catppuccin tokens, sapphire focus rings, 4px spacing scale. Sentence-case labels. Radix primitives for accessibility (Dialog, Select). No shadcn.

### Motion

- Open: cross-fade ~150–250ms
- Close: fade ~100–150ms
- Reduced motion: near-instant opacity changes

### Empty and error states

- Failed preference load: show defaults, keep settings usable
- Failed preference write: show small inline message, do not block close

## Tech spec

### Introduction and overview

**Prerequisites:**
- ADR-002 (Tauri) — desktop shell
- ADR-008 (settings split) — preferences in OS config file
- Issue #4 — `preferences_read` and `preferences_write` commands exist

**Goals:**
- Theme applies before user sees default flash
- Settings panel renders without blocking document viewer
- All settings testable without launching Tauri

### System design and architecture

```
┌─────────────────────────────────────────────┐
│ React                                        │
│  App.tsx → SettingsPanel.tsx                 │
│            └── GeneralSettings.tsx           │
│  preferences.ts (load/merge/validate/save)  │
│  theme.ts (resolve mode → data-theme)       │
│  windowState.ts (restore/persist via Tauri) │
└──────────────────┬──────────────────────────┘
                   │ generated bindings
┌──────────────────┴──────────────────────────┐
│ Rust (existing commands, no changes needed) │
│  preferences_read / preferences_write       │
└─────────────────────────────────────────────┘
```

### Detailed design

**Preference schema:**
```typescript
type ThemeMode = "system" | "light" | "dark";
type AppPreferences = {
  appearance?: { themeMode?: ThemeMode; uiFont?: string; monoFont?: string };
  window?: { width?: number; height?: number; x?: number; y?: number };
};
```

**Theme behavior:**
- `system` → follow `prefers-color-scheme`, listen for changes
- `light` → `data-theme="latte"`
- `dark` → `data-theme="macchiato"`

**Font behavior:**
- UI font default: `Inter Variable` with sans-serif fallbacks
- Mono font default: `Fira Code` with monospace fallbacks
- Applied via CSS custom properties

**Window state:**
- Restore from preferences at startup inside Tauri guard
- Persist on resize/move (debounced) or at close
- Clamp to reasonable minimums; ignore off-screen positions

### Security, privacy, and compliance

- Preferences contain only appearance and window fields
- No credentials, tokens, or source-system data in preferences
- No telemetry or remote calls

### Testing plan

- Vitest: preference helpers, theme resolution, settings panel rendering, control interactions, accessibility (axe)
- Mocked bindings in component tests (no real Tauri IPC)
- Playwright: open settings → change theme → close → reopen → verify persistence
- Existing app tests updated to remove temporary toggle assertions

### Risks

- Window position across monitor changes — mitigated by clamping/ignoring invalid positions
- Brief theme flash on startup — mitigated by early theme application before render
- Debounced window writes may lose final position on crash — acceptable for v1

## Task list

- [x] **Story: Preference model and app startup**
  - [x] **Task: Define typed app preference helpers**
    - **Description**: Add typed frontend preference model with defaults, normalization, and merge helpers.
    - **Acceptance criteria**:
      - [x] ThemeMode supports system, light, dark
      - [x] Defaults are system, Inter Variable, Fira Code
      - [x] Missing/invalid values normalize to defaults
      - [x] Merge helpers update nested fields without erasing siblings
      - [x] Unit tests cover defaults, invalid values, and merge
    - **Dependencies**: None
  - [x] **Task: Load preferences at app startup**
    - **Description**: Call `preferencesRead` during startup and hydrate app state before rendering.
    - **Acceptance criteria**:
      - [x] Startup uses saved preferences when available
      - [x] Falls back to defaults when Tauri unavailable or command errors
      - [x] Existing appStatus behavior intact
      - [x] Component tests mock bindings
    - **Dependencies**: Preference helpers

- [x] **Story: Theme and font live preview**
  - [x] **Task: Replace temporary theme toggle with persisted theme mode**
    - **Description**: Replace in-memory toggle with preference-driven theme resolution.
    - **Acceptance criteria**:
      - [x] System follows prefers-color-scheme
      - [x] Light sets data-theme="latte"
      - [x] Dark sets data-theme="macchiato"
      - [x] OS preference changes update app in system mode
      - [x] Old temporary toggle removed
      - [x] Tests cover theme resolution
    - **Dependencies**: Preference helpers, startup loading
  - [x] **Task: Apply UI and monospace font preferences**
    - **Description**: Add CSS variable support for font preferences.
    - **Acceptance criteria**:
      - [x] UI font preference updates standard text
      - [x] Mono font preference updates monospace text
      - [x] Missing fonts fall back through default stacks
      - [x] Tests verify root style changes
    - **Dependencies**: Preference helpers
  - [x] **Task: Persist live preference changes**
    - **Description**: Wire preference updates to `preferencesWrite` with safe merging.
    - **Acceptance criteria**:
      - [x] Theme/font changes call preferencesWrite
      - [x] Writes preserve unrelated preference fields
      - [x] Write failures leave UI usable with visible error
      - [x] Tests cover successful writes and error responses
    - **Dependencies**: Theme task, font task, startup task

- [x] **Story: Settings panel shell and General tab**
  - [x] **Task: Add settings entry point and panel shell**
    - **Description**: Add settings opener and accessible panel with sidebar navigation and close behavior.
    - **Acceptance criteria**:
      - [x] Settings opens from app UI
      - [x] Panel has accessible name
      - [x] General selected by default
      - [x] Sidebar and content region present
      - [x] Closes via visible control and Escape
      - [x] Focus managed on open/close
      - [x] Cross-fade respects reduced-motion
    - **Dependencies**: Startup loading
  - [x] **Task: Implement General settings controls**
    - **Description**: Add theme mode, UI font, and monospace font controls in General tab.
    - **Acceptance criteria**:
      - [x] Theme mode exposes System, Light, Dark
      - [x] Font controls show current values
      - [x] Controls update live preview and persist
      - [x] Labels are sentence-case and clear
    - **Dependencies**: Theme task, font task, persist task, panel shell
  - [x] **Task: Add accessibility coverage**
    - **Description**: Component tests for keyboard and accessibility behavior.
    - **Acceptance criteria**:
      - [x] Tests cover open/close, control changes, focus return
      - [x] Axe runs on settings-open state
      - [x] Existing App tests updated for new UI
    - **Dependencies**: Panel shell, General controls

- [x] **Story: Window state persistence**
  - [x] **Task: Restore saved window state**
    - **Description**: Apply saved window size and position from preferences at startup.
    - **Acceptance criteria**:
      - [x] Valid saved dimensions applied
      - [x] Invalid/off-screen positions ignored or clamped
      - [x] Non-Tauri environments skip safely
      - [x] Validation helpers tested independently
    - **Dependencies**: Startup loading
  - [x] **Task: Persist window state changes**
    - **Description**: Capture window changes and write to preferences with debouncing.
    - **Acceptance criteria**:
      - [x] Resize/close saves dimensions
      - [x] Move/close saves position
      - [x] Writes debounced
      - [x] Merges with existing preferences
      - [x] Listeners cleaned up on unmount
    - **Dependencies**: Preference helpers, window restore

- [x] **Story: End-to-end validation**
  - [x] **Task: Add e2e smoke coverage**
    - **Description**: Playwright test for settings persistence path.
    - **Acceptance criteria**:
      - [x] Opens settings, changes theme, closes, reopens, verifies persistence
      - [x] Uses isolated preferences location or documents why not
    - **Dependencies**: General controls, window state
  - [x] **Task: Update agent context and run validation**
    - **Description**: Document settings UI in agent context and run all checks.
    - **Acceptance criteria**:
      - [x] code-map.md documents settings UI modules
      - [x] testing.md documents new tests
      - [x] npm test, npm run lint, npm run build pass
      - [x] cargo test passes if bindings changed
    - **Dependencies**: All tasks
