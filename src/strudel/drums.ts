export const drumSamples: Readonly<Record<string, number>> = {
  bd: 35,
  kick: 35,
  sd: 38,
  sn: 38,
  snare: 38,
  cp: 38,
  hh: 42,
  oh: 42,
  ch: 42,
  lt: 47,
  mt: 47,
  ht: 47,
  cr: 49,
  crash: 49,
  rd: 49,
};
export const drumPitches = [
  [49, 51, 52, 55, 57, 59],
  [42, 44, 46],
  [37, 38, 39, 40],
  [41, 43, 45, 47, 48, 50],
  [35, 36],
] as const;
export function drumLane(pitch: number): number | null {
  const lane = drumPitches.findIndex((pitches) => pitches.some((p) => p === pitch));
  return lane < 0 ? null : lane;
}
