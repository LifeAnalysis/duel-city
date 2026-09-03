import { TYPE_MONSTER, TYPE_SPELL, TYPE_TRAP } from "@/common";

import { PaletteRole } from "../art/palette";
import mappedModels from "./monsters.json";
import { cuboid, type VoxelModel } from "./VoxelModel";

const CREATURES: VoxelModel[] = [
  [
    ...cuboid([4, 3, 3], [-2, 1, -1], PaletteRole.orange),
    ...cuboid([2, 4, 2], [-1, 4, -1], PaletteRole.cream),
    ...cuboid([8, 1, 2], [-4, 3, -1], PaletteRole.red),
  ],
  [
    ...cuboid([5, 5, 2], [-2, 1, -1], PaletteRole.violet),
    ...cuboid([3, 2, 4], [-1, 6, -2], PaletteRole.cyan),
    ...cuboid([1, 6, 1], [-4, 2, 0], PaletteRole.pale),
    ...cuboid([1, 6, 1], [3, 2, 0], PaletteRole.pale),
  ],
  [
    ...cuboid([6, 3, 4], [-3, 1, -2], PaletteRole.green),
    ...cuboid([3, 3, 3], [1, 4, -1], PaletteRole.lime),
    ...cuboid([2, 2, 6], [-4, 1, -3], PaletteRole.navy),
  ],
  [
    ...cuboid([4, 6, 4], [-2, 1, -2], PaletteRole.blue),
    ...cuboid([6, 2, 2], [-3, 7, -1], PaletteRole.cyan),
    ...cuboid([2, 2, 6], [-1, 3, -5], PaletteRole.steel),
  ],
];

const modelMap = mappedModels as Record<string, VoxelModel>;

const slabColor = (type: number) => {
  if ((type & TYPE_MONSTER) > 0) return PaletteRole.orange;
  if ((type & TYPE_SPELL) > 0) return PaletteRole.teal;
  if ((type & TYPE_TRAP) > 0) return PaletteRole.violet;
  return PaletteRole.steel;
};

export const cardSlabModel = (
  type: number,
  attribute: number,
  race: number,
): VoxelModel => {
  const glyphColor = 6 + (Math.abs(attribute * 3 + race) % 9);
  return [
    ...cuboid([7, 1, 5], [-3, 0, -2], slabColor(type)),
    ...cuboid([3, 1, 1], [-1, 1, 0], glyphColor),
    ...cuboid([1, 1, 3], [0, 1, -1], glyphColor),
  ];
};

export const monsterModel = (code: number): VoxelModel => {
  const mapped = modelMap[String(code)];
  if (mapped) return mapped;
  const seed = Math.imul(code || 1, 2654435761) >>> 0;
  return CREATURES[seed % CREATURES.length];
};
