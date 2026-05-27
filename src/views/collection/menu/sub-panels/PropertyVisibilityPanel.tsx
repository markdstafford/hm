import { PanelHeader } from "../PanelHeader";

type Props = {
  onBack: () => void;
  onClose: () => void;
};

export function PropertyVisibilityPanel({ onBack, onClose }: Props) {
  return (
    <>
      <PanelHeader title="Property visibility" onBack={onBack} onClose={onClose} />
      <div className="px-3 py-4 text-sm text-subtext">Coming in #41</div>
    </>
  );
}
