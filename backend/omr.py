"""
OMR engine abstraction.

Two engines, chosen via the OMR_ENGINE env var:

  audiveris  (default) - Java, best accuracy on printed SATB. Exports compressed
                         MusicXML (.mxl), which we unzip. Needs a JDK + Tesseract
                         and the Audiveris CLI on PATH (or set AUDIVERIS_CMD).
  oemer                - pip-installable Python/ONNX engine. One command to set up,
                         but weaker on dense multi-voice scores.

Both are invoked as subprocesses against a temp directory, so the rest of the app
never has to care which one is running.
"""
import os
import shlex
import shutil
import subprocess
import zipfile
from pathlib import Path

ENGINE = os.environ.get("OMR_ENGINE", "audiveris").lower()
# Full command (template) for the Audiveris CLI. Override if your launcher lives
# somewhere odd, e.g. AUDIVERIS_CMD="/opt/audiveris/bin/Audiveris"
AUDIVERIS_CMD = os.environ.get("AUDIVERIS_CMD", "audiveris")
TIMEOUT = int(os.environ.get("OMR_TIMEOUT", "900"))  # seconds; OMR is slow


class OMRError(Exception):
    """Raised for any recoverable transcription failure (-> HTTP 422)."""


def engine_name() -> str:
    return ENGINE


def _run(cmd, timeout=TIMEOUT):
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError:
        raise OMRError(
            f"'{cmd[0]}' not found on PATH. Install the engine or set OMR_ENGINE "
            f"to one you have. See backend/README.md."
        )
    except subprocess.TimeoutExpired:
        raise OMRError(f"OMR timed out after {timeout}s.")
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "").strip()[-1000:]
        raise OMRError(f"{cmd[0]} failed (exit {proc.returncode}): {tail}")
    return proc


def _read_musicxml_from_mxl(mxl_path: Path) -> str:
    with zipfile.ZipFile(mxl_path) as z:
        # The real score is the first .xml that isn't the container manifest.
        name = next(
            (n for n in z.namelist()
             if n.lower().endswith(".xml") and not n.startswith("META-INF")),
            None,
        )
        if not name:
            raise OMRError("No MusicXML found inside the .mxl archive.")
        return z.read(name).decode("utf-8")


def _friendly_audiveris(output: str):
    """Turn known Audiveris failure signatures into actionable messages."""
    low = output.lower()
    if "interline" in low or "resolution is too low" in low or "flagged as invalid" in low:
        return ("Image resolution too low for OMR — Audiveris needs roughly 300 DPI "
                "(staff lines were too close together). This is almost always a "
                "screenshot; use a higher-resolution scan or the source PDF instead.")
    if "no installed ocr" in low:
        return ("No OCR language data installed (Audiveris needs it for lyrics/text). "
                "Run: brew install tesseract tesseract-lang, then set TESSDATA_PREFIX "
                "in backend/.env. See backend/README.md.")
    return None


def _audiveris(src: Path, outdir: Path) -> str:
    # -batch: no GUI, -export: write MusicXML, then quit.
    cmd = shlex.split(AUDIVERIS_CMD) + [
        "-batch", "-export", "-output", str(outdir), "--", str(src),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT)
    except FileNotFoundError:
        raise OMRError(
            f"'{shlex.split(AUDIVERIS_CMD)[0]}' not found. Set AUDIVERIS_CMD in .env. "
            f"See backend/README.md."
        )
    except subprocess.TimeoutExpired:
        raise OMRError(f"Audiveris timed out after {TIMEOUT}s.")

    # Prefer real output if it exists, regardless of exit-code quirks.
    mxl = sorted(outdir.rglob("*.mxl"))
    if mxl:
        return _read_musicxml_from_mxl(mxl[0])
    xml = sorted(outdir.rglob("*.xml"))
    if xml:
        return xml[0].read_text(encoding="utf-8")

    # No output -> diagnose from the full log, not just the stack-trace tail.
    full = (proc.stdout or "") + "\n" + (proc.stderr or "")
    friendly = _friendly_audiveris(full)
    if friendly:
        raise OMRError(friendly)
    raise OMRError(f"Audiveris produced no MusicXML (exit {proc.returncode}): {full.strip()[-800:]}")


def _oemer(src: Path, outdir: Path) -> str:
    _run(["oemer", "-o", str(outdir), str(src)])
    out = sorted(outdir.glob("*.musicxml")) + sorted(outdir.glob("*.xml"))
    if not out:
        raise OMRError("oemer produced no MusicXML output.")
    return out[0].read_text(encoding="utf-8")


def transcribe_image(src: Path, outdir: Path) -> str:
    """Run the configured OMR engine, returning MusicXML text."""
    if ENGINE == "audiveris":
        return _audiveris(src, outdir)
    if ENGINE == "oemer":
        return _oemer(src, outdir)
    raise OMRError(f"Unknown OMR_ENGINE '{ENGINE}' (expected 'audiveris' or 'oemer').")
