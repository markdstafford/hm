export function SourcesSettings() {
  return (
    <section aria-labelledby="sources-heading" className="space-y-6">
      <div>
        <h1 id="sources-heading" className="text-2xl font-semibold text-text">Sources</h1>
        <p className="text-sm text-subtext mt-1">
          Configure the systems hm reads from. Secrets are stored in the OS keychain.
        </p>
      </div>
      <button
        type="button"
        className="rounded bg-blue px-3 py-1.5 text-sm font-medium text-crust"
      >
        Add source
      </button>
      <p className="text-sm text-subtext">Add your first source to tell hm where to read work data.</p>
    </section>
  );
}
