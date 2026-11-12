// usage: node check.mjs <node_modules dir> <file.strudel>...
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';
// Same stand-in the project uses in src/strudel/evaluate-node.ts: core imports a browser-only export.
registerHooks({ resolve(s, c, next) { if (s === '@kabelsalat/web') return { url: 'data:text/javascript,export class SalatRepl {}', shortCircuit: true }; return next(s, c); } });
const nm = process.argv[2];
const imp = (p) => import(pathToFileURL(`${nm}/@strudel/${p}/dist/index.mjs`).href);
const core = await imp('core'); const mini = await imp('mini'); const tonal = await imp('tonal');
const { transpiler } = await imp('transpiler');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
for (const file of process.argv.slice(3)) {
  const src = readFileSync(file, 'utf8');
  const r = { file: file.split('/').pop(), transpiled: false, evaluated: false };
  try {
    const { output } = transpiler(src, { wrapAsync: false, addReturn: true, emitMiniLocations: false, emitWidgets: false });
    r.transpiled = true;
    const labels = []; let cpm = null;
    const savedP = core.Pattern.prototype.p;
    core.Pattern.prototype.p = function (id) { labels.push([id, this]); return this; };
    const scope = { ...core, ...mini, ...tonal, setcpm: (v) => { cpm = v; return core.silence; } };
    try {
      await new AsyncFunction('host', `with(host){ return (async()=>{${output}\n})() }`)(scope);
    } finally { core.Pattern.prototype.p = savedP; }
    if (!labels.length) throw Error('no $: patterns');
    r.evaluated = true; r.cpm = cpm; r.patterns = labels.length;
    const pat = core.stack(...labels.map(([, p]) => p));
    const haps = pat.queryArc(0, 4).filter((h) => h.hasOnset());
    r.events_cycles_0_4 = haps.length;
    r.per_pattern_0_4 = labels.map(([, p]) => p.queryArc(0, 4).filter((h) => h.hasOnset()).length);
    // full-length count: the outer <...> has one entry per bar
    const bars = (src.match(/^\$: /gm) || []).length; // patterns
    r.sample = haps.slice(0, 5).map((h) => `${h.whole.begin.toFraction()}-${h.whole.end.toFraction()} ${JSON.stringify(h.value)}`);
    const keys = new Set(); for (const h of haps) Object.keys(h.value).forEach((k) => keys.add(k));
    r.value_keys = [...keys].sort();
  } catch (e) { r.error = `${e?.name}: ${e?.message}`; }
  console.log(JSON.stringify(r));
}
