import { instruments, walk, type Doc, type Pattern, type Path } from '../index';
import { findWithPath, replaceAtPath, type Refusal } from './shared';
/** Only canonical instrument ids may address a mute, never a setting or driver. */
export function setMuted(doc: Doc, id: string, muted: boolean): Doc | Refusal {
  const row = instruments(doc).find((r) => r.id === id);
  if (!row) return { ok: false, reason: 'This instrument no longer exists' };
  if (row.pattern.stem) {
    const members = new Set(row.patterns.map((p) => p.id));
    const targets: { path: Path; pattern: Pattern }[] = [];
    walk(doc, (node, path) => {
      if ('core' in node && members.has(node.id)) targets.push({ path, pattern: node as Pattern });
    });
    let next = doc;
    for (const target of targets)
      if (!!target.pattern.muted !== muted)
        next = replaceAtPath(next, target.path, { ...target.pattern, muted });
    return next;
  }
  const target = findWithPath(doc, id)!;
  const node = id === row.pattern.id ? row.pattern : target.node;
  const nested = 'pattern' in node ? row.pattern.muted : false;
  if (('muted' in node ? !!node.muted : false) === muted && !nested) return doc;
  return replaceAtPath(doc, target.path, {
    ...node,
    muted,
    ...('pattern' in node && nested ? { pattern: { ...row.pattern, muted: false } } : {}),
  });
}

/** A definition mute is separate from all of its section uses being muted. */
export function definitionMuted(doc: Doc, id: string): boolean {
  const row = instruments(doc).find((r) => r.id === id);
  const voice = doc.body.find((n) => n.id === id && n.kind === 'voice');
  return !!row?.patterns.every((p) => p.muted) || (voice?.kind === 'voice' && voice.muted);
}
