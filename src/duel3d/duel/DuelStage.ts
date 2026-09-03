import * as THREE from "three";

import { ygopro } from "@/api";
import { TYPE_MONSTER } from "@/common";

import { cardSlabModel, monsterModel } from "../model/monsterModels";
import type { VoxelBatch, VoxelHandle } from "../model/VoxelBatch";
import type { VoxelModel } from "../model/VoxelModel";
import type { DuelVisualState, VisualCard } from "./types";
import { ZoneProjector } from "./ZoneProjector";

interface StageCard {
  handle: VoxelHandle;
  base: THREE.Matrix4;
  card: VisualCard;
  attackAge: number | null;
}

const stageModel = (card: VisualCard): VoxelModel => {
  const slab = cardSlabModel(card.type, card.attribute, card.race);
  const monster =
    (card.type & TYPE_MONSTER) > 0 && card.zone === ygopro.CardZone.MZONE;
  return monster ? [...slab, ...monsterModel(card.code)] : slab;
};

export class DuelStage {
  private readonly cards = new Map<string, StageCard>();
  private readonly projector: ZoneProjector;
  private state: DuelVisualState | null = null;

  constructor(
    private readonly batch: VoxelBatch,
    camera: THREE.Camera,
  ) {
    this.projector = new ZoneProjector(camera);
  }

  reconcile(state: DuelVisualState) {
    this.state = state;
    const active = new Set(state.cards.map((card) => card.uuid));
    this.cards.forEach((item, uuid) => {
      if (!active.has(uuid)) item.handle.setVisible(false);
    });
    state.cards.forEach((card) => this.reconcileCard(card));
  }

  refreshProjection() {
    if (this.state) this.reconcile(this.state);
  }

  attack(uuid: string) {
    const card = this.cards.get(uuid);
    if (card) card.attackAge = 0;
  }

  update(delta: number) {
    this.cards.forEach((item) => {
      if (item.attackAge === null) return;
      item.attackAge += delta;
      const progress = Math.min(1, item.attackAge / 0.5);
      const lunge = Math.sin(progress * Math.PI) * 1.15;
      const direction = item.card.controller % 2 === 0 ? -1 : 1;
      const offset = new THREE.Matrix4().makeTranslation(
        0,
        0.25,
        direction * lunge,
      );
      item.handle.setMatrix(offset.multiply(item.base));
      if (progress >= 1) {
        item.attackAge = null;
        item.handle.setMatrix(item.base);
      }
    });
  }

  positionForUuid(uuid: string) {
    const item = this.cards.get(uuid);
    return item ? new THREE.Vector3().setFromMatrixPosition(item.base) : null;
  }

  positionForCode(code: number) {
    const item = [...this.cards.values()].find(
      (candidate) => candidate.card.code === code,
    );
    return item ? new THREE.Vector3().setFromMatrixPosition(item.base) : null;
  }

  private reconcileCard(card: VisualCard) {
    const matrix = this.projector.matrixFor(card);
    const existing = this.cards.get(card.uuid);
    if (!matrix) {
      existing?.handle.setVisible(false);
      return;
    }
    if (existing) {
      existing.base.copy(matrix);
      existing.card = card;
      existing.handle.setVisible(true);
      existing.handle.setMatrix(matrix);
      return;
    }
    const handle = this.batch.add(stageModel(card), matrix);
    this.cards.set(card.uuid, {
      handle,
      base: matrix.clone(),
      card,
      attackAge: null,
    });
  }
}
