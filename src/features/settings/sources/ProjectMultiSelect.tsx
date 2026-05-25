import { useState } from "react";
import type { JiraConnectionProject, JiraProjectFilter } from "../../../sources/types";

interface ProjectMultiSelectProps {
  availableProjects: JiraConnectionProject[];
  selectedProjects: JiraProjectFilter[];
  disabled: boolean;
  onChange: (selected: JiraProjectFilter[]) => void;
}

export function ProjectMultiSelect({
  availableProjects,
  selectedProjects,
  disabled,
  onChange,
}: ProjectMultiSelectProps) {
  const [filter, setFilter] = useState("");
  const selectedKeys = new Set(selectedProjects.map((p) => p.key));
  const needle = filter.trim().toLowerCase();
  const visible =
    needle.length === 0
      ? availableProjects
      : availableProjects.filter(
          (p) =>
            p.key.toLowerCase().includes(needle) ||
            (p.name ?? "").toLowerCase().includes(needle),
        );

  function handleToggle(project: JiraConnectionProject) {
    const newSelected = selectedKeys.has(project.key)
      ? selectedProjects.filter((p) => p.key !== project.key)
      : [
          ...selectedProjects,
          { key: project.key, name: project.name ?? null, id: project.id ?? null },
        ].sort((a, b) => a.key.localeCompare(b.key));
    onChange(newSelected);
  }

  if (availableProjects.length === 0 && !disabled) {
    return <p className="text-sm text-subtext">No projects found in Jira.</p>;
  }

  return (
    <fieldset disabled={disabled} aria-label="Projects" className="space-y-1">
      <legend className="text-sm font-medium text-text mb-1">
        Projects {disabled && <span className="text-subtext font-normal">(test connection first)</span>}
      </legend>
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={`Filter ${availableProjects.length} projects…`}
        aria-label="Filter projects"
        className="w-full rounded border border-surface bg-background text-text text-sm px-2 py-1 mb-2"
      />
      {visible.length === 0 && (
        <p className="text-xs text-subtext">No projects match {`"${filter}"`}.</p>
      )}
      {visible.map((project) => (
        <label key={project.key} className="flex items-center gap-2 text-sm text-text cursor-pointer">
          <input
            type="checkbox"
            checked={selectedKeys.has(project.key)}
            onChange={() => handleToggle(project)}
            aria-label={project.name ? `${project.key} — ${project.name}` : project.key}
            className="rounded"
          />
          <span>{project.key}{project.name ? ` — ${project.name}` : ""}</span>
        </label>
      ))}
    </fieldset>
  );
}
