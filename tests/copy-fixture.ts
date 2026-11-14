import { referenceFixture } from './fixtures/reference';
import { readReference } from '../src/reference/reader';
import { importStrudel } from '../src/import';
import { defaultMatch, defaultSettings } from '../src/simplify';
import type { CopyOptions } from '../src/copy';
export const copyOptions: CopyOptions = {
  unedited: 'as-made',
  unarranged: 'silence',
  grid: 4,
  simplify: { ...defaultSettings },
  match: { ...defaultMatch },
};
export async function copyFixture() {
  const files = referenceFixture();
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
  const manifest = JSON.parse(new TextDecoder().decode(files.get('song.json')));
  files.set('song.json', encode({ ...manifest, name: 'Invented copy', duration_seconds: 5.5 }));
  const beats = JSON.parse(new TextDecoder().decode(files.get('beats.json')));
  files.set(
    'beats.json',
    encode({
      ...beats,
      duration_seconds: 5.5,
      beats: [0, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 3.5, 3.75, 4, 4.25, 4.5, 4.75, 5, 5.25, 5.5],
      downbeats: [0.5, 1.5, 3.5, 4.5],
      coverage: { ...beats.coverage, last_beat_seconds: 5.5, trailing_seconds: 0, gaps: [] },
    }),
  );
  files.set(
    'notes.json',
    encode({
      version: 1,
      time_unit: 'seconds',
      stems: {
        bass: [
          [0, 0.1, 55, 100],
          [0.5, 0.6, 60, 100],
          [0.5, 0.6, 67, 100],
          [1, 1.1, 64, 100],
          [1.5, 1.6, 67, 100],
          [3.5, 3.6, 60, 100],
          [3.5, 3.6, 67, 100],
          [4, 4.1, 64, 100],
          [4.5, 4.6, 69, 100],
        ],
      },
    }),
  );
  const importedSong = await readReference({
    read: async (p) => files.get(p)!,
    exists: async (p) => files.has(p),
  });
  const song = {
    ...importedSong,
    bars: importedSong.detectedBars,
    beatMap: importedSong.detectedBeatMap,
  };
  const doc = importStrudel(
    'const bass = note("[60,67] 64").s("sine"); const verse = stack(bass); $: arrange([1, verse], [1, verse]);',
  ).doc;
  const verse = doc.body.find((n) => n.kind === 'shared' && n.name === 'verse');
  const bass = doc.body.find((n) => n.kind === 'shared' && n.name === 'bass');
  const voice = doc.body.find((n) => n.kind === 'voice');
  if (verse?.kind !== 'shared' || bass?.kind !== 'shared' || voice?.pattern.core.kind !== 'group')
    throw Error('fixture');
  bass.pattern.stem = 'bass';
  verse.pattern.source = { folder: song.name, fromBar: 1, toBar: 2 };
  verse.pattern.edited = false;
  verse.pattern.label = 'Verse';
  voice.pattern.core.parts.forEach((p, i) => {
    p.source = { folder: song.name, fromBar: i ? 3 : 1, toBar: i ? 4 : 2 };
    p.tempo = i ? 120 : 60;
  });
  return { song, doc, files };
}
