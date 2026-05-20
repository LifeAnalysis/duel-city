import { collectPrivateActions, toLegalActions } from "./actions.ts";
import { executePrivateAction } from "./executor.ts";
import { observeDuel } from "./observe.ts";
import { createLlmClient } from "../llm/client.ts";
import { buildDecisionRequest } from "../llm/prompt.ts";
import { fallbackDecision, validateDecisionResponse } from "../llm/schema.ts";
import type { Page } from "@playwright/test";

import type { RunRecorder } from "../logs/recorder.ts";
import type { AgentConfig, LlmDecisionResponse } from "../types.ts";

export async function runDuelLoop(
  page: Page,
  config: AgentConfig,
  recorder: RunRecorder,
): Promise<void> {
  const llm = createLlmClient(config);

  for (let stepId = 1; stepId <= config.maxSteps; stepId += 1) {
    const observation = await observeDuel(page);
    const privateActions = await collectPrivateActions(page, observation);
    const request = buildDecisionRequest({
      config,
      observation,
      privateActions,
      stepId,
    });

    await recorder.record("observation", {
      stepId,
      gameState: request.gameState,
      legalActions: toLegalActions(privateActions),
    });

    let decision: LlmDecisionResponse;
    try {
      decision = await llm.decide(request, privateActions);
    } catch (error) {
      decision = fallbackDecision(
        request,
        privateActions,
        `LLM call failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const validation = validateDecisionResponse(
      decision,
      request,
      privateActions,
    );
    if (!validation.ok) {
      decision = fallbackDecision(request, privateActions, validation.error);
    }

    const action = privateActions.find(
      (candidate) => candidate.id === decision.actionId,
    );
    if (!action) {
      throw new Error(
        `Validated decision has no executable action: ${decision.actionId}`,
      );
    }

    await recorder.record("decision", {
      stepId,
      decision,
      action: {
        id: action.id,
        kind: action.kind,
        description: action.llmDescription,
      },
    });

    const result = await executePrivateAction(page, action, config);
    await recorder.record("execution", { stepId, result });

    if (observation.raw.endResult) {
      await recorder.record("duel_end", {
        stepId,
        result: observation.raw.endResult,
      });
      break;
    }

    await page.waitForTimeout(config.stepDelayMs);
  }
}
