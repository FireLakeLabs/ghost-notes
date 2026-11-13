import { bjorklund } from '@strudel/core';
/** Pinned Bjorklund orientation. Kept here so simplify never imports Strudel. */
export function euclideanSteps(pulses: number, steps: number, rotation: number): number[] {
  const rhythm = bjorklund(pulses, steps);
  return rhythm.flatMap((_, i) => (rhythm[(i - rotation + steps) % steps] ? [i] : []));
}
