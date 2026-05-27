import { PanelHeader } from "../PanelHeader";

type Props = {
  onBack: () => void;
  onClose: () => void;
};

export function LayoutPanel({ onBack, onClose }: Props) {
  return (
    <>
      <PanelHeader title="Layout" onBack={onBack} onClose={onClose} />
      <div className="px-3 py-4 text-sm text-subtext">Coming in #40</div>
    </>
  );
}
