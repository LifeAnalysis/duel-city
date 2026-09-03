import * as THREE from "three";

import { PALETTE, VOXEL_SCALE } from "../art/palette";
import {
  createToonMaterials,
  type ToonMaterialSet,
} from "../art/toonMaterials";
import type { VoxelModel } from "./VoxelModel";

export interface VoxelHandle {
  setMatrix: (matrix: THREE.Matrix4) => void;
  setVisible: (visible: boolean) => void;
}

interface InstanceRef {
  color: number;
  slot: number;
  local: THREE.Matrix4;
}

const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

export class VoxelBatch {
  readonly root = new THREE.Group();
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly toon: ToonMaterialSet = createToonMaterials();
  private readonly meshes: THREE.InstancedMesh[];
  private readonly nextSlots: number[];
  private readonly scratch = new THREE.Matrix4();

  constructor(private readonly capacityPerColor = 4096) {
    this.meshes = this.toon.materials.map((material) => {
      const mesh = new THREE.InstancedMesh(
        this.geometry,
        material,
        capacityPerColor,
      );
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.root.add(mesh);
      return mesh;
    });
    this.nextSlots = PALETTE.map(() => 0);
  }

  add(model: VoxelModel, matrix = new THREE.Matrix4()): VoxelHandle {
    const refs = model.map((voxel) => this.allocate(voxel, matrix));
    const current = matrix.clone();
    return {
      setMatrix: (next) => {
        current.copy(next);
        this.update(refs, current);
      },
      setVisible: (visible) => this.setVisible(refs, current, visible),
    };
  }

  addBox(
    position: THREE.Vector3,
    scale: THREE.Vector3,
    color: number,
    rotationY = 0,
  ) {
    const matrix = new THREE.Matrix4().compose(
      position,
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        rotationY,
      ),
      scale,
    );
    const slot = this.reserve(color);
    this.meshes[color].setMatrixAt(slot, matrix);
    this.touch(color);
  }

  dispose() {
    this.geometry.dispose();
    this.toon.dispose();
    this.root.remove(...this.meshes);
  }

  setNightBlend(value: number) {
    this.toon.materials.forEach((material, index) => {
      const isWindow = index === 6 || index === 8;
      material.emissiveIntensity = isWindow ? 0.25 + value * 1.8 : 0.06;
    });
  }

  private allocate(
    [x, y, z, color]: VoxelModel[number],
    matrix: THREE.Matrix4,
  ): InstanceRef {
    const slot = this.reserve(color);
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(x * VOXEL_SCALE, y * VOXEL_SCALE, z * VOXEL_SCALE),
      new THREE.Quaternion(),
      new THREE.Vector3(VOXEL_SCALE, VOXEL_SCALE, VOXEL_SCALE),
    );
    this.meshes[color].setMatrixAt(
      slot,
      this.scratch.multiplyMatrices(matrix, local),
    );
    this.touch(color);
    return { color, slot, local };
  }

  private reserve(color: number) {
    if (!Number.isInteger(color) || color < 0 || color >= this.meshes.length) {
      throw new Error(`Invalid palette index ${color}`);
    }
    const slot = this.nextSlots[color];
    if (slot >= this.capacityPerColor) {
      throw new Error(`Voxel palette ${color} capacity exceeded`);
    }
    this.nextSlots[color] += 1;
    this.meshes[color].count = this.nextSlots[color];
    return slot;
  }

  private update(refs: InstanceRef[], matrix: THREE.Matrix4) {
    const touched = new Set<number>();
    refs.forEach((ref) => {
      this.meshes[ref.color].setMatrixAt(
        ref.slot,
        this.scratch.multiplyMatrices(matrix, ref.local),
      );
      touched.add(ref.color);
    });
    touched.forEach((color) => this.touch(color));
  }

  private setVisible(
    refs: InstanceRef[],
    matrix: THREE.Matrix4,
    visible: boolean,
  ) {
    const touched = new Set<number>();
    refs.forEach((ref) => {
      this.meshes[ref.color].setMatrixAt(
        ref.slot,
        visible
          ? this.scratch.multiplyMatrices(matrix, ref.local)
          : hiddenMatrix,
      );
      touched.add(ref.color);
    });
    touched.forEach((color) => this.touch(color));
  }

  private touch(color: number) {
    this.meshes[color].instanceMatrix.needsUpdate = true;
  }
}
