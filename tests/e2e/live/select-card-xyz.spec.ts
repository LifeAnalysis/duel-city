import path from "node:path";

import { expect, type Page, test } from "@playwright/test";

import {
  activateHandCard,
  duelCard,
  expectOverlayMaterialCount,
  expectSelectCardsModal,
  installOnlyLiveDeck,
  LIVE_E2E_ENABLED,
  normalSummonToMainMonsterZone,
  readYdkDeck,
  resolveSummonToAnyMainMonsterZone,
  specialSummonExtraDeckCardToMainMonsterZone,
  specialSummonHandCardToMainMonsterZone,
  startAiDuel,
  surrenderAndClosePage,
} from "../helpers/live";

const DECK = path.resolve("tests/e2e/fixtures/live/decks/select-card-xyz.ydk");
const DECK_NAME = "E2E Select Card Xyz";
const PHOTON_THRASHER = 65367484;
const DOUBLE_SUMMON = 43422537;
const MYSTICAL_ELF = 15025844;
const UTOPIA = 84013237;

async function selectXyzMaterials(page: Page, controller: string | number) {
  const modal = page
    .locator(
      '[data-testid="duel-select-cards-modal"]:visible:not([data-select-max="0"])',
    )
    .last();

  await expect(modal).toBeVisible({ timeout: 60000 });

  for (const selector of [
    `[data-testid="duel-select-card-option"][data-card-code="${PHOTON_THRASHER}"][data-card-controller="${controller}"][data-card-zone="MZONE"][data-card-sequence="0"]`,
    `[data-testid="duel-select-card-option"][data-card-code="${MYSTICAL_ELF}"][data-card-controller="${controller}"][data-card-zone="MZONE"][data-card-sequence="1"]`,
  ]) {
    const option = modal.locator(selector).first();
    await expect(option).toBeVisible({ timeout: 30000 });

    const input = option
      .locator('input[type="checkbox"], input[type="radio"]')
      .first();

    if ((await input.count()) > 0) {
      await input.check({ force: true });
    } else {
      await option.click({ force: true });
    }
  }

  const submit = page
    .locator('[data-testid="duel-select-card-submit"]:visible:enabled')
    .last();
  await expect(submit).toBeEnabled({ timeout: 30000 });
  await submit.click();
}

test.describe("live select_card xyz summon interaction", () => {
  test.skip(
    !LIVE_E2E_ENABLED,
    "Set PLAYWRIGHT_LIVE=1 to run tests against the real ygopro server.",
  );

  test("selects xyz materials and summons an xyz monster", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(Number(process.env.LIVE_E2E_TIMEOUT ?? 180000));

    await installOnlyLiveDeck(page, await readYdkDeck(DECK, DECK_NAME));
    await startAiDuel(page);

    const controller = await specialSummonHandCardToMainMonsterZone(page, {
      cardCode: PHOTON_THRASHER,
      sequence: 0,
    });
    await normalSummonToMainMonsterZone(page, {
      cardCode: MYSTICAL_ELF,
      sequence: 1,
    });
    await activateHandCard(page, DOUBLE_SUMMON);
    await normalSummonToMainMonsterZone(page, {
      cardCode: MYSTICAL_ELF,
      sequence: 3,
    });

    await specialSummonExtraDeckCardToMainMonsterZone(page, UTOPIA);
    await expectSelectCardsModal(page, {
      cardCodes: [PHOTON_THRASHER, MYSTICAL_ELF],
      min: 2,
      max: 2,
      cancelable: true,
    });
    await selectXyzMaterials(page, controller);
    const xyzSequence = await resolveSummonToAnyMainMonsterZone(page, {
      cardCode: UTOPIA,
      controller,
      position: "FACEUP_ATTACK",
    });

    await expect(
      duelCard(page, {
        code: UTOPIA,
        zone: "MZONE",
        controller,
        sequence: xyzSequence,
      }),
    ).toBeVisible({ timeout: 60000 });
    await expectOverlayMaterialCount(page, {
      controller,
      sequence: xyzSequence,
      count: 2,
    });

    await surrenderAndClosePage(page);
  });
});
