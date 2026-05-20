/**
 * Unit tests for Agent CLI/config parsing.
 *
 * These cases lock down provider defaults and path normalization because those
 * values decide whether the Agent uses env keys, Codex CLI auth, or the local
 * harness.
 */
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadAgentConfig, parseCli } from "./config.ts";

test("parseCli supports flags, key-value options, and positional arguments", () => {
  assert.deepEqual(
    parseCli([
      "play",
      "--mode",
      "headless",
      "--dry-run",
      "--model=gpt-test",
      "extra",
    ]),
    {
      command: "play",
      positional: ["extra"],
      options: {
        mode: "headless",
        "dry-run": true,
        model: "gpt-test",
      },
    },
  );
});

test("loadAgentConfig defaults codex provider to codex-cli auth and Codex CLI model", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "neos-agent-config-"));
  const config = await loadAgentConfig([
    "llm-check",
    "--llm-provider",
    "codex",
    "--storage",
    path.join(tempDir, "state.json"),
    "--log-dir",
    path.join(tempDir, "logs"),
    "--run-id",
    "test-run",
  ]);

  assert.equal(config.command, "llm-check");
  assert.equal(config.llm.provider, "codex");
  assert.equal(config.llm.authProvider, "codex-cli");
  assert.equal(config.llm.model, "");
  assert.equal(config.harness.host, "127.0.0.1");
  assert.equal(config.harness.port, 8787);
  assert.equal(config.harness.path, "/decision");
});

test("loadAgentConfig normalizes URLs, harness paths, booleans, and numeric values", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "neos-agent-config-"));
  const config = await loadAgentConfig([
    "play",
    "--base-url",
    "http://127.0.0.1:5173/",
    "--codex-harness-url",
    "http://127.0.0.1:8787/decision/",
    "--harness-path",
    "decision/",
    "--harness-port",
    "0",
    "--dry-run=false",
    "--max-steps",
    "3",
    "--storage",
    path.join(tempDir, "state.json"),
    "--log-dir",
    path.join(tempDir, "logs"),
  ]);

  assert.equal(config.baseURL, "http://127.0.0.1:5173");
  assert.equal(config.llm.codexHarnessUrl, "http://127.0.0.1:8787/decision");
  assert.equal(config.harness.path, "/decision");
  assert.equal(config.harness.port, 0);
  assert.equal(config.dryRun, false);
  assert.equal(config.maxSteps, 3);
});

test("loadAgentConfig rejects unsupported LLM providers", async () => {
  await assert.rejects(
    () => loadAgentConfig(["llm-check", "--llm-provider", "other"]),
    /Unsupported LLM provider/,
  );
});
