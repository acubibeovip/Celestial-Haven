export function randomForSeed(seed: number) {
  let value = seed;
  return (bound: number) => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return Math.floor(value / 0x1_0000_0000 * bound);
  };
}
