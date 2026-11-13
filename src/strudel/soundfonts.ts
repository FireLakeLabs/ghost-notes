// The pinned fontloader submodule avoids the package entry's unrelated
// Pattern.prototype.soundfont side effect and SF2 parser. Canary: engine.spec.ts.
import { getFontBufferSource, registerSoundfonts } from '@strudel/soundfonts/fontloader.mjs';
import { getSoundIndex } from '@strudel/core';
import { getSound as fontSound, setAudioContext } from '@strudel/webaudio';
import { getSound, registerSound } from '@strudel/web';

let registered = false;
export async function prepareGeneralMidi(name: string, value: unknown, context: AudioContext) {
  // @strudel/web bundles its own Superdough registry/context. The fontloader
  // imports standalone webaudio: share the context, then bridge the sound entry.
  setAudioContext(context);
  if (!registered) {
    registerSoundfonts();
    registered = true;
  }
  const sound = fontSound(name);
  if (!sound || sound.data.type !== 'soundfont' || !sound.data.fonts) return;
  if (!getSound(name)) registerSound(name, sound.onTrigger, sound.data);
  const n = value && typeof value === 'object' && 'n' in value ? value.n : undefined;
  const font = sound.data.fonts[getSoundIndex(n, sound.data.fonts.length)];
  // Warm every pitch/variant before scheduling; upstream caches the decoded
  // buffer. This unused node has not been started or connected.
  await getFontBufferSource(font, value, context);
}
