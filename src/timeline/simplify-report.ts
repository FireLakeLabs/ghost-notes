import { secondsToCycle } from '../convert';
import type { SectionSuggestions } from '../simplify/section';
import type { Suggestion } from '../simplify';
import type { ReferenceSong } from '../reference/types';
import type { DifferenceMark } from './differences';
import { differenceDrawing, paintDifferences } from './difference-layer';
import { capCells, drumLane } from './layout';
import { timedNote } from './material';

/** The proposal uses the timeline's G31 marks, palette and per-bar drawing cap. */
export function paintSimplifyReport(
  canvas: HTMLCanvasElement,
  song: ReferenceSong,
  proposal: SectionSuggestions,
  suggestion: Suggestion,
) {
  const notes = suggestion.notes.map((n) =>
    timedNote(song, n.startSeconds, n.endSeconds, n.pitch, n.velocity),
  );
  const marks: DifferenceMark[] = suggestion.changes.map((change) => {
    const written = change.written[0],
      original = change.original[0];
    const time = written ?? original;
    const pitch = (written ? change.writtenPitches[0] : change.originalPitches[0]) ?? 60;
    const note =
      notes.find(
        (n) =>
          written &&
          n.pitch === pitch &&
          n.startSeconds === written.startSeconds &&
          n.endSeconds === written.endSeconds,
      ) ?? timedNote(song, time.startSeconds, time.endSeconds, pitch, 100);
    return {
      ...change,
      kind:
        change.kind === 'dropped'
          ? 'only-recording'
          : change.kind === 'added'
            ? 'only-yours'
            : change.kind,
      note,
    };
  });
  const drawing = differenceDrawing(notes, marks);
  const source = song.stems.find((s) => s.id === proposal.conversion.stemId);
  const originals = capCells(
    (source?.notes ?? []).filter(
      (n) =>
        n.startSeconds >= proposal.range.startSeconds && n.startSeconds < proposal.range.endSeconds,
    ),
    (n) => n.start,
  );
  const width = canvas.getBoundingClientRect().width,
    height = 180,
    ratio = devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = height * ratio;
  canvas.dataset.drawingHeight = String(height);
  const ctx = canvas.getContext('2d');
  if (!ctx || !width) return [];
  ctx.scale(ratio, ratio);
  const style = getComputedStyle(canvas),
    color = (name: string) => style.getPropertyValue(name).trim();
  const pitches = [...notes, ...originals].map((n) => n.pitch);
  const low = Math.min(60, ...pitches),
    high = Math.max(72, ...pitches);
  const x = (seconds: number) =>
    12 +
    (secondsToCycle(song, proposal.conversion.grid, seconds) / proposal.range.cycles) *
      (width - 24);
  const y = (pitch: number) =>
    proposal.conversion.stemId === 'drums'
      ? 28 + (drumLane(pitch) ?? 4) * 26
      : 28 + ((high - pitch) / Math.max(1, high - low)) * 120;
  ctx.fillStyle = color('--canvas');
  ctx.fillRect(0, 0, width, height);
  ctx.font = '11px sans-serif';
  for (const span of proposal.conversion.spans) {
    const at = x(span.startSeconds);
    ctx.strokeStyle = color('--line');
    ctx.beginPath();
    ctx.moveTo(at, 18);
    ctx.lineTo(at, height);
    ctx.stroke();
    ctx.fillStyle = color('--muted');
    ctx.fillText(String(span.bar?.number ?? 'pickup'), at + 3, 13);
  }
  function paint(list: typeof notes, fill: string, alpha: number) {
    ctx!.fillStyle = fill;
    ctx!.globalAlpha = alpha;
    for (const n of list)
      ctx!.fillRect(
        x(n.startSeconds),
        y(n.pitch),
        Math.max(3, x(n.endSeconds) - x(n.startSeconds)),
        6,
      );
  }
  paint(originals, color('--recording'), 0.35);
  paint(drawing.notes, color('--mine'), 1);
  const hits = paintDifferences(ctx, drawing.marks, {
    x,
    y,
    clip: [12, width - 12],
    height,
    noteHeight: 174,
    scale: 1,
    boundaries: proposal.conversion.spans.map((s) => s.startSeconds),
    recording: color('--recording'),
    difference: color('--difference'),
    mine: color('--mine'),
    warning: color('--warning'),
  });
  canvas.setAttribute(
    'aria-description',
    `${notes.length} proposed notes; ${drawing.drawn} of ${drawing.total} proposal and dropped-note marks drawn. At most 200 per bar. Use up and down arrows for difference explanations.`,
  );
  return hits;
}
