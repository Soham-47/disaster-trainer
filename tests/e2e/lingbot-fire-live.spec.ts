import { expect, test } from "@playwright/test";

test.skip(process.env.RUN_LIVE_LINGBOT !== "1", "Set RUN_LIVE_LINGBOT=1 for paid live validation");

test("renders the live apartment-fire flow without prepared media", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Connecting to LingBot World 2")).toBeVisible();
  await expect(page.locator("video[src*='fallback'], img[src*='fallback']")).toHaveCount(0);
});
