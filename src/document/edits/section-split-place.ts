import { shared, walk, type Doc, type Pattern } from '../index';
import { freshIds } from './shared';
import { sectionOwner, replaceParts, refuse } from './section-shared';

/** An independent section and independent instrument definitions, with the same stem links. */
export function splitSectionPlace(doc: Doc, id: string) {
  const owner = sectionOwner(doc, id);
  if (!owner?.part.source) return refuse('Select a linked reference place');
  const fresh = freshIds(doc),
    definitions: Doc['body'] = [],
    names = new Map<string, string>();
  function copy(pattern: Pattern): Pattern {
    const p = structuredClone(pattern);
    walk(
      {
        version: 2,
        body: [
          {
            id: 'scan',
            tier: 1,
            kind: 'shared',
            name: 'scan',
            nameSource: 'generated',
            pattern: p,
          },
        ],
      },
      (node) => {
        node.id = fresh('copy');
        if (!('core' in node)) return;
        const n = node as Pattern;
        delete n.origin;
        if (n.core.kind !== 'ref') return;
        const oldName = n.core.name;
        if (!names.has(oldName)) {
          const target = shared(doc, oldName);
          if (!target) throw Error('Missing section dependency');
          let name = `gnCopy${fresh('name')}`;
          while (doc.body.some((d) => d.kind === 'shared' && d.name === name))
            name = `gnCopy${fresh('name')}`;
          names.set(oldName, name);
          const original = doc.body.findLast((d) => d.kind === 'shared' && d.name === oldName);
          if (original?.kind !== 'shared') throw Error('Missing section definition');
          const copied = copy(target);
          definitions.push({ ...original, id: fresh('definition'), name, pattern: copied });
        }
        const name = names.get(oldName);
        if (!name) throw Error('Missing copied dependency');
        n.core.name = name;
      },
    );
    return p;
  }
  const pattern = copy(owner.part.pattern);
  let next = replaceParts(
    doc,
    owner.root,
    owner.parts.map((p) => (p.id === id ? { ...p, pattern } : p)),
  );
  const index = next.body.findIndex((n) => n.kind === 'voice');
  next = {
    ...next,
    body: [...next.body.slice(0, index), ...definitions, ...next.body.slice(index)],
  };
  return next;
}
