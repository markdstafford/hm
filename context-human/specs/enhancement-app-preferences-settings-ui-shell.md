---
type: enhancement
status: implementing
created: 2026-05-22
last_updated: 2026-05-22
source_issue: [https://github.com/markdstafford/hm/issues/5](https://github.com/markdstafford/hm/issues/5)
related_specs:
	- [feature-settings-storage-primitives.md](http://feature-settings-storage-primitives.md)
related_adrs:
	- ../adrs/[adr-002-desktop-framework.md](http://adr-002-desktop-framework.md)
	- ../adrs/[adr-003-local-first-architecture.md](http://adr-003-local-first-architecture.md)
	- ../adrs/[adr-008-settings-split.md](http://adr-008-settings-split.md)
---
# Enhancement: App preferences and settings UI shell

## What

`hm` needs its first user-facing settings surface. This enhancement adds a Linear-style settings panel with sidebar navigation and a General tab for local app preferences. The General tab covers theme mode, UI font, monospace font, and window state.
The settings panel uses the existing preferences primitive from issue #4. It reads preferences through `preferences_read` at app start and writes changes through `preferences_write`. Changes apply immediately without a save button.
This work replaces the current temporary theme toggle with a persisted preference model. It also establishes the UI shell that later settings sections, such as source configuration and AI provider configuration, can extend.
## Why

The current app has a temporary front page and an in-memory theme toggle. That proves the theme tokens work, but it does not give users a stable place to configure the app. It also does not exercise the preferences primitive in a real user flow.
Theme, font, and window state are local user preferences under ADR-008. They should live in the OS config file, not in SQLite and not in shared settings. Adding this panel now validates that split before more complex settings screens arrive.
This enhancement also sets the interaction pattern for settings in `hm`: fast keyboard access, a stable sidebar, live preview, no remote calls, and no secret values in the preference file.
## Goals

- Add a settings panel shell with sidebar navigation and a content area.
- Add a General settings tab for theme mode, UI font, monospace font, and window state.
- Persist all General settings through `preferences_write` and load them through `preferences_read`.
- Apply theme and font changes immediately with no save button.
- Support theme modes `system`, `light`, and `dark`, where `system` follows `prefers-color-scheme`.
- Restore persisted window size and position on the next app open when the Tauri window API allows it.
- Keep the panel accessible by keyboard and screen reader.
- Cover the settings panel with Vitest and React Testing Library.
- Add an end-to-end smoke path for open settings, change theme, close, reopen, and verify persistence.
- Preserve the local-first, single-user settings posture from ADR-008.
## Non-goals

- No source connector setup.
- No AI provider configuration.
- No credential editing or keychain UI.
- No shared settings editor.
- No color palette editor beyond light, dark, and system theme mode.
- No settings import/export tool.
- No remote sync of preferences.
- No app authentication, telemetry, or remote error reporting.
- No broad redesign of the main app shell beyond what is needed to open and test settings.
## Personas

- **Tarek, team member** — wants `hm` to feel comfortable during long work sessions. He chooses dark mode, keeps the default UI font, and expects those choices to survive restarts.
- **Elena, EM** — moves quickly through keyboard-first tools. She needs settings to open predictably, avoid modal clutter, and not interrupt her status-reporting flow.
- **Priya, PM** — presents and reviews roadmap views in different lighting conditions. She needs a simple theme selector and readable typography without knowing where preferences are stored.
- **Future settings implementer** — adds later settings sections. They need a shell with navigation, state handling, validation, and tests that they can extend without inventing a second pattern.
## Narratives

### Tarek switches to dark mode

Tarek opens `hm` in the morning and sees the default view following his system appearance. He opens settings, lands on General, and changes Theme from System to Dark. The app changes to the dark Catppuccin Macchiato theme immediately.
He closes the panel and continues working. Later, he quits and reopens `hm`. The app still uses dark mode because the choice was written through `preferences_write` and loaded during startup.
### Elena checks settings without losing context

Elena is preparing a weekly status report and wants to confirm the app is using the compact font settings she prefers. She opens settings from the app chrome or keyboard shortcut. The panel cross-fades in, keeps the rest of the app visually stable, and focuses the settings title or first control.
She reviews General, changes nothing, and closes the panel with Escape. Focus returns to the element that opened settings. Her current work remains in place.
### A future feature adds AI provider settings

A developer starts adding an AI Provider settings section. They reuse the existing settings shell, add a sidebar item, and render a new content panel beside General. The new section stores tokens through keychain-backed secret commands and provider metadata through shared settings, while General continues to use preferences.
They follow the established tests: component coverage for sidebar navigation and command calls, plus an e2e smoke path for the critical UI flow. They do not need to redesign panel structure or persistence helpers.
## User stories

### Story 1: Open and navigate the settings panel

As a user, I want to open a settings panel with clear categories so that I can find app preferences without leaving my current work.
Acceptance criteria:
- The app exposes a visible settings entry point in the current UI shell.
- The panel opens without navigating away from the current app route or replacing the page.
- The panel has a sidebar category list and a content area.
- General is the default selected category.
- The panel supports close by visible control and Escape.
- Focus moves into the panel when it opens and returns to the opener when it closes.
- Entry and exit use a short cross-fade close to 250ms, honoring reduced-motion preferences.
### Story 2: Choose theme mode

As a user, I want to choose System, Light, or Dark theme mode so that `hm` matches my working environment.
Acceptance criteria:
- General includes a theme mode control with `system`, `light`, and `dark` options.
- `system` follows `window.matchMedia("(prefers-color-scheme: dark)")`.
- `light` applies Catppuccin Latte regardless of system preference.
- `dark` applies Catppuccin Macchiato regardless of system preference.
- Changing theme mode updates the app immediately.
- Changing theme mode persists through `preferences_write`.
- App startup reads the saved theme mode through `preferences_read` before or during initial render and applies it consistently.
- Invalid or missing theme values fall back to `system` without crashing.
### Story 3: Choose UI and monospace fonts

As a user, I want to choose UI and monospace fonts so that text in `hm` remains readable for me.
Acceptance criteria:
- General includes a UI font control with `Inter Variable` as the default.
- General includes a monospace font control with `Fira Code` as the default.
- Font controls can offer a small curated list first, with custom font entry deferred unless implementation finds it simple and safe.
- Changing either font updates relevant CSS custom properties immediately.
- Font choices persist through `preferences_write`.
- App startup reads saved font choices through `preferences_read` and applies them.
- Missing or unavailable font values fall back to the defaults and system fallback stacks.
### Story 4: Persist window state

As a user, I want `hm` to reopen at my previous size and position so that it fits my workspace.
Acceptance criteria:
- The app records main window width, height, x, and y values when the Tauri window moves or resizes, or at a safe lifecycle point before close.
- Window state persists through the same preferences object used by General settings.
- On startup, the app restores valid saved size and position before or shortly after the main window appears.
- Saved dimensions are clamped to reasonable minimums so the app cannot reopen unusably small.
- Saved positions that are off-screen or invalid are ignored or clamped so the app remains visible.
- If the Tauri window APIs are unavailable in web or test environments, the code degrades safely without errors.
### Story 5: Test the settings flow

As a maintainer, I want component and e2e coverage for settings so that preference persistence does not regress.
Acceptance criteria:
- Vitest covers rendering the settings entry point, opening the panel, General tab controls, live preview state updates, command call behavior, and accessibility basics.
- Binding calls are mocked in component tests so tests run in jsdom without launching Tauri.
- Existing `App` smoke tests are updated rather than duplicated around the old temporary theme toggle.
- Playwright covers open settings, change theme, close settings, reopen or reload the app, and verify the persisted theme choice.
- Test setup avoids writing to a real user preferences file unless the e2e harness deliberately uses an isolated app data directory.
## Requirements

### Preference schema

Use a typed frontend model for known app preferences while preserving the generic JSON command boundary from issue #4.
Recommended shape:
```typescript
type ThemeMode = "system" | "light" | "dark";

type AppPreferences = {
  appearance?: {
    themeMode?: ThemeMode;
    uiFont?: string;
    monoFont?: string;
  };
  window?: {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
  };
};
```
Rules:
- Missing preferences are valid and use defaults.
- Unknown preference keys are preserved when writing updates, unless implementation finds the existing primitive cannot safely merge objects.
- Known fields are validated or normalized before use.
- Invalid known fields fall back to defaults and should not crash startup.
- Preference writes must not include credentials, source-system tokens, API keys, or data-relevant source configuration.
### Persistence behavior

- Load preferences once at app start through `commands.preferencesRead()` when running under Tauri.
- Use safe defaults when running outside Tauri, when the preferences file is missing, or when the command returns a safe error.
- Write only after user-initiated changes or debounced window-state updates.
- Avoid writing repeatedly during every render.
- Use a merge/update helper so changing theme does not erase font or window settings.
- Surface preference save failures in a small non-blocking error state or console warning during early development; do not silently lose user intent in production UI.
### Theme behavior

- Keep Catppuccin Latte as the light theme and Catppuccin Macchiato as the dark theme.
- Map `themeMode: "light"` to `data-theme="latte"`.
- Map `themeMode: "dark"` to `data-theme="macchiato"`.
- Map `themeMode: "system"` to no forced `data-theme` or to an equivalent computed mode that updates when the OS preference changes.
- Listen for `prefers-color-scheme` changes while in `system` mode.
- Ensure theme changes update the whole app, not only the settings panel.
### Font behavior

- Default UI font is `Inter Variable` with `ui-sans-serif`, `system-ui`, and `sans-serif` fallbacks.
- Default monospace font is `Fira Code` with `ui-monospace` and `monospace` fallbacks.
- Apply font preferences through CSS custom properties or Tailwind-compatible root variables.
- Do not load remote font files as part of this issue.
- If a selected font is not installed, rely on the existing fallback stack.
### Settings panel design

- Match the app spec's Linear-inspired direction: focused, minimal chrome, keyboard-first, and fast.
- Use the existing Catppuccin tokens, sapphire focus/accent color, 4px spacing scale, and control heights.
- Use a fixed-width sidebar near the app spec's 244px sidebar guidance when appropriate for the panel size.
- Use sentence-case labels.
- Keep text sizes within the existing 11 / 12 / 13 / 14 / 16 px scale.
- Use Radix primitives where they add accessibility, especially Dialog and Select.
- Do not introduce shadcn.
- Respect `prefers-reduced-motion` by disabling or shortening transitions.
### Accessibility

- The settings surface has an accessible name such as `Settings`.
- The sidebar uses semantic navigation, tabs, or a listbox pattern consistently.
- The active category is exposed to assistive technology.
- Controls have visible labels and accessible names.
- Keyboard users can open, navigate, change controls, and close settings.
- Focus rings use the sapphire focus token and meet contrast expectations.
- Initial render and settings-open state pass axe checks in component tests where practical.
### Window state

- Persist only the main app window state for this issue.
- Use Tauri v2 window APIs from `@tauri-apps/api/window` or the current checked-in equivalent.
- Debounce resize and move writes to avoid excessive filesystem writes.
- Store numeric values only after basic validation.
- Restore state only after checking that dimensions and coordinates are usable.
- In non-Tauri environments, skip window-state behavior safely.
### Security and privacy

- General preferences may include appearance and window fields only.
- Do not store API tokens, credentials, source-system identifiers, issue data, roadmap data, or provider routing metadata in preferences.
- Do not add telemetry or remote calls.
- Do not log full preference objects if future fields could become sensitive.
- Continue to route secrets through keychain commands and data-relevant settings through shared settings in future sections.
## Design spec

### Information architecture

Initial settings categories:
1. General — implemented in this enhancement.
2. Sources — placeholder or omitted until source configuration exists.
3. AI providers — placeholder or omitted until provider configuration exists.
4. Advanced — placeholder or omitted unless implementation needs a home for diagnostics.
If placeholders feel empty in the current UI, show only General in the first release while keeping the component model ready for more categories. Do not show disabled categories unless the copy explains that they are coming later.
### Panel layout

Recommended structure:
```plain text
Settings dialog or panel
├── Sidebar
│   └── General
└── Content
    ├── Header: General
    ├── Description: Local app preferences stored on this Mac
    ├── Appearance section
    │   ├── Theme mode select or segmented control
    │   ├── UI font select
    │   └── Monospace font select
    └── Window section
        └── Short note that window size and position are saved automatically
```
The panel should feel like part of the app, not a browser form. Use subtle surfaces, clear separators, compact controls, and direct labels.
### Motion

- Opening: cross-fade overlay/panel over about 150-250ms.
- Closing: fade out over about 100-150ms.
- Category changes: avoid heavy animation; a short content fade is acceptable.
- Reduced motion: remove cross-fades or reduce them to near-instant opacity changes.
### Empty and error states

- If preferences fail to load, show defaults and keep settings usable.
- If a preference write fails, show a small inline or toast-like message such as `Could not save preferences`.
- Do not block the user from closing settings after a write failure.
- Do not show raw command errors if they expose filesystem paths unexpectedly; prefer safe summaries in UI.
## Technical approach

### Frontend module layout

Recommended files:
```plain text
src/
  App.tsx
  preferences.ts
  theme.ts
  windowState.ts
  settings/
    SettingsPanel.tsx
    GeneralSettings.tsx
    settingsTypes.ts
    settingsStorage.ts
    SettingsPanel.test.tsx
```
Expected responsibilities:
- `preferences.ts` or `settings/settingsStorage.ts`: load, merge, validate, and save `AppPreferences` through generated bindings.
- `theme.ts`: resolve `ThemeMode` to effective theme and apply `data-theme`.
- `windowState.ts`: isolate Tauri window-state restore and persistence behavior.
- `SettingsPanel.tsx`: dialog/panel structure, sidebar navigation, focus handling, and close behavior.
- `GeneralSettings.tsx`: controls for theme, UI font, mono font, and save status.
The exact layout may differ if implementation keeps a smaller file set, but settings logic should not remain embedded entirely in `App.tsx`.
### App integration

- Replace the temporary theme toggle with the persisted theme setting.
- Add a settings entry point to the existing starter app UI.
- Keep `commands.appStatus()` behavior intact.
- Use generated binding wrappers from `src/bindings.ts`; do not hand-write IPC names.
- Detect Tauri availability before calling Tauri-only APIs in tests and web dev.
### Preference read/write helper

Recommended behavior:
```plain text
loadPreferences()
  if Tauri bindings are available:
    call preferencesRead()
    validate object shape
    normalize known fields
    return defaults merged with saved values
  otherwise:
    return defaults

updatePreferences(patch)
  merge patch with current preference object
  apply live preview immediately
  call preferencesWrite(nextPrefs)
  keep previous object plus visible error if write fails
```
Implementation may optimistically apply changes, but failed writes need a visible or testable error state so users are not misled.
### Window-state implementation

Use the Tauri window API only inside a guarded effect. Restore saved state after preferences load. Register resize and move listeners, debounce writes, and unregister listeners on cleanup.
If reliable resize/move events are awkward in Tauri v2, a smaller acceptable first implementation is:
- Restore window state at startup.
- Persist current state when the window is closing or when the settings panel closes.
- Document the limitation in `context-agent/wiki/code-map.md` or `context-agent/wiki/testing.md`.
### Backend changes

No new Rust storage primitive is expected. Backend changes should be limited to what is needed for safe window-state support or binding availability.
Possible Rust work:
- Add tests only if command behavior changes.
- Add a small command only if Tauri's frontend window API cannot cover needed window-state behavior.
Do not move app preferences into SQLite, shared settings, or keychain.
## Task decomposition

### Story A: Preference model and app startup

#### Task A.1: Define typed app preference helpers

Description: Add a typed frontend preference model with defaults, normalization, merge helpers, and safe handling for unknown values.
Acceptance criteria:
- `ThemeMode` supports `system`, `light`, and `dark`.
- Default preferences use `system`, `Inter Variable`, and `Fira Code`.
- Missing preferences normalize to defaults.
- Invalid known values normalize to defaults.
- Merge helpers update nested appearance and window fields without erasing unrelated known fields.
- Unit tests cover defaults, invalid values, and nested merge behavior.
Dependencies: None.
#### Task A.2: Load preferences at app startup

Description: Call `preferencesRead` during app startup under Tauri and hydrate the app preference state before applying persisted appearance.
Acceptance criteria:
- Startup uses saved preferences when `preferencesRead` returns an object.
- Startup falls back to defaults when Tauri bindings are unavailable.
- Startup falls back to defaults with a safe error state when `preferencesRead` returns an error.
- Existing `appStatus` behavior remains available.
- Component tests mock generated bindings and do not touch a real preferences file.
Dependencies: Task A.1.
### Story B: Theme and font live preview

#### Task B.1: Replace temporary theme state with persisted theme mode

Description: Replace the in-memory `latte`/`macchiato` toggle with theme mode resolution driven by preferences.
Acceptance criteria:
- `system` follows `prefers-color-scheme`.
- `light` sets `data-theme="latte"`.
- `dark` sets `data-theme="macchiato"`.
- System preference changes update the app while theme mode is `system`.
- The old temporary toggle is removed or converted into the settings entry point.
- Tests cover effective theme resolution.
Dependencies: Tasks A.1 and A.2.
#### Task B.2: Apply UI and monospace font preferences

Description: Add CSS variable support and frontend logic for applying saved UI and monospace font preferences.
Acceptance criteria:
- UI font preference updates standard UI text.
- Monospace font preference updates monospace text.
- Defaults match the app spec.
- Missing or unavailable selected fonts fall back through the default stacks.
- Tests verify the root style or class changes used to apply fonts.
Dependencies: Task A.1.
#### Task B.3: Persist live preference changes

Description: Wire preference updates to `preferencesWrite` with safe merging, minimal writes, and user-visible save failure handling.
Acceptance criteria:
- Changing theme mode calls `preferencesWrite` with the updated appearance preferences.
- Changing UI font calls `preferencesWrite` with the updated UI font.
- Changing monospace font calls `preferencesWrite` with the updated monospace font.
- Writes do not erase unrelated preference fields.
- Write failures leave the UI usable and expose a safe error message.
- Tests cover successful writes and command error responses.
Dependencies: Tasks A.2, B.1, and B.2.
### Story C: Settings panel shell and General tab

#### Task C.1: Add settings entry point and panel shell

Description: Add a visible settings opener and a Radix-backed or equivalent accessible settings panel with sidebar navigation and close behavior.
Acceptance criteria:
- A user can open settings from the app UI.
- The panel has an accessible name.
- General is selected by default.
- The panel has a sidebar and content region.
- The panel closes through a visible control and Escape.
- Focus moves into the panel on open and returns to the opener on close.
- Open and close use the required cross-fade unless reduced motion is active.
Dependencies: Task A.2.
#### Task C.2: Implement General settings controls

Description: Add controls for theme mode, UI font, and monospace font in the General tab.
Acceptance criteria:
- Theme mode control exposes System, Light, and Dark labels.
- UI font control exposes Inter Variable as the default option.
- Monospace font control exposes Fira Code as the default option.
- Controls show the currently loaded values.
- Controls update live preview and persist through the shared preference update path.
- Labels and descriptions are clear and sentence-case.
Dependencies: Tasks B.1, B.2, B.3, and C.1.
#### Task C.3: Add accessibility coverage for settings

Description: Add component tests for keyboard and accessibility behavior in the settings panel.
Acceptance criteria:
- Tests cover opening and closing settings.
- Tests cover changing each General control.
- Tests cover focus return where jsdom support allows it.
- Tests run axe on the initial app and settings-open state where practical.
- Existing `App` tests are updated to the new UI instead of asserting the removed temporary toggle.
Dependencies: Tasks C.1 and C.2.
### Story D: Window state persistence

#### Task D.1: Restore saved window state

Description: Restore saved main-window size and position from preferences when running inside Tauri.
Acceptance criteria:
- Valid saved width and height are applied to the main window.
- Valid saved x and y position are applied to the main window.
- Unusable dimensions or off-screen positions are ignored or clamped.
- Non-Tauri and jsdom environments skip restore without errors.
- Tests cover validation/clamping helpers separately from Tauri API calls.
Dependencies: Task A.2.
#### Task D.2: Persist window state changes

Description: Capture main-window size and position changes and write them to preferences without excessive filesystem writes.
Acceptance criteria:
- Resize or close lifecycle saves width and height.
- Move or close lifecycle saves x and y when available.
- Writes are debounced or limited to safe lifecycle points.
- Window-state writes merge with existing appearance preferences.
- Event listeners are cleaned up when the app unmounts.
- Any Tauri API limitations are documented in agent context.
Dependencies: Tasks A.1, A.2, and D.1.
### Story E: End-to-end validation and documentation

#### Task E.1: Add e2e smoke coverage

Description: Add a Playwright smoke test for the main settings persistence path.
Acceptance criteria:
- The test opens settings.
- The test changes theme mode.
- The test closes settings.
- The test reopens or reloads the app.
- The test verifies the persisted theme choice is still applied.
- The test uses an isolated preferences/app-data location or documents why isolation is not available yet.
Dependencies: Tasks B.3, C.2, and D.2.
#### Task E.2: Update durable agent context

Description: Document the settings UI modules, preference schema, window-state approach, and test strategy in `context-agent/`.
Acceptance criteria:
- `context-agent/wiki/code-map.md` lists the new settings UI modules and their responsibilities.
- `context-agent/wiki/testing.md` lists the new component and e2e tests.
- Any Tauri window API caveats are documented.
- Any e2e preference-file isolation caveats are documented.
Dependencies: Tasks C.3, D.2, and E.1.
#### Task E.3: Run validation checks

Description: Run narrow checks first, then broader project checks.
Acceptance criteria:
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.
- `cargo test --manifest-path src-tauri/Cargo.toml` passes if Rust behavior or bindings changed.
- `npm run test:e2e` passes or any skipped e2e check is documented with the reason.
Dependencies: Tasks C.3, D.2, E.1, and E.2.
## Validation plan

Run checks in this order:
1. `npm test` for React component and preference helper coverage.
2. `npm run lint` for TypeScript compile checks.
3. `npm run build` for production bundle validation.
4. `cargo test --manifest-path src-tauri/Cargo.toml` if Rust commands, bindings, or Tauri setup changed.
5. `npm run test:e2e` for the settings persistence smoke test.
If `node_modules` is missing, run `npm install` before frontend checks. If e2e cannot run in the current environment because a Tauri desktop build or display server is unavailable, document the exact reason and keep the test checked in.
## Definition of done

- Settings opens from the app UI and shows a sidebar plus General content area.
- General includes theme mode, UI font, and monospace font controls.
- Theme mode supports System, Light, and Dark.
- Theme and font changes apply immediately without a save button.
- General preferences persist through `preferences_write` and load through `preferences_read`.
- Window size and position are restored on next open where Tauri APIs and screen bounds allow it.
- Component tests cover settings rendering, controls, persistence calls, and accessibility basics.
- E2E smoke covers opening settings, changing theme, closing, reopening or reloading, and verifying persistence.
- Existing app status and settings storage primitive behavior remain intact.
- No credentials, source configuration, provider metadata, or shared data are written into preferences.
- Agent context documents the new settings UI structure and testing notes.
## Risks and open questions

- The issue references Episteme `wiki/design-system.md`, but this checkout does not contain that wiki. This spec uses `context-human/specs/app.md` design guidance as the available source of truth.
- Persisting window position can be tricky across monitor changes. The implementation must clamp or ignore invalid saved positions so the window remains visible.
- Tauri window event support may affect how often window state can be saved. If continuous move/resize persistence is unreliable, save on close and document the limitation.
- Applying fonts by name cannot guarantee the font exists on every machine. The fallback stack must keep the app readable.
- Writing preferences on every small window movement could cause unnecessary disk churn. Debounce writes or save at safe lifecycle points.
- Initial preference load may briefly show default theme before the saved theme applies. If visible flicker occurs, add an early theme application step in `main.tsx` or inline startup script.
## References

- GitHub issue: [#5 feat(config): app preferences + settings ui shell](https://github.com/markdstafford/hm/issues/5)
- Existing spec: `context-human/specs/feature-settings-storage-primitives.md`
- App spec: `context-human/specs/app.md`
- ADR-002: Tauri Rust core with TypeScript/React UI.
- ADR-003: local-first, single-user v1 architecture.
- ADR-008: per-user preferences live in the OS config file, credentials in keychain, and shared data-relevant settings in SQLite.