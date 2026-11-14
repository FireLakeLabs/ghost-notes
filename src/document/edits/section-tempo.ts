import type { Doc } from '../types';
import { sectionOwner, replaceParts, refuse } from './section-shared';
export function setSectionTempo(doc: Doc, id: string, tempo: number) {
  const owner = sectionOwner(doc, id);
  if (!owner?.part.source) return refuse('Select a linked reference place');
  if (!Number.isFinite(tempo) || tempo <= 0)
    return refuse('Use a positive tempo in cycles per minute');
  return replaceParts(
    doc,
    owner.root,
    owner.parts.map((p) => (p.id === id ? { ...p, tempo } : p)),
  );
}
