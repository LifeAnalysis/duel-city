/**
 * Unit tests for model-facing prompt/request construction.
 *
 * The Agent keeps selectors and browser details private; these tests ensure the
 * LLM sees only semantic duel state and natural-language legal actions.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDecisionRequest,
  buildOpenAiInput,
  SYSTEM_PROMPT,
} from "./prompt.ts";

import type {
  AgentConfig,
  AgentPrivateAction,
  DuelObservation,
} from "../types.ts";

test("buildDecisionRequest exposes only semantic legal actions to the model", () => {
  const request = buildDecisionRequest({
    config: baseConfig(),
    observation: observation(),
    privateActions: [
      {
        id: "a_001",
        kind: "card_action",
        llmDescription: "Normal Summon card #123 from your hand.",
        selector: '[data-testid="duel-card"][data-card-code="123"]',
        action: "SUMMON",
      },
      {
        id: "a_002",
        kind: "wait",
        llmDescription: "Wait briefly and observe the duel again.",
      },
    ],
    stepId: 7,
  });

  assert.equal(request.version, 1);
  assert.equal(request.duelId, "test-run");
  assert.equal(request.stepId, 7);
  assert.deepEqual(request.legalActions, [
    {
      id: "a_001",
      description: "Normal Summon card #123 from your hand.",
    },
    {
      id: "a_002",
      description: "Wait briefly and observe the duel again.",
    },
  ]);
  assert.equal(JSON.stringify(request).includes("selector"), false);
  assert.equal(JSON.stringify(request).includes("data-testid"), false);
});

test("buildOpenAiInput keeps system instructions separate from JSON request", () => {
  const request = buildDecisionRequest({
    config: baseConfig(),
    observation: observation(),
    privateActions: actions(),
    stepId: 1,
  });
  const input = buildOpenAiInput(request);

  assert.equal(input[0].role, "system");
  assert.equal(input[0].content[0].text, SYSTEM_PROMPT);
  assert.equal(input[1].role, "user");
  assert.match(input[1].content[0].text, /"legalActions"/);
});

/** Returns the minimal private action set needed by prompt tests. */
function actions(): AgentPrivateAction[] {
  return [
    {
      id: "a_001",
      kind: "wait",
      llmDescription: "Wait briefly and observe the duel again.",
    },
  ];
}

/** Builds a semantic observation that resembles a live duel page. */
function observation(): DuelObservation {
  return {
    url: "http://127.0.0.1:5173/duel",
    isDuelPage: true,
    phase: "Main Phase 1",
    life: {
      self: 8000,
      opponent: 8000,
    },
    self: {
      hand: ["card #123"],
      monsters: [],
      spellsAndTraps: [],
      graveyard: [],
      banished: [],
      extraDeck: "15 cards",
    },
    opponent: {
      hand: "5 unknown cards",
      monsters: [],
      spellsAndTraps: [],
      graveyard: [],
      banished: [],
      extraDeck: "15 cards",
    },
    pendingInteraction: "Choose one currently legal action.",
    recentHistory: [],
    summary: "Current phase: Main Phase 1.",
    raw: {
      url: "http://127.0.0.1:5173/duel",
      title: "Neos",
      phase: "MAIN1",
      canChoosePhase: true,
      life: {
        me: 8000,
        op: 8000,
      },
      cards: [],
      endResult: "",
    },
  };
}

/** Provides stable config values for prompt construction assertions. */
function baseConfig(): AgentConfig {
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
