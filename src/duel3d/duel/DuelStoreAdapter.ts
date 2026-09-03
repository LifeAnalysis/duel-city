import { subscribe } from "valtio";

import { ygopro } from "@/api";
import { eventbus, Task } from "@/infra/eventbus";
import { cardStore, HistoryOp, historyStore, matStore } from "@/stores";

import type { DuelVisualListener, DuelVisualState, VisualCard } from "./types";

interface TaskPayload {
  args?: unknown[];
}

const readCards = (): VisualCard[] =>
  cardStore.inner.map((card) => ({
    uuid: card.uuid,
    code: card.code,
    controller: card.location.controller,
    zone: card.location.zone,
    sequence: card.location.sequence,
    position: card.location.position,
    type: card.meta.data.type ?? 0,
    level: card.meta.data.level ?? 0,
    attribute: card.meta.data.attribute ?? 0,
    race: card.meta.data.race ?? 0,
  }));

const readState = (): DuelVisualState => ({
  cards: readCards(),
  meLife: matStore.initInfo.me.life,
  opLife: matStore.initInfo.op.life,
  turn: matStore.turnCount,
  currentPlayer: matStore.currentPlayer,
  phase: matStore.phase.currentPhase,
  chainCount: matStore.chains.length,
});

const sameLocation = (left: VisualCard, right: VisualCard) =>
  left.controller === right.controller &&
  left.zone === right.zone &&
  left.sequence === right.sequence;

export class DuelStoreAdapter {
  private state = readState();
  private historyLength = historyStore.historys.length;
  private readonly unsubscribers: Array<() => void> = [];

  constructor(private readonly listener: DuelVisualListener) {}

  start() {
    this.safeEmit({ kind: "state", state: this.state });
    this.unsubscribers.push(
      subscribe(cardStore, this.syncState, true),
      subscribe(matStore, this.syncState, true),
      subscribe(historyStore, this.syncHistory, true),
    );
    eventbus.on(Task.Move, this.onMove);
    eventbus.on(Task.Attack, this.onAttack);
    eventbus.on(Task.Focus, this.onFocus);
  }

  dispose() {
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    eventbus.off(Task.Move, this.onMove);
    eventbus.off(Task.Attack, this.onAttack);
    eventbus.off(Task.Focus, this.onFocus);
  }

  private readonly syncState = () => {
    const previous = this.state;
    const next = readState();
    this.emitCardChanges(previous.cards, next.cards);
    this.emitMatChanges(previous, next);
    this.state = next;
    this.safeEmit({ kind: "state", state: next });
  };

  private emitCardChanges(previous: VisualCard[], next: VisualCard[]) {
    const before = new Map(previous.map((card) => [card.uuid, card]));
    next.forEach((card) => {
      const old = before.get(card.uuid);
      if (!old) return;
      if (!sameLocation(old, card) && card.zone === ygopro.CardZone.GRAVE) {
        this.safeEmit({ kind: "grave", uuid: card.uuid });
      }
      if (
        !sameLocation(old, card) &&
        old.zone === ygopro.CardZone.DECK &&
        card.zone === ygopro.CardZone.HAND
      ) {
        this.safeEmit({ kind: "draw", uuid: card.uuid });
      }
      if (old.position !== card.position) {
        this.safeEmit({ kind: "position", uuid: card.uuid });
      }
    });
  }

  private emitMatChanges(previous: DuelVisualState, next: DuelVisualState) {
    if (previous.meLife !== next.meLife) {
      this.safeEmit({
        kind: "lp",
        side: "me",
        amount: next.meLife - previous.meLife,
      });
    }
    if (previous.opLife !== next.opLife) {
      this.safeEmit({
        kind: "lp",
        side: "op",
        amount: next.opLife - previous.opLife,
      });
    }
    if (
      previous.turn !== next.turn ||
      previous.currentPlayer !== next.currentPlayer
    ) {
      this.safeEmit({
        kind: "turn",
        turn: next.turn,
        player: next.currentPlayer,
      });
    }
    if (previous.phase !== next.phase)
      this.safeEmit({ kind: "phase", phase: next.phase });
    if (previous.chainCount !== next.chainCount) {
      this.safeEmit({ kind: "chain", count: next.chainCount });
    }
  }

  private readonly syncHistory = () => {
    const entries = historyStore.historys.slice(this.historyLength);
    this.historyLength = historyStore.historys.length;
    entries.forEach((entry) => {
      if (
        [HistoryOp.SUMMON, HistoryOp.SP_SUMMON, HistoryOp.FLIP_SUMMON].includes(
          entry.operation,
        )
      ) {
        this.safeEmit({ kind: "summon", code: entry.card });
      }
      if (entry.operation === HistoryOp.SET)
        this.safeEmit({ kind: "set", code: entry.card });
    });
  };

  private readonly onMove = (payload: TaskPayload) => {
    const uuid = payload.args?.[0];
    if (typeof uuid === "string") this.safeEmit({ kind: "move", uuid });
  };

  private readonly onAttack = (payload: TaskPayload) => {
    const uuid = payload.args?.[0];
    const options = payload.args?.[1] as
      | { directAttack?: boolean; target?: ygopro.CardLocation }
      | undefined;
    if (typeof uuid === "string") {
      this.safeEmit({ kind: "attack", uuid, target: options?.target });
    }
  };

  private readonly onFocus = (payload: TaskPayload) => {
    const uuid = payload.args?.[0];
    if (typeof uuid === "string") this.safeEmit({ kind: "focus", uuid });
  };

  private safeEmit(event: Parameters<DuelVisualListener>[0]) {
    try {
      this.listener(event);
    } catch (_error) {
      return;
    }
  }
}
