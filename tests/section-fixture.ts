import { fixtureSong } from './playback-fixture';
import { secondsToPosition } from '../src/reference/beats';
import type { ReferenceBar } from '../src/reference/types';
/** Invented two-stem song: pickup, three identical two-bar phrases, variable tempos. */
export async function sectionFixture() {
  const base = await fixtureSong(),
    bars: ReferenceBar[] = [];
  const beats = [0, 0.5],
    downbeats = [0.5];
  let seconds = 0.5;
  bars.push({
    number: 0,
    startSeconds: 0,
    endSeconds: 0.5,
    startBeat: -1,
    endBeat: 0,
    bpm: 120,
    partial: true,
    gaps: [],
  });
  for (let number = 1; number <= 16; number++) {
    const step = number >= 5 && number <= 6 ? 0.75 : 0.5;
    const start = seconds;
    for (let i = 0; i < 4; i++) {
      seconds += step;
      beats.push(seconds);
    }
    downbeats.push(seconds);
    bars.push({
      number,
      startSeconds: start,
      endSeconds: seconds,
      startBeat: (number - 1) * 4,
      endBeat: number * 4,
      bpm: 60 / step,
      partial: false,
      gaps: [],
    });
  }
  const map = {
    ...base.beatMap,
    beats,
    downbeats,
    durationSeconds: seconds,
    coverage: {
      ...base.beatMap.coverage,
      gaps: [],
      first_beat_seconds: 0,
      last_beat_seconds: seconds,
      trailing_seconds: 0,
    },
  };
  const song = {
    ...base,
    durationSeconds: seconds,
    beatMap: map,
    detectedBeatMap: map,
    bars,
    detectedBars: bars,
    grid: { ...base.grid, bars, map },
  };
  const note = (startSeconds: number, pitch: number, velocity = 100) => ({
    startSeconds,
    endSeconds: startSeconds + 0.2,
    pitch,
    velocity,
    start: secondsToPosition(map, startSeconds),
    end: secondsToPosition(map, startSeconds + 0.2),
  });
  const notes = bars.flatMap((bar) => {
    if (bar.number === 0) return [note(0, 55)];
    const phase = [1, 2, 5, 6, 9, 10, 13, 14].includes(bar.number)
      ? (bar.number - 1) % 4
      : 10 + bar.number;
    return [
      note(bar.startSeconds, 60 + phase),
      note(bar.startSeconds + (bar.endSeconds - bar.startSeconds) / 2, 64 + phase),
    ];
  });
  song.stems = [
    { ...base.stems[0], notes },
    { ...base.stems[0], id: 'drums', notes: bars.map((b) => note(b.startSeconds, 35)) },
  ];
  return song;
}
