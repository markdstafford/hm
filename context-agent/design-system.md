# hm design system

> Canonical reference for UI tokens, primitives, the app shell, and recurring visual patterns. **This doc describes what the design system should be, not necessarily what currently exists in code.** Once code exists for a primitive, the code is authoritative for implementation details; this doc remains authoritative for the contract. Any change that adds, removes, or modifies a shared primitive, shell piece, token, or pattern must update this doc in the same PR (see "Maintenance contract" at the bottom).

## Overview

**What this doc is.** The agent-facing source of truth for how UI is built in `hm`. Single file, structured for partial reads (use `offset`/`limit` on the relevant `##` section). Covers tokens, primitives, the app shell, recurring patterns, and the user-configurable behavior that graduates from the shell into preferences.

**What this doc is not.** Not a tutorial. Not a marketing-style style guide. Not a substitute for reading the actual source once it exists.

**When to update it.** Any change that affects how UI components, shell composition, tokens, or shared patterns work — same PR. If you can't update this doc in the same PR (e.g. you're refactoring tokens across many files), open a separate `docs(design-system):` PR ahead of the change and merge it first.

**Routing pointers.**

- Why settings are split across three locations → [`context-human/adrs/adr-008-settings-split.md`](../context-human/adrs/adr-008-settings-split.md)
- Product context, planned features, narratives → [`context-human/specs/app.md`](../context-human/specs/app.md)

---

## Tokens

All tokens are CSS custom properties in `src/styles.css`, declared inside the Tailwind v4 `@theme {}` block. Tailwind exposes them as utility classes (`bg-background`, `text-text`, `h-control-base`, etc.). Tokens are the **only** source of visual styling — no inline colors, no hardcoded pixel values for spacing or sizing in component code.

### Typography

| Token | Default value | Notes |
| --- | --- | --- |
| `--font-sans` | `Inter Variable, ui-sans-serif, system-ui, sans-serif` | UI text. **User-configurable** via per-user preferences (ADR-008). |
| `--font-mono` | `Fira Code, ui-monospace, monospace` | Code, file paths, identifiers, tabular data. **User-configurable.** |
| `--text-xs` | `0.6875rem` (11px) | Labels, counts, status text. |
| `--text-sm` | `0.75rem` (12px) | Default body small. |
| `--text-base` | `0.8125rem` (13px) | Default UI text size. |
| `--text-md` | `0.875rem` (14px) | Slightly larger UI text. |
| `--text-lg` | `1rem` (16px) | Page titles, dialog headings. |

Type scale is intentionally compact for an information-dense app. Do not introduce sizes outside this scale.

### Color

| Token | Maps to | Use |
| --- | --- | --- |
| `--color-background` | `--ctp-base` | Main pane background. |
| `--color-mantle` | `--ctp-mantle` | Sidebar background. |
| `--color-crust` | `--ctp-crust` | Overlay dim backings. |
| `--color-surface` / `-1` / `-2` | `--ctp-surface0/1/2` | Hover / active / button bgs. |
| `--color-overlay` | `--ctp-overlay0` | Disabled / muted icons. |
| `--color-text` | `--ctp-text` | Primary text. |
| `--color-subtext` | `--ctp-subtext0` | Secondary text. |
| `--color-subtext-1` | `--ctp-subtext1` | Tertiary text. |
| `--color-primary` | `--ctp-sapphire` | Focus rings, selected states, links, primary CTAs. |
| `--color-border` | `--ctp-surface2` | Default borders. |
| `--color-focus` | `--ctp-sapphire` | Focus rings (same as primary). |
| `--color-green` / `red` / `yellow` / `mauve` / `peach` | Catppuccin accents | Semantic / status (use sparingly). |

**Color space:** `oklch` — perceptually uniform. Theme adjustments stay predictable.

**Default palette:** Catppuccin. Latte for light mode; Macchiato for dark. Both ship in v1 with equal design weight. Default follows `prefers-color-scheme`; user can override via `data-theme` attribute on `<html>` (`latte` / `macchiato`).

**Palette is user-configurable.** Color-scheme configuration is its own feature. The architecture supports swappable token sets via the `data-theme` attribute — write components against the **semantic** tokens (`--color-text`, `--color-primary`, etc.), never against Catppuccin-specific names (`--ctp-sapphire`).

**Contrast:** WCAG AA verified on all foreground/background pairings. New combinations must be checked.

### Spacing

- 4px base unit (`--spacing: 0.25rem`).
- Use Tailwind spacing utilities (`p-2`, `gap-3`, etc.) which derive from `--spacing`.
- Discrete scale: do not introduce arbitrary px values. If the existing scale doesn't cover what you need, propose a token addition in this doc + PR.

### Control heights

| Token | Value | Use |
| --- | --- | --- |
| `--height-control-sm` | `1.5rem` (24px) | Chips, dense rows, secondary buttons. |
| `--height-control-base` | `1.75rem` (28px) | Default buttons, inputs. |
| `--height-control-lg` | `2rem` (32px) | Large/primary buttons. |

### Shell dimensions

| Token | Value | Use |
| --- | --- | --- |
| `--width-sidebar` | `15.25rem` (244px) | Sidebar column width. **Fixed.** |
| `--height-title-bar` | `2rem` (32px) | Title-bar row height. |
| `--height-header-bar` | `2.5rem` (40px) | Header-bar row height. |
| `--height-footer` | `1.75rem` (28px) | Footer height. |
| `--width-traffic-light` | `4.5rem` (72px) | macOS traffic-light no-drag spacer width at the very left of the title bar. |

### Motion

| Token | Value | Use |
| --- | --- | --- |
| `--duration-hover` | `100ms` | Hover/active state transitions. |
| `--duration-enter` | `150ms` | Entrances, fade-ins, opacity/height collapse. |
| `--duration-exit` | `100ms` | Exits, fade-outs. |
| `--duration-layout` | `250ms` | Deliberate layout shifts (use sparingly). |

**Motion bias:** fewer, faster transitions. Default to `--duration-hover` or `--duration-enter`. Reserve `--duration-layout` for transitions the user has explicitly invoked (sidebar collapse, dialog open).

### Icons

- **Lucide React** for all icons (no SVG sprite system, no custom icon font).
- 16px default in chrome UI.
- 14px when inline with text.
- 11–12px for small/dense affordances (chip buttons, footer icons).

---

## Primitives

Primitives live under `src/ui/<category>/`. Every primitive is in a category subfolder; no loose files at the root of `src/ui/`. Visual styling comes from tokens; accessibility primitives wrap Radix UI.

### Radix priority

For any interactive component with accessibility requirements (focus management, keyboard navigation, ARIA), wrap a Radix primitive. We provide the visual styling; Radix handles behavior and accessibility.

| Radix package | Wrapped at | Use |
| --- | --- | --- |
| `@radix-ui/react-dialog` | `src/ui/overlays/Dialog.tsx` | Modals, confirm/destructive dialogs. |
| `@radix-ui/react-alert-dialog` | `src/ui/overlays/AlertDialog.tsx` | Destructive / confirm dialogs. |
| `@radix-ui/react-popover` | `src/ui/overlays/Popover.tsx` | Anchored menus, inline pickers. |
| `@radix-ui/react-dropdown-menu` | `src/ui/overlays/DropdownMenu.tsx` | Action menus (`…` kebabs). |
| `@radix-ui/react-context-menu` | `src/ui/overlays/ContextMenu.tsx` | Right-click menus on list rows. |
| `@radix-ui/react-tooltip` | `src/ui/overlays/Tooltip.tsx` | Hover hints for icon-only buttons. |
| `@radix-ui/react-select` | `src/ui/forms/Select.tsx` | Single-select dropdowns. |
| `@radix-ui/react-checkbox` | `src/ui/forms/Checkbox.tsx` | Boolean toggle in lists. |
| `@radix-ui/react-switch` | `src/ui/forms/Switch.tsx` | Inline boolean toggle. |
| `@radix-ui/react-radio-group` | `src/ui/forms/RadioGroup.tsx` | Single-choice from a small set. |
| `@radix-ui/react-tabs` | `src/ui/navigation/Tabs.tsx` | In-page section switching. |
| `@radix-ui/react-toast` | `src/ui/feedback/Toast.tsx` | Ephemeral notifications. |
| `@radix-ui/react-separator` | `src/ui/layout/Separator.tsx` | Hairline dividers between sections/groups. |

**Rules:**

1. Never re-implement Radix behaviors. If you need a behavior Radix doesn't ship, prefer adding the Radix package over hand-rolling.
2. Never adopt `shadcn` or similar pre-styled component kits. Visual styling comes from tokens; Radix provides only structure + behavior.
3. Keep Radix wrappers thin: classes from tokens, minimal logic, sensible defaults exposed via props.

### Buttons — `src/ui/buttons/`

| Component | Wraps | Purpose |
| --- | --- | --- |
| `Button` | native `<button>` | Labelled actions in forms, dialogs, page headers. |
| `IconButton` | native `<button>` + Lucide icon | Icon-only actions. Always paired with `aria-label` + `Tooltip`. |

**`IconButton` contract:**

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `label` | `string` | required | Accessible label (also tooltip text). |
| `children` | `ReactNode` | required | The icon (Lucide React). |
| `dimmed` | `boolean` | `false` | Renders muted; reads as "secondary action." |
| `active` | `boolean` | `false` | Renders in accent color; reads as "currently on." |
| `disabled` | `boolean` | `false` | Renders muted; blocks `onClick` and `Enter` / `Space` activation. |
| `...rest` | `ButtonHTMLAttributes` | — | Standard button attributes (`onClick`, etc.). |

**Disabled semantics.** `IconButton` uses `aria-disabled="true"` rather than the native `disabled` attribute. The native attribute would suppress pointer and focus events, which would break the wrapping Radix Tooltip — "(coming soon)" buttons would have no hover or focus explanation. `aria-disabled` keeps the button focusable and Tooltip-eligible; the component blocks click and `Enter` / `Space` activation in handlers so the disabled state remains effective. Tests should assert `toHaveAttribute("aria-disabled", "true")` rather than `toBeDisabled()` — jest-dom's `toBeDisabled` matcher only honors `aria-disabled` for custom elements with a button role, not for native `<button>`.

### Forms — `src/ui/forms/`

| Component | Wraps | Purpose |
| --- | --- | --- |
| `Form` | native `<form>` | Layout + submit semantics + `Form.Section` (fieldset/legend) + `Form.Actions` (action bar) + `Form.Error` (form-level alert). |
| `TextField` | native `<input>` | Single-line text input. |
| `Field` | composed (label + control + help/error) | Form field wrapper. Generates an id via `useId` and exposes it via a `(id) => ReactNode` render-prop so the child input is properly associated with the label. |
| `Select` | `@radix-ui/react-select` | Single-select dropdown. |
| `MultiSelect` | `Popover` + checkbox list | Multi-value selection. |
| `Checkbox` | `@radix-ui/react-checkbox` | Boolean toggle in lists. |
| `Switch` | `@radix-ui/react-switch` | Inline boolean toggle. |
| `RadioGroup` | `@radix-ui/react-radio-group` | Single-choice from a small set. Compound: `RadioGroup` + `RadioGroup.Item` (each item carries its own label). |
| `SettingRow` | layout | Label + optional description on the left, control on the right, hairline below. Used by settings categories (General, Appearance). |

### Overlays — `src/ui/overlays/`

Everything that floats above content.

| Component | Wraps | Purpose |
| --- | --- | --- |
| `Dialog` | `@radix-ui/react-dialog` | Modals, confirm dialogs. |
| `AlertDialog` | `@radix-ui/react-alert-dialog` | Destructive / confirm dialog. Compound: `Root \| Trigger \| Content \| Title \| Description \| Cancel \| Action`. |
| `Popover` | `@radix-ui/react-popover` | Anchored menus, inline pickers. Content has default `p-2` padding so a bare body looks finished without extra wrapping. |
| `DropdownMenu` | `@radix-ui/react-dropdown-menu` | Action menus (kebab `…`). |
| `ContextMenu` | `@radix-ui/react-context-menu` | Right-click menus. |
| `Tooltip` | `@radix-ui/react-tooltip` | Hover hints for icon-only buttons. **Required** when a button has no visible label. |

### Navigation — `src/ui/navigation/`

| Component | Wraps | Purpose |
| --- | --- | --- |
| `Breadcrumb` | layout | Page identity trail. |
| `Tabs` | `@radix-ui/react-tabs` | In-page section switching. |
| `KeyboardShortcut` | layout | Render a key binding (or sequence) as `<kbd>` glyphs, using `formatBinding` from `src/shell/keys.ts`. |

**`Breadcrumb` contract:**

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `items` | `{ label: string; href?: string; isCurrent?: boolean }[]` | required | The trail. Last item renders in `text-text`; previous items in `text-subtext`. |
| `className` | `string` | `""` | Extra utility classes. |

Separator is an 11px `ChevronRight` at `opacity-50`.

**`KeyboardShortcut` contract:**

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `binding` | `string \| string[]` | required | A single binding (e.g. `"⌘+shift+d"`) or a sequence (e.g. `["g", "i"]`). Strings pass through `formatBinding`. |
| `platform` | `Platform` (`"mac" \| "other"`) | `detectPlatform()` | Forces glyph (mac) or spelled (other) rendering. |
| `className` | `string` | `""` | Extra utility classes on the wrapping `<span>`. |

Each binding renders as a `<kbd>` with `rounded border border-border bg-surface px-1 text-xs text-subtext font-mono`. Sequences are joined with a small `then` label between segments.

### Sidebar — `src/ui/sidebar/`

Composable pieces used by the shell's sidebar column.

| Component | Purpose |
| --- | --- |
| `ScopeHeader` | Workspace / team scope row (header-bar row, sidebar zone). Avatar + name + Search (`⌘K`) + New (`+`). |
| `NavSection` | A labelled section in the nav list. Composes `SectionLabel` + a list of `NavItem`s + optional `SectionDivider`. |
| `NavItem` | Single nav row. Label + optional count + optional badge dot. |
| `SectionLabel` | Small-caps section header. Uses `font-variant-caps: all-small-caps` (real OpenType small-caps via Inter Variable). Pass mixed-case text. |
| `SectionDivider` | Hairline `border-border/30` divider between sections. |

### Feedback — `src/ui/feedback/`

| Component | Wraps | Purpose |
| --- | --- | --- |
| `Toast` | `@radix-ui/react-toast` | Ephemeral notifications (save errors, batch action results). |
| `EmptyState` | layout | "No results" / "Nothing here yet" placeholders. |
| `StatusDot` | layout | Small colored dot (sync, presence, badge). |
| `Spinner` | layout | Indeterminate progress affordance. `label` exposes accessible name via `role="status"`. |
| `Skeleton` | layout | Placeholder shape for loading content. Renders with `aria-hidden`. |

### Data — `src/ui/data/`

| Component | Wraps | Purpose |
| --- | --- | --- |
| `Avatar` | layout | User / scope visual (initial or image). |
| `Badge` | layout | Small label pill. Tones: neutral / primary / green / red / yellow / mauve / peach. |
| `Tag` | layout | Removable label with optional `onRemove` callback. |
| `ConfidenceChip` | layout | AI-confidence percentage chip with high/low styling (≥85% = primary accent; below = muted). |

### Text — `src/ui/text/`

| Component | Wraps | Purpose |
| --- | --- | --- |
| `Heading` | native `<h1>`–`<h6>` | Page and section titles. `level` 1–6 maps to the typography scale. |
| `Link` | native `<a>` | Inline link. External URLs (matched by `^https?://`) get `target="_blank"`, `rel="noreferrer noopener"`, and a trailing `ExternalLink` icon (from `lucide-react`) so users can spot off-app navigation at a glance; relative URLs render plain. Pass `showExternalIcon={false}` to suppress the icon when the surrounding context already implies external-ness (e.g. a logo grid or a list of source links). |
| `InlineCode` | native `<code>` | Inline `<code>` with mono font and subtle surface background. |
| `CodeBlock` | `shiki` (async) | Fenced code block with syntax highlighting. Theme follows `data-theme-mode` on `<html>` (Catppuccin Latte for light, Macchiato for dark). Renders an unstyled `<pre><code>` fallback while shiki resolves. |
| `Markdown` | `react-markdown` + `remark-gfm` | Display-only Markdown. Renders GFM (tables, task lists). Single newlines do NOT produce `<br>`. Image nodes render as `<span class="italic text-subtext">[image: alt]</span>` (no remote fetches at v1). |

**Future: rich text editing.** A write surface (e.g. TipTap) is not part of v1. When an editor ships, it will live alongside `Markdown` under `src/ui/text/`. Until then, `Markdown` is display-only.

### Layout — `src/ui/layout/`

| Component | Wraps | Purpose |
| --- | --- | --- |
| `Separator` | `@radix-ui/react-separator` | Hairline divider between sections/groups. Renders `bg-border` at `h-px w-full` (horizontal) or `w-px h-full` (vertical). |
| `Card` | layout | Bordered, padded container. `interactive` variant renders a `<button>` for clickable tiles (source-kind picker, profile rows). |

**`Separator` contract:**

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Visual direction; sets `data-orientation` and swaps height/width. |
| `decorative` | `boolean` | `true` | When `true`, Radix renders `role="none"` (purely visual). Set `false` to expose `role="separator"` for assistive tech when the divider is semantically meaningful. |
| `className` | `string` | `""` | Extra utility classes. |

---

## App shell

The shell is the canonical layout every page composes into.

### Structure

```
┌─────────────────────────────────────────────────────────┐
│  ● ● ●                                                  │  title bar (32px)
│  (sidebar zone empty;                                   │
│   main pane zone: breadcrumb + actions)                 │
├──────────────────────────┬──────────────────────────────┤
│ [P] Platform Eng  🔍  +  │  All 23  Duplicate 5  ...    │  header bar (40px)
├──────────────────────────┼──────────────────────────────┤
│ PERSONAL                 │  ☑ row…                      │
│  Inbox                7  │  ☑ row…                      │  content row
│ WORKSPACE                │  ☐ row…                      │  (scrolls per column,
│  …                       │  …                           │   independently)
├──────────────────────────┴──────────────────────────────┤
│ [⊟] [filter]   sync · 23 · 3 selected      [🪄] [💬]    │  footer (28px)
└─────────────────────────────────────────────────────────┘
```

### Columns

The shell has two columns above the footer:

- **Sidebar** — left column. Fixed width: `--width-sidebar` (244px).
- **Main pane** — right column. Fills the remaining width.

### Rows

Three rows span both columns. The bottom edges of the sidebar and main pane rows are at the same y-coordinate, so the eye can scan horizontally across the window.

| Row | Height token | Pinned? | Sidebar zone | Main pane zone |
| --- | --- | --- | --- | --- |
| **Title bar** | `--height-title-bar` (32px) | Yes | Empty (stoplight clearance only). | Page header: breadcrumb + count + page-level action buttons. |
| **Header bar** | `--height-header-bar` (40px) | Yes | `ScopeHeader` (avatar + team name + Search + New). | Filter chips + selection state. |
| **Content row** | `flex-1` | No (scrolls per column, independently) | Nav list (`NavSection`s + `NavItem`s). | Primary content (list + optional right rail). |

### Footer

Persistent ~28px row at the very bottom (`--height-footer`). Three zones:

| Zone | Width | Holds |
| --- | --- | --- |
| Left | Tracks `--width-sidebar` when sidebar is visible; auto otherwise. | Sidebar toggle + content-mode controls (e.g., issue / source / git filters when applicable). |
| Center | `flex-1`, centered. | Status / context content. Default: filter counts (`All N · Duplicate N · …`). |
| Right | `flex-none`. | AI controls (sparkle / chat) + contextual right-rail toggle. **The right-rail toggle renders only when the active view has a contextual right rail**; otherwise the zone shows only AI controls. |

### Composer

`<AppShell>` at `src/shell/AppShell.tsx` composes the layout. The API is **flat slot props** — one prop per zone: `sidebarTitleBar`, `sidebarHeader`, `sidebarContent`, `mainTitleBarStart` (page identity), `mainTitleBarEnd` (page-level actions), `mainHeader`, `mainContent`, `footerLeft`, `footerCenter`, `footerRight`, plus an optional `scrollCollapse` prop (default `"none"`) reserved for the user-configurable behavior below. The shell renders a `data-tauri-drag-region` spacer between `mainTitleBarStart` and `mainTitleBarEnd` so consumers do not have to thread drag-region attributes through their own slot content. The shell internally owns sidebar visibility, breakpoint detection (`useViewportBreakpoint`), the overlay drawer at narrow widths, and drag-region wiring on the title-bar spacers.

**Wide and narrow visibility are tracked separately.** Wide mode mounts with the sidebar visible in its column. Narrow mode auto-collapses on mount and never opens automatically — the overlay drawer appears only after the user presses `[` or clicks the footer toggle. Switching breakpoints does not bleed state between modes: hiding the wide-mode column does not preset the narrow-mode overlay, and dismissing the overlay does not hide the wide-mode column on a subsequent resize.

`footerLeft` accepts either a `ReactNode` or a render prop `(state: { sidebarVisible, toggleSidebar }) => ReactNode`. The render-prop form lets the consumer wire the sidebar-toggle `IconButton` to the shell's internal state without lifting it out of the shell.

Feature pages compose against the shell by providing children for the appropriate zones. See "Page composer pattern" below + `src/features/<feature-name>/`.

### Drag region

The top stripe of the window (the title bar row at minimum; extending through the header bar is allowed for a more generous grab area) is a Tauri drag region. Interactive elements within are `.titlebar-no-drag` islands; empty space stays drag-active.

**Rules:**

1. `data-tauri-drag-region` is set **directly on each drag-active element** (the mantle background to the right of the stoplight spacer in the sidebar's title-bar zone, the `flex-1` spacer between breadcrumb and action buttons in the main pane's title-bar zone, the `flex-1` spacer in the main pane's header-bar zone when applicable). Do **not** rely on inheritance through nested flex children — `-webkit-app-region` is not reliably inherited.
2. A 72px (`--width-traffic-light`) `.titlebar-no-drag` spacer sits at the very left of the title bar row so macOS stoplights remain clickable.
3. `index.html` injects the CSS that maps `[data-tauri-drag-region]` and `.titlebar-no-drag` to `-webkit-app-region: drag` / `no-drag` (Tailwind v4 / Lightning CSS strips non-standard CSS properties). Keep that `<style>` block intact.

### Stoplight clearance

When the sidebar is visible, the sidebar's mantle background extends up through the title bar row so the macOS stoplights overlay the sidebar background. When the sidebar is hidden, only the 72px no-drag spacer remains at the very left of the row; the rest of the row is main-pane background.

### Breakpoint

Below 900px window width:

- The sidebar auto-collapses.
- Opening it draws a dimmed overlay drawer (`bg-crust/50`).
- The drawer is positioned absolutely from `top: 0` down to `bottom: var(--height-footer)` — it slides over the page content but never covers the footer.
- The drawer's internal structure preserves the three-row layout (title bar / header bar / content row) so the drawer's rows align with the rest of the window.
- Clicking the dim backing dismisses. `Escape` also dismisses (but only when the overlay is active — never bind `Escape` globally to "close sidebar").

### Sidebar toggle

- Lives in the **footer-left zone**. Keyboard shortcut: `[`.
- Renders as `<IconButton>` with the `PanelLeft` icon. Active when the sidebar is visible.
- The toggle behavior is owned by `src/shell/useSidebarToggle.ts`; the shortcut handler ignores keypresses when focus is in `INPUT` / `TEXTAREA` / `contentEditable`.

### Page composer pattern

Each feature exposes a single page component (e.g., `<BacklogHygienePage>` at `src/features/backlog-hygiene/BacklogHygienePage.tsx`) that fills the shell's main-pane zones for that feature:

- Title-bar (main pane zone): page identity — breadcrumb + count + page-level actions.
- Header-bar (main pane zone): contextual controls — filter chips, tabs, or similar.
- Content row (main pane zone): the primary view (list + optional right rail).

Sidebar zones are typically supplied by the application root, not by individual feature pages — features rarely override the sidebar.

The page component owns feature-specific state (filters, selection, active preview, etc.) and the wiring to data sources.

---

## Patterns

Recurring rules that apply across components.

### Dialog body and footer

`Dialog` and `AlertDialog` content follow a canonical vertical structure:

1. `Title` — the action / question.
2. `Description` — the explanation. One short sentence is usually enough.
3. Optional body content (form fields, lists, additional copy).
4. Footer — action row, right-aligned, with `mt-4` separating it from the body and `gap-2` between buttons.

```tsx
<Dialog.Content>
  <Dialog.Title>Title</Dialog.Title>
  <Dialog.Description>Body content describing the action.</Dialog.Description>
  <div className="mt-4 flex justify-end gap-2">
    <Dialog.Close asChild><Button>Cancel</Button></Dialog.Close>
    <Dialog.Close asChild><Button variant="primary">Confirm</Button></Dialog.Close>
  </div>
</Dialog.Content>
```

Cancel/secondary action goes left of the primary/destructive action. For `AlertDialog`, the destructive action uses `<Button variant="destructive">` and is wrapped in `AlertDialog.Action`; cancel is wrapped in `AlertDialog.Cancel`.

### Small-caps section labels

Use `font-variant-caps: all-small-caps` (real OpenType small-caps via Inter Variable). Pass **mixed-case** text, not uppercased text:

```tsx
<div
  className="text-xs text-subtext font-medium tracking-wide"
  style={{ fontVariantCaps: "all-small-caps" }}
>
  Personal
</div>
```

Faux all-caps via `uppercase` + `tracking-wider` is **not** a substitute — it doesn't render true small-caps glyphs.

### Plausible-inactive buttons

Some buttons render visibly but are disabled, signalling "this control exists but isn't wired yet." Standard treatment:

```tsx
<button
  type="button"
  disabled
  aria-label="Issue filter (coming soon)"
  title="Issue filter (coming soon)"
  className="p-1 rounded text-subtext/50 cursor-default"
>
  <Filter size={12} />
</button>
```

- `disabled` prevents interaction.
- `text-subtext/50` makes the muted state visually obvious.
- `cursor-default` (not `cursor-not-allowed`) — the button isn't broken, it's just future-tense.
- Always pair with `(coming soon)` in `aria-label` and `title`.

### Filter-counts footer status

Default footer center is a textual mimic of the chip row:

```tsx
<span className="flex items-center gap-3">
  <FilterSummaryItem label="All" count={total} />
  <span className="text-subtext-1">·</span>
  <FilterSummaryItem label="Duplicate" count={duplicateN} />
  <span className="text-subtext-1">·</span>
  <FilterSummaryItem label="Stale" count={staleN} />
  <span className="text-subtext-1">·</span>
  <FilterSummaryItem label="Enrichment" count={enrichmentN} />
</span>
```

Labels in `text-subtext`; counts in `text-text` with `tabular-nums`; separator dots in `text-subtext-1`. **Always shown; does not react to filter or selection** — the chips row above shows the active slice, the footer center shows the full distribution.

### Drag-region islands

Inside the drag stripe, every interactive element is wrapped in a `.titlebar-no-drag` container, and the empty space between them carries `data-tauri-drag-region` directly. The pattern:

```tsx
<div className={`flex h-[var(--height-title-bar)]`}>
  {/* Sidebar zone (mantle bg, drag-active outside the stoplight spacer) */}
  <div className="bg-mantle flex" style={{ width: "var(--width-sidebar)" }}>
    <div className="titlebar-no-drag" style={{ width: "var(--width-traffic-light)" }} />
    <div data-tauri-drag-region className="flex-1" />
  </div>
  {/* Main pane zone */}
  <div className="flex-1 flex items-center px-4 gap-3">
    <span className="titlebar-no-drag flex items-center gap-2">
      {/* breadcrumb */}
    </span>
    <div data-tauri-drag-region className="flex-1" />
    <span className="titlebar-no-drag flex items-center gap-2">
      {/* action buttons */}
    </span>
  </div>
</div>
```

The empty `flex-1` spacers stay drag-active so the user can grab the window from those gaps.

### Overlay drawer dismiss

When the sidebar is in overlay mode (narrow + visible):

- Clicking the dim backing dismisses.
- `Escape` dismisses (but only when overlay is active).

### Right rail handling

A view has a "contextual right rail" when it shows a preview pane, detail panel, or secondary content column on the right. When a view has a right rail:

- The rail is persistent at wide widths.
- A toggle to hide/show the rail lives in the footer-right zone (alongside AI controls).
- The rail collapses at narrow widths to give the main list more room.

When a view does **not** have a right rail, the footer-right zone shows only AI controls.

### Theme

Components respect the user's theme preference. The `data-theme` attribute on `<html>` (`latte` / `macchiato`) determines which Catppuccin variant is active. Always write components against semantic tokens (`--color-text`, `--color-primary`, etc.), never against `--ctp-*` directly.

### Keyboard shortcuts

Bindings are registered through `useShortcut(binding, handler, options?)` (`src/shell/useShortcut.ts`). Display them with `<KeyboardShortcut binding="…" />`.

| Pattern | Binding form | Example |
| --- | --- | --- |
| Single key | string | `useShortcut("[", …)` |
| Combo | string with `+` separating modifiers | `useShortcut("⌘+shift+d", …)` |
| Sequence | array of strings | `useShortcut(["g", "i"], …)` |

**Display.** The `KeyboardShortcut` primitive renders the binding with `⌘ ⌥ ⌃ ⇧` glyphs on macOS and spelled `Ctrl+Shift+…` elsewhere. Sequences render each step as a separate `<kbd>` joined by the word `then`.

**Scopes.** `scope: "global"` (default) registers a window-level listener; `scope: "page"` is intended for page-local bindings (currently equivalent to global — mounting scope determines lifetime).

**Form-field filter.** By default `useShortcut` ignores keypresses when focus is in `INPUT` / `TEXTAREA` / `[contenteditable]`. Pass `allowInForm: true` to opt out (e.g. the `⌘+shift+d` showcase shortcut).

**Sequence timeout.** Default `1500ms` between steps. Configurable via `sequenceTimeoutMs`.

---

## User-configurable behavior

Some shell behavior graduates to user preferences rather than being hardcoded.

### Scroll-collapse

Whether the title bar / header bar collapse when the user scrolls the main pane's content row.

| Value | Behavior |
| --- | --- |
| `"none"` (default) | Title bar + header bar stay pinned at all times. |
| `"y2"` | Header bar collapses to height 0 after the user scrolls past ~80px. Title bar stays pinned. |
| `"y1-y2"` | Header bar collapses + title bar's content fades to opacity 0. The title bar row stays at 32px so stoplight clearance + drag region are preserved. |

Stored in per-user preferences (ADR-008) and threaded into `<AppShell>` at app mount.

### Theme

`latte` / `macchiato` / `system` (follows `prefers-color-scheme`). Stored in per-user preferences; set on `<html data-theme="...">`.

### Color scheme + accent

The Catppuccin palette and primary accent are user-configurable as a separate feature. The architecture supports swappable token sets via the `data-theme` attribute; component code writes against semantic tokens (see "Tokens → Color").

### Fonts

UI sans (default Inter Variable) and code mono (default Fira Code). Stored in per-user preferences; applied to `--font-sans` / `--font-mono` at the `:root` level.

### Settings UI patterns

Settings is a feature page (`src/features/settings/SettingsPage.tsx`) that mounts inside the standard `AppShell`. When the user opens settings, the app's `currentPage` flips to `"settings"`:

- **Sidebar zone** swaps to `<SettingsSidebar>` — one `NavSection` with one `NavItem` per category (General, Appearance, Sources, AI providers). The selected category receives `active`.
- **Main title bar (start)** renders `<SettingsBreadcrumb>` showing `Settings › Category`.
- **Main title bar (end)** renders an `IconButton` with the `X` icon that returns the user to the previous page.
- **Main content** dispatches on the active category and renders the corresponding `<*Category>` component.

Settings is not a modal or overlay — it is a routed page mode. There is no escape-key dismiss; the user navigates back via the close button or by picking a non-settings page.

**Category content shapes.** Two shapes are canonical so far:

- **Row-style** (General, Appearance) — a stack of `SettingRow`s. Each row contains a label, optional description, and one control on the right. Suitable for short lists of independent toggles or selects that don't compose into a draft.
- **List-with-focused-form** (Sources, AI providers) — the category page shows either a list of configured items with row actions, or a focused form for one item, but never both at once. The form replaces the list while editing and returns to the list on save or cancel. Cross-item references (routing, credential reuse) are surfaced inside the form via inline checkboxes or selects rather than as separate sections of the page.

**The list-with-focused-form pattern uses these primitives:**

- `Card` per row in the list.
- `Form` + `Form.Section` + `Form.Actions` + `Form.Error` for the form.
- `EmptyState` when the list is empty.
- `AlertDialog` for destructive confirmation (Remove).

**Advanced views** (AI providers YAML editor) — an opt-in alternate view of the same data, toggled by an in-header pair of buttons. The advanced view is allowed to bypass field-level validation but **must** preserve invariants on save — the YAML view runs the same cross-reference validation as the form-driven save path.

**No settings UI surface uses `Dialog`.** Modals are reserved for transient destructive confirmation or short-lived inline pickers.

---

## Named-view chip strip

The `ViewChips` + `ChipContextMenu` + `CollectionHeader` triad is a reusable header pattern for any collection page that supports named views. It lives under `src/views/collection/`.

### Layout

`CollectionHeader` renders a single `h-8` (`32px`) row pinned above the collection body:

```
[ All open ] [ Mine ] [ Recently updated ] [ + ]        [ ⊟ settings ]
^--- ViewChips (left, flex-1, min-w-0) ---^              ^--- settingsSlot ---^
```

The chip strip takes all remaining width (`flex-1`, `min-w-0`); the `settingsSlot` is `shrink-0` and right-aligned. Both are vertically centered.

### Chip states and tokens

| State | Classes |
| --- | --- |
| Active chip | `bg-primary text-on-primary` (primary tone) |
| Inactive chip (rest) | `border border-border bg-surface text-text` (surface tone) |
| Inactive chip (hover) | `hover:bg-surface-1` |
| Chip height | `h-control-sm` (`1.5rem` / 24px) |
| Chip shape | `rounded-full px-2 text-xs font-medium` |
| Long name | `max-w-48 truncate` — label truncates; chip does not push settings icon off-screen |

The active chip sets `aria-current="true"` and `data-active="true"`.

### Trailing `+` chip

Always rendered after the last view. Uses the same surface-tone styling as inactive chips. `aria-label="Create named view"`. Clicking calls `onCreate`.

### Context menu and delete confirmation

Right-clicking a chip opens a Radix `ContextMenu` with three items in order: `Rename`, `Duplicate`, `Delete`.

- **Rename** — opens a `Dialog` with a text input pre-filled with the current view name. Saves via `onRename(viewId, newName)`. Empty or whitespace names are rejected with an inline error.
- **Duplicate** — calls `onDuplicate(viewId)` immediately; the page creates a copy and activates it.
- **Delete** — opens an `AlertDialog` confirmation before calling `onDelete(viewId)`. The title names the view being deleted (e.g., `Delete Mine?`). Confirming calls the handler; cancelling is safe.

`ChipContextMenu` manages its own `renameOpen` / `deleteOpen` state. It does not know about persistence; callers supply the handlers.

### Active fallback on delete

When the deleted chip was active, the page selects the **previous neighbor** in the ordered strip. If the deleted chip was first (no previous), the **next neighbor** is chosen instead. If only one view remains after deletion, it becomes active automatically. The fallback id is persisted to preferences.

If all views are deleted, a safe fallback view is created before re-rendering so the strip is never empty.

### Collection view settings menu

`CollectionHeader` accepts an optional `settingsSlot?: ReactNode` prop rendered at the right edge. The canonical implementation is `src/views/collection/menu/ViewSettingsMenu.tsx`, composed by `CollectionViewerPage` and injected via `settingsSlot`. The header itself remains entity-agnostic.

**Trigger:** An icon-only `IconButton` labelled `"Open view settings"` (SlidersHorizontal 14px). Disabled (with tooltip) when `activeView` is null.

**Container:** A Radix-backed popover (`align="end"`, `w-80`, `p-0`) that opens at the **top sheet** every time. Closing resets the internal `panel` state to `"top"`. Click-outside, `Esc`, and the close button all dismiss from any panel.

**Top sheet structure:**
```
┌─────────────────────────────────────────────┐
│  View settings                          [X] │
├─────────────────────────────────────────────┤
│  View name                                  │
│  [ Mine                                   ] │
├─────────────────────────────────────────────┤
│  ◫  Layout              Table · Regular  ›  │
│  ◉  Property visibility       5 of 8     ›  │
│  ⇅  Sort                         None    ›  │
│  ▥  Group                        None    ›  │
│  ⊜  Filter                       None    ›  │
│  ◐  Conditional color            Soon       │
└─────────────────────────────────────────────┘
```

- Title: `"View settings"` (h2 inside a `<section aria-label="View settings">`)
- **View name textbox:** labelled, controlled, commits on blur or `Enter`, trims whitespace, rejects blank with `"View name cannot be blank"` inline error. Uses `Field` + `TextField` from `src/ui/forms/`.
- **Category row order (fixed):** Layout → Property visibility → Sort → Group → Filter → Conditional color
- **Enabled rows** (Layout, Property visibility, Sort, Group, Filter): `<button>` with lucide icon, label, current-value summary (from `summarizeViewConfig`), and `ChevronRight`.
- **Disabled row** (Conditional color): non-interactive `<div aria-disabled="true">`, shows `"Soon"`, no chevron, no click action.

**Top-sheet summaries** (from `summarizeViewConfig` in `src/views/collection/ViewConfig.ts`):
| Row | Summary |
|-----|---------|
| Layout | `Table · Compact` or `Table · Regular` |
| Property visibility | `N of M` (visible / total entity properties) |
| Sort | First sort level label + direction (`↑`/`↓`), or `None` |
| Group | Group property label, or `None` |
| Filter | `N active` for active filters, or `None` |
| Conditional color | Always `Soon` |

**Sub-panels** share `PanelHeader` chrome:
```
┌─────────────────────────────────────────────┐
│  ←  Sort                                [X] │
├─────────────────────────────────────────────┤
│  Coming in #42                              │
└─────────────────────────────────────────────┘
```
`PanelHeader` props: `title`, optional `onBack`, `onClose`. Back button label: `"Back to view settings"`. Close button label: `"Close view settings"`.

Sub-panel implementation status:
| Panel | Status |
|-------|--------|
| Layout | Real controls (issue #40) |
| Property visibility | Real controls (issue #41) — see "Property visibility sub-panel" below |
| Sort | `Coming in #42` |
| Group | Real controls (issue #43) — see "Group sub-panel" below |
| Filter | `Coming in #44` |

**Layout sub-panel** (`src/views/collection/menu/sub-panels/LayoutPanel.tsx`): Type tiles (3-col grid; `Table` enabled, others `aria-disabled`), density segmented toggle (`Compact` / `Regular`, maps to `py-1` / `py-2` on rows), and a `PreviewPopover` trigger row. `PreviewPopover` (`src/views/collection/menu/sub-panels/PreviewPopover.tsx`) shows three options (`side-peek` → Side, `bottom-peek` → Bottom, `full-page` → Full page) via `role="listbox"` + `role="option"` ARIA pattern with `aria-selected`.

**Property visibility sub-panel** (`src/views/collection/menu/sub-panels/PropertyVisibilityPanel.tsx`): Search field (`aria-label="Search properties"`) that filters the property list by case-insensitive substring match. Two sections — `Shown` and `Hidden` — each wrapped in a `<section aria-labelledby>` with a small-caps heading. Each property row contains a drag handle (`Reorder {label}`), a property icon, the label, a compact `← | →` segmented control (two `<button>` elements with `aria-pressed`), and an eye/eye-off `IconButton`. Drag reordering uses `@dnd-kit/core` + `@dnd-kit/sortable` with both pointer and keyboard sensors; dragging within a section reorders the canonical list; dragging across sections also toggles `visible`. The title/stretch property's eye button is `aria-disabled` with tooltip `"Title is always visible"`. Drag is disabled while search is active; a muted note explains why. Patches only `propertyVisibility` via `patchViewConfig`; unrelated config fields are preserved. The panel uses `DndContext` + `SortableContext` per section with `useDroppable` section containers so cross-section drops resolve correctly.

**Group panel:** functional collection view-settings sub-panel. It uses a nested Radix Popover for `Group by`, `Switch` for `Hide empty groups`, persists only `ViewConfig.group`, and renders grouped collection sections with `SectionHeader` using `font-variant-caps: all-small-caps`.

**Panel state values:** `"top" | "layout" | "property-visibility" | "sort" | "group" | "filter"` (exported as `ViewSettingsPanel` from `ViewSettingsMenu.tsx`).

**Rename persistence:** `onRenameView(viewId, displayName)` is called on valid commit. The page wires this to `handleRename`, which uses `buildRenameView` from `src/features/collection-viewer/viewConfigPersistence.ts` — this normalizes the config via `normalizeViewConfig` before saving.

**Config patch persistence:** `onPatchConfig(viewId, config: ViewConfig)` is the established path for sub-panel controls (#40–#44). The page uses `handlePatchViewConfig` → `buildConfigPatchView` → `collectionViewSave`. Use `patchViewConfig(config, { layout: { ...config.layout, density } })` to patch a single layout field while preserving others.

**Preview surfaces:** `CollectionViewerPage` renders one of three surfaces based on `activeConfig.layout.preview`: `side-peek` → 440px right rail (`Detail` with `surface="side-peek"`), `bottom-peek` → 280px bottom pane (`Detail` with `surface="bottom-peek"`), `full-page` → `FullPagePreview` hides list and shows nav strip. `Detail` (`src/views/collection/Detail.tsx`) accepts `surface`, `index`, `total`, `canMovePrevious/Next`, and movement handlers — renders `<aside aria-label="Issue detail">`. `FullPagePreview` (`src/views/collection/FullPagePreview.tsx`) accepts same plus `onBack`; shows "Back to list (Esc)" button and `j / k` hint.

**Keyboard navigation:** `useKeyboardNavigation` (`src/views/collection/useKeyboardNavigation.ts`) registers on `window`. `ArrowUp`/`ArrowDown` work in all preview modes; `j`/`k`/`Escape` work only in `full-page`. Ignores events from form fields (`isFormFieldTarget` from `src/shell/keys.ts`).

**Display order:** `sortCollectionItems(items, entity, activeConfig.sort)` from `src/views/collection/sort.ts` is the shared helper. `Body`, `useCollectionViewer`, preview navigation, `M of N`, and keyboard movement must all use the same active sort stack and fall back to `entity.defaultSort` when no valid configured levels exist.

**Typed view config:** `ViewConfig` type and helpers live in `src/views/collection/ViewConfig.ts`. Legacy `{}` configs normalize to typed defaults via `normalizeViewConfig(input, entity)`.

### Accessibility checklist

- Each chip button has an accessible name (the view display name).
- Active chip exposes `aria-current="true"`.
- `+` chip has `aria-label="Create named view"`.
- Context menu uses Radix focus management and keyboard navigation.
- Delete confirmation uses `AlertDialog` with a title naming the view.
- Settings trigger has `aria-label="Open view settings"` via `IconButton`.
- Settings menu popover content is wrapped in `<section aria-label="View settings">`.
- Panel titles use `<h2>`.
- `Esc` closes from any panel.
- Back and close buttons have descriptive accessible labels.

### Reuse contract

`ViewChips` and `ChipContextMenu` are entity-agnostic. Pass the ordered `CollectionView[]`, the `activeViewId`, and CRUD handlers. Jira-specific defaults live in `src/entities/jira-issue/defaults.ts`; the components know nothing about the entity.

---

## Collections

Configurable lists of one entity type — the read / write / enhance / history pattern every collection viewer in the app follows. Four documents specify the contract:

- [`collections/collection-read.md`](collections/collection-read.md) — display, named views, view-settings menu, sub-panels, preview surfaces, entity contract (read side).
- [`collections/collection-write.md`](collections/collection-write.md) — selection, bulk-action bar, confirm modal, undo toast, audit log, action contract.
- [`collections/collection-enhance.md`](collections/collection-enhance.md) — the entity contract applied to backlog hygiene, including the five action verbs and reversibility.
- [`collections/collection-history.md`](collections/collection-history.md) — the audit-log entry as an entity and the history view with per-entry + per-batch undo.

Read `collection-read.md` first; the others build on it.

---

## Maintenance contract

This is the contract every agent (and human) commits to when working in this repo. Violating it means the doc rots and stops being trustworthy.

### When you must update this doc

In the **same PR** as the change:

1. Adding a new shared primitive under `src/ui/<category>/`.
2. Removing or renaming a primitive that's referenced here.
3. Changing the prop contract of a primitive listed in "Primitives."
4. Adding or modifying tokens in `src/styles.css`.
5. Changing the app shell structure, drag-region behavior, breakpoint, or any rule in "App shell."
6. Introducing a new pattern that other components should follow.
7. Adopting a new Radix package — add to the Radix table.
8. Graduating a primitive from one location to another (file path changes).

### When you must consult this doc

Before:

1. Writing any new UI component.
2. Touching `src/styles.css` or the Tailwind theme block.
3. Modifying the app shell.
4. Adding a dependency that overlaps with a primitive already listed.
5. Filing an issue or PR that proposes a visual change.

### What to do if the doc is wrong

Open a `docs(design-system):` PR with the correction **before** the change that exposed the inaccuracy lands. If the inaccuracy is small and discovered mid-change, update this doc as part of the same PR.

### Where this doc lives

- Path: `context-agent/design-system.md`
- Audience: agents (Claude Code, Codex, future provider integrations) + humans reading agent context.
- Routing: `AGENTS.md` → "Context map" cites this file as canonical for all design questions.

If this doc exceeds ~600 lines or any single section becomes harder to scan than to split, refactor into `context-agent/design-system/{tokens,primitives,shell,patterns,settings,maintenance}.md` with a thin `design-system.md` index. Update `AGENTS.md` if the location changes.
