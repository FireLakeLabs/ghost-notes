# Sketches

The design canvas from the study on 2026-11-13, as source. Every note, audio
shape and tempo in it is invented and generated in the page (G4); "song-3" is
only a label.

`canvas/` holds the canvas index (`canvas.json`) and one `.dc.html` file per
artboard. They are written for the claude.ai Design canvas and need its runtime
(`support.js`), so they do not open on their own in a browser. The published
canvas is private to the owner.

| File               | What it is                                                                                                                                                                                                             | Outcome  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `Main.dc.html`     | The interactive prototype of the core loop: lens, rows and layers, audio rows, sections, reuse, drum editing in the lens, playback following an invented beat map, settings, copy out. The usability test ran on this. | G9–G32   |
| `Layout.dc.html`   | Stacked, two modes, or lens.                                                                                                                                                                                           | G9       |
| `Rows.dc.html`     | Three rows, layers, or evidence and mine; the difference marks.                                                                                                                                                        | G10, G31 |
| `Drums.dc.html`    | One row or one lane per drum; how drum code is written.                                                                                                                                                                | G11, G26 |
| `Grid.dc.html`     | Beat map health, ½×/1×/2× tempo, where bar 1 starts.                                                                                                                                                                   | G15, G27 |
| `Simplify.dc.html` | Working simplify for drums under user limits.                                                                                                                                                                          | G16, G30 |
| `Pitch.dc.html`    | Piano roll, contour, or contour outside the lens and roll inside.                                                                                                                                                      | G32      |
