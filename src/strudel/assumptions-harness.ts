// Test-only page: use the web bundle's own scheduler, not the Node Cyclist.
import {
  initStrudel,
  getAudioContext,
  samples,
  getSound,
  getSampleInfo,
  loadBuffer,
} from '@strudel/web';
const triggers: {
  cycle: number;
  time: number;
  duration: number;
  cps: number;
  value: unknown;
  lead: number;
}[] = [];
const repl = await initStrudel({
  sync: false,
  miniAllStrings: false,
  editPattern: (p) => p,
  defaultOutput: async (hap, _deadline, duration, cps, time) => {
    triggers.push({
      cycle: Number(hap.whole?.begin),
      time,
      duration,
      cps,
      value: hap.value,
      lead: time - getAudioContext().currentTime,
    });
  },
});
const proof = {
  triggers,
  async play(source: string) {
    repl.stop();
    triggers.length = 0;
    await getAudioContext().resume();
    await repl.evaluate(source, true);
    if (repl.state.error) throw repl.state.error;
  },
  async bank(url: string, name: string) {
    const response = await fetch(url);
    if (!response.ok) throw Error(`Bank HTTP ${response.status}`);
    const map = await response.json();
    await samples(map, map._base ?? new URL('.', url).href);
    const sound = getSound(name);
    if (!sound) throw Error(`Bank did not register ${name}`);
    const value = { s: name, note: 'c3', n: 0 };
    const info = getSampleInfo(value, sound.data.samples);
    const buffer = await loadBuffer(info.url, getAudioContext(), name);
    return { frames: buffer.length, seconds: buffer.duration, url: info.url };
  },
  hasSound: (name: string) => !!getSound(name),
  stop: () => repl.stop(),
};
declare global {
  interface Window {
    strudelProof: typeof proof;
  }
}
window.strudelProof = proof;
