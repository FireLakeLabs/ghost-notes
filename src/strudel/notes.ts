import { noteToMidi, freqToMidi } from '@strudel/core';
import type { PlainEvent } from './index';

export type ScoredNote = { startCycle: number; endCycle: number; pitch: number; velocity: number };
const drums: Record<string, number> = {
  bd: 35,
  kick: 35,
  sd: 38,
  sn: 38,
  snare: 38,
  cp: 38,
  hh: 42,
  oh: 42,
  ch: 42,
  lt: 47,
  mt: 47,
  ht: 47,
  cr: 49,
  crash: 49,
  rd: 49,
};
/** Read queried values, never source text. Pinned Hap.duration is duration × clip. */
export function scoredNotes(events: readonly PlainEvent[], drumKit = false) {
  const notes: ScoredNote[] = [];
  let unmapped = 0;
  for (const event of events) {
    if (!event.hasOnset || !event.whole) continue;
    const value = event.value;
    if (!value || typeof value !== 'object') {
      unmapped++;
      continue;
    }
    const bag = value as Record<string, unknown>;
    let pitch: number | undefined;
    try {
      const sample = typeof bag.s === 'string' ? bag.s.split(':')[0] : '';
      if (drumKit && sample in drums) pitch = drums[sample];
      else if (typeof bag.freq === 'number' && bag.freq > 0) pitch = freqToMidi(bag.freq);
      else if (typeof bag.note === 'number') pitch = bag.note;
      else if (typeof bag.note === 'string') pitch = noteToMidi(bag.note);
    } catch {
      /* An unknown note stays explicitly unmapped. */
    }
    if (pitch === undefined || !Number.isFinite(pitch)) {
      unmapped++;
      continue;
    }
    const duration =
      typeof bag.duration === 'number' ? bag.duration : event.whole[1] - event.whole[0];
    const clip = typeof bag.clip === 'number' ? bag.clip : 1;
    const gain = typeof bag.gain === 'number' ? bag.gain : 1;
    if (![duration, clip, gain].every(Number.isFinite) || duration < 0 || clip < 0) {
      unmapped++;
      continue;
    }
    notes.push({
      startCycle: event.whole[0],
      endCycle: event.whole[0] + duration * clip,
      pitch,
      velocity: Math.max(0, Math.min(127, gain * 127)),
    });
  }
  return { notes, unmapped };
}
