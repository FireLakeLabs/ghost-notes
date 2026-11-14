import type { Doc } from '../document';
import { setStemSound } from '../document/edits/stem-sound';
import {
  createRowEngine,
  referenceEvents,
  rowKinds,
  rowPresets,
  soundsFor,
  type RowChoice,
  type RowPlan,
} from '../engine/rows';
import type { mountTimeline } from '../timeline/render';
import type { App } from './controller';
import type { OpenReference } from './reference';

export type AuditionState = {
  choices: ReadonlyMap<string, RowChoice>;
  sounds: ReadonlyMap<string, string>;
  disabled: boolean;
};

export function mountRowPlayback({
  app,
  timeline,
  root,
  current,
  linked,
  editing,
}: {
  app: App;
  timeline: ReturnType<typeof mountTimeline>;
  root: HTMLElement;
  current(): OpenReference | null;
  linked(): boolean;
  editing(): boolean;
}) {
  const choices = new Map<string, RowChoice>();
  const sounds = new Map<string, string>();
  const controls = document.createElement('div');
  controls.className = 'row-presets';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'What Play plays');
  const notice = document.createElement('small');
  notice.setAttribute('role', 'status');
  let soundError = '';
  for (const [name, preset] of Object.entries(rowPresets)) {
    const button = document.createElement('button');
    button.textContent = name;
    button.onclick = () => {
      for (const stem of current()?.song.stems ?? []) choices.set(stem.id, { ...preset });
      app.stop();
      refresh();
    };
    controls.append(button);
  }
  controls.append(notice);
  document.getElementById('play')!.before(controls);
  function choice(id: string) {
    let value = choices.get(id);
    if (!value) {
      value = { ...rowPresets.Both };
      choices.set(id, value);
    }
    return value;
  }
  function plan(): RowPlan {
    const reference = current();
    if (!reference) throw Error('Open a reference folder before row playback');
    const issue = mineIssue();
    if (issue) throw Error(issue);
    const audioIds: string[] = [],
      mineIds: string[] = [];
    const voices: RowPlan['reference'][number][] = [];
    for (const stem of reference.song.stems) {
      const selected = choice(stem.id);
      if (selected.audio && reference.audio.has(stem.id)) audioIds.push(stem.id);
      if (selected.mine && app.state.doc) {
        if (!linked())
          throw Error('Mine is an unlinked draft. Make a section, or choose Recording.');
        mineIds.push(
          ...app.state.rows
            .filter(
              (r) =>
                (!app.state.solo || r.id === app.state.solo) &&
                r.patterns.some((p) => p.stem === stem.id),
            )
            .map((r) => r.id),
        );
      }
      for (const kind of ['midi', 'notes'] as const) {
        if (!selected[kind]) continue;
        const material = kind === 'notes' ? timeline.materialFor(stem.id)?.literal : undefined;
        if (kind === 'notes' && (!material || material.message))
          throw Error(material?.message || 'Notes are not ready');
        voices.push({
          id: `reference:${stem.id}:${kind}`,
          events: referenceEvents(
            reference,
            stem.id,
            material?.notes ?? stem.notes,
            sounds.get(stem.id) ?? (stem.id === 'drums' ? '' : 'triangle'),
          ),
        });
      }
    }
    return {
      mineIds,
      audioIds,
      reference: voices,
      mine: !!app.state.doc && reference.song.stems.some((s) => choice(s.id).mine),
    };
  }
  function mineIssue() {
    const reference = current();
    if (!reference || !app.state.doc || !reference.song.stems.some((s) => choice(s.id).mine))
      return '';
    if (!linked()) return 'Mine is an unlinked draft; make a section or choose Recording.';
    return app.state.rows.some(
      (r) => !r.patterns.some((p) => reference.song.stems.some((s) => s.id === p.stem)),
    )
      ? 'Mine includes instruments without matching reference stems. Add their stem links or choose Recording.'
      : '';
  }
  function ready() {
    const reference = current();
    if (!reference) return false;
    if (mineIssue()) return false;
    return reference.song.stems.some((s) => {
      const c = choice(s.id);
      return (c.audio && reference.audio.has(s.id)) || c.midi || c.notes || (c.mine && linked());
    });
  }
  function refresh() {
    const reference = current();
    controls.hidden = !reference;
    for (const button of controls.querySelectorAll('button')) {
      const preset = Object.entries(rowPresets).find(([name]) => name === button.textContent)?.[1];
      button.disabled = editing();
      button.setAttribute(
        'aria-pressed',
        String(
          !!preset &&
            !!reference &&
            reference.song.stems.every((s) => rowKinds.every((k) => choice(s.id)[k] === preset[k])),
        ),
      );
    }
    notice.textContent =
      soundError ||
      mineIssue() ||
      'Changing sources stops playback. Play uses the selected rows, including hidden rows.';
    timeline.setAudition({ choices, sounds, disabled: editing() });
  }
  root.addEventListener('speakerchange', (event) => {
    if (editing()) return;
    const detail: unknown = (event as CustomEvent).detail;
    if (!detail || typeof detail !== 'object' || !('stemId' in detail) || !('kind' in detail))
      return;
    if (
      typeof detail.stemId !== 'string' ||
      !current()?.song.stems.some((s) => s.id === detail.stemId)
    )
      return;
    const kind = rowKinds.find((k) => k === detail.kind);
    if (!kind) return;
    choice(detail.stemId)[kind] = !choice(detail.stemId)[kind];
    app.stop();
    refresh();
  });
  root.addEventListener('soundchange', (event) => {
    if (editing()) return;
    const detail: unknown = (event as CustomEvent).detail;
    if (
      !detail ||
      typeof detail !== 'object' ||
      !('stemId' in detail) ||
      !('sound' in detail) ||
      typeof detail.stemId !== 'string' ||
      typeof detail.sound !== 'string'
    )
      return;
    if (
      !current()?.song.stems.some((s) => s.id === detail.stemId) ||
      (detail.sound !== 'as-written' &&
        !soundsFor(detail.stemId).some((s) => s.value === detail.sound))
    )
      return;
    app.stop();
    soundError = '';
    const doc = app.state.doc;
    let next: Doc | undefined;
    if (doc && app.editor && detail.sound !== 'as-written') {
      const result = setStemSound(doc, detail.stemId, detail.sound);
      if ('ok' in result) {
        soundError = result.reason;
        refresh();
        return;
      }
      next = result;
    }
    if (detail.sound === 'as-written') sounds.delete(detail.stemId);
    else sounds.set(detail.stemId, detail.sound);
    if (next) app.editor?.apply(next);
    refresh();
  });
  return {
    refresh,
    referenceChanged() {
      const reference = current();
      app.configurePlayback(
        reference ? { ready, create: () => createRowEngine(reference, plan) } : null,
      );
      refresh();
    },
    applySounds(doc: Doc) {
      let next = doc;
      for (const [stem, sound] of sounds) {
        const changed = setStemSound(next, stem, sound);
        if ('ok' in changed) throw Error(changed.reason);
        next = changed;
      }
      return next;
    },
  };
}
