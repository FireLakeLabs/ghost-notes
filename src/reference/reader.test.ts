import { expect, test } from 'vitest';
import { referenceFixture } from '../../tests/fixtures/reference';
import { readReference } from './reader';
import { barBeatToPosition, beatToPosition, secondsToPosition } from './beats';
import type { SongFiles } from './types';
function memory(files = referenceFixture()): SongFiles {
  return {
    exists: async (p) => files.has(p),
    read: async (p) => {
      const bytes = files.get(p);
      if (!bytes) throw Error('Missing fixture file');
      return bytes;
    },
  };
}
test('exact pickup, changing bar tempos, gap, inverse queries and uncovered tail', async () => {
  const song = await readReference(memory()),
    map = song.beatMap;
  expect(song.bars.map((b) => [b.number, b.startSeconds, b.endSeconds, b.bpm, b.partial])).toEqual([
    [0, 0, 0.5, 120, true],
    [1, 0.5, 2.5, 120, false],
    [2, 2.5, 7.5, 48, false],
    [3, 7.5, 7.5, null, true],
  ]);
  expect(song.stems[0].notes[0].start).toEqual({
    kind: 'detected',
    seconds: 0.25,
    beat: -0.5,
    bar: 0,
    beatInBar: 0.5,
  });
  expect(song.stems[0].notes[1].start).toEqual({
    kind: 'gap',
    seconds: 5.5,
    beat: 6.5,
    bar: 2,
    beatInBar: 2.5,
  });
  expect(song.stems[0].notes[1].end.kind).toBe('uncovered');
  expect(song.bars[2].gaps).toEqual([[4.5, 6.5]]);
  expect(barBeatToPosition(map, 2, 2.5)?.seconds).toBe(5.5);
  expect(beatToPosition(map, 6.5)?.seconds).toBe(5.5);
  expect(secondsToPosition(map, -0.25).bar).toBe(0);
  expect(beatToPosition(map, 50)).toBeNull();
  expect(song.beatMap.tempoReview.reasons).toEqual(['synthetic_review']);
  expect(JSON.stringify(song)).not.toContain('PRIVATE');
  expect(song.stems[0].noteSource).toBe('notes');
  expect(song.stems[0].midiNotes[0].endSeconds).toBe(1);
});
test('MIDI fallback keeps tempo changes when notes.json is absent', async () => {
  const files = referenceFixture();
  files.delete('notes.json');
  const song = await readReference(memory(files));
  expect(song.stems[0].noteSource).toBe('midi');
  expect(
    song.stems[0].notes.map((n) => [n.startSeconds, n.endSeconds, n.pitch, n.velocity]),
  ).toEqual([[0.25, 1, 60, 100]]);
});
for (const path of ['song.json', 'beats.json', 'notes.json']) {
  test(`rejects unknown ${path} versions`, async () => {
    const files = referenceFixture(),
      doc = JSON.parse(new TextDecoder().decode(files.get(path)));
    doc.version = 2;
    files.set(path, new TextEncoder().encode(JSON.stringify(doc)));
    await expect(readReference(memory(files))).rejects.toThrow('Unsupported reference version');
  });
}
for (const change of ['path', 'pitch', 'order', 'stem', 'unit']) {
  test(`rejects invalid contract ${change}`, async () => {
    const files = referenceFixture();
    const path =
      change === 'pitch' || change === 'unit'
        ? 'notes.json'
        : change === 'order'
          ? 'beats.json'
          : 'song.json';
    const doc = JSON.parse(new TextDecoder().decode(files.get(path)));
    if (change === 'path') doc.stems[0].audio = '../private.wav';
    if (change === 'pitch') doc.stems.bass[0][2] = 128;
    if (change === 'order') doc.beats.reverse();
    if (change === 'stem') doc.stems.push(doc.stems[0]);
    if (change === 'unit') doc.time_unit = 'ticks';
    files.set(path, new TextEncoder().encode(JSON.stringify(doc)));
    await expect(readReference(memory(files))).rejects.toThrow('Invalid version 1 reference');
  });
}
test('missing detected beats and downbeats stay unmapped', async () => {
  const files = referenceFixture(),
    decode = new TextDecoder(),
    encode = new TextEncoder();
  const doc = JSON.parse(decode.decode(files.get('beats.json')));
  Object.assign(doc, { beats: [], downbeats: [], bpm_median: null });
  Object.assign(doc.coverage, {
    status: 'missing',
    first_beat_seconds: null,
    last_beat_seconds: null,
    gaps: [],
  });
  files.set('beats.json', encode.encode(JSON.stringify(doc)));
  const manifest = JSON.parse(decode.decode(files.get('song.json')));
  manifest.pickup_beats = 0;
  files.set('song.json', encode.encode(JSON.stringify(manifest)));
  const song = await readReference(memory(files));
  expect(song.bars).toEqual([]);
  expect(song.stems[0].notes[0].start.kind).toBe('uncovered');
});
