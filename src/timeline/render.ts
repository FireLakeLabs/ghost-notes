import type { OpenReference } from '../app/reference';
import type { Position } from '../reference/types';
import {
  DRUM_LANES,
  LABEL_WIDTH,
  drumLane,
  contourMarks,
  barInference,
  noteMarks,
  timelineAxis,
  timelineRows,
  type TimelineAxis,
  type NoteMark,
  type TimelineInstrument,
} from './layout';
import './style.css';

function element(tag: string, text = '', className = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}
function surface(canvas: HTMLCanvasElement, width: number, height: number) {
  const ratio = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return ctx;
}
type DrawingRow = {
  canvas: HTMLCanvasElement;
  instrument: TimelineInstrument;
  kind: 'audio' | 'midi';
  height: number;
  marks: NoteMark[];
};
/** Public viewport port for the lens, selection, and difference marks. X is song-track pixels. */
export function mountTimeline(root: HTMLElement) {
  root.classList.add('timeline');
  let reference: OpenReference | null = null;
  let axis: TimelineAxis | null = null;
  let rows: DrawingRow[] = [];
  let zoom = 1,
    frame = 0,
    firstDraw = false,
    started = 0;
  let width = 1,
    viewport = 1;
  let rulerWidth = 0;
  root.innerHTML = `<div class="tl-toolbar"><h2>Whole song</h2><label><input type="checkbox" data-audio checked> Stem audio</label><label>Zoom <input data-zoom type="range" min="1" max="16" step="0.25" value="1" aria-label="Timeline zoom"></label><button type="button" data-fit>Fit song</button></div><p class="tl-summary" data-info></p><div class="tl-overview"><span class="tl-label">SONG</span><canvas tabindex="0" role="slider" aria-label="Song overview" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></canvas></div><div class="tl-scroll" tabindex="0" role="region" aria-label="Scrollable timeline"><div class="tl-content"></div></div>`;
  const scroll = root.querySelector<HTMLElement>('.tl-scroll')!;
  const content = root.querySelector<HTMLElement>('.tl-content')!;
  const overview = root.querySelector<HTMLCanvasElement>('.tl-overview canvas')!;
  const audio = root.querySelector<HTMLInputElement>('[data-audio]')!;
  const slider = root.querySelector<HTMLInputElement>('[data-zoom]')!;
  function schedule() {
    if (!frame) frame = requestAnimationFrame(draw);
  }
  function rebuild() {
    content.replaceChildren();
    rulerWidth = 0;
    rows = [];
    if (!reference || !axis) return;
    const ruler = element('div', '', 'tl-row tl-ruler');
    ruler.append(element('span', 'BAR', 'tl-label'));
    const track = element('div', '', 'tl-track');
    track.dataset.ruler = '';
    for (const bar of reference.song.bars) {
      const inference = barInference(bar);
      const label = element(
        'span',
        `${bar.number}${inference ? ' ≈' : ''}`,
        `tl-bar${inference ? ' tl-inferred' : ''}`,
      );
      if (inference) label.dataset.inferred = '';
      label.dataset.bar = String(bar.number);
      label.title = `Bar ${bar.number}${bar.partial ? ' · partial' : ''}${inference ? ` · inferred grid: ${inference}` : ''}`;
      track.append(label);
    }
    const coverage = reference.song.beatMap.coverage;
    for (const [a, b] of coverage.gaps) {
      const mark = element('span', 'gap', 'tl-mark');
      mark.dataset.seconds = String(a);
      mark.dataset.gap = '';
      mark.title = `Beat-map gap: ${a}–${b} s`;
      track.append(mark);
    }
    if (
      coverage.last_beat_seconds !== null &&
      coverage.last_beat_seconds < reference.song.durationSeconds
    ) {
      const mark = element('span', 'no beat map →', 'tl-mark tl-tail');
      mark.dataset.seconds = String(coverage.last_beat_seconds);
      mark.dataset.uncovered = '';
      track.append(mark);
    }
    if (
      coverage.first_beat_seconds === null ||
      coverage.first_beat_seconds > 0 ||
      !reference.song.bars.length
    ) {
      const mark = element('span', 'no beat map', 'tl-mark');
      mark.dataset.seconds = '0';
      mark.dataset.uncovered = '';
      track.append(mark);
    }
    ruler.append(track);
    content.append(ruler);
    for (const instrument of timelineRows(reference.song, audio.checked)) {
      const { stem } = instrument;
      const heading = element('div', '', 'tl-heading');
      heading.dataset.stem = stem.id;
      heading.append(
        element('strong', stem.id),
        element(
          'span',
          `${stem.notes.length.toLocaleString()} notes · ${stem.levelDb.toFixed(1)} dB`,
        ),
      );
      if (instrument.quiet)
        heading.append(
          element(
            'span',
            stem.transcription === 'skipped_quiet'
              ? 'Skipped quiet stem · possible bleed'
              : 'Quiet stem · possible bleed',
            'tl-warning',
          ),
        );
      const marks = noteMarks(stem, axis);
      if (marks.length < stem.notes.length)
        heading.append(
          element(
            'span',
            `${marks.length} of ${stem.notes.length} drawn · at most 200 per bar cell`,
            'tl-warning',
          ),
        );
      content.append(heading);
      for (const row of instrument.rows) {
        const line = element('div', '', 'tl-row');
        line.style.height = `${row.height}px`;
        line.dataset.row = row.kind;
        line.dataset.stem = stem.id;
        const label = element('div', row.kind === 'audio' ? 'audio' : 'MIDI', 'tl-label');
        if (instrument.drums && row.kind === 'midi') {
          const lanes = element('div', '', 'tl-drums');
          for (const lane of DRUM_LANES) lanes.append(element('span', lane));
          label.append(lanes);
        }
        const track = element('div', '', 'tl-track');
        const canvas = document.createElement('canvas');
        canvas.setAttribute('role', 'img');
        canvas.setAttribute(
          'aria-label',
          `${stem.id} ${row.kind === 'audio' ? 'waveform' : instrument.drums ? 'drum lanes: Crash, Hi-hat, Snare, Tom, Kick' : 'pitch contour'}`,
        );
        track.append(canvas);
        line.append(label, track);
        content.append(line);
        rows.push({
          canvas,
          instrument,
          kind: row.kind,
          height: row.height,
          marks: instrument.drums ? marks : contourMarks(marks, axis.span, stem.id === 'bass'),
        });
      }
    }
    schedule();
  }
  function draw() {
    frame = 0;
    if (!reference || !axis) return;
    viewport = Math.max(1, scroll.clientWidth - LABEL_WIDTH);
    width = viewport * zoom;
    root.style.setProperty('--tl-viewport', `${scroll.clientWidth}px`);
    content.style.width = `${width + LABEL_WIDTH}px`;
    const left = Math.min(scroll.scrollLeft, Math.max(0, width - viewport));
    const style = getComputedStyle(root);
    const color = (token: string) => style.getPropertyValue(`--tl-${token}`).trim();
    const x = (seconds: number) => axis!.xAtSeconds(seconds, width) - left;
    if (rulerWidth !== width) {
      for (const label of content.querySelectorAll<HTMLElement>('[data-bar]')) {
        const bar = reference.song.bars.find((b) => b.number === Number(label.dataset.bar));
        if (bar) label.style.left = `${axis.xAtSeconds(bar.startSeconds, width)}px`;
        // Fit may show every eighth bar; every bar still has a line and an accessible title.
        const stride = Math.max(
          1,
          Math.ceil(28 / (width / Math.max(1, reference.song.bars.length))),
        );
        label.style.visibility =
          Number(label.dataset.bar) <= 1 || (Number(label.dataset.bar) - 1) % stride === 0
            ? 'visible'
            : 'hidden';
      }
      for (const mark of content.querySelectorAll<HTMLElement>('[data-seconds]'))
        mark.style.left = `${axis.xAtSeconds(Number(mark.dataset.seconds), width)}px`;
      rulerWidth = width;
    }
    const visibleBars = axis.visibleBars(left, viewport, width);
    const coverage = reference.song.beatMap.coverage;
    const regions: { a: number; b: number }[] = coverage.gaps.map(([a, b]) => ({ a, b }));
    if (!reference.song.bars.length) regions.push({ a: 0, b: reference.song.durationSeconds });
    else {
      if ((coverage.first_beat_seconds ?? 0) > 0)
        regions.push({ a: 0, b: coverage.first_beat_seconds! });
      if (coverage.last_beat_seconds !== null)
        regions.push({ a: coverage.last_beat_seconds, b: reference.song.durationSeconds });
    }
    // Invert the grid once per screen column, shared by all six waveform rows.
    const seconds = Array.from({ length: Math.ceil(viewport) + 1 }, (_, px) =>
      axis!.secondsAtX(left + px, width),
    );
    for (const row of rows) {
      const ctx = surface(row.canvas, viewport, row.height);
      ctx.strokeStyle = color('line');
      for (const bar of visibleBars) {
        ctx.strokeStyle = color(barInference(bar) ? 'difference' : 'line');
        ctx.setLineDash(barInference(bar) ? [2, 3] : []);
        ctx.beginPath();
        ctx.moveTo(x(bar.startSeconds), 0);
        ctx.lineTo(x(bar.startSeconds), row.height);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = color('recording');
      ctx.strokeStyle = color('recording');
      if (row.kind === 'audio') {
        const data = reference.audio.get(row.instrument.stem.id);
        if (data) {
          for (let px = 0; px < viewport; px++) {
            const a = seconds[px];
            const b = seconds[px + 1];
            const first = Math.floor((a * data.buffer.sampleRate) / 1024);
            const end = Math.min(
              data.peaks.length / 2,
              Math.max(first + 1, Math.ceil((b * data.buffer.sampleRate) / 1024)),
            );
            let lo = 0,
              hi = 0;
            for (let bin = first; bin < end; bin++) {
              lo = Math.min(lo, data.peaks[bin * 2]);
              hi = Math.max(hi, data.peaks[bin * 2 + 1]);
            }
            ctx.fillRect(px, row.height / 2 - hi * 14, 1, Math.max(1, (hi - lo) * 14));
          }
        }
      } else if (row.instrument.drums) {
        ctx.globalAlpha = 0.2;
        for (let lane = 1; lane < 5; lane++) ctx.fillRect(0, 3 + lane * 7.6, viewport, 1);
        ctx.globalAlpha = 1;
        for (const mark of row.marks) {
          const px = mark.x * width - left,
            lane = drumLane(mark.pitch);
          if (lane !== null && px >= -2 && px <= viewport) {
            ctx.globalAlpha = 0.3 + (mark.velocity / 127) * 0.7;
            ctx.fillRect(
              px,
              3 + lane * 7.6,
              Math.max(2, Math.min(5, (width / axis.span) * 0.09)),
              6,
            );
          }
        }
      } else {
        const pitches = row.marks.map((m) => m.pitch);
        const lo = Math.min(...pitches),
          hi = Math.max(lo + 1, ...pitches);
        let previousEnd: number | null = null;
        let previousY = 0;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (const mark of row.marks) {
          const a = mark.x * width - left,
            b = mark.end * width - left;
          if (b < 0 || a > viewport) continue;
          const y = 5 + ((hi - mark.pitch) / (hi - lo)) * 34;
          if (previousEnd === null || (mark.x - previousEnd) * axis.span > 1.5) ctx.moveTo(a, y);
          else {
            ctx.lineTo(a, previousY);
            ctx.lineTo(a, y);
          }
          ctx.lineTo(b, y);
          previousEnd = mark.end;
          previousY = y;
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const region of regions) {
        const a = Math.max(0, x(region.a)),
          b = Math.min(viewport, x(region.b));
        if (b <= a) continue;
        ctx.save();
        ctx.beginPath();
        ctx.rect(a, 0, b - a, row.height);
        ctx.clip();
        ctx.fillStyle = color('difference');
        ctx.globalAlpha = 0.07;
        ctx.fillRect(a, 0, b - a, row.height);
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = color('difference');
        for (let px = a - row.height; px < b; px += 7) {
          ctx.beginPath();
          ctx.moveTo(px, row.height);
          ctx.lineTo(px + row.height, 0);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    const ctx = surface(overview, viewport, 32);
    ctx.strokeStyle = color('recording');
    ctx.globalAlpha = 0.45;
    const marks = rows.filter((r) => r.kind === 'midi').flatMap((r) => r.marks);
    for (const m of marks)
      ctx.strokeRect(m.x * viewport, 9, Math.max(1, (m.end - m.x) * viewport), 14);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color('text');
    ctx.lineWidth = 2;
    ctx.strokeRect(
      (left / width) * viewport + 1,
      1,
      Math.max(2, (viewport / width) * viewport - 2),
      30,
    );
    overview.setAttribute(
      'aria-valuenow',
      String(Math.round((left / Math.max(1, width - viewport)) * 100)),
    );
    root.dataset.bars = String(reference.song.bars.filter((b) => b.number > 0).length);
    if (firstDraw) {
      firstDraw = false;
      const drawStarted = started;
      requestAnimationFrame(() => {
        if (reference && started === drawStarted) {
          performance.measure('Ghost:timeline-first-draw', {
            start: drawStarted,
            end: performance.now(),
          });
          root.dataset.drawn = 'true';
        }
      });
    }
  }
  function setZoom(value: number) {
    const center = (scroll.scrollLeft + viewport / 2) / width;
    zoom = value;
    width = viewport * zoom;
    slider.value = String(value);
    content.style.width = `${viewport * zoom + LABEL_WIDTH}px`;
    scroll.scrollLeft = Math.max(0, center * viewport * zoom - viewport / 2);
    schedule();
  }
  slider.oninput = () => setZoom(Number(slider.value));
  root.querySelector<HTMLButtonElement>('[data-fit]')!.onclick = () => setZoom(1);
  audio.onchange = rebuild;
  scroll.addEventListener('scroll', schedule);
  const observer = new ResizeObserver(schedule);
  observer.observe(scroll);
  function navigate(clientX: number) {
    const box = overview.getBoundingClientRect();
    scroll.scrollLeft = ((clientX - box.left) / box.width) * width - viewport / 2;
    schedule();
  }
  overview.onpointerdown = (e) => {
    overview.setPointerCapture(e.pointerId);
    navigate(e.clientX);
  };
  overview.onpointermove = (e) => {
    if (overview.hasPointerCapture(e.pointerId)) navigate(e.clientX);
  };
  overview.onkeydown = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    scroll.scrollLeft =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? width
          : scroll.scrollLeft + ((e.key === 'ArrowLeft' ? -1 : 1) * viewport) / 2;
    schedule();
  };
  return {
    setReference(value: OpenReference | null) {
      reference = value;
      root.hidden = !value;
      delete root.dataset.drawn;
      if (!value) {
        axis = null;
        rows = [];
        content.replaceChildren();
        return;
      }
      started = performance.now();
      firstDraw = true;
      axis = timelineAxis(value.song.beatMap, value.song.bars);
      zoom = 1;
      slider.value = '1';
      scroll.scrollLeft = 0;
      root.querySelector<HTMLElement>('[data-info]')!.textContent =
        `${value.song.name} · ${value.song.bars.filter((b) => b.number > 0).length} bars${value.song.bars.some((b) => b.number === 0) ? ' + pickup bar 0' : ''} · Blue: recording · Hatching: gap or no beat map`;
      rebuild();
    },
    visibleBars() {
      return axis?.visibleBars(scroll.scrollLeft, viewport, width) ?? [];
    },
    positionAtX(x: number) {
      return axis?.positionAtX(x, width) ?? null;
    },
    xAtPosition(position: Position) {
      return axis?.xAtPosition(position, width) ?? null;
    },
    destroy() {
      observer.disconnect();
      cancelAnimationFrame(frame);
      root.replaceChildren();
      rows = [];
      reference = null;
      axis = null;
      root.hidden = true;
    },
  };
}
