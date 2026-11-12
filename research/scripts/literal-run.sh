#!/usr/bin/env bash
# Rerun: MIDI-To-Strudel on each combined .mid, then postprocess + Strudel check.
set -euo pipefail
# usage: literal-run.sh <session dir with NN - name.mid/.json> <node_modules with pinned @strudel/*>
# Expects $B to hold: converter/repo (MIDI-To-Strudel, cloned separately; GPL-3.0, never copied here),
# venv/ with mido, and a copy of this scripts folder as $B/scripts (see research/midi-to-strudel-literal.md).
B=${B:?set B to the scratch folder}
NPB=${NPB:-64}
SRC="$1"
OUT="$SRC/strudel"
NM="$2"
mkdir -p "$OUT"
for f in "$SRC"/0*.mid; do
  b=$(basename "$f" .mid); w="$B/work/final/$b"; mkdir -p "$w"
  # the converter writes result.txt and log.log into its cwd, so run it from a work dir
  (cd "$w" && "$B/venv/bin/python" -I "$B/converter/repo/midi_to_strudel.py" --midi "$f" --notes-per-bar "$NPB" > stdout.txt)
  "$B/venv/bin/python" -I "$B/scripts/literal-postprocess.py" "$f" "${f%.mid}.json" "$w/result.txt" "$OUT/$b.strudel" "$NPB"
done
node "$B/scripts/strudel-check.mjs" "$NM" "$OUT"/*.strudel 2>/dev/null | grep '^{'
