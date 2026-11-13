/** Errors name contract fields, never echo input, provenance, or local paths. */
export function invalid(field: string): never {
  throw Error(`Invalid version 1 reference: ${field}.`);
}
export function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(field);
  return value as Record<string, unknown>;
}
export function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) return invalid(field);
  return value;
}
export function number(value: unknown, field: string, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    return invalid(field);
  return value;
}
export function integer(value: unknown, field: string, min = 0, max = Infinity): number {
  const result = number(value, field, min, max);
  return Number.isInteger(result) ? result : invalid(field);
}
export function string(value: unknown, field: string): string {
  return typeof value === 'string' && value.length > 0 ? value : invalid(field);
}
export function boolean(value: unknown, field: string): boolean {
  return typeof value === 'boolean' ? value : invalid(field);
}
export function nullableNumber(value: unknown, field: string): number | null {
  return value === null ? null : number(value, field, 0);
}
export function version(value: unknown): Record<string, unknown> {
  const doc = object(value, 'document');
  if (doc.version !== 1)
    throw Error(
      'Unsupported reference version. Expected version 1; export the song again with the version 1 tool.',
    );
  return doc;
}
export function relativePath(value: unknown): string {
  const path = string(value, 'relative file path');
  if (
    path.includes('\\') ||
    path.split('/').some((s) => !s || s === '.' || s === '..') ||
    /^[a-z]+:/i.test(path)
  )
    return invalid('relative file path');
  return path;
}
