#!/usr/bin/env node

import { createAgentBrowser } from "./browser.ts";
import { commandUsage, loadAgentConfig } from "./config.ts";
import { inspectCodexAuth } from "./auth/codexAuth.ts";
import { inspectStorageState } from "./auth/storageState.ts";
import { runMyCardAuth } from "./auth/mycard.ts";
import { collectPrivateActions, toLegalActions } from "./duel/actions.ts";
import { enterDuelPage } from "./duel/enterRoom.ts";
import { runDuelLoop } from "./duel/loop.ts";
import { observeDuel } from "./duel/observe.ts";
import { runCodexHarnessCli } from "./harness/server.ts";
import { validateLlmRuntimeConfig } from "./llm/client.ts";
import { checkLlmProvider } from "./llm/diagnostics.ts";
import { RunRecorder } from "./logs/recorder.ts";
import type { AgentBrowserRuntime, AgentConfig } from "./types.ts";

async function main(): Promise<void> {
  const config = await loadAgentConfig();

  switch (config.command) {
    case "help":
    case "--help":
    case "-h":
      console.log(commandUsage());
      return;

    case "auth-status":
      await printAuthStatus(config);
      return;

    case "codex-auth-check":
      await printCodexAuthCheck(config);
      return;

    case "codex-harness":
      await runCodexHarnessCli(config);
      return;

    case "llm-check":
      await printLlmCheck(config);
      return;

    case "auth":
      await withBrowser(config, async ({ page, context }) => {
        await runMyCardAuth(config, page, context);
      });
      return;

    case "observe":
      await withBrowser(config, async ({ page }) => {
        await enterDuelPage(page, config);
        const observation = await observeDuel(page);
        const actions = await collectPrivateActions(page, observation);
        console.log(
          JSON.stringify(
            {
              gameState: {
                summary: observation.summary,
                phase: observation.phase,
                life: observation.life,
                self: observation.self,
                opponent: observation.opponent,
                pendingInteraction: observation.pendingInteraction,
              },
              legalActions: toLegalActions(actions),
            },
            null,
            2,
          ),
        );
      });
      return;

    case "play":
      validateLlmRuntimeConfig(config);
      await withBrowser(config, async ({ page }) => {
        const recorder = new RunRecorder(config);
        await recorder.record("run_start", {
          mode: config.mode,
          baseURL: config.baseURL,
          llmProvider: config.llm.provider,
          llmAuth: config.llm.authProvider,
          maxSteps: config.maxSteps,
          dryRun: config.dryRun,
        });
        await enterDuelPage(page, config);
        await runDuelLoop(page, config, recorder);
        await recorder.record("run_end");
        console.log(`Agent run log: ${recorder.path}`);
      });
      return;

    default:
      throw new Error(
        `Unknown command: ${config.command}\n\n${commandUsage()}`,
      );
  }
}

async function printLlmCheck(config: AgentConfig): Promise<void> {
  const result = await checkLlmProvider(config);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

async function printCodexAuthCheck(config: AgentConfig): Promise<void> {
  const codex = await inspectCodexAuth(config);
  const result = {
    ok: codex.available,
    codex,
    hint: codex.available
      ? "Codex credential cache is visible to the Agent."
      : 'Run codex login, or set cli_auth_credentials_store = "file" in ~/.codex/config.toml for file-based detection. Keychain-backed credentials should be verified through a live codex harness smoke test.',
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

async function printAuthStatus(config: AgentConfig): Promise<void> {
  const storage = await inspectStorageState(config.storageState);
  const codex = await inspectCodexAuth(config);

  console.log(
    JSON.stringify(
      {
        storageState: storage,
        llm: {
          provider: config.llm.provider,
          authProvider: config.llm.authProvider,
          model: config.llm.model,
          codexHarness: {
            configured: Boolean(config.llm.codexHarnessUrl),
            url: config.llm.codexHarnessUrl || undefined,
          },
          codex,
          envApiKeyAvailable: Boolean(
            process.env.NEOS_AGENT_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
          ),
        },
      },
      null,
      2,
    ),
  );
}

async function withBrowser(
  config: AgentConfig,
  callback: (runtime: AgentBrowserRuntime) => Promise<void>,
): Promise<void> {
  const runtime = await createAgentBrowser(config);
  try {
    await callback(runtime);
  } finally {
    await runtime.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
