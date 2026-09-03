import * as THREE from "three";

import type { VoxelBatch } from "../model/VoxelBatch";

const DAY = new THREE.Color(0x7299b5);
const DUSK = new THREE.Color(0x1a2340);
const NIGHT = new THREE.Color(0x070b17);
const FOG_DAY = new THREE.Color(0x708598);
const FOG_NIGHT = new THREE.Color(0x090d19);

export class DayNightController {
  private elapsed = 58;
  private speed = 1;
  private lightsEnabled = true;
  private readonly color = new THREE.Color();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly light: THREE.DirectionalLight,
    private readonly batch: VoxelBatch,
  ) {}

  update(delta: number) {
    this.elapsed = (this.elapsed + delta * this.speed) % 240;
    const phase = this.elapsed / 240;
    const sun = Math.sin(phase * Math.PI * 2);
    const daylight = THREE.MathUtils.smoothstep(sun, -0.22, 0.72);
    const dusk = 1 - Math.abs(daylight * 2 - 1);
    this.color
      .copy(NIGHT)
      .lerp(DUSK, dusk)
      .lerp(DAY, daylight * 0.82);
    this.scene.background = this.color;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(FOG_NIGHT).lerp(FOG_DAY, daylight);
    }
    const angle = phase * Math.PI * 2;
    this.light.position.set(
      Math.cos(angle) * 24,
      8 + daylight * 26,
      Math.sin(angle) * 18,
    );
    this.light.intensity = 0.55 + daylight * 3.15;
    this.light.color.set(daylight > 0.35 ? 0xffe1b5 : 0x8aa8ff);
    this.batch.setNightBlend(this.lightsEnabled ? 1 - daylight : 0);
  }

  setSpeed(speed: number) {
    this.speed = Math.max(0, speed);
  }

  setLights(enabled: boolean) {
    this.lightsEnabled = enabled;
  }

  getState() {
    return { speed: this.speed, lights: this.lightsEnabled };
  }
}
