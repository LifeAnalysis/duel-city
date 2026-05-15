import path from "node:path";

import { expect, type Page, test } from "@playwright/test";

import {
  chooseSelectableZoneIfAvailable,
  clickCardAction,
  duelCard,
  expectControllerHandCount,
  expectMyTurn,
  expectPlayerLifeBelow,
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
  "tests/e2e/fixtures/live/decks/update-data-shuffle-hand.ydk",
);
const DECK_NAME = "E2E Update Data Shuffle Hand";
const KOAKI_RING = 46089249;
const IRON_CORE = 36623431;
const MYSTICAL_ELF = 15025844;
const SHUFFLE_ASSERT_TIMEOUT = 10000;

test.describe("live update_data shuffle hand regression", () => {
  test.skip(
    !LIVE_E2E_ENABLED,
    "Set PLAYWRIGHT_LIVE=1 to run tests against the real ygopro server.",
  );

  test("keeps hand DOM consistent after a revealed cost card is shuffled", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(Number(process.env.LIVE_E2E_TIMEOUT ?? 240000));

    await installOnlyLiveDeck(page, await readYdkDeck(DECK, DECK_NAME));
    await startAiDuel(page, { mora: "paper", tp: "first" });
    await expectMyTurn(page);

    const controller = await getControllerOfHandCard(page, KOAKI_RING);
    await normalSummonToMainMonsterZone(page, {
      cardCode: MYSTICAL_ELF,
      sequence: 2,
    });
    const handCountAfterSummon = await duelCard(page, {
      controller,
      zone: "HAND",
    }).count();
    expect(handCountAfterSummon).toBeGreaterThanOrEqual(4);

    await activateKoaKiRing(page, controller);

    await expectControllerHandCount(
      page,
      controller,
      handCountAfterSummon - 1,
      {
        timeout: SHUFFLE_ASSERT_TIMEOUT,
      },
    );
    await expect(
      duelCard(page, {
        code: IRON_CORE,
        controller,
        zone: "HAND",
      }).first(),
    ).toBeVisible({ timeout: SHUFFLE_ASSERT_TIMEOUT });
    await expect(
      duelCard(page, {
        code: KOAKI_RING,
        controller,
        zone: "GRAVE",
      }).first(),
    ).toBeVisible({ timeout: SHUFFLE_ASSERT_TIMEOUT });
    await expect(
      duelCard(page, {
        code: MYSTICAL_ELF,
        controller,
        zone: "GRAVE",
      }).first(),
    ).toBeVisible({ timeout: SHUFFLE_ASSERT_TIMEOUT });
    await expectPlayerLifeBelow(page, "me", 8000, SHUFFLE_ASSERT_TIMEOUT);
    await expectPlayerLifeBelow(page, "op", 8000, SHUFFLE_ASSERT_TIMEOUT);

    await surrenderAndClosePage(page);
  });
});

async function activateKoaKiRing(page: Page, controller: string | number) {
  const ring = duelCard(page, {
    code: KOAKI_RING,
    controller,
    zone: "HAND",
    idleAction: "ACTIVATE",
  }).first();

  await clickCardAction(page, ring, "activate");

  let revealedCost = false;
  let selectedTarget = false;
  const deadline = Date.now() + SHUFFLE_ASSERT_TIMEOUT;

  while (Date.now() < deadline) {
    await chooseSelectableZoneIfAvailable(page, {
      zone: "SZONE",
      controller,
      sequence: 2,
      timeout: 250,
    });
    revealedCost =
      revealedCost || (await selectCardsFromModalIfRequested(page, IRON_CORE));
    selectedTarget =
      selectedTarget ||
      (await selectCardsFromModalIfRequested(page, MYSTICAL_ELF));

    if (
      revealedCost &&
      selectedTarget &&
      (await duelCard(page, {
        code: MYSTICAL_ELF,
        controller,
        zone: "GRAVE",
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
      code: MYSTICAL_ELF,
      controller,
      zone: "GRAVE",
    }).first(),
  ).toBeVisible({ timeout: 1 });
}

async function selectCardsFromModalIfRequested(page: Page, cardCode: number) {
  return selectCardsIfRequested(page, [cardCode], 250);
}
