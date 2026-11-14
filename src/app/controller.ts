import { sections, type Doc } from '../document';
import { createEditSession, type EditSession } from '../editor/session';
import type { Engine, EngineEvent, EventResult } from '../contract';
import { generate } from '../generate';
import { importStrudel } from '../import';
import { createEngine } from '../engine';
import { createBrowserQueries } from '../strudel/evaluate-browser';
import { scoreRows } from '../strudel/score-rows';
import {
  initialState,
  editedPiece,
  setSolo,
  playbackOptions,
  loadPiece,
  loadFailure,
  selectSection,
  setFollow,
  tick,
  mergeSounds,
  observeSoundNotice,
  startCycle,
  type AppState,
} from './state';

export function createApp() {
  let state = initialState(),
    engine: Engine | null = null;
  let editor: EditSession | null = null;
  const dirtyRows = new Set<string>();
  let pendingRows = new Set<string>();
  let visiblePending = pendingRows;
  let settledEvents = state.events;
  let epoch = 0,
    windowRevision = 0,
    transportRevision = 0;
  let cachedWindow: { from: number; to: number; events: AppState['events'] } | null = null;
  let checked = false,
    starting = false;
  const queries = createBrowserQueries(),
    preflight = createBrowserQueries();
  const listeners = new Set<(state: AppState) => void>();
  const history: EngineEvent[] = [];
  const update = (next: AppState) => {
    if (next.events !== state.events || visiblePending !== pendingRows) {
      settledEvents = pendingRows.size
        ? Object.fromEntries(Object.entries(next.events).filter(([id]) => !pendingRows.has(id)))
        : next.events;
      visiblePending = pendingRows;
    }
    state = next;
    for (const listener of listeners) listener(state);
  };
  let playbackNotice: string | undefined;
  const message = (error: unknown, warning = false) => {
    const text = String(error instanceof Error ? error.message : error);
    playbackNotice = warning ? text : undefined;
    update({ ...state, message: text });
  };
  function sounds() {
    const names = Object.values(state.events).flatMap((result) =>
      result.events.flatMap((e) => {
        const s = (e.value as { s?: unknown })?.s;
        return [s].flat().filter((name): name is string => typeof name === 'string');
      }),
    );
    return mergeSounds(state.sounds, names, engine?.sounds() ?? []);
  }
  async function askWindow(affected?: string[]) {
    queries.cancel();
    const revision = ++windowRevision,
      piece = epoch;
    const { doc, fromCycle, toCycle, rows } = state;
    if (!doc) return;
    // A group rewrite can make an edit to one row change its neighbours too.
    if (rows.length > 1 || (affected && rows.some((row) => !state.events[row.id])))
      affected = undefined;
    const last = state.sections.at(-1);
    const length = last ? last.start + last.cycles : 0;
    const from = length && fromCycle < length ? 0 : fromCycle;
    const to = length && fromCycle < length ? length : toCycle;
    if (!affected && cachedWindow?.from === from && cachedWindow.to === to) {
      pendingRows = new Set();
      update({ ...state, events: cachedWindow.events, sounds: sounds() });
      return;
    }
    // The sheet and editor keep their last answers; the timeline hides pending rows.
    pendingRows = new Set(
      rows.filter((row) => !affected || affected.includes(row.id)).map((row) => row.id),
    );
    update({ ...state });
    let answers: Record<string, EventResult> | null = null;
    if (!affected && rows.length > 1) {
      const answer = await queries.query(generate(doc, { instrumentTags: true }), from, to);
      if (piece !== epoch || revision !== windowRevision) return;
      answers = scoreRows(
        answer,
        rows.map((row) => row.id),
      );
    }
    if (!answers) {
      const results = await Promise.all(
        rows
          .filter((row) => !affected || affected.includes(row.id))
          .map(
            async (row) =>
              [row.id, await queries.query(generate(doc, { only: row.id }), from, to)] as const,
          ),
      );
      answers = Object.fromEntries(results);
    }
    if (piece !== epoch || revision !== windowRevision) return;
    dirtyRows.clear();
    pendingRows = new Set();
    cachedWindow = {
      from,
      to,
      events: { ...(affected ? state.events : {}), ...answers },
    };
    update({ ...state, events: cachedWindow.events });
    update({ ...state, sounds: sounds() });
  }
  function observe(event: EngineEvent) {
    history.push(event);
    if (history.length > 1000) history.shift();
    if (event.type === 'swapped' || event.type === 'committed' || event.type === 'trigger')
      editor?.observe(event);
    if (event.type === 'error') message(event.message, !!event.reason);
    if (event.type === 'transport') {
      if (!event.playing) editor?.clear();
      update({ ...state, playing: event.playing });
    }
    if (event.type === 'sounds')
      update({
        ...state,
        sounds: sounds(),
        soundNotice: observeSoundNotice(state.soundNotice, event.sounds),
      });
  }
  // All engine replacements, including solo, share a serial queue.
  let swaps = Promise.resolve();
  function replacePlayback(doc: Doc, options: Parameters<Engine['play']>[1] = {}) {
    const piece = epoch,
      transport = transportRevision;
    const work = swaps.then(() => {
      if (piece !== epoch || transport !== transportRevision) return -1;
      return engine!.play(
        generate(doc, { ...playbackOptions(state), instrumentTags: true }),
        options,
      );
    });
    swaps = work.then(
      () => {},
      () => {},
    );
    return work;
  }
  async function play() {
    if (!state.doc || !checked || starting) return;
    const piece = epoch,
      transport = ++transportRevision;
    starting = true;
    update({ ...state, message: 'Preparing sounds…' });
    try {
      // Check the actual seek window too before the engine evaluates on the page.
      const fromCycle = startCycle(state);
      const result = await preflight.query(
        generate(state.doc!, playbackOptions(state)),
        fromCycle,
        fromCycle + 16,
      );
      if (piece !== epoch || transport !== transportRevision) return;
      if (result.error) throw Error(result.error.message);
      engine ??= await createEngine();
      // Subscribe once, including when Stop was pressed during initialization.
      if (!subscribed) {
        engine.subscribe(observe);
        subscribed = true;
      }
      if (piece !== epoch || transport !== transportRevision) return;
      const next = tick(state, fromCycle);
      if (next !== state) {
        update(next);
        void askWindow();
      }
      await replacePlayback(state.doc!, {
        fromCycle,
        discoverCycles: state.sections.map((s) => s.start),
      });
      if (piece === epoch && transport === transportRevision)
        update({
          ...state,
          message: state.message === 'Preparing sounds…' ? '' : state.message,
          sounds: sounds(),
        });
    } catch (error) {
      message(error);
    } finally {
      starting = false;
      update({ ...state });
    }
  }
  let subscribed = false;
  return {
    get warning() {
      return !!state.message && state.message === playbackNotice;
    },
    get pendingRows(): ReadonlySet<string> {
      return pendingRows;
    },
    get settledEvents() {
      return settledEvents;
    },
    get state() {
      return state;
    },
    get editor() {
      return editor;
    },
    get engine() {
      return engine;
    },
    history,
    get canPlay() {
      return checked && !starting;
    },
    subscribe(listener: (state: AppState) => void) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    async load(source: string) {
      let imported;
      try {
        imported = importStrudel(source);
      } catch {
        update(loadFailure(state));
        return;
      }
      editor?.dispose();
      dirtyRows.clear();
      pendingRows = new Set();
      editor = createEditSession(imported.doc, {
        playing: () => !!engine?.playing,
        play: (doc) => replacePlayback(doc, { discoverCycles: sections(doc).map((s) => s.start) }),
        changed: (pending) => update(editedPiece(state, pending.doc)),
        refresh: (_doc: Doc, ids: string[]) => {
          if (!ids.length) return;
          cachedWindow = null;
          ids.forEach((id) => dirtyRows.add(id));
          void askWindow([...dirtyRows]);
        },
      });
      const piece = ++epoch;
      checked = false;
      cachedWindow = null;
      queries.cancel();
      preflight.cancel();
      update({ ...loadPiece(state, source, imported), message: 'Asking the score…' });
      void askWindow();
      // Also question the whole program: setup-only/opaque programs may have no rows,
      // and audio.prepare asks sixteen cycles before it commits.
      const from = Math.max(0, engine?.now() ?? 0);
      const result: EventResult = await preflight.query(generate(imported.doc), from, from + 16);
      if (piece !== epoch) return;
      checked = !result.error;
      update({
        ...state,
        cps: result.error ? null : result.cps,
        message: result.error ? `Could not play this piece: ${result.error.message}` : '',
      });
      if (checked && engine?.playing) {
        try {
          await replacePlayback(imported.doc, {
            discoverCycles: sections(imported.doc).map((s) => s.start),
          });
        } catch (error) {
          message(error);
        }
      }
    },
    solo(id: string | null) {
      const next = setSolo(state, id);
      if (next === state) return;
      const previous = state.solo,
        piece = epoch;
      update(next);
      if (engine?.playing && state.doc)
        void replacePlayback(state.doc).catch((error) => {
          if (piece !== epoch || state.solo !== id) return;
          update(setSolo(state, previous));
          message(error);
        });
    },
    play,
    dismissSoundNotice() {
      update({ ...state, soundNotice: { ...state.soundNotice, visible: false } });
    },
    stop() {
      ++transportRevision;
      editor?.clear();
      engine?.stop();
      update({ ...state, playing: false, message: '' });
    },
    select(id: string) {
      const next = selectSection(state, id);
      if (next !== state) {
        update(next);
        void askWindow();
      }
    },
    follow(value: boolean) {
      update(setFollow(state, value));
      this.frame();
    },
    frame() {
      const now = engine?.now() ?? null;
      if (now !== null) editor?.observe({ type: 'progress', cycle: now });
      const next = tick(state, now);
      if (next !== state) {
        update(next);
        void askWindow();
      }
      return now;
    },
  };
}
export type App = ReturnType<typeof createApp>;
