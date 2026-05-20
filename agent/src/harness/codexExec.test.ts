/**
 * Unit tests for the Codex CLI runner used by the harness.
 *
 * The tests execute a fake Codex-compatible script to prove that schema/output
 * file handling works without invoking the real Codex binary.
 */
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runCodexExecDecision } from "./codexExec.ts";

import type { AgentConfig, LlmDecisionRequest } from "../types.ts";

test("runCodexExecDecision executes codex-compatible command and reads final JSON", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "neos-fake-codex-"));
  const fakeCodex = path.join(tempDir, "fake-codex.mjs");
  await writeFile(
    fakeCodex,
    `
import { writeFileSync } from "node:fs";

const outputIndex = process.argv.indexOf("--output-last-message");
if (outputIndex === -1) throw new Error("missing output path");

writeFileSync(
  process.argv[outputIndex + 1],
  JSON.stringify({
    version: 1,
    stepId: 1,
    actionId: "a_001",
    reason: "fake codex decision"
  })
);
process.stdout.write("fake codex ok");
`,
  );

  const result = await runCodexExecDecision(baseConfig(), request(), {
    command: process.execPath,
    commandArgs: [fakeCodex],
    timeoutMs: 5_000,
  });

  assert.equal(result.decision.actionId, "a_001");
  assert.match(result.stdout, /fake codex ok/);
});

/** Builds the semantic decision request consumed by the fake Codex process. */
function request(): LlmDecisionRequest {
  return {
    version: 1,
    duelId: "test-duel",
    stepId: 1,
    instruction: "Choose exactly one legal action. Return JSON only.",
    gameState: {
      summary: "A deterministic codex exec test state.",
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
      pendingInteraction: "Codex exec test only.",
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

/** Provides harness config for subprocess runner tests. */
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
