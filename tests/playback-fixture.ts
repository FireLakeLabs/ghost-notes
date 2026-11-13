import { readReference } from '../src/reference/reader';
import { referenceFixture } from './fixtures/reference';
import { queryEventsWithBudget } from '../src/strudel/evaluate';
import type { Pattern } from '../src/strudel';

export async function fixtureSong() {
  const files = referenceFixture();
  return readReference({
    read: async (p) => {
      const file = files.get(p);
      if (!file) throw Error('Missing fixture file');
      return file;
    },
    exists: async (p) => files.has(p),
  });
}
export async function evaluatedPattern(source: string): Promise<Pattern> {
  let pattern: Pattern | undefined;
  const result = await queryEventsWithBudget(source, 0, 0, 100000, undefined, 0.5, (p) => {
    pattern = p;
  });
  if (result.error || !pattern) throw Error('Fixture evaluation failed');
  return pattern;
}
