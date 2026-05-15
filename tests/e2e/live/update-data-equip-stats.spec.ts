import path from "node:path";

import { expect, type Page, test } from "@playwright/test";

import {
  chooseSelectableZoneIfAvailable,
  clickCardAction,
  duelCard,
  expectCardStats,
  getControllerOfHandCard,
  installOnlyLiveDeck,
  LIVE_E2E_ENABLED,
  normalSummonToMainMonsterZone,
  readYdkDeck,
  selectCardsIfRequested,
  startAiDuel,
  surrenderAndClosePage,
} from "../helpers/live";

const DECK = path.resolve(
  "tests/e2e/fixtures/live/decks/update-data-equip-stats.ydk",
);
const DECK_NAME = "E2E Update Data Equip Stats";
const MYSTICAL_ELF = 15025844;
const UNITED_WE_STAND = 56747793;
const GIANT_SOLDIER_OF_STONE = 13039848;
const AWAKENING = 98374133;

test.describe("live update_data equip stat regression", () => {
  test.skip(
    !LIVE_E2E_ENABLED,
    "Set PLAYWRIGHT_LIVE=1 to run tests against the real ygopro server.",
  );

  test("refreshes attack and defense after an equip stat increase", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(Number(process.env.LIVE_E2E_TIMEOUT ?? 240000));

    await installOnlyLiveDeck(page, await readYdkDeck(DECK, DECK_NAME));
    await startAiDuel(page, { mora: "paper", tp: "first" });

    const controller = await getControllerOfHandCard(page, MYSTICAL_ELF);
    await normalSummonToMainMonsterZone(page, {
      cardCode: MYSTICAL_ELF,
      sequence: 2,
    });

    await activateEquipAndSelectTarget(page, {
      controller,
      equipCode: UNITED_WE_STAND,
      spellTrapSequence: 2,
      targetCode: MYSTICAL_ELF,
    });

    const target = duelCard(page, {
      code: MYSTICAL_ELF,
      controller,
      zone: "MZONE",
      sequence: 2,
    }).first();
    await expectCardStats(page, target, { attack: 1600, defense: 2800 });

    await surrenderAndClosePage(page);
  });

  test("refreshes defense after an equip stat decrease", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(Number(process.env.LIVE_E2E_TIMEOUT ?? 240000));

    await installOnlyLiveDeck(page, await readYdkDeck(DECK, DECK_NAME));
    await startAiDuel(page, { mora: "paper", tp: "first" });

    const controller = await getControllerOfHandCard(
      page,
      GIANT_SOLDIER_OF_STONE,
    );
    await normalSummonToMainMonsterZone(page, {
      cardCode: GIANT_SOLDIER_OF_STONE,
      sequence: 2,
    });

    await activateEquipAndSelectTarget(page, {
      controller,
      equipCode: AWAKENING,
      spellTrapSequence: 2,
      targetCode: GIANT_SOLDIER_OF_STONE,
    });

    const target = duelCard(page, {
      code: GIANT_SOLDIER_OF_STONE,
      controller,
      zone: "MZONE",
      sequence: 2,
    }).first();
    await expectCardStats(page, target, { attack: 1700, defense: 1800 });

    await surrenderAndClosePage(page);
  });
});

async function activateEquipAndSelectTarget(
  page: Page,
  options: {
    controller: string | number;
    equipCode: number;
    spellTrapSequence: number;
    targetCode: number;
  },
) {
  let selectedTarget = false;
  const equip = duelCard(page, {
    code: options.equipCode,
    zone: "HAND",
    idleAction: "ACTIVATE",
  }).first();

  await clickCardAction(page, equip, "activate");

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    await chooseSelectableZoneIfAvailable(page, {
      zone: "SZONE",
      controller: options.controller,
      sequence: options.spellTrapSequence,
      timeout: 250,
    });
    selectedTarget =
      selectedTarget ||
      (await selectCardsIfRequested(page, [options.targetCode], 250));

    if (
      selectedTarget &&
      (await duelCard(page, {
        code: options.equipCode,
        controller: options.controller,
        zone: "SZONE",
      })
        .first()
        .isVisible())
    ) {
      return;
    }

    await page.waitForTimeout(250);
  }

  await expect(
    duelCard(page, {
      code: options.equipCode,
      controller: options.controller,
      zone: "SZONE",
    }).first(),
  ).toBeVisible({ timeout: 1 });
}
