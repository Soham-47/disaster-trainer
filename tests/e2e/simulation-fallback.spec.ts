import { expect, test, type Page } from "@playwright/test";

async function forcePreparedContinuation(page: Page) {
  await page.route("**/api/reactor-token", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "No live capacity in browser test" }) }));
}

test.describe("interactive simulation fallback flow", () => {
  test("starts a reviewed episode and exposes contextual actions", async ({ page }) => {
    await forcePreparedContinuation(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /See the choice/ })).toBeVisible();
    await page.getByLabel("Describe the disaster situation").fill("Night earthquake in a high-rise");
    await page.getByRole("button", { name: /Start featured scenario/ }).click();

    await expect(page.getByText("Prepared Continuation").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Immediate priority")).toBeVisible();
    await expect(page.getByRole("button", { name: /Inspect the alarm/ })).toHaveCount(1);
    await expect(page.getByTestId("disaster-effects")).toHaveAttribute("data-disaster-type", "earthquake");
    await expect(page.getByPlaceholder("Try: inspect the door")).toBeHidden();
    await page.getByRole("button", { name: "Type an action" }).click();
    await expect(page.getByPlaceholder("Try: inspect the door")).toBeVisible();
  });

  test("keeps the compact action dock visible on a phone-sized viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await forcePreparedContinuation(page);
    await page.goto("/");
    await page.getByLabel("Describe the disaster situation").fill("Night earthquake in a high-rise");
    await page.getByRole("button", { name: /Start featured scenario/ }).click();

    const dock = page.getByTestId("action-dock");
    await expect(dock).toBeVisible({ timeout: 20_000 });
    const bounds = await dock.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  });

  test("disables disaster motion effects when reduced motion is requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await forcePreparedContinuation(page);
    await page.goto("/");
    await page.getByLabel("Describe the disaster situation").fill("Night earthquake in a high-rise");
    await page.getByRole("button", { name: /Start featured scenario/ }).click();

    await expect(page.getByTestId("disaster-effects")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-world-media="true"]').first()).toHaveCSS("animation-name", "none");
  });

  test("supports a constrained command and reaches the pivotal checkpoint", async ({ page }) => {
    await forcePreparedContinuation(page);
    await page.goto("/");
    await page.getByLabel("Describe the disaster situation").fill("Apartment fire at night");
    await page.getByRole("button", { name: /Start featured scenario/ }).click();

    await expect(page.getByRole("button", { name: /Inspect the alarm/ }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Type an action" }).click();
    await page.getByPlaceholder("Try: inspect the door").fill("listen to alarm");
    await page.getByRole("button", { name: "Act", exact: true }).click();
    await expect(page.getByRole("button", { name: /Inspect the smoke/ }).first()).toBeVisible();
    await page.getByRole("button", { name: /Inspect the smoke/ }).first().click();
    await page.getByRole("button", { name: /Inspect the exit/ }).first().click();
    await expect(page.getByText("Choose the safest available response.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Keep it closed/ }).first()).toBeVisible();
  });

  test("rewinds an unsafe path and reveals the counterfactual debrief", async ({ page }) => {
    await forcePreparedContinuation(page);
    await page.goto("/");
    await page.getByLabel("Describe the disaster situation").fill("Apartment fire at night");
    await page.getByRole("button", { name: /Start featured scenario/ }).click();

    await expect(page.getByRole("button", { name: /Inspect the alarm/ }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /Inspect the alarm/ }).first().click();
    await page.getByRole("button", { name: /Inspect the smoke/ }).first().click();
    await page.getByRole("button", { name: /Inspect the exit/ }).first().click();
    await expect(page.getByRole("button", { name: /Open the door/ }).first()).toBeVisible();

    await page.getByRole("button", { name: /Open the door/ }).first().click();
    await expect(page.getByRole("button", { name: /Move to a safer position/ }).first()).toBeVisible();
    await page.getByRole("button", { name: /Move to a safer position/ }).first().click();
    await page.getByRole("button", { name: /Communicate for help/ }).first().click();
    await page.getByRole("button", { name: /Open the debrief/ }).first().click();

    await expect(page.getByRole("button", { name: /Rewind and experience the alternative/ })).toBeVisible();
    await page.getByRole("button", { name: /Rewind and experience the alternative/ }).click();
    await expect(page.getByRole("button", { name: /Continue$/ }).first()).toBeVisible();
    await page.getByRole("button", { name: /Continue$/ }).first().click();
    await page.getByRole("button", { name: /Open the debrief/ }).first().click();
    await expect(page.getByRole("button", { name: /Try the transfer scenario/ })).toBeVisible();
  });
});
