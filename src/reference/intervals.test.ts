import { expect, test } from 'vitest';
import fixtures from '../../tests/fixtures/intervals.json';
import { classifyIntervals } from './intervals';
for (const fixture of fixtures)
  test(`interval contract: ${fixture.case}`, () => {
    expect(classifyIntervals(fixture.beats)).toEqual({
      gaps: fixture.gaps,
      level_switches: fixture.level_switches,
    });
  });
