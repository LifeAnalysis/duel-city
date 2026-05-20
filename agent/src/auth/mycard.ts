import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import type { BrowserContext, Page } from "@playwright/test";

import type { AgentConfig } from "../types.ts";
import { saveStorageState } from "./storageState.ts";

export async function runMyCardAuth(
  config: AgentConfig,
  page: Page,
  context: BrowserContext,
): Promise<void> {
  if (config.mode === "headless") {
    throw new Error("MyCard auth capture requires --mode headed.");
  }

  await page.goto(`${config.baseURL}/match/`, {
    waitUntil: "domcontentloaded",
  });

  console.log(
    "A headed browser is open. Complete MyCard login in the browser.",
  );
  console.log(
    "Press Enter here after the Neos page shows the logged-in account.",
  );

  const rl = readline.createInterface({ input, output });
  try {
    await rl.question("");
  } finally {
    rl.close();
  }

  await saveStorageState(context, config.storageState);
  console.log(`Saved Playwright storageState: ${config.storageState}`);
}
