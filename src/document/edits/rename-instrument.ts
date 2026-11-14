import { instruments, type Doc } from '../index';
import { findWithPath, replaceAtPath, type Refusal } from './shared';
import { shareInlineLeaves } from './section-shared';
export function renameInstrument(doc: Doc, id: string, input: string): Doc | Refusal {
  const rows = instruments(doc),
    row = rows.find((r) => r.id === id);
  if (!row) return { ok: false, reason: 'This instrument no longer exists' };
  const name = input.trim();
  if (!name) return { ok: false, reason: 'Give this instrument a name' };
  if (name.includes('$')) return { ok: false, reason: 'Choose a name without a dollar sign' };
  if (rows.some((r) => r.id !== id && r.name === name))
    return { ok: false, reason: 'Another instrument already has that name' };
  if (row.name === name && row.nameSource === 'author') return doc;
  // Promotion transfers the leaf id to the definition and allocates its use id.
  doc = shareInlineLeaves(doc, row.pattern.id);
  // A label wins over a shared binding's name without changing any references.
  let next = doc;
  const memberIds = new Set(row.patterns.map((p) => p.id));
  for (const p of row.patterns) {
    const found = findWithPath(next, p.id);
    if (found) next = replaceAtPath(next, found.path, { ...p, label: name });
  }
  next = {
    ...next,
    body: next.body.map((n) =>
      n.kind === 'shared' && memberIds.has(n.pattern.id)
        ? { ...n, nameSource: 'author', purpose: 'instrument' }
        : n,
    ),
  };
  return next;
}
