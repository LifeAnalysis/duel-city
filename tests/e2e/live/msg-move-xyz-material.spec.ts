import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  activateHandCard,
  clickCardAction,
  duelCard,
  expectOverlayMaterialCount,
  expectPlayerLifeBelow,
  expectSelectCardsModal,
  installOnlyLiveDeck,
  LIVE_E2E_ENABLED,
  normalSummonToMainMonsterZone,
  readYdkDeck,
  resolveSummonToAnyMainMonsterZone,
  selectCardsFromModal,
  specialSummonExtraDeckCardToMainMonsterZone,
  specialSummonHandCardToMainMonsterZone,
  startAiDuel,
  surrenderAndClosePage,
} from "../helpers/live";

const DECK = path.resolve(
  "tests/e2e/fixtures/live/decks/msg-move-xyz-material.ydk",
);
const DECK_NAME = "E2E MSG Move Xyz Material";
const PHOTON_THRASHER = 65367484;
const DOUBLE_SUMMON = 43422537;
const MYSTICAL_ELF = 15025844;
const GAGAGA_COWBOY = 12014404;

test.describe("live MSG_MOVE xyz material regression", () => {
  test.skip(
    !LIVE_E2E_ENABLED,
    "Set PLAYWRIGHT_LIVE=1 to run tests against the real ygopro server.",
  );

  test("moves detached xyz material from overlay to grave", async ({
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

    await specialSummonExtraDeckCardToMainMonsterZone(page, GAGAGA_COWBOY);
    await expectSelectCardsModal(page, {
      cardCodes: [PHOTON_THRASHER, MYSTICAL_ELF],
      min: 2,
      max: 2,
      cancelable: true,
    });
    await selectCardsFromModal(page, [PHOTON_THRASHER, MYSTICAL_ELF]);
    const xyzSequence = await resolveSummonToAnyMainMonsterZone(page, {
      cardCode: GAGAGA_COWBOY,
      controller,
      position: "FACEUP_DEFENSE",
    });

    const xyzMonster = duelCard(page, {
      code: GAGAGA_COWBOY,
      zone: "MZONE",
      controller,
      sequence: xyzSequence,
    });
    await expect(xyzMonster).toBeVisible({ timeout: 60000 });
    await expectOverlayMaterialCount(page, {
      controller,
      sequence: xyzSequence,
      count: 2,
    });

    await clickCardAction(page, xyzMonster, "activate");
    await expectSelectCardsModal(page, {
      cardCodes: [PHOTON_THRASHER, MYSTICAL_ELF],
      min: 1,
      max: 1,
      cancelable: false,
    });
    await selectCardsFromModal(page, [PHOTON_THRASHER]);

    await expectOverlayMaterialCount(page, {
      controller,
      sequence: xyzSequence,
      count: 1,
    });
    await expect(
      duelCard(page, {
        code: PHOTON_THRASHER,
        zone: "GRAVE",
        controller,
      }),
    ).toBeVisible({ timeout: 60000 });
    await expectPlayerLifeBelow(page, "op", 8000);

    await surrenderAndClosePage(page);
  });
});
