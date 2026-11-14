import { createMaterial, type TimelineScore, type MaterialPlace } from './material';
import type { OpenReference } from '../app/reference';
import {
  selectRange,
  lensProjection,
  lensEase,
  plain,
  project,
  interpolate,
  type Projection,
  type BarRange,
  type TimelineSelection,
  type TimelineSettings,
} from './range';
import type { Position, ReferenceBar, ReferenceNote } from '../reference/types';
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
export type { TimelineSettings } from './range';

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
  kind: 'audio' | 'midi' | 'notes' | 'mine';
  layered: boolean;
  openHeight: number;
  sourceNotes: readonly ReferenceNote[];
  message: string;
  places: MaterialPlace[];
  gaps: { startSeconds: number; endSeconds: number }[];
  height: number;
  marks: NoteMark[];
  allMarks: NoteMark[];
  outside: HTMLCanvasElement;
  outsideWidth: number;
  outsidePlain: HTMLCanvasElement;
  waveform: HTMLCanvasElement | null;
  lo: number;
  hi: number;
};
function noteRect(
  ctx: CanvasRenderingContext2D,
  row: DrawingRow,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (row.layered && row.kind === 'notes') ctx.strokeRect(x, y, w, h);
  else ctx.fillRect(x, y, w, h);
}
/** Public viewport port for the lens, selection, and difference marks. X is song-track pixels. */
export function mountTimeline(root: HTMLElement) {
  root.classList.add('timeline');
  let reference: OpenReference | null = null;
  let score: TimelineScore = {
    doc: null,
    instruments: [],
    places: [],
    events: {},
    linked: false,
    grid: 4,
  };
  const material = createMaterial();
  const modes = new Map<string, 'rows' | 'layers'>();
  let axis: TimelineAxis | null = null;
  let rows: DrawingRow[] = [];
  let zoom = 1,
    frame = 0,
    firstDraw = false,
    started = 0;
  let width = 1,
    viewport = 1;
  let rulerWidth = 0;
  let rulerBars: { label: HTMLElement; bar: ReferenceBar }[] = [];
  let rulerMarks: {
    node: HTMLElement;
    start: number;
    end: number;
    description: string;
    edge: boolean;
    width: number;
  }[] = [];
  let selection: TimelineSelection | null = null;
  let lens: BarRange | null = null;
  let projection: Projection = plain;
  let transition: {
    from: Projection;
    to: Projection;
    start: number;
    opening: number;
    target: number;
    duration: number;
  } | null = null;
  let expanded = 0;
  let savedView = { zoom: 1, left: 0 };
  let lensEdges = { a: 0, b: 1 };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  root.innerHTML = `<div class="tl-toolbar"><h2>Whole song</h2><label><input type="checkbox" data-audio checked> Stem audio</label><label>Zoom <input data-zoom type="range" min="1" max="16" step="0.25" value="1" aria-label="Timeline zoom"></label><button type="button" data-fit>Fit song</button></div><div class="tl-toolbar"><label>Selection <select data-scope aria-label="Selection scope"><option value="band">Whole band</option><option value="instrument">One instrument</option></select></label><label>Snap <select data-snap aria-label="Selection snap"><option value="bars">Bars</option><option value="beats">Beats</option></select></label><label title="Choose One instrument in Settings">Instrument <select data-instrument aria-label="Selection instrument"></select></label><label>Bars <input data-first type="number" min="0" value="1" aria-label="First bar"></label><label>to <input data-last type="number" min="0" value="4" aria-label="Last bar"></label><button data-select>Select</button><button data-closer disabled>Look closer</button><button data-clear disabled>Clear selection</button><output data-selection aria-live="polite"></output></div><p class="tl-summary" data-info></p><div class="tl-overview"><span class="tl-label">SONG</span><canvas tabindex="0" role="slider" aria-label="Song overview" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></canvas></div><div class="tl-lens-row"><span class="tl-label">LENS</span><div class="tl-lens-track"><div data-lens-header tabindex="0" role="group" aria-label="Lens header" hidden><button data-earlier aria-label="Move the lens earlier">‹</button><strong data-lens-title></strong><button data-later aria-label="Move the lens later">›</button><button data-close aria-label="Close the lens">×</button></div><span data-lens-help>Select bars and choose Look closer.</span></div></div><div class="tl-scroll" tabindex="0" role="region" aria-label="Scrollable timeline"><div class="tl-content"></div></div><div data-lens-host hidden></div>`;
  const scroll = root.querySelector<HTMLElement>('.tl-scroll')!;
  const content = root.querySelector<HTMLElement>('.tl-content')!;
  const overview = root.querySelector<HTMLCanvasElement>('.tl-overview canvas')!;
  const overviewNotes = document.createElement('canvas');
  let overviewWidth = 0;
  const audio = root.querySelector<HTMLInputElement>('[data-audio]')!;
  const slider = root.querySelector<HTMLInputElement>('[data-zoom]')!;
  const scope = root.querySelector<HTMLSelectElement>('[data-scope]')!;
  const snap = root.querySelector<HTMLSelectElement>('[data-snap]')!;
  const instrumentChoice = root.querySelector<HTMLSelectElement>('[data-instrument]')!;
  const first = root.querySelector<HTMLInputElement>('[data-first]')!;
  const last = root.querySelector<HTMLInputElement>('[data-last]')!;
  const header = root.querySelector<HTMLElement>('[data-lens-header]')!;
  const closer = root.querySelector<HTMLButtonElement>('[data-closer]')!;
  const clear = root.querySelector<HTMLButtonElement>('[data-clear]')!;
  const settingsHost = element('div', '', 'tl-settings');
  settingsHost.id = 'timeline-settings';
  settingsHost.setAttribute('role', 'group');
  settingsHost.setAttribute('aria-label', 'Timeline settings');
  for (const control of [scope, snap, audio]) {
    const label = control.closest('label');
    if (label) settingsHost.append(label);
  }
  const viewLabel = element('label', 'All instruments');
  const viewMode = document.createElement('select');
  viewMode.setAttribute('aria-label', 'All instrument views');
  viewMode.add(new Option('Rows', 'rows'));
  viewMode.add(new Option('Layers', 'layers'));
  viewLabel.append(viewMode);
  settingsHost.append(viewLabel);
  viewMode.onchange = () => {
    modes.clear();
    rebuild();
    settingsChanged();
  };
  instrumentChoice.closest('.tl-toolbar')!.prepend(settingsHost);
  function getSettings(): TimelineSettings {
    return {
      selectionScope: scope.value === 'instrument' ? 'instrument' : 'band',
      selectionSnap: snap.value === 'beats' ? 'beats' : 'bars',
      showAudio: audio.checked,
      viewMode: viewMode.value === 'layers' ? 'layers' : 'rows',
    };
  }
  function settingsChanged() {
    root.dispatchEvent(new CustomEvent('settingschange', { detail: getSettings() }));
  }
  function setSettings(next: Partial<TimelineSettings>) {
    const before = getSettings(),
      value = { ...before, ...next };
    const rangeChanged =
      value.selectionScope !== before.selectionScope ||
      value.selectionSnap !== before.selectionSnap;
    const audioChanged = value.showAudio !== before.showAudio;
    const viewChanged = value.viewMode !== before.viewMode;
    if (!rangeChanged && !audioChanged && !viewChanged) return;
    if (viewChanged) {
      viewMode.value = value.viewMode;
      modes.clear();
    }
    scope.value = value.selectionScope;
    snap.value = value.selectionSnap;
    audio.checked = value.showAudio;
    if (rangeChanged) {
      selection = null;
      changed();
    }
    if (audioChanged || viewChanged) rebuild();
    settingsChanged();
  }

  function changed() {
    closer.disabled = clear.disabled = !selection;
    instrumentChoice.disabled = scope.value === 'band';
    root.querySelector<HTMLOutputElement>('[data-selection]')!.textContent = selection
      ? `${selection.scope.kind === 'band' ? 'Whole band' : selection.scope.stemId} · bars ${selection.firstBar}–${selection.lastBar}${snap.value === 'beats' ? ` · from beat ${(selection.start.beatInBar ?? 0) + 1} in bar ${selection.start.bar} · ends before beat ${(selection.end.beatInBar ?? 0) + 1} in bar ${selection.end.bar}` : ''}`
      : '';
    root.dispatchEvent(new CustomEvent('selectionchange', { detail: selection }));
    schedule();
  }
  function choose(a: number, b: number, stemId: string) {
    if (!reference) return;
    const next = selectRange(
      reference.song,
      a,
      b,
      snap.value === 'beats' ? 'beats' : 'bars',
      scope.value === 'band' ? { kind: 'band' } : { kind: 'instrument', stemId },
    );
    if (
      next?.start.seconds === selection?.start.seconds &&
      next?.end.seconds === selection?.end.seconds &&
      next?.scope.kind === selection?.scope.kind &&
      (next?.scope.kind !== 'instrument' ||
        (selection?.scope.kind === 'instrument' && next.scope.stemId === selection.scope.stemId))
    )
      return;
    selection = next;
    changed();
  }
  function openLens(range: BarRange | null) {
    if (!reference || !axis || (!lens && !range)) return;
    const bars = reference.song.bars.filter((b) => b.endSeconds > b.startSeconds);
    const a = bars.find((b) => b.number === range?.firstBar),
      b = bars.find((b) => b.number === range?.lastBar);
    if (range && (!a || !b || b.number < a.number)) return;
    if (!lens && range && transition?.target !== 0) {
      savedView = { zoom, left: scroll.scrollLeft };
      setZoom(1);
      scroll.scrollLeft = 0;
    }
    lens = range ? { firstBar: range.firstBar, lastBar: range.lastBar } : null;
    if (a && b)
      lensEdges = { a: axis.xAtSeconds(a.startSeconds, 1), b: axis.xAtSeconds(b.endSeconds, 1) };
    const to = range ? lensProjection(lensEdges.a, lensEdges.b) : plain;
    transition = {
      from: projection,
      to,
      start: performance.now(),
      opening: expanded,
      target: range ? 1 : 0,
      duration: drag ? 160 : 450,
    };
    root.dataset.lens = range ? `${range.firstBar}:${range.lastBar}` : '';
    root.dataset.animating = 'true';
    header.hidden = !range;
    root.querySelector<HTMLElement>('[data-lens-help]')!.hidden = !!range;
    if (range)
      root.querySelector<HTMLElement>('[data-lens-title]')!.textContent =
        `Bars ${range.firstBar}–${range.lastBar}`;
    root.querySelector<HTMLButtonElement>('[data-earlier]')!.disabled =
      !range || range.firstBar <= bars[0].number;
    root.querySelector<HTMLButtonElement>('[data-later]')!.disabled =
      !range || range.lastBar >= bars.at(-1)!.number;
    slider.disabled = true;
    root.dispatchEvent(new CustomEvent('lenschange', { detail: lens }));
    schedule();
  }
  function moveLens(delta: number) {
    if (!lens || !reference) return;
    const bars = reference.song.bars.filter((b) => b.endSeconds > b.startSeconds);
    const count = lens.lastBar - lens.firstBar;
    const start = Math.max(
      bars[0].number,
      Math.min(bars.at(-1)!.number - count, lens.firstBar + delta),
    );
    if (start !== lens.firstBar) openLens({ firstBar: start, lastBar: start + count });
  }
  root.querySelector<HTMLButtonElement>('[data-select]')!.onclick = () => {
    const a = reference?.song.bars.find((b) => b.number === Number(first.value)),
      b = reference?.song.bars.find((b) => b.number === Number(last.value));
    if (a && b)
      choose(
        Math.min(a.startSeconds, b.startSeconds),
        Math.max(a.endSeconds, b.endSeconds),
        instrumentChoice.value,
      );
  };
  closer.onclick = () => {
    if (selection) {
      openLens(selection);
      header.focus();
    }
  };
  clear.onclick = () => {
    selection = null;
    changed();
  };
  scope.onchange = () => {
    selection = null;
    changed();
    settingsChanged();
  };
  instrumentChoice.onchange = () => {
    selection = null;
    changed();
  };
  snap.onchange = () => {
    selection = null;
    changed();
    settingsChanged();
  };
  root.querySelector<HTMLButtonElement>('[data-earlier]')!.onclick = () => moveLens(-1);
  root.querySelector<HTMLButtonElement>('[data-later]')!.onclick = () => moveLens(1);
  root.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => {
    openLens(null);
    if (closer.disabled) overview.focus();
    else closer.focus();
  };
  function lensKeys(e: KeyboardEvent) {
    if (!lens) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      moveLens(e.key === 'ArrowLeft' ? -1 : 1);
    }
    if (e.key === 'Escape') {
      openLens(null);
      if (closer.disabled) overview.focus();
      else closer.focus();
    }
  }
  header.onkeydown = lensKeys;
  let drag: { x: number; first: number; last: number; unit: number } | null = null;
  function startDrag(e: PointerEvent, songStrip: boolean) {
    if (
      !lens ||
      !axis ||
      e.button !== 0 ||
      (e.target instanceof Element && e.target.closest('button'))
    )
      return;
    const box = (songStrip ? overview : header).getBoundingClientRect();
    const bars = reference!.song.bars.filter(
      (b) => b.number >= lens!.firstBar && b.number <= lens!.lastBar,
    );
    const fraction = (lensEdges.b - lensEdges.a) / Math.max(1, bars.length);
    drag = {
      x: e.clientX,
      first: lens.firstBar,
      last: lens.lastBar,
      unit: Math.max(
        1,
        songStrip
          ? fraction * box.width
          : (viewport * 0.32 * fraction) / Math.max(0.0001, 1 - (lensEdges.b - lensEdges.a)),
      ),
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function dragMove(e: PointerEvent) {
    if (!drag || !lens) return;
    const delta = Math.round((e.clientX - drag.x) / drag.unit);
    moveLens(drag.first + delta - lens.firstBar);
  }
  header.onpointerdown = (e) => startDrag(e, false);
  header.onpointermove = dragMove;
  header.onpointerup = header.onpointercancel = () => {
    drag = null;
  };
  let selecting: { seconds: number; stem: string; x: number; kind: string } | null = null;
  const pointerSeconds = (e: PointerEvent) =>
    axis!.secondsAtX(
      project(
        projection,
        (e.clientX - scroll.getBoundingClientRect().left - LABEL_WIDTH + scroll.scrollLeft) / width,
        true,
      ) * width,
      width,
    );
  scroll.onpointerdown = (e) => {
    const row =
      e.target instanceof Element ? e.target.closest<HTMLElement>('[data-row][data-stem]') : null;
    if (
      !row ||
      !axis ||
      e.button !== 0 ||
      e.clientX < scroll.getBoundingClientRect().left + LABEL_WIDTH
    )
      return;
    selecting = {
      seconds: pointerSeconds(e),
      stem: row.dataset.stem!,
      x: e.clientX,
      kind: row.dataset.row ?? '',
    };
    instrumentChoice.value = selecting.stem;
    scroll.setPointerCapture(e.pointerId);
    e.preventDefault();
    choose(selecting.seconds, selecting.seconds, selecting.stem);
  };
  scroll.onpointermove = (e) => {
    if (selecting) choose(selecting.seconds, pointerSeconds(e), selecting.stem);
  };
  scroll.onpointerup = (e) => {
    if (
      selecting &&
      Math.abs(e.clientX - selecting.x) < 3 &&
      (selecting.kind === 'mine' || selecting.kind === 'layers')
    ) {
      const seconds = pointerSeconds(e);
      const place = rows
        .find((r) => r.kind === 'mine' && r.instrument.stem.id === selecting?.stem)
        ?.places.find((p) => seconds >= p.startSeconds && seconds < p.endSeconds);
      if (place) root.dispatchEvent(new CustomEvent('placeopen', { detail: place.id }));
    }
    if (selecting && selection) {
      first.value = String(selection.firstBar);
      last.value = String(selection.lastBar);
    }
    selecting = null;
  };
  scroll.onpointercancel = () => {
    selecting = null;
  };
  function schedule() {
    if (!frame) frame = requestAnimationFrame(draw);
  }
  function rebuild() {
    overviewWidth = 0;
    const previousRows = rows;
    content.replaceChildren();
    rulerWidth = 0;
    rulerBars = [];
    rulerMarks = [];
    rows = [];
    if (!reference || !axis) return;
    const ruler = element('div', '', 'tl-row tl-ruler');
    ruler.append(element('span', 'BAR', 'tl-label'));
    const track = element('div', '', 'tl-track');
    track.dataset.ruler = '';
    for (const bar of reference.song.bars) {
      const inference = barInference(bar);
      const label = element('span', `${bar.number}`, `tl-bar${inference ? ' tl-inferred' : ''}`);
      if (inference) label.dataset.inferred = '';
      label.dataset.bar = String(bar.number);
      rulerBars.push({ label, bar });
      label.title = `Bar ${bar.number}${bar.partial ? ' · partial' : ''}${inference ? ` · inferred grid: ${inference}` : ''}`;
      track.append(label);
    }
    const coverage = reference.song.beatMap.coverage;
    const regionMark = (
      text: string,
      start: number,
      end: number,
      edge: boolean,
      description: string,
    ) => {
      const mark = element('span', text, 'tl-mark');
      mark.dataset.seconds = String(start);
      mark.dataset[edge ? 'uncovered' : 'gap'] = '';
      mark.title = description;
      track.append(mark);
      rulerMarks.push({
        node: mark,
        start,
        end,
        edge,
        description,
        width: Math.ceil(text.length * 6) + 5,
      });
    };
    for (const [a, b] of coverage.gaps) regionMark('gap', a, b, false, `Beat-map gap: ${a}–${b} s`);
    if (
      coverage.last_beat_seconds !== null &&
      coverage.last_beat_seconds < reference.song.durationSeconds
    )
      regionMark(
        'no beat map →',
        coverage.last_beat_seconds,
        reference.song.durationSeconds,
        true,
        `No beat map after ${coverage.last_beat_seconds} s`,
      );
    if (
      coverage.first_beat_seconds === null ||
      coverage.first_beat_seconds > 0 ||
      !reference.song.bars.length
    )
      regionMark(
        'no beat map',
        0,
        !reference.song.bars.length
          ? reference.song.durationSeconds
          : (coverage.first_beat_seconds ?? reference.song.durationSeconds),
        true,
        !reference.song.bars.length
          ? 'No numbered beat map'
          : `No beat map before ${coverage.first_beat_seconds} s`,
      );
    rulerMarks.sort((a, b) => a.start - b.start);
    ruler.append(track);
    content.append(ruler);
    for (const instrument of timelineRows(
      reference.song,
      audio.checked,
      (id) => modes.get(id) ?? (viewMode.value === 'layers' ? 'layers' : 'rows'),
    )) {
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
      const view = document.createElement('select');
      view.setAttribute('aria-label', `${stem.id} view`);
      view.add(new Option('Rows', 'rows'));
      view.add(new Option('Layers', 'layers'));
      view.value = modes.get(stem.id) ?? viewMode.value;
      view.onchange = () => {
        modes.set(stem.id, view.value === 'layers' ? 'layers' : 'rows');
        rebuild();
        root
          .querySelector<HTMLSelectElement>(`select[aria-label="${CSS.escape(stem.id)} view"]`)
          ?.focus({ preventScroll: true });
      };
      heading.append(view);
      const data = material(reference.song, stem, score);
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
      const pitches = [...stem.notes, ...data.literal.notes, ...data.mine.notes].map(
        (n) => n.pitch,
      );
      const lo = pitches.length ? Math.min(...pitches) : 48;
      const hi = pitches.length ? Math.max(...pitches) : 60;
      const gaps: DrawingRow['gaps'] = [];
      for (const bar of reference.song.bars) {
        if (
          bar.endSeconds <= bar.startSeconds ||
          data.places.some((p) => bar.number >= p.fromBar && bar.number < p.toBar)
        )
          continue;
        const last = gaps.at(-1);
        if (last && Math.abs(last.endSeconds - bar.startSeconds) < 1e-8)
          last.endSeconds = bar.endSeconds;
        else gaps.push({ startSeconds: bar.startSeconds, endSeconds: bar.endSeconds });
      }
      for (const row of instrument.rows) {
        const layered = row.kind === 'layers';
        const line = element('div', '', 'tl-row');
        line.style.height = `${row.height}px`;
        line.dataset.row = row.kind;
        line.dataset.stem = stem.id;
        const label = element(
          'div',
          row.kind === 'audio'
            ? 'audio'
            : row.kind === 'midi'
              ? 'MIDI'
              : layered
                ? 'MIDI · Notes · Mine'
                : row.kind === 'notes'
                  ? 'Notes'
                  : 'Mine',
          'tl-label',
        );
        if (instrument.drums && row.kind !== 'audio') {
          const lanes = element('div', '', 'tl-drums');
          for (const lane of DRUM_LANES) lanes.append(element('span', lane));
          label.append(lanes);
        }
        const track = element('div', '', `tl-track${layered ? ' tl-layered' : ''}`);
        line.append(label, track);
        content.append(line);
        const kinds = layered
          ? (['midi', 'notes', 'mine'] as const)
          : row.kind === 'layers'
            ? []
            : [row.kind];
        for (const kind of kinds) {
          const source =
            kind === 'notes'
              ? data.literal
              : kind === 'mine'
                ? data.mine
                : { notes: stem.notes, message: '' };
          const old = previousRows.find(
            (r) =>
              r.instrument.stem === stem &&
              r.kind === kind &&
              r.layered === layered &&
              r.sourceNotes === source.notes &&
              r.lo === lo &&
              r.hi === hi,
          );
          const allMarks =
            old?.allMarks ??
            (kind === 'midi' || kind === 'audio'
              ? marks
              : noteMarks({ ...stem, notes: source.notes }, axis));
          const canvas = old?.canvas ?? document.createElement('canvas');
          canvas.dataset.layer = kind;
          canvas.setAttribute('role', 'img');
          canvas.setAttribute(
            'aria-description',
            kind === 'audio'
              ? 'Local stem waveform'
              : `${source.notes.length} notes${kind === 'mine' ? ` · ${gaps.length} unarranged ranges` : ''}`,
          );
          canvas.setAttribute(
            'aria-label',
            `${stem.id} ${kind === 'audio' ? 'waveform' : kind === 'midi' ? (instrument.drums ? 'drum lanes: Crash, Hi-hat, Snare, Tom, Kick' : 'pitch contour') : kind === 'notes' ? 'Notes literal conversion' : 'Mine queried arrangement'}`,
          );
          if (layered && kind === 'midi') canvas.style.opacity = '0.38';
          track.append(canvas);
          if (kind !== 'audio' && (source.message || allMarks.length < source.notes.length)) {
            const warning = element(
              'span',
              `${kind}: ${source.message || `${allMarks.length} of ${source.notes.length} drawn · at most 200 per bar cell`}`,
              'tl-row-warning',
            );
            warning.dataset.rowStatus = kind;
            track.append(warning);
          }
          rows.push({
            sourceNotes: source.notes,
            canvas,
            instrument,
            kind,
            layered,
            height: row.height,
            openHeight: layered
              ? 150
              : kind === 'audio'
                ? 44
                : kind === 'notes'
                  ? 50
                  : kind === 'mine'
                    ? 100
                    : 58,
            message: source.message,
            places: data.places,
            gaps,
            allMarks,
            outside: old?.outside ?? document.createElement('canvas'),
            outsideWidth: old?.outsideWidth ?? 0,
            outsidePlain: old?.outsidePlain ?? document.createElement('canvas'),
            waveform: old?.waveform ?? null,
            lo,
            hi,
            marks:
              old?.marks ??
              (instrument.drums ? allMarks : contourMarks(allMarks, axis.span, stem.id === 'bass')),
          });
        }
      }
    }
    schedule();
  }
  function backdrop(row: DrawingRow, pixels: number, color: (token: string) => string) {
    if (!reference || !axis || row.outsideWidth === pixels) return;
    const h = row.openHeight;
    const noteH = row.layered || row.kind === 'mine' ? h - 18 : h;
    const ctx = surface(row.outside, pixels, h);
    if (!row.layered) {
      ctx.fillStyle = color('background');
      ctx.fillRect(0, 0, pixels, h);
    }
    ctx.strokeStyle = color('line');
    for (const bar of reference.song.bars) {
      const x = axis.xAtSeconds(bar.startSeconds, pixels);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.fillStyle = ctx.strokeStyle = color(row.kind === 'mine' ? 'mine' : 'recording');
    if (row.kind === 'audio') {
      const data = reference.audio.get(row.instrument.stem.id);
      if (data && !row.waveform) {
        const wave = document.createElement('canvas');
        wave.width = Math.min(30000, Math.ceil(axis.span * 64));
        wave.height = 44;
        const w = wave.getContext('2d')!;
        w.fillStyle = color('recording');
        w.beginPath();
        for (let px = 0; px < wave.width; px++) {
          const first = Math.floor(
            (axis.secondsAtX(px, wave.width) * data.buffer.sampleRate) / 1024,
          );
          const end = Math.min(
            data.peaks.length / 2,
            Math.max(
              first + 1,
              Math.ceil((axis.secondsAtX(px + 1, wave.width) * data.buffer.sampleRate) / 1024),
            ),
          );
          let lo = 0,
            hi = 0;
          for (let i = first; i < end; i++) {
            lo = Math.min(lo, data.peaks[i * 2]);
            hi = Math.max(hi, data.peaks[i * 2 + 1]);
          }
          w.rect(px, 22 - hi * 14, 1, Math.max(1, (hi - lo) * 14));
        }
        w.fill();
        row.waveform = wave;
      }
      if (row.waveform) ctx.drawImage(row.waveform, 0, 0, pixels, h);
    } else if (row.instrument.drums) {
      for (const mark of row.marks) {
        const lane = drumLane(mark.pitch);
        if (lane !== null) {
          ctx.globalAlpha = 0.3 + (mark.velocity / 127) * 0.7;
          noteRect(ctx, row, mark.x * pixels, 3 + (lane * (noteH - 6)) / 5, 2, 6);
        }
      }
      ctx.globalAlpha = 1;
    } else {
      const lo = row.lo,
        hi = Math.max(lo + 1, row.hi);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let previous: NoteMark | null = null;
      for (const mark of row.marks) {
        const x = mark.x * pixels,
          y = 5 + ((hi - mark.pitch) / (hi - lo)) * (noteH - 10);
        if (!previous || (mark.x - previous.end) * axis.span > 1.5) ctx.moveTo(x, y);
        else {
          ctx.lineTo(x, 5 + ((hi - previous.pitch) / (hi - lo)) * (noteH - 10));
          ctx.lineTo(x, y);
        }
        ctx.lineTo(mark.end * pixels, y);
        previous = mark;
      }
      ctx.stroke();
    }
    const coverage = reference.song.beatMap.coverage;
    const gaps = [...coverage.gaps];
    if (coverage.first_beat_seconds === null) gaps.push([0, reference.song.durationSeconds]);
    else if (coverage.first_beat_seconds > 0) gaps.push([0, coverage.first_beat_seconds]);
    if (
      coverage.last_beat_seconds !== null &&
      coverage.last_beat_seconds < reference.song.durationSeconds
    )
      gaps.push([coverage.last_beat_seconds, reference.song.durationSeconds]);
    for (const [start, end] of row.layered && row.kind !== 'mine' ? [] : gaps) {
      const a = axis.xAtSeconds(start, pixels),
        b = axis.xAtSeconds(end, pixels);
      ctx.save();
      ctx.beginPath();
      ctx.rect(a, 0, b - a, h);
      ctx.clip();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = color('muted');
      for (let x = a - h; x < b; x += 7) {
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + h, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
    // Cache the blur once, before lens interaction. Scaling the squeezed context also
    // scales its softness. No full-height backdrop or per-frame Gaussian blur.
    const copy = row.outsidePlain;
    copy.width = row.outside.width;
    copy.height = row.outside.height;
    copy.getContext('2d')!.drawImage(row.outside, 0, 0);
    ctx.filter = 'blur(4px) saturate(.7)';
    ctx.drawImage(copy, 0, 0, pixels, h);
    ctx.filter = 'none';
    row.outsideWidth = pixels;
  }
  function draw() {
    frame = 0;
    if (!reference || !axis) return;
    // Read all positions before any frame writes, avoiding interleaved forced layouts.
    const visibleRows = new Set(
      rows.filter((row) => {
        const r = row.canvas.getBoundingClientRect();
        return r.bottom >= -150 && r.top <= innerHeight + 150;
      }),
    );
    if (transition) {
      const t = reduced.matches
        ? 1
        : Math.min(1, (performance.now() - transition.start) / transition.duration);
      const ease = lensEase(t);
      projection = interpolate(transition.from, transition.to, ease);
      expanded = transition.opening + (transition.target - transition.opening) * ease;
      if (t === 1) {
        projection = transition.to;
        transition = null;
        root.dataset.animating = 'false';
        if (!lens) {
          slider.disabled = false;
          setZoom(savedView.zoom);
          scroll.scrollLeft = savedView.left;
        }
      } else schedule();
      rulerWidth = 0;
    }
    viewport = Math.max(1, scroll.clientWidth - LABEL_WIDTH);
    width = viewport * zoom;
    root.style.setProperty('--tl-viewport', `${scroll.clientWidth}px`);
    content.style.width = `${width + LABEL_WIDTH}px`;
    const left = Math.min(scroll.scrollLeft, Math.max(0, width - viewport));
    const style = getComputedStyle(root);
    const colors = new Map<string, string>();
    const color = (token: string) => {
      let value = colors.get(token);
      if (value === undefined) {
        value = style.getPropertyValue(`--tl-${token}`).trim();
        colors.set(token, value);
      }
      return value;
    };
    const x = (seconds: number) => project(projection, axis!.xAtSeconds(seconds, 1)) * width - left;
    const a = project(projection, lensEdges.a) * width - left,
      b = project(projection, lensEdges.b) * width - left;
    header.style.left = `${a}px`;
    header.style.width = `${b - a}px`;
    if (rulerWidth !== width) {
      let previousEnd = -Infinity;
      let previousLabel: HTMLElement | null = null;
      for (const { label, bar } of rulerBars) {
        const px = x(bar.startSeconds) + left;
        label.style.left = `${px}px`;
        const fits = px >= previousEnd + 4;
        if (!fits && bar.number === 1 && previousLabel?.dataset.bar === '0')
          previousLabel.style.visibility = 'hidden';
        const visible = fits || bar.number === 1;
        label.style.visibility = visible ? 'visible' : 'hidden';
        if (visible) {
          previousEnd = px + String(bar.number).length * 7 + 5;
          previousLabel = label;
        }
      }
      rulerWidth = width;
    }
    // Region labels have a separate line and follow only visible uncertainty regions.
    const placed: { node: HTMLElement; left: number; right: number }[] = [];
    for (const mark of rulerMarks) {
      mark.node.title = mark.description;
      const start = x(mark.start),
        end = x(mark.end);
      if (end <= 0 || start >= viewport) {
        mark.node.style.visibility = 'hidden';
        continue;
      }
      const px = Math.max(0, Math.min(viewport - mark.width, start));
      const overlaps = placed.filter((p) => px < p.right + 4 && px + mark.width > p.left - 4);
      if (overlaps.length && !mark.edge) {
        mark.node.style.visibility = 'hidden';
        overlaps[0].node.title += ` · ${mark.description}`;
        continue;
      }
      for (const old of overlaps) {
        old.node.style.visibility = 'hidden';
        mark.node.title += ` · ${old.node.title}`;
        placed.splice(placed.indexOf(old), 1);
      }
      mark.node.style.left = `${px + left}px`;
      mark.node.style.visibility = 'visible';
      placed.push({ node: mark.node, left: px, right: px + mark.width });
    }
    // Outside grid lines are already in the cached context; redraw only the lens's lines.
    const visibleBars = expanded
      ? reference.song.bars.filter((bar) => {
          const px = x(bar.startSeconds);
          return px >= a && px <= b;
        })
      : axis.visibleBars(left, viewport, width);
    const coverage = reference.song.beatMap.coverage;
    const regions: { a: number; b: number }[] = coverage.gaps.map(([a, b]) => ({ a, b }));
    if (!reference.song.bars.length) regions.push({ a: 0, b: reference.song.durationSeconds });
    else {
      if ((coverage.first_beat_seconds ?? 0) > 0)
        regions.push({ a: 0, b: coverage.first_beat_seconds! });
      if (coverage.last_beat_seconds !== null)
        regions.push({ a: coverage.last_beat_seconds, b: reference.song.durationSeconds });
    }
    for (const row of rows) {
      const displayHeight = row.height + (row.openHeight - row.height) * expanded;
      const height = row.openHeight;
      const noteHeight = row.layered || row.kind === 'mine' ? height - 18 : height;
      row.canvas.parentElement!.parentElement!.style.height = `${displayHeight}px`;
      row.canvas.style.height = `${displayHeight}px`;
      if (!visibleRows.has(row)) continue;
      if (!transition || !row.outsideWidth) backdrop(row, viewport, color);
      // Grow the displayed row without reallocating twelve canvas buffers every frame.
      const ctx = surface(row.canvas, viewport, height);
      row.canvas.style.height = `${displayHeight}px`;
      const overlays = !row.layered || row.kind === 'mine';
      if (expanded && overlays) {
        ctx.fillStyle = color('panel');
        ctx.globalAlpha = 0.4 * expanded;
        ctx.fillRect(a, 0, b - a, height);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color('line');
        ctx.beginPath();
        for (const beat of reference.song.beatMap.beats) {
          const px = x(beat);
          if (px > a && px < b) {
            ctx.moveTo(px, 0);
            ctx.lineTo(px, height);
          }
        }
        ctx.stroke();
      }
      if (expanded) {
        const source = row.outsidePlain,
          l = Math.max(0, Math.min(viewport, a)),
          r = Math.max(0, Math.min(viewport, b));
        if (l > 0 && lensEdges.a > 0)
          ctx.drawImage(source, 0, 0, lensEdges.a * source.width, source.height, 0, 0, l, height);
        if (r < viewport && lensEdges.b < 1)
          ctx.drawImage(
            source,
            lensEdges.b * source.width,
            0,
            (1 - lensEdges.b) * source.width,
            source.height,
            r,
            0,
            viewport - r,
            height,
          );
      }
      ctx.strokeStyle = color('line');
      ctx.setLineDash([]);
      ctx.beginPath();
      for (const bar of visibleBars) {
        ctx.moveTo(x(bar.startSeconds), 0);
        ctx.lineTo(x(bar.startSeconds), height);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color(row.kind === 'mine' ? 'mine' : 'recording');
      ctx.strokeStyle = ctx.fillStyle;
      if (row.kind === 'audio') {
        const wave = row.waveform;
        if (wave)
          for (let i = 1; i < projection.length; i++) {
            const from = projection[i - 1],
              to = projection[i];
            if (to.u <= from.u || to.x <= from.x) continue;
            ctx.drawImage(
              wave,
              from.u * wave.width,
              0,
              (to.u - from.u) * wave.width,
              44,
              from.x * width - left,
              (noteHeight - 44) / 2,
              (to.x - from.x) * width,
              44,
            );
          }
      } else if (row.instrument.drums) {
        ctx.globalAlpha = 0.2;
        for (let lane = 1; lane < 5; lane++)
          ctx.fillRect(0, 3 + lane * ((noteHeight - 6) / 5), viewport, 1);
        ctx.globalAlpha = 1;
        for (const mark of row.marks) {
          if (expanded && (mark.x < lensEdges.a || mark.x >= lensEdges.b)) continue;
          const px = project(projection, mark.x) * width - left,
            lane = drumLane(mark.pitch);
          if (lane !== null && px >= -2 && px <= viewport) {
            ctx.globalAlpha = 0.3 + (mark.velocity / 127) * 0.7;
            noteRect(
              ctx,
              row,
              px,
              3 + lane * ((noteHeight - 6) / 5),
              Math.max(2, Math.min(5, (width / axis.span) * 0.09)),
              6,
            );
          }
        }
      } else {
        if (expanded) {
          const lo = row.lo,
            hi = Math.max(lo + 12, row.hi);
          ctx.globalAlpha = expanded;
          for (let pitch = lo; pitch <= hi; pitch++) {
            ctx.fillStyle = color('line');
            ctx.fillRect(a, 4 + ((hi - pitch) / (hi - lo)) * (noteHeight - 10), b - a, 1);
          }
          ctx.fillStyle = color(row.kind === 'mine' ? 'mine' : 'recording');
          for (const mark of row.allMarks) {
            const px = project(projection, mark.x) * width - left,
              end = project(projection, mark.end) * width - left;
            if (end < a || px > b) continue;
            noteRect(
              ctx,
              row,
              Math.max(a, px),
              4 + ((hi - mark.pitch) / (hi - lo)) * (noteHeight - 10),
              Math.max(1, Math.min(b, end) - Math.max(a, px)),
              Math.max(2, Math.min(6, (noteHeight - 10) / (hi - lo))),
            );
          }
          ctx.globalAlpha = 1;
        }
        const lo = row.lo,
          hi = Math.max(lo + 1, row.hi);
        let previousEnd: number | null = null;
        let previousY = 0;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.save();
        ctx.beginPath();
        ctx.rect(expanded ? a : 0, 0, expanded ? b - a : viewport, noteHeight);
        ctx.clip();
        ctx.beginPath();
        ctx.globalAlpha = 1 - expanded;
        for (const mark of expanded < 1 ? row.marks : []) {
          if (expanded && (mark.end < lensEdges.a || mark.x > lensEdges.b)) continue;
          const a = project(projection, mark.x) * width - left,
            b = project(projection, mark.end) * width - left;
          if (b < 0 || a > viewport) continue;
          const y = 5 + ((hi - mark.pitch) / (hi - lo)) * (noteHeight - 10);
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
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      for (const region of overlays ? regions : []) {
        const a = Math.max(0, x(region.a)),
          b = Math.min(viewport, x(region.b));
        if (b <= a) continue;
        ctx.save();
        ctx.beginPath();
        ctx.rect(a, 0, b - a, height);
        ctx.clip();
        ctx.fillStyle = color('muted');
        ctx.globalAlpha = 0.07;
        ctx.fillRect(a, 0, b - a, height);
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = color('muted');
        for (let px = a - height; px < b; px += 7) {
          ctx.beginPath();
          ctx.moveTo(px, height);
          ctx.lineTo(px + height, 0);
          ctx.stroke();
        }
        ctx.restore();
      }
      if (expanded) {
        const source = row.outside;
        const sourceHeight = source.height;
        ctx.save();
        ctx.globalAlpha = expanded;
        const l = Math.max(0, Math.min(viewport, a)),
          r = Math.max(0, Math.min(viewport, b));
        if (l > 0 && lensEdges.a > 0)
          ctx.drawImage(source, 0, 0, lensEdges.a * source.width, sourceHeight, 0, 0, l, height);
        if (r < viewport && lensEdges.b < 1)
          ctx.drawImage(
            source,
            lensEdges.b * source.width,
            0,
            (1 - lensEdges.b) * source.width,
            sourceHeight,
            r,
            0,
            viewport - r,
            height,
          );
        if (overlays) {
          ctx.fillStyle = color('background');
          ctx.globalAlpha = 0.24 * expanded;
          ctx.fillRect(0, 0, l, height);
          ctx.fillRect(r, 0, viewport - r, height);
        }
        ctx.restore();
      }
      if (row.kind === 'mine') {
        ctx.save();
        ctx.font = '11px system-ui';
        for (const gap of row.gaps) {
          const l = Math.max(0, x(gap.startSeconds)),
            r = Math.min(viewport, x(gap.endSeconds));
          if (r <= l) continue;
          ctx.fillStyle = color('muted');
          ctx.globalAlpha = 0.08;
          ctx.fillRect(l, 0, r - l, height);
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = color('muted');
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(l + 1, 2, Math.max(0, r - l - 2), height - 4);
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          if (r - l > 80) ctx.fillText('Unarranged', l + 6, height - 10);
        }
        for (const p of row.places) {
          const l = Math.max(0, x(p.startSeconds)),
            r = Math.min(viewport, x(p.endSeconds));
          if (r <= l) continue;
          ctx.strokeStyle = color('mine');
          ctx.globalAlpha = 0.5;
          ctx.strokeRect(l + 1, 1, Math.max(0, r - l - 2), height - 2);
          ctx.globalAlpha = 1;
          ctx.fillStyle = color('mine');
          if (r - l > 50)
            ctx.fillText(
              p.name + (p.edited ? ' · edited' : ''),
              l + 5,
              height - 9,
              Math.max(1, r - l - 10),
            );
        }
        ctx.restore();
      }
      if (
        overlays &&
        selection &&
        (selection.scope.kind === 'band' || selection.scope.stemId === row.instrument.stem.id)
      ) {
        ctx.fillStyle = color('mine');
        ctx.globalAlpha = 0.12;
        ctx.fillRect(
          x(selection.start.seconds),
          0,
          x(selection.end.seconds) - x(selection.start.seconds),
          height,
        );
        ctx.globalAlpha = 1;
      }
    }
    const ctx = surface(overview, viewport, 32);
    // The recording overview is static during lens/scroll frames; only its window moves.
    if (overviewWidth !== viewport) {
      const notes = surface(overviewNotes, viewport, 32);
      notes.strokeStyle = color('recording');
      notes.globalAlpha = 0.45;
      for (const row of rows)
        if (row.kind === 'midi')
          for (const m of row.marks)
            notes.strokeRect(m.x * viewport, 9, Math.max(1, (m.end - m.x) * viewport), 14);
      overviewWidth = viewport;
    }
    ctx.drawImage(overviewNotes, 0, 0, viewport, 32);
    ctx.strokeStyle = color('text');
    ctx.lineWidth = 2;
    ctx.strokeRect(
      lens ? lensEdges.a * viewport : (left / width) * viewport + 1,
      1,
      lens
        ? (lensEdges.b - lensEdges.a) * viewport
        : Math.max(2, (viewport / width) * viewport - 2),
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
  root.querySelector<HTMLButtonElement>('[data-fit]')!.onclick = () => {
    if (lens) openLens(null);
    savedView = { zoom: 1, left: 0 };
    setZoom(1);
  };
  audio.onchange = () => {
    rebuild();
    settingsChanged();
  };
  scroll.addEventListener('scroll', schedule);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  const observer = new ResizeObserver(schedule);
  observer.observe(scroll);
  function navigate(clientX: number) {
    const box = overview.getBoundingClientRect();
    scroll.scrollLeft = ((clientX - box.left) / box.width) * width - viewport / 2;
    schedule();
  }
  overview.onpointerdown = (e) => {
    if (lens) {
      startDrag(e, true);
      return;
    }
    overview.setPointerCapture(e.pointerId);
    navigate(e.clientX);
  };
  overview.onpointermove = (e) => {
    if (lens) {
      dragMove(e);
      return;
    }
    if (overview.hasPointerCapture(e.pointerId)) navigate(e.clientX);
  };
  overview.onpointerup = overview.onpointercancel = () => {
    drag = null;
  };
  overview.onkeydown = (e) => {
    if (lens) {
      lensKeys(e);
      return;
    }
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
      const hadLens = !!lens;
      reference = value;
      score = { ...score, doc: null, instruments: [], places: [], events: {}, linked: false };
      selection = null;
      lens = null;
      projection = plain;
      transition = null;
      expanded = 0;
      if (hadLens) root.dispatchEvent(new CustomEvent('lenschange', { detail: null }));
      root.dataset.lens = '';
      root.dataset.animating = 'false';
      header.hidden = true;
      slider.disabled = false;
      root.querySelector<HTMLElement>('[data-lens-help]')!.hidden = false;
      instrumentChoice.replaceChildren(
        ...(value?.song.stems ?? []).map((stem) => {
          const option = document.createElement('option');
          option.value = option.textContent = stem.id;
          return option;
        }),
      );
      changed();
      root.hidden = !value;
      delete root.dataset.drawn;
      if (!value) {
        axis = null;
        rows = [];
        rulerBars = [];
        rulerMarks = [];
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
        `${value.song.name} · ${value.song.bars.filter((b) => b.number > 0).length} bars${value.song.bars.some((b) => b.number === 0) ? ' + pickup bar 0' : ''} · Blue: recording · Dotted underline: grid inference · Hatching: gap or no beat map`;
      rebuild();
    },
    observeLayout(element: Element) {
      observer.observe(element);
    },
    materialFor(stemId: string) {
      const stem = reference?.song.stems.find((s) => s.id === stemId);
      return reference && stem ? material(reference.song, stem, score) : null;
    },
    setScore(value: TimelineScore) {
      if (
        score.doc === value.doc &&
        score.events === value.events &&
        score.grid === value.grid &&
        score.linked === value.linked &&
        score.places.length === value.places.length &&
        score.places.every((p, i) => p.id === value.places[i].id)
      )
        return;
      score = value;
      rebuild();
    },
    get selection() {
      return selection;
    },
    get lens() {
      return lens;
    },
    settingsHost,
    get settings() {
      return getSettings();
    },
    setSettings,
    lensHost: root.querySelector<HTMLElement>('[data-lens-host]')!,
    openLens,
    moveLens,
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
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
      settingsHost.remove();
      root.replaceChildren();
      rows = [];
      rulerBars = [];
      rulerMarks = [];
      reference = null;
      axis = null;
      root.hidden = true;
    },
  };
}
