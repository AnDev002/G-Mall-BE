# clip-service

Python sidecar that turns images (or text) into 512-dim CLIP vectors.
Stateless on top of `sentence-transformers/clip-ViT-B-32-multilingual-v1`
— supports Vietnamese captions out of the box.

## Run locally (without Docker)

```bash
cd clip-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

First call downloads ~600MB into `~/.cache/huggingface`. Subsequent
restarts are instant.

## Run via Docker

```bash
docker build -t gmall-clip ./clip-service
docker run -p 8000:8000 gmall-clip
```

Image is ~3GB because the model is baked in (avoids cold-start downloads
in prod).

## API

### `GET /health`

```json
{ "status": "ok", "model": "...", "loaded": true }
```

### `POST /embed`

Body — pick one input:

```json
{ "image_url": "https://..." }
{ "image_b64": "base64-encoded-bytes" }
{ "text": "chai nước khoáng Lavie 500ml" }
```

Response:

```json
{ "embedding": [0.012, -0.045, ...], "dim": 512, "model": "..." }
```

Vectors are L2-normalized so cosine similarity == dot product. Stored
in Qdrant with `Distance.Cosine`.

## Env

| Var | Default | Notes |
|---|---|---|
| `CLIP_MODEL` | `sentence-transformers/clip-ViT-B-32-multilingual-v1` | Any sentence-transformers CLIP variant |
| `CLIP_HTTP_TIMEOUT` | `10` | Seconds to wait when fetching `image_url` |

## Resource

- RAM: ~1 GB once model is loaded.
- CPU: ~50ms per image on a modern x86 core. GPU optional (10x speedup).
- For GMall catalog scale (<100k SP) CPU is enough.
