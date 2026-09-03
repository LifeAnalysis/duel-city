import * as THREE from "three";

import { PaletteRole } from "../art/palette";
import type { VoxelBatch, VoxelHandle } from "../model/VoxelBatch";
import { cuboid, type VoxelModel } from "../model/VoxelModel";

interface RigPart {
  anchor: THREE.Group;
  handle: VoxelHandle;
}

const strideTracks = (amount: number) => {
  const times = [0, 0.25, 0.5, 0.75, 1];
  return [
    new THREE.NumberKeyframeTrack("leftArm.rotation[x]", times, [
      amount,
      0,
      -amount,
      0,
      amount,
    ]),
    new THREE.NumberKeyframeTrack("rightArm.rotation[x]", times, [
      -amount,
      0,
      amount,
      0,
      -amount,
    ]),
    new THREE.NumberKeyframeTrack("leftLeg.rotation[x]", times, [
      -amount,
      0,
      amount,
      0,
      -amount,
    ]),
    new THREE.NumberKeyframeTrack("rightLeg.rotation[x]", times, [
      amount,
      0,
      -amount,
      0,
      amount,
    ]),
  ];
};

const PARTS: Array<{
  name: string;
  position: [number, number, number];
  model: VoxelModel;
}> = [
  {
    name: "torso",
    position: [0, 1.05, 0],
    model: cuboid([4, 5, 2], [-2, -2, -1], PaletteRole.navy),
  },
  {
    name: "head",
    position: [0, 1.95, 0],
    model: [
      ...cuboid([3, 3, 3], [-1, -1, -1], PaletteRole.cream),
      ...cuboid([3, 1, 1], [-1, 0, -2], PaletteRole.cyan),
    ],
  },
  {
    name: "leftArm",
    position: [0.58, 1.48, 0],
    model: cuboid([2, 5, 2], [-1, -4, -1], PaletteRole.pale),
  },
  {
    name: "rightArm",
    position: [-0.58, 1.48, 0],
    model: cuboid([2, 5, 2], [-1, -4, -1], PaletteRole.pale),
  },
  {
    name: "leftLeg",
    position: [0.3, 0.72, 0],
    model: cuboid([2, 5, 2], [-1, -4, -1], PaletteRole.blue),
  },
  {
    name: "rightLeg",
    position: [-0.3, 0.72, 0],
    model: cuboid([2, 5, 2], [-1, -4, -1], PaletteRole.blue),
  },
];

export class FigureRig {
  readonly model = new THREE.Group();
  readonly animations: THREE.AnimationClip[];
  private readonly parts: RigPart[];
  private readonly proxyGeometry = new THREE.BoxGeometry(1.1, 2.2, 0.8);
  private readonly proxyMaterial = new THREE.MeshBasicMaterial({
    visible: false,
  });

  constructor(batch: VoxelBatch) {
    this.model.name = "voxelDuelist";
    this.model.add(new THREE.Mesh(this.proxyGeometry, this.proxyMaterial));
    this.parts = PARTS.map((part) => {
      const anchor = new THREE.Group();
      anchor.name = part.name;
      anchor.position.set(...part.position);
      this.model.add(anchor);
      return { anchor, handle: batch.add(part.model) };
    });
    this.animations = [
      new THREE.AnimationClip("idle", 2, [
        new THREE.NumberKeyframeTrack(
          "torso.scale[y]",
          [0, 1, 2],
          [1, 1.04, 1],
        ),
      ]),
      new THREE.AnimationClip("walk", 1, strideTracks(0.58)),
      new THREE.AnimationClip("run", 0.72, strideTracks(0.82)),
      new THREE.AnimationClip("jump", 0.6, strideTracks(0.12)),
    ];
  }

  sync() {
    this.model.updateWorldMatrix(true, true);
    this.parts.forEach(({ anchor, handle }) =>
      handle.setMatrix(anchor.matrixWorld),
    );
  }

  dispose() {
    this.parts.forEach(({ handle }) => handle.setVisible(false));
    this.proxyGeometry.dispose();
    this.proxyMaterial.dispose();
  }
}
