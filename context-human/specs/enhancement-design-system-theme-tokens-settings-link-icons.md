---
created: 2026-05-31
last_updated: 2026-05-31
status: complete
issue: 77
issue_url: [https://github.com/markdstafford/hm/issues/77](https://github.com/markdstafford/hm/issues/77)
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Design system theme tokens, accent settings, sentiment colors, and link-type icons

## What

`hm` needs to expand its design system so theme accents, sentiment, confidence hints, and relationship kinds carry separate meanings. Today the theme system supports a single user-chosen Catppuccin primary accent through `--hm-accent`, and `ConfidenceChip` uses primary styling for high-confidence values. That makes the chosen accent do too much: it marks focus, links, selected states, primary actions, positive or negative sentiment, and categorical hints.
This enhancement adds a theme-neutral secondary-highlight token family for relevance and confidence hints, adds semantic sentiment colors for good / ok / bad evaluations, adds a user-configurable primary / secondary / accent color model that works across all shipped themes, and adds shape-based icons for `source`, `local`, and `suggested` connection kinds. It also updates `context-agent/design-system.md` so future UI work does not reuse the primary accent for category meaning.
After this enhancement, users can choose primary and secondary accent colors in Settings → Appearance without breaking theme contrast. Components use primary for app emphasis and user intent, secondary highlight for confidence and relevance hints, sentiment colors for explicit good / ok / bad meaning, and icon shape for link type. The connections and preview concepts can rely on these contracts when they ship their UI.
## Why

The preview and connections concepts define two important visual rules: categorical meaning should be carried by icon shape, and secondary emphasis should use a theme-neutral highlight instead of the chosen accent. Issue #77 is the design-system work that makes those rules implementable before connections, hint styling, and related-item surfaces start depending on them.
Without this enhancement, new features will keep borrowing `text-primary` and `bg-primary/15` for confidence, relevance, source/local/suggested distinctions, good/ok/bad states, and ordinary selected states. That creates ambiguity. A user who chooses a green primary accent should not see green become synonymous with "high confidence," "suggested link," "source-backed link," or "good outcome."
This work also finishes the appearance model started by color-scheme configuration. The current code already has theme mode, light/dark theme selection, a Catppuccin accent setting, and non-Catppuccin themes. Issue #77 broadens that model from "Catppuccin accent only" to a small, theme-safe set of configurable accents that every theme can expose consistently.
## Personas

- **Elena: EM** — scans backlog hygiene suggestions and future connections. She needs confidence and relationship hints to be readable without confusing them with selected rows or primary actions.
- **Priya: PM** — prepares screenshots and wants a theme that matches her working style. She wants accent choices to feel personal without changing the meaning of UI categories.
- **Tarek: Team member** — moves through previews and relationship rows quickly. He needs source, local, and suggested links to be distinguishable by glyph even in a theme with low color saturation or for color-blind users.
- **Sam: Maintainer reviewing health signals** — scans future summary surfaces that label items as good, ok, or bad. He needs those evaluations to use stable sentiment colors that are paired with text and do not depend on a user-selected accent.
- **Future preview/connections implementer** — needs stable token names, icon contracts, and component seams before building the connections region from `context-human/concepts/connections.md`.
- **Maintainer** — needs the design-system maintenance contract updated with the new tokens, settings, and icon guidance so future PRs do not rediscover the same rules.
## Narratives

### Priya configures accents without changing meaning

Priya opens Settings → Appearance. She keeps Theme mode set to System, leaves her light and dark theme pair unchanged, and expands an `Accent colors` section. The section explains that primary controls selected states, focus, links, and primary actions, while secondary highlight is used for relevance and confidence hints.
She changes Primary from Sapphire to Lavender and Secondary from Blue to Teal. The preview updates immediately. Primary buttons, links, focus rings, and selected examples change to Lavender. The confidence sample and relevance hint use the secondary-highlight style instead of becoming a second primary action.
Priya quits and reopens `hm`. Her theme pair, primary accent, and secondary accent are still configured. Nothing in the UI implies that Lavender means "high confidence" or that Teal means a specific link type.
### Tarek reads connection kinds by shape

Tarek opens an item preview after the connections region ships. The region lists source-backed Jira links, hm-local cross-system links, and suggested related items. Each row uses the same text and spacing, but the leading glyph differs: source links use a chain shape, local links use a cross-system shape, and suggested links use a sparkle.
Tarek can tell which rows are authoritative links and which rows are suggestions without relying on color. Suggested rows also show `83% related` in a secondary-highlight chip. The chip is visibly a hint, not a selected state or primary action.
### Elena scans confidence without fighting her theme

Elena reviews Backlog hygiene suggestions. High-confidence and medium-confidence rows still show confidence values, but they use the same secondary-highlight token family as suggested connections. The value is readable in both GitHub Light and Catppuccin Macchiato, and it does not take on the meaning of her selected primary accent.
When Elena changes her primary accent later, confidence chips remain confidence hints. Selection, focus, and action emphasis change with her primary choice; confidence and relatedness stay visually secondary.
### Sam reads sentiment without redefining accents

Sam reviews a future health summary that classifies rows as `Good`, `Ok`, or `Bad`. Good uses the design-system good sentiment treatment, ok uses the ok treatment, and bad uses the bad treatment. Each label includes visible text and an accessible name, so the color reinforces meaning but does not carry it alone.
When Sam changes the primary accent to Green, the good sentiment color does not become the primary accent and primary buttons do not become health indicators. Accent colors still express user intent and app emphasis; sentiment colors express domain evaluation.
### A future implementer builds from a documented contract

A future implementer starts the connections region. They read `context-agent/design-system.md` and find the token table for primary, secondary, secondary-highlight, and good/ok/bad sentiment colors plus the icon contract for `source`, `local`, and `suggested` links.
They do not add ad hoc colors or choose new glyphs inside the feature. They import the shared link-kind icon mapping, use the secondary-highlight utility or component for relevance hints, and use the sentiment token family only when a value explicitly means good, ok, or bad. Their PR updates only feature-specific details instead of redefining the design-system language.
## User stories

**Priya configures theme accents**
- Priya can open Settings → Appearance and see a clear accent-color section.
- Priya can choose a primary accent from a small curated set.
- Priya can choose a secondary accent from a small curated set.
- Priya can see a live preview of primary, secondary, and secondary-highlight examples before leaving settings.
- Priya can trust that accent changes apply immediately when they affect the resolved theme.
- Priya can quit and reopen `hm` and find her accent choices preserved.
**Tarek distinguishes connection kinds**
- Tarek can distinguish `source`, `local`, and `suggested` connection rows by icon shape.
- Tarek can understand the icon meaning from accessible labels and tooltips where the icon appears alone.
- Tarek can read suggested relevance values in a secondary-highlight chip.
- Tarek can use the UI when color alone is unavailable or ambiguous.
**Elena reads confidence and relevance hints**
- Elena can see confidence and relevance values styled as secondary hints rather than primary actions.
- Elena can change her primary accent without changing what confidence and relevance mean.
- Elena can use the same hint styling in Backlog hygiene and future connections surfaces.
**Sam reads good/ok/bad sentiment**
- Sam can distinguish explicit good, ok, and bad evaluations through stable sentiment treatments.
- Sam can rely on visible text or labels so color is never the only sentiment indicator.
- Sam can change primary and secondary accents without changing the meaning of good, ok, or bad.
**Maintainer extends the design system**
- Maintainer can find the new token contract in `context-agent/design-system.md`.
- Maintainer can add or use link-kind icons through one shared mapping instead of per-feature glyph choices.
- Maintainer can use documented sentiment colors instead of inventing feature-local greens, yellows, or reds.
- Maintainer can verify token fallback behavior for every shipped theme.
- Maintainer can run unit and component tests that protect preference normalization, DOM application, and contrast-sensitive components.
## Goals

- Add semantic tokens for secondary accent and secondary-highlight styling.
- Add semantic sentiment color tokens for good, ok, and bad states.
- Keep primary accent focused on focus rings, selected states, links, and primary actions.
- Move confidence and relevance hints off `text-primary` / `bg-primary/15` and onto secondary-highlight styling.
- Keep sentiment colors independent from user-configurable primary and secondary accents.
- Extend appearance preferences with primary and secondary accent selections that work across all shipped themes.
- Keep existing Catppuccin `themeFeatures.catppuccin.accent` preferences compatible by mapping them to the new primary accent model.
- Provide safe defaults for every existing theme: Catppuccin Latte, Frappé, Macchiato, Mocha, GitHub Light, GitHub Dark, Solarized Light, and Dracula.
- Add a live Appearance preview that shows primary, secondary, secondary-highlight, and link-kind icon examples.
- Add a shared link-kind icon mapping for `source`, `local`, and `suggested` connection kinds.
- Ensure link-kind meaning comes from icon shape, text, and accessible labels, not from color.
- Update `context-agent/design-system.md` in the implementation PR with tokens, settings behavior, sentiment color rules, `ConfidenceChip`, and link-kind icon rules.
- Cover preference normalization, theme resolution, DOM token application, settings interactions, component styling, and accessibility with tests.
## Non-goals

- No arbitrary hex color picker.
- No user-imported theme files or remote theme marketplace.
- No full theme editor.
- No new connection-region feature beyond the shared icon contract and optional preview/example rendering.
- No relationship storage, link creation flow, or source-system mutation.
- No color-only distinction for source/local/suggested links.
- No color-only distinction for good/ok/bad sentiment; sentiment colors must be paired with text, labels, icons, or other non-color cues.
- No change to source credentials, AI provider credentials, Jira ingestion, collection filtering, or SQLite source data.
- No guarantee that every possible accent pair is allowed; the app may restrict combinations to maintain contrast.
## Design spec

### Information architecture

This enhancement stays inside Settings → Appearance and shared UI primitives. It does not add a new route or sidebar item.
```plain text
Settings
└── Appearance
    ├── Theme mode
    ├── Theme pair
    ├── Accent colors
    │   ├── Primary accent
    │   └── Secondary accent
    └── Preview
        ├── Primary action / selected state / link / focus sample
        ├── Secondary-highlight confidence and relevance samples
        ├── Good / ok / bad sentiment samples
        └── Source / local / suggested link-kind icon samples
```
### Appearance settings layout

The current Appearance category should keep its compact settings-row structure. Add `Accent colors` below the light/dark theme pair and above the preview. The section should be plain and direct:
```plain text
Appearance
Theme mode
[System (follow OS) v]

Light theme
[Catppuccin Latte v]

Dark theme
[Catppuccin Macchiato v]

Accent colors
Primary accent
[ Sapphire v ]
Used for focus, selected states, links, and primary actions.

Secondary accent
[ Teal v ]
Used to build neutral relevance and confidence highlights.

Preview
┌────────────────────────────────────────────┐
│ Primary link  [Primary action]             │
│ [Selected row]  Focus ring sample          │
│ 83% related     91% confidence             │
│ Good status     Ok status     Bad status   │
│ 🔗 Source link  ⛓ Local link  ✦ Suggested  │
└────────────────────────────────────────────┘
```
If the final glyph for local links differs from the sketch, prefer the shared icon mapping below over the sketch. The preview should demonstrate meaning, not invent a separate mini component.
### Accent color controls

Primary and secondary accent controls can use the existing `Select` primitive for this issue. A swatch grid is acceptable if it uses existing primitives and remains accessible, but it is not required.
The allowed accent set should be small and curated. For Catppuccin themes, the existing fourteen Catppuccin accents can remain available. For non-Catppuccin themes, either expose the same semantic accent names mapped to theme-specific values, or expose a smaller shared set such as Blue, Purple, Green, Teal, Yellow, Peach, and Red. In both cases, saved values must be stable semantic ids, not raw hex values.
The UI should prevent or normalize invalid choices. If a theme cannot provide a selected accent id, it falls back to that theme's default primary or secondary accent without crashing or writing a secret or raw color value.
### Token meaning

Use the following meanings consistently:

Token family
Meaning
Examples

Primary
User intent, active focus, selected state, primary action
Links, focus rings, active nav, primary buttons

Secondary accent
A second user-configurable accent available to components that need a contrasting accent without redefining meaning
Optional chart pair, preview sample, secondary decorative emphasis

Secondary highlight
Theme-neutral hint treatment built from secondary/surface tokens
Confidence chips, relevance hints, suggested relatedness

Sentiment colors
Explicit good / ok / bad evaluation, always paired with text or labels
Health summaries, quality checks, outcome badges

Status colors
Domain status where color is already conventional and paired with text
destructive red, warning yellow, success green

Link-kind icons
Connection kind meaning
source/local/suggested rows

`secondary-highlight` is a treatment, not a new category color. It should read as a muted bordered chip in both light and dark themes.
Sentiment colors are semantic and non-configurable. They should not be aliases for the user-selected primary or secondary accent, even when a user chooses green, yellow, or red accents. Use sentiment only when the UI explicitly communicates an evaluative meaning:

Sentiment
Meaning
Suggested color family
Usage rule

`good`
Positive, healthy, complete, or recommended outcome
Green
Pair with visible text such as `Good`, `Healthy`, or `Complete`

`ok`
Neutral, acceptable, warning-adjacent, or needs attention but not bad
Amber / yellow
Pair with visible text such as `Ok`, `Needs review`, or `Acceptable`

`bad`
Negative, blocked, failed, risky, or destructive-adjacent outcome
Red
Pair with visible text such as `Bad`, `Blocked`, or `Failed`

Sentiment colors may share palette families with broader success/warning/destructive status colors, but the token names should preserve the good/ok/bad semantic contract. If existing destructive or warning tokens are reused internally, expose sentiment aliases so feature code does not need to infer meaning from generic palette names.
### Link-kind icon contract

Add one shared mapping for connection kind icons. Suggested glyphs use Lucide React:

Kind
Icon shape
Meaning
Color rule

`source`
`Link2` or chain-link shape
The source system holds this real link
Use neutral text/subtext; do not assign a special color

`local`
`Network`, `GitBranch`, or cross-system shape
`hm` holds this real local link because sources cannot represent it
Use neutral text/subtext; distinguish by shape

`suggested`
`Sparkles`
Computed related item, not a real link yet
Use neutral text/subtext; confidence uses secondary-highlight

Every icon-only use must include an accessible label such as `Source link`, `Local link`, or `Suggested link`. Rows that include visible text may mark the decorative icon `aria-hidden` if the text already names the kind.
### Confidence and relevance chips

`ConfidenceChip` should stop using `bg-primary/15 text-primary` for high values. High and low confidence may still differ by text, percentage, tone, or subtle border weight, but neither state should co-opt the primary accent.
Suggested behavior:
- All confidence/relevance chips use `bg-secondary-highlight`, `text-secondary-highlight`, and `border-secondary-highlight` or equivalent utilities.
- Values still clamp to 0–100 and use tabular numbers.
- Optional intensity can use opacity or border style, not a distinct categorical color.
- Screen readers get the numeric value from text; no color-only state is required.
### Accessibility

- Accent selects have explicit labels and descriptions.
- Any swatch, if added, has an accessible text label and does not rely on background color alone.
- The preview examples are either labelled as examples or hidden from assistive tech when redundant.
- Link-kind icons are announced when their shape is the only visible kind indicator.
- Secondary-highlight chips meet WCAG AA text contrast against their chip background and surrounding surfaces.
- Good, ok, and bad sentiment examples include visible text or accessible labels; color never carries sentiment alone.
- Sentiment text and badges meet WCAG AA contrast against their backgrounds in every shipped theme.
- Focus rings remain visible for every shipped theme and selected primary accent.
## Tech spec

### Prerequisites and references

- Issue #77 — GitHub issue for this enhancement.
- `context-human/specs/feature-color-scheme-configuration.md` — current Appearance settings and theme catalog direction.
- `context-human/concepts/preview.md` — visual conventions for secondary highlight and categorical icon shape.
- `context-human/concepts/connections.md` — `source`, `local`, and `suggested` connection kinds.
- `context-agent/design-system.md` — token, primitive, icon, and maintenance contract source of truth.
- ADR-008 — appearance settings are per-user preferences in the OS config file.
- Current implementation seams: `src/theme.ts`, `src/styles.css`, `src/preferences/index.ts`, `src/features/settings/appearance/AppearanceCategory.tsx`, and `src/ui/data/ConfidenceChip.tsx`.
### Current state

The code already has:
- Theme catalog entries for Catppuccin Latte, Frappé, Macchiato, Mocha, GitHub Light, GitHub Dark, Solarized Light, and Dracula.
- Appearance preferences for `themeMode`, `lightTheme`, `darkTheme`, `themeFeatures.catppuccin.accent`, `uiFont`, and `monoFont`.
- `applyColorScheme()` setting `data-theme`, `data-theme-mode`, `data-accent`, and `--hm-accent`.
- Tailwind v4 tokens in `@theme`, including `--color-primary` and `--color-focus` mapped to `--hm-accent` for Catppuccin themes.
- `ConfidenceChip` using primary styling for high-confidence values.
This enhancement should extend those seams instead of creating a second theme system.
### Preference model

Extend appearance preferences with explicit accent settings. Keep backward compatibility with the existing Catppuccin field.
Suggested shape:
```typescript
type AccentId =
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
    accents?: {
      primary?: AccentId;
      secondary?: AccentId;
    };
    themeFeatures?: {
      catppuccin?: { accent?: AccentId }; // deprecated compatibility path
      [themeFamily: string]: unknown;
    };
    uiFont?: string;
    monoFont?: string;
  };
};
```
Rules:
1. `appearance.accents.primary` is the canonical new primary accent.
2. `appearance.accents.secondary` is the canonical secondary accent.
3. Existing `themeFeatures.catppuccin.accent` remains accepted and maps to `accents.primary` when no explicit primary is saved.
4. New writes should prefer `appearance.accents` and may also write the deprecated Catppuccin field for one release if that keeps older code paths safe.
5. Invalid accent ids normalize to defaults.
6. Default primary remains `sapphire` to preserve current behavior.
7. Default secondary should be a distinct readable accent such as `teal` or `blue`; choose one and document it in the design system.
### Theme token model

Add CSS custom properties for accent resolution and secondary highlight treatment.
Suggested root variables:
```css
--hm-primary-accent: var(--ctp-sapphire);
--hm-secondary-accent: var(--ctp-teal);
--color-primary: var(--hm-primary-accent);
--color-focus: var(--hm-primary-accent);
--color-secondary: var(--hm-secondary-accent);
--color-secondary-highlight-bg: color-mix(in oklch, var(--hm-secondary-accent) 14%, var(--color-surface));
--color-secondary-highlight-text: var(--color-text);
--color-secondary-highlight-border: color-mix(in oklch, var(--hm-secondary-accent) 45%, var(--color-border));
--color-sentiment-good-bg: color-mix(in oklch, var(--hm-sentiment-good) 14%, var(--color-surface));
--color-sentiment-good-text: var(--hm-sentiment-good-text);
--color-sentiment-good-border: color-mix(in oklch, var(--hm-sentiment-good) 45%, var(--color-border));
--color-sentiment-ok-bg: color-mix(in oklch, var(--hm-sentiment-ok) 16%, var(--color-surface));
--color-sentiment-ok-text: var(--hm-sentiment-ok-text);
--color-sentiment-ok-border: color-mix(in oklch, var(--hm-sentiment-ok) 45%, var(--color-border));
--color-sentiment-bad-bg: color-mix(in oklch, var(--hm-sentiment-bad) 14%, var(--color-surface));
--color-sentiment-bad-text: var(--hm-sentiment-bad-text);
--color-sentiment-bad-border: color-mix(in oklch, var(--hm-sentiment-bad) 45%, var(--color-border));
```
If Tailwind's generated utilities cannot consume `color-mix()` reliably in the current toolchain, use explicit per-theme token values instead. The contract matters more than the implementation syntax.
For non-Catppuccin themes, add theme-local variables that define each supported semantic accent id, or map the primary/secondary choices through TypeScript to theme-specific CSS values. Do not require non-Catppuccin themes to define `--ctp-*` variables.
Sentiment base variables (`--hm-sentiment-good`, `--hm-sentiment-ok`, `--hm-sentiment-bad`, plus readable text variables) should be defined per theme or derived from theme-local palette values. They are not user preferences and should not be set by `applyColorScheme()` from accent ids.
### DOM application

Update `applyColorScheme()` or a sibling helper so the resolved color scheme includes accent ids:
```typescript
type ResolvedColorScheme = {
  themeId: ThemeId;
  brightness: "light" | "dark";
  primaryAccent: AccentId;
  secondaryAccent: AccentId;
};
```
Apply to the document root:
```typescript
root.dataset.theme = input.themeId;
root.dataset.themeMode = input.brightness;
root.dataset.primaryAccent = input.primaryAccent;
root.dataset.secondaryAccent = input.secondaryAccent;
root.style.setProperty("--hm-primary-accent", resolveAccentVar(input.themeId, input.primaryAccent));
root.style.setProperty("--hm-secondary-accent", resolveAccentVar(input.themeId, input.secondaryAccent));
```
Keep `data-accent` and `--hm-accent` as compatibility aliases only if existing code or tests still expect them. New components should use `--color-primary`, `--color-secondary`, and secondary-highlight tokens.
### Theme catalog and accent resolution

Add typed helpers in `src/theme.ts`:
- `ACCENT_OPTIONS` or `THEME_ACCENT_OPTIONS`.
- `DEFAULT_PRIMARY_ACCENT`.
- `DEFAULT_SECONDARY_ACCENT`.
- `isAccentId(value)`.
- `resolveThemeAccent(themeId, accentId, role)`.
- `SENTIMENT_TONES` or equivalent typed metadata for `good`, `ok`, and `bad` if TypeScript helpers are needed outside CSS.
- `themeSupportsAccent(themeId, accentId)` if support varies by theme.
Keep the catalog simple. The first implementation can support the same accent ids across all themes by mapping ids to theme-specific hex values in CSS or TypeScript. If that is too large, support a smaller shared set and normalize unsupported old Catppuccin-only values to the closest supported accent for non-Catppuccin resolved themes.
### Appearance UI

Update `src/features/settings/appearance/AppearanceCategory.tsx`:
- Read normalized `primaryAccent` and `secondaryAccent` from preferences.
- Render two settings rows for accent colors.
- Persist changes through `onUpdatePreferences({ appearance: { accents: { ... } } })`.
- Keep the old Catppuccin accent row only if needed for backward compatibility, but prefer replacing it with the new primary/secondary controls.
- Add a preview card showing primary, secondary, secondary-highlight, good/ok/bad sentiment, and link-kind icon samples.
Be careful with `mergePreferences()`: it currently merges `themeFeatures` specially. Add equivalent nested merge behavior for `appearance.accents` so saving secondary does not erase primary.
### Shared link-kind icons

Add a small source of truth, for example:
```plain text
src/views/connections/linkKindIcons.tsx
```
or, if the connections feature is not present yet:
```plain text
src/ui/data/linkKindIcons.tsx
```
Suggested type:
```typescript
export type LinkKind = "source" | "local" | "suggested";

export const LINK_KIND_META: Record = {
  source: { label: "Source link", description: "Stored in the source system", Icon: Link2 },
  local: { label: "Local link", description: "Stored only in hm", Icon: Network },
  suggested: { label: "Suggested link", description: "Computed related item", Icon: Sparkles },
};
```
Use this mapping in the Appearance preview now, and future connection rows can import the same mapping. Do not couple this mapping to storage until connection data types exist.
### Component updates

Update `ConfidenceChip` so it uses the secondary-highlight token family. Preserve the existing API (`value`, `className`) unless implementation needs an optional label for relevance chips.
If relevance chips need copy like `83% related`, either add a new `RelevanceChip` wrapper or allow `ConfidenceChip` to accept a suffix. Do not overload confidence semantics in a way that makes existing hygiene tests unclear.
Suggested split:
- `ConfidenceChip` — displays `N%` for confidence.
- `SecondaryHighlightChip` — generic token-styled chip for `83% related`, `same project`, or future hints.
- `ConfidenceChip` composes `SecondaryHighlightChip`.
If a component needs explicit good/ok/bad evaluation, add a small sentiment badge/chip seam rather than styling `SecondaryHighlightChip` with ad hoc green/yellow/red classes. Suggested type:
```typescript
export type SentimentTone = "good" | "ok" | "bad";
```
The sentiment component should require visible content or an accessible label, use `bg-sentiment-{tone}`, `text-sentiment-{tone}`, and `border-sentiment-{tone}` or equivalent token-backed classes, and avoid implying that confidence or relevance is good/bad unless the product copy explicitly says so.
### Design-system document update

The implementation PR must update `context-agent/design-system.md`:
- Token table: primary, secondary, secondary-highlight bg/text/border.
- Token table: sentiment good/ok/bad bg/text/border roles.
- Color rules: primary is user intent; secondary-highlight is for relevance/confidence hints; sentiment is for explicit good/ok/bad evaluation; category meaning uses icon shape.
- Appearance settings: primary and secondary accent controls, preference path, compatibility note for old Catppuccin accent.
- Icons: `source`, `local`, and `suggested` link-kind mapping.
- Data components: `ConfidenceChip` uses secondary-highlight, not primary.
- Data components: any sentiment badge uses the sentiment token family, not primary, secondary-highlight, or one-off palette classes.
- Maintenance contract note: future shared tokens, theme roles, or recurring icon-kind mappings require a same-PR doc update.
## Security, privacy, and compliance

- Accent preferences are non-secret per-user UI preferences and belong in the OS config file per ADR-008.
- Do not write credentials, token-shaped values, source URLs, issue titles, or source data into theme preferences.
- This enhancement makes no network calls and adds no telemetry.
- Link-kind icons are presentational metadata only; they do not create or remove source-system links.
- Logs should not include raw preference files unless existing preference debugging already redacts safely.
## Testing plan

### Unit tests

- `normalizePreferences()` accepts old `themeFeatures.catppuccin.accent` and maps it to canonical primary accent when needed.
- `normalizePreferences()` preserves valid `appearance.accents.primary` and `appearance.accents.secondary`.
- Invalid accent ids fall back to documented defaults.
- `mergePreferences()` merges nested `appearance.accents` without dropping the other accent.
- `resolveTheme()` or the new color-scheme resolver returns primary and secondary accent ids.
- Accent resolution handles every shipped theme.
- `applyColorScheme()` sets `data-primary-accent`, `data-secondary-accent`, and CSS variables.
- Compatibility aliases (`data-accent`, `--hm-accent`) remain or are intentionally removed with updated tests.
- Sentiment tokens for good, ok, and bad are present for every shipped theme and are independent of accent preference normalization.
- Link-kind metadata contains exactly `source`, `local`, and `suggested` with labels and icons.
### Component tests

- Appearance settings render Primary accent and Secondary accent controls.
- Changing Primary accent calls `onUpdatePreferences()` with the correct nested patch.
- Changing Secondary accent does not erase Primary accent.
- The Appearance preview renders primary, secondary-highlight, and link-kind examples.
- The Appearance preview renders good, ok, and bad sentiment examples.
- `ConfidenceChip` clamps values and uses secondary-highlight classes/tokens rather than primary classes.
- Any generic secondary-highlight chip renders text and optional suffix accessibly.
- Any sentiment badge/chip renders text or an accessible label and uses sentiment classes/tokens rather than primary or secondary-highlight classes.
- Link-kind icons have accessible names when rendered as standalone examples.
### Accessibility tests

- Appearance category has no axe violations.
- Accent controls are labelled and described.
- Icon-only link-kind examples have accessible labels.
- Sentiment examples have visible text or accessible labels and do not rely on color alone.
- Keyboard users can reach and change accent controls through existing `Select` behavior.
- Focus rings remain visible after changing primary accent.
### Visual and contrast verification

For each shipped theme, verify:
- Primary accent on focus ring is visible against background and surface.
- Primary action foreground/background pair meets WCAG AA where primary is used as a filled background.
- Secondary-highlight chip text meets WCAG AA against its chip background.
- Secondary-highlight border is visible against the surrounding surface.
- Good, ok, and bad sentiment text meets WCAG AA against its sentiment background.
- Good, ok, and bad sentiment borders remain visible against the surrounding surface.
- Link-kind icons remain readable in neutral text/subtext.
Document the verification outcome in comments near theme token definitions or in the design-system doc, following the existing contrast-comment style in `src/styles.css`.
### Regression tests

- Existing Appearance tests for theme mode, light theme, dark theme, and Catppuccin accent compatibility keep passing after updates.
- Existing `ConfidenceChip` tests are updated to assert the new token contract.
- Any existing or new good/ok/bad UI tests assert sentiment tokens rather than primary/accent styling.
- Existing theme application tests for `data-theme` and `data-theme-mode` keep passing.
- Existing settings navigation and persistence tests keep passing.
## Risks and mitigations

- **Accent model grows too large.** A full color editor would slow the issue down. Mitigate by using stable semantic accent ids and a curated option list.
- **Non-Catppuccin accent mapping is inconsistent.** Mitigate by documenting per-theme defaults and testing every shipped theme.
- **Secondary-highlight contrast fails in one theme.** Mitigate by allowing explicit per-theme highlight tokens instead of relying only on `color-mix()`.
- **Sentiment colors fail contrast or blur with accents.** Mitigate with explicit per-theme good/ok/bad bg/text/border tokens and tests that prove they do not read from user accent preferences.
- **Compatibility with old Catppuccin preferences regresses.** Mitigate with normalization tests and optional compatibility aliases for one release.
- **Icon mapping lands before connection storage exists.** Keep the mapping presentational and type-local. Do not invent storage schemas in this issue.
- **Primary and secondary meanings blur.** Update the design-system doc and tests so confidence/relevance components cannot silently return to primary styling.
## Task decomposition

- [ ] **Story: Extend theme preference and resolution model**
	- [ ] **Task: Add canonical accent preference types**
		- **Description:** Extend `src/preferences/index.ts` with `appearance.accents.primary` and `appearance.accents.secondary`, typed accent ids, defaults, and normalization.
		- **Acceptance criteria:**
			- [ ] Valid primary and secondary accent ids survive normalization.
			- [ ] Invalid accent ids fall back to documented defaults.
			- [ ] Existing `themeFeatures.catppuccin.accent` maps to canonical primary when no primary is saved.
			- [ ] Defaults preserve current sapphire primary behavior.
		- **Dependencies:** Existing preferences module and theme accent list.
	- [ ] **Task: Merge nested accent preference patches safely**
		- **Description:** Update `mergePreferences()` so partial accent patches do not erase sibling accent settings.
		- **Acceptance criteria:**
			- [ ] Saving secondary preserves primary.
			- [ ] Saving primary preserves secondary.
			- [ ] Existing theme features and collection preferences still merge as before.
		- **Dependencies:** Canonical accent preference type.
	- [ ] **Task: Resolve accents for all shipped themes**
		- **Description:** Add theme helpers that validate accent ids and map primary/secondary roles to CSS values or CSS variables for every catalog theme.
		- **Acceptance criteria:**
			- [ ] Catppuccin themes support the existing accent ids.
			- [ ] GitHub Light, GitHub Dark, Solarized Light, and Dracula resolve safe primary and secondary accents.
			- [ ] Unsupported values normalize or fall back without crashing.
		- **Dependencies:** Theme catalog in `src/theme.ts`.
- [ ] **Story: Add CSS token contract**
	- [ ] **Task: Add primary, secondary, secondary-highlight, and sentiment tokens**
		- **Description:** Update `src/styles.css` token definitions so components can use `--color-primary`, `--color-secondary`, secondary-highlight bg/text/border tokens, and good/ok/bad sentiment bg/text/border tokens.
		- **Acceptance criteria:**
			- [ ] Existing primary/focus behavior remains visually compatible.
			- [ ] Secondary accent token exists for all themes.
			- [ ] Secondary-highlight bg/text/border tokens exist for all themes.
			- [ ] Good, ok, and bad sentiment bg/text/border tokens exist for all themes.
			- [ ] Sentiment tokens are not driven by user-selected primary or secondary accents.
			- [ ] Tailwind utilities or explicit classes can consume the new tokens.
		- **Dependencies:** Accent resolution decisions.
	- [ ] **Task: Apply accent variables at runtime**
		- **Description:** Update `applyColorScheme()` to set primary and secondary accent datasets and CSS variables, with compatibility aliases as needed.
		- **Acceptance criteria:**
			- [ ] Root element gets resolved theme, mode, primary accent, and secondary accent state.
			- [ ] Changing accent settings updates the live DOM without reload.
			- [ ] Existing tests for theme application are updated and passing.
		- **Dependencies:** CSS token additions.
	- [ ] **Task: Verify contrast for shipped themes**
		- **Description:** Check core primary, secondary-highlight, and good/ok/bad sentiment pairings for every shipped theme and document any explicit per-theme values.
		- **Acceptance criteria:**
			- [ ] Secondary-highlight text contrast passes WCAG AA in each theme.
			- [ ] Good, ok, and bad sentiment text contrast passes WCAG AA in each theme.
			- [ ] Focus rings remain visible in each theme.
			- [ ] Filled primary controls retain readable `--color-on-primary` behavior.
		- **Dependencies:** Token implementation.
- [ ] **Story: Update Appearance settings UI**
	- [ ] **Task: Replace Catppuccin-only accent UI with accent color controls**
		- **Description:** Update `AppearanceCategory` to render Primary accent and Secondary accent controls that write canonical preference patches.
		- **Acceptance criteria:**
			- [ ] Primary and secondary controls are visible in Settings → Appearance.
			- [ ] Controls use stable semantic accent ids.
			- [ ] Catppuccin compatibility remains covered by normalization, not by a separate user-facing legacy control unless needed.
			- [ ] Saves go through existing `onUpdatePreferences()`.
		- **Dependencies:** Preference model and theme helpers.
	- [ ] **Task: Add Appearance preview examples**
		- **Description:** Add a compact preview card showing primary action/link/focus, secondary-highlight confidence/relevance, good/ok/bad sentiment, and link-kind icons.
		- **Acceptance criteria:**
			- [ ] Preview updates when primary or secondary accent changes.
			- [ ] Preview labels clarify what each role means.
			- [ ] Preview uses shared tokens and icon mapping.
			- [ ] Preview sentiment examples use sentiment tokens and visible text.
			- [ ] Appearance component tests cover the examples.
		- **Dependencies:** Token contract and link-kind metadata.
	- [ ] **Task: Preserve Appearance accessibility**
		- **Description:** Ensure the new controls and preview are labelled, keyboard reachable, and axe-clean.
		- **Acceptance criteria:**
			- [ ] Accent controls have accessible names.
			- [ ] Descriptions explain primary vs secondary roles.
			- [ ] Axe tests pass for Appearance.
		- **Dependencies:** UI updates.
- [ ] **Story: Add secondary-highlight and link-kind component seams**
	- [ ] **Task: Add shared sentiment badge styling**
		- **Description:** Add a reusable `SentimentBadge`, `SentimentChip`, or equivalent class contract for explicit `good`, `ok`, and `bad` evaluations.
		- **Acceptance criteria:**
			- [ ] The seam supports exactly `good`, `ok`, and `bad` tones unless a future spec expands it.
			- [ ] Each tone uses sentiment tokens rather than primary, secondary-highlight, or ad hoc palette classes.
			- [ ] Rendered sentiment includes visible text or an accessible label.
			- [ ] Tests cover token class usage and non-color sentiment cues.
		- **Dependencies:** CSS tokens.
	- [ ] **Task: Add shared secondary-highlight chip styling**
		- **Description:** Add a reusable `SecondaryHighlightChip` or equivalent class contract and refactor `ConfidenceChip` to compose it.
		- **Acceptance criteria:**
			- [ ] `ConfidenceChip` no longer uses primary classes for high values.
			- [ ] Confidence values still clamp to 0–100.
			- [ ] Tests assert secondary-highlight styling.
			- [ ] Existing Backlog hygiene confidence rendering still works.
		- **Dependencies:** CSS tokens.
	- [ ] **Task: Add shared link-kind icon metadata**
		- **Description:** Add a presentational mapping for `source`, `local`, and `suggested` link kinds with Lucide icons, labels, and descriptions.
		- **Acceptance criteria:**
			- [ ] Mapping exports exactly the three issue #77 kinds.
			- [ ] Icons are distinct by shape.
			- [ ] Metadata can be used by Appearance preview without requiring connection storage.
			- [ ] Tests cover labels and complete mapping.
		- **Dependencies:** Lucide React existing dependency.
	- [ ] **Task: Use link-kind metadata in examples**
		- **Description:** Render the shared icons in the Appearance preview or showcase so the mapping is exercised before the connections feature consumes it.
		- **Acceptance criteria:**
			- [ ] Source/local/suggested examples render from one mapping.
			- [ ] Standalone icon examples have accessible labels or visible text.
		- **Dependencies:** Link-kind metadata.
- [ ] **Story: Update durable design-system context**
	- [ ] **Task: Update ****`context-agent/design-system.md`**
		- **Description:** Document the new token meanings, Appearance settings, secondary-highlight usage, good/ok/bad sentiment usage, `ConfidenceChip` contract, and link-kind icon mapping.
		- **Acceptance criteria:**
			- [ ] Token table includes primary, secondary, secondary-highlight, and sentiment roles.
			- [ ] Color guidance says category meaning uses icon shape, not accent color.
			- [ ] Color guidance says good/ok/bad sentiment uses sentiment tokens with non-color cues.
			- [ ] Data component guidance says `ConfidenceChip` uses secondary-highlight.
			- [ ] Icon section lists source/local/suggested link-kind icons.
			- [ ] Maintenance contract still states same-PR updates for token and primitive changes.
		- **Dependencies:** Final implementation names.
- [ ] **Story: Verify and protect the enhancement**
	- [ ] **Task: Add focused unit and component tests**
		- **Description:** Cover preferences, theme helpers, DOM application, Appearance controls, `ConfidenceChip`, secondary-highlight chip, and link-kind metadata.
		- **Acceptance criteria:**
			- [ ] `npm test` or targeted Vitest commands pass for changed TypeScript/React files.
			- [ ] Tests fail if confidence returns to primary-only styling.
			- [ ] Tests fail if accent preferences drop primary or secondary during merge.
		- **Dependencies:** Implementation tasks above.
	- [ ] **Task: Run broader validation**
		- **Description:** Run the repository's relevant checks after focused tests.
		- **Acceptance criteria:**
			- [ ] `npm run lint` passes if available.
			- [ ] `npm test` passes or failures are documented if unrelated.
			- [ ] `npm run build` passes or blockers are documented.
		- **Dependencies:** Focused tests passing.