import { PanelHeader } from "../PanelHeader";

type Props = {
  onBack: () => void;
  onClose: () => void;
};

export function SortPanel({ onBack, onClose }: Props) {
  return (
    <>
      <PanelHeader title="Sort" onBack={onBack} onClose={onClose} />
      <div className="px-3 py-4 text-sm text-subtext">Coming in #42</div>
    </>
  );
}
