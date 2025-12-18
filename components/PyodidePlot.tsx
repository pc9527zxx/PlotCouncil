import React, { useEffect, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";

interface BackendPlotProps {
  code: string;
  autorun?: boolean;
  initialImageBase64?: string | null;
  initialSvgBase64?: string | null;
  initialLogs?: string;
  initialError?: string;
  refreshTrigger?: number;
  onRenderComplete?: (base64Image: string, logs: string, svgBase64?: string) => void;
  onRuntimeError?: (error: string, logs: string) => void;
  onStatusChange?: (status: "idle" | "running" | "error" | "success") => void;
}

const getRenderEndpoint = () => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env.VITE_RENDER_API_URL || "/render";
    }
  } catch (e) {
    // ignore errors
  }
  return "/render";
};

const RENDER_ENDPOINT = getRenderEndpoint();

type RenderStatus = "idle" | "running" | "error" | "success";

export const PyodidePlot: React.FC<BackendPlotProps> = ({
  code,
  autorun = true,
  initialImageBase64 = null,
  initialSvgBase64 = null,
  initialLogs = "",
  initialError = "",
  refreshTrigger = 0,
  onRenderComplete,
  onRuntimeError,
  onStatusChange
}) => {
  const [status, setStatus] = useState<RenderStatus>("idle");
  const [imageBase64, setImageBase64] = useState<string | null>(initialImageBase64);
  const [svgBase64, setSvgBase64] = useState<string | null>(initialSvgBase64);
  const isRenderingRef = React.useRef(false);  // Prevent duplicate renders
  const lastCodeRef = React.useRef<string>("");  // Track last rendered code

  // Notify parent of status changes
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  // Sync initial props (e.g. switching projects or re-running analysis)
  useEffect(() => {
    setImageBase64(initialImageBase64);
    setSvgBase64(initialSvgBase64);
    setStatus(initialError ? "error" : (initialImageBase64 ? "success" : "idle"));
    
    // 当 initialImageBase64 被清除时（重新分析），重置 lastCodeRef 以允许重新渲染相同代码
    if (initialImageBase64 === null) {
      lastCodeRef.current = "";
    }
  }, [initialImageBase64, initialSvgBase64, initialError]);

  const runBackendRender = async () => {
    if (!code.trim()) return;
    
    // Prevent duplicate renders
    if (isRenderingRef.current) {
      console.log('[PyodidePlot] Skipped - already rendering');
      return;
    }
    
    // Skip if code hasn't changed (unless it's a manual refresh)
    if (code === lastCodeRef.current && refreshTrigger === 0) {
      console.log('[PyodidePlot] Skipped - same code');
      return;
    }
    
    isRenderingRef.current = true;
    lastCodeRef.current = code;
    setStatus("running");

    // 3 minute timeout for rendering
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    try {
      const response = await fetch(RENDER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, timeout: 120 }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type") || "";
      let payload: any = null;
      let rawText: string | null = null;

      if (contentType.includes("application/json")) {
        payload = await response.json();
      } else {
        rawText = await response.text();
      }

      if (!payload) {
        const hint = `Renderer endpoint did not return JSON. Is the FastAPI server running and is VITE_RENDER_API_URL set correctly? (endpoint: ${RENDER_ENDPOINT})`;
        const snippet = rawText ? rawText.slice(0, 400) : "";
        const errMsg = snippet ? `${hint}\n---\n${snippet}` : hint;
        setStatus("error");
        onRuntimeError?.(errMsg, "");
        return;
      }

      const combinedLogs = payload?.logs ?? "";
      const resultBase64 = payload?.base64_png;
      const resultSvgBase64 = payload?.base64_svg;
      
      if (resultBase64) {
        setImageBase64(resultBase64);
      } else {
        setImageBase64(null);
      }
      
      if (resultSvgBase64) {
        setSvgBase64(resultSvgBase64);
      } else {
        setSvgBase64(null);
      }

      if (!response.ok || payload?.error || !resultBase64) {
        const errMsg = payload?.error || (resultBase64 ? `Render failed with status ${response.status}` : "Renderer responded without an image.");
        setStatus("error");
        onRuntimeError?.(errMsg, combinedLogs);
        return;
      }

      setStatus("success");
      onRenderComplete?.(resultBase64, combinedLogs, resultSvgBase64);
    } catch (err: any) {
      clearTimeout(timeoutId);
      let message = err?.message || "Renderer call failed.";
      if (err.name === 'AbortError') {
        message = "Rendering timed out (>3 min). The code may be too complex or stuck in an infinite loop.";
      }
      setStatus("error");
      onRuntimeError?.(message, "");
    } finally {
      isRenderingRef.current = false;  // Release the lock
    }
  };

  // Run on mount (if autorun) or code change
  useEffect(() => {
    if (autorun && code.trim()) {
      runBackendRender();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Run on explicit refresh trigger
  useEffect(() => {
    if (refreshTrigger > 0) {
      runBackendRender();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  if (status === "running") {
    // Transparent loading state that fills container
    return (
      <div className="w-full h-full flex flex-col items-center justify-center animate-pulse">
         <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
         <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Rendering Plot...</p>
      </div>
    );
  }

  if (status === "error") {
    // Error state - show a subtle indicator, details are in Logs tab
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
         <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mb-2">
            <AlertCircle className="w-5 h-5 text-rose-400" />
         </div>
         <p className="text-xs text-slate-400 dark:text-slate-500">
           查看右侧 Logs 面板获取详情
         </p>
      </div>
    );
  }

  if (imageBase64) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <img
          src={`data:image/png;base64,${imageBase64}`}
          alt="Rendered scientific plot"
          className="max-w-full max-h-full object-contain shadow-lg"
        />
      </div>
    );
  }

  // Idle / No Data
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
       <p className="text-sm">Ready to render.</p>
    </div>
  );
};