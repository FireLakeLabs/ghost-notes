// Invented song, real web bundle and native sources. No private material.
import { getSound, getAudioContext } from '@strudel/web';
import { createSongPlayback } from '../engine/playback';
import { readReference } from '../reference/reader';
import { decodeReferenceAudio } from '../reference/audio';
import { secondsToPosition } from '../reference/beats';
import { convertInstrument } from '../convert';
import { generatedWav, referenceFixture } from '../../tests/fixtures/reference';
import type { EngineEvent } from '../contract';

const files = referenceFixture();
files.set('stems/bass.wav', generatedWav(8));
const song = await readReference({
  read: async (p) => {
    const bytes = files.get(p);
    if (!bytes) throw Error('Missing fixture');
    return bytes.slice();
  },
  exists: async (p) => files.has(p),
});
const expected = [0, 0.25, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4.5, 5.5, 6.5, 7.5, 7.9];
song.stems = [
  {
    ...song.stems[0],
    notes: expected.flatMap((t) =>
      [60, 64].map((pitch) => ({
        pitch,
        velocity: 100,
        startSeconds: t,
        endSeconds: t + 0.05,
        start: secondsToPosition(song.beatMap, t),
        end: secondsToPosition(song.beatMap, t + 0.05),
      })),
    ),
  },
  { ...song.stems[0], id: 'keys', notes: [] },
];
const decoder = new AudioContext();
const buffers = await decodeReferenceAudio(
  song,
  {
    read: async (p) => {
      const bytes = files.get(p);
      if (!bytes) throw Error('Missing fixture');
      return bytes.slice();
    },
    exists: async (p) => files.has(p),
  },
  (bytes) => decoder.decodeAudioData(bytes),
);
await decoder.close();
const stems: { stem: string; time: number; offset: number; lead: number; rate: number }[] = [];
const nativeStart = AudioBufferSourceNode.prototype.start;
AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration?: number) {
  for (const [stem, entry] of buffers)
    if (entry.buffer === this.buffer)
      stems.push({
        stem,
        time: when,
        offset,
        lead: when - this.context.currentTime,
        rate: this.playbackRate.value,
      });
  if (duration === undefined) nativeStart.call(this, when, offset);
  else nativeStart.call(this, when, offset, duration);
};
const playback = await createSongPlayback(song, buffers);
const triggers: { time: number; lead: number }[] = [];
const sound = getSound('sine');
if (!sound) throw Error('Missing sine');
const trigger = sound.onTrigger;
sound.onTrigger = async (time, value, ended, cps) => {
  triggers.push({ time, lead: time - getAudioContext().currentTime });
  return trigger(time, value, ended, cps);
};
const events: EngineEvent[] = [];
playback.subscribe((e) => events.push(e));
const conversion = convertInstrument({ song, stemId: 'bass', grid: 'exact' });
const written = conversion.notes.map((n) => n.written.startSeconds).sort((a, b) => a - b);
const source = conversion.source.replaceAll('"triangle"', '"sine"');
const proof = {
  playback,
  triggers,
  stems,
  events,
  expected,
  written,
  source,
  async reopen() {
    const next = await createSongPlayback(song, buffers);
    next.subscribe((e) => events.push(e));
    return next;
  },
  now: () => getAudioContext().currentTime,
};
declare global {
  interface Window {
    playbackProof: typeof proof;
    playbackInitError: string;
  }
}
window.playbackProof = proof;
