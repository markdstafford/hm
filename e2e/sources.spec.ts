import { test, expect } from "@playwright/test";

test("Sources settings add Jira unavailable smoke path", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /open settings/i }).click();
  await page.getByRole("button", { name: /^sources$/i }).click();
  await expect(page.getByRole("heading", { name: /^sources$/i })).toBeVisible();
  await page.getByRole("button", { name: /add source/i }).click();
  await page.getByRole("button", { name: /jira data center/i }).click();
  await page.getByLabel(/server url/i).fill("http://localhost:2990/jira");
  await page.getByLabel(/personal access token/i).fill("test-pat-not-secret");
  await page.getByRole("button", { name: /test connection/i }).click();
  await expect(page.getByText(/issue #9/i)).toBeVisible();

  // Save is enabled because server URL and PAT are valid (issue #9 unavailable
  // state still permits saving metadata without project discovery).
  await page.getByRole("button", { name: /^save$/i }).click();

  // After save the form closes and the source appears in the configured list.
  await expect(page.getByText(/Kind: Jira/i)).toBeVisible();
  await expect(page.getByText(/localhost/i)).toBeVisible();

  // Note: close/reopen persistence is not verified here. In a browser-only
  // E2E environment Tauri IPC is absent, so saveSourcesConfig() and
  // loadSourcesConfig() use in-memory stubs. Re-opening Settings would
  // reload from the stub and return an empty config, making persistence
  // assertions unreliable until E2E tests run against a real Tauri build.
});
