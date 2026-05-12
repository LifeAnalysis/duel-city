import { expect, test } from "@playwright/test";

import {
  advanceReplay,
  buildMinimalDuelReplay,
  duelCards,
  expectDuelCardZoneCounts,
  pauseReplay,
  uploadReplay,
  writeReplayFixture,
} from "./helpers/replay";

test("uploads a yrp3d replay and advances to the duel result", async ({
  page,
}, testInfo) => {
  const replayPath = await writeReplayFixture(
    testInfo,
    "minimal-duel.yrp3d",
    buildMinimalDuelReplay(),
  );

  await uploadReplay(page, replayPath);
  await pauseReplay(page);

  const cards = duelCards(page);
  await expect(cards.first()).toBeVisible();
  await expect(cards).toHaveCount(136);

  await expect(cards.first()).toHaveAttribute(
    "data-card-zone",
    /DECK|EXTRA|TZONE/,
  );
  await expectDuelCardZoneCounts(page, {
    DECK: 80,
    EXTRA: 30,
    TZONE: 26,
  });
  await expect(page.getByText("Win")).toBeHidden();

  await advanceReplay(page);

  await expect(page.getByText("Win")).toBeVisible();
});
