import { expect, test } from 'vitest';
import { waveformPeaks, decodeReferenceAudio } from './audio';
import { readReference } from './reader';
import { referenceFixture } from '../../tests/fixtures/reference';
test('waveform preserves opposite-polarity channels and the partial last bin', () => {
  const channels = [new Float32Array([0.25, 0.1, 0.75]), new Float32Array([-0.5, -0.1, -1])];
  const peaks = waveformPeaks(
    { sampleRate: 8000, length: 3, numberOfChannels: 2, getChannelData: (c) => channels[c] },
    2,
  );
  expect(Array.from(peaks)).toEqual([-0.5, 0.25, -1, 0.75]);
});
test('decode failure is clear and contains no private API error', async () => {
  const fixture = referenceFixture(),
    files = {
      read: async (p: string) => fixture.get(p)!,
      exists: async (p: string) => fixture.has(p),
    };
  const song = await readReference(files);
  await expect(
    decodeReferenceAudio(song, files, async () => {
      throw Error('PRIVATE');
    }),
  ).rejects.toThrow('Cannot decode a stem');
});

test('waveform retains actual extrema when all samples have one polarity', () => {
  const peaks = waveformPeaks({
    sampleRate: 8000,
    length: 2,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array([0.25, 0.5]),
  });
  expect(Array.from(peaks)).toEqual([0.25, 0.5]);
});
