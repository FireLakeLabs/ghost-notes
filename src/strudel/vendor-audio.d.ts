declare module '@strudel/web' {
  export { webaudioOutput } from '@strudel/webaudio';
  export {
    getAudioContext,
    initAudio,
    getSound,
    registerSound,
    getSampleInfo,
    loadBuffer,
    samples,
    getSuperdoughAudioController,
  } from 'superdough';
  export interface AudioRepl {
    evaluate(code: string, autoplay: boolean): Promise<import('./index').Pattern | undefined>;
    setPattern(
      pattern: import('./index').Pattern,
      autoplay: boolean,
    ): Promise<import('./index').Pattern>;
    setCps(cps: number): void;
    scheduler: import('./index').Scheduler;
    stop(): void;
    state: { error?: Error };
  }
  export function initStrudel(options: {
    sync: boolean;
    miniAllStrings: boolean;
    editPattern(pattern: import('./index').Pattern): import('./index').Pattern;
    defaultOutput(
      hap: import('./index').Hap,
      deadline: number,
      duration: number,
      cps: number,
      time: number,
    ): Promise<void>;
  }): Promise<AudioRepl>;
}
declare module '@strudel/webaudio' {
  export { getSound, setAudioContext } from 'superdough';
  export function webaudioOutput(
    hap: import('./index').Hap,
    deadline: number,
    duration: number,
    cps: number,
    time: number,
  ): Promise<void>;
}
declare module 'superdough' {
  export function getAudioContext(): AudioContext;
  export function initAudio(): Promise<void>;
  export interface Sound {
    onTrigger(time: number, value: unknown, onended: () => void): Promise<unknown>;
    data: { type?: string; samples?: unknown; fonts?: string[] };
  }
  export function getSound(name: string): Sound | undefined;
  export function registerSound(
    name: string,
    onTrigger: Sound['onTrigger'],
    data: Sound['data'],
  ): void;
  export function setAudioContext(context: AudioContext): void;
  export function getSampleInfo(value: unknown, samples: unknown): { url: string };
  export function loadBuffer(
    url: string,
    context: AudioContext,
    name: string,
  ): Promise<AudioBuffer>;
  export function samples(map: object, base?: string): Promise<void>;
  export function getSuperdoughAudioController(): { output: { destinationGain: GainNode } };
}

declare module '@strudel/soundfonts/fontloader.mjs' {
  export function registerSoundfonts(): void;
  export function getFontBufferSource(
    name: string,
    value: unknown,
    context: AudioContext,
  ): Promise<AudioBufferSourceNode>;
}
