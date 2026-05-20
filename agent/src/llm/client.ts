import {
  hasOpenAiEnvCredential,
  resolveOpenAiCredential,
} from "../auth/codexAuth.ts";
import { buildOpenAiInput } from "./prompt.ts";
import { DECISION_JSON_SCHEMA, fallbackDecision } from "./schema.ts";

import type {
  AgentConfig,
  AgentPrivateAction,
  LlmClient,
  LlmDecisionRequest,
  LlmDecisionResponse,
} from "../types.ts";

export function createLlmClient(config: AgentConfig): LlmClient {
  validateLlmRuntimeConfig(config);

  if (config.llm.provider === "stub") {
    return new StubLlmClient();
  }

  if (config.llm.provider === "openai") {
    return new OpenAiResponsesClient(config);
  }

  if (config.llm.provider === "codex") {
    return new CodexHarnessClient(config);
  }

  throw new Error(`Unsupported LLM provider: ${String(config.llm.provider)}`);
}

export function validateLlmRuntimeConfig(config: AgentConfig): void {
  if (config.llm.provider === "openai" && !hasOpenAiEnvCredential()) {
    throw new Error(
      "OpenAI provider requires NEOS_AGENT_OPENAI_API_KEY or OPENAI_API_KEY.",
    );
  }

  if (config.llm.provider === "codex" && !config.llm.codexHarnessUrl) {
    throw new Error(
      "Codex provider requires NEOS_AGENT_CODEX_HARNESS_URL or --codex-harness-url. Codex CLI auth is not sent directly to the OpenAI Responses API.",
    );
  }
}

class StubLlmClient {
  async decide(
    request: LlmDecisionRequest,
    privateActions: AgentPrivateAction[],
  ): Promise<LlmDecisionResponse> {
    return fallbackDecision(
      request,
      privateActions,
      "Stub LLM provider selected a deterministic fallback action.",
    );
  }
}

class OpenAiResponsesClient {
  config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  async decide(
    request: LlmDecisionRequest,
    privateActions: AgentPrivateAction[],
  ): Promise<LlmDecisionResponse> {
    const credential = await resolveOpenAiCredential(this.config);
    const response = await fetch(`${this.config.llm.baseURL}/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${credential.token}`,
      },
      body: JSON.stringify({
        model: this.config.llm.model,
        input: buildOpenAiInput(request),
        text: {
          format: {
            type: "json_schema",
            name: "duel_agent_decision",
            strict: true,
            schema: DECISION_JSON_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `OpenAI Responses API failed: ${response.status} ${body}`,
      );
    }

    const body = await response.json();
    return parseDecisionOutput(body, request, privateActions);
  }
}

class CodexHarnessClient {
  config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  async decide(
    request: LlmDecisionRequest,
    privateActions: AgentPrivateAction[],
  ): Promise<LlmDecisionResponse> {
    // The harness owns Codex CLI/OAuth auth. The Agent sends only the semantic
    // duel request and never replays local Codex cached tokens as API keys.
    const response = await fetch(this.config.llm.codexHarnessUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        runtime: "codex",
        authProfile: this.config.llm.authProvider,
        model: this.config.llm.model,
        request,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Codex harness failed: ${response.status} ${body}`);
    }

    const body = await response.json();
    return parseHarnessDecisionOutput(body, request, privateActions);
  }
}

function parseDecisionOutput(
  body: unknown,
  request: LlmDecisionRequest,
  privateActions: AgentPrivateAction[],
): LlmDecisionResponse {
  const text = extractOutputText(body);

  if (!text) {
    return fallbackDecision(
      request,
      privateActions,
      "LLM returned no output text.",
    );
  }

  try {
    return JSON.parse(text) as LlmDecisionResponse;
  } catch (error) {
    return fallbackDecision(
      request,
      privateActions,
      `LLM returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function parseHarnessDecisionOutput(
  body: unknown,
  request: LlmDecisionRequest,
  privateActions: AgentPrivateAction[],
): LlmDecisionResponse {
  const direct = maybeDecision(body);
  if (direct) return direct;

  if (body && typeof body === "object" && "decision" in body) {
    const wrapped = maybeDecision((body as { decision?: unknown }).decision);
    if (wrapped) return wrapped;
  }

  return parseDecisionOutput(body, request, privateActions);
}

function maybeDecision(value: unknown): LlmDecisionResponse | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = value as Partial<LlmDecisionResponse>;
  if (
    candidate.version === 1 &&
    typeof candidate.stepId === "number" &&
    typeof candidate.actionId === "string" &&
    typeof candidate.reason === "string"
  ) {
    return candidate as LlmDecisionResponse;
  }

  return undefined;
}

function extractOutputText(body: unknown): string {
  if (!body || typeof body !== "object") return "";

  const payload = body as {
    output_text?: unknown;
    output?: {
      content?: {
        text?: unknown;
      }[];
    }[];
  };

  if (typeof payload.output_text === "string") return payload.output_text;

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") return content.text;
    }
  }

  return "";
}
