import type { ygopro } from "@/api";

export interface VisualCard {
  uuid: string;
  code: number;
  controller: number;
  zone: ygopro.CardZone;
  sequence: number;
  position: ygopro.CardPosition;
  type: number;
  level: number;
  attribute: number;
  race: number;
}

export interface DuelVisualState {
  cards: VisualCard[];
  meLife: number;
  opLife: number;
  turn: number;
  currentPlayer: number;
  phase: number;
  chainCount: number;
}

export type DuelVisualEvent =
  | { kind: "state"; state: DuelVisualState }
  | { kind: "move"; uuid: string }
  | { kind: "attack"; uuid: string; target?: ygopro.CardLocation }
  | { kind: "focus"; uuid: string }
  | { kind: "summon"; code: number }
  | { kind: "set"; code: number }
  | { kind: "grave"; uuid: string }
  | { kind: "draw"; uuid: string }
  | { kind: "position"; uuid: string }
  | { kind: "lp"; side: "me" | "op"; amount: number }
  | { kind: "turn"; turn: number; player: number }
  | { kind: "phase"; phase: number }
  | { kind: "chain"; count: number };

export type DuelVisualListener = (event: DuelVisualEvent) => void;
