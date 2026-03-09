# Titan Protocol API

## Run (LAN / local dev)

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## CORS

- Dev (default): set `ENV=dev` (or omit) to allow all origins (`*`) without credentials.
- Prod: set `ENV=prod` and set `CORS_ORIGINS` as a comma-separated list.

