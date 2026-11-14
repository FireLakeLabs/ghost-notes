import { generate } from '../generate';
import { sectionInstruments, type Doc } from '../document';
import {
  sectionSuggestions,
  suggestionDocument,
  suggestionIssue,
  type SectionSuggestions,
} from '../simplify/section';
import type { Suggestion } from '../simplify';
import { createBrowserQueries } from '../strudel/evaluate-browser';
import { mountDifferenceTip, type DifferenceHit } from '../timeline/difference-layer';
import { paintSimplifyReport } from '../timeline/simplify-report';
import type { mountSections } from '../timeline/sections';
import type { App } from './controller';
import type { OpenReference } from './reference';
import type { SessionSettings } from './settings';

const names: Record<string, string> = {
  'stray-notes': 'Quiet stray notes',
  'split-notes': 'Join split notes',
  'octave-errors': 'Short octave excursions',
  'interval-riffs': 'Interval riffs',
  'scale-degrees': 'Scale degrees',
  'euclidean-fits': 'Euclidean rhythms',
  'phrase-repeats': 'Repeated phrases',
  'drum-bars': 'Repeated drum bars',
};

export function mountSimplify(input: {
  app: App;
  root: HTMLElement;
  lensControls: HTMLElement;
  sections: ReturnType<typeof mountSections>;
  current(): OpenReference | null;
  settings: SessionSettings;
  editing(): boolean;
  limits(): void;
}) {
  const { app, sections, current, settings } = input;
  const button = document.createElement('button');
  button.textContent = 'Simplify…';
  button.setAttribute('aria-label', 'Simplify a section');
  input.root.querySelector('.tl-sections')!.prepend(button);
  const lensButton = document.createElement('button');
  lensButton.textContent = 'Simplify…';
  lensButton.setAttribute('aria-label', 'Simplify this section');
  input.lensControls.append(lensButton);
  const dialog = document.createElement('dialog');
  dialog.id = 'simplify-dialog';
  dialog.className = 'about-dialog simplify-dialog';
  dialog.setAttribute('aria-label', 'Simplify section');
  dialog.innerHTML = `<h2>Simplify section</h2>
    <p>Suggest a replacement from the recording's notes. Your arrangement changes only when you Apply.</p>
    <div class="simplify-choices"><label>Section <select data-simplify-place aria-label="Section to simplify"></select></label><label>Instrument <select data-simplify-stem aria-label="Instrument to simplify"></select></label><button data-ask>Ask for suggestions</button><button data-limits>Limits…</button></div>
    <p data-scope></p><p data-status role="status"></p>
    <div data-result hidden><label>Suggestion <select data-technique aria-label="Simplify technique"></select></label>
    <p data-report></p><p data-counts></p>
    <canvas role="img" tabindex="0" aria-label="Simplify proposal differences"></canvas>
    <p class="simplify-legend">Recording · faint blue. Proposal · cream. Changes · orange. Hollow blue · dropped. Same marks as the timeline.</p>
    <details><summary>Proposal code and size</summary><p data-size></p><pre data-code></pre></details></div>
    <div class="simplify-actions"><button data-apply disabled>Apply to section</button><button data-discard>Discard</button></div>`;
  document.body.append(dialog);
  const get = <T extends HTMLElement = HTMLElement>(selector: string) =>
    dialog.querySelector<T>(selector)!;
  const place = get<HTMLSelectElement>('[data-simplify-place]'),
    stem = get<HTMLSelectElement>('[data-simplify-stem]'),
    technique = get<HTMLSelectElement>('[data-technique]'),
    ask = get<HTMLButtonElement>('[data-ask]'),
    apply = get<HTMLButtonElement>('[data-apply]'),
    status = get('[data-status]'),
    canvas = get<HTMLCanvasElement>('canvas');
  const questions = createBrowserQueries();
  let serial = 0;
  let captured: { doc: Doc; reference: OpenReference; settings: string } | undefined;
  let proposal: SectionSuggestions | undefined;
  let chosen: Suggestion | undefined;
  let result: { kind: 'empty' | 'pending' } | { kind: 'ready'; doc: Doc } = { kind: 'empty' };
  let hits: DifferenceHit[] = [];
  const tip = mountDifferenceTip(dialog, () => hits);
  function paint() {
    if (!dialog.open || !captured || !proposal || !chosen) return;
    hits = paintSimplifyReport(canvas, captured.reference.song, proposal, chosen);
    tip.reposition();
  }
  new ResizeObserver(paint).observe(canvas);
  function clear(message = '') {
    serial++;
    questions.cancel();
    captured = undefined;
    proposal = undefined;
    chosen = undefined;
    result = { kind: 'empty' };
    hits = [];
    tip.hide();
    get('[data-result]').hidden = true;
    get('[data-code]').textContent = '';
    status.textContent = message;
    apply.disabled = true;
    ask.disabled = !stem.value;
    delete dialog.dataset.ready;
  }
  function scope() {
    const p = sections.places.find((p) => p.id === place.value);
    const previous = stem.value;
    stem.replaceChildren(
      ...(app.state.doc && p ? sectionInstruments(app.state.doc, p.id) : [])
        .filter((r) => current()?.song.stems.some((s) => s.id === r.pattern.stem))
        .map((r) => new Option(r.pattern.stem ?? r.name, r.pattern.stem)),
    );
    if (Array.from(stem.options).some((o) => o.value === previous)) stem.value = previous;
    get('[data-scope]').textContent = p
      ? `${p.name}: bars ${p.source?.fromBar}–${(p.source?.toBar ?? 1) - 1}. Every place using this section changes with it. Split off a place first to give it its own section. Existing sound and effects stay. Apply replaces current note edits; copies keep their own changes.`
      : 'Choose a linked section.';
    clear();
  }
  async function inspectSuggestion() {
    if (!proposal || !captured) return;
    const selected = proposal.suggestions[Number(technique.value)];
    if (!selected) return;
    chosen = selected;
    const { report } = selected;
    const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
    get('[data-result]').hidden = false;
    get('[data-report]').textContent =
      `${percent(report.keptShare)} of recording notes kept · ${percent(report.matchShare)} of proposal notes matching. ${report.matchedNotes} matched / ${report.originalNotes} counted recording / ${report.suggestedNotes} counted proposal notes. Onset and pitch match; duration and gain changes are in the marks.`;
    const count = (kind: string) => selected.changes.filter((c) => c.kind === kind).length;
    get('[data-counts]').textContent =
      `${count('moved')} moved · ${count('moved-across-bar-line')} crossed a bar line · ${count('shortened')} shortened · ${count('merged')} merged · ${count('dropped')} dropped · ${count('added')} added. Counts are change records; a note can have several marks. Before existing sound and gain effects.`;
    get('[data-size]').textContent =
      `${report.literalBytes} → ${report.suggestedBytes} standalone bytes · ${report.shorter ? 'shorter' : 'not shorter'}.`;
    get('[data-code]').textContent = selected.expression;
    paint();
    tip.hide();
    result = { kind: 'pending' };
    apply.disabled = true;
    delete dialog.dataset.ready;
    status.textContent = 'Checking the proposal in your whole program…';
    const request = ++serial;
    questions.cancel();
    const snapshot = captured;
    const next = suggestionDocument(snapshot.doc, proposal, selected);
    const answer = await questions.query(
      generate(next, { instrumentTags: true }),
      proposal.range.startCycle,
      proposal.range.endCycle,
    );
    if (request !== serial || !dialog.open) return;
    const issue = suggestionIssue(answer, proposal, selected);
    if (issue) {
      result = { kind: 'empty' };
      status.textContent = issue;
    } else {
      result = { kind: 'ready', doc: next };
      apply.disabled = false;
      status.textContent =
        'Proposal checked in context. Apply replaces this instrument’s notes in the section. Undo restores the previous version.';
      dialog.dataset.ready = 'true';
    }
  }
  function run(action: () => Promise<void>) {
    void action().catch((error: unknown) => {
      result = { kind: 'empty' };
      apply.disabled = true;
      status.textContent = error instanceof Error ? error.message : String(error);
    });
  }
  ask.onclick = () =>
    run(async () => {
      const start = performance.now();
      clear();
      const doc = app.state.doc,
        reference = current();
      if (!doc || !reference || !sections.linked || input.editing()) {
        status.textContent = input.editing()
          ? 'Finish the open editor before asking for a suggestion.'
          : 'Reopen the linked reference and section before asking for a suggestion.';
        return;
      }
      captured = { doc, reference, settings: JSON.stringify(settings) };
      proposal = sectionSuggestions({
        doc,
        song: reference.song,
        placeId: place.value,
        stemId: stem.value,
        grid: settings.grid,
        settings: settings.simplify,
        match: settings.match,
      });
      technique.replaceChildren(
        ...proposal.suggestions.map(
          (s, i) =>
            new Option(
              `${names[s.technique] ?? s.technique}${s.report.shorter ? ' · shorter' : ' · not shorter'}`,
              String(i),
            ),
        ),
      );
      const shortest = proposal.suggestions.reduce(
        (best, s, i, all) => (s.report.suggestedBytes < all[best].report.suggestedBytes ? i : best),
        0,
      );
      technique.value = String(shortest);
      await inspectSuggestion();
      if (result.kind === 'ready')
        performance.measure('ODM:simplify-report', { start, end: performance.now() });
    });
  technique.onchange = () => run(inspectSuggestion);
  place.onchange = scope;
  stem.onchange = () => clear();
  get<HTMLButtonElement>('[data-limits]').onclick = input.limits;
  get<HTMLButtonElement>('[data-discard]').onclick = () => dialog.close();
  dialog.addEventListener('close', () => clear());
  apply.onclick = () => {
    if (result.kind !== 'ready' || !captured) return;
    if (
      captured.doc !== app.state.doc ||
      captured.reference !== current() ||
      captured.settings !== JSON.stringify(settings) ||
      input.editing()
    ) {
      clear('The piece or settings changed. Ask for a fresh suggestion.');
      return;
    }
    const next = result.doc;
    dialog.close();
    clear();
    app.editor?.apply(next, {}, place.value);
  };
  function open() {
    clear();
    place.replaceChildren(
      ...sections.places.map(
        (p) =>
          new Option(`${p.name} · bars ${p.source?.fromBar}–${(p.source?.toBar ?? 1) - 1}`, p.id),
      ),
    );
    const selected = sections.selectedPlace();
    if (selected) place.value = selected.id;
    scope();
    dialog.showModal();
  }
  button.onclick = open;
  lensButton.onclick = open;
  return {
    refresh() {
      const disabled = !sections.linked || !sections.places.length || input.editing();
      button.disabled = disabled;
      lensButton.disabled = disabled;
      if (
        dialog.open &&
        captured &&
        (captured.doc !== app.state.doc ||
          captured.reference !== current() ||
          captured.settings !== JSON.stringify(settings))
      ) {
        clear('The piece or settings changed. Ask for a fresh suggestion.');
      }
    },
  };
}
