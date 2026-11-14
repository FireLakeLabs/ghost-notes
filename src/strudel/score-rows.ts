import type { EventResult } from '../contract';

/** Split one actual whole-program answer by the same row tags used in playback.
 * Unknown lineage, errors and opaque values retain the per-row question path.
 */
export function scoreRows(
  answer: EventResult,
  ids: readonly string[],
): Record<string, EventResult> | null {
  if (answer.error || answer.opaqueValues || new Set(ids).size !== ids.length) return null;
  const rows = new Map<string, EventResult>(ids.map((id) => [id, { ...answer, events: [] }]));
  for (const event of answer.events) {
    const row = event.instrumentId ? rows.get(event.instrumentId) : undefined;
    if (!row) return null;
    const value = { ...event };
    delete value.instrumentId;
    row.events.push(value);
  }
  return Object.fromEntries(rows);
}
