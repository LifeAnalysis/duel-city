import { chromium, type BrowserContextOptions } from "@playwright/test";

import type { AgentBrowserRuntime, AgentConfig } from "./types.ts";

export async function createAgentBrowser(
  config: AgentConfig,
): Promise<AgentBrowserRuntime> {
  const browser = await chromium.launch({
    headless: config.mode === "headless",
    slowMo: config.slowMo,
  });

  const contextOptions: BrowserContextOptions = {
    baseURL: config.baseURL,
    viewport: { width: 1280, height: 900 },
  };

  if (config.storageStateExists) {
    contextOptions.storageState = config.storageState;
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  return {
    browser,
    context,
    page,
    async close() {
      await context.close();
      await browser.close();
    },
  };
}
