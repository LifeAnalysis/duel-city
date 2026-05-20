/**
 * Unit tests for Codex credential-cache inspection.
 *
 * The assertions verify that auth diagnostics can detect cached credentials
 * without exposing the credential value in logs or JSON output.
 */
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { inspectCodexAuth } from "./codexAuth.ts";

import type { AgentConfig } from "../types.ts";

test("inspectCodexAuth detects a cached token without returning the secret", async () => {
  const codexHome = await mkdtemp(path.join(os.tmpdir(), "neos-codex-auth-"));
  const token = "sk-test-secret-value-that-must-not-leak";
  await writeFile(
    path.join(codexHome, "auth.json"),
    JSON.stringify({ tokens: { access_token: token } }),
  );

  const result = await inspectCodexAuth(baseConfig(codexHome));

  assert.equal(result.available, true);
  assert.equal(result.credentialKind, "tokens.access_token");
  assert.equal(JSON.stringify(result).includes(token), false);
});

test("inspectCodexAuth reports a missing file as unavailable", async () => {
  const codexHome = await mkdtemp(path.join(os.tmpdir(), "neos-codex-auth-"));

  const result = await inspectCodexAuth(baseConfig(codexHome));

  assert.equal(result.available, false);
  assert.match(result.reason ?? "", /auth\.json not found/);
});

/** Builds the minimum Agent config needed by Codex auth inspection tests. */
function baseConfig(codexHome: string): AgentConfig {
  return {
    rootDir: process.cwd(),
    command: "auth-status",
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
      codexHome,
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
