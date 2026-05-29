"""CLIP embedding service for GMall image search.

Why a separate Python service: sentence-transformers / CLIP needs ~600MB
of model weights in memory. Loading this once at startup beats spawning
per-request, and keeping it out of NestJS keeps the BE runtime small.

Endpoints:
  GET  /health        — liveness + model name
  POST /embed         — body: { image_url | image_b64 | text } -> { embedding: float[512] }

Wire from NestJS via CLIP_SERVICE_URL env (default http://clip:8000).
"""
import base64
import io
import os
from typing import Optional

import requests
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

MODEL_NAME = os.getenv("CLIP_MODEL", "sentence-transformers/clip-ViT-B-32-multilingual-v1")
HTTP_TIMEOUT_SECONDS = float(os.getenv("CLIP_HTTP_TIMEOUT", "10"))

app = FastAPI(title="GMall CLIP service", version="1.0.0")
_model: Optional[SentenceTransformer] = None


@app.on_event("startup")
def _load_model() -> None:
    global _model
    _model = SentenceTransformer(MODEL_NAME)
    print(f"[clip-service] loaded model: {MODEL_NAME}", flush=True)


class EmbedRequest(BaseModel):
    image_url: Optional[str] = None
    image_b64: Optional[str] = None
    text: Optional[str] = None


class EmbedResponse(BaseModel):
    embedding: list[float]
    dim: int
    model: str


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL_NAME, "loaded": _model is not None}


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest) -> EmbedResponse:
    if _model is None:
        raise HTTPException(503, "model not loaded yet")

    payload = None
    if req.image_url:
        try:
            r = requests.get(req.image_url, timeout=HTTP_TIMEOUT_SECONDS)
            r.raise_for_status()
            payload = Image.open(io.BytesIO(r.content)).convert("RGB")
        except Exception as e:
            raise HTTPException(400, f"failed to fetch image: {e}")
    elif req.image_b64:
        try:
            payload = Image.open(io.BytesIO(base64.b64decode(req.image_b64))).convert("RGB")
        except Exception as e:
            raise HTTPException(400, f"invalid image_b64: {e}")
    elif req.text:
        payload = req.text
    else:
        raise HTTPException(400, "provide image_url, image_b64, or text")

    vec = _model.encode(payload, normalize_embeddings=True).tolist()
    return EmbedResponse(embedding=vec, dim=len(vec), model=MODEL_NAME)
