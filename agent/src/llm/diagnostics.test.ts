/**
 * Unit tests for provider health-check reporting.
 *
 * The diagnostics command is intentionally browser-free, so these tests verify
 * success and configuration-error paths without loading Neos.
 */
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { checkLlmProvider } from "./diagnostics.ts";

import type { AgentConfig } from "../types.ts";

test("checkLlmProvider succeeds with the stub provider without network or secrets", async () => {
  const result = await checkLlmProvider(baseConfig());

  assert.equal(result.ok, true);
  assert.equal(result.provider, "stub");
  assert.equal(result.decision?.actionId, "a_001");
});

test("checkLlmProvider gives a concise codex harness configuration error", async () => {
  const codexHome = await mkdtemp(path.join(os.tmpdir(), "neos-codex-home-"));
  const result = await checkLlmProvider(
    baseConfig({
      provider: "codex",
      authProvider: "codex-cli",
      codexHarnessUrl: "",
      codexHome,
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.codexHarness?.configured, false);
  assert.equal(result.codexAuth?.available, false);
  assert.match(result.error ?? "", /Codex provider requires/);
});

/** Creates a minimal Agent config for diagnostics checks. */
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
