import { expect, test } from "@playwright/test";

test("streams the local demo replay through the additive 3D layer", async ({
  page,
}) => {
  const externalRequests: string[] = [];
  const pageErrors: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1") externalRequests.push(request.url());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/world");
  await expect.poll(async () => page.evaluate(() => window.__DUEL_CITY_DIAGNOSTICS__?.route)).toBe("world");
  await page.keyboard.down("s");
  await page.waitForTimeout(700);
  await page.keyboard.up("s");
  await page.keyboard.down("d");
  await page.waitForTimeout(950);
  await page.keyboard.up("d");
  await expect(page.getByRole("status")).toContainText("WATCH DEMO REPLAY");
  await page.keyboard.press("e");

  await expect(page).toHaveURL(/\/world\/replay$/);
  await expect(page.getByTestId("duel-diorama")).toBeAttached();
  await expect(page.getByTestId("duel-watch-hud")).toBeVisible();
  await expect(page.getByTestId("duel-zone").first()).toBeAttached();
  await expect
    .poll(async () => page.evaluate(() => window.__DUEL_CITY_DUEL_3D__?.ready))
    .toBe(true);
  const drawCalls = await page.evaluate(
    () => Number(window.__DUEL_CITY_DUEL_3D__?.drawCalls ?? Infinity),
  );
  expect(drawCalls).toBeLessThan(150);
  await expect
    .poll(async () =>
      page
        .locator('[data-testid="duel-player-life"][data-player="op"]')
        .getAttribute("data-life"),
    )
    .toBe("6800");

  await page.getByRole("button", { name: "EXIT WATCH" }).click();
  await expect(page.getByTestId("duel-watch-hud")).toHaveCount(0);
  await expect(page.locator(".duel-mat")).toBeVisible();
  expect(externalRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});
