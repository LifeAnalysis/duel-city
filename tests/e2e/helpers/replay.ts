import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, type Page, type TestInfo } from "@playwright/test";

export function buildReplayRecord(func: number, extraData: Uint8Array) {
  const record = new Uint8Array(5 + extraData.byteLength);
  const recordView = new DataView(record.buffer);
  recordView.setUint8(0, func);
  recordView.setUint32(1, extraData.byteLength, true);
  record.set(extraData, 5);

  return record;
}

export function buildMinimalDuelReplay() {
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

export async function writeReplayFixture(
  testInfo: TestInfo,
  fileName: string,
  replay: Uint8Array,
) {
  const replayPath = testInfo.outputPath(fileName);
  await mkdir(path.dirname(replayPath), { recursive: true });
  await writeFile(replayPath, replay);

  return replayPath;
}

export async function uploadReplay(page: Page, replayPath: string) {
  await page.goto("/match");

  await page.getByText(/录像回放|Replay/).first().click();
  await page.locator('input[type="file"]').setInputFiles(replayPath);
  await page.getByRole("button", { name: /开始回放|Start Replay/ }).click();

  await expect(page).toHaveURL(/\/duel/);
}

export async function pauseReplay(page: Page) {
  const toggle = page.getByTestId("replay-toggle");

  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("data-replay-paused")) !== "true") {
    await toggle.click();
  }

  await expect(toggle).toHaveAttribute("data-replay-paused", "true");
  await expect(toggle).toHaveAttribute("data-replay-waiting", "true");
}

export async function advanceReplay(page: Page, steps = 1) {
  const advance = page.getByTestId("replay-advance");

  for (let i = 0; i < steps; i += 1) {
    await expect(advance).toBeEnabled();
    await advance.click();
  }
}

export function duelCards(page: Page) {
  return page.getByTestId("duel-card");
}

export async function expectDuelCardZoneCounts(
  page: Page,
  expected: Record<string, number>,
) {
  await Promise.all(
    Object.entries(expected).map(([zone, count]) =>
      expect(
        page.locator(`[data-testid="duel-card"][data-card-zone="${zone}"]`),
      ).toHaveCount(count),
    ),
  );
}
