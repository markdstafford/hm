---
created: 2026-05-27
last_updated: 2026-05-27
status: implementing
issue: 57
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Date picker primitive

## What

`hm` needs a reusable `DatePicker` form primitive for absolute date input. The first consumer is the collection filter sub-panel from issue #44, where date operators such as `is`, `is before`, `is after`, `is on or before`, and `is on or after` need a consistent value control.
This feature adds `src/ui/forms/DatePicker.tsx`. It renders a TextField-like button trigger, opens a calendar inside the existing `Popover` primitive, lets the user pick or clear a date, and emits ISO 8601 date strings in `YYYY-MM-DD` format. It works in both Catppuccin Latte and Macchiato themes, uses design-system tokens only, and avoids native `` so the app does not inherit inconsistent WebView rendering.
The primitive is standalone. It does not implement the full filter sub-panel, relative date shortcuts, date ranges, time-of-day selection, or locale customization beyond the built-in calendar grid's deterministic defaults.
## Why

The filter sub-panel cannot ship complete date filtering without an absolute date input. Native date inputs vary across macOS WebKit, Windows WebView2, and Linux WebKit-GTK, which conflicts with `hm`'s token-driven design system and makes visual regression harder to reason about.
A shared primitive solves the immediate filter need and gives future date fields one tested contract. It also keeps calendar behavior accessible by default: keyboard navigation, visible focus, ARIA semantics, and clear labels are part of the primitive rather than reimplemented by each feature.
## Personas

- **Elena: EM** — filters issue collections by `Updated before Friday` or `Created on or after a planning date` during triage. She needs the picker to be fast, predictable, and keyboard-friendly.
- **Priya: PM** — reviews roadmap-related issues and filters to exact dates before a status review. She needs the visible date value to be clear and not depend on platform-specific date input styling.
- **Tarek: Team member** — works keyboard-first while investigating issues. He needs arrow-key calendar navigation, `Enter` to select, `Escape` to close, and focus that returns to the trigger.
- **Future UI implementer** — needs a small reusable primitive with a clear value contract so future forms do not each choose a different calendar implementation or date format.
- **Maintainer** — needs date behavior covered by component and accessibility tests before the filter panel depends on it.
## Narratives

### Elena filters stale issues by a cutoff date

Elena opens the Jira issue collection and starts configuring a future filter: `Updated is before`. The value cell shows a date-picker trigger styled like the other form controls in the view-settings menu. It says `Select date` because no value is set.
She opens the picker, moves to the previous month, and clicks the date that marks her stale cutoff. The popover closes, the trigger now shows the selected date, and the filter row receives `YYYY-MM-DD`. She does not see a native browser date widget or a control that looks different from the rest of `hm`.
### Priya clears an accidental date

Priya creates a date filter while preparing for a roadmap review. She picks the wrong day, reopens the picker, and sees a clear action in the calendar popover. She clicks `Clear`, the value becomes `null`, and the trigger returns to its placeholder.
The clear action does not delete the whole filter row. It only resets the date value, letting Priya choose another date or remove the filter herself.
### Tarek uses the picker from the keyboard

Tarek tabs to a date-picker trigger and presses `Enter`. The calendar opens with the selected date focused; if no date is selected, today is focused. He uses arrow keys to move by day, `PageUp` and `PageDown` when implemented for month navigation, and `Enter` to select.
After selection, the popover closes and focus returns to the trigger. When he opens the picker again and presses `Escape`, it closes without changing the value. The component has no axe violations.
## User stories

**Elena selects an absolute date**
- Elena can see a TextField-like trigger with the selected date or a placeholder.
- Elena can open the trigger and see a month calendar.
- Elena can navigate to previous and next months.
- Elena can pick a day and have the popover close.
- Elena can pass the selected value to consumers as an ISO date string in `YYYY-MM-DD` format.
**Priya clears a date**
- Priya can see a clear affordance when the picker has a value.
- Priya can reset the value to `null` without removing the surrounding filter row.
- Priya can see the placeholder after clearing.
- Priya can use the picker again after clearing without stale internal focus or month state.
**Tarek uses accessible keyboard behavior**
- Tarek can open the picker from the keyboard.
- Tarek can move the focused day with arrow keys.
- Tarek can select the focused day with `Enter`.
- Tarek can close the popover with `Escape` without changing the value.
- Tarek can rely on visible focus and accessible calendar semantics.
**Future UI implementer reuses the primitive**
- Future implementer can import `DatePicker` from `src/ui/forms/DatePicker.tsx`.
- Future implementer can pass `value: string | null` and `onChange(next)` without managing `Date` objects at the call site.
- Future implementer can pass `placeholder`, `aria-label`, `disabled`, `minDate`, and `maxDate`.
- Future implementer can trust the primitive to validate bounds before emitting a value.
## Goals

- Add `DatePicker` at `src/ui/forms/DatePicker.tsx`.
- Export the primitive from the forms barrel if the repository convention exposes forms that way.
- Use the existing `Popover` primitive for calendar placement and focus behavior.
- Render the trigger as a button that visually matches `TextField` height, border, typography, placeholder color, disabled state, and focus ring.
- Show the selected date in a consistent display format while storing and emitting `YYYY-MM-DD`.
- Render a month-view calendar with previous and next month navigation.
- Highlight today without overriding the selected-date state.
- Support keyboard navigation for day movement and selection.
- Close the popover after a date is picked.
- Emit `null` when the user activates `Clear`.
- Respect optional `minDate` and `maxDate` bounds.
- Use token-based Tailwind classes only; no inline colors or hardcoded palette values.
- Respect active theme tokens in Latte and Macchiato.
- Keep the primitive independent of collection filters so it can be reused in settings and future forms.
- Document the new primitive in `context-agent/design-system.md` during implementation per the maintenance contract.
- Cover rendering, interactions, keyboard behavior, bounds, disabled state, and accessibility with tests.
## Non-goals

- No date range picker.
- No time-of-day picker.
- No relative-date shortcuts such as `Past week`; issue #44 owns that separate value control for `is within`.
- No locale selector or custom date-format settings.
- No integration with the filter sub-panel in this feature.
- No backend, storage, IPC, or database changes.
- No source-system date parsing beyond accepting and emitting date-only ISO strings.
- No custom design-system token additions unless implementation finds an existing token gap.
## Design spec

### Information architecture

The primitive lives with other form controls and composes existing overlay behavior:
```plain text
src/ui/forms/
└── DatePicker.tsx

DatePicker
├── TextField-like trigger button
└── Popover
    ├── Calendar header
    │   ├── Previous month button
    │   ├── Current month label
    │   └── Next month button
    ├── Weekday header row
    ├── Day grid
    └── Footer actions
        └── Clear
```
The first planned consumer is the future filter sub-panel:
```plain text
Filter row
├── Property select: Updated
├── Operator select: is before
├── Value control: DatePicker
└── Remove filter
```
### Component API

Suggested public API:
```typescript
type DatePickerProps = {
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder?: string;
  "aria-label": string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
};
```
`value`, `minDate`, and `maxDate` use date-only ISO strings: `YYYY-MM-DD`. Invalid strings should not crash rendering. The component should either ignore an invalid external value and show the placeholder, or surface a development-friendly warning in tests. It should never emit a non-ISO value.
`aria-label` is required because the trigger may be rendered in compact filter rows without a visible ``. If a future field wrapper provides a visible label, the caller can still pass an equivalent accessible label.
### Trigger

The closed state renders as a button, not an input. This avoids native date picker behavior and lets the whole control open the popover.
Visual contract:
- Height: `h-control-base`.
- Width: fills the parent by default.
- Border: `border-border` or error styling only if a future prop adds invalid state.
- Background: `bg-background`.
- Text: `text-text` for selected date, `text-subtext-1` for placeholder.
- Focus: `focus-visible:ring-2 focus-visible:ring-focus`.
- Disabled: muted text and blocked activation using native `disabled` unless tooltip eligibility is later required.
The selected value should display in a readable date-only format. Use a deterministic format for tests. If no formatter convention exists, prefer `May 27, 2026` for display while preserving `2026-05-27` in the value contract.
### Popover layout

The popover uses the existing `Popover` primitive with token classes. It should align to the trigger start and have enough width for a seven-column calendar without horizontal scrolling.
```plain text
┌─────────────────────────────┐
│  ‹       May 2026        ›  │
├─────────────────────────────┤
│  S   M   T   W   T   F   S  │
│                      1   2  │
│  3   4   5   6   7   8   9  │
│ 10  11  12  13  14  15  16  │
│ 17  18  19  20  21  22  23  │
│ 24  25 [26] 27  28  29  30  │
│ 31                          │
├─────────────────────────────┤
│ Clear                       │
└─────────────────────────────┘
```
Day states:
- **Selected:** primary-accent background or border with sufficient contrast.
- **Today:** visible ring, underline, or subtle primary marker when not selected.
- **Focused:** focus ring uses `text-focus` / `ring-focus` token behavior.
- **Outside current month:** hidden or muted; choose one deterministic behavior and cover it in tests.
- **Disabled by bounds:** muted, non-interactive, and skipped or announced as disabled.
### Calendar behavior

Opening rules:
- If `value` is valid, open to that month and focus that day.
- If `value` is `null`, open to today's month and focus today.
- If today is outside `minDate` / `maxDate`, focus the nearest selectable date.
Selection rules:
- Clicking a selectable day calls `onChange("YYYY-MM-DD")` and closes the popover.
- Pressing `Enter` on a focused selectable day does the same.
- Selecting the already selected day still emits the same date and closes; it does not clear. Clear is explicit.
- `Escape` closes without calling `onChange`.
Bounds rules:
- Dates before `minDate` are disabled.
- Dates after `maxDate` are disabled.
- Month navigation may move to months with no selectable days, but disabled days remain unavailable. If the implementation can cleanly detect impossible previous or next navigation because of bounds, disable those buttons.
### Clear affordance

The popover footer includes `Clear` when `value` is non-null. Activating it calls `onChange(null)` and closes the popover. If `value` is already null, the footer may hide the clear action or render it disabled; hiding it is simpler.
Clear must not change the surrounding filter row, operator, property, or any other view config. Consumers own those changes.
### Accessibility

- The trigger has the caller-provided accessible label.
- The trigger exposes expanded state through the underlying popover trigger semantics where practical.
- Previous and next month buttons have labels such as `Previous month` and `Next month`.
- The month label is announced as context for the grid.
- The calendar exposes usable roles through explicit ARIA on the grid, row, column header, and day controls.
- Keyboard users can move by day with arrow keys and select with `Enter`.
- `Escape` closes the popover.
- Focus returns to the trigger after selection, clear, or escape.
- Disabled dates communicate disabled state.
- The component has no axe violations in the default, selected, disabled, and bounded cases.
### Showcase and manual review

Add a DatePicker example to the dev showcase if that route is the current home for primitive review. The showcase should include:
- Empty value with placeholder.
- Selected value.
- Bounded value with `minDate` and `maxDate`.
- Disabled state.
Manual review should check both Latte and Macchiato themes using `⌘+shift+d`.
## Tech spec

### Prerequisites and references

- Issue #57: date picker primitive.
- Issue #44: filter sub-panel, which needs this primitive for absolute-date operators.
- `context-agent/collections/collection-read.md`, especially the filter operator table for date properties.
- `context-agent/design-system.md` for tokens, form primitives, overlay composition, and the maintenance contract.
- ADR-002 for the Tauri + React WebView architecture and cross-platform WebView constraints.
- ADR-003 for local-first single-user scope. This feature remains frontend-only.
### Dependency decision

Recommended implementation path: do not add a date-picker package such as `react-day-picker`. Follow the repository's existing design-system pattern: expose a thin `DatePicker` layer that composes the existing Radix-backed `Popover` primitive with a small token-styled calendar grid implemented in `src/ui/forms/DatePicker.tsx`.
The calendar grid should be owned by `hm` rather than delegated to a non-Radix date picker dependency:
- Use the existing `Popover` primitive for anchored overlay behavior, focus trapping/return, escape handling, and portal placement.
- Render month navigation, weekday headers, and day buttons directly with React and native buttons.
- Implement roving day focus and keyboard movement in the component with explicit ARIA roles and labels.
- Add no new runtime dependency unless implementation discovers a small Radix utility is already the project convention and is necessary for focus management; do not add a general-purpose date-picker library.
- Keep all styling in Tailwind utilities backed by design-system tokens.
The implementation should document any focus-management tradeoff in the PR summary or durable context if the hand-built calendar grid needs behavior beyond the existing `Popover`.
### Date model

Use date-only ISO strings at the component boundary:
```typescript
type IsoDate = `${number}-${number}-${number}`;
```
Do not use JavaScript `Date` objects at the public API boundary. Internally, parse ISO strings carefully to avoid timezone drift. Prefer helper functions that treat year, month, and day as local date parts rather than midnight UTC instants.
Suggested helpers inside `DatePicker.tsx` or a colocated private module if tests need direct access:
- `isIsoDate(value: string): boolean`
- `parseIsoDate(value: string): CalendarDate | null`
- `formatIsoDate(date: CalendarDate): string`
- `formatDisplayDate(iso: string): string`
- `clampToBounds(date, minDate, maxDate): CalendarDate`
`CalendarDate` should be a small internal `{ year; month; day }` type. Keep it private unless another primitive needs it.
### Component structure

Suggested structure:
```typescript
export type DatePickerProps = {
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder?: string;
  "aria-label": string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
};

export function DatePicker(props: DatePickerProps) {
  // open state, display month, parsed value, parsed bounds
  // trigger button
  // Popover calendar
}
```
State rules:
- Own only popover open state and temporary display month/focus state.
- Treat `value` as controlled.
- Recompute selected day from `value` each render.
- When `value` changes externally while the popover is open, keep the calendar in sync without emitting another change.
### Styling

Use Tailwind utilities backed by design-system tokens:
- Trigger: mirror `TextField` classes where possible.
- Popover body: compact padding and `bg-mantle` inherited from `Popover` unless a nested surface is needed.
- Month navigation buttons: use existing button or icon-button primitive if available; otherwise use native buttons with token classes.
- Day buttons: square or near-square hit targets that fit the compact popover while remaining usable. Prefer at least `h-control-base` / `w-control-base` equivalent sizing if layout allows.
- Text: `text-sm` for day labels, `text-xs` for weekday labels and footer actions where appropriate.
No inline colors. No Catppuccin-specific token names in component code.
### Integration points

- Add `src/ui/forms/DatePicker.tsx`.
- Add `src/ui/forms/DatePicker.test.tsx`.
- Update `src/ui/forms/index.ts` if a forms barrel exists; otherwise follow current import conventions.
- Update `src/_dev/Showcase.tsx` and tests if the showcase already lists primitives.
- Update `context-agent/design-system.md` to include `DatePicker` under Forms with its value contract and accessibility notes.
Do not wire the primitive into `FilterPanel` in this feature. Issue #44 owns that integration.
### Testing plan

**Component tests**
- Renders a trigger with the placeholder when `value` is `null`.
- Renders a trigger with the formatted selected date when `value` is set.
- Opens the popover when the trigger is clicked.
- Shows the correct month for the selected date.
- Shows today's month when `value` is `null`.
- Navigates to previous and next months.
- Clicking a day calls `onChange` with `YYYY-MM-DD` and closes the popover.
- Clicking `Clear` calls `onChange(null)` and closes the popover.
- Does not render `Clear` or renders it disabled when there is no value.
- Honors `disabled` by blocking popover opening.
- Honors `minDate` and `maxDate` by disabling out-of-bound days.
- Does not emit a disabled out-of-bound date.
- Handles an invalid external `value` without crashing.
**Keyboard and accessibility tests**
- `Enter` or `Space` opens the trigger.
- Arrow keys move the focused day.
- `Enter` selects the focused day.
- `Escape` closes without calling `onChange`.
- Focus returns to the trigger after select, clear, and escape.
- Previous/next buttons and clear action have accessible names.
- `jest-axe` reports no violations for empty, selected, bounded, and disabled examples.
**Showcase tests**
- The dev showcase renders DatePicker examples if the showcase is updated.
- Theme-sensitive assertions should avoid snapshots with hardcoded colors; prefer role and class-contract assertions.
### Verification commands

Run targeted checks first, then broader checks:
```bash
npm test -- DatePicker
npm test -- Showcase
npm test
npm run lint
npm run build
```
Manual verification:
```bash
npm run dev
```
Then open the dev showcase route with `⌘+shift+d` and verify the picker in both Latte and Macchiato themes. If Tauri-only behavior needs checking, use `npm run tauri dev` instead and document any skipped manual checks.
## Task decomposition

- [ ] **Story: Implement the Radix-composed calendar foundation**
	- **Description:** Build the date picker as a thin layer over existing Radix-backed primitives, with an owned calendar grid instead of a third-party date-picker package.
	- **Acceptance criteria:**
		- [ ] The implementation uses the existing `Popover` primitive for overlay placement and open/close behavior.
		- [ ] The owned calendar grid supports keyboard navigation, accessible roles, day selection, disabled dates, and month navigation.
		- [ ] The grid can be styled with design-system tokens only.
		- [ ] No general-purpose date-picker dependency is added.
		- [ ] Any non-obvious focus-management tradeoff is clear in implementation notes or PR summary.
	- **Dependencies:** Issue #57 implementation note and current dependency list.
	- [ ] **Task: Confirm existing Radix composition points**
		- Review `Popover` and current form primitives so the trigger, content, and focus-return behavior follow repository conventions.
	- [ ] **Task: Define the internal calendar grid model**
		- Define month, weekday, bounds, selected, today, and focused-day state using private date-part helpers.
	- [ ] **Task: Avoid date-picker dependencies**
		- Keep `package.json` and `package-lock.json` unchanged unless a narrowly scoped Radix utility is required and justified.
- [ ] **Story: Implement the controlled DatePicker primitive**
	- **Description:** Add the reusable form primitive with controlled ISO value behavior and a TextField-like trigger.
	- **Acceptance criteria:**
		- [ ] `DatePicker` accepts `value`, `onChange`, `placeholder`, `aria-label`, `disabled`, `minDate`, and `maxDate`.
		- [ ] The trigger visually matches existing form-control sizing and token styling.
		- [ ] The trigger shows placeholder text when value is null.
		- [ ] The trigger shows a deterministic formatted date when value is set.
		- [ ] Invalid external values do not crash the component.
		- [ ] The component remains controlled and does not store selected value internally.
	- **Dependencies:** Story 1 decision.
	- [ ] **Task: Add DatePicker file and props**
		- Create `src/ui/forms/DatePicker.tsx` with the public prop type and controlled component shell.
	- [ ] **Task: Add ISO parsing and formatting helpers**
		- Parse, validate, format for storage, and format for display without timezone drift.
	- [ ] **Task: Add trigger rendering**
		- Render a button with TextField-like token classes, disabled behavior, focus ring, and accessible label.
	- [ ] **Task: Add initial render tests**
		- Cover placeholder, selected display, disabled state, invalid value, and required accessible labeling.
- [ ] **Story: Build the popover calendar interaction**
	- **Description:** Render a month calendar inside `Popover` with navigation, selection, today highlight, and clear behavior.
	- **Acceptance criteria:**
		- [ ] Opening the picker shows a calendar for the selected month or today's month.
		- [ ] Previous and next month controls update the visible month.
		- [ ] Today is visibly marked when present.
		- [ ] Selected date styling is distinct from today styling.
		- [ ] Picking a day emits `YYYY-MM-DD` and closes the popover.
		- [ ] Clear emits `null` and closes the popover.
		- [ ] `minDate` and `maxDate` disable out-of-bound days.
	- **Dependencies:** Controlled component shell.
	- [ ] **Task: Compose Popover**
		- Use the existing `Popover` primitive with controlled open state and compact content classes if needed.
	- [ ] **Task: Render calendar header and grid**
		- Render month label, previous/next controls, weekday labels, and day buttons through the owned calendar grid.
	- [ ] **Task: Implement selection and close behavior**
		- Call `onChange` on valid day selection and close the popover.
	- [ ] **Task: Implement clear behavior**
		- Add the clear action for non-null values and ensure it resets only the date value.
	- [ ] **Task: Add interaction tests**
		- Cover open, month navigation, day click, close, clear, today, selected, and bounds.
- [ ] **Story: Make keyboard and accessibility behavior reliable**
	- **Description:** Ensure keyboard users and assistive technology can operate the picker without platform-native date input behavior.
	- **Acceptance criteria:**
		- [ ] Keyboard opens the trigger.
		- [ ] Arrow keys move focused day.
		- [ ] `Enter` selects a day.
		- [ ] `Escape` closes without changing value.
		- [ ] Focus returns to the trigger after select, clear, or escape.
		- [ ] Calendar controls have descriptive accessible names.
		- [ ] `jest-axe` is clean for representative states.
	- **Dependencies:** Popover calendar interaction.
	- [ ] **Task: Wire focus behavior**
		- Configure the calendar and popover so initial focus and return focus are predictable.
	- [ ] **Task: Verify keyboard navigation**
		- Implement day-grid navigation directly, using the existing popover behavior for escape handling and focus return where possible.
	- [ ] **Task: Add accessibility tests**
		- Cover keyboard selection, escape, focus return, labelled controls, disabled dates, and axe checks.
- [ ] **Story: Document and showcase the primitive**
	- **Description:** Make the new shared primitive discoverable for future UI work and easy to manually review across themes.
	- **Acceptance criteria:**
		- [ ] `context-agent/design-system.md` lists `DatePicker` under Forms.
		- [ ] The design-system entry states the value contract, trigger behavior, popover behavior, and accessibility expectations.
		- [ ] The dev showcase includes empty, selected, bounded, and disabled examples if the showcase remains the primitive review surface.
		- [ ] Showcase tests pass if showcase code changes.
		- [ ] Manual review covers Latte and Macchiato themes.
	- **Dependencies:** Implemented primitive.
	- [ ] **Task: Update design-system documentation**
		- Add `DatePicker` to the Forms table and include concise contract notes.
	- [ ] **Task: Add showcase examples**
		- Add controlled examples to `src/_dev/Showcase.tsx` using local state.
	- [ ] **Task: Update showcase tests**
		- Cover that DatePicker examples render without brittle color assertions.
- [ ] **Story: Verify the feature**
	- **Description:** Run focused and broad checks before handing the primitive to issue #44.
	- **Acceptance criteria:**
		- [ ] `npm test -- DatePicker` passes.
		- [ ] `npm test -- Showcase` passes if showcase changed.
		- [ ] `npm test` passes.
		- [ ] `npm run lint` passes.
		- [ ] `npm run build` passes.
		- [ ] Manual theme review is completed or skipped with a reason.
		- [ ] Unsupported or deferred behavior is documented clearly.
	- **Dependencies:** Stories 1-5.
	- [ ] **Task: Run targeted tests**
		- Run DatePicker and any showcase-focused tests first.
	- [ ] **Task: Run broad validation**
		- Run full unit suite, lint, and build.
	- [ ] **Task: Perform manual review**
		- Open the dev showcase and verify the picker in Latte and Macchiato themes.
	- [ ] **Task: Document skipped checks**
		- If a check cannot run in the environment, record the exact reason.
## Open questions and implementation notes

- Do not use `react-day-picker` or another general-purpose date-picker package for this primitive. The design-system fit is a Radix-composed overlay plus an owned calendar grid.
- Display formatting should be deterministic. If the app later adds locale preferences, this primitive can accept a formatter or read a shared formatting utility, but that is out of scope here.
- Date-only ISO parsing must avoid timezone drift. Do not convert `YYYY-MM-DD` to UTC midnight and then format it in local time.
- The filter sub-panel should treat an empty date value as an incomplete filter row that does not apply. That behavior belongs to issue #44, not this primitive.
- Some calendar libraries support richer keyboard shortcuts such as `Home`, `End`, `PageUp`, and `PageDown`. Include them if they come for free, but the required baseline is arrow keys plus `Enter` and `Escape`.