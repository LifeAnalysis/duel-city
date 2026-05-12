import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

function buildReplayRecord(func: number, extraData: Uint8Array) {
  const record = new Uint8Array(5 + extraData.byteLength);
  const recordView = new DataView(record.buffer);
  recordView.setUint8(0, func);
  recordView.setUint32(1, extraData.byteLength, true);
  record.set(extraData, 5);

  return record;
}

function buildMinimalDuelReplay() {
  const msgStart = new Uint8Array(17);
  const dataView = new DataView(msgStart.buffer);

  dataView.setUint8(0, 0);
  dataView.setInt32(1, 8000, true);
  dataView.setInt32(5, 8000, true);
  dataView.setInt16(9, 40, true);
  dataView.setInt16(11, 15, true);
  dataView.setInt16(13, 40, true);
  dataView.setInt16(15, 15, true);

  const msgWin = new Uint8Array([0, 0]);
  const records = [
    buildReplayRecord(4, msgStart),
    buildReplayRecord(5, msgWin),
  ];
  const replay = new Uint8Array(
    records.reduce((total, record) => total + record.byteLength, 0),
  );

  let offset = 0;
  for (const record of records) {
    replay.set(record, offset);
    offset += record.byteLength;
  }

  return replay;
}

test("uploads a yrp3d replay and renders the duel result", async ({
  page,
}, testInfo) => {
  const replayPath = testInfo.outputPath("minimal-duel.yrp3d");
  await mkdir(path.dirname(replayPath), { recursive: true });
  await writeFile(replayPath, buildMinimalDuelReplay());

  await page.goto("/match");

  await page.getByText(/录像回放|Replay/).first().click();
  await page.locator('input[type="file"]').setInputFiles(replayPath);
  await page.getByRole("button", { name: /开始回放|Start Replay/ }).click();

  await expect(page).toHaveURL(/\/duel/);

  const cards = page.locator('[data-testid="duel-card"]');
  await expect(cards.first()).toBeVisible();
  await expect(cards).toHaveCount(136);

  await expect(cards.first()).toHaveAttribute(
    "data-card-zone",
    /DECK|EXTRA|TZONE/,
  );
  await expect(
    page.locator('[data-testid="duel-card"][data-card-zone="DECK"]'),
  ).toHaveCount(80);
  await expect(
    page.locator('[data-testid="duel-card"][data-card-zone="EXTRA"]'),
  ).toHaveCount(30);
  await expect(
    page.locator('[data-testid="duel-card"][data-card-zone="TZONE"]'),
  ).toHaveCount(26);
  await expect(page.getByText("Win")).toBeVisible();
});
