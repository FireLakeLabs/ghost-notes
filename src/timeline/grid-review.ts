import type { ReferenceSong } from '../reference/types';
import {
  candidateGrid,
  chooseGrid,
  meterEvidence,
  splitMeter,
  type BarGrouping,
} from './grid-choice';
import './grid-review.css';

/** Same seconds and same source notes in every card; only the candidate grid changes. */
export function mountGridReview(root: HTMLElement, apply: (song: ReferenceSong) => void) {
  root.classList.add('grid-review');
  root.hidden = true;
  root.innerHTML = `<button data-review type="button">Tempo and bars…</button><section data-tempo hidden aria-label="Check tempo and bars"><h3>Check the tempo and bars</h3><p>The beat tracker may be unsure. Compare the same recording excerpt under each grid. Choose a grid to apply the tempo and grouping.</p><p data-meter-evidence></p><label>Beats per bar <select aria-label="Beats per bar"><option value="0">Detected grouping</option></select></label> <label>Beat one <select aria-label="Beat one"><option value="0">First downbeat</option></select></label><div class="grid-cards"></div><button data-keep type="button">Keep current grid</button><p>These choices keep the note times. You can reopen this control during this session.</p></section>`;
  const panel = root.querySelector<HTMLElement>('[data-tempo]')!,
    review = root.querySelector<HTMLButtonElement>('[data-review]')!;
  const meter = root.querySelector<HTMLSelectElement>('[aria-label="Beats per bar"]')!,
    one = root.querySelector<HTMLSelectElement>('[aria-label="Beat one"]')!;
  const cards = root.querySelector<HTMLElement>('.grid-cards')!;
  let song: ReferenceSong | null = null,
    grouping: BarGrouping | null = null;
  function setOpen(open: boolean) {
    panel.hidden = !open;
    review.setAttribute('aria-expanded', String(open));
  }
  function options() {
    const count = Number(meter.value) || 1;
    one.replaceChildren(
      ...Array.from({ length: count }, (_, i) => {
        const option = document.createElement('option');
        option.value = String(i);
        option.textContent = i === 0 ? 'First downbeat' : `${i} beat${i === 1 ? '' : 's'} later`;
        return option;
      }),
    );
    one.value = String(grouping?.firstBeat ?? 0);
    one.disabled = meter.value === '0';
  }
  function render() {
    if (!song) return;
    const current = song;
    const anchor = current.detectedBeatMap.downbeats[0] ?? 0;
    const start = anchor,
      end = Math.min(
        current.durationSeconds,
        current.detectedBeatMap.beats[current.detectedBeatMap.beats.indexOf(anchor) + 16] ??
          start + 8,
      );
    const span = Math.max(0.001, end - start);
    const stem =
      current.stems.find((s) => s.id === 'drums' && s.notes.length) ||
      current.stems.find((s) => s.notes.length);
    const sourceNotes =
      stem?.notes.filter((n) => n.startSeconds >= start && n.startSeconds < end) ?? [];
    const notes =
      sourceNotes.length <= 200
        ? sourceNotes
        : Array.from(
            { length: 200 },
            (_, i) => sourceNotes[Math.round((i * (sourceNotes.length - 1)) / 199)],
          );
    cards.replaceChildren();
    for (const factor of [0.5, 1, 2] as const) {
      const grid = candidateGrid(current, factor, grouping);
      const card = document.createElement('div');
      card.className = 'grid-card';
      const label = factor === 0.5 ? '½×' : `${factor}×`;
      const heading = document.createElement('strong');
      const bars = grid.bars.filter(
        (b) => b.startSeconds >= start && b.startSeconds < end && b.bpm !== null,
      );
      const bpm = bars.length ? bars.reduce((n, b) => n + (b.bpm ?? 0), 0) / bars.length : null;
      heading.textContent = `${label} · ${bpm?.toFixed(1) ?? '—'} BPM`;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 300 96');
      svg.setAttribute('role', 'img');
      svg.setAttribute(
        'aria-label',
        `${label} grid over the same ${span.toFixed(1)} seconds of ${stem?.id ?? 'recording'}`,
      );
      const line = (a: number, b: number, y: number, height: number, cls: string) => {
        const rect = document.createElementNS(svg.namespaceURI, 'rect');
        rect.setAttribute('x', String(((a - start) / span) * 300));
        rect.setAttribute('width', String(Math.max(1, ((b - a) / span) * 300)));
        rect.setAttribute('y', String(y));
        rect.setAttribute('height', String(height));
        rect.setAttribute('class', cls);
        svg.append(rect);
      };
      for (const beat of grid.map.beats)
        if (beat >= start && beat < end) line(beat, beat, 18, 76, 'grid-beat');
      for (const bar of grid.bars)
        if (bar.startSeconds >= start && bar.startSeconds < end) {
          line(bar.startSeconds, bar.startSeconds, 18, 76, 'grid-bar');
          const text = document.createElementNS(svg.namespaceURI, 'text');
          text.setAttribute('x', String(((bar.startSeconds - start) / span) * 300 + 3));
          text.setAttribute('y', '12');
          text.textContent = String(bar.number);
          svg.append(text);
        }
      for (const n of notes)
        line(n.startSeconds, Math.min(end, n.endSeconds), 26 + (n.pitch % 12) * 5, 3, 'grid-note');
      const caption = document.createElement('small');
      caption.textContent = `${grid.map.beatsPerBar} beats/bar · ${span.toFixed(1)} s · ${grid.bars.filter((b) => b.number > 0).length} bars in song · ${notes.length}/${sourceNotes.length} excerpt marks`;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `Use ${label}`;
      button.disabled = !grid.bars.some(
        (bar) => bar.number > 0 && bar.endSeconds > bar.startSeconds,
      );
      button.onclick = () => {
        song = chooseGrid(current, grid);
        setOpen(false);
        apply(song);
        review.focus();
      };
      card.append(heading, svg, caption, button);
      cards.append(card);
    }
  }
  meter.onchange = () => {
    grouping = meter.value === '0' ? null : { beatsPerBar: Number(meter.value), firstBeat: 0 };
    options();
    render();
  };
  one.onchange = () => {
    if (grouping) grouping = { ...grouping, firstBeat: Number(one.value) };
    render();
  };
  review.onclick = () => {
    setOpen(panel.hidden === true);
    if (!panel.hidden) render();
  };
  root.querySelector<HTMLButtonElement>('[data-keep]')!.onclick = () => {
    setOpen(false);
    review.focus();
  };
  return {
    setSong(value: ReferenceSong | null) {
      song = value;
      grouping = null;
      root.hidden = !value;
      setOpen(Boolean(value && (value.beatMap.tempoReview.flagged || splitMeter(value))));
      if (!value) return;
      const sizes = Array.from({ length: 12 }, (_, i) => i + 1);
      meter.replaceChildren(
        ...[0, ...sizes].map((n) => {
          const o = document.createElement('option');
          o.value = String(n);
          o.textContent = n ? String(n) : 'Detected grouping';
          return o;
        }),
      );
      meter.value = '0';
      options();
      root.querySelector<HTMLElement>('[data-meter-evidence]')!.textContent = `Detected groups: ${
        meterEvidence(value)
          .map((c) => `${c.bars} with ${c.beats} beats`)
          .join('; ') || 'no complete bars'
      }. Choose a grouping and which beat is one if these bars need regrouping.`;
      if (!panel.hidden) render();
    },
  };
}
