# Design study outcomes

Session with the owner on 2026-11-13, working from a design canvas
(an interactive prototype plus option boards) built on invented notes only
(G4). Decisions settled here are G9 onward in [decisions](../docs/decisions.md).

## Decided

| Question | Outcome | Decision |
| --- | --- | --- |
| 1. Timeline and sheet | **Lens.** Opening a section grows its bars in place inside the timeline; the rest of the song stays visible, squeezed to the sides. The lens can also open on any selected bars ("Look closer"). | G9 |
| 2. Rows per instrument | **Rows and layers, both.** Rows: MIDI, Notes, Mine stacked. Layers: one row, MIDI faint, Notes outlined, Mine solid. The user switches per instrument; a setting switches all. | G10 |
| 2, 6. Drums | **One lane per drum** (kick, snare, hi-hat, tom, crash). | G11 |
| 3. Selecting a range | **User settings:** select across the whole band or one instrument; snap to bars or beats. Sections stay whole bars; a beat selection only limits which notes come in. | G12 |
| 4. What a new section starts with | Starts as a **literal copy** by default (a setting). **At copy time** the user chooses how unedited sections are written (as made, literal or simplified) and how unarranged bars are written (silence, literal or simplified). | G13 |
| 5. Reuse | Offer matching places when making a section, pre-ticked. A place can be **split off as its own copy**. A new section takes over bars it overlaps, with a warning. | G14 |
| 7. Bar lines | **Bar 1 at the first detected downbeat.** The pickup is a short bar 0. | G15 |
| 8. Simplify | The limits (how far notes may move, share of notes dropped, fills) are **user settings**. | G16 |
| 9. ODM's live views | **Neither** the Now constellation nor the Watch spiral. Ghost Notes stands alone. | G17 |
| 10. Copy out | A **copy panel**, a changed-since-last-copy marker on the button, and a **warning when leaving** with uncopied changes. | G18 |
| 11. Sounds | **Synths and samples**, chosen per instrument. | G19 |
| 12. Hearing | An **optional fourth row per instrument: the stem audio**, opened from local disk. A speaker on every row (audio, MIDI, Notes, Mine) chooses what Play plays; presets for Recording, Mine, Both. | G20 |
| 13. What counts as a match | **A setting:** timing tolerance, whether quiet recorded notes count, exact pitch or any octave. | G21 |
| Settings | Kept **for the session only**, for now. | G23 |
| Platform | **Stay web**: installable, folder access in Chromium, drag-in elsewhere; file access behind one layer. | G24 |
| 6b. Stems | **One instrument per stem** to start; split and merge later. | G25 |
| 6a. Drum code | Kit is **one instrument, one line per drum**. | G26 |
| 7a. Doubtful tempo | **Ask once**, ½×, 1×, 2× side by side. | G27 |
| 7b, 12. Tempo and audio sync | **Playback follows the band's beat map**; stem audio plays as recorded. The copy has **a tempo per section**, editable; one tempo is the fallback if Strudel can't. | G28 |
| 7c. Pickup | **Its own short section** before bar 1. | G29 |
| 8. Simplify scope | **Drums first; all instruments are committed scope.** | G30 |
| 2c. Difference marks | **As drawn** on the Rows board. | G31 |
| 2b. Pitch | **Contour outside the lens, piano roll inside.** | G32 |
| 14. Look | **Dark scheme**: blue for the recording, cream for yours, orange for differences. | G22 |

## Still open

Nothing from the question list.

## Consequences for the plan

- **Stem audio (G20)** adds audio files to what the user opens. Reference
  import (next steps, step 4) must read them and draw a waveform; audio stays
  local (G2) and out of the repository (G4).
- **Samples (G19)** that use General MIDI soundfonts need `@strudel/soundfonts`,
  which ODM does not pin. Pin it at a version matching the other Strudel
  packages before use.
- **Per-section tempo (G28)** needs a check against Strudel 1.2.6 before the
  converter (step 5) is built, and the idea's out-of-scope list needs
  revising.
- **The lens (G9)** changes ODM's one-section score sheet more than the other
  layouts would. Step 6 (timeline) and step 8 (reference marks in the sheet)
  merge into one piece of work.
- **Settings (G12, G13, G16, G21)** last for the session only (G23).

## Lens, revised after the first look

The owner liked the lens but found the jump abrupt. The prototype now grows and
shrinks the lens with an animation, blurs and dims the squeezed bars slightly,
and lets the lens be dragged along the section, bar by bar, from its header or
from its outline in the song strip. The arrows remain for the keyboard.

## Usability test

Run by the owner on 2026-11-13, on the prototype with invented notes: the five
tasks on the canvas (find the second verse by shape, make one Chorus section
for all three choruses, explain a difference in the Verse lens, fix a drum hit
and see the second verse change, set what Play plays and say which bars the
copy leaves silent). The owner reported no issues with any task.

This is one tester, who also made the design decisions, so it shows the
premise holds for someone who knows it; it does not yet show it is learnable
by someone new. The prototype had no sound, and bass and keys could not be
edited, so listening and pitched editing are untested.

## Not yet done

- A test with someone new to the design.

Sketches: [sketches/](sketches/README.md). The [next steps](../docs/next-steps.md)
were revised to match on 2026-11-13.
