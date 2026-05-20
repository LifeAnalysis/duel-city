/**
 * Unit tests for Codex harness decision parsing and validation.
 *
 * These cases protect the boundary where free-form Codex output becomes a
 * concrete Agent action.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { parseDecisionJson, validateHarnessDecision } from "./decision.ts";

import type { LlmDecisionRequest } from "../types.ts";

test("parseDecisionJson accepts fenced JSON output", () => {
  const decision = parseDecisionJson(`\`\`\`json
{"version":1,"stepId":1,"actionId":"a_001","reason":"ok"}
\`\`\``);

  assert.equal(decision.actionId, "a_001");
});

test("validateHarnessDecision rejects actions outside legalActions", () => {
  assert.throws(
    () =>
      validateHarnessDecision(
        {
          version: 1,
          stepId: 1,
          actionId: "a_999",
          reason: "bad",
        },
        request(),
      ),
    /unknown actionId/,
  );
});

/** Returns a deterministic request with a single legal action. */
export function request(): LlmDecisionRequest {
  return {
    version: 1,
    duelId: "test-duel",
    stepId: 1,
    instruction: "Choose exactly one legal action. Return JSON only.",
    gameState: {
      summary: "A deterministic harness test state.",
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
      pendingInteraction: "Harness test only.",
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
