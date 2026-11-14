import { installSource, sourceFragment } from '../src/document/edits/source-shared';
import { expect, test } from 'vitest';
import { checkDoc, walk } from '../src/document';
import { referenceLinks } from '../src/document/links';
import { importStrudel } from '../src/import';
import { generate } from '../src/generate';
import { readReference } from '../src/reference/reader';
import { referenceFixture } from './fixtures/reference';
import { queryEventsNode } from './node-query';

const source = { folder: 'invented-session', fromBar: 1, toBar: 2 };
test('ODM annotations restore section and place links, tempos, edit flags and stems without changing events', async () => {
  const doc = importStrudel(
    'const bass = note("c3 e3").s("triangle"); const verse = stack(bass); $: arrange([1, verse], [1, verse]);',
  ).doc;
  const bass = doc.body.find((n) => n.kind === 'shared' && n.name === 'bass');
  const verse = doc.body.find((n) => n.kind === 'shared' && n.name === 'verse');
  const voice = doc.body.find((n) => n.kind === 'voice');
  if (bass?.kind !== 'shared' || verse?.kind !== 'shared' || voice?.pattern.core.kind !== 'group')
    throw Error('fixture');
  bass.pattern.stem = 'bass';
  verse.pattern.source = source;
  verse.pattern.edited = false;
  voice.pattern.core.parts.forEach((p, i) => {
    p.source = { ...source, fromBar: i + 1, toBar: i + 2 };
    p.tempo = 30 + i;
  });
  const before = await queryEventsNode(generate(doc), 0, 2);
  const pasted = importStrudel(generate(doc)).doc;
  expect(checkDoc(pasted)).toEqual([]);
  const metadata = (d: typeof doc) => {
    const result: unknown[] = [];
    walk(d, (n) => {
      if ('source' in n || 'stem' in n || 'edited' in n || 'tempo' in n)
        result.push({
          source: 'source' in n ? n.source : undefined,
          stem: 'stem' in n ? n.stem : undefined,
          edited: 'edited' in n ? n.edited : undefined,
          tempo: 'tempo' in n ? n.tempo : undefined,
        });
    });
    return result;
  };
  expect(metadata(pasted)).toEqual(metadata(doc));
  expect((await queryEventsNode(generate(pasted), 0, 2)).events).toEqual(before.events);
  const files = referenceFixture();
  const song = await readReference({
    read: async (p) => files.get(p)!,
    exists: async (p) => files.has(p),
  });
  const reopened = referenceLinks(pasted, source.folder, song);
  expect(reopened.links).toHaveLength(3);
  expect(reopened.links.every((l) => l.restored)).toBe(true);
  expect(reopened.stems.map((s) => s.restored)).toEqual([true]);
  expect(referenceLinks(pasted, 'another-folder', song).links.every((l) => !l.restored)).toBe(true);
});

test('malformed metadata is ignored and comment terminators remain inert', () => {
  const doc = importStrudel(
    '/*@odm-pattern {"source":{"folder":"../private","fromBar":1,"toBar":2},"tempo":-1,"edited":"yes","stem":42}*/ note("c3")',
  ).doc;
  expect(generate(doc)).not.toContain('../private');
  const voice = doc.body.find((n) => n.kind === 'voice');
  if (!voice) throw Error('fixture');
  voice.pattern.source = { ...source, folder: 'invented * ending' };
  voice.pattern.stem = 'bass*/not code';
  voice.pattern.edited = true;
  const pasted = importStrudel(generate(doc)).doc;
  expect(pasted.body.find((n) => n.kind === 'voice')?.pattern.stem).toBe('bass*/not code');
  expect(checkDoc(pasted)).toEqual([]);
});

test('source edits preserve links and rhythm fragments hide metadata', () => {
  const doc = importStrudel('const bass = note("c3 e3").s("triangle"); $: bass;').doc;
  const bass = doc.body[0];
  if (bass.kind !== 'shared') throw Error('fixture');
  Object.assign(bass.pattern, { source, stem: 'bass', edited: false });
  expect(sourceFragment(doc, `${bass.pattern.id}:rhythm`)).not.toContain('@odm-');
  for (const understood of [true, false]) {
    const next = installSource(doc, bass.pattern.id, 'note("d3 f3").s("triangle")', understood);
    if ('ok' in next) throw Error(next.reason);
    const entry = next.body[0];
    if (entry.kind !== 'shared') throw Error('fixture');
    expect(entry.pattern).toMatchObject({ source, stem: 'bass', edited: true });
  }
});
