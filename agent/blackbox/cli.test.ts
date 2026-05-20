/**
 * Black-box coverage for the Agent command-line interface.
 *
 * These tests execute `agent/src/cli.ts` in child processes. The harness test
 * uses a fake Codex executable so the HTTP/provider path is exercised without a
 * real Codex account or network call.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const CLI_PATH = path.join(ROOT_DIR, "agent/src/cli.ts");

test("agent CLI help prints available commands", async () => {
  const result = await runAgent(["help"]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /npm run agent -- codex-harness/);
  assert.match(result.stdout, /--llm-provider <name>/);
});

test("agent CLI llm-check works with the stub provider", async () => {
  const result = await runAgent([
    "llm-check",
    "--llm-provider",
    "stub",
    "--run-id",
    "blackbox-stub",
  ]);

  assert.equal(result.code, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.provider, "stub");
  assert.equal(payload.decision.actionId, "a_001");
});

test("agent CLI can complete codex-check through built-in harness with fake codex", async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "neos-agent-blackbox-"));
  const codexHome = path.join(tempDir, "codex-home");
  await mkdir(codexHome);
  await writeFile(
    path.join(codexHome, "auth.json"),
    JSON.stringify({ tokens: { access_token: "blackbox-access-token-value" } }),
  );

  const fakeCodex = await writeFakeCodex(tempDir);
  let harness: { stop: () => Promise<void>; url: string };
  try {
    harness = await startHarness(fakeCodex, codexHome);
  } catch (error) {
    if (isLoopbackListenDenied(error)) {
      t.skip(
        "Loopback listen is blocked by the current sandbox; run this black-box test without the sandbox to exercise the built-in harness.",
      );
      return;
    }
    throw error;
  }

  try {
    const result = await runAgent(
      [
        "llm-check",
        "--llm-provider",
        "codex",
        "--codex-harness-url",
        harness.url,
        "--codex-home",
        codexHome,
        "--run-id",
        "blackbox-codex",
      ],
      { timeoutMs: 10_000 },
    );

    assert.equal(result.code, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.provider, "codex");
    assert.equal(payload.codexAuth.available, true);
    assert.equal(payload.decision.actionId, "a_001");
  } finally {
    await harness.stop();
  }
});

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Runs the Agent CLI as a real child process from the repository root. */
function runAgent(
  args: string[],
  options: { env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<RunResult> {
  return runProcess(process.execPath, [CLI_PATH, ...args], {
    env: {
      ...process.env,
      ...options.env,
    },
    timeoutMs: options.timeoutMs ?? 5_000,
  });
}

/** Spawns a generic process and captures stdout/stderr for assertions. */
function runProcess(
  command: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv; timeoutMs: number },
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Process timed out: ${command} ${args.join(" ")}`));
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

/**
 * Starts the built-in harness on an ephemeral port and waits until it prints
 * the listening URL.
 */
async function startHarness(
  fakeCodex: string,
  codexHome: string,
): Promise<{ stop: () => Promise<void>; url: string }> {
  const child = spawn(
    process.execPath,
    [
      CLI_PATH,
      "codex-harness",
      "--harness-port",
      "0",
      "--codex-command",
      fakeCodex,
      "--codex-home",
      codexHome,
      "--codex-timeout-ms",
      "5000",
    ],
    {
      cwd: ROOT_DIR,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

  const url = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Harness did not start. stderr=${Buffer.concat(stderr).toString(
            "utf8",
          )}`,
        ),
      );
    }, 5_000);

    child.stdout.on("data", () => {
      const output = Buffer.concat(stdout).toString("utf8");
      const match = output.match(/Codex harness listening at (http:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(
        new Error(
          `Harness exited early with code ${code}. stderr=${Buffer.concat(
            stderr,
          ).toString("utf8")}`,
        ),
      );
    });
  });

  return {
    url,
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) {
          resolve();
          return;
        }
        child.once("exit", () => resolve());
        child.kill("SIGTERM");
      }),
  };
}

/** Writes a tiny Codex-compatible executable that produces a valid decision. */
async function writeFakeCodex(tempDir: string): Promise<string> {
  const fakeCodex = path.join(tempDir, "fake-codex.mjs");
  await writeFile(
    fakeCodex,
    `#!/usr/bin/env node
import { writeFileSync } from "node:fs";

const outputIndex = process.argv.indexOf("--output-last-message");
if (outputIndex === -1) {
  process.stderr.write("missing --output-last-message");
  process.exit(2);
}

writeFileSync(
  process.argv[outputIndex + 1],
  JSON.stringify({
    version: 1,
    stepId: 1,
    actionId: "a_001",
    reason: "fake codex blackbox decision"
  })
);
`,
  );
  await chmod(fakeCodex, 0o755);
  return fakeCodex;
}

/** Detects the sandbox-specific failure when local loopback listeners are blocked. */
function isLoopbackListenDenied(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("listen EPERM") &&
    error.message.includes("127.0.0.1")
  );
}
