import { sameContent } from './content';
import { shared, findById, walk, type Path } from './index';
import type { Doc, Pattern } from './types';
function score(doc: Doc, p: Pattern, seen = new Set<string>()): unknown {
  if (seen.has(p.id)) return p;
  seen = new Set(seen).add(p.id);
  const c = p.core;
  const target = c.kind === 'ref' ? shared(doc, c.name) : undefined;
  const origin = p.origin ? findById(doc, p.origin) : undefined;
  return {
    ...p,
    playbackMuted: !!p.muted || !!(origin && 'muted' in origin && origin.muted),
    core: target
      ? score(doc, target, seen)
      : c.kind === 'group'
        ? {
            ...c,
            parts: c.parts.map((part) => ({
              ...part,
              playbackMuted: !!part.muted,
              pattern: score(doc, part.pattern, seen),
            })),
          }
        : c,
  };
}
/** Every existing document editor crosses replaceAtPath; metadata alone is not a note edit. */
export function markEdited(before: Doc, after: Doc): Doc {
  const changed: Path[] = [];
  walk(after, (n, path) => {
    if (!('core' in n)) return;
    const p = n as Pattern;
    if (p.edited !== false) return;
    const old = findById(before, p.id);
    if (old && 'core' in old && !sameContent(score(before, old as Pattern), score(after, p)))
      changed.push([...path, 'edited']);
  });
  function set(value: unknown, path: Path): unknown {
    if (!path.length) return true;
    const [key, ...rest] = path;
    const old = value as Record<string | number, unknown>;
    const copy = Array.isArray(value) ? [...value] : { ...old };
    (copy as Record<string | number, unknown>)[key] = set(old[key], rest);
    return copy;
  }
  let result = after;
  for (const path of changed) result = set(result, path) as Doc;
  return result;
}
