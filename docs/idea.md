# The idea

## The problem

A recording of a band can be turned into MIDI: separate the mix into
instruments, find the beat, transcribe each instrument. Turning that MIDI into
Strudel is also easy, but the result is a pile of notes: bar after bar of
`note("<...>")`, thousands of events, no structure. A Strudel player would never
write it that way. They would write a two-bar riff and repeat it, alternate a
fill every fourth bar, put a melody on scale degrees, and arrange sections.

Going from the pile of notes to that is a matter of judgement, and the
judgement belongs to the person arranging. Ghost Notes is the workbench for it:
the evidence on top, the arrangement underneath, and tools that help without
deciding for you.

## The workflow

```
recording ──► stems ──► MIDI + beat map ──► literal Strudel ──► your arrangement ──► copy out
             (Python tool: audio-to-midi)    (converter)         (Ghost Notes)
```

1. **Transcribe.** A local Python tool (ODM's `tools/audio-to-midi`, to move
   here) splits a recording into stems, finds beats and downbeats, and
   transcribes each stem. It writes MIDI, `notes.json` (every note as start,
   end, pitch, velocity, in seconds) and `beats.json`.
2. **Open.** The user opens those files from their own disk. Nothing is
   uploaded or stored by the app.
3. **Compare.** For each instrument, three rows on one timeline measured in
   beats:

   ```
                  bar 9            bar 17           bar 25
   Bass  MIDI     ▬ ▬▬  ▬  ▬▬ ▬   ▬ ▬▬  ▬ ▬▬ ▬    ▬ ▬  ▬▬▬  ▬      reference
         Notes    ▪ ▪▪  ▪  ▪▪ ▪   ▪ ▪▪  ▪ ▪▪ ▪    ▪ ▪  ▪▪▪  ▪      reference
         Mine     [ Verse ────────][ Verse ×2 ─────]  (unarranged)  editable
   ```

   - **MIDI** is the transcription as heard, with real starts and lengths.
   - **Notes** is the literal conversion. Where it differs from the MIDI (a
     note moved to the next downbeat, a note shortened, two notes merged into a
     chord) it is marked.
   - **Mine** is the user's arrangement, drawn from what their Strudel actually
     plays. Bars not yet arranged say so; they never look silent.

4. **Make a section.** Drag across a range of bars and choose "Make section".
   A section of that length joins the song, linked to the bars it came from.
   One section can stand for several places (the verse at bar 9 and bar 41).
5. **Arrange.** Open the section with ODM's editors (rhythm, values over time,
   rewrites, constants, edit as text) and rewrite it. The reference sits
   directly above, so drift is visible at once.
6. **Get help (optional).** Ask for a suggestion: a literal copy to carve down,
   or a simplified version that finds repeats, Euclidean rhythms, transposed
   riffs and scale degrees, under limits the user sets ("move notes at most a
   16th", "drop at most 10% of weak notes"). Suggestions are proposals; what
   they drop or add is shown.
7. **Copy out.** One button copies the whole arrangement as Strudel. Section
   names and their source bars travel inside it as comments, so pasting it back
   and opening the same MIDI restores the links. In any other Strudel editor
   the comments are inert.

## What it borrows from ODM

ODM's model holds: a Strudel program is a score, a pattern is a question you
can ask about time, an instrument is a leaf of the score tree, sections come
from one top-level `arrange`. Ghost Notes keeps ODM's document model, Strudel
import and generation, score sheet, song strip and editors (decision G1), and
adds the reference rows, the timeline, range selection, and the conversion and
simplification tools.

## What is new

| Piece | What it does |
| --- | --- |
| Reference import | Reads MIDI or `notes.json` + `beats.json`; maps to beats and cycles; names instruments by stem. |
| Literal converter | Writes the selected notes as Strudel on a chosen grid, in TypeScript. |
| Timeline | Whole-song view: three rows per instrument, zoom, range selection. |
| Make section from range | One document edit: a section with its source bars. |
| Reference marks in the sheet | Within the current section, the MIDI and converted notes drawn faintly behind the user's own. |
| Simplify | Proposes shorter, structured Strudel for a section under user-set error limits. |
| Copy out | The whole arrangement as Strudel text, with section and stem links in comments. |

## Out of scope for now

- Running the transcription in the browser. It stays a local Python tool; see
  [the TypeScript study](../research/pipeline-in-typescript.md).
- Saving, accounts, sharing. The user's copy is the save.
- Tempo maps in the output. A band speeds up and slows down; the arrangement
  plays at one tempo. Rows line up by beat, not by clock time.
- Judging sound. No agent can hear; checks compare notes, not audio.

## Known weaknesses of the input

From the first real run (four songs from one live session, local only):

- Beat tracking can be rough (one song's beat gaps ranged 0.10–2.10 s around a
  median of 0.86 s) and can settle on half or double the tempo.
- One song's beat map stopped 18 s before the end of the audio.
- Quiet stems can be bleed from other instruments.
- The transcriber adds stray notes and splits long ones; bass and vocals are
  forced to one note at a time; drums come out as five kinds of hit.
- The tool's cache reuses old results when settings change.

The design should make these visible rather than hide them.
