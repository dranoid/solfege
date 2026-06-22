# Solfège OMR backend (local)

A small FastAPI service you run **on your own Mac, on demand** — when a choir
member sends you a photo of sheet music and you need MusicXML out of it. It also
serves the frontend, so there's no CORS to worry about.

For most hymns you won't need this at all — load existing MusicXML/MIDI in the app
(CPDL, Hymnary, MuseScore). This is the fallback for scores you can't find.

```
POST /transcribe   image (PNG/JPEG/TIFF/PDF) -> MusicXML
GET  /health        {"status":"ok","engine":"audiveris"}
GET  /              serves ../solfege-player.html
```

---

## Run it

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate            # do this in every new terminal
pip install -r requirements.txt
cp .env.example .env                  # then edit .env (set AUDIVERIS_CMD + JAVA_HOME)
uvicorn main:app --env-file .env --reload --port 8000
```

Open <http://localhost:8000>. `Ctrl-C` stops it; re-run the last line to restart.
In a new terminal you only need `source .venv/bin/activate` + the `uvicorn` line.

> `--reload` watches `.py` files, **not `.env`** — after editing `.env`, restart
> uvicorn (`Ctrl-C`, then rerun) for the change to take effect.

Sanity checks:
```bash
curl localhost:8000/health                                  # -> {"status":"ok","engine":"audiveris"}
curl -F "file=@/path/to/score.png" localhost:8000/transcribe   # -> MusicXML
```

> Configuration lives in `.env` (copied from `.env.example`) — `OMR_ENGINE`,
> `AUDIVERIS_CMD`, etc. `uvicorn --env-file .env` loads it, so you set it **once**
> instead of re-`export`ing every session.

---

## Engines: Audiveris (default) vs oemer

| | **Audiveris** (default) | **oemer** |
|---|---|---|
| Accuracy on printed SATB | **Best** — proper voices/staves | Weaker on dense multi-voice |
| Setup | One-time build from source | `pip install oemer` |
| Tech | Java | Python / ONNX |

Audiveris is the default (best quality, and it exports real `<voice>`/`<staff>`
structure the frontend uses). oemer is a quick alternative — **but note your
Python is 3.14, which is too new for oemer's wheels**, so Audiveris is also the
more reliable choice here.

### Set up Audiveris (one-time, Apple Silicon)

Everything here is **done once**. After it's built, starting the server is
instant — it just shells out to the already-built app.

```bash
# 1. Java 25  (Audiveris main / v5.10 requires JDK 25; the Temurin cask
#    auto-registers, so no sudo symlink is needed)
brew install --cask temurin@25
export JAVA_HOME=$(/usr/libexec/java_home -v 25)
java -version                                   # should report 25

# 2. Build Audiveris  (gradlew = the bundled Gradle wrapper; it downloads the
#    right Gradle and compiles. "clean build" takes a few minutes.)
git clone https://github.com/Audiveris/audiveris.git ~/audiveris   # skip if already cloned
cd ~/audiveris && ./gradlew clean build

# 3. Lay out the runnable launcher (build/ packages a zip; installDist unzips it)
cd ~/audiveris && ./gradlew installDist
find ~/audiveris -path '*/install/*/bin/Audiveris'

# 4. Put two things in backend/.env:
#      AUDIVERIS_CMD = the path from step 3
#      JAVA_HOME     = the JDK 25 home, from:  /usr/libexec/java_home -v 25
```

Audiveris needs **Tesseract OCR language data** for lyrics/text. Install it and
point `TESSDATA_PREFIX` (in `.env`) at it:

```bash
brew install tesseract tesseract-lang     # English etc. land in $(brew --prefix)/share/tessdata
```

### Image quality matters a lot

Audiveris needs roughly **300 DPI** — staff lines must be ~16–20 px apart. A phone
photo or a clean PDF export works; a **screenshot won't** (typically 72 DPI, lines
~6 px apart), and Audiveris will reject the sheet with
*"resolution is too low (try 300 DPI)"*. The backend now surfaces that as a plain
message. When possible, feed it the **source PDF** or a high-res scan — or just use
an existing MusicXML/MIDI file and skip OMR entirely.

> **Why `JAVA_HOME` in `.env`?** Audiveris is compiled for Java 25, but your PATH
> `java` may be an older JDK. The backend runs Audiveris as a subprocess and
> inherits uvicorn's environment, so setting `JAVA_HOME` in `.env` guarantees it
> runs under 25 no matter which shell started the server — otherwise you'd hit an
> `UnsupportedClassVersionError` at transcription time.

> **Hit "invalid source release: 25"?** That's an older JDK (e.g. 21) trying to
> compile code targeted at Java 25. Make sure `JAVA_HOME` points at 25
> (`export JAVA_HOME=$(/usr/libexec/java_home -v 25)`) before `./gradlew`.
>
> **Prefer a stable release over `main`?** `cd ~/audiveris && git checkout <tag>`
> (see the repo's releases) before building — older tags may target an older JDK.
>
> **Don't want to build it?** Prebuilt Audiveris Docker images exist. Run one and
> set `AUDIVERIS_CMD="docker run --rm -v /tmp:/tmp <image>"` — same interface.

### Or use oemer instead

```bash
# uncomment the oemer line in requirements.txt, then (ideally on Python 3.11):
pip install -r requirements.txt
# set OMR_ENGINE=oemer in .env, then run uvicorn as above
```

---

## Env vars (set in `.env`)

| Var | Default | Notes |
|---|---|---|
| `OMR_ENGINE` | `audiveris` | or `oemer` |
| `AUDIVERIS_CMD` | `audiveris` | full path to the Audiveris launcher from the build |
| `OMR_TIMEOUT` | `900` | seconds before a transcription is abandoned |
| `CORS_ORIGINS` | `*` | comma-separated; tighten if ever exposed |
