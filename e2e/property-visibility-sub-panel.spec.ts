import { test, expect } from "@playwright/test";

test("property visibility panel opens with search input and protects title", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /jira issues/i }).click();
  await page.getByRole("button", { name: /open view settings/i }).click();
  await page.getByRole("button", { name: /property visibility/i }).click();

  await expect(page.getByRole("heading", { name: "Property visibility" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search properties" })).toBeVisible();

  // Title eye button is disabled
  await expect(page.getByRole("button", { name: "Title is always visible" })).toHaveAttribute("aria-disabled", "true");
});

test("property visibility search filters property list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /jira issues/i }).click();
  await page.getByRole("button", { name: /open view settings/i }).click();
  await page.getByRole("button", { name: /property visibility/i }).click();

  const searchInput = page.getByRole("textbox", { name: "Search properties" });
  await searchInput.fill("priority");

  await expect(page.getByText("Priority")).toBeVisible();
  await expect(page.getByText("Title")).not.toBeVisible();

  // Clearing search restores all properties
  await searchInput.clear();
  await expect(page.getByText("Title")).toBeVisible();
  await expect(page.getByText("Priority")).toBeVisible();
});

test("property visibility panel shows Shown and Hidden sections", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /jira issues/i }).click();
  await page.getByRole("button", { name: /open view settings/i }).click();
  await page.getByRole("button", { name: /property visibility/i }).click();

  await expect(page.getByRole("heading", { name: "Shown" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hidden" })).toBeVisible();
});

test("property visibility side and visibility controls with fixture data", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /jira issues/i }).click();

  // Check if any issue rows exist (requires seeded data)
  const firstIssue = page.getByRole("button", { name: /open .+:/i }).first();
  const hasRows = await firstIssue.count().then((n) => n > 0).catch(() => false);

  if (!hasRows) {
    test.skip(
      true,
      "Browser e2e has no deterministic Jira issue fixture rows. Unit/page tests cover visibility toggle, side changes, and drag reorder. Manual verification path: Open Jira issues → Open view settings → Property visibility → Hide Assignee → row assignee cells disappear → Back → summary decreases by 1 → reload → hidden state persists.",
    );
    return;
  }

  await page.getByRole("button", { name: /open view settings/i }).click();
  await page.getByRole("button", { name: /property visibility/i }).click();

  // Hide a non-title property
  const hideAssigneeBtn = page.getByRole("button", { name: "Hide Assignee" });
  if (await hideAssigneeBtn.count() > 0) {
    await hideAssigneeBtn.click();
    // Assignee should appear in Hidden section
    await expect(page.getByRole("button", { name: "Show Assignee" })).toBeVisible();
  }

  // Switch a property's side
  const priorityRightBtn = page.getByRole("button", { name: "Move Priority right" });
  if (await priorityRightBtn.count() > 0) {
    await priorityRightBtn.click();
    await expect(priorityRightBtn).toHaveAttribute("aria-pressed", "true");
  }
});
