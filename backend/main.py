"""
Local Solfège OMR backend.

A small FastAPI app you run on your own machine when someone needs a photo of
sheet music turned into MusicXML. It:
  - serves the frontend at  /          (so there's no CORS to fuss with)
  - reports the active engine at /health
  - turns an uploaded image into MusicXML at POST /transcribe

Run it:
  cd backend
  uvicorn main:app --reload --port 8000
then open http://localhost:8000
"""
import os
import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles

from omr import OMRError, engine_name, transcribe_image

app = FastAPI(title="Solfège OMR backend", version="0.1.0")

# Permissive by default so opening the .html file directly (file://) also works.
# Lock this down if you ever expose it beyond your own machine.
origins = [o for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND = Path(__file__).resolve().parent.parent / "solfege-player.html"
ALLOWED = {
    "image/png", "image/jpeg", "image/jpg", "image/webp",
    "image/tiff", "image/bmp", "application/pdf",
}


# Serve the choir samples (for Tone.Sampler) if the folder exists.
SAMPLES = FRONTEND.parent / "samples"
if SAMPLES.exists():
    app.mount("/samples", StaticFiles(directory=str(SAMPLES)), name="samples")


@app.get("/")
def index():
    if FRONTEND.exists():
        return FileResponse(FRONTEND)
    return PlainTextResponse("Solfège OMR backend. POST an image to /transcribe.")


@app.get("/health")
def health():
    return {"status": "ok", "engine": engine_name()}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED:
        raise HTTPException(
            415,
            f"Unsupported type '{file.content_type}'. Send PNG/JPEG/TIFF/BMP/PDF.",
        )
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        src = tmp / (file.filename or "input.png")
        with src.open("wb") as f:
            shutil.copyfileobj(file.file, f)
        try:
            xml = transcribe_image(src, tmp)
        except OMRError as e:
            raise HTTPException(422, str(e))
    return Response(
        content=xml,
        media_type="application/vnd.recordare.musicxml+xml",
    )
