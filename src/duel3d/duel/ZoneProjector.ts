import * as THREE from "three";

import { ygopro } from "@/api";

import type { VisualCard } from "./types";

const VISIBLE_ZONES = new Set([
  ygopro.CardZone.MZONE,
  ygopro.CardZone.SZONE,
  ygopro.CardZone.GRAVE,
  ygopro.CardZone.REMOVED,
  ygopro.CardZone.EXTRA,
]);

const selectorFor = (card: VisualCard) => {
  const zone = `[data-zone-value="${card.zone}"]`;
  const controller = `[data-controller="${card.controller}"]`;
  const sequenced = [ygopro.CardZone.MZONE, ygopro.CardZone.SZONE].includes(
    card.zone,
  );
  const sequence = sequenced ? `[data-sequence="${card.sequence}"]` : "";
  return `[data-testid="duel-zone"]${zone}${controller}${sequence}`;
};

export class ZoneProjector {
  private readonly raycaster = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.58);
  private readonly point = new THREE.Vector3();

  constructor(private readonly camera: THREE.Camera) {}

  matrixFor(card: VisualCard) {
    if (!VISIBLE_ZONES.has(card.zone)) return null;
    const element = document.querySelector<HTMLElement>(selectorFor(card));
    if (!element) return null;
    const bounds = element.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const position = this.project(centerX, centerY);
    if (!position) return null;
    position.y += card.zone === ygopro.CardZone.MZONE ? 0.18 : 0.08;
    const defense = [
      ygopro.CardPosition.FACEUP_DEFENSE,
      ygopro.CardPosition.FACEDOWN_DEFENSE,
      ygopro.CardPosition.DEFENSE,
    ].includes(card.position);
    const rotation = new THREE.Quaternion().setFromAxisAngle(
      THREE.Object3D.DEFAULT_UP,
      defense ? Math.PI / 2 : 0,
    );
    return new THREE.Matrix4().compose(
      position,
      rotation,
      new THREE.Vector3(1, 1, 1),
    );
  }

  private project(clientX: number, clientY: number) {
    const x = (clientX / window.innerWidth) * 2 - 1;
    const y = -(clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.plane, this.point);
    return hit?.clone() ?? null;
  }
}
