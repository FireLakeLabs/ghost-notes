import { expect, test, vi } from 'vitest';
import type { Engine } from '../src/contract';
import { createApp } from '../src/app/controller';

vi.mock('../src/strudel/evaluate-browser', () => ({
  createBrowserQueries: () => ({
    query: async () => ({ events: [], cps: 0.5, error: null }),
    cancel() {},
  }),
}));
function transport() {
  const listeners = new Set<Parameters<Engine['subscribe']>[0]>();
  let playing = false;
  const play = vi.fn(async () => {
    playing = true;
    listeners.forEach((l) => l({ type: 'transport', playing }));
    return 1;
  });
  const engine: Engine = {
    play,
    stop() {
      playing = false;
      listeners.forEach((l) => l({ type: 'transport', playing }));
    },
    get playing() {
      return playing;
    },
    now: () => (playing ? 0 : null),
    audioTime: () => 0,
    outputLatency: () => 0,
    sounds: () => [],
    tap: () => ({ sampleRate: 48000, rms: async () => 0 }),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return { engine, dispose: vi.fn(), play };
}
test('recording can start without a draft; replacing its song stops and releases the old transport', async () => {
  const app = createApp(),
    first = transport(),
    second = transport();
  app.configurePlayback({ ready: () => true, create: async () => first });
  expect(app.canPlay).toBe(true);
  await app.play();
  expect(app.state.playing).toBe(true);
  expect(first.play).toHaveBeenCalledWith('silence', { fromCycle: 0, discoverCycles: [] });
  app.configurePlayback({ ready: () => true, create: async () => second });
  expect(first.engine.playing).toBe(false);
  expect(first.dispose).toHaveBeenCalledOnce();
  await app.play();
  first.engine.stop();
  expect(app.state.playing).toBe(true);
  app.configurePlayback(null);
  expect(second.dispose).toHaveBeenCalledOnce();
  expect(app.state.playing).toBe(false);
});
test('changing the song during preparation releases the obsolete engine without starting it', async () => {
  const app = createApp(),
    old = transport();
  let finish: ((value: ReturnType<typeof transport>) => void) | undefined;
  app.configurePlayback({
    ready: () => true,
    create: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const preparing = app.play();
  expect(finish).toBeDefined();
  app.configurePlayback(null);
  finish?.(old);
  await preparing;
  expect(old.play).not.toHaveBeenCalled();
  expect(old.dispose).toHaveBeenCalledOnce();
  expect(app.state.playing).toBe(false);
});

test('a cancelled old transport cannot publish its late preparation error for the new song', async () => {
  const app = createApp(),
    old = transport();
  let fail: ((error: Error) => void) | undefined;
  let began: (() => void) | undefined;
  const entered = new Promise<void>((resolve) => {
    began = resolve;
  });
  old.play.mockImplementation(
    () =>
      new Promise<number>((_resolve, reject) => {
        fail = reject;
        began?.();
      }),
  );
  app.configurePlayback({ ready: () => true, create: async () => old });
  const starting = app.play();
  await entered;
  app.configurePlayback(null);
  fail?.(Error('Old audio preparation cancelled'));
  await starting;
  expect(app.state.message).toBe('');
  expect(app.state.playing).toBe(false);
});
