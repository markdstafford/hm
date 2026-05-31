import { useId, useEffect, useState } from "react";
import { ChevronRight, Pin } from "lucide-react";
import type {
  CellRenderer,
  EntityPreviewMetadata,
  PreviewFieldConfig,
  PreviewFieldDefinition,
  ResolvedPreviewField,
} from "../types";
import { partitionPreviewFields } from "./fieldModel";

const ROOMY_SECONDARY_WIDTH = 520;

type Props<TItem, TProperty extends string> = {
  item: TItem;
  definitions: PreviewFieldDefinition<TItem, TProperty>[];
  config: PreviewFieldConfig<TProperty>[];
  preview?: EntityPreviewMetadata;
  ariaLabel?: string;
};

function secondaryLayoutClass(preview?: EntityPreviewMetadata): string {
  if (preview?.width !== null && preview?.width !== undefined) {
    return preview.width >= ROOMY_SECONDARY_WIDTH ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1";
  }
  return preview?.sizeClass === "roomy" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1";
}

function PreviewFieldValue<TItem, TProperty extends string>({
  item,
  field,
  fallbackRenderer,
}: {
  item: TItem;
  field: ResolvedPreviewField<TItem, TProperty>;
  fallbackRenderer?: CellRenderer<TItem, TProperty>;
}) {
  const renderCell = field.definition.renderCell ?? fallbackRenderer;
  if (!renderCell) return null;
  return <>{renderCell({ item, property: field.definition.property })}</>;
}

function PreviewFieldPair<TItem, TProperty extends string>({
  item,
  field,
}: {
  item: TItem;
  field: ResolvedPreviewField<TItem, TProperty>;
}) {
  const label = field.definition.label ?? field.definition.property;
  const accessibleLabel = field.pinned ? `Pinned ${label}` : label;

  return (
    <div className="inline-flex min-w-0 items-center gap-1.5 text-sm" data-preview-field={field.definition.property}>
      {field.pinned && <Pin size={12} aria-hidden="true" className="shrink-0 text-subtext" />}
      <span className="shrink-0 text-xs font-medium text-subtext">
        {accessibleLabel}
      </span>
      <span className="min-w-0 text-text">
        <PreviewFieldValue item={item} field={field} />
      </span>
    </div>
  );
}

export function PreviewFields<TItem, TProperty extends string>({
  item,
  definitions,
  config,
  preview,
  ariaLabel = "Issue fields",
}: Props<TItem, TProperty>) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const prevSizeClass = preview?.sizeClass;
  useEffect(() => {
    setExpanded(false);
  }, [prevSizeClass]);
  const { tierOne, secondary } = partitionPreviewFields(item, definitions, config);

  if (tierOne.length === 0 && secondary.length === 0) return null;

  return (
    <section aria-label={ariaLabel} className="flex flex-col gap-2 border-b border-border pb-3">
      {tierOne.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {tierOne.map((field) => (
            <PreviewFieldPair key={field.definition.property} item={item} field={field} />
          ))}
        </div>
      )}

      {secondary.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex w-fit items-center gap-1 rounded px-1 py-0.5 text-xs font-medium text-subtext hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ChevronRight
              size={12}
              aria-hidden="true"
              className={`transition-transform duration-100 ${expanded ? "rotate-90" : ""}`}
            />
            More fields ({secondary.length})
          </button>

          {expanded && (
            <div
              id={contentId}
              data-testid="preview-secondary-fields"
              className={`grid gap-x-6 gap-y-2 ${secondaryLayoutClass(preview)}`}
            >
              {secondary.map((field) => (
                <PreviewFieldPair key={field.definition.property} item={item} field={field} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
