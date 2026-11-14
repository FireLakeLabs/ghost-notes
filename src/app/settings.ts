import { conversionGrids, defaultConversionGrid } from '../convert';
import { defaultMatch, defaultSettings } from '../simplify';

/** One in-memory settings object. Nothing is written to storage or copied metadata. */
export function sessionSettings() {
  return {
    grid: defaultConversionGrid,
    selection: 'band' as 'band' | 'instrument',
    snap: 'bars' as 'bars' | 'beats',
    starting: 'literal' as 'literal' | 'simplified' | 'silence',
    match: { ...defaultMatch },
    simplify: { ...defaultSettings },
  };
}
export type SessionSettings = ReturnType<typeof sessionSettings>;
export function mountSettings(
  button: HTMLButtonElement,
  settings: SessionSettings,
  changed: () => void,
) {
  const dialog = document.createElement('dialog');
  dialog.className = 'about-dialog settings-dialog';
  dialog.setAttribute('aria-label', 'Settings');
  dialog.innerHTML = `<h2>Settings</h2><p>For this session only. Reloading resets these choices.</p><div data-controls></div><div data-timeline-settings></div><form method="dialog"><button>Done</button></form>`;
  const controls = dialog.querySelector<HTMLElement>('[data-controls]')!;
  function select(
    label: string,
    values: readonly (string | number)[],
    current: string | number,
    update: (value: string) => void,
  ) {
    const row = document.createElement('label');
    row.textContent = label;
    const input = document.createElement('select');
    for (const value of values) input.add(new Option(String(value), String(value)));
    input.value = String(current);
    input.onchange = () => {
      update(input.value);
      changed();
    };
    row.append(input);
    controls.append(row);
  }
  select('Notes grid (steps per beat)', conversionGrids, settings.grid, (v) => {
    const grid = conversionGrids.find((g) => String(g) === v);
    if (grid !== undefined) settings.grid = grid;
  });
  select('Selection', ['band', 'instrument'], settings.selection, (v) => {
    if (v === 'band' || v === 'instrument') settings.selection = v;
  });
  select('Snap', ['bars', 'beats'], settings.snap, (v) => {
    if (v === 'bars' || v === 'beats') settings.snap = v;
  });
  select('Starting content', ['literal', 'simplified', 'silence'], settings.starting, (v) => {
    if (v === 'literal' || v === 'simplified' || v === 'silence') settings.starting = v;
  });
  select('Pitch match', ['exact', 'any-octave'], settings.match.pitch, (v) => {
    if (v === 'exact' || v === 'any-octave') settings.match.pitch = v;
  });
  function number(label: string, value: number, max: number, update: (v: number) => void) {
    const row = document.createElement('label');
    row.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = String(max);
    input.step = 'any';
    input.value = String(value);
    input.onchange = () => {
      if (input.value !== '' && input.checkValidity()) {
        update(input.valueAsNumber);
        changed();
      }
    };
    row.append(input);
    controls.append(row);
  }
  number(
    'Match tolerance (seconds)',
    settings.match.timingToleranceSeconds,
    10,
    (v) => (settings.match.timingToleranceSeconds = v),
  );
  number(
    'Quiet note velocity threshold',
    settings.match.quietVelocity,
    127,
    (v) => (settings.match.quietVelocity = v),
  );
  const labels = {
    maxMoveSeconds: 'Maximum move (seconds)',
    maxDropShare: 'Maximum dropped share',
    maxAddShare: 'Maximum added share',
    barDistance: 'Drum bar distance',
    strayMaxSeconds: 'Stray maximum (seconds)',
    splitGapSeconds: 'Split gap (seconds)',
    octaveMaxSeconds: 'Octave excursion (seconds)',
    cleaningVelocity: 'Cleaning velocity threshold',
  };
  for (const key of Object.keys(labels) as (keyof typeof labels)[])
    number(
      labels[key],
      settings.simplify[key],
      key === 'cleaningVelocity' ? 127 : key.endsWith('Share') || key === 'barDistance' ? 1 : 10,
      (v) => (settings.simplify[key] = v),
    );
  function checkbox(label: string, value: boolean, update: (v: boolean) => void) {
    const row = document.createElement('label');
    row.textContent = label;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = value;
    input.onchange = () => {
      update(input.checked);
      changed();
    };
    row.append(input);
    controls.append(row);
  }
  checkbox(
    'Count quiet notes',
    settings.match.countQuietNotes,
    (v) => (settings.match.countQuietNotes = v),
  );
  checkbox(
    'Protect fills',
    settings.simplify.preserveFills,
    (v) => (settings.simplify.preserveFills = v),
  );
  document.body.append(dialog);
  button.onclick = () => dialog.showModal();
  return dialog;
}
