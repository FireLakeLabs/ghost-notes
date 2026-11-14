import { drumPitches, drumSamples } from './drums';

/** Pinned Pattern.filterHaps/layer semantics; changes stay in section-local cycles. */
export function drumCellLayer({
  cycles,
  from,
  to,
  at,
  lane,
  on,
  duration,
}: {
  cycles: number;
  from: number;
  to: number;
  at: number;
  lane: number;
  on: boolean;
  duration: number;
}): string {
  const pitches = drumPitches[lane];
  if (!pitches) throw Error('Choose a displayed drum lane');
  if (on) {
    const sample = ['cr', 'hh', 'sd', 'lt', 'bd'][lane];
    return `.layer(p => stack(p, s(${JSON.stringify(sample)}).slow(${cycles}).late(${at}).duration(${duration}).gain(90/127)))`;
  }
  // The pinned transpiler treats double-quoted strings as mini notation.
  return `.filterHaps(h => {
    const v = h.value || {};
    const s = typeof v.s === 'string' ? v.s.split(':')[0] : '';
    let p;
    try { p = ({${Object.entries(drumSamples)
      .map(([sample, pitch]) => `${sample}:${pitch}`)
      .join(
        ',',
      )}})[s] ?? (typeof v.freq === 'number' && v.freq > 0 ? freqToMidi(v.freq) : typeof v.note === 'string' ? noteToMidi(v.note) : v.note); }
    catch { p = undefined; }
    const t = ((Number(h.whole ? h.whole.begin : h.part.begin) % ${cycles}) + ${cycles}) % ${cycles};
    return !(${JSON.stringify(pitches)}.includes(p) && t >= ${from - 1e-9} && t < ${to - 1e-9});
  })`;
}
