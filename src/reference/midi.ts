import { parseMidi } from 'midi-file';

/** MIDI is secondary evidence. Tempo events convert ticks, never detected beats. */
export function midiNotes(bytes: Uint8Array): [number, number, number, number][] {
  try {
    const data = parseMidi(bytes);
    const ppq = data.header.ticksPerBeat;
    if (!ppq || data.header.format === 2) throw Error('Unsupported MIDI timing');
    const tracks = data.tracks.map((events) => {
      let tick = 0;
      return events.map((event) => ({ tick: (tick += event.deltaTime), event }));
    });
    const tempos = tracks
      .flat()
      .filter(({ event }) => event.type === 'setTempo')
      .sort((a, b) => a.tick - b.tick);
    function seconds(tick: number) {
      let time = 0,
        previous = 0,
        us = 500000;
      for (const item of tempos) {
        if (item.tick > tick) break;
        time += ((item.tick - previous) * us) / ppq! / 1e6;
        previous = item.tick;
        if (item.event.type === 'setTempo') us = item.event.microsecondsPerBeat;
      }
      return time + ((tick - previous) * us) / ppq! / 1e6;
    }
    const notes: [number, number, number, number][] = [];
    for (const track of tracks) {
      const active = new Map<string, { tick: number; velocity: number }[]>();
      for (const { tick, event } of track) {
        if (event.type !== 'noteOn' && event.type !== 'noteOff') continue;
        const key = `${event.channel}:${event.noteNumber}`;
        const queue = active.get(key) ?? [];
        if (event.type === 'noteOn' && event.velocity > 0) {
          queue.push({ tick, velocity: event.velocity });
          active.set(key, queue);
        } else {
          const start = queue.shift();
          if (!start) throw Error('Unpaired MIDI note');
          notes.push([seconds(start.tick), seconds(tick), event.noteNumber, start.velocity]);
        }
      }
      if ([...active.values()].some((queue) => queue.length)) throw Error('Unclosed MIDI note');
    }
    return notes.sort((a, b) => a[0] - b[0]);
  } catch {
    throw Error('Cannot read reference MIDI. Export the song again.');
  }
}
