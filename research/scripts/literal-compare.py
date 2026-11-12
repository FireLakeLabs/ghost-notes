"""usage: compare.py <combined.mid> <dump.json> <notes_per_bar> -> per-track stats comparing MIDI notes to Strudel onsets"""
import sys, json, mido, collections
mid, dump, npb = sys.argv[1], sys.argv[2], int(sys.argv[3])
NOTE_NAMES = ['c','c#','d','d#','e','f','f#','g','g#','a','a#','b']
DRUM = {35:'bd',38:'sd',42:'hh',47:'lt',49:'cr'}
m = mido.MidiFile(mid); tpb = m.ticks_per_beat; bar = 4*tpb
tracks = {}
for i, t in enumerate(m.tracks):
    tname = next((x.name for x in t if x.type == 'track_name'), str(i)); tick = 0; on = {}; notes = []
    for x in t:
        tick += x.time
        if x.type == 'note_on' and x.velocity > 0: on.setdefault(x.note, []).append((tick, x.velocity))
        elif x.type in ('note_off', 'note_on') and on.get(x.note):
            s, v = on[x.note].pop(0); notes.append((s, tick, x.note, v))
    if notes: tracks[tname] = sorted(notes)
blocks = json.load(open(dump)); events = [b["events"] for b in blocks]
rows = []; barcounts = [b["bars"] for b in blocks]
for (tname, notes), evs in zip(tracks.items(), events):
    label = (lambda n: DRUM[n]) if tname == 'drums' else (lambda n: NOTE_NAMES[n % 12] + str(n // 12 - 1))
    shifted = sum(1 for s, *_ in notes if (s % bar) / bar > 0.95)
    # timing error in beats: match each MIDI note to the nearest unused Strudel onset with the same label
    pool = collections.defaultdict(list)
    for b, e, v in evs: pool[v.get('s') if tname == 'drums' else v['note']].append(b)
    errs = []; unmatched = 0
    for s, _, n, _ in notes:
        cand = pool[label(n)]
        if not cand: unmatched += 1; continue
        j = min(range(len(cand)), key=lambda k: abs(cand[k] - s / bar)); errs.append(abs(cand.pop(j) - s / bar) * 4)
    by_onset = collections.Counter(b for b, e, v in evs)
    dup = collections.Counter((b, json.dumps(v, sort_keys=True)) for b, e, v in evs)
    overlap = 0  # MIDI notes still sounding when the next note of the same track starts
    for a, b2 in zip(notes, notes[1:]):
        if b2[0] < a[1]: overlap += 1
    durs = [ (e - s) / tpb for s, e, *_ in notes]; sdurs = [(e - b) * 4 for b, e, _ in evs]
    rows.append(dict(track=tname, bars=barcounts[len(rows)], midi_notes=len(notes), strudel_onsets=len(evs), unmatched=unmatched,
        moved_to_next_downbeat=shifted, mean_err_beats=round(sum(errs)/len(errs), 4) if errs else None,
        max_err_beats=round(max(errs), 3) if errs else None,
        stacked_onsets=sum(c for c in by_onset.values() if c > 1), same_note_dupes=sum(c - 1 for c in dup.values() if c > 1),
        midi_overlaps=overlap, midi_dur_beats_median=round(sorted(durs)[len(durs)//2], 3),
        strudel_dur_beats_median=round(sorted(sdurs)[len(sdurs)//2], 3) if sdurs else None,
        velocities_distinct=len({v for *_, v in notes})))
print(json.dumps(rows))
