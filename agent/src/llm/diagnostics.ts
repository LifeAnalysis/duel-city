/**
 * Provider health-check helpers used by `agent llm-check`.
 *
 * The check uses a synthetic one-action duel request so users can verify auth,
 * provider wiring, and response validation without opening Neos or a browser.
 */
import { inspectCodexAuth } from "../auth/codexAuth.ts";
import { createLlmClient, validateLlmRuntimeConfig } from "./client.ts";
import { validateDecisionResponse } from "./schema.ts";

import type {
  AgentConfig,
  AgentPrivateAction,
  CodexAuthInspection,
  LlmDecisionRequest,
  LlmDecisionResponse,
  LlmVisibleAction,
} from "../types.ts";

export interface LlmProviderCheck {
  /** Whether the provider returned a valid decision for the synthetic request. */
  ok: boolean;
  provider: AgentConfig["llm"]["provider"];
  authProvider: AgentConfig["llm"]["authProvider"];
  model: string;
  codexHarness?: {
    configured: boolean;
    url?: string;
  };
  codexAuth?: CodexAuthInspection;
  request: {
    duelId: string;
    stepId: number;
    legalActions: LlmVisibleAction[];
  };
  decision?: LlmDecisionResponse;
  error?: string;
}

/** Runs the provider health check and returns a JSON-serializable report. */
export async function checkLlmProvider(
  config: AgentConfig,
): Promise<LlmProviderCheck> {
  const privateActions = buildHealthCheckActions();
  const request = buildHealthCheckRequest(config, privateActions);
  const result: LlmProviderCheck = {
    ok: false,
    provider: config.llm.provider,
    authProvider: config.llm.authProvider,
    model: config.llm.model || "codex-cli-default",
    codexHarness:
      config.llm.provider === "codex"
        ? {
            configured: Boolean(config.llm.codexHarnessUrl),
            url: config.llm.codexHarnessUrl || undefined,
          }
        : undefined,
    codexAuth:
      config.llm.provider === "codex"
        ? await inspectCodexAuth(config)
        : undefined,
    request: {
      duelId: request.duelId,
      stepId: request.stepId,
      legalActions: request.legalActions,
    },
  };

  try {
    validateLlmRuntimeConfig(config);
    const decision = await createLlmClient(config).decide(
      request,
      privateActions,
    );
    const validation = validateDecisionResponse(
      decision,
      request,
      privateActions,
    );

    if (!validation.ok) {
      throw new Error(validation.error);
    }

    result.ok = true;
    result.decision = decision;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

/** Creates the single legal action used to keep provider checks deterministic. */
function buildHealthCheckActions(): AgentPrivateAction[] {
  return [
    {
      id: "a_001",
      kind: "wait",
      llmDescription: "Wait briefly and observe the duel again.",
    },
  ];
}

/** Builds a semantic decision request that does not depend on a live duel page. */
function buildHealthCheckRequest(
  config: AgentConfig,
  privateActions: AgentPrivateAction[],
): LlmDecisionRequest {
  return {
    version: 1,
    duelId: `${config.runId}:llm-check`,
    stepId: 1,
    instruction:
      "Provider health check. Choose the only legal action and return JSON only.",
    gameState: {
      summary:
        "Provider health check for a Yu-Gi-Oh duel agent. No real duel action will be executed.",
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
      pendingInteraction: "Health check only.",
      recentHistory: [],
    },
    legalActions: privateActions.map((action) => ({
      id: action.id,
      description: action.llmDescription,
    })),
  };
}
