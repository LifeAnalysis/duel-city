import * as THREE from "three";

import { PaletteRole } from "../art/palette";
import type { VoxelBatch, VoxelHandle } from "../model/VoxelBatch";
import { cuboid } from "../model/VoxelModel";

export interface TableControlStatus {
  key: "time" | "lights" | "replay" | null;
  label: string;
}

const CONTROL_POINTS = {
  time: new THREE.Vector3(-4, 0.72, 13.4),
  lights: new THREE.Vector3(0, 0.72, 13.4),
  replay: new THREE.Vector3(4, 0.72, 13.4),
};

const BASE = cuboid([7, 2, 5], [-3, 0, -2], PaletteRole.ink);
const LEVER = [...BASE, ...cuboid([1, 5, 1], [0, 2, 0], PaletteRole.amber)];
const SWITCH = [...BASE, ...cuboid([3, 2, 2], [-1, 2, -1], PaletteRole.cyan)];
const BUTTON = [...BASE, ...cuboid([4, 1, 3], [-2, 2, -1], PaletteRole.red)];

const place = (handle: VoxelHandle, position: THREE.Vector3) => {
  handle.setMatrix(
    new THREE.Matrix4().makeTranslation(position.x, position.y, position.z),
  );
};

export class TableControls {
  private readonly lever: VoxelHandle;
  private readonly lightSwitch: VoxelHandle;
  private readonly replayButton: VoxelHandle;
  private readonly speeds = [0, 1, 4];
  private speedIndex = 1;
  private lights = true;

  constructor(
    batch: VoxelBatch,
    private readonly onTimeSpeed: (speed: number) => void,
    private readonly onLights: (enabled: boolean) => void,
    private readonly onReplay: () => void,
  ) {
    this.lever = batch.add(LEVER);
    this.lightSwitch = batch.add(SWITCH);
    this.replayButton = batch.add(BUTTON);
    place(this.lever, CONTROL_POINTS.time);
    place(this.lightSwitch, CONTROL_POINTS.lights);
    place(this.replayButton, CONTROL_POINTS.replay);
  }

  nearest(position: THREE.Vector3): TableControlStatus {
    let nearest: keyof typeof CONTROL_POINTS | null = null;
    let distance = 2.4;
    Object.entries(CONTROL_POINTS).forEach(([key, point]) => {
      const candidate = point.distanceTo(position);
      if (candidate < distance) {
        nearest = key as keyof typeof CONTROL_POINTS;
        distance = candidate;
      }
    });
    if (nearest === "time") {
      return {
        key: nearest,
        label: `E · TIME ${this.speeds[this.speedIndex]}×`,
      };
    }
    if (nearest === "lights") {
      return {
        key: nearest,
        label: `E · LIGHTS ${this.lights ? "ON" : "OFF"}`,
      };
    }
    if (nearest === "replay") {
      return { key: nearest, label: "E · WATCH DEMO REPLAY" };
    }
    return { key: null, label: "FIND THE TABLE-EDGE CONTROLS" };
  }

  interact(key: TableControlStatus["key"]) {
    if (key === "time") {
      this.speedIndex = (this.speedIndex + 1) % this.speeds.length;
      this.onTimeSpeed(this.speeds[this.speedIndex]);
    }
    if (key === "lights") {
      this.lights = !this.lights;
      this.onLights(this.lights);
    }
    if (key === "replay") this.onReplay();
  }
}
