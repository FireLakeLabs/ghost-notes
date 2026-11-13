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
