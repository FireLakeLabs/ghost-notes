import type { Engine, EngineEvent } from '../contract';
import type { PlaybackRows } from '../strudel/playback-rows';
import type { StemAudio } from '../reference/audio';
import type { Position, ReferenceSong } from '../reference/types';
import { secondsToPosition } from '../reference/beats';
import { createAudio } from '../strudel/audio';
import { createBrowserQueries } from '../strudel/evaluate-browser';
import { engineWith } from './index';
import { PREFLIGHT_TIMEOUT } from './playback-limits';
import { songTime } from './song-time';

export type PlaybackMode = 'recording' | 'mine' | 'both';
export type SongPlayOptions = {
  code: string;
  mode?: PlaybackMode;
  stemIds?: readonly string[];
} & ({ fromBar?: number; fromCycle?: never } | { fromCycle: number; fromBar?: never });
export interface SongPlayback {
  /** Canonical-cycle clock and diagnostics for the shared editor/controller. */
  clock: Omit<Engine, 'play' | 'stop'>;
  /** Full song code, cycle zero as in conversionSpans; omitted bar includes edges. */
  play(options: SongPlayOptions): Promise<number>;
  /** Retain the clock; Recording commits silence without evaluating Mine. */
  update(code: string): Promise<number>;
  stop(): void;
  /** Release this transport before replacing its song or grid. */
  dispose(): void;
  state(): {
    playing: boolean;
    recording: readonly string[];
    mine: boolean;
    position: Position | null;
  };
  subscribe(listener: (event: EngineEvent) => void): () => void;
}

/** One retained song and one transport. All sources use Strudel's AudioContext. */
export async function createSongPlayback(
  song: ReferenceSong,
  buffers: ReadonlyMap<string, StemAudio<AudioBuffer>>,
  rows?: () => PlaybackRows,
): Promise<SongPlayback> {
  const timing = songTime(song);
  const sources = new Map<string, AudioBufferSourceNode>();
  let selection: readonly string[] = [],
    mine = false,
    from = 0;
  let disposed = false;
  let endTimer: ReturnType<typeof setTimeout> | undefined;
  const stopSources = () => {
    clearTimeout(endTimer);
    for (const source of sources.values()) {
      source.stop();
      source.disconnect();
    }
    sources.clear();
  };
  const audio = await createAudio({
    timing,
    rows,
    onClockStart(origin) {
      for (const id of selection) {
        const buffer = buffers.get(id)?.buffer;
        if (!buffer || from >= buffer.duration) continue;
        const source = audio.context.createBufferSource();
        source.buffer = buffer;
        source.connect(audio.context.destination);
        source.onended = () => {
          source.disconnect();
          if (sources.get(id) === source) sources.delete(id);
        };
        sources.set(id, source);
        source.start(origin + from, from);
      }
      const finish = () => {
        const remaining = origin + timing.end - audio.context.currentTime;
        if (remaining > 0) endTimer = setTimeout(finish, remaining * 1000);
        else engine.stop();
      };
      finish();
    },
  });
  const queries = createBrowserQueries();
  const engine = engineWith(
    {
      ...audio,
      async preflight(code, seconds, starts) {
        const result = await queries.preflight(
          code,
          timing.toCycle(seconds),
          starts.map(timing.toCycle),
          audio.cps(),
        );
        if (result.error)
          throw Error(
            result.error.phase === 'timeout'
              ? PREFLIGHT_TIMEOUT
              : 'This program could not be checked, so it was not played.',
          );
        const selected = rows?.();
        if (selected?.mineIds.length && result.events.some((e) => e.hasOnset && !e.instrumentId))
          throw Error('Cannot identify this Mine voice. Link its instrument before playback.');
        return selected
          ? [
              ...result.events
                .filter((e) => e.instrumentId && selected.mineIds.includes(e.instrumentId))
                .map((e) => e.value),
              ...selected.reference.flatMap((r) => r.events.map((e) => e.value)),
            ]
          : result.events.map((e) => e.value);
      },
    },
    audio.connect,
  );
  engine.subscribe((event) => {
    if (event.type === 'transport' && !event.playing) stopSources();
  });
  function stop() {
    engine.stop();
  }
  const subscribe: Engine['subscribe'] = (listener) =>
    engine.subscribe((event) =>
      listener('cycle' in event ? { ...event, cycle: timing.toCycle(event.cycle) } : event),
    );
  return {
    clock: {
      get playing() {
        return engine.playing;
      },
      now: () => {
        const seconds = engine.now();
        return seconds === null ? null : timing.toCycle(seconds);
      },
      audioTime: engine.audioTime,
      outputLatency: engine.outputLatency,
      sounds: engine.sounds,
      tap: engine.tap,
      subscribe,
    },
    async play({ code, fromBar, fromCycle, mode = 'both', stemIds = song.stems.map((s) => s.id) }) {
      if (disposed) throw Error('Playback is disposed');
      if (fromBar !== undefined && fromCycle !== undefined)
        throw Error('Choose one playback start');
      const bar =
        fromBar === undefined
          ? undefined
          : song.bars.find((b) => b.number === fromBar && b.endSeconds > b.startSeconds);
      if (fromBar !== undefined && !bar) throw Error('Choose a numbered bar in this song');
      const selected = mode === 'mine' ? [] : [...new Set(stemIds)];
      for (const id of selected)
        if (!song.stems.some((s) => s.id === id) || !buffers.has(id))
          throw Error('Selected stem audio is unavailable');
      stop();
      selection = selected;
      mine = mode !== 'recording';
      from =
        fromCycle === undefined ? (bar?.startSeconds ?? timing.start) : timing.toSeconds(fromCycle);
      if (!Number.isFinite(from) || from < timing.start || from >= timing.end)
        throw Error('Choose a playback start inside this song');
      try {
        return await engine.play(mine ? code : 'silence', { fromCycle: from });
      } catch (error) {
        if (!engine.playing) stopSources();
        throw error;
      }
    },
    update(code) {
      if (disposed) return Promise.reject(Error('Playback is disposed'));
      if (!engine.playing) return Promise.reject(Error('Start playback before updating its code'));
      return engine.play(mine ? code : 'silence');
    },
    stop,
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      queries.cancel();
      audio.close();
    },
    state() {
      const seconds = engine.now();
      return {
        playing: engine.playing,
        recording: [...sources.keys()],
        mine: engine.playing && mine,
        position:
          seconds === null
            ? null
            : secondsToPosition(song.beatMap, Math.max(from, Math.min(timing.end, seconds))),
      };
    },
    subscribe,
  };
}
