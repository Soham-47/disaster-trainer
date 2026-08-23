import { expect, test } from "@playwright/test";

test.describe("LingBot apartment-fire trainer", () => {
  test("keeps controls behind the live boot gate and then starts the mock world", async ({ page }) => {
    await page.goto("/?mockWorld=1");
    await expect(page.getByRole("heading", { name: "Begin scenario" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Begin scenario" })).toBeVisible();
    await expect(page.getByTestId("lingbot-live-video")).toHaveCount(0);
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Begin scenario" }).click();
    await expect(page.getByText("Orient before moving")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("video[src*='fallback'], img[src*='fallback']")).toHaveCount(0);
  });

  test("never exposes raw prompts or prepared labels", async ({ page }) => {
    await page.goto("/?mockWorld=1");
    await expect(page.getByText(/fallback|prepared continuation/i)).toHaveCount(0);
    await expect(page.getByText(/First-person view from inside/i)).toHaveCount(0);
  });

  test("keeps the start control usable on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?mockWorld=1");
    const button = page.getByRole("button", { name: "Begin scenario" });
    await expect(button).toBeVisible();
    const bounds = await button.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  });
});
