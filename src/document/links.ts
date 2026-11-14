import type { Doc, SectionSource } from './types';
import type { ReferenceSong } from '../reference/types';
import { walk } from './index';

/** Metadata is user editable: reject malformed links without rejecting the music. */
export function sectionSource(value: unknown): SectionSource | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    !('folder' in value) ||
    !('fromBar' in value) ||
    !('toBar' in value)
  )
    return;
  const { folder, fromBar, toBar } = value;
  if (
    typeof folder !== 'string' ||
    !folder.trim() ||
    /[/\\]/.test(folder) ||
    folder.includes(String.fromCharCode(0)) ||
    folder === '.' ||
    folder === '..' ||
    typeof fromBar !== 'number' ||
    !Number.isInteger(fromBar) ||
    fromBar < 0 ||
    typeof toBar !== 'number' ||
    !Number.isInteger(toBar) ||
    toBar <= fromBar
  )
    return;
  return { folder, fromBar, toBar };
}

/** Reopening is an explicit local folder match; no title, path or note is persisted. */
export function referenceLinks(doc: Doc, folder: string, song: ReferenceSong) {
  const links: { id: string; source: SectionSource; restored: boolean }[] = [];
  const stems: { id: string; stem: string; restored: boolean }[] = [];
  walk(doc, (node) => {
    if ('source' in node && node.source) {
      const source = node.source;
      const bars = song.bars.filter(
        (b) =>
          b.number >= source.fromBar && b.number < source.toBar && b.endSeconds > b.startSeconds,
      );
      links.push({
        id: node.id,
        source,
        restored: source.folder === folder && bars.length === source.toBar - source.fromBar,
      });
    }
    if ('stem' in node && typeof node.stem === 'string')
      stems.push({
        id: node.id,
        stem: node.stem,
        restored: song.stems.some((s) => s.id === node.stem),
      });
  });
  return { links, stems };
}
