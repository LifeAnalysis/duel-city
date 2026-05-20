/**
 * Runs the Codex CLI as the local model runtime for the Agent harness.
 *
 * The harness never reads or forwards Codex cached tokens. It delegates auth to
 * `codex exec`, constrains the task with an output schema, and validates the
 * final JSON decision before returning it to the Agent.
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { DECISION_JSON_SCHEMA } from "../llm/schema.ts";
import {
  buildCodexDecisionPrompt,
  parseDecisionJson,
  validateHarnessDecision,
} from "./decision.ts";

import type {
  AgentConfig,
  LlmDecisionRequest,
  LlmDecisionResponse,
} from "../types.ts";

export interface CodexExecOptions {
  /** Alternate executable used by tests or custom Codex installations. */
  command?: string;
  /** Prefix arguments placed before `exec`, mainly for fake CLI test shims. */
  commandArgs?: string[];
  /** Working directory passed to Codex as its root. */
  cwd?: string;
  /** Optional model override; empty string lets Codex CLI choose its default. */
  model?: string;
  /** Wall-clock timeout for the Codex subprocess. */
  timeoutMs?: number;
}

export interface CodexExecResult {
  /** Validated Agent decision extracted from Codex's final message. */
  decision: LlmDecisionResponse;
  /** Raw stdout retained for diagnostics only. */
  stdout: string;
  /** Raw stderr retained for diagnostics only. */
  stderr: string;
}

/**
 * Converts a duel decision request into a `codex exec` run and returns the
 * schema-validated action choice.
 */
export async function runCodexExecDecision(
  config: AgentConfig,
  request: LlmDecisionRequest,
  options: CodexExecOptions = {},
): Promise<CodexExecResult> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "neos-codex-harness-"));
  const schemaPath = path.join(tempDir, "decision.schema.json");
  const outputPath = path.join(tempDir, "decision.output.json");

  try {
    await writeFile(schemaPath, JSON.stringify(DECISION_JSON_SCHEMA, null, 2));

    const prompt = buildCodexDecisionPrompt(request);
    const run = await runCodexExecProcess({
      command: options.command ?? config.harness.codexCommand,
      commandArgs: options.commandArgs ?? [],
      cwd: options.cwd ?? config.rootDir,
      model: options.model ?? config.llm.model,
      prompt,
      schemaPath,
      outputPath,
      timeoutMs: options.timeoutMs ?? config.harness.codexTimeoutMs,
    });
    const output = await readFile(outputPath, "utf8");
    const decision = validateHarnessDecision(
      parseDecisionJson(output),
      request,
    );

    return {
      decision,
      stdout: run.stdout,
      stderr: run.stderr,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

interface CodexExecProcessOptions {
  command: string;
  commandArgs: string[];
  cwd: string;
  model: string;
  prompt: string;
  schemaPath: string;
  outputPath: string;
  timeoutMs: number;
}

interface ProcessResult {
  stdout: string;
  stderr: string;
}

/**
 * Spawns the Codex CLI with read-only, non-interactive options suitable for a
 * decision service. The prompt is passed over stdin to avoid shell quoting.
 */
function runCodexExecProcess({
  command,
  commandArgs,
  cwd,
  model,
  prompt,
  schemaPath,
  outputPath,
  timeoutMs,
}: CodexExecProcessOptions): Promise<ProcessResult> {
  const args = [
    ...commandArgs,
    "exec",
    "--sandbox",
    "read-only",
    "--config",
    'approval_policy="never"',
    "--ephemeral",
    "--ignore-rules",
    "--skip-git-repo-check",
    "--cd",
    cwd,
    "--output-schema",
    schemaPath,
    "--output-last-message",
    outputPath,
    "--color",
    "never",
    "-",
  ];

  if (model) {
    args.splice(commandArgs.length + 1, 0, "--model", model);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
    });
    child.stdin.end(prompt);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const stdoutText = Buffer.concat(stdout).toString("utf8");
      const stderrText = Buffer.concat(stderr).toString("utf8");

      if (timedOut) {
        reject(new Error(`codex exec timed out after ${timeoutMs}ms.`));
        return;
      }

      if (code !== 0) {
        reject(
          new Error(
            `codex exec failed with code ${code ?? "unknown"}${
              signal ? ` and signal ${signal}` : ""
            }: ${stderrText || stdoutText}`,
          ),
        );
        return;
      }

      resolve({ stdout: stdoutText, stderr: stderrText });
    });
  });
}
