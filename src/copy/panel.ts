import { copyArrangement, type CopyInput } from './index';

export function mountCopy(button: HTMLButtonElement, input: () => CopyInput) {
  const dialog = document.createElement('dialog');
  dialog.className = 'about-dialog copy-dialog';
  dialog.setAttribute('aria-label', 'Copy arrangement');
  dialog.innerHTML = `<h2>Copy arrangement</h2>
    <label>Unedited sections <select data-unedited><option value="as-made">As made</option><option value="literal">Literal</option><option value="simplified">Simplified</option></select></label>
    <label>Unarranged bars <select data-unarranged><option value="silence">Silence</option><option value="literal">Literal</option><option value="simplified">Simplified</option></select></label>
    <p data-copy-summary role="status"></p><p data-warning></p>
    <label>Strudel text <textarea data-text readonly spellcheck="false"></textarea></label>
    <p data-result role="status"></p><button data-copy>Copy text</button> <form method="dialog"><button>Close</button></form>`;
  const unedited = dialog.querySelector<HTMLSelectElement>('[data-unedited]')!;
  const unarranged = dialog.querySelector<HTMLSelectElement>('[data-unarranged]')!;
  const text = dialog.querySelector<HTMLTextAreaElement>('[data-text]')!;
  const summary = dialog.querySelector<HTMLElement>('[data-copy-summary]')!;
  const warning = dialog.querySelector<HTMLElement>('[data-warning]')!;
  const result = dialog.querySelector<HTMLElement>('[data-result]')!;
  const copy = dialog.querySelector<HTMLButtonElement>('[data-copy]')!;
  let lastCopy: string | null = null,
    currentKey = '',
    dirty = false;
  const read = (): CopyInput => {
    const value = input();
    return {
      ...value,
      options: {
        ...value.options,
        unedited:
          unedited.value === 'literal' || unedited.value === 'simplified'
            ? unedited.value
            : 'as-made',
        unarranged:
          unarranged.value === 'literal' || unarranged.value === 'simplified'
            ? unarranged.value
            : 'silence',
      },
    };
  };
  let previousDoc: CopyInput['doc'] | undefined, previousSong: CopyInput['song'];
  let previousOptions = '',
    renderedKey = '';
  function refresh() {
    const value = read();
    // Reference notes and settings remain in memory; this fingerprint is never persisted.
    const optionsKey = JSON.stringify(value.options);
    const changed =
      value.doc !== previousDoc || value.song !== previousSong || optionsKey !== previousOptions;
    if (changed) {
      currentKey = JSON.stringify(value);
      previousDoc = value.doc;
      previousSong = value.song;
      previousOptions = optionsKey;
      manual.hidden = true;
    }
    dirty = !!(value.doc || value.song) && currentKey !== lastCopy;
    button.dataset.changed = String(dirty);
    button.textContent = dirty ? 'Copy •' : 'Copy';
    button.setAttribute(
      'aria-label',
      dirty ? 'Copy arrangement (uncopied changes)' : 'Copy arrangement',
    );
    if (!dialog.open || renderedKey === currentKey) return;
    renderedKey = currentKey;
    result.textContent = '';
    try {
      const output = copyArrangement(value);
      text.value = output.text;
      summary.textContent = `${output.silentBars} unarranged bar${output.silentBars === 1 ? '' : 's'} will be silent.`;
      warning.textContent = output.warnings.join(' ');
      copy.disabled = false;
    } catch (error) {
      text.value = '';
      summary.textContent = error instanceof Error ? error.message : 'Cannot prepare the copy.';
      warning.textContent = '';
      copy.disabled = true;
    }
  }
  button.onclick = () => {
    dialog.showModal();
    refresh();
  };
  unedited.onchange = unarranged.onchange = refresh;
  copy.onclick = () => {
    const key = currentKey,
      content = text.value;
    copy.disabled = true;
    navigator.clipboard
      .writeText(content)
      .then(() => {
        lastCopy = key;
        copy.disabled = false;
        refresh();
        result.textContent = 'Copied. Paste into Strudel.';
      })
      .catch(() => {
        result.textContent =
          'Clipboard access failed. Select the text and copy it, then use Mark copied.';
        text.focus();
        text.select();
        manual.hidden = false;
        copy.disabled = false;
      });
  };
  const manual = document.createElement('button');
  manual.textContent = 'Mark copied';
  manual.hidden = true;
  manual.onclick = () => {
    lastCopy = currentKey;
    refresh();
    manual.hidden = true;
    result.textContent = 'Marked copied.';
  };
  dialog.append(manual);
  document.body.append(dialog);
  window.addEventListener('beforeunload', (event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  return { refresh };
}
