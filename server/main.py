from __future__ import annotations

import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple, List, Any, Dict

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
ARTIFACT_ROOT = BASE_DIR / "artifacts"
ARTIFACT_ROOT.mkdir(exist_ok=True)

app = FastAPI(title="PlotCouncil Renderer")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static frontend files
DIST_DIR = BASE_DIR.parent / "dist"
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")
    
    @app.get("/")
    def serve_frontend():
        """Serve the frontend index.html"""
        index_path = DIST_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return {"message": "Frontend not built. Run 'npm run build' first."}

    @app.get("/plotcouncil-logo.jpeg")
    def serve_logo():
        """Serve the logo referenced by the favicon/link tag."""
        logo_path = DIST_DIR / "plotcouncil-logo.jpeg"
        if logo_path.exists():
            return FileResponse(logo_path)
        return {"message": "Logo not found. Ensure frontend is built."}


class RenderRequest(BaseModel):
    code: str = Field(..., description="Complete Python script using matplotlib")
    width: float = Field(12.0, ge=1.0, le=60.0, description="Figure width in inches")
    height: float = Field(8.0, ge=1.0, le=60.0, description="Figure height in inches")
    dpi: int = Field(150, ge=50, le=600, description="Figure DPI")
    timeout: float = Field(120.0, ge=1.0, le=600.0, description="Max execution time in seconds")


class RenderResponse(BaseModel):
    base64_png: Optional[str]
    base64_svg: Optional[str]
    logs: str
    error: Optional[str]
    artifact_id: str


# =============================================================================
# LLM Proxy - Forward requests to any OpenAI-compatible API (bypasses CORS)
# =============================================================================

class LLMProxyRequest(BaseModel):
    """Request body for LLM proxy endpoint."""
    base_url: str = Field(..., description="Base URL of the LLM API (e.g., https://api.siliconflow.cn/v1)")
    api_key: str = Field(..., description="API key for authentication")
    model: str = Field(..., description="Model name/ID")
    messages: List[Dict[str, Any]] = Field(..., description="OpenAI-format messages array")
    temperature: float = Field(0.2, ge=0.0, le=2.0, description="Sampling temperature")
    max_tokens: int = Field(16384, ge=1, le=128000, description="Max tokens to generate")
    stream: bool = Field(False, description="Whether to stream the response")


class LLMProxyResponse(BaseModel):
    """Response from LLM proxy endpoint."""
    content: str = Field(..., description="Generated text content")
    model: Optional[str] = Field(None, description="Model used")
    usage: Optional[Dict[str, int]] = Field(None, description="Token usage stats")


@app.post("/api/llm/chat", response_model=LLMProxyResponse)
async def llm_proxy_chat(request: LLMProxyRequest) -> LLMProxyResponse:
    """
    Proxy endpoint for OpenAI-compatible LLM APIs.
    
    This endpoint forwards requests to any OpenAI-compatible API, bypassing
    browser CORS restrictions. Supports providers like:
    - SiliconFlow
    - OpenRouter
    - Together AI
    - Groq
    - DeepSeek
    - Any OpenAI-compatible endpoint
    """
    # Normalize base URL
    base_url = request.base_url.rstrip("/")
    if not base_url.endswith("/chat/completions"):
        endpoint = f"{base_url}/chat/completions"
    else:
        endpoint = base_url
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {request.api_key}",
    }
    
    payload = {
        "model": request.model,
        "messages": request.messages,
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
        "stream": False,  # Always non-streaming for this endpoint
    }
    
    try:
        async with httpx.AsyncClient(timeout=600.0) as client:  # 10 min timeout
            response = await client.post(endpoint, json=payload, headers=headers)
            
            if response.status_code != 200:
                error_text = response.text[:500]  # Limit error text length
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"LLM API Error: {error_text}"
                )
            
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            model_used = data.get("model")
            usage = data.get("usage")
            
            return LLMProxyResponse(
                content=content,
                model=model_used,
                usage=usage,
            )
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="LLM API request timed out (>5 min)")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Network error: {str(exc)}")


@app.post("/api/llm/chat/stream")
async def llm_proxy_chat_stream(request: LLMProxyRequest):
    """
    Streaming proxy endpoint for OpenAI-compatible LLM APIs.
    Returns Server-Sent Events (SSE) stream.
    """
    base_url = request.base_url.rstrip("/")
    if not base_url.endswith("/chat/completions"):
        endpoint = f"{base_url}/chat/completions"
    else:
        endpoint = base_url
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {request.api_key}",
    }
    
    payload = {
        "model": request.model,
        "messages": request.messages,
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
        "stream": True,
    }
    
    async def generate():
        async with httpx.AsyncClient(timeout=600.0) as client:  # 10 min timeout
            async with client.stream("POST", endpoint, json=payload, headers=headers) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    yield f"data: {json.dumps({'error': error_text.decode()[:500]})}\n\n"
                    return
                    
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        yield f"{line}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


# =============================================================================


@app.get("/health")
def health_check() -> dict[str, str]:
    """Simple readiness probe."""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat() + "Z"}


@app.post("/render", response_model=RenderResponse)
def render_plot(request: RenderRequest) -> RenderResponse:
    """Execute the submitted matplotlib code inside an isolated worker."""
    code = request.code.strip()
    if not code:
        raise HTTPException(status_code=422, detail="Submitted code is empty.")

    artifact_id = uuid.uuid4().hex
    worker_script = _build_worker_script(request)

    try:
        png_b64, svg_b64, logs, error_flag = _run_worker_script(worker_script, request.timeout)
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail="Renderer timed out.") from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail="Python interpreter not available.") from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    _persist_artifacts(artifact_id, worker_script, png_b64, logs)

    return RenderResponse(
        base64_png=png_b64,
        base64_svg=svg_b64,
        logs=logs,
        error=error_flag,
        artifact_id=artifact_id,
    )


def _resolve_python_binary() -> str:
    """Return the interpreter used to execute user code."""
    if sys.executable:
        return sys.executable
    for candidate in ("python3", "python"):
        path = shutil.which(candidate)
        if path:
            return path
    raise FileNotFoundError("Unable to locate a Python interpreter")


def _build_worker_script(req: RenderRequest) -> str:
    """Create an isolated worker script that runs the user plot code."""
    safe_code_literal = repr(req.code.replace("\r\n", "\n"))
    return textwrap.dedent(
        f"""
        import base64
        import io
        import json
        import sys
        import textwrap
        import traceback
        import warnings
        from contextlib import redirect_stdout, redirect_stderr

        # Suppress font warnings
        warnings.filterwarnings("ignore", message=".*Glyph.*missing from.*")
        warnings.filterwarnings("ignore", message=".*FigureCanvasAgg is non-interactive.*")
        warnings.filterwarnings("ignore", message=".*font cache.*")

        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas
        from matplotlib import _pylab_helpers
        import numpy as np
        import pandas as pd
        import scipy

        # Configure matplotlib to use fonts with better Unicode support
        plt.rcParams["font.family"] = ["DejaVu Sans", "sans-serif"]
        plt.rcParams["mathtext.fontset"] = "dejavusans"
        plt.rcParams["figure.figsize"] = ({req.width}, {req.height})
        plt.rcParams["figure.dpi"] = {req.dpi}
        plt.rcParams["savefig.facecolor"] = "white"
        plt.rcParams["figure.facecolor"] = "white"

        namespace = {{
            "__builtins__": __builtins__,
            "__name__": "__main__",
            "__file__": "student_code.py",
            "__package__": None,
            "plt": plt,
            "np": np,
            "pd": pd,
            "scipy": scipy,
        }}

        user_code = {safe_code_literal}

        log_stream = io.StringIO()
        payload = {{"png": None, "svg": None, "logs": "", "error": None}}

        with redirect_stdout(log_stream), redirect_stderr(log_stream):
            try:
                # Prevent user code from closing/clearing figures right before we capture them.
                def _noop(*args, **kwargs):
                    return None
                plt.close = _noop
                plt.clf = _noop
                plt.cla = _noop

                exec(compile(user_code, "student_code.py", "exec"), namespace)

                managers = _pylab_helpers.Gcf.get_all_fig_managers()
                fig = managers[-1].canvas.figure if managers else plt.gcf()
                if not fig.axes:
                    entry_points = [
                        "create_plot",
                        "create_figure",
                        "create_replication",
                        "build_plot",
                        "build_figure",
                        "generate_plot",
                        "main",
                    ]
                    for name in entry_points:
                        fn = namespace.get(name)
                        if not callable(fn):
                            continue
                        try:
                            candidate = fn()
                        except TypeError:
                            continue
                        if candidate is not None:
                            if hasattr(candidate, "axes") and candidate.axes:
                                fig = candidate
                                break
                            if isinstance(candidate, (list, tuple)):
                                for item in candidate:
                                    if hasattr(item, "axes") and item.axes:
                                        fig = item
                                        break
                                if fig.axes:
                                    break
                        fig = plt.gcf()
                        if fig.axes:
                            break

                if not fig.axes:
                    ax = fig.add_subplot(111)
                    ax.set_axis_off()
                    ax.text(0.5, 0.55, "No plot was generated", ha="center", va="center", fontsize=14)

                # Some student code sets tick formatters that may throw (e.g., int(NaN)) during draw.
                # Wrap FuncFormatter callbacks to prevent the whole render from crashing.
                import matplotlib.ticker as mticker
                formatter_errors = []

                def _wrap_formatter(formatter):
                    if isinstance(formatter, mticker.FuncFormatter):
                        original = formatter.func

                        def _safe(value, pos=None):
                            try:
                                return original(value, pos)
                            except Exception as exc:
                                if not formatter_errors:
                                    formatter_errors.append(
                                        "FORMATTER_ERROR suppressed: "
                                        + exc.__class__.__name__
                                        + ": "
                                        + str(exc)
                                    )
                                return ""

                        return mticker.FuncFormatter(_safe)
                    return formatter

                for ax in fig.axes:
                    ax.xaxis.set_major_formatter(_wrap_formatter(ax.xaxis.get_major_formatter()))
                    ax.xaxis.set_minor_formatter(_wrap_formatter(ax.xaxis.get_minor_formatter()))
                    ax.yaxis.set_major_formatter(_wrap_formatter(ax.yaxis.get_major_formatter()))
                    ax.yaxis.set_minor_formatter(_wrap_formatter(ax.yaxis.get_minor_formatter()))

                # Detect near-blank renders (e.g., code ran but produced an empty canvas)
                canvas = FigureCanvas(fig)
                canvas.draw()
                rgba = np.asarray(canvas.buffer_rgba())
                # Use RGB only; ignore alpha. Stddev close to 0 => near-uniform image.
                rgb = rgba[..., :3]
                pixel_std = float(rgb.std())
                h, w, _ = rgb.shape
                y0, y1 = int(h * 0.2), int(h * 0.8)
                x0, x1 = int(w * 0.2), int(w * 0.8)
                center_std = float(rgb[y0:y1, x0:x1].std()) if (y1 > y0 and x1 > x0) else pixel_std

                buffer = io.BytesIO()
                fig.savefig(buffer, format="png", bbox_inches="tight")
                payload["png"] = base64.b64encode(buffer.getvalue()).decode("utf-8")
                
                # Also save as SVG
                svg_buffer = io.BytesIO()
                fig.savefig(svg_buffer, format="svg", bbox_inches="tight")
                payload["svg"] = base64.b64encode(svg_buffer.getvalue()).decode("utf-8")

                if pixel_std < 2.0 or center_std < 2.0:
                    payload["error"] = "BLANK_PLOT"
                    _base_logs = log_stream.getvalue()
                    if formatter_errors:
                        _base_logs = _base_logs + "\\n" + formatter_errors[0]
                    payload["logs"] = _base_logs + "\\nBLANK_PLOT_DETECTED pixel_std={{:.4f}} center_std={{:.4f}}".format(pixel_std, center_std)
            except Exception:
                payload["error"] = "EXECUTION_ERROR"
                tb = traceback.format_exc()
                payload["logs"] = log_stream.getvalue() + "\\n" + tb

                # Always return a PNG so the UI never shows an empty canvas.
                fig = plt.figure()
                ax = fig.add_subplot(111)
                ax.set_axis_off()
                header = "EXECUTION_ERROR (rendered placeholder)"
                # Keep message short enough to be readable in the UI.
                tail = "\\n".join(tb.strip().splitlines()[-18:])
                msg = header + "\\n\\n" + tail
                msg = textwrap.fill(msg, width=88, replace_whitespace=False, drop_whitespace=False)
                ax.text(
                    0.02,
                    0.98,
                    msg,
                    ha="left",
                    va="top",
                    fontsize=10,
                    family="monospace",
                    color="#b91c1c",
                    transform=ax.transAxes,
                )
                buffer = io.BytesIO()
                fig.savefig(buffer, format="png", bbox_inches="tight")
                payload["png"] = base64.b64encode(buffer.getvalue()).decode("utf-8")
            else:
                payload["logs"] = log_stream.getvalue() + ("\\n" + formatter_errors[0] if formatter_errors else "")

        print(json.dumps(payload))
        sys.exit(0 if payload["error"] is None else 1)
        """
    ).strip()


def _run_worker_script(script: str, timeout: float) -> Tuple[Optional[str], Optional[str], str, Optional[str]]:
    """Run the generated worker script and capture its output.
    
    Returns: (png_b64, svg_b64, logs, error)
    """
    python_bin = _resolve_python_binary()
    with tempfile.TemporaryDirectory(prefix="plotcouncil-worker-") as tmpdir:
        worker_path = Path(tmpdir) / "worker.py"
        worker_path.write_text(script, encoding="utf-8")
        mpl_dir = Path(tmpdir) / "mpl"
        mpl_dir.mkdir(parents=True, exist_ok=True)

        env = os.environ.copy()
        env["MPLCONFIGDIR"] = str(mpl_dir)

        proc = subprocess.run(
            [python_bin, str(worker_path)],
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env,
        )

    stdout = proc.stdout.strip()
    stderr = proc.stderr.strip()
    if not stdout:
        raise RuntimeError(f"Renderer produced no output. stderr={stderr}")

    payload_text = stdout.splitlines()[-1]
    try:
        payload = json.loads(payload_text)
    except json.JSONDecodeError as exc:  # pragma: no cover
        raise RuntimeError(f"Invalid renderer payload: {payload_text}") from exc

    logs = payload.get("logs") or ""
    if stderr:
        logs = (logs + ("\n" if logs else "") + stderr)

    return payload.get("png"), payload.get("svg"), logs, payload.get("error")


def _persist_artifacts(artifact_id: str, worker_code: str, png_b64: Optional[str], logs: str) -> None:
    """Store the worker script, logs, and latest PNG for debugging."""
    artifact_dir = ARTIFACT_ROOT / artifact_id
    artifact_dir.mkdir(parents=True, exist_ok=True)

    (artifact_dir / "worker.py").write_text(worker_code, encoding="utf-8")
    (artifact_dir / "logs.txt").write_text(logs or "", encoding="utf-8")

    if png_b64:
        (artifact_dir / "plot.png").write_bytes(base64.b64decode(png_b64))
