import type { SimplifyInput, SimplifyNote } from './types';
import { encode, pattern, sequence } from './encode';
import { finish, literalNotes, settingsFor } from './report';
import { euclideanSteps } from '../strudel/euclidean';

const rounded = (n: number) => Number(n.toFixed(8));
function pitched(input: SimplifyInput) {
  if (input.conversion.stemId === 'drums') throw Error('Expected a pitched conversion');
  return literalNotes(input).sort((a, b) => a.startCycle - b.startCycle || a.pitch - b.pitch);
}
function rewrite(input: SimplifyInput, technique: string, notes: SimplifyNote[]) {
  return finish(input, technique, notes, encode(input.conversion, notes));
}
export function cleanStrays(input: SimplifyInput) {
  const notes = pitched(input),
    settings = settingsFor(input);
  const candidates = notes.filter(
    (n) =>
      n.velocity < settings.cleaningVelocity &&
      n.endSeconds - n.startSeconds <= settings.strayMaxSeconds,
  );
  const removed = new Set<SimplifyNote>();
  let sourceDrops = 0;
  for (const n of candidates) {
    if (
      sourceDrops + n.noteIndices.length >
      input.conversion.notes.length * settings.maxDropShare + 1e-9
    )
      continue;
    sourceDrops += n.noteIndices.length;
    removed.add(n);
  }
  return rewrite(
    input,
    'stray-notes',
    notes.filter((n) => !removed.has(n)),
  );
}
export function joinSplitNotes(input: SimplifyInput) {
  const notes = pitched(input),
    settings = settingsFor(input);
  const result: SimplifyNote[] = [];
  for (const n of notes) {
    const previous = result.findLast((p) => p.pitch === n.pitch && p.spanIndex === n.spanIndex);
    // No strong reattack evidence is available: only join a weak fragment.
    if (
      previous &&
      n.velocity < settings.cleaningVelocity &&
      n.startSeconds >= previous.endSeconds - 1e-9 &&
      n.startSeconds - previous.endSeconds <= settings.splitGapSeconds &&
      !notes.some(
        (o) =>
          o !== n &&
          o.startSeconds > previous.startSeconds &&
          o.startSeconds < n.startSeconds &&
          o.velocity >= settings.cleaningVelocity,
      )
    ) {
      previous.endSeconds = n.endSeconds;
      previous.endCycle = n.endCycle;
      previous.noteIndices = [...previous.noteIndices, ...n.noteIndices];
    } else result.push({ ...n });
  }
  return rewrite(input, 'split-notes', result);
}
export function correctOctaves(input: SimplifyInput) {
  const notes = pitched(input),
    settings = settingsFor(input);
  const result = notes.map((n, i) => {
    const a = notes[i - 1],
      b = notes[i + 1];
    return a &&
      b &&
      a.pitch === b.pitch &&
      Math.abs(a.pitch - n.pitch) === 12 &&
      a.endSeconds <= n.startSeconds &&
      n.endSeconds <= b.startSeconds &&
      n.velocity < settings.cleaningVelocity &&
      n.endSeconds - n.startSeconds <= settings.octaveMaxSeconds
      ? { ...n, pitch: a.pitch }
      : n;
  });
  return rewrite(input, 'octave-errors', result);
}
function byBar(
  input: SimplifyInput,
  notes: readonly SimplifyNote[],
  render: (group: SimplifyNote[], start: number, width: number) => string,
) {
  return (
    sequence(
      input.conversion.spans.map((s, i) => ({
        width: s.endCycle - s.startCycle,
        code: render(
          notes.filter((n) => n.spanIndex === i),
          s.startCycle,
          s.endCycle - s.startCycle,
        ),
      })),
    ) + '.s("triangle")'
  );
}
export function intervalRiffs(input: SimplifyInput) {
  const notes = pitched(input);
  // Equal intervals + rhythm + duration + gain, including all chord members.
  const expression = byBar(input, notes, (group, start, width) => {
    const root = group[0]?.pitch ?? 0;
    return `${pattern(group, start, width, false, root)}.transpose(${root})`;
  });
  // sequence shares repeated normalized bars only if offsets agree. Separate
  // root from template definitions to reuse transposed occurrences too.
  const templates: string[] = [];
  const parts = input.conversion.spans.map((s, i) => {
    const group = notes.filter((n) => n.spanIndex === i),
      root = group[0]?.pitch ?? 0;
    const code = pattern(group, s.startCycle, s.endCycle - s.startCycle, false, root);
    let id = templates.indexOf(code);
    if (id < 0) {
      id = templates.length;
      templates.push(code);
    }
    return { width: s.endCycle - s.startCycle, code: `r${id}.transpose(${root})` };
  });
  const shared = `(()=>{${templates.map((t, i) => `const r${i}=${t};`).join('')}return ${sequence(parts)};})().s("triangle")`;
  return finish(
    input,
    'interval-riffs',
    notes,
    shared.length < expression.length ? shared : expression,
  );
}
export function scaleDegrees(input: SimplifyInput) {
  const notes = pitched(input);
  const modes = [
    { name: 'major', intervals: [0, 2, 4, 5, 7, 9, 11] },
    { name: 'minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  ];
  let best = { root: 0, mode: modes[0], score: -1 };
  for (let root = 0; root < 12; root++)
    for (const mode of modes) {
      const score = notes.reduce(
        (sum, n) =>
          sum +
          (mode.intervals.includes((n.pitch - root + 120) % 12)
            ? (n.endSeconds - n.startSeconds) * n.velocity
            : 0),
        0,
      );
      if (score > best.score) best = { root, mode, score };
    }
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const rootMidi = 48 + best.root;
  const expression = byBar(input, notes, (group, start, width) => {
    const inside = group.filter((n) =>
      best.mode.intervals.includes((n.pitch - best.root + 120) % 12),
    );
    const outside = group.filter((n) => !inside.includes(n));
    const degrees = inside.map((n) => ({
      ...n,
      pitch:
        Math.floor((n.pitch - rootMidi) / 12) * 7 +
        best.mode.intervals.indexOf((n.pitch - best.root + 120) % 12),
    }));
    const scale =
      pattern(degrees, start, width).replaceAll('note(', 'n(') +
      `.scale("${names[best.root]}3:${best.mode.name}")`;
    return outside.length ? `stack(${scale},${pattern(outside, start, width)})` : scale;
  });
  return finish(input, 'scale-degrees', notes, expression);
}
export function euclideanFits(input: SimplifyInput) {
  const notes = pitched(input);
  const expression = byBar(input, notes, (group, start, width) => {
    const fallback = pattern(group, start, width);
    // Search only exact fits, retaining every pitch, gain, duration and exception.
    const groups = new Map<string, SimplifyNote[]>();
    for (const n of group) {
      const key = [n.pitch, n.velocity, rounded(n.endCycle - n.startCycle)].join(':');
      const g = groups.get(key) ?? [];
      g.push(n);
      groups.set(key, g);
    }
    const parts = [...groups.values()].map((g) => {
      const plain = pattern(g, start, width);
      for (const steps of [4, 8, 12, 16, 24, 32, 48, 64]) {
        const slots = g.map((n) => rounded(((n.startCycle - start) / width) * steps));
        if (
          slots.some((s) => !Number.isInteger(s)) ||
          new Set(slots).size !== g.length ||
          g.length > steps
        )
          continue;
        for (let rotation = 0; rotation < steps; rotation++) {
          const fit = euclideanSteps(g.length, steps, rotation);
          if (fit.length !== slots.length || fit.some((s, i) => s !== slots[i])) continue;
          const n = g[0];
          const code = `note(${n.pitch}).euclidRot(${g.length},${steps},${rotation}).gain(${n.velocity}/127).legato(${rounded(((n.endCycle - n.startCycle) / width) * steps)})`;
          if (code.length < plain.length) return code;
        }
      }
      return plain;
    });
    const candidate = parts.length > 1 ? `stack(${parts.join(',')})` : (parts[0] ?? 'silence');
    return candidate.length < fallback.length ? candidate : fallback;
  });
  return finish(input, 'euclidean-fits', notes, expression);
}
export function phraseRepeats(input: SimplifyInput) {
  const notes = pitched(input);
  let expression = encode(input.conversion, notes);
  for (const length of [2, 4, 8]) {
    const parts: { width: number; code: string }[] = [];
    for (let i = 0; i < input.conversion.spans.length;) {
      const spans = input.conversion.spans.slice(i, i + length);
      const complete =
        spans.length === length &&
        spans.every(
          (s) =>
            s.kind === 'bar' &&
            s.bar &&
            !s.bar.partial &&
            !s.bar.gaps.length &&
            Math.abs(s.endCycle - s.startCycle - 1) < 1e-9,
        );
      const width = complete
        ? length
        : input.conversion.spans[i].endCycle - input.conversion.spans[i].startCycle;
      const take = complete ? length : 1;
      const group = notes.filter((n) => n.spanIndex >= i && n.spanIndex < i + take);
      parts.push({ width, code: pattern(group, input.conversion.spans[i].startCycle, width) });
      i += take;
    }
    const candidate = sequence(parts) + '.s("triangle")';
    if (candidate.length < expression.length) expression = candidate;
  }
  return finish(input, 'phrase-repeats', notes, expression);
}
export function simplifyPitched(input: SimplifyInput) {
  return [
    cleanStrays(input),
    joinSplitNotes(input),
    correctOctaves(input),
    intervalRiffs(input),
    scaleDegrees(input),
    euclideanFits(input),
    phraseRepeats(input),
  ];
}
