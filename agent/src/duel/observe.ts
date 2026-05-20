import type { Page } from "@playwright/test";

import type {
  DuelObservation,
  RawDuelObservation,
  RawObservedCard,
  VisibleModal,
} from "../types.ts";

export async function observeDuel(page: Page): Promise<DuelObservation> {
  const raw = await page.evaluate<RawDuelObservation>(() => {
    const visible = (element: Element) => {
      const html = element as HTMLElement;
      return Boolean(
        html.offsetWidth || html.offsetHeight || html.getClientRects().length,
      );
    };
    const text = (element: Element | null) =>
      element?.textContent?.trim() ?? "";

    const phaseSelect = document.querySelector(
      '[data-testid="duel-phase-select"]',
    );
    const life: Record<string, number> = {};
    document
      .querySelectorAll('[data-testid="duel-player-life"]')
      .forEach((element) => {
        const player = element.getAttribute("data-player");
        const value = Number(element.getAttribute("data-life"));
        if (player && Number.isFinite(value)) life[player] = value;
      });

    const cards: RawObservedCard[] = [
      ...document.querySelectorAll('[data-testid="duel-card"]'),
    ].map((element) => ({
      uuid: element.getAttribute("data-card-uuid"),
      code: element.getAttribute("data-card-code"),
      controller: element.getAttribute("data-card-controller"),
      zone: element.getAttribute("data-card-zone"),
      sequence: element.getAttribute("data-card-sequence"),
      position: element.getAttribute("data-card-position"),
      selectable: element.getAttribute("data-card-selectable") === "true",
      idleActions: (element.getAttribute("data-card-idle-actions") ?? "")
        .split(/\s+/)
        .filter(Boolean),
      visible: visible(element),
    }));

    const modalSelectors: [VisibleModal, string][] = [
      ["yesno", '[data-testid="duel-yesno-modal"]'],
      ["position", '[data-testid="duel-position-modal"]'],
      ["option", '[data-testid="duel-option-modal"]'],
      ["select_cards", '[data-testid="duel-select-cards-modal"]'],
      ["announce", '[data-testid="duel-announce-modal"]'],
      ["end", '[data-testid="duel-end-modal"]'],
    ];
    const visibleModal = modalSelectors.find(([, selector]) => {
      const element = document.querySelector(selector);
      return element ? visible(element) : false;
    })?.[0];

    return {
      url: window.location.href,
      title: document.title,
      phase: phaseSelect?.getAttribute("data-current-phase") ?? "unknown",
      canChoosePhase: phaseSelect
        ? !phaseSelect.hasAttribute("disabled")
        : false,
      life,
      cards,
      visibleModal,
      endResult: text(
        document.querySelector('[data-testid="duel-end-result"]'),
      ),
    };
  });

  return toSemanticObservation(raw);
}

function toSemanticObservation(raw: RawDuelObservation): DuelObservation {
  const selfCards = raw.cards.filter((card) => card.controller === "0");
  const opponentCards = raw.cards.filter((card) => card.controller !== "0");

  const observation: DuelObservation = {
    url: raw.url,
    isDuelPage: raw.url.includes("/duel"),
    phase: semanticPhase(raw.phase),
    life: {
      self: raw.life.me ?? 8000,
      opponent: raw.life.op ?? 8000,
    },
    self: {
      hand: cardsIn(selfCards, "HAND").map(knownCardName),
      monsters: cardsIn(selfCards, "MZONE").map(publicCardName),
      spellsAndTraps: cardsIn(selfCards, "SZONE").map(publicCardName),
      graveyard: cardsIn(selfCards, "GRAVE").map(publicCardName),
      banished: cardsIn(selfCards, "REMOVED").map(publicCardName),
      extraDeck: `${cardsIn(selfCards, "EXTRA").length} cards`,
    },
    opponent: {
      hand: `${cardsIn(opponentCards, "HAND").length} unknown cards`,
      monsters: cardsIn(opponentCards, "MZONE").map(publicCardName),
      spellsAndTraps: cardsIn(opponentCards, "SZONE").map(publicCardName),
      graveyard: cardsIn(opponentCards, "GRAVE").map(publicCardName),
      banished: cardsIn(opponentCards, "REMOVED").map(publicCardName),
      extraDeck: `${cardsIn(opponentCards, "EXTRA").length} cards`,
    },
    pendingInteraction: pendingInteraction(raw),
    recentHistory: [],
    raw,
    summary: "",
  };

  observation.summary = buildSummary(observation);
  return observation;
}

function cardsIn(cards: RawObservedCard[], zone: string): RawObservedCard[] {
  return cards.filter((card) => card.zone === zone && card.visible);
}

function knownCardName(card: RawObservedCard): string {
  return card.code && card.code !== "0" ? `card #${card.code}` : "unknown card";
}

function publicCardName(card: RawObservedCard): string {
  const position = card.position ? ` (${card.position})` : "";
  return `${knownCardName(card)}${position}`;
}

function semanticPhase(phase: string): string {
  const map: Record<string, string> = {
    DRAW: "Draw Phase",
    STANDBY: "Standby Phase",
    MAIN1: "Main Phase 1",
    BATTLE_START: "Battle Phase",
    BATTLE_STEP: "Battle Phase",
    DAMAGE: "Damage Step",
    MAIN2: "Main Phase 2",
    END: "End Phase",
  };

  return map[phase] ?? phase ?? "unknown";
}

function pendingInteraction(raw: RawDuelObservation): string {
  if (raw.endResult) return `Duel ended: ${raw.endResult}`;
  if (raw.visibleModal === "yesno") return "Choose yes or no.";
  if (raw.visibleModal === "position") return "Choose a battle position.";
  if (raw.visibleModal === "option") return "Choose an effect option.";
  if (raw.visibleModal === "select_cards") return "Select card option(s).";
  if (raw.visibleModal === "announce")
    return "Announce a card, number, attribute, or race.";
  if (raw.canChoosePhase) return "Choose one currently legal action.";
  return "Waiting for the next available action.";
}

function buildSummary(observation: DuelObservation): string {
  const selfMonsterCount = observation.self.monsters.length;
  const opponentMonsterCount = observation.opponent.monsters.length;

  return [
    `Current phase: ${observation.phase}.`,
    `LP: you ${observation.life.self}, opponent ${observation.life.opponent}.`,
    `You have ${observation.self.hand.length} known cards in hand and ${selfMonsterCount} monsters.`,
    `Opponent has ${observation.opponent.hand} and ${opponentMonsterCount} monsters.`,
    observation.pendingInteraction,
  ].join(" ");
}
