import { readFileSync, readdirSync } from 'node:fs';
export const docBudgets = {
  'AGENTS.md': 400,
  'docs/model.md': 1000,
  'docs/decisions.md': 1500,
  'docs/standards.md': 800,
};
// Each topic file of decisions (G35) has the same budget as the index.
export const topicBudget = 1500;
export function budgets(list = () => readdirSync('docs/decisions')) {
  const topics = list()
    .filter((name) => name.endsWith('.md'))
    .map((name) => [`docs/decisions/${name}`, topicBudget]);
  return { ...docBudgets, ...Object.fromEntries(topics) };
}
export function inspectDocs(read = (path) => readFileSync(path, 'utf8'), all = budgets()) {
  return Object.entries(all).map(([path, limit]) => {
    try {
      const words = read(path).match(/\S+/g)?.length ?? 0;
      return { path, words, limit, ok: words <= limit };
    } catch {
      return { path, words: 'missing', limit, ok: false };
    }
  });
}
if (import.meta.main) {
  const rows = inspectDocs();
  console.table(rows);
  if (rows.some((row) => !row.ok)) process.exitCode = 1;
}
