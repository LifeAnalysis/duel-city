import * as THREE from "three";

import { PaletteRole } from "../art/palette";
import type { VoxelBatch } from "../model/VoxelBatch";
import { seededRandom } from "./seededRandom";

export interface CityAsset {
  collisions: THREE.Group;
  windowMaterials: THREE.MeshToonMaterial[];
}

const BUILDING_COLORS = [
  PaletteRole.navy,
  PaletteRole.blue,
  PaletteRole.violet,
  PaletteRole.orange,
  PaletteRole.teal,
] as const;

const collisionMaterial = new THREE.MeshBasicMaterial({
  colorWrite: false,
  depthWrite: false,
});

const addCollision = (
  group: THREE.Group,
  position: THREE.Vector3,
  size: THREE.Vector3,
) => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    collisionMaterial,
  );
  mesh.position.copy(position);
  mesh.scale.copy(size);
  group.add(mesh);
};

const addBuilding = (
  batch: VoxelBatch,
  collisions: THREE.Group,
  x: number,
  z: number,
  index: number,
  random: ReturnType<typeof seededRandom>,
) => {
  const width = random.int(2, 4) * 0.72;
  const depth = random.int(2, 4) * 0.72;
  const height = random.int(5, 13) * 0.42;
  const y = 0.46 + height / 2;
  const color = random.pick(BUILDING_COLORS);
  batch.addBox(
    new THREE.Vector3(x, y, z),
    new THREE.Vector3(width, height, depth),
    color,
  );
  batch.addBox(
    new THREE.Vector3(x, 0.5 + height, z),
    new THREE.Vector3(width * 0.72, 0.18, depth * 0.72),
    index % 3 === 0 ? PaletteRole.cyan : PaletteRole.steel,
  );
  const windowColor = index % 4 === 0 ? PaletteRole.cyan : PaletteRole.amber;
  for (let floor = 0.9; floor < height; floor += 0.72) {
    batch.addBox(
      new THREE.Vector3(x, floor, z + depth / 2 + 0.015),
      new THREE.Vector3(width * 0.58, 0.12, 0.04),
      windowColor,
    );
  }
  addCollision(
    collisions,
    new THREE.Vector3(x, y, z),
    new THREE.Vector3(width, height, depth),
  );
};

const addStage = (batch: VoxelBatch) => {
  batch.addBox(
    new THREE.Vector3(0, 0.26, 0),
    new THREE.Vector3(14.8, 0.42, 8.8),
    PaletteRole.ink,
  );
  batch.addBox(
    new THREE.Vector3(0, 0.49, 0),
    new THREE.Vector3(13.8, 0.05, 7.8),
    PaletteRole.asphalt,
  );
  for (let side = -1; side <= 1; side += 2) {
    for (let lane = -2; lane <= 2; lane += 1) {
      batch.addBox(
        new THREE.Vector3(lane * 2.15, 0.54, side * 1.72),
        new THREE.Vector3(1.72, 0.05, 1.18),
        lane === 0 ? PaletteRole.violet : PaletteRole.teal,
      );
    }
  }
  batch.addBox(
    new THREE.Vector3(0, 0.54, 0),
    new THREE.Vector3(2.1, 0.05, 1.25),
    PaletteRole.cyan,
  );
};

const addHarbor = (batch: VoxelBatch) => {
  batch.addBox(
    new THREE.Vector3(0, 0.12, -15.6),
    new THREE.Vector3(19, 0.18, 4.8),
    PaletteRole.blue,
  );
  for (let boat = -1; boat <= 1; boat += 1) {
    batch.addBox(
      new THREE.Vector3(boat * 4.8, 0.38, -15.5 + Math.abs(boat) * 0.5),
      new THREE.Vector3(2.1, 0.35, 0.72),
      boat === 0 ? PaletteRole.red : PaletteRole.cream,
      boat * 0.15,
    );
  }
};

const addParkAndShop = (batch: VoxelBatch) => {
  batch.addBox(
    new THREE.Vector3(-13.8, 0.23, 2.8),
    new THREE.Vector3(5.2, 0.18, 6.2),
    PaletteRole.green,
  );
  for (let index = 0; index < 7; index += 1) {
    const x = -15.4 + (index % 3) * 1.5;
    const z = 1 + Math.floor(index / 3) * 1.8;
    batch.addBox(
      new THREE.Vector3(x, 0.78, z),
      new THREE.Vector3(0.28, 1.1, 0.28),
      PaletteRole.wood,
    );
    batch.addBox(
      new THREE.Vector3(x, 1.58, z),
      new THREE.Vector3(1.05, 0.9, 1.05),
      PaletteRole.leaf,
    );
  }
  batch.addBox(
    new THREE.Vector3(13.9, 1.45, 1.8),
    new THREE.Vector3(4.5, 2.8, 4.2),
    PaletteRole.violet,
  );
  batch.addBox(
    new THREE.Vector3(13.9, 2.9, -0.34),
    new THREE.Vector3(3.7, 0.55, 0.12),
    PaletteRole.cyan,
  );
  for (let index = 0; index < 4; index += 1) {
    batch.addBox(
      new THREE.Vector3(12.65 + index * 0.82, 2.9, -0.42),
      new THREE.Vector3(0.45, 0.22, 0.08),
      index % 2 ? PaletteRole.cream : PaletteRole.cyan,
    );
  }
};

const addMonorail = (batch: VoxelBatch) => {
  const radiusX = 18.5;
  const radiusZ = 11.4;
  for (let index = 0; index < 48; index += 1) {
    const angle = (index / 48) * Math.PI * 2;
    const x = Math.cos(angle) * radiusX;
    const z = Math.sin(angle) * radiusZ;
    batch.addBox(
      new THREE.Vector3(x, 4.4, z),
      new THREE.Vector3(0.48, 0.18, 0.48),
      PaletteRole.steel,
      -angle,
    );
    if (index % 4 === 0) {
      batch.addBox(
        new THREE.Vector3(x, 2.25, z),
        new THREE.Vector3(0.18, 4.3, 0.18),
        PaletteRole.ink,
      );
    }
  }
};

const isReservedBlock = (x: number, z: number) => {
  const quiet = Math.abs(x) < 9 && Math.abs(z) < 6;
  const cameraLane = Math.abs(x) < 7 && z > 7;
  const landmark = x < -10 && z > -1 && z < 7;
  const shop = x > 10 && z > -2 && z < 6;
  return quiet || cameraLane || landmark || shop;
};

const addBuildingGrid = (
  batch: VoxelBatch,
  collisions: THREE.Group,
  random: ReturnType<typeof seededRandom>,
) => {
  let buildingIndex = 0;
  for (let row = -3; row <= 3; row += 1) {
    for (let column = -4; column <= 4; column += 1) {
      const x = column * 4.1;
      const z = row * 3.8;
      if (isReservedBlock(x, z) || random.float() < 0.22) continue;
      addBuilding(batch, collisions, x, z, buildingIndex, random);
      buildingIndex += 1;
    }
  }
};

export const generateCity = (batch: VoxelBatch, seed = 0x5eed): CityAsset => {
  const random = seededRandom(seed);
  const collisions = new THREE.Group();
  batch.addBox(
    new THREE.Vector3(0, -0.28, 0),
    new THREE.Vector3(42, 0.6, 34),
    PaletteRole.darkWood,
  );
  batch.addBox(
    new THREE.Vector3(0, 0.04, 0),
    new THREE.Vector3(40, 0.08, 32),
    PaletteRole.wood,
  );
  batch.addBox(
    new THREE.Vector3(0, 0.12, 0),
    new THREE.Vector3(8, 0.08, 31),
    PaletteRole.asphalt,
  );
  batch.addBox(
    new THREE.Vector3(0, 0.13, 0),
    new THREE.Vector3(39, 0.08, 5.8),
    PaletteRole.asphalt,
  );
  addStage(batch);
  addHarbor(batch);
  addParkAndShop(batch);
  addMonorail(batch);
  addBuildingGrid(batch, collisions, random);
  addCollision(
    collisions,
    new THREE.Vector3(0, -0.3, 0),
    new THREE.Vector3(40, 0.6, 32),
  );
  return { collisions, windowMaterials: [] };
};
