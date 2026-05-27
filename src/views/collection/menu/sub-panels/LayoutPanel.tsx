import { LayoutGrid, Kanban, List, GalleryHorizontal, GitCommitHorizontal, CalendarDays, ChevronRight } from "lucide-react";
import { PanelHeader } from "../PanelHeader";
import { PreviewPopover, previewLabel } from "./PreviewPopover";
import { patchViewConfig } from "../../ViewConfig";
import type { ViewConfig, ViewDensity } from "../../ViewConfig";

type LayoutTile = {
  label: string;
  icon: React.ReactNode;
  value: string;
  enabled: boolean;
};

const LAYOUT_TILES: LayoutTile[] = [
  { label: "Table", icon: <LayoutGrid size={16} aria-hidden />, value: "table", enabled: true },
  { label: "Board", icon: <Kanban size={16} aria-hidden />, value: "board", enabled: false },
  { label: "List", icon: <List size={16} aria-hidden />, value: "list", enabled: false },
  { label: "Gallery", icon: <GalleryHorizontal size={16} aria-hidden />, value: "gallery", enabled: false },
  { label: "Timeline", icon: <GitCommitHorizontal size={16} aria-hidden />, value: "timeline", enabled: false },
  { label: "Calendar", icon: <CalendarDays size={16} aria-hidden />, value: "calendar", enabled: false },
];

type Props = {
  config: ViewConfig;
  onPatchConfig: (config: ViewConfig) => void | Promise<void>;
  onBack: () => void;
  onClose: () => void;
};

export function LayoutPanel({ config, onPatchConfig, onBack, onClose }: Props) {
  function patchDensity(density: ViewDensity) {
    if (config.layout.density === density) return;
    void onPatchConfig(patchViewConfig(config, { layout: { ...config.layout, density } }));
  }

  function patchPreview(preview: ViewConfig["layout"]["preview"]) {
    if (config.layout.preview === preview) return;
    return onPatchConfig(patchViewConfig(config, { layout: { ...config.layout, preview } }));
  }

  return (
    <>
      <PanelHeader title="Layout" onBack={onBack} onClose={onClose} />
      <div className="flex flex-col gap-4 px-3 py-3">
        {/* Type section */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-subtext">Type</p>
          <div className="grid grid-cols-3 gap-1">
            {LAYOUT_TILES.map((tile) => {
              const isSelected = tile.value === config.layout.type;
              if (!tile.enabled) {
                return (
                  <button
                    key={tile.value}
                    type="button"
                    aria-disabled="true"
                    aria-pressed={false}
                    onClick={(e) => e.preventDefault()}
                    className="flex flex-col items-center gap-1 rounded border border-border/50 px-2 py-2 text-xs text-subtext/50 cursor-not-allowed"
                  >
                    {tile.icon}
                    {tile.label}
                  </button>
                );
              }
              return (
                <button
                  key={tile.value}
                  type="button"
                  aria-pressed={isSelected}
                  className={`flex flex-col items-center gap-1 rounded border px-2 py-2 text-xs ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-text hover:bg-surface"
                  }`}
                >
                  {tile.icon}
                  {tile.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Display section */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-subtext">Display</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text">Density</span>
            <div className="flex rounded border border-border overflow-hidden">
              {(["compact", "regular"] as ViewDensity[]).map((d) => {
                const active = config.layout.density === d;
                const label = d === "compact" ? "Compact" : "Regular";
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={active}
                    onClick={() => patchDensity(d)}
                    className={`px-3 py-1 text-xs ${
                      active ? "bg-surface-1 text-text font-medium" : "text-subtext hover:bg-surface"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Preview row */}
        <div>
          <PreviewPopover
            current={config.layout.preview}
            onSelect={patchPreview}
            trigger={
              <button
                type="button"
                aria-label={`Preview ${previewLabel(config.layout.preview)}`}
                className="flex w-full items-center justify-between rounded px-1 py-1.5 text-sm hover:bg-surface"
              >
                <span className="text-text">Preview</span>
                <span className="flex items-center gap-1 text-subtext">
                  {previewLabel(config.layout.preview)}
                  <ChevronRight size={12} aria-hidden />
                </span>
              </button>
            }
          />
        </div>
      </div>
    </>
  );
}
