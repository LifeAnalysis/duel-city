import type { Page } from "@playwright/test";

import type {
  AgentConfig,
  AgentPrivateAction,
  ExecutionResult,
} from "../types.ts";

export async function executePrivateAction(
  page: Page,
  action: AgentPrivateAction,
  config: AgentConfig,
): Promise<ExecutionResult> {
  if (config.dryRun) {
    return {
      executed: false,
      dryRun: true,
      actionId: action.id,
      description: action.llmDescription,
    };
  }

  switch (action.kind) {
    case "card_action":
      await page
        .locator(requiredActionValue(action.selector, action.kind, "selector"))
        .last()
        .click({ timeout: config.actionTimeoutMs });
      await page
        .locator(
          `[data-testid="duel-action-${requiredActionValue(
            action.action,
            action.kind,
            "action",
          ).toLowerCase()}"]:visible`,
        )
        .last()
        .click({ timeout: config.actionTimeoutMs });
      break;

    case "phase":
      await page
        .getByTestId("duel-phase-select")
        .click({ timeout: config.actionTimeoutMs });
      await page
        .locator(
          `[data-testid="duel-phase-${requiredActionValue(
            action.phase,
            action.kind,
            "phase",
          )}"]:visible`,
        )
        .last()
        .click({ timeout: config.actionTimeoutMs });
      break;

    case "select_place":
      await page
        .locator(requiredActionValue(action.selector, action.kind, "selector"))
        .last()
        .click({ timeout: config.actionTimeoutMs });
      break;

    case "select_card":
      await page
        .locator(requiredActionValue(action.selector, action.kind, "selector"))
        .last()
        .click({ timeout: config.actionTimeoutMs });
      await clickIfVisible(
        page,
        '[data-testid="duel-select-card-submit"]:visible:enabled',
        config,
      );
      break;

    case "select_option":
      await page
        .locator(requiredActionValue(action.selector, action.kind, "selector"))
        .last()
        .click({ timeout: config.actionTimeoutMs });
      await clickIfVisible(
        page,
        '[data-testid="duel-option-submit"]:visible:enabled',
        config,
      );
      break;

    case "select_position":
      await page
        .locator(requiredActionValue(action.selector, action.kind, "selector"))
        .last()
        .click({ timeout: config.actionTimeoutMs });
      break;

    case "select_yesno":
      await page
        .locator(
          `[data-testid="duel-yesno-${requiredActionValue(
            action.answer,
            action.kind,
            "answer",
          )}"]:visible`,
        )
        .last()
        .click({ timeout: config.actionTimeoutMs });
      break;

    case "surrender":
      await page
        .getByTestId("duel-surrender")
        .click({ timeout: config.actionTimeoutMs });
      break;

    case "wait":
      await page.waitForTimeout(config.stepDelayMs);
      break;

    default:
      throw new Error(`Unsupported private action kind: ${action.kind}`);
  }

  return {
    executed: true,
    actionId: action.id,
    kind: action.kind,
    description: action.llmDescription,
  };
}

async function clickIfVisible(
  page: Page,
  selector: string,
  config: AgentConfig,
): Promise<void> {
  const locator = page.locator(selector).last();

  if (await locator.isVisible({ timeout: 500 }).catch(() => false)) {
    await locator.click({ timeout: config.actionTimeoutMs });
  }
}

function requiredActionValue(
  value: string | undefined,
  kind: AgentPrivateAction["kind"],
  field: string,
): string {
  if (value) return value;
  throw new Error(`Action ${kind} is missing required ${field}.`);
}
