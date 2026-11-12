// usage: node dump.mjs <node_modules dir> <file.strudel> <out.json>
// Writes [{bars, events:[[begin,end,value]...]}] per $: pattern, querying each pattern for exactly its own bar count.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s, c, next) { if (s === '@kabelsalat/web') return { url: 'data:text/javascript,export class SalatRepl {}', shortCircuit: true }; return next(s, c); } });
const [nm, file, out] = process.argv.slice(2);
const imp = (p) => import(pathToFileURL(`${nm}/@strudel/${p}/dist/index.mjs`).href);
const core = await imp('core'); const mini = await imp('mini'); const tonal = await imp('tonal');
const { transpiler } = await imp('transpiler');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const src = readFileSync(file, 'utf8');
// bar count per block = top-level entries inside the outer <...>
const bars = [...src.matchAll(/`<([\s\S]*?)>`/g)].map(([, body]) => {
  let depth = 0, count = 0, inTok = false;
  for (const ch of body) {
    if (ch === '[') { if (depth === 0) count++; depth++; inTok = false; }
    else if (ch === ']') depth--;
    else if (/\s/.test(ch)) inTok = false;
    else if (depth === 0 && !inTok) { count++; inTok = true; }
  }
  return count;
});
const { output } = transpiler(src, { emitMiniLocations: false, emitWidgets: false });
const labels = [];
core.Pattern.prototype.p = function () { labels.push(this); return this; };
await new AsyncFunction('host', `with(host){ return (async()=>{${output}\n})() }`)({ ...core, ...mini, ...tonal, setcpm: () => core.silence });
if (bars.length !== labels.length) throw Error(`bars ${bars.length} vs patterns ${labels.length}`);
writeFileSync(out, JSON.stringify(labels.map((p, i) => ({ bars: bars[i],
  events: p.queryArc(0, bars[i]).filter((h) => h.hasOnset()).map((h) => [h.whole.begin.valueOf(), h.whole.end.valueOf(), h.value]) }))));
