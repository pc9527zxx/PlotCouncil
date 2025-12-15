# PlotCouncil Renderer

FastAPI service that executes Matplotlib code server-side and returns a base64 PNG. Each request runs the submitted Python code inside a temporary directory using the system Python interpreter.

## Setup

```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The service exposes:

- `GET /health` – readiness probe.
- `POST /render` – body `{ "code": "...", "width": 12, "height": 8, "dpi": 150 }`, returns `{ "base64_png": "...", "logs": "...", "error": null }`.

**Security note:** this version executes arbitrary Python code. Deploy behind a sandbox (Docker, Firejail, gVisor) and restrict resources/timeouts before exposing publicly.
