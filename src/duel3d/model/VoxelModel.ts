import { PALETTE, type PaletteIndex } from "../art/palette";

export type Voxel = [number, number, number, PaletteIndex];
export type VoxelModel = Voxel[];

export const isVoxelModel = (value: unknown): value is VoxelModel =>
  Array.isArray(value) &&
  value.every(
    (voxel) =>
      Array.isArray(voxel) &&
      voxel.length === 4 &&
      voxel.every(Number.isFinite) &&
      Number.isInteger(voxel[3]) &&
      voxel[3] >= 0 &&
      voxel[3] < PALETTE.length,
  );

export const cuboid = (
  size: [number, number, number],
  offset: [number, number, number],
  color: PaletteIndex,
): VoxelModel => {
  const voxels: VoxelModel = [];
  for (let x = 0; x < size[0]; x += 1) {
    for (let y = 0; y < size[1]; y += 1) {
      for (let z = 0; z < size[2]; z += 1) {
        voxels.push([x + offset[0], y + offset[1], z + offset[2], color]);
      }
    }
  }
  return voxels;
};
