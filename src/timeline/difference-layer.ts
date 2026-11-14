import type { ReferenceNote } from '../reference/types';
import { capCells } from './layout';
import { explainDifference, type DifferenceMark, type BarMatch } from './differences';
export type DrawingDifference = DifferenceMark & { text: string };

/** Hollow recording events share Mine's 200-event allowance, rather than adding another 200. */
export function differenceDrawing(
  notes: readonly ReferenceNote[],
  marks: readonly DifferenceMark[],
) {
  const ghosts = marks.filter((m) => m.kind === 'only-recording').map((m) => m.note);
  const chosen = capCells([...notes, ...ghosts], (n) => n.start);
  const identities = new Set(chosen);
  return {
    notes: notes.filter((n) => identities.has(n)),
    marks: marks
      .filter((m) => identities.has(m.note))
      .map((m) => ({ ...m, text: explainDifference(m) })),
    drawn: chosen.length,
    total: notes.length + ghosts.length,
  };
}
export type DifferenceHit = { x: number; y: number; w: number; h: number; text: string };
type Geometry = {
  x(seconds: number): number;
  y(pitch: number): number;
  clip: readonly [number, number];
  height: number;
  noteHeight: number;
  scale: number;
  boundaries: readonly number[];
  recording: string;
  difference: string;
  mine: string;
  warning: string;
};
export function paintDifferences(
  ctx: CanvasRenderingContext2D,
  marks: readonly DrawingDifference[],
  g: Geometry,
): DifferenceHit[] {
  const hits: DifferenceHit[] = [];
  if (!marks.length) return hits;
  const hit = (x: number, y: number, w: number, h: number, text: string) => {
    const a = Math.max(g.clip[0], x - 3),
      b = Math.min(g.clip[1], x + w + 3);
    if (b > a) hits.push({ x: a, y: y - 3, w: b - a, h: h + 6, text });
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(g.clip[0], 0, Math.max(0, g.clip[1] - g.clip[0]), g.height);
  ctx.clip();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.5;
  const filled = new Path2D(),
    changedLines = new Path2D(),
    recordingLines = new Path2D();
  const filledNotes = new Set<ReferenceNote>();
  const crossings = new Set<number>();
  const movements = new Set<string>();
  for (const mark of marks) {
    const x = g.x(mark.note.startSeconds),
      end = g.x(mark.note.endSeconds),
      y = g.y(mark.note.pitch),
      w = Math.max(3, end - x),
      text = mark.text;
    if (end < g.clip[0] - 4 || x > g.clip[1] + 4) continue;
    if (mark.kind === 'only-recording') recordingLines.rect(x, y, w, 6);
    else if (mark.kind === 'merged') {
      filled.rect(x, y - 3, w, 3);
      filled.rect(x, y + 4, w, 3);
    } else if (!filledNotes.has(mark.note)) {
      filled.rect(x, y, w, 6);
      filledNotes.add(mark.note);
    }
    hit(x, y - (mark.kind === 'merged' ? 3 : 0), w, 10, text);
    if (mark.kind === 'moved' || mark.kind === 'moved-across-bar-line') {
      const start = g.x(mark.original[0].startSeconds),
        lineY = g.noteHeight - 4;
      const movement = `${start}:${x}`;
      if (!movements.has(movement)) {
        changedLines.moveTo(start, lineY);
        changedLines.lineTo(x, lineY);
        changedLines.moveTo(start, lineY - 3);
        changedLines.lineTo(start, lineY + 2);
        movements.add(movement);
      }
      hit(Math.min(start, x), lineY - 2, Math.max(3, Math.abs(start - x)), 4, text);
    }
    if (mark.kind === 'shortened') {
      const originalEnd = Math.max(...mark.original.map((n) => g.x(n.endSeconds)));
      if (originalEnd > end) {
        changedLines.rect(end, y, originalEnd - end, 6);
        hit(end, y, originalEnd - end, 6, text);
      }
    }
    if (mark.kind === 'moved-across-bar-line')
      for (const boundary of g.boundaries) {
        if (
          !mark.original.some(
            (o) =>
              o.startSeconds < boundary - 1e-8 !== mark.note.startSeconds < boundary - 1e-8 ||
              o.endSeconds <= boundary + 1e-8 !== mark.note.endSeconds <= boundary + 1e-8,
          )
        )
          continue;
        const at = g.x(boundary);
        if (!crossings.has(boundary)) {
          filled.rect(at - 1, 0, 2, g.noteHeight);
          crossings.add(boundary);
        }
        hit(at - 2, 0, 4, g.noteHeight, text);
      }
  }
  ctx.fillStyle = ctx.strokeStyle = g.difference;
  ctx.fill(filled);
  ctx.stroke(changedLines);
  ctx.strokeStyle = g.recording;
  ctx.stroke(recordingLines);
  ctx.restore();
  return hits;
}

/** The strip stays crisp above selection and context overlays, like Main's spans. */
export function paintMatchStrip(
  ctx: CanvasRenderingContext2D,
  bars: readonly BarMatch[],
  g: Geometry,
): DifferenceHit[] {
  const hits: DifferenceHit[] = [];
  ctx.save();
  for (const match of bars) {
    const a = Math.max(g.clip[0], g.x(match.bar.startSeconds) + 1),
      b = Math.min(g.clip[1], g.x(match.bar.endSeconds) - 1);
    if (b <= a) continue;
    const y = g.height - 6 / g.scale,
      h = 4 / g.scale;
    ctx.fillStyle = match.share >= 0.9 ? g.mine : match.share >= 0.7 ? g.warning : g.difference;
    ctx.globalAlpha = match.share >= 0.9 ? 0.55 : 1;
    ctx.beginPath();
    ctx.roundRect(a, y, b - a, h, { x: Math.min(2, (b - a) / 2), y: 2 / g.scale });
    ctx.fill();
    hits.push({
      x: a,
      y: y - 3,
      w: b - a,
      h: h + 6,
      text: `Bar ${match.bar.number}: ${Math.round(match.share * 100)}% match · ${match.matched} matched, ${match.recording} recording, ${match.mine} yours. Same-bar onsets using the current match settings.`,
    });
  }
  ctx.restore();
  return hits;
}

/** Canvas hit regions have pointer and keyboard equivalents; no per-note DOM nodes. */
export function mountDifferenceTip(
  root: HTMLElement,
  hitsFor: (canvas: HTMLCanvasElement, fresh: boolean) => readonly DifferenceHit[],
) {
  const tip = document.createElement('div');
  tip.className = 'tl-difference-tip';
  tip.id = 'timeline-difference-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  root.append(tip);
  let active: HTMLCanvasElement | undefined,
    index = 0,
    tipHeight = 0,
    keyboardActive = false;
  function hide() {
    if (tip.hidden && !active) return;
    tip.hidden = true;
    active?.removeAttribute('aria-describedby');
    active = undefined;
    keyboardActive = false;
  }
  function show(canvas: HTMLCanvasElement, text: string, x: number, y: number, keyboard = false) {
    if (active !== canvas) hide();
    const changed = tip.hidden || tip.textContent !== text;
    active = canvas;
    keyboardActive = keyboard;
    tip.textContent = text;
    tip.style.left = `${Math.max(8, Math.min(innerWidth - 320, x + 12))}px`;
    tip.hidden = false;
    if (changed) tipHeight = tip.getBoundingClientRect().height;
    tip.style.top = `${Math.max(8, Math.min(innerHeight - tipHeight - 8, y + 12))}px`;
    canvas.setAttribute('aria-describedby', tip.id);
  }
  function pointer(event: PointerEvent) {
    const canvas = event.target;
    if (!(canvas instanceof HTMLCanvasElement) || event.buttons) return hide();
    const box = canvas.getBoundingClientRect(),
      x = event.clientX - box.left,
      y = ((event.clientY - box.top) / box.height) * Number(canvas.dataset.drawingHeight);
    const text = [
      ...new Set(
        hitsFor(canvas, false)
          .filter((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h)
          .map((h) => h.text),
      ),
    ].join('\n');
    if (text) show(canvas, text, event.clientX, event.clientY);
    else hide();
  }
  function keyboardHits(canvas: HTMLCanvasElement, fresh: boolean) {
    const seen = new Set<string>();
    return hitsFor(canvas, fresh).filter((hit) => {
      if (seen.has(hit.text)) return false;
      seen.add(hit.text);
      return true;
    });
  }
  function keyboard(event: KeyboardEvent) {
    if (event.key === 'Escape') return hide();
    const canvas = event.target;
    if (!(canvas instanceof HTMLCanvasElement) || !['ArrowDown', 'ArrowUp'].includes(event.key))
      return;
    const hits = keyboardHits(canvas, true);
    if (!hits.length) return;
    event.preventDefault();
    index =
      active === canvas
        ? (index + (event.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length
        : 0;
    const h = hits[index],
      box = canvas.getBoundingClientRect();
    show(
      canvas,
      h.text,
      box.left + h.x,
      box.top + (h.y * box.height) / Number(canvas.dataset.drawingHeight),
      true,
    );
  }
  root.addEventListener('pointermove', pointer);
  root.addEventListener('pointerleave', hide);
  root.addEventListener('keydown', keyboard);
  root.addEventListener('focusout', hide);
  return {
    hide,
    hidePointer() {
      if (!keyboardActive) hide();
    },
    reposition() {
      if (!keyboardActive || !active) return;
      if (!active.isConnected || document.activeElement !== active) return hide();
      const hits = keyboardHits(active, false);
      const chosen = hits.findIndex((hit) => hit.text === tip.textContent);
      if (chosen < 0) return hide();
      index = chosen;
      const hit = hits[index],
        box = active.getBoundingClientRect();
      show(
        active,
        hit.text,
        box.left + hit.x,
        box.top + (hit.y * box.height) / Number(active.dataset.drawingHeight),
        true,
      );
    },
    destroy() {
      root.removeEventListener('pointermove', pointer);
      root.removeEventListener('pointerleave', hide);
      root.removeEventListener('keydown', keyboard);
      root.removeEventListener('focusout', hide);
      tip.remove();
    },
  };
}
