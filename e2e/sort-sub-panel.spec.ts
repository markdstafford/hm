import { test, expect } from "@playwright/test";

test("sort panel opens, adds sort levels, and clears sort", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /jira issues/i }).click();
  await page.getByRole("button", { name: /open view settings/i }).click();
  await page.getByRole("button", { name: /^sort$/i }).click();

  await expect(page.getByRole("heading", { name: "Sort" })).toBeVisible();
  await expect(page.getByText("Coming in #42")).not.toBeVisible();
  await expect(page.getByText("No sort applied. Rows use the default order for this collection.")).toBeVisible();

  await page.getByRole("button", { name: "+ Add sort" }).click();
  await expect(page.getByRole("button", { name: "Reorder sort level 1" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Sort property for level 1" })).toBeVisible();

  await page.getByRole("button", { name: /switch sort level 1 to descending/i }).click();
  await expect(page.getByRole("button", { name: /switch sort level 1 to ascending/i })).toContainText("↓ Desc");

  await page.getByRole("button", { name: "Clear all sort" }).click();
  await expect(page.getByText("No sort applied. Rows use the default order for this collection.")).toBeVisible();
});

test("sort controls reorder visible Jira rows when deterministic rows are available", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /jira issues/i }).click();

  const rows = page.getByRole("button", { name: /open .+:/i });
  const rowCount = await rows.count().catch(() => 0);
  if (rowCount < 2) {
    test.skip(
      true,
      "Browser e2e has no deterministic Jira issue fixture rows. Unit/page tests cover row order, preview navigation, persistence payloads, and selection preservation. Manual verification path: seed at least two Jira issues → Jira issues → Open view settings → Sort → Add Status and Updated → toggle Updated descending → verify rows and preview M of N follow the sorted order → Clear all sort returns to default order.",
    );
    return;
  }

  const extractKey = (text: string) => text.match(/([A-Z]+-\d+)/)?.[1] ?? "";

  // Capture initial row keys before touching the sort UI.
  const initialTexts = await rows.allTextContents();
  const initialKeys = initialTexts.map(extractKey).filter(Boolean);

  // Compute expected order for Key descending from the actual keys present.
  const expectedKeyDescOrder = [...initialKeys].sort((a, b) => b.localeCompare(a));

  // If initial order already matches Key desc, the test cannot verify a visual reorder.
  if (JSON.stringify(initialKeys) === JSON.stringify(expectedKeyDescOrder)) {
    test.skip(
      true,
      "Initial row order already matches Key descending; cannot verify reordering with non-deterministic fixture data.",
    );
    return;
  }

  await page.getByRole("button", { name: /open view settings/i }).click();
  await page.getByRole("button", { name: /^sort$/i }).click();
  await page.getByRole("button", { name: "+ Add sort" }).click();
  await page.getByRole("combobox", { name: "Sort property for level 1" }).click();
  await page.getByRole("option", { name: "Key" }).click();
  await page.getByRole("button", { name: /switch sort level 1 to descending/i }).click();
  await page.keyboard.press("Escape");

  // Verify rows are now in the expected Key descending order.
  const afterTexts = await rows.allTextContents();
  const afterKeys = afterTexts.map(extractKey).filter(Boolean);
  expect(afterKeys).toEqual(expectedKeyDescOrder);
});
