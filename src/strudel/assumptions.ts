// Synthetic only. Beat gaps cover the steady session's 0.36–0.42 s range;
// the second half drifts faster. No transcription data is copied here.
export const beatGaps = [
  0.36, 0.4, 0.38, 0.42, 0.38, 0.4, 0.4, 0.42, 0.38, 0.4, 0.38, 0.4, 0.36, 0.38, 0.38, 0.4,
];
export const beatTimes = [0];
for (const gap of beatGaps) beatTimes.push(beatTimes.at(-1)! + gap);
export const barSeconds = Array.from({ length: 4 }, (_, bar) =>
  beatGaps.slice(bar * 4, bar * 4 + 4).reduce((a, b) => a + b, 0),
);
// One pinned Cyclist query window (50 ms), <14% of the shortest fixture beat.
// This bounds alignment error, not speaker latency; fixed startup latency cancels.
export const ALIGNMENT_SECONDS = 0.05;
export const followingSource = `setcps(${1 / barSeconds[0]});
  note("c3 d3 e3 f3").s("sine").cps("<${barSeconds.map((s) => 1 / s).join(' ')}>")`;
export const placeSource = `setcpm(120); arrange(
  [2 * .75, note("c3 d3 e3 f3").slow(.75)],
  [1 * 1.25, note("g3 a3 b3 c4").slow(1.25)]).s("sine")`;
export const pickupSource = `setcpm(120); arrange(
  [.25, note("c3 d3 e3 f3")], [1, note("g3 a3 b3 c4")]).s("sine")`;
// A held tempo exposes Cyclist's old phase anchor being reused for the second
// simultaneous onset after its first onset changes cps.
export const heldBarSeconds = [1.56, 1.56, 1.56, 1.6];
export const chordSource = (bars: number[]) => `setcps(${1 / bars[0]});
  note("[c3,e3] d3 e3 f3").s("sine").cps("<${bars.map((s) => 1 / s).join(' ')}>")`;
