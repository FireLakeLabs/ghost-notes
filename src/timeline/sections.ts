import { copyArrangement } from '../copy';
import type { App } from '../app/controller';
import type { OpenReference } from '../app/reference';
import type { SessionSettings } from '../app/settings';
import { type Doc } from '../document';
import { referenceLinks } from '../document/links';
import { sectionRange } from '../document/section-range';
import { findSectionMatches } from '../document/section-matches';
import { makeSectionFromRange } from '../document/edits/section-from-range';
import { splitSectionPlace } from '../document/edits/section-split-place';
import type { mountTimeline } from './render';

/** Selection proposals stay local until the user accepts all takeover warnings. */
export function mountSections(
  root: HTMLElement,
  app: App,
  timeline: ReturnType<typeof mountTimeline>,
  current: () => OpenReference | null,
  settings: SessionSettings,
  prepare: (doc: Doc) => Doc = (doc) => doc,
) {
  const controls = document.createElement('div');
  controls.className = 'tl-sections';
  controls.innerHTML =
    '<button data-make disabled>Make section</button><div data-places aria-label="Arrangement places"></div><p data-link-status role="status"></p>';
  root.querySelector('.tl-summary')!.before(controls);
  const make = controls.querySelector<HTMLButtonElement>('[data-make]')!;
  const places = controls.querySelector<HTMLElement>('[data-places]')!;
  const status = controls.querySelector<HTMLElement>('[data-link-status]')!;
  const dialog = document.createElement('dialog');
  dialog.className = 'about-dialog section-dialog';
  dialog.setAttribute('aria-label', 'Make section');
  document.body.append(dialog);
  let linksValid = false;
  let unarranged = new Set<string>();
  let previous: Doc | null = null;
  let previousReference: OpenReference | null = null;
  const linked = () => {
    const r = current(),
      doc = app.state.doc;
    if (!r?.folder || !doc) return false;
    const links = referenceLinks(doc, r.folder, r.song);
    return (
      links.links.length > 0 &&
      links.links.every((l) => l.restored) &&
      links.stems.every((s) => s.restored) &&
      app.state.sections.every((p) => {
        if (!p.source) return true;
        try {
          const span = sectionRange(r.song, p.source);
          return (
            Math.abs(span.cycles - p.cycles) < 1e-9 && Math.abs(span.startCycle - p.start) < 1e-9
          );
        } catch {
          return false;
        }
      })
    );
  };
  function refresh() {
    make.disabled = !timeline.selection;
    const r = current(),
      doc = app.state.doc;
    if (doc === previous && r === previousReference) return;
    previous = doc;
    previousReference = r;
    places.replaceChildren();
    let valid = linked();
    try {
      unarranged = new Set(
        copyArrangement(
          {
            doc,
            song: r?.song,
            folder: r?.folder,
            options: { ...settings, unedited: 'as-made', unarranged: 'silence' },
          },
          true,
        ).unarrangedPlaceIds,
      );
    } catch {
      valid = false;
      unarranged = new Set();
    }
    linksValid = valid;
    status.textContent =
      !r || !doc
        ? ''
        : valid
          ? 'Select a place to open its bars and select its score.'
          : 'This draft has no resolved places on this reference grid. Paste a linked arrangement or make a section in an empty program.';
    for (const part of app.state.sections.filter((p) => p.source && !unarranged.has(p.id))) {
      const source = part.source;
      if (!source) continue;
      const button = document.createElement('button');
      button.dataset.place = part.id;
      button.textContent = `${part.name} · ${source.fromBar === 0 ? 'pickup' : `bars ${source.fromBar}–${source.toBar - 1}`}${part.edited ? ' · edited' : ''}`;
      button.disabled = !valid;
      button.onclick = () => {
        app.select(part.id);
        timeline.openLens({ firstBar: source.fromBar, lastBar: source.toBar - 1 });
      };
      places.append(button);
      const split = document.createElement('button');
      split.textContent = 'Split off';
      split.setAttribute('aria-label', `Split off bars ${source.fromBar}–${source.toBar - 1}`);
      split.disabled = !valid;
      split.onclick = () => {
        if (!app.state.doc) return;
        const next = splitSectionPlace(app.state.doc, part.id);
        if ('ok' in next) {
          status.textContent = next.reason;
          return;
        }
        app.editor?.apply(next, {}, part.id);
        app.select(part.id);
      };
      places.append(split);
    }
  }
  root.addEventListener('selectionchange', refresh);
  make.onclick = () => {
    const r = current(),
      selection = timeline.selection;
    if (!r?.folder || !selection) return;
    const folder = r.folder;
    const before = app.state.doc;
    const doc: Doc = before ?? { version: 2, body: [] };
    const range = { fromBar: selection.firstBar, toBar: selection.lastBar + 1 };
    dialog.innerHTML =
      '<h2>Make section</h2><label>Name <input data-name value="Section"></label><fieldset><legend>Use this section at these matching places</legend><div data-matches></div></fieldset><div data-warnings role="alert"></div><p data-error role="alert"></p><button data-accept>Make section</button><button data-cancel>Cancel</button>';
    const error = dialog.querySelector<HTMLElement>('[data-error]')!;
    const accept = dialog.querySelector<HTMLButtonElement>('[data-accept]')!;
    dialog.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick = () => dialog.close();
    try {
      const span = sectionRange(r.song, range);
      const beats =
        timeline.settings.selectionSnap === 'beats' &&
        selection.start.beat !== null &&
        selection.end.beat !== null
          ? { fromBeat: selection.start.beat, toBeat: selection.end.beat }
          : undefined;
      const stemIds = selection.scope.kind === 'instrument' ? [selection.scope.stemId] : undefined;
      const offers = beats
        ? []
        : findSectionMatches({
            song: r.song,
            range,
            stemIds,
            settings: {
              timingBeats:
                (settings.match.timingToleranceSeconds * (span.endBeat - span.startBeat)) /
                (span.endSeconds - span.startSeconds),
              quiet: settings.match.countQuietNotes ? 'count' : 'ignore',
              quietVelocity: settings.match.quietVelocity,
              pitch: settings.match.pitch === 'exact' ? 'exact' : 'class',
            },
          });
      const checks = offers.map((offer) => {
        const label = document.createElement('label');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = true;
        label.append(
          check,
          `Bars ${offer.fromBar}–${offer.toBar - 1} · ${Math.round(offer.score * 100)}% match`,
        );
        dialog.querySelector('[data-matches]')!.append(label);
        return check;
      });
      if (!offers.length)
        dialog.querySelector('[data-matches]')!.textContent = beats
          ? 'No reuse offers for a beat selection.'
          : 'No other matching places.';
      const propose = () =>
        makeSectionFromRange({
          doc,
          song: r.song,
          folder,
          range,
          name: dialog.querySelector<HTMLInputElement>('[data-name]')!.value,
          stemIds,
          beats,
          places: offers.filter((_, i) => checks[i].checked),
          grid: settings.grid,
          starting: settings.starting,
          simplify: settings.simplify,
          match: settings.match,
        });
      let proposal: ReturnType<typeof propose> | undefined;
      const review = () => {
        try {
          proposal = propose();
          error.textContent = '';
          const warnings = dialog.querySelector<HTMLElement>('[data-warnings]')!;
          warnings.replaceChildren();
          const takeovers = proposal.warnings.filter((w) => !unarranged.has(w.placeId));
          if (takeovers.length) {
            const label = document.createElement('label');
            const check = document.createElement('input');
            check.type = 'checkbox';
            check.dataset.takeover = '';
            label.append(
              check,
              takeovers.map((w) => w.message).join(' ') + ' Replace these whole places.',
            );
            check.onchange = () => (accept.disabled = !check.checked);
            warnings.append(label);
            accept.disabled = true;
          } else accept.disabled = false;
        } catch (e) {
          proposal = undefined;
          dialog.querySelector('[data-warnings]')!.replaceChildren();
          error.textContent = String(e instanceof Error ? e.message : e);
          accept.disabled = true;
        }
      };
      dialog.querySelector<HTMLInputElement>('[data-name]')!.oninput = review;
      checks.forEach((check) => (check.onchange = review));
      review();
      accept.onclick = () => {
        if (app.state.doc !== before || current() !== r) {
          error.textContent = 'The piece changed. Cancel and select the bars again.';
          return;
        }
        const next = proposal;
        if (!next) return;
        const finish = () => {
          app.select(next.selectedPlaceId);
          timeline.openLens({ firstBar: range.fromBar, lastBar: range.toBar - 1 });
          dialog.close();
        };
        if (app.editor) {
          try {
            app.editor.apply(prepare(next.doc), {}, next.sectionId);
            finish();
          } catch (e) {
            error.textContent = String(e instanceof Error ? e.message : e);
          }
        } else {
          void app
            .load('')
            .then(() => {
              app.editor?.apply(prepare(next.doc), {}, next.sectionId);
              finish();
            })
            .catch((e) => {
              error.textContent = String(e);
            });
        }
      };
    } catch (e) {
      error.textContent = String(e instanceof Error ? e.message : e);
      accept.disabled = true;
    }
    dialog.showModal();
  };
  app.subscribe(refresh);
  return {
    refresh,
    settingsChanged() {
      previous = null;
      previousReference = null;
      refresh();
    },
    get places() {
      return app.state.sections.filter((p) => p.source && !unarranged.has(p.id));
    },
    get linked() {
      return linksValid;
    },
    selectedPlace() {
      const p = app.state.sections.find((p) => p.id === app.state.selected);
      const lens = timeline.lens;
      return linksValid &&
        p?.source &&
        lens &&
        p.source.fromBar === lens.firstBar &&
        p.source.toBar === lens.lastBar + 1
        ? p
        : null;
    },
  };
}
