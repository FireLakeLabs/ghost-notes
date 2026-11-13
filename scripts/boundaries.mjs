import { readdirSync, readFileSync } from 'node:fs';
import { parseSync } from 'oxc-parser';

// Module specifiers a file names as string literals: static imports, `export ... from`,
// `import()` and `require()`. Only JavaScript and TypeScript files are parsed.
function specifiers(path, code) {
  if (!/\.(?:[cm]?[jt]sx?)$/.test(path)) return [];
  const { module, program } = parseSync(path, code);
  const names = [
    ...module.staticImports.map((entry) => entry.moduleRequest.value),
    ...module.staticExports.flatMap((entry) =>
      entry.entries.flatMap((item) => (item.moduleRequest ? [item.moduleRequest.value] : [])),
    ),
  ];
  const literal = (node) =>
    node?.type === 'Literal' && typeof node.value === 'string'
      ? node.value
      : node?.type === 'TemplateLiteral' && node.expressions.length === 0
        ? node.quasis[0].value.cooked
        : undefined;
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    const source =
      node.type === 'ImportExpression'
        ? node.source
        : node.type === 'CallExpression' &&
            node.callee?.type === 'Identifier' &&
            node.callee.name === 'require'
          ? node.arguments[0]
          : undefined;
    const name = literal(source);
    if (name !== undefined) names.push(name);
    for (const key in node) if (key !== 'parent') visit(node[key]);
  };
  visit(program);
  return names;
}

export function boundaryProblems(path, code) {
  const problems = [];
  for (const name of specifiers(path, code)) {
    if (/^(?:@strudel\/|superdough(?:\/|$))/.test(name) && !path.startsWith('src/strudel/'))
      problems.push('Strudel imports belong in src/strudel/');
    if (/^(src|tests)\//.test(path) && /(^|\/)spikes(\/|$)/.test(name))
      problems.push('Frozen spikes cannot be imported');
  }
  if (
    /^(scripts|tests|\.github)\/|config\.|^package\.json$/.test(path) &&
    /\bport["']?\s*[:=]\s*[1-9]\d*|\bPORT\s*=\s*[1-9]\d*|--port(?:=|\s+)[1-9]\d*|https?:\/\/[^\s/"'`]+:[1-9]\d*|\blisten\(\s*[1-9]\d*/.test(
      code,
    )
  )
    problems.push('Fixed port: ask the OS with port 0');
  return problems;
}
const excluded = new Set([
  '.git',
  'node_modules',
  'dist',
  'spikes',
  'corpus',
  'research',
  '.agents',
  'test-results',
  'playwright-report',
]);
function scan(dir = '.') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (excluded.has(entry.name) || entry.name.startsWith('.browser-')) return [];
    const path = dir === '.' ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) return scan(path);
    if (!/\.(?:[cm]?[jt]sx?|json|ya?ml)$/.test(path) || path === 'package-lock.json') return [];
    return boundaryProblems(path, readFileSync(path, 'utf8')).map(
      (problem) => `${path}: ${problem}`,
    );
  });
}
if (import.meta.main) {
  const problems = scan();
  console.log(problems.length ? problems.join('\n') : 'Boundaries OK');
  if (problems.length) process.exitCode = 1;
}
