import type { Page } from "@playwright/test";

import type { AgentConfig } from "../types.ts";

export async function enterDuelPage(
  page: Page,
  config: AgentConfig,
): Promise<void> {
  if (config.duelUrl) {
    await page.goto(config.duelUrl, { waitUntil: "domcontentloaded" });
    return;
  }

  await page.goto(`${config.baseURL}${config.startPath}`, {
    waitUntil: "domcontentloaded",
  });
}
