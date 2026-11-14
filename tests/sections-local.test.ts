import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { readReference } from '../src/reference/reader';
import { beatToPosition, secondsToPosition } from '../src/reference/beats';
import { makeSectionFromRange } from '../src/document/edits/section-from-range';
import { findSectionMatches } from '../src/document/section-matches';
import { sectionRange, overlaps, type BarRange } from '../src/document/section-range';
import { checkDoc, instruments } from '../src/document';
import { referenceLinks } from '../src/document/links';
import { convertInstrument, conversionSpans } from '../src/convert';
import { generate, generateCopy } from '../src/generate';
import { importStrudel } from '../src/import';
import { queryEventsNode } from './node-query';
import { sectionEvents, sectionMetadata, copiedEventProof } from './sections-proof';
const root = process.env.GHOST_SECTIONS_ROOT;
test.skipIf(!root || !existsSync(root))(
  'six private songs: first eight bars, offered reuse, copy/paste/reopen and planted-repeat recall',
  async () => {
    if (!root) throw Error('Expected local reference folder');
    let ordinal = 0,
      tested = 0;
    for (const source of ['first-test-session', 'diversity-1', 'diversity-2']) {
      let number = 0;
      for (const name of (await readdir(join(root, source, 'songs'))).sort()) {
        const path = join(root, source, 'songs', name);
        if (!existsSync(join(path, 'song.json'))) continue;
        number++;
        ordinal++;
        if (process.env.GHOST_SECTIONS_SONG && +process.env.GHOST_SECTIONS_SONG !== ordinal)
          continue;
        const label =
          source === 'first-test-session' ? `first test session, song ${number}` : source;
        let stage = 'read';
        try {
          const files = {
            read: async (p: string) => new Uint8Array(await readFile(join(path, p))),
            exists: async (p: string) => existsSync(join(path, p)),
          };
          const song = await readReference(files);
          const hash = () => createHash('sha256').update(JSON.stringify(song.stems)).digest('hex');
          const beforeHash = hash(),
            range = { fromBar: 1, toBar: 9 },
            span = sectionRange(song, range);
          stage = 'match';
          const matches = findSectionMatches({ song, range });
          // Use the real local basename in memory only; no paths or text leave this test.
          stage = 'make';
          const made = makeSectionFromRange({
            doc: { version: 2, body: [] },
            song,
            folder: name,
            name: 'First eight',
            range,
            places: matches,
          });
          const end = conversionSpans(song, song.bars).at(-1)?.endCycle ?? 0;
          let emitted = 0;
          for (const [index, row] of instruments(made.doc).entries()) {
            stage = `stem ${index + 1} literal comparison`;
            const c = convertInstrument({ song, stemId: row.pattern.stem ?? '', range });
            const expected = sectionEvents(
              await queryEventsNode(c.source, 0, 8, { timeoutMs: 15000 }),
            );
            // Query from song zero: pinned arrange rationalizes fractional
            // prefix lengths, so a boundary onset can be infinitesimally before
            // the grid's floating start. Do not cut it off with the query itself.
            const rowResult = await queryEventsNode(
              generate(made.doc, { only: row.id }),
              0,
              span.endCycle,
              { timeoutMs: 15000 },
            );
            const actual = sectionEvents(
              {
                ...rowResult,
                events: rowResult.events.filter(
                  (e) => !e.whole || e.whole[0] >= span.startCycle - 1e-8,
                ),
              },
              span.startCycle,
            );
            stage += ` (${actual.length}/${expected.length} events)`;
            expect(actual).toEqual(expected);
            emitted += actual.length;
          }
          stage = 'metadata';
          const copied = generateCopy(made.doc),
            pasted = importStrudel(copied).doc;
          expect(checkDoc(pasted)).toEqual([]);
          expect(sectionMetadata(pasted)).toEqual(sectionMetadata(made.doc));
          stage = 'canonical query';
          const canonical = await queryEventsNode(generate(made.doc), 0, end, { timeoutMs: 15000 });
          const before = sectionEvents(canonical);
          stage = 'copied tempo query';
          const expectedCopy = copiedEventProof(made.doc, canonical);
          expect(
            sectionEvents(await queryEventsNode(copied, 0, expectedCopy.end, { timeoutMs: 15000 })),
          ).toEqual(expectedCopy.events);
          stage = 'pasted query';
          const after = sectionEvents(
            await queryEventsNode(generate(pasted), 0, end, { timeoutMs: 15000 }),
          );
          expect(after).toEqual(before);
          stage = 'reopen';
          const reopened = referenceLinks(pasted, name, await readReference(files));
          expect(reopened.links.every((l) => l.restored)).toBe(true);
          expect(reopened.stems.every((s) => s.restored)).toBe(true);
          expect(reopened.stems).toHaveLength(song.stems.length);
          expect(hash()).toBe(beforeHash);
          // Known truth: plant two copies of the real first-eight-bar note sets in
          // other equal-beat windows, in memory only. Native offers are not labels.
          stage = 'known-repeat planting';
          const targets: BarRange[] = [];
          const last = Math.max(...song.bars.map((b) => b.number));
          for (let fromBar = 9; fromBar + 8 <= last + 1 && targets.length < 2; fromBar++) {
            const r = { fromBar, toBar: fromBar + 8 },
              s = sectionRange(song, r);
            if (
              Math.abs(s.endBeat - s.startBeat - (span.endBeat - span.startBeat)) < 1e-9 &&
              !targets.some((t) => overlaps(t, r))
            )
              targets.push(r);
          }
          expect(targets).toHaveLength(2);
          const targetSpans = targets.map((r) => sectionRange(song, r));
          const planted = {
            ...song,
            stems: song.stems.map((stem) => ({
              ...stem,
              notes: [
                ...stem.notes.filter(
                  (n) =>
                    !targetSpans.some(
                      (t) => n.startSeconds >= t.startSeconds && n.startSeconds < t.endSeconds,
                    ),
                ),
                ...targetSpans.flatMap((target) =>
                  stem.notes
                    .filter(
                      (n) =>
                        n.startSeconds >= span.startSeconds && n.startSeconds < span.endSeconds,
                    )
                    .map((n) => {
                      const original = secondsToPosition(song.beatMap, n.startSeconds);
                      if (original.beat === null) throw Error('Expected reference beat');
                      const position = beatToPosition(
                        song.beatMap,
                        target.startBeat + original.beat - span.startBeat,
                      );
                      if (!position) throw Error('Expected planted beat');
                      const startSeconds = position.seconds,
                        endSeconds = startSeconds + n.endSeconds - n.startSeconds;
                      return {
                        ...n,
                        startSeconds,
                        endSeconds,
                        start: secondsToPosition(song.beatMap, startSeconds),
                        end: secondsToPosition(song.beatMap, endSeconds),
                      };
                    }),
                ),
              ],
            })),
          };
          stage = 'known-repeat recovery';
          const offers = findSectionMatches({ song: planted, range });
          const recovered = targets.filter((t) =>
            offers.some((o) => o.fromBar === t.fromBar && o.score > 1 - 1e-9),
          ).length;
          expect(recovered).toBe(2);
          console.log(
            JSON.stringify({
              input: label,
              stems: song.stems.length,
              sourceNotes: song.stems.reduce(
                (n, s) =>
                  n +
                  s.notes.filter(
                    (x) => x.startSeconds >= span.startSeconds && x.startSeconds < span.endSeconds,
                  ).length,
                0,
              ),
              emitted,
              offers: matches.length,
              scores: matches.map((m) => +m.score.toFixed(4)),
              places: matches.length + 1,
              roundTripEvents: before.length,
              links: reopened.links.length,
              stemLinks: reopened.stems.length,
              plantedKnown: 2,
              plantedRecovered: recovered,
              roundTrip: 'pass',
              unchangedReference: true,
            }),
          );
        } catch {
          throw Error(`${label}: section proof failed at ${stage} (private details suppressed)`);
        }
        tested++;
      }
    }
    expect(tested).toBe(process.env.GHOST_SECTIONS_SONG ? 1 : 6);
  },
  55000,
);
