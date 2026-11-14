import { expect, test } from 'vitest';
import { copyArrangement } from '../src/copy';
import { checkDoc, walk } from '../src/document';
import { importStrudel } from '../src/import';
import { generateCopy } from '../src/generate';
import { queryEventsNode } from './node-query';
import { copyFixture, copyOptions } from './copy-fixture';

for (const mode of ['silence', 'literal', 'simplified'] as const) {
  test(`copy fixture: reused section, pickup, place tempos and ${mode} gaps round-trip through pinned Strudel`, async () => {
    const { doc, song } = await copyFixture();
    const before = structuredClone(doc);
    const output = copyArrangement({ doc, song, options: { ...copyOptions, unarranged: mode } });
    const pasted = importStrudel(output.text).doc;
    expect(checkDoc(pasted)).toEqual([]);
    expect(doc).toEqual(before);
    expect(output.warnings.join(' ')).toContain('first pass only');
    expect(output.silentBars).toBe(mode === 'silence' ? 3 : 0);
    expect(output.seconds).toBeCloseTo(5);
    const expected =
      mode === 'silence'
        ? [
            [0.5, 60],
            [0.5, 67],
            [1, 64],
            [3.5, 60],
            [3.5, 67],
            [3.75, 64],
          ]
        : [
            [0, 55],
            [0.5, 60],
            [0.5, 67],
            [1, 64],
            [1.5, 67],
            [3.5, 60],
            [3.5, 67],
            [3.75, 64],
            [4, 69],
          ];
    const events = (await queryEventsNode(output.text, 0, 5)).events.filter((e) => e.hasOnset);
    expect(
      events
        .map((e) => [e.whole?.[0], (e.value as { note: number }).note])
        .sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!),
    ).toEqual(expected);
    for (const event of events) {
      if (!event.whole) throw Error('Expected discrete note');
      const value = event.value as { clip?: number; s: string; gain?: number };
      const start = event.whole[0];
      const expectedDuration =
        value.s === 'sine' ? (start < 1.5 ? 0.5 : 0.25) : start === 4 ? 0.0625 : 0.1;
      expect((event.whole[1] - start) * (value.clip ?? 1)).toBeCloseTo(expectedDuration, 8);
      if (value.s !== 'sine') expect(value.gain).toBeCloseTo(100 / 127, 8);
    }
    expect((await queryEventsNode(generateCopy(pasted), 0, 5)).events).toEqual(
      (await queryEventsNode(output.text, 0, 5)).events,
    );
    const copiedAgain = copyArrangement({
      doc: pasted,
      song,
      options: { ...copyOptions, unarranged: mode },
    });
    expect((await queryEventsNode(copiedAgain.text, 0, 5)).events).toEqual(
      (await queryEventsNode(output.text, 0, 5)).events,
    );
    const links: unknown[] = [];
    walk(pasted, (n) => {
      if ('source' in n && n.source) links.push(n.source);
    });
    expect(links).toContainEqual({ folder: song.name, fromBar: 3, toBar: 4 });
    expect(output.text).toContain('"stem":"bass"');
  });
}

test('unedited literal/simplified reuse original source; edits and unlinked drafts stay as written', async () => {
  const { doc, song } = await copyFixture();
  for (const unedited of ['literal', 'simplified'] as const) {
    const output = copyArrangement({ doc, song, options: { ...copyOptions, unedited } });
    const result = await queryEventsNode(output.text, 0, 5);
    expect(result.error).toBeNull();
    expect(
      result.events
        .filter((e) => e.hasOnset)
        .map((e) => [e.whole?.[0], (e.value as { note: number }).note])
        .sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!),
    ).toEqual([
      [0.5, 60],
      [0.5, 67],
      [1, 64],
      [3.5, 60],
      [3.5, 67],
      [3.75, 64],
    ]);
  }
  const verse = doc.body.find((n) => n.kind === 'shared' && n.name === 'verse');
  if (verse?.kind !== 'shared') throw Error('fixture');
  verse.pattern.edited = true;
  const output = copyArrangement({ doc, song, options: { ...copyOptions, unedited: 'literal' } });
  expect(output.text).toContain('sine');
  const draft = importStrudel('note("72").s("sine")').doc;
  expect(copyArrangement({ doc: draft, song, options: copyOptions }).text).toBe(
    generateCopy(draft),
  );
});

test('editing a shared instrument marks its linked section, undo can restore the original', async () => {
  const { markEdited } = await import('../src/document/edited');
  const { doc } = await copyFixture();
  const next = structuredClone(doc);
  const bass = next.body.find((n) => n.kind === 'shared' && n.name === 'bass');
  if (bass?.kind !== 'shared') throw Error('fixture');
  bass.pattern.core = { kind: 'opaque', code: 'note("72")' };
  const marked = markEdited(doc, next);
  expect(marked.body.find((n) => n.kind === 'shared' && n.name === 'verse')).toMatchObject({
    pattern: { edited: true },
  });
  expect(doc.body.find((n) => n.kind === 'shared' && n.name === 'verse')).toMatchObject({
    pattern: { edited: false },
  });
});

test('reopened uncovered edges retain their content and editable place tempo', async () => {
  const { doc, song } = await copyFixture();
  song.durationSeconds = 5.75;
  const first = copyArrangement({ doc, song, options: copyOptions });
  const pasted = importStrudel(first.text).doc;
  const voice = pasted.body.find((n) => n.kind === 'voice');
  if (voice?.pattern.core.kind !== 'group') throw Error('fixture');
  const firstVerse = voice.pattern.core.parts.find((p) => p.source?.fromBar === 1);
  if (!firstVerse) throw Error('fixture');
  firstVerse.tempo = 120;
  voice.pattern.core.parts.at(-1)!.tempo = 120;
  const second = copyArrangement({
    doc: pasted,
    song,
    options: copyOptions,
  });
  expect(second.seconds).toBeCloseTo(4.625);
  expect(second.warnings.join(' ')).not.toContain('whole-program');
  expect(second.text).toContain('Uncovered edge');
  const result = await queryEventsNode(second.text, 0, 4.625);
  expect(result.error).toBeNull();
  expect(
    result.events
      .filter((e) => e.hasOnset)
      .map((e) => e.whole?.[0])
      .sort((a, b) => a! - b!),
  ).toEqual([0.5, 0.5, 0.75, 3, 3, 3.25]);
});

test('renaming and commenting do not mark a section edited; muting does', async () => {
  const { markEdited } = await import('../src/document/edited');
  const { doc } = await copyFixture();
  const renamed = structuredClone(doc);
  const verse = renamed.body.find((n) => n.kind === 'shared' && n.name === 'verse');
  if (verse?.kind !== 'shared') throw Error('fixture');
  verse.pattern.label = 'Renamed';
  verse.pattern.comment = 'A label is not a music edit';
  expect(markEdited(doc, renamed)).toBe(renamed);
  verse.pattern.muted = true;
  expect(
    markEdited(doc, renamed).body.find((n) => n.kind === 'shared' && n.name === 'verse'),
  ).toMatchObject({ pattern: { edited: true } });
});

test('regenerated section definitions do not accumulate on repeated literal copies', async () => {
  const { doc, song } = await copyFixture();
  let next = doc;
  for (let i = 0; i < 3; i++) {
    const output = copyArrangement({
      doc: next,
      song,
      options: { ...copyOptions, unedited: 'literal' },
    });
    expect(output.silentBars).toBe(3);
    const events = await queryEventsNode(output.text, 0, output.seconds!);
    expect(
      events.events
        .filter((e) => e.hasOnset)
        .map((e) => e.whole?.[0])
        .sort((a, b) => a! - b!),
    ).toEqual([0.5, 0.5, 1, 3.5, 3.5, 3.75]);
    next = importStrudel(output.text).doc;
    expect(
      next.body.filter((n) => n.kind === 'shared' && n.name.startsWith('ghostCopySection')),
    ).toHaveLength(1);
  }
});

test('sections created by step 8 retain explicit gaps that the copy choices fill', async () => {
  const { makeSectionFromRange } = await import('../src/document/edits/section-from-range');
  const { song } = await copyFixture();
  const made = makeSectionFromRange({
    doc: { version: 2, body: [] },
    song,
    folder: song.name,
    range: { fromBar: 1, toBar: 2 },
    places: [{ fromBar: 3, toBar: 4 }],
    name: 'Verse',
    grid: 4,
  });
  for (const mode of ['silence', 'literal', 'simplified'] as const) {
    const output = copyArrangement({
      doc: made.doc,
      song,
      options: { ...copyOptions, unarranged: mode },
    });
    expect(output.warnings.join(' ')).not.toContain('whole-program');
    expect(output.silentBars).toBe(mode === 'silence' ? 3 : 0);
    const result = await queryEventsNode(output.text, 0, output.seconds!);
    expect(result.error).toBeNull();
    expect(result.events.filter((e) => e.hasOnset)).toHaveLength(mode === 'silence' ? 6 : 9);
  }
});

test('regenerating a one-instrument section does not add the rest of the band', async () => {
  const { makeSectionFromRange } = await import('../src/document/edits/section-from-range');
  const { song } = await copyFixture();
  song.stems = [
    ...song.stems,
    {
      ...song.stems[0],
      id: 'keys',
      notes: song.stems[0].notes.map((n) => ({ ...n, pitch: n.pitch + 12 })),
    },
  ];
  const made = makeSectionFromRange({
    doc: { version: 2, body: [] },
    song,
    folder: song.name,
    range: { fromBar: 1, toBar: 2 },
    stemIds: ['bass'],
    name: 'Bass only',
    grid: 4,
  });
  for (const unedited of ['literal', 'simplified'] as const) {
    const output = copyArrangement({ doc: made.doc, song, options: { ...copyOptions, unedited } });
    const result = await queryEventsNode(output.text, 0, output.seconds!);
    expect(result.error).toBeNull();
    expect(result.events.filter((e) => e.hasOnset)).toHaveLength(3);
    expect(result.events.every((e) => (e.value as { note: number }).note < 72)).toBe(true);
  }
});

test('gap notes written in another Strudel editor survive every unedited copy choice', async () => {
  const { doc, song } = await copyFixture();
  const first = copyArrangement({ doc, song, options: copyOptions });
  const external = first.text.replace('silence', 'note("72").s("sine")');
  expect(external).not.toBe(first.text);
  for (const unedited of ['as-made', 'literal', 'simplified'] as const) {
    const pasted = importStrudel(external).doc;
    const output = copyArrangement({ doc: pasted, song, options: { ...copyOptions, unedited } });
    expect(output.silentBars).toBe(2);
    const queried = await queryEventsNode(output.text, 0, output.seconds!);
    expect(queried.error).toBeNull();
    expect(
      queried.events.filter((e) => e.hasOnset && (e.value as { note: number }).note === 72),
    ).toHaveLength(1);
    const again = copyArrangement({
      doc: importStrudel(output.text).doc,
      song,
      options: { ...copyOptions, unedited },
    });
    expect((await queryEventsNode(again.text, 0, again.seconds!)).events).toEqual(queried.events);
  }
});

test('a renamed unarranged place keeps its name through copying', async () => {
  const { doc, song } = await copyFixture();
  const pasted = importStrudel(copyArrangement({ doc, song, options: copyOptions }).text).doc;
  const voice = pasted.body.find((n) => n.kind === 'voice');
  if (voice?.pattern.core.kind !== 'group') throw Error('fixture');
  const gap = voice.pattern.core.parts.find((p) => p.source?.fromBar === 2);
  if (!gap) throw Error('fixture');
  gap.label = 'Breakdown';
  gap.labelSource = 'author';
  const output = copyArrangement({ doc: pasted, song, options: copyOptions });
  expect(output.text).toContain('Breakdown');
  expect(output.silentBars).toBe(3);
});

test('literal fills stay unarranged until their notes change outside the app', async () => {
  const { doc, song } = await copyFixture();
  const first = copyArrangement({ doc, song, options: { ...copyOptions, unarranged: 'literal' } });
  const pasted = importStrudel(first.text).doc;
  const quiet = copyArrangement({ doc: pasted, song, options: copyOptions });
  expect(quiet.silentBars).toBe(3);
  expect(
    (await queryEventsNode(quiet.text, 0, quiet.seconds!)).events.filter((e) => e.hasOnset),
  ).toHaveLength(6);
  const voice = pasted.body.find((n) => n.kind === 'voice');
  if (voice?.pattern.core.kind !== 'group') throw Error('fixture');
  const gap = voice.pattern.core.parts.find((p) => p.source?.fromBar === 2);
  if (!gap) throw Error('fixture');
  gap.pattern.core = { kind: 'opaque', code: 'note("72").s("sine")' };
  // Generate/paste mimics a text edit while preserving old metadata; no markEdited call.
  const external = importStrudel(generateCopy(pasted)).doc;
  for (const unedited of ['as-made', 'literal', 'simplified'] as const) {
    const copied = copyArrangement({ doc: external, song, options: { ...copyOptions, unedited } });
    expect(copied.silentBars).toBe(2);
    const events = await queryEventsNode(copied.text, 0, copied.seconds!);
    expect(
      events.events.filter((e) => e.hasOnset && (e.value as { note: number }).note === 72),
    ).toHaveLength(1);
  }
});

test('replacing a written fill with silence outside the app keeps that silence', async () => {
  const { doc, song } = await copyFixture();
  const pasted = importStrudel(
    copyArrangement({ doc, song, options: { ...copyOptions, unarranged: 'literal' } }).text,
  ).doc;
  const voice = pasted.body.find((n) => n.kind === 'voice');
  if (voice?.pattern.core.kind !== 'group') throw Error('fixture');
  const gap = voice.pattern.core.parts.find((p) => p.source?.fromBar === 2);
  if (!gap) throw Error('fixture');
  gap.pattern.core = { kind: 'generator', name: 'silence', args: [] };
  const external = importStrudel(generateCopy(pasted)).doc;
  const copied = copyArrangement({
    doc: external,
    song,
    options: { ...copyOptions, unarranged: 'literal' },
  });
  const result = await queryEventsNode(copied.text, 0, copied.seconds!);
  expect(result.error).toBeNull();
  expect(
    result.events.some((e) => e.hasOnset && e.whole && e.whole[0] >= 1.5 && e.whole[0] < 3.5),
  ).toBe(false);
});
