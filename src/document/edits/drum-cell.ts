import { sectionInstruments, sections, type Doc, type Pattern, type Instrument } from '../index';
import { drumCellLayer } from '../../strudel/drum-cell';
import { freshIds, replaceNode, type Refusal } from './shared';

/** A queried cell needs the same lane/time coordinates at its definition. */
export function drumCellIssue(doc: Doc, row: Instrument | undefined, placeId: string): string {
  if (!row) return 'Choose one linked drum pattern in the lens';
  const uses = row.uses.filter((u) => u.path.some((n) => n.id === placeId));
  if (uses.some((u) => u.muted)) return 'Unmute this place before editing drum cells';
  if (uses.length !== 1) return 'This place needs its source editor rather than drum cells';
  const use = uses[0],
    start = use.path.findIndex((n) => n.id === placeId);
  const altered =
    doc.body.some((n) => n.kind === 'transform') ||
    row.pattern.layers.some(
      (l) =>
        l.kind === 'settings' &&
        l.settings.some((s) => !['gain', 'duration', 'clip'].includes(s.name)),
    ) ||
    use.layers.some(
      (l) =>
        l.kind !== 'settings' ||
        l.settings.some((s) => ['s', 'sound', 'note', 'n', 'freq'].includes(s.name)),
    ) ||
    use.path
      .slice(start + 1, -1)
      .some((n) => 'core' in n && n.core.kind === 'group' && n.core.how !== 'stack');
  return altered ? 'This place has outer rewrites or sound settings; use its source editor' : '';
}

/** One shared-definition edit; callers decide on/off from the latest queried score. */
export function setDrumCell(
  doc: Doc,
  cell: {
    placeId: string;
    lane: number;
    from: number;
    to: number;
    at: number;
    duration: number;
    on: boolean;
  },
): Doc | Refusal {
  const place = sections(doc).find((p) => p.id === cell.placeId);
  const row = sectionInstruments(doc, cell.placeId).find((r) => r.pattern.stem === 'drums');
  if (!place?.source || !row || row.patterns.length !== 1)
    return { ok: false, reason: 'Choose one linked drum pattern in the lens' };
  const issue = drumCellIssue(doc, row, cell.placeId);
  if (issue) return { ok: false, reason: issue };
  if (
    ![cell.from, cell.to, cell.at, cell.duration].every(Number.isFinite) ||
    cell.duration <= 0 ||
    cell.from < 0 ||
    cell.to > place.cycles + 1e-9 ||
    cell.to <= cell.from ||
    cell.at < cell.from ||
    cell.at >= cell.to ||
    !Number.isInteger(cell.lane) ||
    cell.lane < 0 ||
    cell.lane > 4
  )
    return { ok: false, reason: 'That drum cell is outside this section' };
  const pattern: Pattern = {
    ...row.pattern,
    layers: [
      ...row.pattern.layers,
      {
        id: freshIds(doc)('cell'),
        tier: 3,
        kind: 'opaque',
        code: drumCellLayer({ ...cell, cycles: place.cycles }),
      },
    ],
  };
  return replaceNode(doc, row.pattern.id, pattern);
}
