import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  activateHandCard,
  duelCard,
  expectCardCounter,
  getControllerOfHandCard,
  installOnlyLiveDeck,
  LIVE_E2E_ENABLED,
  readYdkDeck,
  startAiDuel,
  surrenderAndClosePage,
} from "../helpers/live";

const DECK = path.resolve(
  "tests/e2e/fixtures/live/decks/update-counter-war-rock-ordeal.ydk",
);
const DECK_NAME = "E2E Update Counter War Rock Ordeal";
const WAR_ROCK_ORDEAL = 71331215;
const WAR_ROCK_COUNTER = 0x5a;

test.describe("live update_counter regression", () => {
  test.skip(
    !LIVE_E2E_ENABLED,
    "Set PLAYWRIGHT_LIVE=1 to run tests against the real ygopro server.",
  );

  test("renders counter counts after a continuous spell adds counters", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(Number(process.env.LIVE_E2E_TIMEOUT ?? 180000));

    await installOnlyLiveDeck(page, await readYdkDeck(DECK, DECK_NAME));
    await startAiDuel(page, { mora: "paper", tp: "first" });

    const controller = await getControllerOfHandCard(page, WAR_ROCK_ORDEAL);
    await activateHandCard(page, WAR_ROCK_ORDEAL);

    const ordeal = duelCard(page, {
      code: WAR_ROCK_ORDEAL,
      controller,
      zone: "SZONE",
    }).first();
    await expect(ordeal).toBeVisible({ timeout: 60000 });
    await expectCardCounter(page, ordeal, {
      counterType: WAR_ROCK_COUNTER,
      count: 3,
    });

    await surrenderAndClosePage(page);
  });
});
