"""usage: python -I structure-experiment.py <notes.json> <beats.json> <out dir>
Quantizes bass and drums to a 16th grid over the beat map, groups near-identical bars,
and writes literal and compressed Strudel plus measurements.json."""
import json,pathlib,bisect,collections,statistics,sys
d=json.loads(pathlib.Path(sys.argv[1]).read_text())
b=json.loads(pathlib.Path(sys.argv[2]).read_text())
out=pathlib.Path(sys.argv[3]); out.mkdir(parents=True,exist_ok=True)
beats=b['beats']; down=b.get('downbeats',[])
origin=min(range(len(beats)),key=lambda i:abs(beats[i]-down[0])) if down else 1
n=(len(beats)-1-origin)//4
results={}
for stem in ['bass','drums']:
 bars=[set() for _ in range(n)]; residual=[]; kept=0
 for start,end,p,v in d[stem]:
  i=bisect.bisect_right(beats,start)-1
  if i<0 or i>=len(beats)-1:continue
  tick=round(((i-origin)+(start-beats[i])/(beats[i+1]-beats[i]))*4)
  bar,slot=divmod(tick,16)
  if not 0<=bar<n:continue
  bars[bar].add((slot,p));kept+=1
  residual.append(abs(((i-origin)+(start-beats[i])/(beats[i+1]-beats[i]))*4-tick)/4)
 # greedy first representative, normalized symmetric difference <= .25
 reps=[];labels=[];dist=[]
 for bar in bars:
  ds=[len(bar^r)/max(1,len(bar|r)) for r in reps]
  k=min(range(len(ds)),key=ds.__getitem__) if ds else -1
  if k<0 or ds[k]>.25: k=len(reps);reps.append(bar);dist.append(0)
  else:dist.append(ds[k])
  labels.append(k)
 def pat(bar):
  return ' '.join('['+','.join(str(p) if stem=='bass' else {35:'bd',38:'sd',42:'hh',47:'mt',49:'cr'}.get(p,'hh') for s,p in sorted(bar) if s==slot)+']' if any(s==slot for s,p in bar) else '~' for slot in range(16))
 fun='note' if stem=='bass' else 's'
 literal=fun+'("<'+' '.join('['+pat(x)+']' for x in bars)+'>")'
 defs='\n'.join(f'const {stem}{i} = {fun}("{pat(r)}")'+('.s("sawtooth")' if stem=='bass' else '')+';' for i,r in enumerate(reps))
 runs=[]
 for k in labels:
  if runs and runs[-1][1]==k:runs[-1][0]+=1
  else:runs.append([1,k])
 code=defs+'\narrange('+','.join(f'[{count},{stem}{k}]' for count,k in runs)+')'
 (out/f'{stem}-literal.js').write_text(literal)
 (out/f'{stem}-compressed.js').write_text(code)
 results[stem]=dict(bars=n,input_notes=len(d[stem]),in_window_notes=kept,quantized_events=sum(map(len,bars)),distinct_exact=len(set(map(frozenset,bars))),distinct_tolerant=len(reps),exact_repeated_occurrences=n-len(set(map(frozenset,bars))),near_reused_occurrences=n-len(reps),threshold='Jaccard distance <= 0.25; first representative, order dependent',literal_chars=len(literal),compressed_chars=len(code),median_onset_error_beats=statistics.median(residual),max_distance=max(dist))
results['grid']=dict(beats=len(beats),first=beats[0],last=beats[-1],origin_index=origin,downbeats_first=down[:3],duration=b['duration_seconds'],gap_min=min(y-x for x,y in zip(beats,beats[1:])),gap_max=max(y-x for x,y in zip(beats,beats[1:])))
(out/'measurements.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
