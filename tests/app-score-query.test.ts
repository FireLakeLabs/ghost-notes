import { beforeEach, expect, test, vi } from 'vitest';
import type { EventResult } from '../src/contract';
import { createApp } from '../src/app/controller';
import { walk } from '../src/document';
import { queryEvents } from '../src/strudel/evaluate';

// Delay only the browser boundary; real import, session, generation and Strudel
// answers exercise edits and superseded requests without wall-clock races.
const boundary = vi.hoisted(() => ({
  created: 0,
  requests: [] as {
    code: string;
    from: number;
    to: number;
    resolve(answer: EventResult): void;
  }[],
}));
vi.mock('../src/strudel/evaluate-browser', () => ({
  createBrowserQueries: () => {
    const score = boundary.created++ === 0;
    return {
      query: (code: string, from: number, to: number) =>
        score
          ? new Promise<EventResult>((resolve) =>
              boundary.requests.push({ code, from, to, resolve }),
            )
          : Promise.resolve({ events: [], cps: 0.5, error: null }),
      cancel() {},
    };
  },
}));
beforeEach(() => {
  boundary.created = 0;
  boundary.requests.length = 0;
});
const source =
  'stack(note("c3 e3").s("sine").gain(.5), note("g3 b3").s("sine").gain(.6)).arp("0 1 0 1")';

test('one reused instrument keeps the same shared value that whole-program playback uses, on load and edit', async () => {
  const app = createApp();
  try {
    await app.load(`const calls = {n: 0};
      /*@odm-shared {"purpose":"instrument"}*/ const line = (() => {
        calls.n++; return note(60 + calls.n).s('sine');
      })().gain(.5);
      $: arrange([1, line], [1, line]);`);
    expect(app.state.loadError).toBe('');
    expect(app.state.rows).toHaveLength(1);
    await answer(0);
    await vi.waitFor(() => expect(app.pendingRows.size).toBe(0));
    const notes = () =>
      Object.values(app.state.events)
        .flatMap((r) => r.events)
        .filter((e) => e.hasOnset)
        .map((e) => (e.value as { note: number }).note);
    expect(notes()).toEqual([61, 61]);
    let gain: string | undefined;
    walk(app.state.doc!, (node) => {
      if ('name' in node && node.name === 'gain') gain = node.id;
    });
    app.editor!.edit(gain!, 0.7);
    await answer(1);
    await vi.waitFor(() => expect(notes()).toEqual([61, 61]));
  } finally {
    app.editor?.dispose();
  }
});
const broken: EventResult = {
  events: [],
  cps: 0.5,
  opaqueValues: false,
  error: { phase: 'query', message: 'Cannot attribute this answer' },
};
async function answer(index: number) {
  const request = boundary.requests[index];
  request.resolve(await queryEvents(request.code, request.from, request.to));
  await Promise.resolve();
}

test('editing one voice keeps every row in the same group arpeggio context', async () => {
  const app = createApp();
  try {
    await app.load(source);
    await answer(0);
    const counts = () => app.state.rows.map((r) => app.state.events[r.id]?.events.length);
    expect(counts()).toEqual([8, 8]);
    let gain: string | undefined;
    walk(app.state.doc!, (node) => {
      if ('name' in node && node.name === 'gain') gain = node.id;
    });
    expect(gain).toBeDefined();
    app.editor!.edit(gain!, 0.7);
    // Complete all questions, whether the implementation asked together or alone.
    for (let i = 1; i < boundary.requests.length; i++) await answer(i);
    await vi.waitFor(() => {
      const events = Object.values(app.state.events).flatMap((r) => r.events);
      expect(events.filter((e) => (e.value as { gain: number }).gain === 0.7)).toHaveLength(8);
    });
    expect(counts()).toEqual([8, 8]);
  } finally {
    app.editor?.dispose();
  }
});

test('an unattributed whole answer still obtains every isolated row answer', async () => {
  const app = createApp();
  try {
    await app.load(source);
    boundary.requests[0].resolve(broken);
    await vi.waitFor(() => expect(boundary.requests).toHaveLength(3));
    await answer(1);
    await answer(2);
    await vi.waitFor(() =>
      expect(app.state.rows.map((r) => app.state.events[r.id]?.events.length)).toEqual([16, 16]),
    );
  } finally {
    app.editor?.dispose();
  }
});

test('an obsolete failed answer cannot launch fallback work or overwrite the new piece', async () => {
  const app = createApp();
  try {
    await app.load(source);
    await app.load('stack(note("c3").s("sine"), note("g3").s("sine"))');
    boundary.requests[0].resolve(broken);
    await answer(1);
    await vi.waitFor(() =>
      expect(app.state.rows.map((r) => app.state.events[r.id]?.events.length)).toEqual([4, 4]),
    );
    expect(boundary.requests).toHaveLength(2);
  } finally {
    app.editor?.dispose();
  }
});

test('a failed one-row question reports its error without queuing the same work again', async () => {
  const app = createApp();
  try {
    await app.load('note("c3").s("sine")');
    const error: EventResult = {
      events: [],
      cps: 0.5,
      opaqueValues: false,
      error: { phase: 'query', message: 'Question timed out' },
    };
    boundary.requests[0].resolve(error);
    await vi.waitFor(() => expect(app.pendingRows.size).toBe(0));
    expect(boundary.requests).toHaveLength(1);
    expect(app.state.events[app.state.rows[0].id].error).toEqual(error.error);
  } finally {
    app.editor?.dispose();
  }
});
