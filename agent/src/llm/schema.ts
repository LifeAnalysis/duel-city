import type {
  AgentActionKind,
  AgentPrivateAction,
  LlmDecisionRequest,
  LlmDecisionResponse,
} from "../types.ts";

export const DECISION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["version", "stepId", "actionId", "reason"],
  properties: {
    version: { type: "number", enum: [1] },
    stepId: { type: "number" },
    actionId: { type: "string" },
    reason: { type: "string" },
  },
};

export type DecisionValidationResult =
  | { ok: true; action: AgentPrivateAction }
  | { ok: false; error: string };

export function validateDecisionResponse(
  decision: unknown,
  request: LlmDecisionRequest,
  privateActions: AgentPrivateAction[],
): DecisionValidationResult {
  if (!decision || typeof decision !== "object") {
    return { ok: false, error: "LLM response is not an object." };
  }

  const candidate = decision as Partial<LlmDecisionResponse>;

  if (candidate.version !== request.version) {
    return {
      ok: false,
      error: `Unsupported decision version: ${candidate.version}`,
    };
  }

  if (candidate.stepId !== request.stepId) {
    return {
      ok: false,
      error: `Stale decision stepId: ${candidate.stepId}; expected ${request.stepId}`,
    };
  }

  const action = privateActions.find(
    (actionCandidate) => actionCandidate.id === candidate.actionId,
  );
  if (!action) {
    return { ok: false, error: `Unknown actionId: ${candidate.actionId}` };
  }

  return { ok: true, action };
}

export function fallbackDecision(
  request: LlmDecisionRequest,
  privateActions: AgentPrivateAction[],
  reason = "Fallback policy selected an action.",
): LlmDecisionResponse {
  const action =
    firstByKind(privateActions, "select_yesno") ??
    firstByKind(privateActions, "select_option") ??
    firstByKind(privateActions, "select_position") ??
    firstByKind(privateActions, "select_card") ??
    privateActions.find(
      (candidate) =>
        candidate.kind === "card_action" && candidate.action === "ATTACK",
    ) ??
    privateActions.find(
      (candidate) =>
        candidate.kind === "card_action" && candidate.action === "SUMMON",
    ) ??
    privateActions.find(
      (candidate) => candidate.kind === "phase" && candidate.phase === "end",
    ) ??
    firstByKind(privateActions, "wait") ??
    privateActions[0];

  if (!action) {
    throw new Error("No legal actions available for fallback decision.");
  }

  return {
    version: request.version,
    stepId: request.stepId,
    actionId: action.id,
    reason,
  };
}

function firstByKind(
  actions: AgentPrivateAction[],
  kind: AgentActionKind,
): AgentPrivateAction | undefined {
  return actions.find((candidate) => candidate.kind === kind);
}
