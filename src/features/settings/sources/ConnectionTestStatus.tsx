import type { JiraConnectionTestResult } from "../../../sources/types";

interface ConnectionTestStatusProps {
  result: JiraConnectionTestResult | null;
  isTesting: boolean;
}

export function ConnectionTestStatus({ result, isTesting }: ConnectionTestStatusProps) {
  if (isTesting) {
    return <p className="text-sm text-subtext" role="status">Testing...</p>;
  }

  if (!result) {
    return <p className="text-sm text-subtext">Not tested</p>;
  }

  if (result.status === "Success") {
    return (
      <p className="text-sm text-green" role="status">
        Connected to Jira. Select projects to ingest.
      </p>
    );
  }

  if (result.status === "Unavailable") {
    return (
      <p className="text-sm text-subtext" role="status">
        {result.message}
      </p>
    );
  }

  // Error
  return (
    <div role="status">
      <p className="text-sm text-red">{result.message}</p>
      {result.suggested_fix && (
        <p className="text-sm text-subtext mt-1">{result.suggested_fix}</p>
      )}
    </div>
  );
}
