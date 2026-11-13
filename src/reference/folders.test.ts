import { expect, test } from 'vitest';
import { dropAccess, songChoices } from './folders';
import { referenceFixture } from '../../tests/fixtures/reference';
function files(map: Map<string, Uint8Array>) {
  return {
    read: async (p: string) => {
      const bytes = map.get(p);
      if (!bytes) throw Error('Missing');
      return bytes;
    },
    exists: async (p: string) => map.has(p),
  };
}
test('source manifest chooses only listed songs and scopes paths', async () => {
  const fixture = referenceFixture(),
    source = new Map<string, Uint8Array>();
  for (const [path, bytes] of fixture) source.set(`songs/one/${path}`, bytes);
  source.set(
    'manifest.json',
    new TextEncoder().encode(JSON.stringify({ version: 1, pieces: [{ folder: 'songs/one' }] })),
  );
  const choices = await songChoices(files(source));
  expect(choices.map((c) => c.label)).toEqual(['Song 1']);
  expect(await choices[0].files.read('song.json')).toEqual(fixture.get('song.json'));
  await expect(choices[0].files.read('../private')).rejects.toThrow('relative file path');
});
test('source folder rejects unsupported versions and traversal', async () => {
  for (const manifest of [
    { version: 2, pieces: [] },
    { version: 1, pieces: [{ folder: '../private' }] },
  ])
    await expect(
      songChoices(
        files(new Map([['manifest.json', new TextEncoder().encode(JSON.stringify(manifest))]])),
      ),
    ).rejects.toThrow();
});

test('fallback input cancellation is an abort, not an invalid folder', async () => {
  await expect(dropAccess(async () => []).open()).rejects.toMatchObject({ name: 'AbortError' });
});
