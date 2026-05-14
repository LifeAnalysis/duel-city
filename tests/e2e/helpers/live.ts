import { readFile } from "node:fs/promises";

import { expect, type Locator, type Page, type Route } from "@playwright/test";

export const LIVE_E2E_ENABLED = process.env.PLAYWRIGHT_LIVE === "1";

export interface LiveRoomOptions {
  botName?: string;
  chainSetting?: LiveChainSetting;
  mora?: "rock" | "paper" | "scissors";
  playerName?: string;
  roomPassword?: string;
  roomCodes?: string;
  roomPrefix?: string;
  tp?: "first" | "second";
}

export interface LiveDeck {
  deckName: string;
  main: number[];
  extra: number[];
  side: number[];
}

export type LiveChainSetting = "all" | "ignore" | "smart";

export const DEFAULT_AI_ROOM_PASSWORD = "AI,SS,NS,NC#有栖川蓝子";

export function uniqueLiveRoom(options: LiveRoomOptions = {}) {
  const roomSuffix = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const playerSuffix = `${Date.now().toString(36).slice(-4)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const roomCodes = options.roomCodes ?? "NS,NC,TIME0";
  const roomPrefix = options.roomPrefix ?? "neos-e2e";
  const playerName = options.playerName ?? `e2e-${playerSuffix}`;

  return {
    botName: options.botName ?? "蓝子",
    playerName,
    password:
      options.roomPassword ?? `${roomCodes}#${roomPrefix}-${roomSuffix}`,
  };
}

export async function createCustomRoom(page: Page, options: LiveRoomOptions) {
  const room = uniqueLiveRoom(options);

  for (const attempt of [1, 2]) {
    await page.goto("/match");
    await expect(page.getByTestId("match-mode-custom-room")).toBeVisible({
      timeout: 120000,
    });
    await expectSelectedDeck(page.getByTestId("match-deck-select"));

    await page.getByTestId("match-mode-custom-room").click();
    await page.getByTestId("match-modal-player").fill(room.playerName);
    await page.getByTestId("match-modal-password").fill(room.password);
    await page.getByTestId("match-modal-join").click();

    try {
      await expect(page).toHaveURL(/\/waitroom/, { timeout: 60000 });
      break;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }

  await expect(page.getByTestId("waitroom-player-me")).toHaveAttribute(
    "data-player-name",
    room.playerName,
    { timeout: 60000 },
  );
  await expectSelectedDeck(page.getByTestId("waitroom-deck-select"));

  return room;
}

export async function startAiDuel(page: Page, options: LiveRoomOptions = {}) {
  const room = await createCustomRoom(page, {
    botName: process.env.LIVE_E2E_BOT_NAME,
    playerName: process.env.LIVE_E2E_PLAYER_NAME,
    roomPassword:
      process.env.LIVE_E2E_ROOM_PASSWORD ?? DEFAULT_AI_ROOM_PASSWORD,
    roomCodes: process.env.LIVE_E2E_ROOM_CODES,
    roomPrefix: process.env.LIVE_E2E_ROOM_PREFIX,
    ...options,
  });

  await waitForAutoBot(page, room.botName);
  await completeDuelStartSelections(page, {
    mora: options.mora ?? "rock",
    tp: options.tp ?? "first",
  });
  await expectDuelStarted(page);
  await setChainSetting(page, options.chainSetting ?? "ignore");

  return room;
}

export async function readYdkDeck(
  deckPath: string,
  deckName: string,
): Promise<LiveDeck> {
  const text = await readFile(deckPath, "utf-8");
  const deck: LiveDeck = {
    deckName,
    main: [],
    extra: [],
    side: [],
  };
  let section: keyof Pick<LiveDeck, "main" | "extra" | "side"> | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#created")) continue;
    if (line === "#main") {
      section = "main";
      continue;
    }
    if (line === "#extra") {
      section = "extra";
      continue;
    }
    if (line === "!side") {
      section = "side";
      continue;
    }
    if (!section) continue;

    const code = Number(line);
    if (Number.isInteger(code)) deck[section].push(code);
  }

  return deck;
}

export async function installOnlyLiveDeck(page: Page, deck: LiveDeck) {
  const seedPath = "/__neos_e2e_deck_seed__";
  const seedHandler = async (route: Route) => {
    await route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><body></body></html>",
    });
  };

  await page.route(`**${seedPath}`, seedHandler);
  await page.goto(seedPath, { waitUntil: "domcontentloaded" });
  await page.evaluate(async (deckToInstall) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("decks");

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("decks")) {
          db.createObjectStore("decks");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("decks", "readwrite");
      const store = transaction.objectStore("decks");

      store.clear();
      store.put(deckToInstall, deckToInstall.deckName);

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  }, deck);
  await page.unroute(`**${seedPath}`, seedHandler);
}

export async function summonBot(page: Page, botName: string) {
  await page.getByTestId("waitroom-chat-input").fill(`/ai ${botName}`);
  await page.getByTestId("waitroom-chat-send").click();

  await expect(page.getByTestId("waitroom-player-op")).toContainText(botName, {
    timeout: 60000,
  });
}

export async function waitForAutoBot(page: Page, botName: string) {
  await expect(page.getByTestId("waitroom-player-op")).toContainText(botName, {
    timeout: 60000,
  });
}

export async function readyAndStartDuel(page: Page) {
  await page.getByTestId("waitroom-ready-toggle").click();
  await expect(page.getByTestId("waitroom-player-me")).toHaveAttribute(
    "data-player-ready",
    "true",
    { timeout: 30000 },
  );
  await expect(page.getByTestId("waitroom-player-op")).toHaveAttribute(
    "data-player-ready",
    "true",
    { timeout: 60000 },
  );
  await expect(page.getByTestId("waitroom-start")).toHaveAttribute(
    "aria-disabled",
    "false",
    { timeout: 30000 },
  );

  await page.getByTestId("waitroom-start").click();
}

export async function chooseRockPaperScissors(
  page: Page,
  mora: "rock" | "paper" | "scissors",
) {
  await page.getByTestId(`waitroom-mora-${mora}`).click({ timeout: 60000 });
}

export async function chooseTurnPlayer(page: Page, tp: "first" | "second") {
  await page.getByTestId(`waitroom-tp-${tp}`).click({ timeout: 60000 });
}

export async function completeDuelStartSelections(
  page: Page,
  options: {
    mora: "rock" | "paper" | "scissors";
    tp: "first" | "second";
  },
) {
  const deadline = Date.now() + 60000;

  while (Date.now() < deadline) {
    if (page.url().includes("/duel")) return;

    const tp = page.getByTestId(`waitroom-tp-${options.tp}`);
    if (await tp.isVisible()) {
      await tp.click();
      return;
    }

    const mora = page.getByTestId(`waitroom-mora-${options.mora}`);
    if (await mora.isVisible()) {
      await mora.click();
    }

    await page.waitForTimeout(250);
  }

  throw new Error("Timed out while completing live duel start selections.");
}

export async function expectDuelStarted(page: Page) {
  await expect(page).toHaveURL(/\/duel/, { timeout: 60000 });
  await expect(page.getByTestId("duel-card").first()).toBeVisible({
    timeout: 60000,
  });
}

export async function setChainSetting(page: Page, setting: LiveChainSetting) {
  const toggle = page.getByTestId("duel-chain-setting");

  if ((await toggle.getAttribute("data-chain-setting")) === setting) return;

  await toggle.click();
  await page.getByTestId(`duel-chain-setting-${setting}`).click({
    timeout: 30000,
  });
  await expect(toggle).toHaveAttribute("data-chain-setting", setting);
}

export function duelCard(
  page: Page,
  filters: {
    code?: number;
    controller?: string | number;
    zone?: string;
    sequence?: number;
    idleAction?: string;
  },
) {
  const selector = [
    '[data-testid="duel-card"]',
    filters.zone ? `[data-card-zone="${filters.zone}"]` : "",
    filters.code !== undefined ? `[data-card-code="${filters.code}"]` : "",
    filters.controller !== undefined
      ? `[data-card-controller="${filters.controller}"]`
      : "",
    filters.sequence !== undefined
      ? `[data-card-sequence="${filters.sequence}"]`
      : "",
    filters.idleAction
      ? `[data-card-idle-actions~="${filters.idleAction}"]`
      : "",
  ].join("");

  return page.locator(selector);
}

export async function activateHandCard(page: Page, cardCode: number) {
  const handCard = duelCard(page, {
    code: cardCode,
    zone: "HAND",
    idleAction: "ACTIVATE",
  }).first();

  await expect(handCard).toBeVisible({ timeout: 60000 });
  const controller = await handCard.getAttribute("data-card-controller");
  expect(
    controller,
    "Expected activatable hand card to have a controller.",
  ).not.toBeNull();

  await clickCardAction(page, handCard, "activate");
  await chooseSelectableZoneIfAvailable(page, {
    zone: "SZONE",
    controller: controller!,
    sequence: 2,
    timeout: 5000,
  });
}

export async function getControllerOfHandCard(page: Page, cardCode: number) {
  const handCard = duelCard(page, {
    code: cardCode,
    zone: "HAND",
  }).first();

  await expect(handCard).toBeVisible({ timeout: 60000 });
  const controller = await handCard.getAttribute("data-card-controller");
  expect(controller, "Expected hand card to have a controller.").not.toBeNull();

  return controller!;
}

export async function setHandCard(page: Page, cardCode: number) {
  const handCard = duelCard(page, {
    code: cardCode,
    zone: "HAND",
    idleAction: "SSET",
  }).first();

  await expect(handCard).toBeVisible({ timeout: 60000 });
  await clickCardAction(page, handCard, "sset");
}

export async function selectCardsFromModal(page: Page, cardCodes: number[]) {
  const modal = activeSelectCardsModal(page);

  try {
    await expect(modal).toBeVisible({
      timeout: 5000,
    });
  } catch {
    await selectSelectableCards(page, cardCodes);

    return;
  }

  for (const cardCode of cardCodes) {
    await modal
      .locator(
        `[data-testid="duel-select-card-option"][data-card-code="${cardCode}"]`,
      )
      .first()
      .click();
  }

  const submit = page
    .locator('[data-testid="duel-select-card-submit"]:enabled')
    .last();
  await expect(submit).toBeEnabled({ timeout: 30000 });
  await submit.click();
}

export async function selectCardFromModalIfVisible(
  page: Page,
  cardCode: number,
) {
  if (await activeSelectCardsModal(page).isVisible()) {
    await selectCardsFromModal(page, [cardCode]);
  }
}

export async function selectSelectableCards(page: Page, cardCodes: number[]) {
  for (const cardCode of cardCodes) {
    const card = page
      .locator(
        `[data-testid="duel-card"][data-card-code="${cardCode}"][data-card-selectable="true"]`,
      )
      .first();

    await expect(card).toBeVisible({ timeout: 60000 });
    await card.click();
    await page.waitForTimeout(250);
  }
}

export async function selectFirstSelectableCard(page: Page) {
  const card = page
    .locator('[data-testid="duel-card"][data-card-selectable="true"]')
    .first();

  await expect(card).toBeVisible({ timeout: 60000 });
  await card.click();
}

export async function chooseFirstOption(page: Page) {
  const modal = page.locator('[data-testid="duel-option-modal"]:visible');
  await expect(modal).toBeVisible({ timeout: 60000 });
  await page
    .locator('[data-testid="duel-option-item"]:visible')
    .first()
    .click();
  await page.locator('[data-testid="duel-option-submit"]:visible').click();
}

export async function chooseYesNo(page: Page, answer: "yes" | "no") {
  const button = page.locator(`[data-testid="duel-yesno-${answer}"]:visible`);
  await expect(button).toBeVisible({ timeout: 60000 });
  await button.click();
}

export async function choosePositionIfVisible(page: Page, position: string) {
  if (
    await page
      .locator('[data-testid="duel-position-modal"]:visible')
      .isVisible()
  ) {
    await page
      .locator(
        `[data-testid="duel-position-option"][data-position="${position}"]:visible`,
      )
      .last()
      .click();
  }
}

export async function chooseSelectableMainMonsterZone(
  page: Page,
  options: {
    controller: string | number;
    sequence: number;
  },
) {
  await chooseSelectableZone(page, {
    zone: "MZONE",
    controller: options.controller,
    sequence: options.sequence,
  });
}

export async function chooseSelectableZone(
  page: Page,
  options: {
    zone: string;
    controller: string | number;
    sequence: number;
  },
) {
  const targetZone = page.locator(
    [
      '[data-testid="duel-zone"]',
      `[data-zone="${options.zone}"]`,
      `[data-controller="${options.controller}"]`,
      `[data-sequence="${options.sequence}"]`,
    ].join(""),
  );

  await expect(targetZone).toHaveAttribute("data-place-selectable", "true", {
    timeout: 30000,
  });
  await targetZone.click();
}

export async function chooseSelectableZoneIfVisible(
  page: Page,
  options: {
    zone: string;
    controller: string | number;
    sequence: number;
  },
) {
  const targetZone = page.locator(
    [
      '[data-testid="duel-zone"]',
      `[data-zone="${options.zone}"]`,
      `[data-controller="${options.controller}"]`,
      `[data-sequence="${options.sequence}"]`,
      '[data-place-selectable="true"]',
    ].join(""),
  );

  if (await targetZone.isVisible()) {
    await targetZone.click();

    return true;
  }

  return false;
}

export async function chooseSelectableZoneIfAvailable(
  page: Page,
  options: {
    zone: string;
    controller: string | number;
    sequence: number;
    timeout?: number;
  },
) {
  const deadline = Date.now() + (options.timeout ?? 5000);

  while (Date.now() < deadline) {
    if (await chooseSelectableZoneIfVisible(page, options)) return true;
    await page.waitForTimeout(100);
  }

  return false;
}

export async function resolveSummonPlacement(
  page: Page,
  options: {
    cardCode: number;
    controller: string | number;
    sequence: number;
    position?: string;
  },
) {
  const deadline = Date.now() + 60000;
  const expectedCard = duelCard(page, {
    code: options.cardCode,
    zone: "MZONE",
    controller: options.controller,
    sequence: options.sequence,
  });

  while (Date.now() < deadline) {
    if (await expectedCard.isVisible()) return;

    if (options.position) {
      await choosePositionIfVisible(page, options.position);
    }

    await chooseSelectableZoneIfVisible(page, {
      zone: "MZONE",
      controller: options.controller,
      sequence: options.sequence,
    });

    await page.waitForTimeout(250);
  }

  await expect(expectedCard).toBeVisible({ timeout: 1 });
}

export async function waitForAnnounceCardModal(
  page: Page,
  options?: {
    controller?: string | number;
    spellTrapSequence?: number;
  },
) {
  const deadline = Date.now() + 60000;

  while (Date.now() < deadline) {
    if (
      await page
        .locator('[data-testid="duel-announce-modal"]:visible')
        .isVisible()
    ) {
      return;
    }

    if (
      options?.controller !== undefined &&
      options.spellTrapSequence !== undefined
    ) {
      await chooseSelectableZoneIfVisible(page, {
        zone: "SZONE",
        controller: options.controller,
        sequence: options.spellTrapSequence,
      });
    }

    await page.waitForTimeout(250);
  }

  await expect(
    page.locator('[data-testid="duel-announce-modal"]:visible'),
  ).toBeVisible({
    timeout: 1,
  });
}

export async function normalSummonToMainMonsterZone(
  page: Page,
  options: {
    cardCode: number;
    sequence: number;
  },
) {
  const handCard = duelCard(page, {
    code: options.cardCode,
    zone: "HAND",
    idleAction: "SUMMON",
  }).first();

  await expect(handCard).toBeVisible({ timeout: 60000 });

  const controller = await handCard.getAttribute("data-card-controller");
  expect(
    controller,
    "Expected summonable hand card to have a controller.",
  ).not.toBeNull();

  await clickCardAction(page, handCard, "summon");

  await chooseSelectableMainMonsterZone(page, {
    controller,
    sequence: options.sequence,
  });

  await expect(
    duelCard(page, {
      code: options.cardCode,
      zone: "MZONE",
      controller,
      sequence: options.sequence,
    }),
  ).toBeVisible({ timeout: 60000 });
}

export async function announceCardBySearch(
  page: Page,
  options: {
    search: string;
    cardCode?: number;
  },
) {
  await expect(
    page.locator('[data-testid="duel-announce-modal"]:visible'),
  ).toBeVisible({
    timeout: 60000,
  });
  await page
    .locator('[data-testid="duel-announce-search"]:visible')
    .fill(options.search);
  await page
    .locator('[data-testid="duel-announce-search-submit"]:visible')
    .click();
  const cardOption =
    options.cardCode === undefined
      ? page
          .locator(
            '[data-testid="duel-announce-card-option"]:visible input[type="checkbox"]',
          )
          .first()
      : page.locator(
          `[data-testid="duel-announce-card-option"][data-card-code="${options.cardCode}"]:visible input[type="checkbox"]`,
        );
  await cardOption.click({ timeout: 30000 });
  await page.locator('[data-testid="duel-announce-submit"]:visible').click();
}

export async function surrenderAndClosePage(page: Page) {
  await page.getByTestId("duel-surrender").click();
  await page.getByTestId("duel-surrender-confirm").click();

  await expect(page.getByTestId("duel-end-modal")).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByTestId("duel-end-result")).toHaveText(/Defeated|Win/);

  await page.close();
}

async function expectSelectedDeck(deckSelect: Locator) {
  await expect(
    deckSelect.locator(".ant-select-selection-item").first(),
    "Expected a deck to be selected before entering a live room.",
  ).not.toHaveText("", { timeout: 120000 });
}

export async function clickDuelAction(page: Page, action: string) {
  const item = visibleDuelAction(page, action);
  await expect(item).toBeVisible({ timeout: 30000 });
  await item.click();
}

export async function clickCardAction(
  page: Page,
  card: Locator,
  action: string,
) {
  const item = visibleDuelAction(page, action);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await card.click();
    try {
      await expect(item).toBeVisible({ timeout: 1000 });
      break;
    } catch {
      await page.waitForTimeout(100);
    }
  }

  await clickDuelAction(page, action);
}

function visibleDuelAction(page: Page, action: string) {
  return page.locator(`[data-testid="duel-action-${action}"]:visible`).last();
}

function activeSelectCardsModal(page: Page) {
  return page
    .locator(
      '[data-testid="duel-select-cards-modal"]:visible:not([data-select-max="0"])',
    )
    .last();
}
