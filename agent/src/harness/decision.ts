/**
 * Translates between the Agent's harness HTTP payload and Codex-facing prompts.
 *
 * This module keeps browser automation details out of the model request and
 * validates that Codex selects only an action already offered by the Agent.
 */
import { DECISION_JSON_SCHEMA } from "../llm/schema.ts";

import type {
  CodexHarnessDecisionRequest,
  LlmDecisionRequest,
  LlmDecisionResponse,
  LlmVisibleAction,
} from "../types.ts";

export interface ParsedHarnessRequest {
  /** Optional Codex CLI model override; empty string means use Codex defaults. */
  model: string;
  /** Semantic Agent decision request that will be shown to Codex. */
  request: LlmDecisionRequest;
}

/** Validates and normalizes the HTTP body accepted by the Codex harness. */
export function parseHarnessDecisionRequest(
  value: unknown,
): ParsedHarnessRequest {
  if (!value || typeof value !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  const payload = value as Partial<CodexHarnessDecisionRequest>;
  if (payload.runtime !== "codex") {
    throw new Error(`Unsupported harness runtime: ${String(payload.runtime)}`);
  }

  if (!payload.request || typeof payload.request !== "object") {
    throw new Error("Harness request is missing request payload.");
  }

  const request = payload.request as Partial<LlmDecisionRequest>;
  if (request.version !== 1) {
    throw new Error(`Unsupported decision request version: ${request.version}`);
  }
  if (typeof request.stepId !== "number") {
    throw new Error("Decision request stepId must be a number.");
  }
  if (!Array.isArray(request.legalActions)) {
    throw new Error("Decision request legalActions must be an array.");
  }

  return {
    model: typeof payload.model === "string" ? payload.model : "",
    request: payload.request,
  };
}

/** Builds the pure decision prompt sent to `codex exec`. */
export function buildCodexDecisionPrompt(request: LlmDecisionRequest): string {
  return [
    "You are a decision engine for a Yu-Gi-Oh duel Agent.",
    "",
    "Use only the provided gameState and legalActions.",
    "Choose exactly one actionId from legalActions.",
    "Do not invent actions.",
    "Do not output Playwright code, CSS selectors, DOM details, or ygopro protocol packets.",
    "Do not edit files or run commands. This is a pure decision task.",
    "",
    "Return the final answer as JSON matching this schema:",
    JSON.stringify(DECISION_JSON_SCHEMA, null, 2),
    "",
    "Decision request:",
    JSON.stringify(request, null, 2),
  ].join("\n");
}

/**
 * Parses Codex output as JSON, tolerating fenced JSON or small wrapper text
 * around the final object.
 */
export function parseDecisionJson(text: string): LlmDecisionResponse {
  const trimmed = text.trim();
  const jsonText = stripJsonFence(trimmed) ?? extractJsonObject(trimmed);
  return JSON.parse(jsonText) as LlmDecisionResponse;
}

/** Ensures the Codex decision matches the request version, step, and actions. */
export function validateHarnessDecision(
  decision: unknown,
  request: LlmDecisionRequest,
): LlmDecisionResponse {
  if (!decision || typeof decision !== "object") {
    throw new Error("Codex decision is not a JSON object.");
  }

  const candidate = decision as Partial<LlmDecisionResponse>;
  if (candidate.version !== request.version) {
    throw new Error(`Unsupported Codex decision version: ${candidate.version}`);
  }
  if (candidate.stepId !== request.stepId) {
    throw new Error(
      `Codex decision stepId ${candidate.stepId} does not match request stepId ${request.stepId}.`,
    );
  }
  if (typeof candidate.actionId !== "string") {
    throw new Error("Codex decision actionId must be a string.");
  }
  if (
    !request.legalActions.some((action) => action.id === candidate.actionId)
  ) {
    throw new Error(
      `Codex decision selected unknown actionId: ${candidate.actionId}`,
    );
  }
  if (typeof candidate.reason !== "string") {
    throw new Error("Codex decision reason must be a string.");
  }

  return candidate as LlmDecisionResponse;
}

/** Formats visible actions for logs/debugging without exposing selectors. */
export function visibleActionsSummary(
  legalActions: LlmVisibleAction[],
): string {
  return legalActions
    .map((action) => `${action.id}: ${action.description}`)
    .join("\n");
}

/** Removes a Markdown JSON fence when Codex returns one despite schema mode. */
function stripJsonFence(text: string): string | undefined {
  const match = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim();
}

/** Extracts the outermost object from diagnostic text as a lenient fallback. */
function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return text;
  return text.slice(start, end + 1);
}
