export const VOXEL_SCALE = 0.22;

export const PALETTE = [
  0x0b1020, 0x171e33, 0x2d3651, 0x53617c, 0x96a4b7, 0xe5edf2, 0x4ee8e8,
  0x138ca4, 0xffb84f, 0xe97542, 0xef476f, 0x9b5de5, 0x2ec27e, 0x70d65c,
  0x4676c7, 0x213f74, 0x8f5f3d, 0x4c2f26, 0xb8d85c, 0xf4f0d7,
] as const;

export type PaletteIndex = number;

export const PaletteRole = {
  void: 0,
  ink: 1,
  asphalt: 2,
  steel: 3,
  pale: 4,
  white: 5,
  cyan: 6,
  teal: 7,
  amber: 8,
  orange: 9,
  red: 10,
  violet: 11,
  green: 12,
  leaf: 13,
  blue: 14,
  navy: 15,
  wood: 16,
  darkWood: 17,
  lime: 18,
  cream: 19,
} as const;
