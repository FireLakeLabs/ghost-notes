# Playback

- **G72 (2026-11-13) Follow the grid with a fixed clock and warped onsets.**
  Run Cyclist at one cycle per second. Query the user's pattern in song cycles
  through the converter's reversible grid mapping, then map onset and effective
  sustain endpoints to recorded seconds. One numbered bar remains one source
  cycle; pickup and uncovered edges retain the converter's spans. Score tempo
  controls cannot override this clock. Schedule only the first pass, never a
  fractional pickup loop (G37). G28's fallback is unnecessary: the Node proof
  preserves every converted note in six local songs, with maximum additional
  warp error below 0.000028 ms and zero chord split. The synthetic fixture also
  survives 50 ms query windows without omissions or duplicates. Filter onsets
  before mapping: floating-point conversion can collapse tiny non-onset
  fragments from pinned `arrange` onto their whole's start.

  The acceptance tolerance is **1 ms of additional scheduling error** against
  the grid time of a written onset. That keeps playback within the converter's
  own 1 ms precision budget and is stricter than G36's rejected 50 ms bound.
  Browser proof must also require positive scheduling lead: accurate timestamps
  alone would conceal callbacks arriving after their deadlines. This tolerance
  describes scheduled AudioContext times, not speaker output or perception.

- **G73 (2026-11-13) Restart from a bar with a new common clock origin.**
  `createSongPlayback` owns a song transport. A play call stops the preceding
  transport and seeks to that bar's recorded seconds; the first scheduler query
  supplies the exact AudioContext origin for all retained stem sources. Each
  source starts at origin + seek seconds, with that same buffer offset, at rate
  1. No decoding or stretching happens during playback. Omit the bar to include
     leading uncovered audio and the pickup. Stop/replay resets fractional phase;
     sustained notes starting before a seek are not retriggered. Live `update`
     swaps Mine without moving the clock or restarting stems. Explicit tempo
     setters are neutralized at the scheduler boundary during evaluation too.
     Playback stops at the full mapping's end; effect tails follow the inherited
     engine's behavior. This API exposes Recording/Mine/Both and stem selection
     for part 2; it adds no visible row controls.

- **G122 (2026-11-14) Row speakers choose the next playback.** Decided for the
  absent owner, following Main's Recording (audio), Mine and Both presets and
  independent Audio/MIDI/Notes/Mine buttons, including Layers. Both is the
  initial choice. View mode and hidden rows never change the selected sources;
  the transport explains that hidden selected rows still play. Changing a source
  stops playback; the next Play uses that choice. This avoids a partially changed
  mix while sounds prepare. Native Solo filters Mine while the chosen reference monitors remain selected;
  its banner says Mine solo. Document revisions retain G73's clock and stem phase;
  Recording revisions commit silence without evaluating Mine. A replacement
  reference/grid disposes the previous scheduler, workers and tap. A late
  initialization cannot start its obsolete song.

  Mine is filtered by instrument tags **after full-program evaluation**, retaining
  effects and cross-row transforms. It is never reconstructed from painted notes
  or isolated source. Untagged onsets refuse selection with an explanation.
  A draft needs reference links before Mine can be warped; Recording, MIDI and
  Notes remain available independently. MIDI uses original times; Notes uses the
  complete chosen-grid conversion. Both share the fixed-clock warp with Mine.
  One first pass includes pickup/edges and ends at the complete map's endpoint.
  The [control sketch](../../design-study/sketches/row-playback.html) records the
  source-change notice and sound choice.

- **G123 (2026-11-14) Share an explicit sound choice per instrument.** Decided
  for the absent owner. Keep Mine as written until the user chooses a sound.
  Reference pitched voices default to the converter's triangle; drums use the
  default five-lane sample kit. The picker offers synths, pinned General MIDI
  soundfonts and the prototype's two drum banks. A choice writes an outer sound
  (or drum bank) setting to every existing definition for that stem, through
  the normal undo/edit boundary, including independent section copies. It also
  supplies MIDI/Notes and new sections during this session. Notes, source links
  and other effects remain intact; edited sections carry their sound into Copy.
  Mine as written removes the session override for reference/new sections and
  keeps current document settings. It is not an undo of earlier musical edits.
  Missing/offline samples retain the engine's explicit failure; no silent synth
  substitution. Only the existing soundfont/registry boundary imports Strudel.
