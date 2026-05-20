/**
 * HTTP wrapper around the Codex harness decision runner.
 *
 * The server exposes a small local-only protocol: `GET /health` for auth
 * diagnostics and `POST /decision` for Agent decision requests. The default
 * runner delegates to `codex exec`.
 */
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

import { inspectCodexAuth } from "../auth/codexAuth.ts";
import { runCodexExecDecision } from "./codexExec.ts";
import { parseHarnessDecisionRequest } from "./decision.ts";

import type {
  AgentConfig,
  LlmDecisionRequest,
  LlmDecisionResponse,
} from "../types.ts";

export type HarnessDecisionRunner = (
  request: LlmDecisionRequest,
  model: string,
) => Promise<LlmDecisionResponse>;

export interface CodexHarnessServer {
  /** Stops the HTTP server and releases the local port. */
  close: () => Promise<void>;
  /** Fully qualified decision endpoint printed for CLI users and tests. */
  url: string;
}

/** Starts the local Codex harness HTTP server. */
export async function startCodexHarnessServer(
  config: AgentConfig,
): Promise<CodexHarnessServer> {
  const server = createServer((request, response) => {
    void handleHarnessHttpRequest(config, request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.harness.port, config.harness.host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const url = `http://${config.harness.host}:${address.port}${config.harness.path}`;
  return {
    url,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

/**
 * Runs the harness as a long-lived CLI command until SIGINT/SIGTERM.
 *
 * This is the command behind `npm run agent:codex-harness`.
 */
export async function runCodexHarnessCli(config: AgentConfig): Promise<void> {
  const harness = await startCodexHarnessServer(config);
  console.log(`Codex harness listening at ${harness.url}`);
  console.log("Use Ctrl+C to stop it.");

  await new Promise<void>((resolve) => {
    const stop = () => {
      void harness.close().finally(resolve);
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}

/** Handles a parsed harness request body and returns the wrapped decision. */
export async function handleHarnessDecisionRequest(
  config: AgentConfig,
  body: unknown,
  runner: HarnessDecisionRunner = async (request, model) => {
    const result = await runCodexExecDecision(config, request, { model });
    return result.decision;
  },
): Promise<unknown> {
  const { model, request } = parseHarnessDecisionRequest(body);
  const decision = await runner(request, model);
  return { decision };
}

/** Routes the minimal HTTP API and maps failures into JSON error responses. */
async function handleHarnessHttpRequest(
  config: AgentConfig,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/health") {
      await writeJson(response, 200, {
        ok: true,
        codex: await inspectCodexAuth(config),
        decisionPath: config.harness.path,
        codexCommand: config.harness.codexCommand,
      });
      return;
    }

    if (request.method !== "POST" || url.pathname !== config.harness.path) {
      await writeJson(response, 404, {
        ok: false,
        error: `Expected POST ${config.harness.path}.`,
      });
      return;
    }

    const body = JSON.parse(await readBody(request));
    const payload = await handleHarnessDecisionRequest(config, body);
    await writeJson(response, 200, payload);
  } catch (error) {
    await writeJson(response, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Reads a small JSON request body from Node's streaming HTTP API. */
function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on("error", reject);
    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

/** Writes deterministic JSON responses for both success and error paths. */
async function writeJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
): Promise<void> {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}
