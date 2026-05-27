import { useCollectionViewer } from "./useCollectionViewer";

/**
 * All-in-one component used by tests and any caller that wants the collection
 * viewer as a single ReactNode. The production app renders `header` and `body`
 * separately via `useCollectionViewer` so they land in the AppShell's
 * `mainHeader` and `mainContent` slots respectively.
 */
export function CollectionViewerPage() {
  const { header, body } = useCollectionViewer({ active: true });
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {header && (
        <div className="flex h-[var(--height-header-bar)] shrink-0 items-center px-3 border-b border-border/60">
          {header}
        </div>
      )}
      {body}
    </div>
  );
}
