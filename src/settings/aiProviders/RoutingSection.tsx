import { useState } from "react";
import { EMPTY_STATES } from "../../aiProviders/defaults";
import type { AiProviderConfig } from "../../aiProviders/types";

interface Props {
  config: AiProviderConfig;
  onChange: (next: AiProviderConfig) => void;
}

const TASK_PATTERN = /^[a-z0-9_-]+(\.[a-z0-9_-]+)+$/;

export function RoutingSection({ config, onChange }: Props) {
  const [taskName, setTaskName] = useState("");
  const [profileRef, setProfileRef] = useState("");
  const [error, setError] = useState<string | null>(null);

  const entries = Object.entries(config.routing);

  const handleAdd = () => {
    setError(null);
    if (!taskName.trim()) {
      setError("Task name is required");
      return;
    }
    if (!TASK_PATTERN.test(taskName)) {
      setError("Invalid task name (use dotted lowercase, e.g. issue.triage)");
      return;
    }
    if (Object.prototype.hasOwnProperty.call(config.routing, taskName)) {
      setError(`Task "${taskName}" already exists`);
      return;
    }
    if (!profileRef) {
      setError("Profile is required");
      return;
    }
    onChange({
      ...config,
      routing: { ...config.routing, [taskName]: profileRef },
    });
    setTaskName("");
    setProfileRef("");
  };

  const handleDelete = (task: string) => {
    setError(null);
    const next = { ...config.routing };
    delete next[task];
    onChange({ ...config, routing: next });
  };

  return (
    <section aria-labelledby="routing-heading" className="mt-6">
      <h3 id="routing-heading" className="text-sm font-semibold text-text mb-2">
        Routing
      </h3>
      {entries.length === 0 ? (
        <p className="text-sm text-subtext mb-3">{EMPTY_STATES.routing}</p>
      ) : (
        <ul className="mb-3 divide-y divide-border rounded border border-border">
          {entries.map(([task, prof]) => (
            <li key={task} className="p-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-text">{task}</p>
                <p className="text-xs text-subtext">→ {prof}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(task)}
                className="text-xs text-subtext hover:text-text"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded border border-border p-3">
        <h4 className="text-xs font-semibold text-subtext uppercase tracking-wider mb-2">
          Add route
        </h4>
        <div className="grid gap-2">
          <label className="text-xs text-subtext flex flex-col gap-1">
            Task name
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g. issue.triage"
              className="px-2 py-1 text-sm rounded border border-border bg-surface text-text"
            />
          </label>
          <label className="text-xs text-subtext flex flex-col gap-1">
            Profile
            <select
              value={profileRef}
              onChange={(e) => setProfileRef(e.target.value)}
              className="px-2 py-1 text-sm rounded border border-border bg-surface text-text"
            >
              <option value="">Select profile…</option>
              {config.profiles.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleAdd}
            className="self-start text-xs px-3 py-1 rounded border border-border bg-surface hover:bg-surface-1 text-text"
          >
            Add route
          </button>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </section>
  );
}
