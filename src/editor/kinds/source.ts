import type { EditorKind, EditorContext } from '../kind';
import { describeTarget } from '../../document/edit';
import { prepareSource } from '../../document/edits/source-node';
import { sourceFragment } from '../../document/edits/source-shared';
import { fieldLabel } from '../presentation';
import './source.css';
const drafts = new Map<string, { baseline: string; text: string }>();
/** A loaded piece is the lifetime of these in-memory, unapplied source buffers. */
export function clearSourceDrafts() {
  drafts.clear();
}
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '') => {
  const n = document.createElement(tag);
  n.textContent = text;
  return n;
};
export default {
  id: 'source',
  priority: 30,
  matches: (t) => t.kind === 'source',
  mount(body, initial) {
    let context = initial,
      appliedText: string | undefined,
      disposed = false,
      busy = false;
    const form = el('form'),
      field = el('textarea'),
      apply = el('button', 'Apply'),
      revert = el('button', 'Revert'),
      error = el('p'),
      status = el('p');
    field.rows = 8;
    field.spellcheck = false;
    field.className = 'source-text';
    field.setAttribute('aria-label', 'Source text');
    const baseline = sourceFragment(initial.doc, initial.target.nodeId) ?? '';
    const draft = drafts.get(initial.target.nodeId);
    field.value = draft?.baseline === baseline ? draft.text : baseline;
    error.className = 'editor-error';
    error.setAttribute('role', 'alert');
    status.className = 'editor-helper';
    status.setAttribute('role', 'status');
    if (draft?.baseline === baseline)
      status.textContent = 'Unapplied text restored. Apply it to include it in your arrangement.';
    revert.type = 'button';
    revert.onclick = () => {
      field.value = sourceFragment(context.doc, context.target.nodeId) ?? '';
      error.textContent = '';
      field.removeAttribute('aria-invalid');
    };
    const actions = el('div');
    actions.className = 'editor-actions';
    actions.append(apply, revert);
    form.append(fieldLabel('Source text', field), actions, error, status);
    body.append(form);
    form.onsubmit = async (event) => {
      event.preventDefault();
      if (busy) return;
      const before = context.doc,
        id = context.target.nodeId,
        text = field.value;
      error.textContent = '';
      busy = true;
      apply.disabled = revert.disabled = true;
      status.textContent = 'Checking the notes…';
      const result = await prepareSource(before, id, text, context.ask);
      busy = false;
      apply.disabled = revert.disabled = false;
      if (disposed) return;
      if (context.doc !== before) {
        status.textContent =
          'The piece changed while checking. Your text is kept; apply again when ready.';
        return;
      }
      field.setAttribute('aria-invalid', String('ok' in result));
      if ('ok' in result) {
        error.textContent = result.reason;
        status.textContent = '';
        return;
      }
      const { doc: chosen, broken, promoted } = result;
      appliedText = text;
      context.apply(chosen);
      error.textContent = broken ? `Broken: ${broken}. Use Undo to restore the previous edit.` : '';
      const native = describeTarget(chosen, id.replace(/:source$/, ''));
      status.textContent =
        promoted && native.kind !== 'source'
          ? 'Applied. This is now editable in its own editor.'
          : 'Applied. Your source text is kept.';
    };
    return {
      update(next: EditorContext) {
        context = next;
        if (next.pending === 'failed') {
          appliedText = undefined;
          error.textContent =
            'This change failed. Your text is kept; use Revert to see the current piece.';
        }
      },
      destroy() {
        const baseline = sourceFragment(context.doc, context.target.nodeId) ?? '';
        if (field.value !== baseline && field.value !== appliedText)
          drafts.set(context.target.nodeId, { baseline, text: field.value });
        else drafts.delete(context.target.nodeId);
        disposed = true;
        form.remove();
      },
    };
  },
} satisfies EditorKind;
