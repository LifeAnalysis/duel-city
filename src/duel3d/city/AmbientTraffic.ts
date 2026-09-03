import * as THREE from "three";

import { PaletteRole } from "../art/palette";
import { type VoxelBatch, type VoxelHandle } from "../model/VoxelBatch";
import { cuboid } from "../model/VoxelModel";

interface Traveler {
  handle: VoxelHandle;
  path: THREE.Vector3[];
  offset: number;
  speed: number;
}

const CAR = [
  ...cuboid([5, 1, 3], [-2, 0, -1], PaletteRole.red),
  ...cuboid([3, 1, 3], [-1, 1, -1], PaletteRole.cream),
];

const PERSON = [
  ...cuboid([2, 3, 1], [-1, 0, 0], PaletteRole.violet),
  ...cuboid([2, 2, 2], [-1, 3, -1], PaletteRole.cream),
];

const TRAIN = [
  ...cuboid([9, 2, 3], [-4, 0, -1], PaletteRole.cyan),
  ...cuboid([7, 1, 3], [-3, 2, -1], PaletteRole.ink),
];

const roadLoop = [
  new THREE.Vector3(-17, 0.28, -4.2),
  new THREE.Vector3(17, 0.28, -4.2),
  new THREE.Vector3(17, 0.28, 4.2),
  new THREE.Vector3(-17, 0.28, 4.2),
];

const sidewalkLoop = [
  new THREE.Vector3(-9.5, 0.18, -6),
  new THREE.Vector3(9.5, 0.18, -6),
  new THREE.Vector3(9.5, 0.18, 6),
  new THREE.Vector3(-9.5, 0.18, 6),
];

const pointOnLoop = (path: THREE.Vector3[], progress: number) => {
  const scaled = progress * path.length;
  const index = Math.floor(scaled) % path.length;
  const next = (index + 1) % path.length;
  return path[index].clone().lerp(path[next], scaled - Math.floor(scaled));
};

export class AmbientTraffic {
  private elapsed = 0;
  private readonly travelers: Traveler[];

  constructor(batch: VoxelBatch) {
    this.travelers = [
      ...Array.from({ length: 4 }, (_, index) => ({
        handle: batch.add(CAR),
        path: roadLoop,
        offset: index / 4,
        speed: 0.022 + index * 0.003,
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        handle: batch.add(PERSON),
        path: sidewalkLoop,
        offset: index / 5,
        speed: 0.009 + index * 0.001,
      })),
      {
        handle: batch.add(TRAIN),
        path: roadLoop.map(
          (point) => new THREE.Vector3(point.x, 4.5, point.z * 1.9),
        ),
        offset: 0.17,
        speed: 0.014,
      },
    ];
  }

  update(delta: number) {
    this.elapsed += delta;
    this.travelers.forEach((traveler) => {
      const progress = (traveler.offset + this.elapsed * traveler.speed) % 1;
      const position = pointOnLoop(traveler.path, progress);
      const ahead = pointOnLoop(traveler.path, (progress + 0.004) % 1);
      const matrix = new THREE.Matrix4().lookAt(
        position,
        ahead,
        THREE.Object3D.DEFAULT_UP,
      );
      const rotation = new THREE.Quaternion().setFromRotationMatrix(matrix);
      traveler.handle.setMatrix(
        new THREE.Matrix4().compose(
          position,
          rotation,
          new THREE.Vector3(0.55, 0.55, 0.55),
        ),
      );
    });
  }
}
