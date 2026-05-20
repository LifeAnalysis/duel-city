/**
 * Unit tests for harness request handling without opening a real HTTP port.
 *
 * A fake decision runner keeps the tests focused on payload validation and the
 * response wrapper expected by the Agent client.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { handleHarnessDecisionRequest } from "./server.ts";

import type {
  AgentConfig,
  CodexHarnessDecisionRequest,
  LlmDecisionRequest,
} from "../types.ts";

test("handleHarnessDecisionRequest returns a wrapped decision", async () => {
  const payload = harnessPayload();
  const response = await handleHarnessDecisionRequest(
    baseConfig(),
    payload,
    async (request) => ({
      version: 1,
      stepId: request.stepId,
      actionId: "a_001",
      reason: "test runner",
    }),
  );

  assert.deepEqual(response, {
    decision: {
      version: 1,
      stepId: 1,
      actionId: "a_001",
      reason: "test runner",
    },
  });
});

test("handleHarnessDecisionRequest rejects unsupported runtimes", async () => {
  await assert.rejects(
    () =>
      handleHarnessDecisionRequest(baseConfig(), {
        ...harnessPayload(),
        runtime: "other",
      }),
    /Unsupported harness runtime/,
  );
});

/** Builds the HTTP payload shape accepted by the Codex harness. */
function harnessPayload(): CodexHarnessDecisionRequest {
  return {
    runtime: "codex",
    authProfile: "codex-cli",
    model: "gpt-5.1",
    request: decisionRequest(),
  };
}

/** Creates the semantic request nested inside the harness payload. */
function decisionRequest(): LlmDecisionRequest {
  return {
    version: 1,
    duelId: "test-duel",
    stepId: 1,
    instruction: "Choose exactly one legal action. Return JSON only.",
    gameState: {
      summary: "A deterministic server test state.",
      turn: "unknown",
      phase: "unknown",
      life: {
        self: 8000,
        opponent: 8000,
      },
      self: {
        hand: [],
        monsters: [],
        spellsAndTraps: [],
        graveyard: [],
        banished: [],
        extraDeck: "0 cards",
      },
      opponent: {
        hand: "0 unknown cards",
        monsters: [],
        spellsAndTraps: [],
        graveyard: [],
        banished: [],
        extraDeck: "0 cards",
      },
      pendingInteraction: "Server test only.",
      recentHistory: [],
    },
    legalActions: [
      {
        id: "a_001",
        description: "Wait briefly and observe the duel again.",
      },
    ],
  };
}

/** Provides stable config values for direct handler tests. */
function baseConfig(): AgentConfig {
  return {
    rootDir: process.cwd(),
    command: "codex-harness",
    positional: [],
    baseURL: "http://127.0.0.1:5173",
    startPath: "/match/",
    duelUrl: "",
    mode: "headless",
    slowMo: 0,
    maxSteps: 1,
    stepDelayMs: 0,
    actionTimeoutMs: 1000,
    dryRun: true,
    storageState: ".agent/state/mycard.json",
    storageStateExists: false,
    logDir: ".agent/logs",
    runId: "test-run",
    llm: {
      provider: "codex",
      authProvider: "codex-cli",
      model: "gpt-5.1",
      baseURL: "https://api.openai.com/v1",
      codexHarnessUrl: "http://127.0.0.1:8787/decision",
      codexHome: "/tmp/neos-test-codex",
    },
    harness: {
      host: "127.0.0.1",
      port: 8787,
      path: "/decision",
      codexCommand: "codex",
      codexTimeoutMs: 120_000,
    },
  };
}
