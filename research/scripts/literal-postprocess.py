"""Post-process MIDI-To-Strudel output: tempo from JSON bpm_median, label blocks by stem,
drum note names -> Strudel drum sounds, pitched stems -> built-in synths.
usage: postprocess.py <combined.mid> <song.json> <converter result.txt> <out.strudel> <notes_per_bar>"""
import sys, re, json, mido
mid_path, json_path, res_path, out_path, npb = sys.argv[1:6]
NOTE_NAMES = ['c','c#','d','d#','e','f','f#','g','g#','a','a#','b']
def name(n): return NOTE_NAMES[n % 12] + str(n // 12 - 1)
DRUM_GM = {35: 'bd', 36: 'bd', 38: 'sd', 40: 'sd', 42: 'hh', 44: 'hh', 46: 'oh', 49: 'cr', 57: 'cr',
           41: 'lt', 43: 'lt', 45: 'lt', 47: 'lt', 48: 'lt', 50: 'lt'}
SYNTH = {'bass': 'triangle', 'guitar': 'sawtooth', 'vocals': 'square', 'other': 'sine', 'piano': 'triangle'}

m = mido.MidiFile(mid_path)
meta = json.load(open(json_path))
# the converter emits one block per (track_index, channel) with notes, in sorted order
keys = {}
for i, t in enumerate(m.tracks):
    tname = next((x.name for x in t if x.type == 'track_name'), f'track{i}')
    for x in t:
        if x.type == 'note_on' and x.velocity > 0:
            keys.setdefault((i, x.channel), (tname, set()))[1].add(x.note)
order = [keys[k] for k in sorted(keys)]

src = open(res_path).read().rstrip('\n')
lines = src.split('\n')
assert lines[0].startswith('setcpm('), lines[0]
blocks = re.split(r'\n(?=\$: )', '\n'.join(lines[1:]).strip('\n'))
assert len(blocks) == len(order), (len(blocks), len(order))
bpm = meta['bpm_median']
out = [f"// {meta['name']}: converted by MIDI-To-Strudel (Emanuel de Jong, GPL-3.0), notes-per-bar {npb}.",
       f"// Tempo: JSON bpm_median {bpm} (converter would have used the first tempo event: {lines[0]}).",
       f"setcpm({bpm}/4)", ""]
for (tname, notes), block in zip(order, blocks):
    block = block.strip('\n')
    assert block.endswith('.sound("piano")'), block[-40:]
    if tname == 'drums':
        mapping = {name(n): DRUM_GM[n] for n in notes}
        body = block[:block.rindex('\n')]  # drop .sound line
        body = body.replace('$: note(`', '$: s(`', 1)
        def sub(mo):
            tok = mo.group(0)
            if tok not in mapping: raise SystemExit(f'unmapped drum token {tok}')
            return mapping[tok]
        body = re.sub(r'[a-g]#?-?\d+', sub, body)
        out.append(f"// drums (GM notes -> {', '.join(f'{n}={DRUM_GM[n]}' for n in sorted(notes))})")
        out.append(body + '\n')
    else:
        synth = SYNTH.get(tname, 'triangle')
        out.append(f"// {tname}")
        out.append(block[:-len('.sound("piano")')] + f'.sound("{synth}")\n')
open(out_path, 'w').write('\n'.join(out).rstrip('\n') + '\n')
print(out_path, [t for t, _ in order])
