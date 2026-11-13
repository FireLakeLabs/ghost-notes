/** Same v1 rule as the model-free transcription contract: sustained interval
 * runs are timing evidence, while isolated large holes remain coverage gaps. */
export function classifyIntervals(beats: readonly number[]) {
  const intervals = beats.slice(1).map((b, i) => b - beats[i]);
  const median = (values: number[]) => {
    values.sort((a, b) => a - b);
    const i = values.length >> 1;
    return values.length % 2 ? values[i] : (values[i - 1] + values[i]) / 2;
  };
  const baseline = median([...intervals]);
  const gaps: [number, number][] = [],
    level_switches: [number, number][] = [];
  for (let i = 0; i < intervals.length;) {
    let end = i + 1;
    while (end < intervals.length && Math.abs(intervals[end] / intervals[i] - 1) <= 0.15) end++;
    const local = median([
      ...intervals.slice(Math.max(0, i - 4), i),
      ...intervals.slice(end, end + 4),
    ]);
    const previous = intervals[i - 1];
    if (
      end - i >= 2 &&
      (intervals[i] > 1.5 * baseline ||
        (previous && [0.5, 2].some((f) => Math.abs(intervals[i] / previous / f - 1) <= 0.15)))
    )
      level_switches.push([beats[i], beats[end]]);
    if (end - i === 1 && intervals[i] > 1.5 * local && intervals[i] > 1.5 * baseline)
      gaps.push([beats[i], beats[end]]);
    i = end;
  }
  return { gaps, level_switches };
}
