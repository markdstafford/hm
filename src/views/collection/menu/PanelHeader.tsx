import { ArrowLeft, X } from "lucide-react";
import { IconButton } from "../../../ui/buttons/IconButton";

export type PanelHeaderProps = {
  title: string;
  onBack?: () => void;
  onClose: () => void;
};

export function PanelHeader({ title, onBack, onClose }: PanelHeaderProps) {
  return (
    <div className="flex h-8 items-center gap-2 border-b border-border/60 px-2">
      {onBack && (
        <IconButton label="Back to view settings" onClick={onBack}>
          <ArrowLeft size={14} />
        </IconButton>
      )}
      <h2 className="min-w-0 flex-1 text-sm font-medium text-text">{title}</h2>
      <IconButton label="Close view settings" onClick={onClose}>
        <X size={14} />
      </IconButton>
    </div>
  );
}
