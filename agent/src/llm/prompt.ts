import { toLegalActions } from "../duel/actions.ts";

import type {
  AgentConfig,
  AgentPrivateAction,
  DuelObservation,
  LlmDecisionRequest,
} from "../types.ts";

export const SYSTEM_PROMPT = `You are controlling a Yu-Gi-Oh duel client.

Choose exactly one legal action from the provided legalActions list.
Return JSON only with: version, stepId, actionId, reason.
Do not invent actions.
Do not output Playwright code.
Do not output CSS selectors.
Do not describe ygopro protocol packets.
If no action improves the position, choose a phase/end/wait fallback action.`;

export function buildDecisionRequest({
  config,
  observation,
  privateActions,
  stepId,
}: {
  config: AgentConfig;
  observation: DuelObservation;
  privateActions: AgentPrivateAction[];
  stepId: number;
}): LlmDecisionRequest {
  return {
    version: 1 as const,
    duelId: config.runId,
    stepId,
    instruction: "Choose exactly one legal action. Return JSON only.",
    gameState: {
      summary: observation.summary,
      turn: "unknown" as const,
      phase: observation.phase,
      life: observation.life,
      self: observation.self,
      opponent: observation.opponent,
      pendingInteraction: observation.pendingInteraction,
      recentHistory: observation.recentHistory,
    },
    legalActions: toLegalActions(privateActions),
  };
}

export function buildOpenAiInput(request: LlmDecisionRequest): OpenAiInput {
  return [
    {
      role: "system",
      content: [{ type: "input_text", text: SYSTEM_PROMPT }],
    },
    {
      role: "user",
      content: [{ type: "input_text", text: JSON.stringify(request, null, 2) }],
    },
  ];
}

type OpenAiInput = {
  role: "system" | "user";
  content: {
    type: "input_text";
    text: string;
  }[];
}[];
