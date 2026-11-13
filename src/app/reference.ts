import { browserAudio, type StemAudio } from '../reference/audio';
import {
  dropAccess,
  droppedFiles,
  droppedHandle,
  pickerAccess,
  songChoices,
  type LocalDirectory,
  type SongChoice,
} from '../reference/folders';
import { readReference } from '../reference/reader';
import type { GridMultiplier, ReferenceSong, SongFiles } from '../reference/types';
export type OpenReference = {
  song: ReferenceSong;
  audio: ReadonlyMap<string, StemAudio<AudioBuffer>>;
};
export function mountReference(root: HTMLElement) {
  root.innerHTML = `<h2>Reference</h2><button type="button" data-open>Open song folder</button> <button type="button" data-reopen>Reopen folder</button>
    <input type="file" webkitdirectory multiple hidden aria-label="Choose song folder">
    <p>Drop a song folder or source folder here. Files stay on this device.</p>
    <div data-choose hidden><label>Song <select aria-label="Song"></select></label> <button type="button" data-selected>Open selected song</button></div>
    <p role="status" data-summary>No reference opened.</p>
    <p data-tempo hidden>Choose a tempo grid: <button data-factor="0.5">½×</button> <button data-factor="1">1×</button> <button data-factor="2">2×</button></p>`;
  const open = root.querySelector<HTMLButtonElement>('[data-open]')!,
    reopen = root.querySelector<HTMLButtonElement>('[data-reopen]')!;
  const input = root.querySelector<HTMLInputElement>('input')!,
    select = root.querySelector<HTMLSelectElement>('select')!;
  const choose = root.querySelector<HTMLElement>('[data-choose]')!,
    selected = root.querySelector<HTMLButtonElement>('[data-selected]')!;
  const status = root.querySelector<HTMLElement>('[data-summary]')!;
  let current: OpenReference | null = null,
    busy = false,
    choices: SongChoice[] = [];
  const picker = (
    window as Window & {
      showDirectoryPicker?: (options: { mode: 'read' }) => Promise<LocalDirectory>;
    }
  ).showDirectoryPicker;
  const pickerFolders = picker ? pickerAccess(() => picker.call(window, { mode: 'read' })) : null;
  const access =
    pickerFolders ??
    dropAccess(
      () =>
        new Promise((resolve) => {
          input.onchange = () => resolve(Array.from(input.files ?? []));
          input.oncancel = () => resolve([]);
          input.value = '';
          input.click();
        }),
    );
  reopen.hidden = !picker;
  async function run(action: () => Promise<void>) {
    if (busy) return;
    busy = true;
    open.disabled = reopen.disabled = selected.disabled = true;
    root.setAttribute('aria-busy', 'true');
    try {
      await action();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        status.textContent =
          error instanceof Error && !(error instanceof DOMException)
            ? error.message
            : 'Cannot open this folder. Check read permission and export completeness.';
    } finally {
      busy = false;
      open.disabled = reopen.disabled = selected.disabled = false;
      root.removeAttribute('aria-busy');
    }
  }
  let currentFiles: SongFiles | null = null;
  const tempoChoice = root.querySelector<HTMLElement>('[data-tempo]')!;
  function summarize(song: ReferenceSong) {
    const tempos = song.bars.flatMap((b) => (b.bpm === null ? [] : [b.bpm]));
    const c = song.beatMap.coverage,
      review = song.beatMap.tempoReview;
    const range = tempos.length
      ? `${Math.min(...tempos).toFixed(2)}–${Math.max(...tempos).toFixed(2)} BPM`
      : 'tempo unavailable';
    status.textContent =
      `${song.name} — ${song.stems.length} ${song.stems.length === 1 ? 'stem' : 'stems'}; ${song.bars.filter((b) => b.number > 0).length} bars${song.pickupBeats ? ' + pickup' : ''}; ${range}. ` +
      `Coverage: ${c.status}; detected ${c.first_beat_seconds ?? 'none'}–${c.last_beat_seconds ?? 'none'} s; leading ${c.leading_seconds} s; trailing ${c.trailing_seconds} s; gaps: ${
        c.gaps.length
          ? c.gaps
              .slice(0, 3)
              .map(([a, b]) => `${a}–${b} s`)
              .join(', ') + (c.gaps.length > 3 ? `; ${c.gaps.length - 3} more gaps` : '')
          : 'none'
      }. ` +
      `Grid: ${song.grid.multiplier}×; ${song.grid.inferences.filter((i) => i.kind === 'split-long-bar').length} bar lines inferred, ${song.grid.inferences.filter((i) => i.kind === 'merge-short-bars').length} removed by merging. Detected bars retained. ` +
      `Tempo doubt: ${review.flagged ? review.reasons.join(', ').replaceAll('_', ' ') : 'no range flag (ambiguity still possible)'}. ` +
      `Stems: ${song.stems.map((s) => `${s.id} ${s.levelDb} dB (${s.transcription === 'skipped_quiet' ? 'skipped quiet; possible bleed' : 'complete'})`).join('; ')}. Audio decoded; waveform peaks ready.`;
  }
  async function load(files: SongFiles) {
    // Release the old timeline before reading or decoding a replacement.
    current = null;
    root.dispatchEvent(new Event('referencechange'));
    currentFiles = null;
    tempoChoice.hidden = true;
    status.textContent = 'Reading reference and decoding stem audio…';
    const song = await readReference(files),
      audio = await browserAudio(song, files);
    current = { song, audio };
    currentFiles = files;
    summarize(song);
    tempoChoice.hidden = !song.beatMap.tempoReview.flagged;
    root.dispatchEvent(new Event('referencechange'));
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-factor]')) {
    button.onclick = () => {
      const factor = Number(button.dataset.factor);
      if (factor !== 0.5 && factor !== 1 && factor !== 2) return;
      const multiplier: GridMultiplier = factor;
      void run(async () => {
        if (!current || !currentFiles) return;
        const song = await readReference(currentFiles, multiplier);
        current = { song, audio: current.audio };
        summarize(song);
        tempoChoice.hidden = true; // G27: one choice per opened song.
        root.dispatchEvent(new Event('referencechange'));
      });
    };
  }
  async function offer(files: SongFiles) {
    choices = await songChoices(files);
    choose.hidden = choices.length < 2;
    select.replaceChildren(
      ...choices.map((c, i) => {
        const option = document.createElement('option');
        option.value = String(i);
        option.textContent = c.label;
        return option;
      }),
    );
    if (choices.length === 1) await load(choices[0].files);
    else status.textContent = `${choices.length} songs found. Choose a song to open.`;
  }
  open.onclick = () => {
    void run(async () => {
      const files = await access.open();
      reopen.textContent = 'Reopen folder';
      await offer(files);
    });
  };
  reopen.onclick = () => {
    void run(async () => {
      const files = await access.reopen();
      if (files) await offer(files);
      else status.textContent = 'No retained folder handle. Open the song folder again.';
    });
  };
  selected.onclick = () => {
    void run(async () => {
      const choice = choices[select.selectedIndex];
      if (choice) await load(choice.files);
    });
  };
  root.ondragover = (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  };
  root.ondrop = (event) => {
    event.preventDefault();
    const transfer = event.dataTransfer;
    // Capture entries during dispatch: browsers protect the DataTransfer afterward.
    if (transfer && !busy) {
      const files = droppedFiles(transfer),
        handle = pickerFolders ? droppedHandle(transfer) : null;
      void run(async () => {
        const directory = await handle;
        if (directory && pickerFolders) {
          reopen.textContent = 'Reopen folder';
          await offer(await pickerFolders.use(directory));
        } else {
          if (pickerFolders) reopen.textContent = 'Reopen last picked folder';
          await offer(files);
        }
      });
    }
  };
  const preventFileNavigation = (event: DragEvent) => {
    if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
  };
  document.addEventListener('dragover', preventFileNavigation);
  document.addEventListener('drop', preventFileNavigation);
  return {
    get current() {
      return current;
    },
  };
}
