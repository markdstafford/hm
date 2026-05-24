---
created: 2026-05-22
last_updated: 2026-05-23
status: complete
issue: 6
specced_by: markdstafford
implemented_by: markdstafford
superseded_by: null
---

# Color scheme configuration

## What

`hm` needs an Appearance settings tab where users can configure the app's color scheme. Users choose a theme mode (System, Light, or Dark), a light theme, a dark theme, and optional theme-specific settings like Catppuccin accent color. The initial theme catalog uses VS Code themes as the baseline format and ships with Catppuccin Latte, Frappé, Macchiato, and Mocha plus 3–5 popular non-Catppuccin themes.

Theme changes update the app immediately by writing resolved theme state to the document element. The resolved theme is represented with `data-theme="<id>"`, brightness with `data-theme-mode="light|dark"`, and optional features with additional attributes like `data-accent="sapphire"`.

This replaces the current limited appearance model where `themeMode` maps only to Latte or Macchiato with a fixed sapphire accent.

## Why

The app spec names color scheme configuration as a planned feature. The current app proves the Catppuccin token approach but only supports the default light/dark pair and a fixed accent. That is enough for a first shell but not enough for users who want a specific light theme for screenshots, a specific dark theme for long sessions, or a matching pair that follows OS changes.

Color scheme choices are personal UI preferences that should follow ADR-008's preference path. Adding the Appearance tab validates the settings shell's ability to grow beyond General. Using VS Code themes as the source format gives the project a large existing ecosystem and avoids inventing a bespoke palette schema.

## Personas

- **Tarek: Team member** — spends long stretches reading issue context. He wants Catppuccin Mocha with a green accent and wants the app to follow his OS setting when he switches rooms.
- **Elena: EM** — switches between dark offices and bright meeting rooms. She wants System mode to pick her chosen light and dark themes automatically without technical theme terms.
- **Priya: PM** — prepares roadmap screenshots for reviews. She wants a stable light theme for screenshots while keeping a different dark theme for daily work.
- **Future UI implementer** — needs a clear theme model, typed preference fields, a theme catalog abstraction, and tests that explain how to add new appearance controls.

## Narratives

### Tarek configures a system-aware pair

Tarek opens settings and selects Appearance from the sidebar. Theme mode is set to System. He leaves Light theme on Catppuccin Latte, changes Dark theme to Catppuccin Mocha, and changes the Catppuccin accent to Green. Because his OS is currently in dark mode, the app immediately shifts to Mocha with a green emphasis color.

Later, his OS switches to light mode. `hm` resolves the same preference set to the selected Light theme without losing his Dark theme choice. When he quits and reopens `hm`, the theme pair and accent are still active.

### Elena keeps system behavior simple

Elena opens settings before writing a status report. She sees Theme mode, Light theme, and Dark theme grouped together under Appearance. The labels are plain and she does not need to know the underlying VS Code theme format.

She tries a different Light theme, decides it is too low contrast in the conference room, and switches back to Catppuccin Latte. Each change is immediate when it affects the currently resolved mode. She does not need a save button.

### Priya prepares screenshots

Priya opens Appearance, sets Theme mode to Light, and chooses her preferred Light theme. The main app surface updates before she takes screenshots. Later, she returns Theme mode to System. Because her Light theme and Dark theme are stored separately, the screenshot setup does not erase her everyday dark theme.

## User stories

**Tarek configures a system-aware pair**

- Tarek can navigate to an Appearance category in settings separate from General
- Tarek can choose System, Light, or Dark theme mode
- Tarek can choose a dark theme independently from his light theme
- Tarek can choose a Catppuccin accent color when a Catppuccin theme is selected
- Tarek can see the app shift immediately when he changes the resolved theme or accent
- Tarek can quit and reopen `hm` and find his theme pair and accent preserved

**Elena keeps system behavior simple**

- Elena can see theme changes apply immediately without a save button
- Elena can trust that System mode automatically picks her chosen themes based on OS preference
- Elena can try a different light theme and switch back without losing her dark theme choice
- Elena can understand the mode/theme mapping from plain labels without knowing VS Code format

**Priya prepares screenshots**

- Priya can switch to Light mode for screenshots without erasing her dark theme preference
- Priya can return to System mode and find her dark theme still configured
- Priya can trust that her local preference does not affect other users' instances

## Goals

- Add an Appearance category to the settings panel
- Let users choose theme mode, light theme, and dark theme independently
- Resolve System mode through `prefers-color-scheme` using the selected pair
- Seed the catalog with four Catppuccin themes plus 3–5 popular VS Code themes
- Keep Catppuccin Latte and Macchiato as defaults for backward compatibility
- Apply resolved theme changes immediately via document-root attributes and CSS variables
- Persist color preferences through the existing preferences primitive
- Convert initial themes from VS Code theme definitions
- Verify WCAG AA contrast for each shipped theme's core pairs
- Cover mode/theme switching, feature settings, and preference round-trip with tests

## Non-goals

- No custom color picker or arbitrary hex entry
- No user-facing external theme import
- No marketplace browsing or remote theme registry
- No user-defined palette editing
- No font settings changes
- No promise that every VS Code token kind has an hm equivalent

## Design spec

### Information architecture

Settings categories after this feature:
1. **General** — fonts, window-state notes, app-wide basics
2. **Appearance** — theme mode, light/dark theme pair, theme features, preview

### Appearance layout

```
+--------------------------------------------------------------+
| Settings                                                [Esc] |
+----------------------+---------------------------------------+
| General              | Appearance                            |
| > Appearance         |                                       |
|                      | Theme mode                            |
|                      |  ( ) System   ( ) Light   (x) Dark    |
|                      |                                       |
|                      | Theme pair                            |
|                      |  Light theme  [ Catppuccin Latte  v ] |
|                      |  Dark theme   [ Catppuccin Mocha  v ] |
|                      |                                       |
|                      | Catppuccin options                    |
|                      |  Accent       [ Sapphire          v ] |
|                      |                                       |
|                      | Preview                               |
|                      |  +---------------------------------+  |
|                      |  | Dark → Catppuccin Mocha         |  |
|                      |  | Surface card with focused field  |  |
|                      |  | [Primary action]  Link           |  |
|                      |  +---------------------------------+  |
+----------------------+---------------------------------------+
```

### Theme mode control

Segmented or radio group showing System, Light, Dark. Each option has a short description ("Follow OS", "Always light theme", "Always dark theme"). Changing mode does not erase either theme slot.

### Theme pair controls

Light theme picker lists only light-classified themes. Dark theme picker lists only dark-classified themes. Each shows theme name and family.

### Accent control

When resolved theme supports Catppuccin accent: compact grid or select with all 14 accent names plus color swatches. Swatches are decorative; screen readers get text labels.

### Preview

Compact sample showing: resolver label (e.g. "System → Dark: Catppuccin Mocha"), background, surface card with border, text and subtext, primary button/pill, focus ring. Updates immediately on any change.

## Tech spec

### Introduction and overview

**Prerequisites:**
- ADR-008 (settings split) — color preferences in OS config file
- Issue #4 — preferences primitive exists
- Issue #5 — settings panel shell with General tab exists

**Goals:**
- Theme applies before user sees default flash
- All theme logic testable without Tauri
- Deterministic theme resolution injectable in tests

### System design and architecture

```
┌─────────────────────────────────────────────────────┐
│ React                                                │
│  SettingsPanel → AppearanceSettings                 │
│  theme.ts (catalog, resolution, DOM application)    │
│  preferences.ts (extended normalization)            │
└──────────────────┬──────────────────────────────────┘
                   │ existing bindings
┌──────────────────┴──────────────────────────────────┐
│ Rust (no changes needed)                            │
│  preferences_read / preferences_write               │
└─────────────────────────────────────────────────────┘
```

### Detailed design

**Theme catalog:**
```typescript
const THEME_CATALOG = [
  { id: "catppuccin-latte", label: "Catppuccin Latte", brightness: "light", family: "catppuccin", features: ["catppuccinAccent"] },
  { id: "catppuccin-frappe", label: "Catppuccin Frappé", brightness: "dark", family: "catppuccin", features: ["catppuccinAccent"] },
  { id: "catppuccin-macchiato", label: "Catppuccin Macchiato", brightness: "dark", family: "catppuccin", features: ["catppuccinAccent"] },
  { id: "catppuccin-mocha", label: "Catppuccin Mocha", brightness: "dark", family: "catppuccin", features: ["catppuccinAccent"] },
  // + 3-5 VS Code themes
];
```

**Preference schema extension:**
```typescript
type AppPreferences = {
  appearance?: {
    themeMode?: ThemeMode;
    lightTheme?: ThemeId;
    darkTheme?: ThemeId;
    themeFeatures?: { catppuccin?: { accent?: CatppuccinAccent } };
    uiFont?: string;
    monoFont?: string;
  };
  window?: { ... };
};
```

**Resolution logic:**
- `themeMode: "light"` → use `lightTheme` slot
- `themeMode: "dark"` → use `darkTheme` slot
- `themeMode: "system"` → use OS preference to pick slot
- Missing slots default to Catppuccin Latte / Macchiato

**DOM application:**
- `document.documentElement.dataset.theme = resolvedThemeId`
- `document.documentElement.dataset.themeMode = "light" | "dark"`
- Accent: `document.documentElement.dataset.accent = accentName`

**VS Code conversion:** Small converter maps VS Code `colors` fields to hm semantic tokens (`--color-background`, `--color-surface`, `--color-text`, `--color-subtext`, `--color-border`, `--color-primary`, `--color-focus`). Build-time or checked-in output for initial catalog.

**CSS structure:** Theme-specific token blocks keyed by `[data-theme="<id>"]` selectors. Semantic layer consumed by components never references theme-specific hex directly.

### Security, privacy, and compliance

- Color preferences are per-user UI preferences in TOML, not in SQLite or keychain
- No remote calls, telemetry, or theme downloads
- No credentials in preferences

### Testing plan

- Unit: preference normalization, theme resolution (all mode/slot combos), DOM application, accent application, VS Code conversion
- Component: settings navigation to Appearance, mode/theme/accent control interactions, persistence calls
- Accessibility: axe on Appearance tab, labels for swatches
- E2E: change theme settings, reload, verify persistence
- Contrast: documented verification for core pairs in each shipped theme

### Risks

- VS Code theme mapping may not cover all hm surfaces — mitigated by curated catalog and manual review
- Some accents have weak contrast — mitigated by non-color state indicators
- Startup theme flash — mitigated by early application before render
- Tailwind v4 runtime variable limits — mitigated by CSS custom properties as semantic layer

## Task list

- [x] **Story: Extend the color preference model**
  - [x] **Task: Add theme catalog and feature types**
    - **Description**: Add typed theme catalog, Catppuccin accents, and feature types.
    - **Acceptance criteria**:
      - [x] Theme modes as typed constant list
      - [x] Shipped themes in typed catalog with brightness metadata
      - [x] 14 Catppuccin accents as typed constants
      - [x] TypeScript rejects unsupported values
    - **Dependencies**: None
  - [x] **Task: Normalize color preferences**
    - **Description**: Extend preference normalization for lightTheme, darkTheme, and themeFeatures.
    - **Acceptance criteria**:
      - [x] Missing light/dark themes resolve to Catppuccin defaults
      - [x] Missing accent resolves to sapphire
      - [x] Invalid values don't crash
      - [x] Deprecated flavor handled safely
      - [x] Unknown keys preserved
      - [x] Unit tests cover all cases
    - **Dependencies**: Theme catalog
  - [x] **Task: Add resolved color-scheme helpers**
    - **Description**: Resolution helpers for theme ID, brightness, and features from preferences + OS state.
    - **Acceptance criteria**:
      - [x] All three modes resolve correctly
      - [x] Slots preserved independently
      - [x] Accent precedence correct
      - [x] Unit tests cover all branches
    - **Dependencies**: Normalization

- [x] **Story: Encode, convert, and apply shipped themes**
  - [x] **Task: Add VS Code baseline conversion path**
    - **Description**: Deterministic converter from VS Code theme data to hm semantic tokens.
    - **Acceptance criteria**:
      - [x] Maps required semantic tokens from VS Code fields
      - [x] Handles missing optional fields with fallbacks
      - [x] Source attribution captured for bundled themes
      - [x] Tests cover at least one converted fixture
    - **Dependencies**: Theme catalog
  - [x] **Task: Add shipped theme token blocks**
    - **Description**: CSS token definitions for all shipped themes keyed by data-theme selectors.
    - **Acceptance criteria**:
      - [x] All four Catppuccin variants define required tokens
      - [x] Non-Catppuccin themes define required tokens
      - [x] Existing behavior preserved
      - [x] No hard-coded hex in components
    - **Dependencies**: VS Code conversion
  - [x] **Task: Apply resolved theme to document root**
    - **Description**: Update theme application to write resolved theme and brightness to html element.
    - **Acceptance criteria**:
      - [x] data-theme and data-theme-mode set correctly for all modes
      - [x] Startup applies after preferences load
      - [x] Unit tests cover DOM attribute updates
    - **Dependencies**: Resolution helpers, theme tokens
  - [x] **Task: Apply theme features to semantic colors**
    - **Description**: Catppuccin accent affects --color-primary and --color-focus.
    - **Acceptance criteria**:
      - [x] Each accent updates root variable deterministically
      - [x] Sapphire is fallback
      - [x] Non-Catppuccin themes unaffected
      - [x] Tests cover default and non-default accents
    - **Dependencies**: Resolution helpers, theme tokens
  - [x] **Task: Verify contrast for core pairs**
    - **Description**: Document contrast verification for shipped themes.
    - **Acceptance criteria**:
      - [x] Core pairs checked across all shipped themes
      - [x] Weak usages mitigated with non-color indicators
      - [x] Method documented
    - **Dependencies**: Theme tokens, feature application

- [x] **Story: Add the Appearance settings tab**
  - [x] **Task: Add settings category navigation**
    - **Description**: Update settings panel for multiple categories.
    - **Acceptance criteria**:
      - [x] Sidebar shows General and Appearance
      - [x] General keeps existing controls
      - [x] Appearance renders when selected
      - [x] Active category exposed to assistive technology
      - [x] Keyboard navigation works
      - [x] Component tests cover switching
    - **Dependencies**: None
  - [x] **Task: Build theme mode control**
    - **Description**: System/Light/Dark selector in Appearance.
    - **Acceptance criteria**:
      - [x] All three modes available
      - [x] Current mode shown as selected
      - [x] Changes update preference state and resolved theme immediately
      - [x] Component tests cover each mode
    - **Dependencies**: Resolution helpers, category navigation
  - [x] **Task: Build light and dark theme controls**
    - **Description**: Theme pickers filtered by brightness.
    - **Acceptance criteria**:
      - [x] Light picker shows only light themes
      - [x] Dark picker shows only dark themes
      - [x] Correct defaults shown
      - [x] Changes update preferences and resolved theme
      - [x] Component tests cover selection
    - **Dependencies**: Resolution helpers, theme application, category navigation
  - [x] **Task: Build theme feature controls**
    - **Description**: Catppuccin accent picker.
    - **Acceptance criteria**:
      - [x] 14 accents available when Catppuccin theme resolved
      - [x] Sapphire default
      - [x] Changes update preferences and semantic colors
      - [x] Component tests cover selection
    - **Dependencies**: Feature application, category navigation
  - [x] **Task: Add color preview**
    - **Description**: Compact preview showing resolved theme with semantic samples.
    - **Acceptance criteria**:
      - [x] Shows resolver label, background, surface, text, primary, focus
      - [x] Updates after any change
      - [x] Accessible
      - [x] Component tests verify rendering
    - **Dependencies**: Mode control, theme controls, feature controls

- [x] **Story: Persist and restore selections**
  - [x] **Task: Wire Appearance controls to persistence**
    - **Description**: Use existing savePreferences path for all Appearance changes.
    - **Acceptance criteria**:
      - [x] Mode, theme, and feature changes persist through preferencesWrite
      - [x] Merges preserve other preference fields
      - [x] Save failures use non-blocking error pattern
    - **Dependencies**: Appearance controls
  - [x] **Task: Restore color scheme at startup**
    - **Description**: Apply full color scheme from loaded preferences at startup.
    - **Acceptance criteria**:
      - [x] Mode, slots, and features restored
      - [x] Correct theme and brightness applied to document
      - [x] Tests cover restoration from mocked preferences
    - **Dependencies**: Theme application, feature application, persistence
  - [x] **Task: Preserve old themeMode behavior**
    - **Description**: Compatibility for existing themeMode-only preferences.
    - **Acceptance criteria**:
      - [x] Old themeMode values normalize correctly
      - [x] Missing slots produce expected defaults
      - [x] Deprecated flavor doesn't crash
      - [x] New fields don't erase fonts/window state
    - **Dependencies**: Resolution helpers, startup restoration

- [x] **Story: Test and validate**
  - [x] **Task: Unit tests for theme helpers**
    - **Description**: Cover resolution, conversion, and DOM application.
    - **Acceptance criteria**:
      - [x] All modes, defaults, shipped IDs, accents, and invalid values tested
      - [x] DOM state reset between cases
    - **Dependencies**: Stories A and B
  - [x] **Task: Component tests for Appearance**
    - **Description**: Settings navigation and control interactions.
    - **Acceptance criteria**:
      - [x] Navigate to Appearance, change mode/theme/accent, verify callbacks
      - [x] Accessible labels verified
      - [x] Axe coverage where practical
    - **Dependencies**: Stories C and D
  - [x] **Task: E2E smoke coverage**
    - **Description**: Settings persistence through reload.
    - **Acceptance criteria**:
      - [x] Change settings, reload, verify persistence
      - [x] Isolated data environment or limitation documented
    - **Dependencies**: Startup restoration
  - [x] **Task: Run validation checks**
    - **Description**: All project checks pass.
    - **Acceptance criteria**:
      - [x] npm test passes
      - [x] npm run lint passes
      - [x] npm run test:e2e passes or limitation documented
      - [x] cargo test passes if Rust changed
    - **Dependencies**: All tasks
