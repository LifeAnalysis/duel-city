import path from "node:path";

import { expect, test } from "@playwright/test";

import { uploadReplay } from "./helpers/replay";

test("scales the app root to fit a small viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 620 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect
    .poll(() =>
      page.evaluate(() =>
        Number(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--neos-adaptive-scale",
          ),
        ),
      ),
    )
    .toBe(1);

  await page.setViewportSize({ width: 800, height: 500 });

  await expect
    .poll(() =>
      page.evaluate(() =>
        Number(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--neos-adaptive-scale",
          ),
        ),
      ),
    )
    .toBe(0.8);

  const rootRect = await page.locator("#root").evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  });

  expect(rootRect).toEqual({ width: 800, height: 500 });
});

test("keeps the app centered during intermediate scale updates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const style = document.documentElement.style;

    style.setProperty("--neos-adaptive-scale", "0.75");
    style.setProperty("--neos-adaptive-width", "100vw");
    style.setProperty("--neos-adaptive-height", "100vh");
  });

  const centerOffset = await page.locator("#root").evaluate((node) => {
    const rect = node.getBoundingClientRect();

    return {
      x: Math.round(rect.left + rect.width / 2 - window.innerWidth / 2),
      y: Math.round(rect.top + rect.height / 2 - window.innerHeight / 2),
    };
  });

  expect(centerOffset).toEqual({ x: 0, y: 0 });
});

test("keeps both players' opening hands visible in a compact duel viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await uploadReplay(
    page,
    path.resolve("tests/e2e/fixtures/replays/1/replay.yrp3d"),
  );

  await expect
    .poll(() =>
      page.evaluate(() => {
        const plane = document.querySelector<HTMLElement>(
          'section[class*="mat"] > div > div',
        );
        const planeRect = plane?.getBoundingClientRect();
        const handCards = [
          ...document.querySelectorAll<HTMLElement>(
            '[data-testid="duel-card"][data-card-zone="HAND"]',
          ),
        ];
        const viewportHeight = window.innerHeight;
        const visibleCards = handCards.filter((node) => {
          const rect = node.getBoundingClientRect();

          return rect.top >= 0 && rect.bottom <= viewportHeight;
        });

        const planeCenterOffset = planeRect
          ? {
              x: planeRect.left + planeRect.width / 2 - window.innerWidth / 2,
              y: planeRect.top + planeRect.height / 2 - window.innerHeight / 2,
            }
          : undefined;

        return {
          allVisible: visibleCards.length === handCards.length,
          planeCentered:
            planeCenterOffset !== undefined &&
            Math.abs(planeCenterOffset.x) <= 1 &&
            Math.abs(planeCenterOffset.y) <= 1,
          controllers: [
            ...new Set(
              visibleCards.map((node) =>
                node.getAttribute("data-card-controller"),
              ),
            ),
          ].sort(),
        };
      }),
    )
    .toEqual({
      allVisible: true,
      planeCentered: true,
      controllers: ["0", "1"],
    });
  await expect(
    page.locator('[data-testid="duel-player-life-value"][data-player="me"]'),
  ).toHaveText("8000");
  await expect(
    page.locator('[data-testid="duel-player-life-value"][data-player="op"]'),
  ).toHaveText("8000");
});
