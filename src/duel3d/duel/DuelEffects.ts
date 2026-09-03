import * as THREE from "three";

import { PaletteRole } from "../art/palette";
import type { VoxelBatch, VoxelHandle } from "../model/VoxelBatch";
import { cuboid, type VoxelModel } from "../model/VoxelModel";

interface Particle {
  handle: VoxelHandle;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  life: number;
}

interface FloatModel {
  handle: VoxelHandle;
  position: THREE.Vector3;
  age: number;
}

const DIGITS = [
  "111101101101111",
  "010110010010111",
  "111001111100111",
  "111001111001111",
  "101101111001001",
  "111100111001111",
  "111100111101111",
  "111001001001001",
  "111101111101111",
  "111101111001111",
];

const numberModel = (amount: number): VoxelModel => {
  const text = `${amount > 0 ? "+" : "-"}${Math.abs(amount)}`;
  const color = amount > 0 ? PaletteRole.green : PaletteRole.red;
  const voxels: VoxelModel = [];
  let cursor = 0;
  for (const character of text) {
    if (character === "+" || character === "-") {
      voxels.push([cursor, 2, 0, color]);
      if (character === "+")
        voxels.push([cursor, 1, 0, color], [cursor, 3, 0, color]);
      cursor += 2;
      continue;
    }
    const bitmap = DIGITS[Number(character)];
    for (let index = 0; index < bitmap.length; index += 1) {
      if (bitmap[index] === "1") {
        voxels.push([
          cursor + (index % 3),
          4 - Math.floor(index / 3),
          0,
          color,
        ]);
      }
    }
    cursor += 4;
  }
  return voxels;
};

export class DuelEffects {
  private readonly particles: Particle[] = [];
  private readonly numbers: FloatModel[] = [];

  constructor(private readonly batch: VoxelBatch) {}

  summon(position: THREE.Vector3) {
    for (let index = 0; index < 14; index += 1) {
      const angle = (index / 14) * Math.PI * 2;
      this.spawnParticle(
        position
          .clone()
          .add(
            new THREE.Vector3(
              Math.cos(angle) * 0.4,
              0.1,
              Math.sin(angle) * 0.4,
            ),
          ),
        new THREE.Vector3(Math.cos(angle) * 0.7, 1.3, Math.sin(angle) * 0.7),
        PaletteRole.cyan,
        0.75,
      );
    }
  }

  grave(position: THREE.Vector3) {
    for (let index = 0; index < 12; index += 1) {
      const angle = index * 2.399963;
      this.spawnParticle(
        position.clone(),
        new THREE.Vector3(
          Math.cos(angle),
          0.5 + (index % 4) * 0.22,
          Math.sin(angle),
        ).multiplyScalar(0.75),
        index % 2 ? PaletteRole.violet : PaletteRole.steel,
        0.9,
      );
    }
  }

  attack(position: THREE.Vector3) {
    for (let index = 0; index < 10; index += 1) {
      const angle = (index / 10) * Math.PI * 2;
      this.spawnParticle(
        position.clone(),
        new THREE.Vector3(Math.cos(angle) * 1.7, 0.2, Math.sin(angle) * 1.7),
        PaletteRole.amber,
        0.38,
      );
    }
  }

  life(side: "me" | "op", amount: number) {
    if (!amount) return;
    const position = new THREE.Vector3(
      side === "me" ? -5.8 : 5.8,
      3.2,
      side === "me" ? 5.5 : -5.5,
    );
    this.numbers.push({
      handle: this.batch.add(numberModel(amount)),
      position,
      age: 0,
    });
  }

  update(delta: number) {
    this.updateParticles(delta);
    this.updateNumbers(delta);
  }

  private spawnParticle(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    color: number,
    life: number,
  ) {
    const handle = this.batch.add(cuboid([1, 1, 1], [0, 0, 0], color));
    this.particles.push({ handle, position, velocity, age: 0, life });
  }

  private updateParticles(delta: number) {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.age += delta;
      particle.position.addScaledVector(particle.velocity, delta);
      particle.velocity.y -= delta * 2.5;
      const scale = Math.max(0, 1 - particle.age / particle.life);
      particle.handle.setMatrix(
        new THREE.Matrix4().compose(
          particle.position,
          new THREE.Quaternion(),
          new THREE.Vector3(scale, scale, scale),
        ),
      );
      if (particle.age >= particle.life) {
        particle.handle.setVisible(false);
        this.particles.splice(index, 1);
      }
    }
  }

  private updateNumbers(delta: number) {
    for (let index = this.numbers.length - 1; index >= 0; index -= 1) {
      const number = this.numbers[index];
      number.age += delta;
      number.position.y += delta * 0.72;
      const scale = Math.max(0, 1 - number.age / 1.5);
      number.handle.setMatrix(
        new THREE.Matrix4().compose(
          number.position,
          new THREE.Quaternion(),
          new THREE.Vector3(scale, scale, scale),
        ),
      );
      if (number.age >= 1.5) {
        number.handle.setVisible(false);
        this.numbers.splice(index, 1);
      }
    }
  }
}
