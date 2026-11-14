import { conversionSpans, cycleToSeconds, type ConversionGrid } from '../convert';
import { sectionRange } from '../document/section-range';
import type { ReferenceSong } from '../reference/types';
import type { InstrumentMaterial } from './material';
import { DRUM_LANES, drumLane, CELL_CAP } from './layout';
import { defaultMatch, type MatchSettings } from '../simplify';
import type { setDrumCell } from '../document/edits/drum-cell';

export type DrumCell = Parameters<typeof setDrumCell>[1] & {
  bar: number;
  step: number;
  reference: boolean;
};
type Column = {
  start: number;
  end: number;
  lo: number;
  hi: number;
  cells: DrumCell[];
};
export function drumGrid(
  song: ReferenceSong,
  material: InstrumentMaterial,
  grid: ConversionGrid,
  match: MatchSettings = defaultMatch,
) {
  if (grid === 'exact' || material.mine.message) return [];
  const spans = conversionSpans(song, song.bars);
  const columns: Column[] = [];
  for (const bar of song.bars) {
    const place = material.places.find((p) => bar.number >= p.fromBar && bar.number < p.toBar);
    const span = spans.find((s) => s.bar?.number === bar.number);
    if (!place || !span) continue;
    const owner = sectionRange(song, place);
    const count = Math.max(1, Math.ceil((bar.endBeat - bar.startBeat) * grid));
    const width = (span.endCycle - span.startCycle) / count;
    for (let step = 0; step < count; step++) {
      const at = span.startCycle + step * width;
      const lo = Math.max(span.startCycle, at - width / 2);
      const hi = step === count - 1 ? span.endCycle : at + width / 2;
      columns.push({
        start: cycleToSeconds(song, spans, at),
        end: cycleToSeconds(song, spans, at + width),
        lo: cycleToSeconds(song, spans, lo),
        hi: cycleToSeconds(song, spans, hi),
        cells: DRUM_LANES.map((_, lane) => ({
          placeId: place.id,
          lane,
          from: lo - owner.startCycle,
          to: hi - owner.startCycle,
          at: at - owner.startCycle,
          duration: width,
          on: false,
          bar: bar.number,
          step: step + 1,
          reference: false,
        })),
      });
    }
  }
  for (const [notes, key] of [
    [material.mine.notes, 'on'],
    [material.literal.notes, 'reference'],
  ] as const) {
    for (const note of notes) {
      if (key === 'reference' && !match.countQuietNotes && note.velocity < match.quietVelocity)
        continue;
      const lane = drumLane(note.pitch);
      if (lane === null) continue;
      let lo = 0,
        hi = columns.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (columns[mid].hi <= note.startSeconds) lo = mid + 1;
        else hi = mid;
      }
      const column = columns[lo];
      if (column && note.startSeconds >= column.lo) column.cells[lane][key] = true;
    }
  }
  return columns;
}

const label = (cell: DrumCell) =>
  `${DRUM_LANES[cell.lane]}, bar ${cell.bar}, step ${cell.step}: ${cell.on ? (cell.reference ? 'in both' : 'only in yours') : cell.reference ? 'only in the recording' : 'empty'}. Enter or Space changes this section everywhere it plays.`;

/** One focusable grid and one active cell, regardless of section length. */
export function mountDrumGrid(change: (cell: DrumCell) => void, repaint: () => void) {
  const host = document.createElement('div');
  host.className = 'tl-drum-grid';
  host.setAttribute('role', 'grid');
  host.setAttribute('aria-label', 'Edit drums in the lens');
  host.tabIndex = 0;
  host.hidden = true;
  const row = document.createElement('div'),
    active = document.createElement('span');
  row.setAttribute('role', 'row');
  active.setAttribute('role', 'gridcell');
  active.id = 'lens-drum-cell';
  active.className = 'sheet-sr-only';
  row.append(active);
  host.append(row);
  host.setAttribute('aria-activedescendant', active.id);
  let columns: Column[] = [],
    visible: Column[] = [],
    chosen = 0,
    lane = 4,
    restoreFocus = false;
  let xAt = (_seconds: number) => 0;
  let hover: { column: Column; lane: number } | undefined;
  const selected = () => visible[chosen]?.cells[lane];
  function describe() {
    const cell = selected();
    host.setAttribute('aria-colcount', String(visible.length));
    host.setAttribute('aria-rowcount', '5');
    row.setAttribute('aria-rowindex', String(lane + 1));
    active.setAttribute('aria-colindex', String(chosen + 1));
    active.textContent = cell ? label(cell) : 'Waiting for the latest queried notes';
    active.setAttribute('aria-selected', String(!!cell?.on));
  }
  host.onpointerdown = (event) => {
    const box = host.getBoundingClientRect();
    const x = event.clientX - box.left + parseFloat(host.style.left);
    if (!visible.some((c) => x >= xAt(c.start) && x < xAt(c.end))) return;
    event.preventDefault();
    event.stopPropagation();
  };
  host.onclick = (event) => {
    const box = host.getBoundingClientRect();
    const x = event.clientX - box.left + parseFloat(host.style.left);
    const found = visible.findIndex((c) => x >= xAt(c.start) && x < xAt(c.end));
    if (found < 0) return;
    chosen = found;
    lane = Math.max(0, Math.min(4, Math.floor((event.clientY - box.top) / (box.height / 5))));
    host.focus({ preventScroll: true });
    describe();
    const cell = selected();
    if (cell) change(cell);
    event.stopPropagation();
  };
  host.onpointermove = (event) => {
    const box = host.getBoundingClientRect();
    const x = event.clientX - box.left + parseFloat(host.style.left);
    const col = visible.find((c) => x >= xAt(c.start) && x < xAt(c.end));
    const lane = Math.max(0, Math.min(4, Math.floor((event.clientY - box.top) / (box.height / 5))));
    host.title = col ? label(col.cells[lane]) : 'Unarranged: make a section before editing';
    if (hover?.column !== col || hover?.lane !== lane) {
      hover = col ? { column: col, lane } : undefined;
      repaint();
    }
  };
  host.onpointerleave = () => {
    if (hover) {
      hover = undefined;
      repaint();
    }
  };
  host.onkeydown = (event) => {
    if (event.key === 'ArrowLeft') chosen = Math.max(0, chosen - 1);
    else if (event.key === 'ArrowRight') chosen = Math.min(visible.length - 1, chosen + 1);
    else if (event.key === 'ArrowUp') lane = Math.max(0, lane - 1);
    else if (event.key === 'ArrowDown') lane = Math.min(4, lane + 1);
    else if (event.key === 'Home') chosen = 0;
    else if (event.key === 'End') chosen = visible.length - 1;
    else if (event.key === 'Enter' || event.key === ' ') {
      const cell = selected();
      if (cell) change(cell);
    } else return;
    event.preventDefault();
    event.stopPropagation();
    describe();
    repaint();
  };
  return {
    host,
    retainFocus() {
      if (document.activeElement === host) restoreFocus = true;
    },
    set(value: Column[]) {
      columns = value;
      if (!value.length) host.hidden = true;
    },
    paint(
      ctx: CanvasRenderingContext2D,
      options: {
        first: number;
        last: number;
        x: (seconds: number) => number;
        a: number;
        b: number;
        height: number;
        scaledHeight: number;
        recording: string;
        mine: string;
        difference: string;
      },
    ) {
      const { first, last, x, a, b, height, scaledHeight } = options;
      xAt = x;
      visible = columns.filter((c) => c.cells[0].bar >= first && c.cells[0].bar <= last);
      chosen = Math.max(0, Math.min(chosen, visible.length - 1));
      const top = 6,
        bottom = height - 18,
        laneHeight = (bottom - top) / 5;
      host.hidden = !visible.length;
      if (host.hidden) return;
      host.style.left = `${a}px`;
      host.style.width = `${Math.max(0, b - a)}px`;
      host.style.top = `${(top * scaledHeight) / height}px`;
      host.style.height = `${((bottom - top) * scaledHeight) / height}px`;
      if (!host.hidden && restoreFocus) {
        if (document.activeElement === document.body) host.focus({ preventScroll: true });
        restoreFocus = false;
      }
      describe();
      // Empty cells are a grid, not events. Filled cells share a 200-per-bar sample.
      const candidates = new Map<number, DrumCell[]>();
      for (const col of visible)
        for (const cell of col.cells) {
          if (!cell.on && !cell.reference) continue;
          const list = candidates.get(cell.bar) ?? [];
          list.push(cell);
          candidates.set(cell.bar, list);
        }
      const drawn = new Set(
        [...candidates.values()].flatMap((cells) =>
          cells.length <= CELL_CAP
            ? cells
            : Array.from(
                { length: CELL_CAP },
                (_, i) => cells[Math.round((i * (cells.length - 1)) / (CELL_CAP - 1))],
              ),
        ),
      );
      ctx.save();
      ctx.beginPath();
      ctx.rect(a, top, b - a, bottom - top);
      ctx.clip();
      for (const col of visible) {
        const left = x(col.start),
          width = Math.max(0, x(col.end) - left - 2);
        if (width <= 0) continue;
        ctx.fillStyle = '#0f1115';
        ctx.fillRect(left, top, width + 2, bottom - top);
        for (const cell of col.cells) {
          const y = top + cell.lane * laneHeight;
          ctx.fillStyle =
            drawn.has(cell) && cell.on
              ? cell.reference
                ? options.mine
                : options.difference
              : '#1e222b';
          ctx.fillRect(left + 1, y + 1, width, laneHeight - 2);
          if (drawn.has(cell) && cell.reference) {
            ctx.strokeStyle = options.recording;
            ctx.lineWidth = 2;
            ctx.strokeRect(left + 2, y + 2, Math.max(0, width - 2), laneHeight - 4);
          }
        }
      }
      if (document.activeElement === host && visible[chosen]) {
        const col = visible[chosen];
        ctx.strokeStyle = options.mine;
        ctx.lineWidth = 2;
        ctx.strokeRect(
          x(col.start) + 1,
          top + lane * laneHeight + 1,
          Math.max(1, x(col.end) - x(col.start) - 2),
          laneHeight - 2,
        );
      }
      if (hover && visible.includes(hover.column)) {
        ctx.strokeStyle = options.mine;
        ctx.lineWidth = 1;
        ctx.strokeRect(
          x(hover.column.start) + 1,
          top + hover.lane * laneHeight + 1,
          Math.max(1, x(hover.column.end) - x(hover.column.start) - 2),
          laneHeight - 2,
        );
      }
      ctx.restore();
    },
    hide() {
      host.hidden = true;
    },
  };
}
