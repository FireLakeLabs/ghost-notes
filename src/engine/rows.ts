import type { Engine } from '../contract';
import type { OpenReference } from '../app/reference';
import { conversionSpans, secondsToCycle } from '../convert';
import type { ReferenceNote } from '../reference/types';
import type { PlainEvent } from '../strudel';
import { drumLane } from '../strudel/drums';
import type { PlaybackRows } from '../strudel/playback-rows';

export const rowKinds = ['audio', 'midi', 'notes', 'mine'] as const;
export type RowKind = (typeof rowKinds)[number];
export type RowChoice = Record<RowKind, boolean>;
export const rowPresets = {
  Recording: { audio: true, midi: false, notes: false, mine: false },
  Mine: { audio: false, midi: false, notes: false, mine: true },
  Both: { audio: true, midi: false, notes: false, mine: true },
} satisfies Record<string, RowChoice>;
export type RowPreset = keyof typeof rowPresets;
export const pitchedSounds = [
  { value: 'triangle', label: 'Synth: triangle' },
  { value: 'sine', label: 'Synth: sine' },
  { value: 'sawtooth', label: 'Synth: sawtooth' },
  { value: 'gm_piano', label: 'Sample: piano' },
  { value: 'gm_epiano1', label: 'Sample: electric piano' },
  { value: 'gm_electric_bass_finger', label: 'Sample: electric bass' },
] as const;
export const drumSounds = [
  { value: '', label: 'Samples: default kit' },
  { value: 'RolandTR808', label: 'Samples: TR-808' },
  { value: 'RolandTR909', label: 'Samples: TR-909' },
] as const;
export const soundsFor = (stemId: string) => (stemId === 'drums' ? drumSounds : pitchedSounds);
export type RowPlan = PlaybackRows & { audioIds: readonly string[]; mine: boolean };

/** Preserve original onsets for MIDI and written onsets for Notes. Values are
 * complete here; drawing samples and contours never enter playback.
 */
export function referenceEvents(
  reference: OpenReference,
  stemId: string,
  notes: readonly ReferenceNote[],
  sound: string,
): PlainEvent[] {
  const spans = conversionSpans(reference.song, reference.song.bars);
  return notes.map((note) => {
    const start = secondsToCycle(reference.song, spans, note.startSeconds);
    const end = secondsToCycle(reference.song, spans, note.endSeconds);
    const lane = drumLane(note.pitch);
    if (stemId === 'drums' && lane === null)
      throw Error('Cannot play this transcription drum class');
    const value =
      stemId === 'drums'
        ? {
            s: ['cr', 'hh', 'sd', 'lt', 'bd'][lane ?? 0],
            bank: sound,
            gain: note.velocity / 127,
            duration: end - start,
          }
        : { note: note.pitch, s: sound, gain: note.velocity / 127, duration: end - start };
    return { whole: [start, end], part: [start, end], hasOnset: true, value };
  });
}

/** Adapt the existing song API to the editor's canonical-cycle Engine port.
 * A live document revision uses update, so retained stems keep their phase.
 */
export async function createRowEngine(reference: OpenReference, plan: () => RowPlan) {
  const { createSongPlayback } = await import('./playback');
  const playback = await createSongPlayback(reference.song, reference.audio, plan);
  const engine: Engine = {
    ...playback.clock,
    get playing() {
      return playback.clock.playing;
    },
    async play(code, options) {
      const selected = plan();
      const synthesized = selected.mine || selected.reference.length > 0;
      const source = selected.mineIds.length ? code : 'silence';
      if (playback.clock.playing) return playback.update(source);
      return playback.play({
        code: source,
        fromCycle: options?.fromCycle ?? 0,
        mode: synthesized ? (selected.audioIds.length ? 'both' : 'mine') : 'recording',
        stemIds: selected.audioIds,
      });
    },
    stop: playback.stop,
  };
  return { engine, dispose: playback.dispose };
}
