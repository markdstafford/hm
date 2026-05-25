import { Card } from "../../../ui/layout/Card";

interface AddSourceFlowProps {
  onSelectJira: () => void;
  onCancel: () => void;
}

export function AddSourceFlow({ onSelectJira, onCancel }: AddSourceFlowProps) {
  return (
    <section aria-labelledby="add-source-heading" className="space-y-4">
      <h2 id="add-source-heading" className="text-lg font-semibold text-text">Add source</h2>
      <p className="text-sm text-subtext">Choose a source type.</p>
      <div className="space-y-2">
        <Card interactive aria-label="Jira Data Center" onClick={onSelectJira}>
          <div className="font-medium text-sm text-text">Jira Data Center</div>
          <div className="text-xs text-subtext mt-0.5">Connect to a self-hosted Jira server.</div>
        </Card>
        <Card className="opacity-50 cursor-not-allowed">
          <div className="font-medium text-sm text-text">GitHub</div>
          <div className="text-xs text-subtext mt-0.5">coming later</div>
        </Card>
        <Card className="opacity-50 cursor-not-allowed">
          <div className="font-medium text-sm text-text">Documents</div>
          <div className="text-xs text-subtext mt-0.5">coming later</div>
        </Card>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-sm text-subtext hover:text-text"
      >
        Cancel
      </button>
    </section>
  );
}
