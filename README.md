# Solfège

Tools for learning and preparing choral/hymn music by movable-do solfège.

Two self-contained, no-build web apps plus a small local OMR backend:

| File | What it is |
| --- | --- |
| [`solfege-player.html`](solfege-player.html) | **Solfège Player** — load a hymn, hear each voice sung back in do-re-mi, see per-part solfège or engraved staves, edit/build the score, and export it. |
| [`theory-course.html`](theory-course.html) | **Rudiments of Music** — an interactive music-theory quiz. |
| [`backend/`](backend/) | Local FastAPI service that turns a photo/PDF of sheet music into MusicXML (Audiveris OMR). Optional; only needed for the photo path. |

## Solfège Player

- **Load** MusicXML / MXL / MIDI, paste MusicXML, type a melody by hand, or transcribe a photo/PDF (needs the backend).
- **Player tab** — every voice (SATB) as movable-do solfège *or* its own engraved staff (toggle per part, or all at once). Per-part solo / mute / volume, and a sticky transport bar with playback + scrubbing. Hit **Edit** on any part to fix its notes inline — change pitch / duration / rests, insert / delete notes, set the time signature, undo (⌘/Ctrl+Z); click a note on the staff to select it, then drag (or ↑/↓) to nudge pitch. **Tools** adds / removes / renames parts and starts a **New piece** / **New SATB** from scratch.
- **Full score tab** — the whole score engraved, cursor follows playback. Save it as **MusicXML / PNG / PDF**.
- **Persistence** — your working piece autosaves to the browser (survives a refresh), and you can **Save / Open** a portable `.solfege.json` project.
- **Export** — per-part MP3, full-mix MP3, per-part solfège PNG, and whole-score MusicXML / PNG / PDF.

### Run it

Just open `solfege-player.html` in a browser — everything except the photo/PDF OMR works offline from disk (it loads a few libraries from CDNs).

For the photo/PDF transcription path, run the backend so it can serve the app same-origin:

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then set AUDIVERIS_CMD + JAVA_HOME
uvicorn main:app --env-file .env --reload --port 8000
```

Then open <http://localhost:8000>. See [`backend/README.md`](backend/README.md) for Audiveris setup. OMR is imperfect (and needs ~300 DPI), so transcriptions arrive ready to review and fix inline (per-part **Edit**) before you rely on them.

## Tests

[Playwright](https://playwright.dev) drives Google Chrome:

```bash
npm install
npx playwright test                 # all suites
npx playwright test tests/player.spec.js
```

`tests/player.spec.js` covers the player (icons, tabs, serializer, editor, exports, persistence, OMR gate); the other specs cover the theory course.

## Future work

Deferred ideas, roughly in order of value:

- **MIDI export** — save the score/parts as `.mid` for use in other tools (audio + MusicXML/PNG/PDF export already exist).
- **Lyrics** — enter and display lyric text under each note.
- **Positional / metric bar editing** — place notes at specific beat positions within a bar (e.g. drop a crotchet on beat 3, leaving rests around it) instead of the current flat left-to-right reflow. Bigger change: needs a beat-grid UI and note-collision rules. The serializer and click-to-beat hit-testing already support it; the editing model and UI do not. Flat reflow remains the better default for continuous vocal lines, so this is opt-in territory.
- **Multi-page / bundler** — if the project grows, split shared code into ES modules, and adopt a bundler (Vite) only if npm deps / TypeScript / minification become worthwhile.
