# Step 5: open a reference (2026-11-13)

Small addition above the existing paste panel, using its existing styles.
No timeline or new palette. Plain HTML controls and a short text summary.

```text
Reference
[Open song folder] [Reopen folder]
Drop a song folder or source folder here. Files stay on this device.

When the source contains more than one song:
Song [Song 1 v] [Open selected song]

Invented pickup — 1 stem; 3 bars + pickup; 48.00–120.00 BPM.
Coverage: partial; detected 0–7.5 s; leading 0 s; trailing 0.5 s; gaps: 4.5–6.5 s.
Tempo doubt: synthetic review. Detected map kept at 1×.
Stems: bass -18 dB (complete). Audio decoded; waveform peaks ready.
```

The open button uses the directory picker when supported, or a directory file
input elsewhere. Dropping works without the picker. Reopen stores only the
browser directory handle, never audio/notes; a later visit asks permission when
needed. A source folder reveals a native song select. Import failures appear
in the same status region. A folder-selection failure keeps the previous
reference; a read/decode failure clears it before work starts, to bound memory.

The [built synthetic example](reference-open.png) was inspected after the picker test.
The inherited shell already has a dark background; G22’s recording/arrangement
palette and full shell design still belong to step 10.
