import type { Hap } from './index';
/** Pinned Pattern.tag stores metadata in Hap.context.tags, outside sound values.
 * The canary checks identical voices and the arranged/localized row identities. */
export function instrumentIdentity(hap: Hap): string | undefined {
  const context = hap.context;
  if (!context || typeof context !== 'object' || !('tags' in context)) return;
  if (!Array.isArray(context.tags)) return;
  const tag: unknown = context.tags.findLast(
    (value: unknown) => typeof value === 'string' && value.startsWith('odm:instrument:'),
  );
  return typeof tag === 'string' ? tag.slice('odm:instrument:'.length) : undefined;
}
