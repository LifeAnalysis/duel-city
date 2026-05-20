/**
 * Unit tests for LLM provider transport selection and validation.
 *
 * These tests keep OpenAI API-key transport and Codex harness transport
 * separate, and verify that the Codex provider sends only semantic requests to
 * the harness.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createLlmClient, validateLlmRuntimeConfig } from "./client.ts";

import type {
  AgentConfig,
  AgentPrivateAction,
  LlmDecisionRequest,
} from "../types.ts";

test("codex provider posts the semantic decision request to the configured harness", async () => {
  const originalFetch = globalThis.fetch;
  let capturedInput: string | URL | Request | undefined;
  let capturedBody: unknown;

  globalThis.fetch = async (input, init) => {
    capturedInput = input;
    capturedBody = JSON.parse(String(init?.body));

    return new Response(
      JSON.stringify({
        decision: {
          version: 1,
          stepId: 1,
          actionId: "a_001",
          reason: "health check",
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  try {
    const client = createLlmClient(
      baseConfig({
        provider: "codex",
        authProvider: "codex-cli",
        codexHarnessUrl: "https://harness.example/decision",
      }),
    );

    const decision = await client.decide(request(), actions());

    assert.equal(capturedInput, "https://harness.example/decision");
    assert.deepEqual(capturedBody, {
      runtime: "codex",
      authProfile: "codex-cli",
      model: "gpt-5.1",
      request: request(),
    });
    assert.equal(decision.actionId, "a_001");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("codex provider requires a harness URL", () => {
  assert.throws(
    () =>
      validateLlmRuntimeConfig(
        baseConfig({
          provider: "codex",
          authProvider: "codex-cli",
          codexHarnessUrl: "",
        }),
      ),
    /Codex provider requires NEOS_AGENT_CODEX_HARNESS_URL/,
  );
});

test("openai provider only accepts explicit API key env credentials", () => {
  const previousNeosKey = process.env.NEOS_AGENT_OPENAI_API_KEY;
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  delete process.env.NEOS_AGENT_OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    assert.throws(
      () =>
        validateLlmRuntimeConfig(
          baseConfig({
            provider: "openai",
            authProvider: "env",
          }),
        ),
      /OpenAI provider requires NEOS_AGENT_OPENAI_API_KEY or OPENAI_API_KEY/,
    );
  } finally {
    restoreEnv("NEOS_AGENT_OPENAI_API_KEY", previousNeosKey);
    restoreEnv("OPENAI_API_KEY", previousOpenAiKey);
  }
});

/** Returns a deterministic private action set for provider client tests. */
function actions(): AgentPrivateAction[] {
  return [
    {
      id: "a_001",
      kind: "wait",
      llmDescription: "Wait briefly and observe the duel again.",
    },
  ];
}

/** Builds the semantic request sent to provider clients. */
function request(): LlmDecisionRequest {
  return {
    version: 1,
    duelId: "test-duel",
    stepId: 1,
    instruction: "Choose exactly one legal action. Return JSON only.",
    gameState: {
      summary: "A deterministic unit test state.",
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
      pendingInteraction: "Unit test only.",
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

/** Creates a base Agent config with caller-specified LLM overrides. */
function baseConfig(llm: Partial<AgentConfig["llm"]> = {}): AgentConfig {
  return {
    rootDir: process.cwd(),
    command: "llm-check",
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
      provider: "stub",
      authProvider: "none",
      model: "gpt-5.1",
      baseURL: "https://api.openai.com/v1",
      codexHarnessUrl: "",
      codexHome: "/tmp/neos-test-codex",
      ...llm,
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

/** Restores environment variables after tests mutate API-key state. */
function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
