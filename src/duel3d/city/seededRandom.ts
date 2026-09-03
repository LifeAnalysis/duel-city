export interface SeededRandom {
  float: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(values: readonly T[]) => T;
}

export const seededRandom = (seed: number): SeededRandom => {
  let state = seed >>> 0;
  const float = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  return {
    float,
    int: (min, max) => Math.floor(float() * (max - min + 1)) + min,
    pick: <T>(values: readonly T[]) =>
      values[Math.floor(float() * values.length)],
  };
};
