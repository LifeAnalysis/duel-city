import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  AgentConfig,
  CodexAuthInspection,
  OpenAiCredential,
} from "../types.ts";

const ENV_API_KEYS = ["NEOS_AGENT_OPENAI_API_KEY", "OPENAI_API_KEY"];

interface CodexCredential {
  kind: string;
  token: string;
}

export async function inspectCodexAuth(
  config: AgentConfig,
): Promise<CodexAuthInspection> {
  const authFile = getCodexAuthFile(config);

  if (!existsSync(authFile)) {
    return {
      available: false,
      source: "codex-cache",
      path: authFile,
      reason:
        "auth.json not found; Codex may be using a keychain credential store.",
    };
  }

  const parsed = await readJsonFile(authFile);
  const credential = findCodexCredential(parsed);

  return {
    available: Boolean(credential),
    source: "codex-cache",
    path: authFile,
    credentialKind: credential?.kind,
    reason: credential
      ? undefined
      : "No supported token field found in auth.json.",
  };
}

export async function resolveOpenAiCredential(
  config: AgentConfig,
): Promise<OpenAiCredential> {
  // Keep the OpenAI API transport env-only. Codex CLI credentials may be
  // ChatGPT/OAuth-backed and are intentionally routed through the harness path.
  const envCredential = resolveEnvCredential();
  if (envCredential) return envCredential;

  throw new Error(
    "No OpenAI API key found. Set NEOS_AGENT_OPENAI_API_KEY or OPENAI_API_KEY. Codex CLI auth is only used with the codex harness provider.",
  );
}

export function hasOpenAiEnvCredential(): boolean {
  return Boolean(resolveEnvCredential());
}

function getCodexAuthFile(config: AgentConfig): string {
  if (config.llm.codexAuthFile) return config.llm.codexAuthFile;
  return path.join(config.llm.codexHome, "auth.json");
}

function resolveEnvCredential(): OpenAiCredential | undefined {
  for (const key of ENV_API_KEYS) {
    const value = process.env[key];
    if (value) {
      return {
        source: "env",
        kind: key,
        token: value,
      };
    }
  }

  return undefined;
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function findCodexCredential(value: unknown): CodexCredential | undefined {
  const preferredPaths = [
    ["OPENAI_API_KEY"],
    ["api_key"],
    ["apiKey"],
    ["tokens", "access_token"],
    ["tokens", "id_token"],
    ["access_token"],
    ["accessToken"],
    ["id_token"],
  ];

  for (const pathParts of preferredPaths) {
    const token = findString(value, pathParts);
    if (isCredentialLike(token)) {
      return {
        kind: pathParts.join("."),
        token,
      };
    }
  }

  return findCredentialByKey(value);
}

function findString(value: unknown, pathParts: string[]): string | undefined {
  let current = value;

  for (const part of pathParts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" && current.length > 0
    ? current
    : undefined;
}

function findCredentialByKey(value: unknown): CodexCredential | undefined {
  if (!value || typeof value !== "object") return undefined;

  for (const [key, child] of Object.entries(value)) {
    if (
      typeof child === "string" &&
      credentialKeyName(key) &&
      isCredentialLike(child)
    ) {
      return { kind: key, token: child };
    }

    const nested = findCredentialByKey(child);
    if (nested) return nested;
  }

  return undefined;
}

function credentialKeyName(key: string): boolean {
  return /(^|_)(api_?key|access_?token|id_?token)$/i.test(key);
}

function isCredentialLike(value: unknown): value is string {
  return typeof value === "string" && value.length >= 20;
}
