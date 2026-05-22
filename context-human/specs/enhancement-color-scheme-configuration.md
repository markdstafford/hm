---
type: enhancement
status: implementing
created: 2026-05-22
last_updated: 2026-05-22
source_issue: [https://github.com/markdstafford/hm/issues/6](https://github.com/markdstafford/hm/issues/6)
related_specs:
	- [feature-settings-storage-primitives.md](http://feature-settings-storage-primitives.md)
	- [enhancement-app-preferences-settings-ui-shell.md](http://enhancement-app-preferences-settings-ui-shell.md)
related_adrs:
	- ../adrs/[adr-002-desktop-framework.md](http://adr-002-desktop-framework.md)
	- ../adrs/[adr-003-local-first-architecture.md](http://adr-003-local-first-architecture.md)
	- ../adrs/[adr-008-settings-split.md](http://adr-008-settings-split.md)
---
# Enhancement: Color scheme configuration

## What

`hm` needs an Appearance settings tab where users can configure the app's color scheme. Instead of choosing one global flavor, users choose:
- a theme mode: System, Light, or Dark;
- a light theme used when the resolved mode is light;
- a dark theme used when the resolved mode is dark;
- optional theme-specific settings when a selected theme supports them, such as Catppuccin accent.
The tab extends the settings panel from issue #5 and uses the preferences storage primitive from issue #4. The initial theme catalog should use VS Code themes as the baseline format and ship with a small curated set: Catppuccin Latte, Frappé, Macchiato, and Mocha, plus 3-5 popular non-Catppuccin themes after manual conversion or build-time import.
Theme changes update the app immediately by writing resolved theme state to the `` element. The resolved theme is represented with `data-theme=""`; the resolved brightness is represented with `data-theme-mode="light"` or `data-theme-mode="dark"`; optional theme features may set additional attributes or semantic variables, such as `data-accent="sapphire"`. Changes must not require restart.
This enhancement replaces the current limited appearance model, where `themeMode` maps only to Latte or Macchiato and the accent is fixed to sapphire. It keeps the app local-first and stores color choices as per-user preferences, not in SQLite and not in the keychain.
## Why

The app spec names color scheme configuration as a planned configuration feature. The current app proves the Catppuccin token approach, but it only supports the default light/dark pair and a fixed sapphire accent. That is enough for a first shell, but not enough for users who want a specific light theme for screenshots, a specific dark theme for long sessions, or a matching pair that follows OS light/dark changes.
Color scheme choices are personal UI preferences. They should follow ADR-008's preference path and survive restarts without affecting source configuration, provider routing, or shared team data. Adding the Appearance tab now also validates the settings shell's ability to grow beyond General without inventing a second navigation pattern.
Using VS Code themes as the source format gives the project a large existing theme ecosystem, avoids inventing a bespoke palette schema too early, and keeps the door open for future theme import. The first implementation can still be intentionally small: ship only curated, manually converted theme definitions and defer user-facing import.
## Goals

- Add an Appearance category to the settings panel.
- Let users choose Theme mode: System, Light, or Dark.
- Let users choose a Light theme and a Dark theme independently.
- Resolve System mode through `prefers-color-scheme`, using the selected Light theme for system light and the selected Dark theme for system dark.
- Seed the catalog with Catppuccin Latte, Frappé, Macchiato, and Mocha, plus 3-5 popular VS Code themes that have clear light/dark classification.
- Keep Catppuccin Latte as the default Light theme and Catppuccin Macchiato as the default Dark theme for compatibility with current behavior.
- Keep sapphire as the default Catppuccin accent when a Catppuccin theme supports accent selection.
- Apply resolved theme changes immediately by setting deterministic document-root attributes and semantic CSS variables.
- Persist theme mode, light theme, dark theme, and theme feature settings through `preferences_write` and restore them through `preferences_read`.
- Convert or ingest initial themes from VS Code theme definitions rather than hand-designing a permanent hm-only theme format.
- Verify WCAG AA contrast for each shipped theme's core foreground/background pairs.
- Cover mode/theme switching, system mapping, feature settings, and preference round-trip behavior with tests.
## Non-goals

- No custom color picker or arbitrary hex color entry.
- No user-facing external theme import in this issue.
- No marketplace browsing, downloading, extension installation, or remote theme registry.
- No user-defined palette editing.
- No font settings changes beyond preserving the existing General font controls.
- No source connector, AI provider, credential, or shared settings UI.
- No remote sync of color preferences.
- No telemetry, remote error reporting, or provider calls.
- No broad redesign of the app shell outside the settings category navigation needed for Appearance.
- No promise that every VS Code token kind has an hm visual equivalent in this issue.
## Personas

- **Tarek, team member** — spends long stretches reading issue context and code paths. He wants a dark theme that is comfortable, such as Catppuccin Mocha with a green accent, and wants the app to follow his OS setting when he switches rooms.
- **Elena, EM** — switches between dark offices and bright meeting rooms. She wants System mode to pick her chosen light and dark themes automatically without forcing her through technical theme terms.
- **Priya, PM** — prepares roadmap screenshots for reviews. She wants a stable light theme for screenshots while keeping a different dark theme for daily work.
- **Future UI implementer** — adds more visual preferences later. They need a clear theme model, typed preference fields, a theme catalog abstraction, and tests that explain how to add new appearance controls safely.
## Narratives

### Tarek configures a system-aware pair

Tarek opens settings and selects Appearance from the sidebar. Theme mode is set to System. He leaves Light theme on Catppuccin Latte, changes Dark theme to Catppuccin Mocha, and changes the Catppuccin accent to Green. Because his OS is currently in dark mode, the app immediately shifts to Mocha with a green emphasis color.
Later, his OS switches to light mode. `hm` resolves the same preference set to the selected Light theme without losing his Dark theme choice. When he quits and reopens `hm`, the theme pair and Catppuccin accent are still active because they were stored as preferences.
### Elena keeps system behavior simple

Elena opens settings before writing a status report. She sees Theme mode, Light theme, and Dark theme grouped together under Appearance. The labels are plain, the preview explains the mapping, and she does not need to know the details of the underlying VS Code theme format.
She tries a different Light theme, decides it is too low contrast in the conference room, and switches back to Catppuccin Latte. Each change is immediate when it affects the currently resolved mode. She does not need a save button and does not lose her place in the app.
### Priya prepares screenshots

Priya wants roadmap screenshots with a lighter palette. She opens Appearance, sets Theme mode to Light, and chooses her preferred Light theme. The main app surface updates before she takes screenshots, so the exported visuals match what she reviewed.
Later, she returns Theme mode to System. Because her Light theme and Dark theme are stored separately, the screenshot setup does not erase her everyday dark theme. Because this is a local preference, her choice does not affect Elena's or Tarek's instance of `hm`.
## User stories

### Story 1: Navigate to Appearance settings

As a user, I want a clear Appearance category in settings so that color options are separate from general app preferences.
Acceptance criteria:
- The settings sidebar includes an Appearance category.
- General remains available and retains non-color controls such as fonts and window-state notes.
- Opening settings still defaults to General unless implementation chooses to remember the last category as local UI state.
- Selecting Appearance changes the content area without closing the settings panel.
- The active category is exposed with `aria-current`, a tab state, or an equivalent accessible pattern.
- Keyboard users can move to the sidebar, choose Appearance, use the controls, and close settings.
### Story 2: Choose theme mode and theme pair

As a user, I want to choose System, Light, or Dark mode and configure separate light and dark themes so that the app matches my environment without losing my preferred pair.
Acceptance criteria:
- Appearance includes a Theme mode control with System, Light, and Dark.
- Appearance includes a Light theme control listing only themes classified as light.
- Appearance includes a Dark theme control listing only themes classified as dark.
- The default Light theme is Catppuccin Latte.
- The default Dark theme is Catppuccin Macchiato.
- `themeMode: "light"` resolves to the selected Light theme.
- `themeMode: "dark"` resolves to the selected Dark theme.
- `themeMode: "system"` resolves through `prefers-color-scheme`, using Light theme for system light and Dark theme for system dark.
- Changing the theme that is currently resolved updates visible app colors immediately.
- Changing the non-current paired theme persists immediately but does not need to visually affect the app until that mode is resolved.
- Invalid saved theme IDs fall back safely without crashing.
### Story 3: Configure theme-specific features

As a user, I want optional controls for features supported by my selected themes so that theme families such as Catppuccin can expose accents without forcing every theme to support them.
Acceptance criteria:
- Catppuccin themes expose an Accent control with all 14 Catppuccin accent names.
- Sapphire is the default Catppuccin accent.
- Selecting an accent updates semantic primary and focus colors immediately when the resolved theme is Catppuccin.
- Accent settings persist through `preferences_write`.
- Startup restores the selected accent after `preferences_read`.
- Invalid saved accent values fall back to sapphire without crashing.
- Accent labels use readable names, and visual swatches are not the only way to identify options.
- Non-Catppuccin themes may hide the Accent control, show it disabled with explanatory copy, or use their own declared feature controls if supported later.
### Story 4: Preview the resolved scheme and pair mapping

As a user, I want a small preview of the selected scheme and its light/dark mapping so that I can understand what will happen before leaving settings.
Acceptance criteria:
- Appearance shows a compact preview using the currently resolved theme and feature settings.
- The preview includes at least background, surface, text, subtext, primary/accent, border, and focus treatment.
- The preview labels the current resolution, for example `System → Dark theme: Catppuccin Mocha`.
- The preview updates immediately when mode, selected theme, OS preference test state, or supported theme feature changes.
- The preview does not replace applying the resolved selection to the whole app.
- The preview remains readable in all shipped themes.
### Story 5: Preserve existing theme-mode behavior safely

As a maintainer, I want this enhancement to extend the existing theme model without breaking users who already have `themeMode` preferences.
Acceptance criteria:
- Existing saved `appearance.themeMode` values continue to load without errors.
- If a user has `themeMode: "light"` and no explicit Light theme, the resolved theme is Catppuccin Latte.
- If a user has `themeMode: "dark"` and no explicit Dark theme, the resolved theme is Catppuccin Macchiato.
- If a user has `themeMode: "system"` and no explicit themes, the app follows the OS preference using Catppuccin Latte for light and Catppuccin Macchiato for dark.
- Existing saved Catppuccin `flavor` values, if present from earlier drafts or prototypes, migrate to the closest light/dark slot without crashing.
- Once a user explicitly selects a Light theme or Dark theme in Appearance, that slot is honored until the user changes it.
- The implementation avoids writing contradictory preference state when possible.
### Story 6: Test color scheme behavior

As a maintainer, I want tests around color scheme changes so that theme configuration remains reliable as UI code changes.
Acceptance criteria:
- Unit tests cover preference normalization for valid and invalid theme mode, light theme, dark theme, and Catppuccin accent values.
- Unit tests cover resolving System mode from light and dark `prefers-color-scheme` states.
- Unit tests cover applying each shipped theme to ``.
- Unit tests cover Catppuccin accent application to semantic variables.
- Component tests cover opening settings, switching to Appearance, changing theme mode, changing Light theme, changing Dark theme, and changing a supported theme feature.
- Component tests assert that persistence is called with the correct preference patch.
- Tests verify that switching themes updates rendered style hooks or CSS variables in a deterministic way.
- An e2e smoke path covers changing theme settings, reloading or reopening, and seeing the persisted selection.
## Requirements

### Preference schema

Extend the typed app preferences model with explicit color scheme fields under `appearance`:
```typescript
type ThemeMode = "system" | "light" | "dark";
type ThemeBrightness = "light" | "dark";
type ThemeId = string;
type CatppuccinAccent =
  | "rosewater"
  | "flamingo"
  | "pink"
  | "mauve"
  | "red"
  | "maroon"
  | "peach"
  | "yellow"
  | "green"
  | "teal"
  | "sky"
  | "sapphire"
  | "blue"
  | "lavender";

type AppPreferences = {
  appearance?: {
    themeMode?: ThemeMode;
    lightTheme?: ThemeId;
    darkTheme?: ThemeId;
    themeFeatures?: {
      catppuccin?: {
        accent?: CatppuccinAccent;
      };
      [themeFamily: string]: unknown;
    };
    /** Deprecated compatibility field from earlier Catppuccin-only drafts/prototypes. */
    flavor?: "latte" | "frappe" | "macchiato" | "mocha";
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
- Missing preferences are valid.
- Missing `appearance.themeMode` resolves to `system`.
- Missing `appearance.lightTheme` resolves to `catppuccin-latte`.
- Missing `appearance.darkTheme` resolves to `catppuccin-macchiato`.
- Missing `appearance.themeFeatures.catppuccin.accent` resolves to `sapphire`.
- Invalid theme mode values are discarded or normalized to `system`.
- Invalid Light theme values are discarded or normalized to `catppuccin-latte`.
- Invalid Dark theme values are discarded or normalized to `catppuccin-macchiato`.
- Invalid Catppuccin accent values are discarded or normalized to `sapphire`.
- Unknown preference keys continue to be preserved when preferences are merged and written.
- Preferences must not include credentials, source-system tokens, source identifiers, provider metadata, or issue/roadmap data.
### Theme behavior

Theme selection is a two-slot model plus a resolver:
- `appearance.themeMode = "light"` resolves to `appearance.lightTheme`.
- `appearance.themeMode = "dark"` resolves to `appearance.darkTheme`.
- `appearance.themeMode = "system"` resolves to `appearance.lightTheme` when the OS is light and `appearance.darkTheme` when the OS is dark.
- The resolved theme writes `data-theme=""` on ``.
- The resolved brightness writes `data-theme-mode="light"` or `data-theme-mode="dark"` on ``.
- System mode may also write `data-theme-source="system"` for debugging/tests, but styling must use the resolved theme and brightness.
- The behavior must be deterministic in tests by injecting or mocking the OS dark-mode state.
- Theme application must update the whole app, not only the settings panel.
- The implementation must avoid a flash of the wrong theme as much as the current Tauri/React startup flow allows.
Default and compatibility mapping:

Case
Resolved light slot
Resolved dark slot

No saved theme preferences
Catppuccin Latte
Catppuccin Macchiato

Existing `themeMode: "light"` only
Catppuccin Latte
Catppuccin Macchiato, kept for later

Existing `themeMode: "dark"` only
Catppuccin Latte, kept for later
Catppuccin Macchiato

Existing `themeMode: "system"` only
Catppuccin Latte
Catppuccin Macchiato

Deprecated `flavor: "latte"`
Catppuccin Latte
Catppuccin Macchiato unless already set

Deprecated `flavor: "frappe"`, `"macchiato"`, or `"mocha"`
Catppuccin Latte unless already set
matching Catppuccin dark theme

### Theme catalog and VS Code baseline

Use VS Code themes as the baseline input format for shipped theme definitions. This does not require user-facing import yet.
Recommended approach:
- Store source theme metadata in a small catalog module with stable hm theme IDs, display names, brightness, family, and optional feature schema.
- Keep original or normalized VS Code theme data in repository-owned fixtures or generated assets.
- Convert VS Code `colors` and relevant `tokenColors` into hm semantic CSS variables either at build time or through a small runtime/backend conversion helper.
- Prefer a one-time manual/build conversion for the initial release unless runtime conversion materially simplifies the Tauri implementation.
- Keep the conversion path deterministic and tested so future user import can build on it.
Initial catalog:
- Catppuccin Latte (`catppuccin-latte`, light, supports Catppuccin accent)
- Catppuccin Frappé (`catppuccin-frappe`, dark, supports Catppuccin accent)
- Catppuccin Macchiato (`catppuccin-macchiato`, dark, supports Catppuccin accent)
- Catppuccin Mocha (`catppuccin-mocha`, dark, supports Catppuccin accent)
- 3-5 popular VS Code themes selected during implementation based on available license, clear light/dark classification, and readable mapping to hm semantic tokens
Rationale and pushback:
- Adopting VS Code's theme shape is a good baseline because it gives hm a well-known vocabulary and future import path.
- hm should not promise full VS Code editor-token fidelity yet. The app is not a code editor, so many token scopes will be unused or only relevant to future code snippets.
- A one-time conversion is safer for this issue than arbitrary runtime import because it lets us validate contrast, licensing, and semantic mappings before themes reach users.
- Runtime/backend conversion can still be kept as an internal helper if it is simpler to share with future import work, but the UI should expose only curated shipped themes for now.
### Theme feature behavior

- Theme features are declared by the selected theme or theme family; controls appear in Appearance only when supported.
- Catppuccin themes support an `accent` feature with the 14 official Catppuccin accent names.
- The selected Catppuccin accent controls semantic variables for primary action and focus treatment.
- At minimum, Catppuccin accent application must affect `--color-primary` and `--color-focus` or the underlying CSS variables those semantic colors reference.
- Accent changes should also affect selected sidebar rows, links, and active controls where the existing design uses the primary token.
- Accent changes must not change semantic error, warning, or success colors unless those components intentionally use the chosen accent.
- Swatches must meet contrast expectations against their immediate background or include a visible border.
### Token definitions

- Keep semantic Tailwind v4 tokens mapped to app-level variables, not hard-coded hex values in components.
- Keep `--color-background`, `--color-mantle`, `--color-crust`, `--color-surface`, `--color-text`, `--color-subtext`, `--color-border`, `--color-primary`, and `--color-focus` as the app-facing semantic layer.
- Source theme values may come from Catppuccin CSS variables, normalized VS Code color keys, or generated CSS custom properties, but components should consume only the semantic layer.
- Prefer one source module for valid theme IDs, theme metadata, feature declarations, and Catppuccin accent lists so UI controls, preference normalization, and tests share the same values.
- Do not introduce shadcn or another design system.
### Contrast and accessibility

- Verify WCAG AA contrast for core foreground/background pairs in each shipped theme:
	- text on base/background;
	- text on mantle;
	- text on surface;
	- subtext on base/background where used for supporting labels;
	- primary/accent text or icon states where they communicate state;
	- focus ring visibility against base, mantle, and surface.
- If a theme or accent has weak contrast in a specific usage, add a border, underline, state shape, or different foreground token instead of relying on color alone.
- Controls have visible labels and accessible names.
- Swatches are decorative support only; screen readers get text labels.
- The Appearance tab passes axe checks in component tests where practical.
- Motion remains short and respects reduced-motion preferences.
### Persistence behavior

- Read color preferences at app startup through the existing `loadPreferences` path.
- Write color preferences only after user action.
- Use the existing merge helper so changing mode, a theme slot, or a feature setting does not erase fonts, window state, or unknown preference keys.
- Save failures should use the existing non-blocking settings save error pattern or an equivalent visible error.
- In non-Tauri test or web contexts, preference changes update local React state and DOM attributes without throwing.
### Settings panel design

- Use the existing settings shell and Radix primitives where they already fit.
- The sidebar may use buttons, tabs, or navigation links, but the active category must be clear visually and semantically.
- Appearance content should use the same row/card pattern as General.
- Theme mode, Light theme, Dark theme, and supported feature controls should be compact and keyboard accessible.
- Theme options should include both name and brightness/family hint.
- Accent options should include both name and swatch when Catppuccin accent is shown.
- Use sentence-case labels: "Theme mode", "Light theme", "Dark theme", "Accent", "Preview".
- Keep text sizes within the app spec's 11 / 12 / 13 / 14 / 16 px scale.
- Keep the Linear-inspired direction: minimal chrome, fast interaction, and no full-page navigation.
### Security and privacy

- Color preferences are per-user app preferences and belong in the preferences TOML file.
- Do not store color preferences in SQLite shared settings.
- Do not store color preferences in the keychain.
- Do not log full preference objects if future fields could become sensitive.
- Do not make remote calls, provider calls, or telemetry calls for theme behavior.
- Do not download themes from a marketplace or URL in this issue.
## Design spec

### Information architecture

Settings categories after this enhancement:
1. **General** — fonts, startup/window-state notes, and other app-wide non-visual basics.
2. **Appearance** — theme mode, Light theme, Dark theme, supported theme features such as Catppuccin accent, and preview.
General remains the first category to avoid surprising users who already open settings for fonts and basics. Color scheme controls belong in Appearance. Existing `themeMode` preferences remain supported in code, but the visible Theme mode control should move to Appearance so General does not become a mixed visual/non-visual page.
### Appearance layout

The Appearance tab contains four sections:
1. **Theme mode** — System, Light, or Dark segmented/radio control.
2. **Theme pair** — Light theme picker and Dark theme picker.
3. **Theme features** — optional feature controls for selected themes, initially Catppuccin Accent.
4. **Preview** — compact sample surface showing current background, text, border, primary action, focus ring, and the current resolver state.
The theme mode control can be a Radix Select, segmented control, or radio group. A radio group or segmented control is preferred because all three options are meaningful and easy to scan. Theme pickers can be Select controls at first; a richer card grid can come later if the catalog grows. The Catppuccin accent picker can be a compact grid of buttons or a Select with swatches. A grid is preferred on desktop because it makes all options visible at once.
### ASCII visual: settings navigation and Appearance form

```plain text
+--------------------------------------------------------------+
| Settings                                                [Esc] |
+----------------------+---------------------------------------+
| General              | Appearance                            |
| > Appearance         |                                       |
|                      | Theme mode                            |
|                      |  ( ) System   ( ) Light   ( ) Dark    |
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
|                      |  | System -> Dark: Mocha           |  |
|                      |  | Surface card with focused field  |  |
|                      |  | [Primary action]  Link           |  |
|                      |  +---------------------------------+  |
+----------------------+---------------------------------------+
```
### ASCII visual: light/dark resolver

```plain text
                         +--------------------------+
                         | appearance.themeMode     |
                         | system | light | dark    |
                         +------------+-------------+
                                      |
          +---------------------------+---------------------------+
          |                           |                           |
       light                        dark                      system
          |                           |                           |
          v                           v                           v
+--------------------+      +--------------------+       +------------------+
| use lightTheme     |      | use darkTheme      |       | OS says light?   |
| e.g. ctp-latte     |      | e.g. ctp-mocha     |       +-----+------------+
+--------------------+      +--------------------+             | yes/no
                                                                  |
                                      +---------------------------+------------------+
                                      |                                              |
                                      v                                              v
                              +--------------------+                         +--------------------+
                              | use lightTheme     |                         | use darkTheme      |
                              +--------------------+                         +--------------------+
```
### Theme mode control

Each theme mode option shows:
- the mode name: System, Light, or Dark;
- a short description such as "Follow OS", "Always use Light theme", or "Always use Dark theme";
- selected state using both shape and color.
Changing mode must not erase either selected theme slot.
### Theme pair controls

Each theme option shows:
- the theme display name;
- the theme family or source where useful, such as Catppuccin or VS Code;
- a light/dark hint;
- a mini swatch row for background, surface, text, and primary color when practical.
The Light theme picker lists light themes only. The Dark theme picker lists dark themes only. If a theme family provides both light and dark variants, the UI may suggest the matching counterpart but should not automatically overwrite the other slot without explicit user action.
### Accent control

When the resolved or selected theme family supports Catppuccin accent, each accent option shows:
- the accent name;
- a color swatch using the accent token for the relevant Catppuccin theme;
- selected state using both shape and color.
Accent names should use Catppuccin's names exactly: Rosewater, Flamingo, Pink, Mauve, Red, Maroon, Peach, Yellow, Green, Teal, Sky, Sapphire, Blue, Lavender. The stored values are lowercase kebab-free identifiers.
### Preview component

The preview should include:
- a resolver label, for example `System → Dark theme: Catppuccin Mocha`;
- a background area using base/mantle;
- a surface card with border;
- one line of text and one line of subtext;
- a primary button or pill using the selected semantic primary color;
- a focused control sample or visible focus ring.
The preview is not a separate theme engine. It should use the same CSS variables as the app whenever possible. If previewing non-current themes before selection is added later, that is out of scope for this issue.
## Technical approach

### Frontend types and constants

Add typed constants for theme metadata and Catppuccin accents. A likely module shape:
```typescript
export const THEME_MODES = ["system", "light", "dark"] as const;

export const THEME_CATALOG = [
  {
    id: "catppuccin-latte",
    label: "Catppuccin Latte",
    brightness: "light",
    family: "catppuccin",
    sourceFormat: "vscode",
    features: ["catppuccinAccent"],
  },
  {
    id: "catppuccin-frappe",
    label: "Catppuccin Frappé",
    brightness: "dark",
    family: "catppuccin",
    sourceFormat: "vscode",
    features: ["catppuccinAccent"],
  },
  {
    id: "catppuccin-macchiato",
    label: "Catppuccin Macchiato",
    brightness: "dark",
    family: "catppuccin",
    sourceFormat: "vscode",
    features: ["catppuccinAccent"],
  },
  {
    id: "catppuccin-mocha",
    label: "Catppuccin Mocha",
    brightness: "dark",
    family: "catppuccin",
    sourceFormat: "vscode",
    features: ["catppuccinAccent"],
  },
] as const;

export const CATPPUCCIN_ACCENTS = [
  "rosewater",
  "flamingo",
  "pink",
  "mauve",
  "red",
  "maroon",
  "peach",
  "yellow",
  "green",
  "teal",
  "sky",
  "sapphire",
  "blue",
  "lavender",
] as const;
```
Use these constants for:
- `AppPreferences` types;
- preference normalization;
- settings controls;
- tests;
- any display label mapping.
### Preference normalization

Extend `normalizePreferences` so it validates `appearance.themeMode`, `appearance.lightTheme`, `appearance.darkTheme`, and supported theme feature values. Keep preserving unknown keys as the existing implementation does. Keep deprecated `appearance.flavor` valid only as compatibility input; new writes should prefer `lightTheme`, `darkTheme`, and `themeFeatures`.
Recommended resolution helpers:
```typescript
function resolveThemeSlots(prefs: AppPreferences): {
  lightTheme: ThemeId;
  darkTheme: ThemeId;
} {
  return {
    lightTheme: isLightTheme(prefs.appearance?.lightTheme)
      ? prefs.appearance.lightTheme
      : "catppuccin-latte",
    darkTheme: isDarkTheme(prefs.appearance?.darkTheme)
      ? prefs.appearance.darkTheme
      : "catppuccin-macchiato",
  };
}

function resolveTheme(
  prefs: AppPreferences,
  prefersDark: boolean,
): { themeId: ThemeId; brightness: "light" | "dark" } {
  const mode = normalizeThemeMode(prefs.appearance?.themeMode);
  const { lightTheme, darkTheme } = resolveThemeSlots(prefs);
  if (mode === "light") return { themeId: lightTheme, brightness: "light" };
  if (mode === "dark") return { themeId: darkTheme, brightness: "dark" };
  return prefersDark
    ? { themeId: darkTheme, brightness: "dark" }
    : { themeId: lightTheme, brightness: "light" };
}
```
A similar helper should resolve Catppuccin accent to `sapphire` by default.
### Theme application

Replace or extend `applyTheme` so it accepts the resolved theme and supported feature values. One possible shape:
```typescript
export function applyColorScheme(input: {
  themeId: ThemeId;
  brightness: "light" | "dark";
  features?: ResolvedThemeFeatures;
}): void {
  const root = document.documentElement;
  root.dataset.theme = input.themeId;
  root.dataset.themeMode = input.brightness;

  const accent = input.features?.catppuccin?.accent;
  if (accent) {
    root.dataset.accent = accent;
    root.style.setProperty("--hm-accent", `var(--ctp-${accent})`);
  } else {
    delete root.dataset.accent;
    root.style.removeProperty("--hm-accent");
  }
}
```
Then map semantic CSS colors to the active theme variables:
```css
@theme {
  --color-primary: var(--hm-primary, var(--hm-accent, var(--ctp-sapphire)));
  --color-focus: var(--hm-focus, var(--hm-accent, var(--ctp-sapphire)));
}
```
If Tailwind v4 token compilation does not allow runtime custom-property indirection in `@theme` as expected, use root-level CSS variables for app-specific semantic colors and keep Tailwind utilities pointed at those variables.
### VS Code theme conversion

Implement a small converter or build-time transform that maps a curated subset of VS Code theme fields to hm semantic tokens. At minimum, support mappings for:

hm semantic token
VS Code color candidates

`--color-background`
`editor.background`, `sideBar.background`, `panel.background`

`--color-surface`
`editorWidget.background`, `quickInput.background`, `input.background`

`--color-text`
`foreground`, `editor.foreground`, `sideBar.foreground`

`--color-subtext`
`descriptionForeground`, `editorLineNumber.foreground`

`--color-border`
`panel.border`, `sideBar.border`, `contrastBorder`

`--color-primary`
`focusBorder`, `button.background`, `textLink.foreground`

`--color-focus`
`focusBorder`

Conversion requirements:
- Preserve source attribution and license notes for bundled themes.
- Reject or quarantine themes missing required foreground/background fields.
- Generate deterministic CSS custom properties or JSON consumed by CSS generation.
- Add tests for at least one Catppuccin source theme and one non-Catppuccin source theme once selected.
- Do not load arbitrary local files from the UI in this issue.
### CSS token work

Current CSS includes Latte, Macchiato, and a media-query path. Update it to support theme IDs rather than only Catppuccin flavor names. Recommended selectors:
```css
:root,
[data-theme="catppuccin-latte"] { ... }
[data-theme="catppuccin-frappe"] { ... }
[data-theme="catppuccin-macchiato"] { ... }
[data-theme="catppuccin-mocha"] { ... }
[data-theme=""] { ... }
```
If system mode with no loaded preferences remains supported through CSS, preserve a dark media query using the default Catppuccin pair. If the React layer always resolves and writes a concrete theme, the media query can become less central, but startup behavior should still avoid an obvious flash.
### Settings components

Add an `AppearanceSettings` component under `src/settings/`. Update `SettingsPanel` to hold selected category state and render either `GeneralSettings` or `AppearanceSettings`. If common row/select helpers remain useful, extract them into a small shared settings UI module rather than duplicating code.
Suggested files:
```plain text
src/theme.ts                         # theme catalog, types, resolution, DOM application
src/themeConversion.ts               # optional VS Code-to-hm conversion helper
src/preferences.ts                   # preference schema and normalization
src/settings/AppearanceSettings.tsx  # Appearance tab UI
src/settings/SettingsPanel.tsx       # category navigation
src/settings/SettingsPanel.test.tsx  # category and control coverage
src/styles.css                       # shipped theme token definitions and semantic mappings
```
### Compatibility with General theme mode

Color scheme controls should live in Appearance, including Theme mode. Implementation should move or replace the existing General Theme mode control if it currently exists. Compatibility for old `themeMode` preferences belongs in preference normalization and resolution tests, not in a duplicate visible control.
If implementation temporarily keeps a General Theme mode control to avoid a larger refactor, it must mirror the Appearance control exactly and include UI copy that avoids confusing users. The preferred final state for this enhancement is: General handles fonts and basics; Appearance handles all color scheme behavior.
### Testing approach

Use the checked-in test stack:
- Vitest for type helpers, preference normalization, theme conversion, and DOM theme application.
- React Testing Library for settings navigation and controls.
- Existing Tauri command mocks for persistence behavior.
- Playwright for an e2e smoke path when practical.
Target checks:
- `npm test` for unit and component tests.
- `npm run lint` for TypeScript compile checks.
- `npm run test:e2e` for the settings persistence smoke path if the existing e2e harness can isolate app data.
- `cargo test` if Rust preference command behavior changes. This enhancement should not need Rust changes unless the existing preferences primitive cannot store the extended object.
## Task decomposition

### Story A: Extend the color preference model

#### Task A.1: Add theme catalog and feature types

Description: Add typed theme mode constants, theme catalog metadata, Catppuccin accent constants, and theme feature types to the frontend theme or preferences module.
Acceptance criteria:
- Theme mode values are represented as a typed constant list.
- Shipped theme IDs are represented in a typed catalog with brightness metadata.
- The 14 Catppuccin accents are represented as a typed constant list.
- Display labels can be derived without duplicating invalid values.
- TypeScript rejects unsupported hard-coded values where possible.
Dependencies: none.
#### Task A.2: Normalize color preferences

Description: Extend preference normalization and defaults to support `appearance.lightTheme`, `appearance.darkTheme`, and `appearance.themeFeatures`.
Acceptance criteria:
- Missing Light theme resolves to Catppuccin Latte.
- Missing Dark theme resolves to Catppuccin Macchiato.
- Missing Catppuccin accent resolves to sapphire.
- Invalid theme IDs do not crash startup.
- Invalid accent values do not crash startup.
- Deprecated Catppuccin `flavor` input is handled safely.
- Unknown preference fields remain preserved through merge/write behavior.
- Unit tests cover valid, missing, invalid, and deprecated color preferences.
Dependencies: Task A.1.
#### Task A.3: Add resolved color-scheme helpers

Description: Add helpers that resolve concrete theme ID, brightness, and supported feature values from preferences plus system dark-mode state.
Acceptance criteria:
- `themeMode: "light"` resolves to the selected Light theme.
- `themeMode: "dark"` resolves to the selected Dark theme.
- `themeMode: "system"` resolves from `prefers-color-scheme`.
- Explicit Light and Dark theme slots are preserved independently.
- Explicit Catppuccin accent takes precedence over default sapphire.
- Unit tests cover all resolution branches.
Dependencies: Task A.2.
### Story B: Encode, convert, and apply shipped themes

#### Task B.1: Add VS Code baseline conversion path

Description: Add a deterministic path for converting curated VS Code theme data into hm semantic theme tokens.
Acceptance criteria:
- Conversion maps the required hm semantic tokens from VS Code color fields.
- Conversion handles missing optional fields with documented fallbacks.
- Themes missing required contrast-critical fields are rejected or manually completed before shipping.
- Source attribution and license notes are captured for bundled non-Catppuccin themes.
- Tests cover at least one converted theme fixture.
Dependencies: Task A.1.
#### Task B.2: Add shipped theme token blocks

Description: Extend `src/styles.css` with token definitions for Catppuccin Latte, Frappé, Macchiato, Mocha, and selected popular VS Code themes.
Acceptance criteria:
- `data-theme="catppuccin-latte"` defines all tokens used by the app.
- `data-theme="catppuccin-frappe"` defines all tokens used by the app.
- `data-theme="catppuccin-macchiato"` defines all tokens used by the app.
- `data-theme="catppuccin-mocha"` defines all tokens used by the app.
- Each selected non-Catppuccin theme defines all required semantic tokens.
- Existing default Latte/Macchiato behavior continues to work.
- No component hard-codes theme-specific hex values.
Dependencies: Task B.1.
#### Task B.3: Apply concrete resolved theme to the document root

Description: Update theme application so the app writes the resolved theme and brightness to ``.
Acceptance criteria:
- Resolving Light mode writes `data-theme` to the selected Light theme ID and `data-theme-mode="light"`.
- Resolving Dark mode writes `data-theme` to the selected Dark theme ID and `data-theme-mode="dark"`.
- Resolving System mode writes deterministic attributes based on mocked or real OS preference.
- Startup applies the resolved theme after preferences load.
- Unit tests cover DOM attribute updates.
Dependencies: Task A.3, Task B.2.
#### Task B.4: Apply supported theme features to semantic colors

Description: Add feature application so Catppuccin accent or future declared features can affect semantic styling.
Acceptance criteria:
- Selecting each Catppuccin accent updates a root attribute or variable deterministically.
- `--color-primary` and `--color-focus` resolve through the selected Catppuccin accent or equivalent app semantic variables.
- Sapphire remains the fallback when no accent is selected.
- Non-Catppuccin themes are not forced to expose Catppuccin accent behavior.
- Unit tests cover default sapphire and two non-default accents.
Dependencies: Task A.3, Task B.2.
#### Task B.5: Verify contrast for core pairs

Description: Add documented contrast checks for core foreground/background and focus pairs across shipped themes.
Acceptance criteria:
- A test, script, or documented manual table covers the required core pairs.
- Any weak accent or theme usage is mitigated with non-color state, border, or adjusted foreground.
- The final implementation notes which contrast method was used.
Dependencies: Task B.2, Task B.4.
### Story C: Add the Appearance settings tab

#### Task C.1: Add settings category navigation

Description: Update the settings panel to support multiple categories and render General or Appearance.
Acceptance criteria:
- Sidebar shows General and Appearance.
- General remains reachable and keeps existing non-color controls.
- Appearance renders when selected.
- Active category is visible and exposed to assistive technology.
- Keyboard navigation works for category selection.
- Component tests cover switching categories.
Dependencies: none.
#### Task C.2: Build the theme mode control

Description: Add an Appearance Theme mode selector with System, Light, and Dark.
Acceptance criteria:
- All three mode names are available.
- Current mode is shown as selected.
- Changing mode updates React preference state through `onUpdatePreferences`.
- Changing mode updates the resolved document theme immediately through the normal app state path.
- Component tests cover selecting each mode.
Dependencies: Task A.3, Task C.1.
#### Task C.3: Build the Light and Dark theme controls

Description: Add Appearance theme selectors for the light and dark slots.
Acceptance criteria:
- Light theme control lists only light themes.
- Dark theme control lists only dark themes.
- Defaults are Catppuccin Latte and Catppuccin Macchiato when no preference exists.
- Current selections are shown by name.
- Changing a theme updates React preference state through `onUpdatePreferences`.
- Changing the currently resolved theme updates app styling immediately through the normal app state path.
- Component tests cover selecting a non-default Light theme and a non-default Dark theme when catalog options exist.
Dependencies: Task A.3, Task B.3, Task C.1.
#### Task C.4: Build supported feature controls

Description: Add Appearance controls for supported theme features, initially Catppuccin accent.
Acceptance criteria:
- Catppuccin Accent appears when relevant to the selected or resolved Catppuccin theme.
- All 14 accent names are available.
- Sapphire is selected by default when no preference exists.
- Current accent is shown by name and visible state.
- Changing accent updates React preference state through `onUpdatePreferences`.
- Changing accent updates primary/focus styling immediately when the resolved theme supports it.
- Component tests cover selecting a non-default accent.
Dependencies: Task A.3, Task B.4, Task C.1.
#### Task C.5: Add the color preview

Description: Add a compact preview in the Appearance tab that uses current semantic CSS variables.
Acceptance criteria:
- Preview shows resolver label, background, surface, text, subtext, border, primary, and focus treatment.
- Preview updates after mode, theme, or feature changes.
- Preview remains accessible and does not rely on color alone for selected state.
- Component tests assert preview labels/content render.
Dependencies: Task C.2, Task C.3, Task C.4.
### Story D: Persist and restore selections

#### Task D.1: Wire Appearance controls to preference persistence

Description: Use the existing `savePreferences` path for theme mode, theme slot, and feature changes.
Acceptance criteria:
- Theme mode changes call preference persistence with `appearance.themeMode` while preserving other appearance fields.
- Light theme changes call preference persistence with `appearance.lightTheme` while preserving other appearance fields.
- Dark theme changes call preference persistence with `appearance.darkTheme` while preserving other appearance fields.
- Feature changes call preference persistence with the relevant `appearance.themeFeatures` patch while preserving other appearance fields.
- Save failures use the existing non-blocking error pattern.
- Non-Tauri tests can update preferences without command failures.
Dependencies: Task C.2, Task C.3, Task C.4.
#### Task D.2: Restore color scheme at startup

Description: Ensure loaded preferences apply the resolved theme and supported features on app startup.
Acceptance criteria:
- Startup reads saved mode, theme slots, and feature settings through `loadPreferences`.
- The app applies the restored resolved theme to ``.
- The app applies restored brightness to ``.
- The app applies restored supported feature variables.
- Tests cover loading saved preferences from mocked preferences.
Dependencies: Task B.3, Task B.4, Task D.1.
#### Task D.3: Preserve old `themeMode` behavior

Description: Add compatibility tests and migration-safe behavior for existing `themeMode` preferences.
Acceptance criteria:
- Existing `themeMode` values still normalize correctly.
- Saved preferences without theme slots still produce the expected old light/dark behavior.
- Deprecated `flavor` values, if encountered, do not crash and map safely.
- New theme fields do not erase fonts or window state.
- Documentation or code comments explain the compatibility rule.
Dependencies: Task A.3, Task D.2.
### Story E: Test and validate the enhancement

#### Task E.1: Add unit tests for theme helpers

Description: Cover theme resolution, feature resolution, conversion helpers, and DOM application helpers.
Acceptance criteria:
- Tests cover System, Light, and Dark mode.
- Tests cover default Light and Dark themes.
- Tests cover every shipped theme ID.
- Tests cover default sapphire and at least two non-default Catppuccin accents.
- Tests cover invalid saved values through normalization.
- Tests reset document root attributes/styles between cases.
Dependencies: Tasks A and B.
#### Task E.2: Add component tests for Appearance settings

Description: Cover settings navigation and Appearance controls with React Testing Library.
Acceptance criteria:
- Test opens settings and selects Appearance.
- Test changes theme mode and verifies update callback/persistence patch.
- Test changes Light theme and verifies update callback/persistence patch.
- Test changes Dark theme and verifies update callback/persistence patch.
- Test changes Catppuccin accent when shown and verifies update callback/persistence patch.
- Test verifies accessible labels for controls.
- Axe coverage is added where practical using the existing test setup.
Dependencies: Tasks C and D.
#### Task E.3: Add or update e2e smoke coverage

Description: Extend the settings e2e path to cover color-scheme persistence.
Acceptance criteria:
- Test opens settings.
- Test selects a non-default mode, theme slot, and supported feature where catalog allows.
- Test closes and reloads or reopens the app in an isolated data environment.
- Test verifies the selected theme settings remain active.
- Test does not write to a real user preferences file unless the harness deliberately isolates app data.
Dependencies: Task D.2.
#### Task E.4: Run validation checks

Description: Run the relevant project checks after implementation.
Acceptance criteria:
- `npm test` passes.
- `npm run lint` passes.
- `npm run test:e2e` passes or any harness limitation is documented.
- `cargo test` passes if Rust code changes.
- Any contrast-check script or manual contrast table is recorded in the implementation notes.
Dependencies: Tasks E.1, E.2, E.3.
## Open questions

- Which 3-5 non-Catppuccin VS Code themes should ship first, considering license, popularity, light/dark coverage, and contrast quality?
- Should the initial implementation convert VS Code themes at build time, or should it include a runtime/backend converter to reuse for future import?
- Should Catppuccin Frappé be offered only as a Dark theme, or should the UI explain that the Catppuccin family has one light variant and three dark variants?
- Should the app remember the last selected settings category as a local preference, or should settings always open to General for predictability?
- Should contrast verification be an automated test using token values, a checked-in documented table, or both?
## Risks and mitigations

- **Confusing theme model** — Users may not understand mode plus separate Light/Dark slots. Mitigation: keep the resolver preview visible and label controls plainly.
- **VS Code mapping mismatch** — VS Code themes target editor surfaces and may not map perfectly to hm app surfaces. Mitigation: use a curated catalog, semantic mapping tests, and manual review instead of arbitrary import for this issue.
- **Licensing uncertainty** — Popular VS Code themes may have different redistribution terms. Mitigation: verify license and attribution before bundling, and skip themes that are unclear.
- **Weak accent or theme contrast** — Some accents or converted themes can be hard to see in certain usages. Mitigation: verify contrast and avoid color-only state; use borders, shape, and text labels.
- **Startup flash** — React applies preferences after load, so users may briefly see a default theme. Mitigation: apply the resolved theme as early as practical and keep existing CSS media defaults sensible.
- **Duplicated token lists** — Theme IDs and feature values can drift between CSS, TypeScript, and tests. Mitigation: centralize valid values in TypeScript and keep CSS selectors named exactly after those values.
- **Tailwind runtime variable limits** — Tailwind v4 `@theme` mappings may not behave as expected with dynamic theme or accent indirection. Mitigation: use CSS custom properties as the semantic layer and point utilities at those variables.
## Related references

- Source issue: [https://github.com/markdstafford/hm/issues/6](https://github.com/markdstafford/hm/issues/6)
- Depends on issue #5: App preferences and settings UI shell
- Depends on issue #4: Settings storage primitives
- ADR-008: Settings split
- App spec: Design guidance, Colors section
- Catppuccin palette: [https://github.com/catppuccin/catppuccin](https://github.com/catppuccin/catppuccin)
- VS Code color theme documentation: [https://code.visualstudio.com/api/extension-guides/color-theme](https://code.visualstudio.com/api/extension-guides/color-theme)