import { walk, type Doc, type Pattern, type DocumentNode, type SettingsLayer } from '../index';
import { findWithPath, freshIds, replaceAtPath, type Refusal } from './shared';

/** A timeline sound choice applies to every definition belonging to this stem.
 * The common mutation boundary marks affected sections edited and keeps Undo.
 */
export function setStemSound(doc: Doc, stemId: string, value: string): Doc | Refusal {
  const isPattern = (node: DocumentNode): node is Pattern => 'core' in node && 'layers' in node;
  const ids: string[] = [];
  walk(doc, (node) => {
    if (isPattern(node) && node.stem === stemId) ids.push(node.id);
  });
  if (!ids.length) return doc;
  const fresh = freshIds(doc);
  let next = doc;
  for (const id of ids) {
    const found = findWithPath(next, id);
    if (!found || !isPattern(found.node))
      return { ok: false, reason: 'Instrument no longer exists' };
    const pattern = found.node;
    const name = stemId === 'drums' ? 'bank' : 's';
    const last = pattern.layers.at(-1);
    const previous =
      last?.kind === 'settings' ? last.settings.findLast((s) => s.name === name) : undefined;
    if (previous?.value.core.kind === 'constant' && previous.value.core.value === value) continue;
    if (previous && last?.kind === 'settings') {
      next = replaceAtPath(
        next,
        [...found.path, 'layers', pattern.layers.length - 1, 'settings'],
        last.settings.map((s) =>
          s === previous ? { ...s, value: { ...s.value, core: { kind: 'constant', value } } } : s,
        ),
      );
      continue;
    }
    const setting: SettingsLayer = {
      id: fresh('sound'),
      tier: 1,
      kind: 'settings',
      settings: [
        {
          id: fresh('sound'),
          tier: 1,
          name,
          value: { id: fresh('sound'), tier: 1, core: { kind: 'constant', value }, layers: [] },
        },
      ],
    };
    next = replaceAtPath(next, [...found.path, 'layers'], [...pattern.layers, setting]);
  }
  return next;
}
