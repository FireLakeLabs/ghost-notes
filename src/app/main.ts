import { mountCopy } from '../copy/panel';
import { mountSettings, sessionSettings } from './settings';
import { pendingWords } from '../editor/pending';
import { describeTarget } from '../document/edit';
import { definitionMuted, setMuted } from '../document/edits/set-muted';
import { createPanel } from '../editor/panel';
import { createApp } from './controller';
import { examples } from './examples';
import { sheetModel, mountSheet, setPlayhead, setCurrentSection } from '../sheet';
import { aboutControls, mountAbout } from './about';
import './style.css';
import { mountReference } from './reference';
import { mountSections } from '../timeline/sections';
import { mountTimeline } from '../timeline/render';

const app = createApp();
document.body.innerHTML = `
  <header class="topbar"><div class="brand"><h1><img src="/icons/ghost-notes.svg" alt="" width="32" height="32">Ghost Notes</h1><small>From the recording to your arrangement</small></div><div class="transport">
    <button id="play" disabled>Play</button><button id="stop" disabled>Stop</button>
    <output id="tempo" aria-label="Tempo">Tempo —</output>
    <button id="undo" disabled>Undo</button><button id="redo" disabled>Redo</button>
    <button id="paste" aria-expanded="true" aria-controls="paste-panel">Paste Strudel</button>
    <button id="copy">Copy</button><button id="settings">Settings</button>
  ${aboutControls}</div><p id="solo-banner" hidden><span></span> <button id="stop-solo">Stop solo</button></p><p id="message" role="status"></p><div id="sound-notice" hidden><span role="status">Default sounds could not load. Check your connection, then press Play again.</span><button id="dismiss-sound-notice" aria-label="Dismiss sound notice">Dismiss</button></div></header>
  <main>
    <section id="reference-panel" aria-label="Open reference folder"></section>
    <section id="timeline" aria-label="Whole song timeline" hidden></section>
    <section id="paste-panel" aria-label="Paste Strudel">
      <label for="source">Your Strudel program</label>
      <textarea id="source" spellcheck="false" placeholder='s("bd*2, hh*4, ~ cp")' aria-describedby="load-error"></textarea>
      <div class="load-actions"><button id="load">Load</button><span>Try an original:</span><div id="examples"></div></div>
      <p id="load-error" role="alert"></p>
    </section>
    <details id="notes" hidden><summary>Notes</summary><ul></ul></details>
    <p id="draft-context" hidden></p><div class="score-toolbar"><h2>The score <small>· whole-program draft</small></h2><button id="follow" aria-pressed="true">Follow</button><output id="window"></output></div>
    <div id="score-workspace"><div id="score"><p class="welcome">Paste a Strudel program or choose an original to see its score. Press Play when you're ready.</p></div><aside id="editor" hidden></aside></div>
  </main><footer>Your music stays on this device. Copy your Strudel to keep it.</footer>`;
const timeline = mountTimeline(document.getElementById('timeline')!);
const referenceRoot = document.getElementById('reference-panel')!;
const reference = mountReference(referenceRoot);
timeline.observeLayout(referenceRoot);
timeline.observeLayout(document.querySelector('.topbar')!);
function draftContext() {
  const note = document.getElementById('draft-context')!;
  note.hidden = !reference.current;
  document.querySelector('.score-toolbar h2 small')!.textContent = sectionUI?.linked
    ? '· selected place'
    : '· whole-program draft';
  note.textContent = sectionUI?.linked
    ? 'Your arrangement is linked to reference bars. The score below shows the selected place.'
    : `${timeline.lens ? `Reference lens: bars ${timeline.lens.firstBar}–${timeline.lens.lastBar}. ` : ''}Your Strudel program and score below are one whole-program draft. They are not yet linked to reference bars; section links will bring the draft into the lens.`;
}
document.getElementById('timeline')!.addEventListener('lenschange', draftContext);
const aboutDialog = mountAbout();
const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T;
const source = get<HTMLTextAreaElement>('source'),
  score = get('score');
const paste = get<HTMLButtonElement>('paste'),
  panel = get('paste-panel');
const play = get<HTMLButtonElement>('play'),
  stop = get<HTMLButtonElement>('stop');
const follow = get<HTMLButtonElement>('follow');
const settings = sessionSettings();
const sectionUI = mountSections(
  document.getElementById('timeline')!,
  app,
  timeline,
  () => reference.current,
  settings,
);
referenceRoot.addEventListener('referencechange', () => {
  timeline.setReference(reference.current);
  sectionUI.refresh();
  updateTimelineScore();
  draftContext();
});
document.getElementById('timeline')!.addEventListener('placeopen', (event) => {
  const id: unknown = (event as CustomEvent).detail;
  const place = sectionUI.places.find((p) => p.id === id);
  if (!place?.source || !sectionUI.linked) return;
  app.select(place.id);
  timeline.openLens({ firstBar: place.source.fromBar, lastBar: place.source.toBar - 1 });
});
const copyPanel = mountCopy(get<HTMLButtonElement>('copy'), () => ({
  doc: app.state.doc,
  song: reference.current?.song,
  folder: reference.current?.folder,
  options: {
    unedited: 'as-made',
    unarranged: 'silence',
    grid: settings.grid,
    simplify: settings.simplify,
    match: settings.match,
  },
}));
const settingsDialog = mountSettings(get<HTMLButtonElement>('settings'), settings, () => {
  copyPanel.refresh();
  sectionUI.settingsChanged();
  updateTimelineScore();
  draftContext();
});
settingsDialog.querySelector('[data-timeline-settings]')!.append(timeline.settingsHost);
referenceRoot.addEventListener('referencechange', () => copyPanel.refresh());
paste.onclick = () => {
  panel.hidden = !panel.hidden;
  paste.setAttribute('aria-expanded', String(!panel.hidden));
  if (!panel.hidden) source.focus();
};
get('load').onclick = () => {
  void app.load(source.value);
};
for (const example of examples) {
  const button = document.createElement('button');
  button.textContent = example.name;
  button.onclick = () => {
    source.value = example.source;
    void app.load(example.source);
  };
  get('examples').append(button);
}
get('dismiss-sound-notice').onclick = () => app.dismissSoundNotice();
play.onclick = () => {
  void app.play();
};
stop.onclick = () => app.stop();
get('stop-solo').onclick = () => app.solo(null);
follow.onclick = () => app.follow(!app.state.follow);
let editNotice: { doc: unknown; text: string } | undefined;
let targetId: string | null = null,
  selectedSession: typeof app.editor;
let origin: { id: string; control?: string; row?: string } | null = null;
function originCell() {
  return Array.from(score.querySelectorAll<HTMLElement>('[data-editor-target]')).find(
    (n) =>
      n.dataset.editorTarget === origin?.id &&
      n.dataset.control === origin?.control &&
      n.closest<HTMLElement>('tr')?.dataset.nodeId === origin?.row,
  );
}
function closeEditor() {
  targetId = null;
  renderEditor();
  originCell()?.focus();
}
const renderPanel = createPanel(get('editor'), closeEditor);
function renderEditor() {
  const { doc, playing, fromCycle, toCycle } = app.state;
  const target = doc && targetId ? describeTarget(doc, targetId) : null;
  get('score-workspace').classList.toggle('editing', !!target);
  const entry = targetId ? app.editor?.state.entries[targetId] : undefined;
  const events = target?.instrumentId ? app.state.events[target.instrumentId] : undefined;
  renderPanel(
    target && doc
      ? {
          doc,
          target,
          instrument: {
            sounds: app.state.sounds,
            solo: app.state.solo,
            setSolo: (id) => app.solo(id),
          },
          events: events
            ? {
                ...events,
                events: events.events.filter((e) => e.part[0] < toCycle && e.part[1] > fromCycle),
              }
            : undefined,
          window: { fromCycle: app.state.fromCycle, toCycle: app.state.toCycle },
          pending: entry?.status ?? 'none',
          apply: (next, options) => {
            const oldRows = app.state.rows;
            const oldIndex = oldRows.findIndex((r) => r.id === targetId);
            if (options?.selection !== undefined) targetId = options.selection ?? null;
            if (options?.announcement) editNotice = { doc: next, text: options.announcement };
            app.editor?.apply(next, options, targetId ?? undefined);
            if (options?.selection !== undefined) renderEditor();
            if (options?.selection === null) {
              const neighbour =
                app.state.rows[Math.min(Math.max(oldIndex, 0), app.state.rows.length - 1)];
              Array.from(score.querySelectorAll<HTMLElement>('th[data-editor-target]'))
                .find((n) => n.dataset.editorTarget === neighbour?.id)
                ?.focus({ preventScroll: true });
            }
          },
          ask: (candidate, id) => app.editor!.ask(candidate, id, fromCycle, toCycle),
        }
      : null,
    entry,
    playing,
  );
  for (const n of Array.from(score.querySelectorAll<HTMLElement>('[data-editor-target]'))) {
    const selected = !!targetId && n === originCell(),
      entry = app.editor?.state.entries[n.dataset.editorTarget!];
    n.dataset.editorSelected = String(selected);
    n.setAttribute('aria-expanded', String(selected));
    n.dataset.editState = entry?.status ?? '';
    let status = n.querySelector('.edit-status');
    if (entry && !status) {
      status = document.createElement('small');
      status.className = 'edit-status';
      n.append(status);
    }
    if (status)
      status.textContent =
        entry?.status === 'pending'
          ? pendingWords(entry)
          : entry?.status === 'failed'
            ? 'Change failed; previous value restored'
            : '';
  }
  get<HTMLButtonElement>('undo').disabled = !app.editor?.canUndo;
  get<HTMLButtonElement>('redo').disabled = !app.editor?.canRedo;
  fitEditor();
  // Keep the selected editor as the only editing surface.
  get<HTMLTextAreaElement>('source').disabled = !!targetId;
  get<HTMLButtonElement>('load').disabled = !!targetId;
  for (const b of Array.from(get('examples').querySelectorAll('button'))) b.disabled = !!targetId;
  for (const b of Array.from(score.querySelectorAll<HTMLButtonElement>('.sheet-mute')))
    b.disabled = !!targetId;
}
function openEditor(id: string, cell: HTMLElement) {
  origin = {
    id,
    control: cell.dataset.control,
    row: cell.closest<HTMLElement>('tr')?.dataset.nodeId,
  };
  targetId = id;
  renderEditor();
  originCell()?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (matchMedia('(max-width: 760px)').matches)
    score
      .querySelector<HTMLElement>('[data-section][aria-pressed="true"]')
      ?.scrollIntoView({ block: 'start', inline: 'nearest' });
  else if (get('editor').dataset.layout === 'wide') revealEditedRow();
  else {
    const editor = get('editor');
    if (editor.getBoundingClientRect().top < 16)
      window.scrollBy(0, editor.getBoundingClientRect().top - 16);
  }
  get('editor').querySelector<HTMLElement>('input,button')?.focus({ preventScroll: true });
}
get('undo').onclick = () => app.editor?.undo();
get('redo').onclick = () => app.editor?.redo();
document.addEventListener('keydown', (event) => {
  if (aboutDialog.open || (event.target instanceof Element && event.target.closest('dialog[open]')))
    return;
  if (event.key === 'Escape' && targetId) {
    event.preventDefault();
    closeEditor();
  }
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === 'z' &&
    event.target !== source
  ) {
    event.preventDefault();
    if (event.shiftKey) app.editor?.redo();
    else app.editor?.undo();
  }
});
function updateTimelineScore() {
  timeline.setScore({
    doc: app.state.doc,
    instruments: app.state.rows,
    events: app.settledEvents,
    places: sectionUI.places,
    linked: sectionUI.linked,
    grid: settings.grid,
  });
}
let previousNotes: unknown;
let previousSheet: unknown[] = [];
app.subscribe((state) => {
  copyPanel.refresh();
  updateTimelineScore();
  draftContext();
  if (app.editor !== selectedSession) {
    targetId = null;
    selectedSession = app.editor;
  }
  play.disabled = !app.canPlay || state.playing;
  stop.disabled = !state.playing && !state.message.includes('Preparing');
  get('tempo').textContent =
    state.cps === null ? 'Tempo —' : `${Number((state.cps * 60).toFixed(2))} cycles/min`;
  get('message').textContent =
    state.message || (editNotice?.doc === state.doc ? editNotice.text : '');
  get('message').dataset.kind = app.warning ? 'warning' : 'error';
  get('sound-notice').hidden = !state.soundNotice.visible;
  get('solo-banner').hidden = !state.solo;
  get('solo-banner').querySelector('span')!.textContent =
    `Solo: ${state.rows.find((r) => r.id === state.solo)?.name.replaceAll('$', '') ?? ''} —`;
  get('load-error').textContent = state.loadError;
  follow.setAttribute('aria-pressed', String(state.follow));
  get('window').textContent = state.doc ? `Cycles ${state.fromCycle}–${state.toCycle}` : '';
  if (previousNotes !== state.warnings) {
    previousNotes = state.warnings;
    const notes = get<HTMLDetailsElement>('notes');
    notes.hidden = !state.warnings.length;
    notes.querySelector('summary')!.textContent = `Notes (${state.warnings.length})`;
    notes.querySelector('ul')!.replaceChildren(
      ...state.warnings.map((w) => {
        const li = document.createElement('li');
        li.textContent = w.message;
        return li;
      }),
    );
  }
  const inputs = [
    state.doc,
    state.events,
    state.sounds,
    state.fromCycle,
    state.toCycle,
    state.selected,
    state.playing,
  ];
  if (state.doc && inputs.some((value, i) => value !== previousSheet[i])) {
    previousSheet = inputs;
    mountSheet(
      score,
      sheetModel({ ...state, doc: state.doc, playhead: app.engine?.now() ?? null }),
      {
        selected: state.selected,
        definitionMuted: (id) => definitionMuted(state.doc!, id),
        onMute: (id, muted) => {
          if (targetId || state.doc !== app.state.doc) return;
          const next = setMuted(state.doc!, id, muted);
          if (!('ok' in next)) app.editor?.apply(next, {}, id);
        },
        onSelect: (id) => app.select(id),
        onEdit: (id, _summary, cell) => openEditor(id, cell),
      },
    );
  }
  renderEditor();
});
function revealEditedRow() {
  const row = originCell()?.closest('tr');
  if (!row) return;
  const drawerTop = get('editor').getBoundingClientRect().top;
  const rect = row.getBoundingClientRect();
  if (rect.bottom > drawerTop - 12) window.scrollBy(0, rect.bottom - drawerTop + 12);
  else if (rect.top < 12) window.scrollBy(0, rect.top - 12);
}
function fitEditor() {
  const editor = get('editor');
  const height =
    editor.hidden || editor.dataset.layout === 'wide' || matchMedia('(max-width: 760px)').matches
      ? ''
      : `${Math.max(160, innerHeight - Math.max(16, editor.getBoundingClientRect().top) - 16)}px`;
  if (editor.style.maxHeight !== height) editor.style.maxHeight = height;
}
window.addEventListener('scroll', fitEditor, { passive: true });
window.addEventListener('resize', () => {
  fitEditor();
  if (!get('editor').hidden && get('editor').dataset.layout === 'wide' && innerWidth >= 900)
    revealEditedRow();
});
function frame() {
  const now = app.frame(),
    { fromCycle, toCycle, sections } = app.state;
  setPlayhead(score, now === null ? null : ((now - fromCycle) / (toCycle - fromCycle)) * 100);
  const last = sections.at(-1);
  setCurrentSection(score, now, last ? last.start + last.cycles : 0);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Opt-in diagnostics. Bounded event history; no engine is created by inspection.
if (new URLSearchParams(location.search).has('inspect'))
  Object.defineProperties(window, {
    odmApp: { value: app },
    ghostReference: { value: reference },
    ghostTimeline: { value: timeline },
  });
declare global {
  interface Window {
    ghostTimeline: ReturnType<typeof mountTimeline>;
    ghostReference: ReturnType<typeof mountReference>;
    odmApp: typeof app;
  }
}
