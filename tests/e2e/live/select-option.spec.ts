import path from "node:path";

import { expect, type Page, test } from "@playwright/test";

import {
  chooseDuelPhase,
  duelCard,
  installOnlyLiveDeck,
  LIVE_E2E_ENABLED,
  normalSummonToMainMonsterZone,
  readYdkDeck,
  startAiDuel,
  surrenderAndClosePage,
} from "../helpers/live";

const DECK = path.resolve(
  "tests/e2e/fixtures/live/decks/select-option-koaki-maintenance.ydk",
);
const DECK_NAME = "E2E Select Option Koa'ki Maintenance";
const KOAKI_MEIRU_URNIGHT = 30936186;

async function chooseOptionByResponse(page: Page, response: number) {
  const modal = page.locator('[data-testid="duel-option-modal"]:visible');
  await expect(modal).toBeVisible({ timeout: 60000 });
  await expect(
    page.locator('[data-testid="duel-option-item"]:visible'),
  ).toHaveCount(2);

  await page
    .locator(
      `[data-testid="duel-option-item"][data-option-response="${response}"]:visible`,
    )
    .click();
  await page.locator('[data-testid="duel-option-submit"]:visible').click();
}

test.describe("live select_option interaction", () => {
  test.skip(
    !LIVE_E2E_ENABLED,
    "Set PLAYWRIGHT_LIVE=1 to run tests against the real ygopro server.",
  );

  test("chooses a maintenance cost option", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(Number(process.env.LIVE_E2E_TIMEOUT ?? 180000));

    await installOnlyLiveDeck(page, await readYdkDeck(DECK, DECK_NAME));
    await startAiDuel(page, {
      mora: "paper",
      tp: "first",
    });

    await normalSummonToMainMonsterZone(page, {
      cardCode: KOAKI_MEIRU_URNIGHT,
      sequence: 2,
    });

    await chooseDuelPhase(page, "end");
    await chooseOptionByResponse(page, 1);
    await expect(
      duelCard(page, {
        code: KOAKI_MEIRU_URNIGHT,
        zone: "GRAVE",
      }).first(),
    ).toBeVisible({ timeout: 60000 });

    await surrenderAndClosePage(page);
  });
});
