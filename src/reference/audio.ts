import type { ReferenceSong, SongFiles } from './types';
export type DecodedAudio = {
  sampleRate: number;
  length: number;
  numberOfChannels: number;
  getChannelData(channel: number): Float32Array;
};
export type StemAudio<T extends DecodedAudio = DecodedAudio> = {
  buffer: T;
  /** Interleaved minimum/maximum per bin, across all channels; no cancellation. */
  peaks: Float32Array;
  decodeMs: number;
  peaksMs: number;
  encodedBytes: number;
  pcmBytes: number;
};
export function waveformPeaks(buffer: DecodedAudio, framesPerBin = 1024): Float32Array {
  if (!Number.isInteger(framesPerBin) || framesPerBin < 1) throw Error('Invalid waveform bin size');
  const peaks = new Float32Array(Math.ceil(buffer.length / framesPerBin) * 2);
  for (let bin = 0; bin < peaks.length / 2; bin++) {
    const start = bin * framesPerBin,
      end = Math.min(buffer.length, start + framesPerBin);
    let min = Infinity,
      max = -Infinity;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      for (let i = start; i < end; i++) {
        min = Math.min(min, samples[i]);
        max = Math.max(max, samples[i]);
      }
    }
    peaks[bin * 2] = min;
    peaks[bin * 2 + 1] = max;
  }
  return peaks;
}
/** Sequential decoding bounds transient encoded bytes to one stem. Caller owns PCM lifetime. */
export async function decodeReferenceAudio<T extends DecodedAudio>(
  song: ReferenceSong,
  files: SongFiles,
  decode: (bytes: ArrayBuffer) => Promise<T>,
): Promise<ReadonlyMap<string, StemAudio<T>>> {
  const stems = new Map<string, StemAudio<T>>();
  for (const stem of song.stems) {
    const bytes = await files.read(stem.audioPath),
      encodedBytes = bytes.byteLength;
    const start = performance.now();
    let buffer: T;
    try {
      const encoded =
        bytes.buffer instanceof ArrayBuffer &&
        bytes.byteOffset === 0 &&
        bytes.byteLength === bytes.buffer.byteLength
          ? bytes.buffer
          : new Uint8Array(bytes).buffer;
      buffer = await decode(encoded);
    } catch {
      throw Error(
        'Cannot decode a stem. Check that its audio file is complete and supported by this browser.',
      );
    }
    const decodeMs = performance.now() - start;
    const peakStart = performance.now(),
      peaks = waveformPeaks(buffer),
      peaksMs = performance.now() - peakStart;
    stems.set(stem.id, {
      buffer,
      peaks,
      peaksMs,
      decodeMs,
      encodedBytes,
      pcmBytes: buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT,
    });
  }
  return stems;
}
export async function browserAudio(song: ReferenceSong, files: SongFiles) {
  const context = new AudioContext({ sampleRate: 44100 });
  try {
    return await decodeReferenceAudio(song, files, (bytes) => context.decodeAudioData(bytes));
  } finally {
    await context.close();
  }
}
