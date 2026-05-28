---
created: 2026-05-28
last_updated: 2026-05-28
status: complete
issue: 46
issue_url: [https://github.com/markdstafford/hm/issues/46](https://github.com/markdstafford/hm/issues/46)
specced_by: autocatalyst
implemented_by: markdstafford
superseded_by: null
---
# Collection write UI layer

## What

`hm` needs the reusable write-side UI layer that turns a read-only collection into an action workbench. This feature adds generic selection state, a floating bulk-action bar, promise-based confirmation helpers, an undo toast helper, action registration types, and an action runner that wraps confirm → apply → toast → undo for any entity that supports actions.
The first implementation target is the existing collection viewer. Rows already render an inert checkbox and open detail when the row body is clicked. This feature makes that checkbox real for action-capable collections while preserving row-body detail behavior. It also adds a small developer showcase so the primitives can be exercised before backlog hygiene wires real entity actions in issue #48.
No domain-specific hygiene actions ship here. The runner and primitive contracts are the deliverable. After this feature, a future hygiene entity can register actions such as Approve, Approve high-confidence, and Reject, pass the current selection into the runner, and get confirmation, mutation calls, audit-log batch ids, success toast, and one-click undo with little feature-specific glue.
## Why

Backlog hygiene and future inline collection edits need a consistent safety path for source-system writes. Users should not have to learn a new selection model, confirmation flow, or undo affordance for each entity type. The write UI layer centralizes those interactions so each entity supplies only action copy and handlers.
Issue #45 added Jira mutation commands and the local audit log, but there is no React layer that can safely compose those commands. Without this feature, future viewers would either duplicate confirm/toast/undo wiring or call mutation commands directly from ad hoc buttons. That would make audit grouping, undo behavior, accessibility, and destructive confirmation inconsistent.
This feature also closes a product gap in the collection viewer. Rows already reserve space for selection, so users can see the shape of future batch work but cannot select anything. Making selection real is the first visible step toward the backlog grooming narrative in the app spec.
## Personas

- **Elena: EM** — wants to select several suggestions or issues, review one confirmation, commit the batch once, and undo quickly if she notices a mistake.
- **Future hygiene implementer** — needs a stable action runner and typed action registry so issue #48 can focus on hygiene-specific actions instead of modal, toast, and selection mechanics.
- **Future entity implementer** — needs generic primitives that can support Jira issues, GitHub issues, GitHub PRs, audit-log entries, and other collections without forking the viewer.
- **Maintainer** — needs the primitives covered by unit, integration, and accessibility tests before real source-system writes depend on them.
- **Security reviewer** — needs confirmation, toast, and action-runner code to avoid exposing tokens, raw upstream errors, SQL details, or source-system secrets in UI or test fixtures.
## Narratives

### Elena selects rows without losing detail context

Elena opens a collection-backed page and reviews rows in the normal list/detail layout. She clicks a row body to open the side peek, then ticks that row's checkbox. The detail rail stays open because selection is independent of detail focus.
She ticks two more rows. A floating bar appears above the footer and says `3 selected`. It does not push the list around, and it stays visible while Elena scrolls. She clears the selection from the bar when she decides to review a different set.
### A future hygiene batch confirms before writing

In issue #48, Elena selects four hygiene suggestions and presses `Approve 4`. The action runner opens an `AlertDialog` with entity-supplied copy explaining that four Jira changes will be written and recorded in the audit log. Elena can cancel with no side effects.
When Elena confirms, the runner generates one `batch_id`, calls the action's apply handler once per selected item with that shared batch id, clears the consumed selection, and shows a toast. If the action is reversible, the toast includes `Undo` for eight seconds. If not, the toast explains that the change is logged but not one-click reversible.
### A developer validates primitives in isolation

A developer opens the showcase route during implementation. They see a bulk-action bar with mock counts, buttons that invoke the confirm helper, an undo toast with a reversible action, and an action-runner example wired to fake items.
The developer can confirm the modal, cancel it, click Undo, and watch console-free state changes without needing real Jira data or hygiene suggestions. Automated tests cover the same flow so future changes to Radix wrappers or collection rows do not silently break the write layer.
## User stories

**Elena selects rows without losing detail context**
- Elena can tick one row's checkbox and see it become selected.
- Elena can tick multiple row checkboxes and see the selected count update.
- Elena can click a row body to open detail without changing checkbox selection.
- Elena can tick a checkbox without opening or changing the detail rail.
- Elena can clear the current selection from the floating bar.
- Elena's selection survives sorting, grouping, filtering, view-chip switches, and preview-surface changes inside the same collection page.
- Elena's selection clears when she leaves the collection entity or when an action consumes the selection.
**Future hygiene implementer wires actions**
- Implementer can register an entity action with stable id, label, slot, confirm copy, toast copy, reversibility metadata, apply handler, and optional reverse handler.
- Implementer can render action slots in a floating bulk-action bar without hand-coding the bar layout.
- Implementer can call the runner with selected ids, current items, and one action definition.
- Implementer can receive one shared `batch_id` for a batch run.
- Implementer can map selected ids to current item before-state JSON before applying mutations.
- Implementer can rely on the runner to show confirmation before any apply handler runs.
- Implementer can rely on the runner to show success, non-reversible, and undo toasts consistently.
**Maintainer validates behavior locally**
- Maintainer can run unit tests for selection, bar rendering, confirm resolution, undo timing, and action-runner sequencing.
- Maintainer can run accessibility tests for the dialog, toast, and bulk bar states.
- Maintainer can open the showcase route and exercise every primitive without real source-system credentials.
## Goals

- Add `src/views/collection/selection/useSelection.ts` with a `Set`-backed selection hook returning `{ selectedIds, toggle, clear, has }`.
- Keep individual toggle operations O(1).
- Update `src/views/collection/Row.tsx` so the checkbox can be controlled by selection state when selection is enabled.
- Preserve row-body click behavior for detail open and stop propagation from checkbox clicks.
- Add `src/views/collection/BulkActionBar.tsx` as a floating, entity-agnostic bar that renders only when `count > 0`.
- Position the bar fixed at the bottom center above the app footer without reflowing content.
- Add `src/views/collection/ConfirmAction.ts` with a programmatic Promise API around the existing `AlertDialog` primitive.
- Support single-action and batch confirmation copy through the same helper shape.
- Add `src/views/collection/UndoToast.ts` as a hook returning `{ show, dismiss }` and using the existing Radix-backed `Toast` primitive.
- Auto-dismiss undo toasts after 8 seconds.
- Show an Undo button only when the toast is reversible and an undo handler is supplied.
- Add `src/views/collection/actions/types.ts` for action registration contracts.
- Add `src/views/collection/actions/runner.ts` to run one action against the current selection.
- Generate one `batch_id` for each batch run and pass it to every per-item apply call.
- Give action handlers access to selected item ids, current items, before-state JSON, and batch context.
- Clear the consumed selection after a successful action run.
- Extend `src/_dev/Showcase.tsx` with examples for the bulk bar, confirmation helper, undo toast, and action runner.
- Cover all new primitives and the runner with focused tests.
- Use existing design-system primitives and token utilities only.
## Non-goals

- No hygiene-specific actions, copy, suggestion entity, or routing logic. Issue #48 owns those.
- No source-system mutation implementation. Issue #45 owns Jira mutation commands and audit-log storage.
- No new Rust commands or database schema changes.
- No history page, per-entry undo list, or per-batch history undo. Issue #49 owns that.
- No shift-click range selection.
- No select-all-in-group checkbox.
- No inline quick-edit affordances such as clicking a status cell to change status.
- No background mutation queue, offline retry queue, or rate-limited batch scheduler.
- No automatic refetch strategy after mutation. Consumers decide whether to refresh, patch local state, or wait for a future sync.
- No GitHub-specific write actions.
- No Storybook dependency; the existing `_dev/Showcase` route is enough for this feature.
## Design spec

### Interaction model

Selection and detail focus are separate states:
```plain text
row checkbox click  → toggle selected id only
row body click      → open/update detail only
clear button        → clear selected ids only
action success      → clear selected ids and show toast
entity switch       → selection state unmounts and clears
```
A selected row may also be the active detail row, but one state does not imply the other. This preserves the collection-read contract while enabling batch work.
### Selection state

The selection hook stores ids in a `Set`. It returns a stable shape:
```typescript
type SelectionState = {
  selectedIds: Set;
  toggle: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
};
```
The hook should create a new `Set` when state changes so React re-renders correctly. It should expose `selectedIds.size` for counts. It should not store item objects, because filtering, sorting, and grouping can rebuild item arrays while ids remain stable.
For issue #46, selection is local to the mounted collection page. It survives view configuration changes because the hook lives in the page-level collection viewer state, not inside `Body`, `Row`, or a group section. It clears when the collection page unmounts or when the action runner reports success.
### Row checkbox behavior

`Row.tsx` currently renders a disabled-looking placeholder with `Square`. This feature changes the row API to support real selection without breaking read-only callers.
Expected props:
```typescript
selection?: {
  selected: boolean;
  onToggle: () => void;
  label: string;
};
```
When `selection` is absent, the row may keep the current coming-soon checkbox treatment for read-only entities. When `selection` is present, the checkbox is interactive, exposes the supplied accessible label, reflects the selected state, and calls `event.stopPropagation()` before `onToggle()`. Prefer the existing `src/ui/forms/Checkbox.tsx` wrapper if its controlled API fits row use; otherwise use a native button/checkbox with equivalent accessible semantics and token styling.
The row body remains a separate button that opens detail. Tests must assert that checkbox clicks do not call `onSelect`.
### Bulk-action bar layout

The bar appears only when at least one item is selected.
```plain text
┌──────────────────────────────────────────┐
│  4 selected   [ Primary ] [ Conditional ]│
│                    [ Destructive ] [ ✕ ] │
└──────────────────────────────────────────┘
```
`BulkActionBar` props:
```typescript
type BulkActionBarProps = {
  count: number;
  slots: {
    primary?: ReactNode;
    conditionalPrimary?: ReactNode;
    destructive?: ReactNode;
    [slot: string]: ReactNode | undefined;
  };
  onClear: () => void;
};
```
Behavior:
- Return `null` when `count  Promise;
```
The helper uses `AlertDialog` and resolves:
- `true` when the user confirms.
- `false` when the user cancels, closes via Escape, or otherwise dismisses without confirming.
The modal copy is supplied by the entity action. The shell owns only layout and button variant. The cancel button is left of the primary/destructive button. The destructive kind uses the `destructive` button variant.
### Undo toast helper

`UndoToast.ts` exposes a hook:
```typescript
type UndoToastInput = {
  message: string;
  description?: string;
  undo?: () => void | Promise;
  reversible: boolean;
};

type UndoToastApi = {
  show: (input: UndoToastInput) => void;
  dismiss: () => void;
};
```
Behavior:
- Use `Toast.Provider` with an 8-second duration.
- Show one toast at a time. Showing a new toast dismisses or replaces the previous toast.
- Render `Toast.Title` from `message` and `Toast.Description` from `description` when present.
- Render `Undo` only when `reversible === true` and `undo` exists.
- Call `undo` once when the user clicks `Undo`, then dismiss the toast.
- Omit `Undo` for non-reversible actions and keep copy honest.
- Do not log action payloads, before-state JSON, or command errors to the console by default.
### Action slots and registration

Entity actions declare where they appear and how they run. The action contract should live under `src/views/collection/actions/types.ts` and stay generic over item type.
Expected shape:
```typescript
type CollectionActionSlot = "primary" | "conditionalPrimary" | "destructive";
type CollectionActionKind = "primary" | "destructive";

type CollectionActionDefinition = {
  id: string;
  label: string | ((count: number) => string);
  slot: CollectionActionSlot;
  kind: CollectionActionKind;
  isAvailable?: (items: TItem[]) => boolean;
  confirm: (context: ActionCopyContext) => ConfirmActionInput;
  toast: (context: ActionResultContext) => UndoToastInput;
  reversible: boolean;
  getBeforeState: (item: TItem) => unknown;
  apply: (context: ApplyActionContext) => Promise;
  reverse?: (context: ReverseActionContext) => Promise;
};
```
Exact names may change during implementation, but the type must capture these responsibilities: stable audit id, label, slot, confirm copy, toast copy, reversibility, apply handler, optional reverse handler, and a before-state mapper.
### Action runner flow

The runner is the API future collection pages call. It accepts the selected ids, the current item array, an action definition, and UI adapters for confirm/toast/selection clear.
Expected behavior:
1. Convert selected ids to current items using the entity id getter or an explicit id mapper.
2. Drop ids whose item no longer exists in the current item array.
3. If no items remain, return a cancelled/no-op result and do not open confirmation.
4. Build confirmation copy from the action definition and selected items.
5. Await confirmation.
6. If cancelled, do not call any apply handler and do not clear selection.
7. Generate one `batch_id` for the run after confirmation.
8. For each selected item, call the action's `apply` handler with the item, item id, before-state JSON, selected count, batch id, action id, and source feature context.
9. Use the same `batch_id` for every item in the run.
10. If all apply calls succeed, clear the consumed selection and show the toast.
11. If the action is reversible and has a reverse handler, wire the toast's Undo button to call the reverse handler with the same result context.
12. If any apply call fails, surface a safe error to the caller and do not claim success in the toast.
Batch execution may be sequential for v1. Sequential execution makes error handling easier and avoids accidental source-system pressure. Parallel execution is not required.
### Showcase additions

Extend `src/_dev/Showcase.tsx` with a `Collection write` section. It should include:
- A `BulkActionBar` sample with a mock count and three slot buttons.
- A button that opens the confirm helper and displays whether the result was confirmed or cancelled.
- A button that shows a reversible undo toast and tracks whether Undo was clicked.
- A small fake action-runner example with two or three mock items and in-memory apply/reverse handlers.
Update `src/_dev/Showcase.test.tsx` to assert the new section heading exists and the controls render. Keep the showcase independent of Tauri IPC and real Jira data.
### Accessibility rules

- The bulk bar has a clear label such as `Bulk actions` or an equivalent `aria-label`.
- The selected count is exposed as text, not only as visual state.
- The clear button has label `Clear selection`.
- Row checkboxes have accessible names that include the row identity when available, such as `Select AMP-123`.
- Confirm dialogs use `AlertDialog.Title`, `AlertDialog.Description`, cancel, and action controls.
- Toast action buttons are keyboard reachable while the toast is visible.
- Focus rings use `focus-visible:ring-focus` or existing primitive defaults.
- New tests run `jest-axe` against the dialog/toast/bar showcase or focused primitive harness.
## Tech spec

### Prerequisites and references

- Issue #46 — `feat(collections): write UI layer (selection, bulk bar, confirm, toast)`.
- Issue #37 / `feature-collection-viewer-foundation.md` — generic collection row/detail foundation and current inert checkbox behavior.
- Issue #45 / `feature-collection-write-data-layer.md` — Jira mutation commands, audit log, reversibility, and batch id expectations.
- `context-agent/collections/collection-write.md` — selection, bulk-action bar, confirm modal, undo toast, and action contract.
- `context-agent/design-system.md` — token, primitive, overlay, toast, and collection patterns.
- ADR-002 — Tauri desktop shell and React UI.
- ADR-003 — local-first single-user v1.
- ADR-005 — event-sourced history and auditability expectations.
- ADR-008 — settings and credentials split; this UI must not handle tokens.
### Existing implementation context

The repository already has these pieces relevant to issue #46:
- `src/views/collection/Row.tsx` renders an inert checkbox-like button and a separate row-body button.
- `src/views/collection/Body.tsx` owns row rendering for flat and grouped lists.
- `src/features/collection-viewer/useCollectionViewer.tsx` owns page-level collection state, filtered/sorted/grouped display items, preview state, and keyboard navigation.
- `src/ui/overlays/AlertDialog.tsx` wraps Radix AlertDialog.
- `src/ui/feedback/Toast.tsx` wraps Radix Toast.
- `src/ui/buttons/Button.tsx` supports `primary`, `secondary`, `ghost`, and `destructive` variants.
- `src/ui/forms/Checkbox.tsx` exists and should be preferred if it fits row selection.
- `src/bindings.ts` exposes issue #45 mutation and audit commands, but this feature does not need to call them directly in the showcase.
### Module layout

Add these frontend modules:
```plain text
src/views/collection/
  selection/
    useSelection.ts
    useSelection.test.tsx
  BulkActionBar.tsx
  BulkActionBar.test.tsx
  ConfirmAction.tsx
  ConfirmAction.test.tsx
  UndoToast.tsx
  UndoToast.test.tsx
  actions/
    types.ts
    runner.ts
    runner.test.ts
```
Update these existing modules:
```plain text
src/views/collection/Row.tsx
src/views/collection/Row.test.tsx
src/views/collection/Body.tsx              # only if selection props must thread through Body
src/features/collection-viewer/useCollectionViewer.tsx
src/_dev/Showcase.tsx
src/_dev/Showcase.test.tsx
```
If implementation can keep issue #46 showcase-only without wiring selection into the production Jira issues page, `Body.tsx` and `useCollectionViewer.tsx` may receive only minimal optional props. However, the row checkbox behavior must be proven with tests and the API must be ready for issue #48.
### Selection hook implementation

`useSelection` should be pure React state with no browser APIs:
```typescript
export function useSelection(initialIds: Iterable = []) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(initialIds));
  const toggle = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clear = useCallback(() => setSelectedIds(new Set()), []);
  const has = useCallback((id: string) => selectedIds.has(id), [selectedIds]);
  return { selectedIds, toggle, clear, has };
}
```
Implementation may refine this shape, but tests must cover toggle on, toggle off, clear, and `has`.
### Row and Body API changes

Prefer threading selection through `Body` so page-level code can enable it once:
```typescript
type BodySelection = {
  selectedIds: ReadonlySet;
  onToggle: (item: TItem) => void;
  getLabel?: (item: TItem) => string;
};
```
`Body` passes row-level `selected`, `onToggle`, and label props to `Row`. Grouped and ungrouped render paths must behave the same.
Read-only callers should remain valid. Existing tests that expect `Select issue (coming soon)` should be updated or split so read-only behavior is still explicit if retained.
### BulkActionBar implementation

The component is presentation-only. It does not know about entity contracts, selected ids, or action definitions. The page/action adapter builds slot nodes with `Button` components and passes them in.
Recommended structure:
```typescript
if (count 
    {count} selected
    {slots.primary}
    {slots.conditionalPrimary}
    {slots.destructive}
    ...
  
);
```
Tests cover hidden state, count text, slot rendering, and clear callback.
### ConfirmAction implementation

Because React cannot open a Radix dialog from a plain function without mounted state, implement one of these patterns:
1. A provider component and hook:
```typescript
{children}
const confirm = useConfirmAction();
await confirm({ title, body, primaryLabel, kind });
```
1. A component that accepts an imperative ref and exposes `confirm()`.
Prefer the provider/hook pattern because it is easier to compose in the collection page and showcase.
The provider stores the pending input and resolver in state/ref. On confirm it resolves `true` and clears pending state. On cancel/open-change false it resolves `false` exactly once.
### UndoToast implementation

`useUndoToast` can return both the API and the rendered provider node, or it can require a provider similar to `ConfirmAction`. Prefer a provider/hook pair if that matches `ConfirmAction` and avoids each page mounting duplicate Radix providers.
The helper must manage timer behavior through Radix `Toast.Provider duration={8000}` or controlled state with a timeout. Tests can use fake timers to assert auto-dismiss at 8 seconds.
### Action types

Keep action types in TypeScript and independent of Jira bindings. The generic layer should not import `JiraIssueListItem`, `commands`, or source-specific modules.
Context types should include:
- `actionId`.
- `batchId`.
- `selectedIds`.
- `items`.
- `item` and `itemId` for per-item calls.
- `beforeState` for audit writes.
- `sourceFeature`, defaulting to a caller-supplied string such as `collection-action` in tests and future `hygiene-batch` in issue #48.
`beforeState` should be typed as `unknown` or a JSON-like value. Do not stringify in the generic runner unless a command API requires strings later. The source-specific action handler owns command input shape.
### Batch id generation

The runner can generate browser-safe ids without adding a dependency:
```typescript
function newBatchId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
```
Tests may inject a deterministic `createBatchId` function to assert that every apply call receives the same id.
### Runner error behavior

The runner should return a typed result instead of throwing raw values to UI code:
```typescript
type RunActionResult =
  | { status: "cancelled" }
  | { status: "applied"; batchId: string; count: number }
  | { status: "error"; error: string; batchId?: string; appliedCount: number };
```
A cancelled confirmation is not an error. If an apply handler throws, convert it to a safe string such as `Action could not be completed` unless the handler intentionally returns a safe display error. Do not include raw command payloads, token-shaped strings, before-state JSON, or stack traces in the display string.
For v1, if item 3 of 5 fails after the first two applied, the runner should stop, return an error with `appliedCount: 2`, and leave detailed recovery to the future history view/audit log. It must not show a success toast for a partial failure. The implementation may add a future hook for partial-failure toasts, but it is not required here.
### Collection viewer integration

The minimal production integration is:
- Mount `useSelection` in `useCollectionViewer` when the page is active.
- Pass selection props through `Body` to `Row`.
- Render `BulkActionBar` only when action slots are supplied. Since Jira issue browsing has no real actions in issue #46, the production page can omit action slots and avoid showing the bar for Jira issues.
- Keep the showcase as the main full demonstration of the bar and runner.
If implementation chooses not to enable selection on the production Jira issue page until issue #48 supplies actions, it must still update `Row` to support the real checkbox mode and leave the coming-soon mode available. The spec allows this because issue #46's verification route/showcase is the required consumer.
### Security and privacy

- The write UI layer does not handle source credentials, PATs, Authorization headers, or keychain refs.
- Action definitions must not put secrets in confirm copy, toast copy, labels, or test fixtures.
- The runner must not log action contexts or before/after state by default.
- Display errors must be safe and short. Source-specific handlers own redaction before passing messages to the generic runner.
- No telemetry or remote reporting is added.
### Testing plan

Unit tests:
- `useSelection` toggles ids on and off.
- `useSelection.clear()` empties the set.
- `useSelection.has(id)` reflects current state.
- `Row` renders an interactive checkbox when selection props are supplied.
- `Row` checkbox click toggles selection and does not call `onSelect`.
- `Row` body click calls `onSelect` and does not toggle selection.
- `BulkActionBar` returns nothing when count is zero.
- `BulkActionBar` renders count and supplied slots when count is positive.
- `BulkActionBar` clear button calls `onClear`.
- `ConfirmAction` resolves `true` on confirm.
- `ConfirmAction` resolves `false` on cancel/dismiss.
- `UndoToast` auto-dismisses at 8 seconds with fake timers.
- `UndoToast` calls the undo handler once when Undo is clicked.
- `UndoToast` omits Undo for non-reversible inputs.
Integration tests:
- Action runner with a fake action and two selected items opens confirmation, applies once per item, passes the same `batch_id` to each apply call, and shows a toast.
- Action runner does not apply or clear selection when confirmation returns false.
- Action runner maps selected ids to current items and ignores stale ids.
- Action runner wires toast Undo to the reverse handler when reversible.
- Action runner returns a safe error result when an apply handler fails.
- Showcase renders the `Collection write` section and has no axe violations.
Accessibility tests:
- `ConfirmAction` dialog passes axe in open state.
- `UndoToast` reversible and non-reversible states pass axe.
- `BulkActionBar` with representative slots passes axe.
- Updated collection row with checkbox and row-body button does not introduce nested interactive-element violations.
### Verification

Target automated checks for implementation:
```plain text
npm run lint
npm test
npm run build
```
Manual verification:
```plain text
npm run tauri dev
```
Then open the showcase route, find the `Collection write` section, and verify:
- The bulk bar appears for a mock positive count and clears when requested.
- Confirm action can be accepted and cancelled.
- Undo toast disappears after 8 seconds.
- Undo button calls the supplied reverse handler.
- The fake action runner applies every selected item with one shared batch id.
- There are no browser/Tauri console errors.
## Task decomposition

- [ ] **Story: Selection state and row wiring**
	- **Description:** Add the generic selection hook and make collection rows support real checkbox selection without breaking row-body detail behavior.
	- **Acceptance criteria:**
		- [ ] `useSelection` stores selected ids in a `Set`.
		- [ ] `toggle`, `clear`, and `has` are exposed and tested.
		- [ ] Toggling one id is O(1) with respect to membership checks.
		- [ ] `Row` supports an interactive selected state when selection props are supplied.
		- [ ] Checkbox clicks stop propagation and do not open detail.
		- [ ] Row-body clicks open detail and do not toggle selection.
		- [ ] Grouped and ungrouped `Body` paths can pass selection props consistently if Body is updated.
	- **Dependencies:** Existing collection row/body components.
	- [ ] **Task: Add ****`useSelection`**** hook**
		- **Description:** Create `src/views/collection/selection/useSelection.ts` with Set-backed state.
		- **Acceptance criteria:** Hook returns `selectedIds`, `toggle`, `clear`, and `has`; tests cover toggle on/off, clear, and membership.
		- **Dependencies:** None.
	- [ ] **Task: Update row selection API**
		- **Description:** Add optional row selection props and replace the inert checkbox when selection is enabled.
		- **Acceptance criteria:** Interactive checkbox has an accessible label, reflects selected state, calls the toggle callback, and never calls `onSelect`.
		- **Dependencies:** `useSelection` hook.
	- [ ] **Task: Thread selection through collection rendering**
		- **Description:** Add optional selection props to `Body` or page composition so future collection pages can enable selection centrally.
		- **Acceptance criteria:** Existing read-only callers still compile; grouped and flat body tests cover selection prop threading where implemented.
		- **Dependencies:** Updated row API.
- [ ] **Story: Bulk action bar primitive**
	- **Description:** Add the floating bar that entity action slots can fill when one or more rows are selected.
	- **Acceptance criteria:**
		- [ ] `BulkActionBar` renders `null` when `count <= 0`.
		- [ ] Positive counts render `N selected`.
		- [ ] Primary, conditional primary, destructive, and clear controls render in the expected order.
		- [ ] Clear control calls `onClear`.
		- [ ] Bar is fixed bottom-center above the shell footer and uses token styling only.
		- [ ] Accessibility test passes with representative slot buttons.
	- **Dependencies:** Existing `Button` and `IconButton` primitives.
	- [ ] **Task: Implement ****`BulkActionBar.tsx`**
		- **Description:** Build the presentational component and slot ordering.
		- **Acceptance criteria:** Component API matches the spec responsibilities; hidden and visible states are tested.
		- **Dependencies:** None.
	- [ ] **Task: Add bar tests**
		- **Description:** Cover count, slot rendering, clear callback, and axe for the visible bar.
		- **Acceptance criteria:** Tests fail if count zero renders, slots disappear, or clear is not called.
		- **Dependencies:** `BulkActionBar.tsx`.
- [ ] **Story: Confirmation and undo helpers**
	- **Description:** Add reusable React helpers around the existing `AlertDialog` and `Toast` primitives.
	- **Acceptance criteria:**
		- [ ] Confirm helper returns a Promise that resolves `true` on confirm.
		- [ ] Confirm helper resolves `false` on cancel or dismiss.
		- [ ] Confirm helper supports primary and destructive action variants.
		- [ ] Undo toast helper shows message and optional description.
		- [ ] Undo toast renders Undo only for reversible inputs with an undo handler.
		- [ ] Undo toast auto-dismisses at 8 seconds.
		- [ ] Dialog and toast tests include axe coverage.
	- **Dependencies:** Existing `AlertDialog`, `Toast`, and `Button` primitives.
	- [ ] **Task: Implement ****`ConfirmAction`**** provider/hook**
		- **Description:** Create a programmatic confirmation API around `AlertDialog`.
		- **Acceptance criteria:** Pending resolver is settled exactly once; confirm/cancel tests pass; destructive variant uses destructive button styling.
		- **Dependencies:** None.
	- [ ] **Task: Implement ****`UndoToast`**** provider/hook**
		- **Description:** Create an 8-second toast API with optional Undo action.
		- **Acceptance criteria:** Fake-timer tests prove auto-dismiss; clicking Undo calls the handler once and dismisses; non-reversible toast omits Undo.
		- **Dependencies:** None.
- [ ] **Story: Generic action contract and runner**
	- **Description:** Define collection action types and implement the runner that composes selection, confirm, apply, toast, and undo.
	- **Acceptance criteria:**
		- [ ] Action types include id, label, slot, kind, confirm copy, toast copy, reversibility, before-state mapper, apply handler, and optional reverse handler.
		- [ ] Runner maps selected ids to current items and ignores stale ids.
		- [ ] Runner does not apply when confirmation is cancelled.
		- [ ] Runner generates one batch id and passes it to every apply call.
		- [ ] Runner calls apply once per selected current item.
		- [ ] Runner clears selection only after full success.
		- [ ] Runner shows a toast after full success.
		- [ ] Runner wires Undo to reverse handler for reversible actions.
		- [ ] Runner returns a safe error result on apply failure and does not show a success toast.
	- **Dependencies:** Confirm helper, undo toast helper, selection hook.
	- [ ] **Task: Add action registration types**
		- **Description:** Create `src/views/collection/actions/types.ts` with generic action and context types.
		- **Acceptance criteria:** Types are generic over item shape and do not import Jira-specific modules.
		- **Dependencies:** None.
	- [ ] **Task: Implement runner**
		- **Description:** Create `src/views/collection/actions/runner.ts` for confirm → apply → toast → undo.
		- **Acceptance criteria:** Runner tests cover success, cancellation, stale ids, shared batch id, undo, and failure behavior.
		- **Dependencies:** Action types and UI adapter APIs.
	- [ ] **Task: Add deterministic batch-id injection for tests**
		- **Description:** Let tests supply `createBatchId` while production uses UUID/random fallback.
		- **Acceptance criteria:** Tests assert every apply call sees the same injected batch id.
		- **Dependencies:** Runner implementation.
- [ ] **Story: Showcase and integration readiness**
	- **Description:** Extend the developer showcase and wire enough collection page state to prove the primitives can be consumed by issue #48.
	- **Acceptance criteria:**
		- [ ] Showcase has a `Collection write` section.
		- [ ] Showcase exercises `BulkActionBar`, `ConfirmAction`, `UndoToast`, and a fake action runner.
		- [ ] Showcase tests assert the new section renders.
		- [ ] Showcase axe test still passes.
		- [ ] Production collection viewer code has a clear integration seam for future entity actions.
		- [ ] No real Jira mutation command is called from showcase tests.
	- **Dependencies:** Selection, bar, confirmation, toast, and runner stories.
	- [ ] **Task: Add showcase examples**
		- **Description:** Add interactive examples for all issue #46 primitives to `src/_dev/Showcase.tsx`.
		- **Acceptance criteria:** Examples work without Tauri IPC, real Jira data, or credentials.
		- **Dependencies:** All primitives and runner.
	- [ ] **Task: Update showcase tests**
		- **Description:** Extend `Showcase.test.tsx` for the new heading and representative controls.
		- **Acceptance criteria:** Existing showcase tests keep passing and axe has no violations.
		- **Dependencies:** Showcase examples.
	- [ ] **Task: Prepare collection viewer seam**
		- **Description:** Mount or expose optional selection/action state in `useCollectionViewer` without showing fake actions on Jira issues.
		- **Acceptance criteria:** Future issue #48 can pass real action definitions without reworking row or bar primitives; Jira issue browsing remains safe and non-mutating.
		- **Dependencies:** Selection and action contracts.
- [ ] **Story: Validation and handoff**
	- **Description:** Run focused and broad frontend checks and document any unsupported behavior.
	- **Acceptance criteria:**
		- [ ] `npm run lint` passes.
		- [ ] `npm test` passes.
		- [ ] `npm run build` passes or any failure is documented.
		- [ ] Manual showcase verification is performed with `npm run tauri dev`, or skipped with a clear reason.
		- [ ] Unsupported behavior is explicitly noted: shift-click, select-all-in-group, history undo, and hygiene-specific actions are not part of issue #46.
	- **Dependencies:** All implementation stories.
	- [ ] **Task: Run targeted component tests during development**
		- **Description:** Run the new Vitest files as primitives are added.
		- **Acceptance criteria:** New tests fail before implementation and pass after.
		- **Dependencies:** Tests added per story.
	- [ ] **Task: Run full frontend checks**
		- **Description:** Run lint, unit tests, and build from the repo root.
		- **Acceptance criteria:** Results are recorded in the implementation handoff.
		- **Dependencies:** All code changes complete.
	- [ ] **Task: Manual showcase smoke**
		- **Description:** Open the app, navigate to showcase, and exercise the collection write section.
		- **Acceptance criteria:** Confirm, cancel, undo, clear, and fake action-runner flows work without console errors.
		- **Dependencies:** Showcase examples and app run command.
## Verification plan

- Run `npm run lint` from the repository root.
- Run `npm test` from the repository root.
- Run `npm run build` from the repository root.
- Run `npm run tauri dev` for manual showcase verification when the local desktop environment permits it.
- Do not run real Jira mutation commands as part of issue #46 verification. Use fake handlers in tests and showcase.
## Open questions and risks

- The current `Row` uses a button for the row body and a separate button for the inert checkbox. Implementation must avoid nested interactive elements and preserve axe coverage when the checkbox becomes real.
- The generic runner can safely stop on first failure, but partial success remains a product risk because some mutations may already have committed before a later item fails. Issue #45's audit log and future history view are the recovery path; issue #46 should not claim atomic batch writes.
- Reversibility depends on each entity action's reverse handler. The generic toast can expose Undo, but source systems such as Jira may still reject a reverse operation later.
- Production Jira issue browsing has no issue #46 action definitions. If selection is enabled there before actions exist, the UI could show selected rows without a useful action. Prefer keeping real bulk-action UI in showcase or future action-capable pages until issue #48 supplies actions.
- Shift-click range selection, select-all-in-group, and history-based undo are intentionally out of scope and should not be partially implemented here.