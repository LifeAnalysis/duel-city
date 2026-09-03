import * as THREE from "three";

import { PALETTE } from "./palette";

export interface ToonMaterialSet {
  materials: THREE.MeshToonMaterial[];
  dispose: () => void;
}

const createGradient = () => {
  const data = new Uint8Array([72, 72, 72, 176, 176, 176, 255, 255, 255]);
  const texture = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
};

export const createToonMaterials = (): ToonMaterialSet => {
  const gradient = createGradient();
  const materials = PALETTE.map(
    (color, index) =>
      new THREE.MeshToonMaterial({
        color,
        gradientMap: gradient,
        emissive: color,
        emissiveIntensity: index === 6 || index === 8 ? 0.35 : 0.06,
      }),
  );
  return {
    materials,
    dispose: () => {
      materials.forEach((material) => material.dispose());
      gradient.dispose();
    },
  };
};
