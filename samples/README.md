# Choir samples (CC0)

The app's **Timbre → Choir** toggle plays back through `Tone.Sampler` using audio
files in `samples/choir/`. Until you add them, Choir mode auto-falls back to the
Formant synth and shows a note. Everything here is optional.

## What to add

Drop these files into `samples/choir/` (one sustained "ahh" per pitch — the
sampler pitch-shifts to fill the gaps, so a sparse set is fine):

```
samples/choir/A3.mp3
samples/choir/C4.mp3
samples/choir/Fs4.mp3      <- F#4  (filename can't contain '#')
samples/choir/A4.mp3
samples/choir/C5.mp3
samples/choir/Fs5.mp3      <- F#5
```

Want a denser/sparser set? Edit `CHOIR_URLS` in `solfege-player.html` to match
your filenames (the object maps note name → filename).

## Where to get CC0 "ahh" samples

- **VSCO Community Edition** (CC0) — the Versilian Community Sample Library
  includes choir/voice patches. <https://vis.versilstudios.com/vsco-community.html>
- **Freesound** — filter by license = **Creative Commons 0**, search "choir ahh
  sustain" / "vocal aah note". <https://freesound.org> (pick clean single notes)

Export/record each pitch as a short sustained note, trim the silence, save as
`.mp3` (or `.wav` — then change the extensions in `CHOIR_URLS`) named as above.

> Keep it CC0 (public domain) as you chose — VSCO Community and Freesound's CC0
> filter both qualify. Avoid sets marked CC-BY/NC unless you're prepared to
> attribute / accept the restriction.

## Serving

- Opening `solfege-player.html` directly (file://) — the browser loads
  `samples/choir/...` relative to the page. Works as-is.
- Via the backend (<http://localhost:8000>) — `main.py` mounts this folder at
  `/samples`, so the same relative path resolves. (The mount only activates if
  `samples/` exists, which it now does.)
