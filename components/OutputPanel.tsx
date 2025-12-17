import React, { useState } from 'react';
import { AnalysisStatus, PlotImage } from '../types';
import { Download, ZoomIn, ZoomOut, Maximize2, Eye, EyeOff, Loader2, Terminal, Layers, Gavel, CheckCircle2, ArrowRight, Image as ImageIcon, RefreshCw, FileImage, FileCode } from 'lucide-react';
import { PyodidePlot } from './PyodidePlot';
import { ToastType } from './Toast';

interface OutputPanelProps {
  status: AnalysisStatus;
  generatedPlotBase64?: string | null;
  generatedSvgBase64?: string | null;
  setGeneratedPlotBase64?: any;
  setGeneratedSvgBase64?: any;
  renderLogs?: string;
  setRenderLogs?: any;
  renderError?: string;
  setRenderError?: any;
  onPlotRendered?: (base64Png: string, svgBase64?: string) => void;
  onPlotRuntimeError?: (errorText: string) => void;
  pythonCode: string;
  selectedImage: PlotImage | null;
  onShowToast: (msg: string, type: ToastType) => void;
  projectName?: string;
  codeIteration?: number;
}

export const OutputPanel: React.FC<OutputPanelProps> = ({
  status,
  generatedPlotBase64,
  generatedSvgBase64,
  setGeneratedPlotBase64,
  setGeneratedSvgBase64,
  renderLogs,
  setRenderLogs,
  renderError,
  setRenderError,
  onPlotRendered,
  onPlotRuntimeError,
  pythonCode,
  selectedImage,
  onShowToast,
  projectName = 'plot',
  codeIteration = 0
}) => {
  const [overlayOpacity, setOverlayOpacity] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRenderRunning, setIsRenderRunning] = useState(false);

  // Workflow State Helpers
  const isGen = status === AnalysisStatus.ANALYZING || status === AnalysisStatus.REFINING;
  const isReview = status.includes('TEACHER');
  const isChair = status.includes('CHAIR');
  const isDone = status === AnalysisStatus.SUCCESS;

  // Generate filename with timestamp and iteration
  const generateFilename = (ext: 'png' | 'svg' | 'py') => {
    const safeName = projectName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').slice(0, 30);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const iteration = codeIteration > 0 ? `_v${codeIteration}` : '';
    return `${safeName}${iteration}_${timestamp}.${ext}`;
  };

  const downloadPng = () => {
    if (!generatedPlotBase64) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${generatedPlotBase64}`;
    link.download = generateFilename('png');
    link.click();
    onShowToast("PNG image downloaded", "success");
  };

  const downloadSvg = () => {
    if (!generatedSvgBase64) return;
    const link = document.createElement('a');
    // SVG is base64 encoded, decode it
    const svgData = atob(generatedSvgBase64);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    link.href = URL.createObjectURL(blob);
    link.download = generateFilename('svg');
    link.click();
    onShowToast("SVG image downloaded", "success");
  };

  const downloadCode = () => {
    if (!pythonCode) return;
    const blob = new Blob([pythonCode], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = generateFilename('py');
    link.click();
    onShowToast("Python script downloaded", "success");
  };

  const handleRerun = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Global loading state (Analysis OR Rendering)
  const isGlobalLoading = status === AnalysisStatus.ANALYZING || status === AnalysisStatus.REFINING || isRenderRunning;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
      
      {/* 1. Header */}
      <div className="flex-shrink-0 h-10 flex items-center justify-between px-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
         <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
           <ImageIcon className="w-3.5 h-3.5" /> Generated Output
         </span>
         
         {/* Mini Toolbar */}
         <div className="flex items-center gap-2">
            {pythonCode && (
               <button 
                 onClick={handleRerun}
                 disabled={isRenderRunning}
                 className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold transition-colors
                   ${isRenderRunning 
                     ? 'bg-indigo-50 text-indigo-400 cursor-wait' 
                     : 'bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200'}
                 `}
                 title="Rerun Code"
               >
                 {isRenderRunning ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>}
                 <span>Rerun</span>
               </button>
            )}
            
            {/* Download Buttons */}
            {generatedPlotBase64 && (
              <div className="flex items-center gap-0.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-md px-1">
                <button 
                  onClick={downloadPng} 
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1" 
                  title="Download PNG"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-semibold">PNG</span>
                </button>
                {generatedSvgBase64 && (
                  <button 
                    onClick={downloadSvg} 
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded text-slate-500 hover:text-emerald-600 transition-colors flex items-center gap-1" 
                    title="Download SVG"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-semibold">SVG</span>
                  </button>
                )}
                <button 
                  onClick={downloadCode} 
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded text-slate-500 hover:text-amber-600 transition-colors flex items-center gap-1 border-l border-slate-200 dark:border-zinc-700 ml-1 pl-1.5" 
                  title="Download Python Script"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-semibold">.py</span>
                </button>
              </div>
            )}
         </div>
      </div>

      {/* 2. Main Canvas Area (FIX 2 & 4: White background + Skeleton) */}
      <div className="flex-1 flex flex-col min-h-0 relative group/canvas bg-white dark:bg-zinc-900 overflow-hidden">
        
        {/* Floating Controls */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex gap-2 opacity-0 group-hover/canvas:opacity-100 transition-opacity duration-200">
           <div className="flex items-center p-1 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md border border-slate-200 dark:border-zinc-700 rounded-lg shadow-sm">
              {generatedPlotBase64 && selectedImage && (
                <div className="flex items-center gap-2 pr-2 border-r border-slate-200 dark:border-zinc-700 mr-2">
                   <button 
                     onClick={() => setOverlayOpacity(overlayOpacity === 0 ? 0.5 : 0)}
                     className={`p-1.5 rounded-md transition-all ${overlayOpacity > 0 ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                     title="Toggle Reference Overlay"
                   >
                      {overlayOpacity > 0 ? <Eye className="w-3.5 h-3.5"/> : <EyeOff className="w-3.5 h-3.5"/>}
                   </button>
                   <input 
                      type="range" min="0" max="1" step="0.1" 
                      value={overlayOpacity}
                      onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                      className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                   />
                </div>
              )}
              <div className="flex items-center gap-0.5">
                <button onClick={() => setZoomLevel(z => Math.max(z - 0.1, 0.5))} className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded text-slate-500"><ZoomOut className="w-3.5 h-3.5" /></button>
                <span className="text-[9px] font-mono text-slate-400 w-8 text-center">{Math.round(zoomLevel * 100)}%</span>
                <button onClick={() => setZoomLevel(z => Math.min(z + 0.1, 3))} className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded text-slate-500"><ZoomIn className="w-3.5 h-3.5" /></button>
                <button onClick={() => setZoomLevel(1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded text-slate-500 ml-1 border-l border-slate-100 dark:border-zinc-700"><Maximize2 className="w-3.5 h-3.5" /></button>
              </div>
           </div>
        </div>

        {/* The Plot Itself */}
        <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
           {/* FIX 4: Full Size Skeleton for Initial Loading OR Code Execution */}
           {(status === AnalysisStatus.ANALYZING || status === AnalysisStatus.REFINING) && !pythonCode ? (
              <div className="w-full h-full bg-slate-100 dark:bg-zinc-800 rounded-xl animate-pulse flex flex-col items-center justify-center gap-3">
                 <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
                 <span className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Generating Visualization...</span>
              </div>
           ) : (
             <div 
               className="relative transition-transform duration-200 ease-out origin-center select-none w-full h-full flex items-center justify-center"
               style={{ transform: `scale(${zoomLevel})` }}
             >
                {/* Reference Image Overlay (Onion Skin) */}
                {selectedImage && (
                  <div 
                    className="absolute inset-0 z-20 pointer-events-none transition-opacity duration-150 flex items-center justify-center"
                    style={{ opacity: overlayOpacity }}
                  >
                    <img src={selectedImage.previewUrl} className="max-w-full max-h-full object-contain opacity-70" alt="Reference Overlay" />
                  </div>
                )}

                {pythonCode ? (
                  <PyodidePlot 
                    code={pythonCode}
                    refreshTrigger={refreshTrigger}
                    autorun={!!pythonCode && !generatedPlotBase64}
                    initialImageBase64={generatedPlotBase64}
                    initialSvgBase64={generatedSvgBase64}
                    initialLogs={renderLogs}
                    initialError={renderError}
                    onStatusChange={(s) => setIsRenderRunning(s === 'running')}
                    onRenderComplete={(base64, logs, svgBase64) => {
                      setGeneratedPlotBase64?.(base64);
                      setGeneratedSvgBase64?.(svgBase64 || null);
                      setRenderLogs?.(logs);
                      onPlotRendered?.(base64, svgBase64);
                    }}
                    onRuntimeError={(err, logs) => {
                      setRenderError?.(err);
                      setRenderLogs?.(logs);
                      onPlotRuntimeError?.(err + '\n' + logs);
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-300 dark:text-zinc-700">
                     <p className="text-sm font-medium">No output generated</p>
                  </div>
                )}
             </div>
           )}
        </div>
      </div>

      {/* 3. Footer: Workflow Status */}
      <div className="h-9 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center px-4 gap-3 text-[10px] select-none shrink-0 z-30 overflow-x-auto no-scrollbar">
         <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${isGen ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-100' : 'text-slate-400'}`}>
            {isGen ? <Loader2 className="w-3 h-3 animate-spin" /> : <Terminal className="w-3 h-3" />}
            <span>Generator</span>
         </div>
         <ArrowRight className="w-3 h-3 text-slate-200 dark:text-zinc-700" />
         <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${isReview ? 'bg-amber-50 text-amber-700 font-bold border border-amber-100' : 'text-slate-400'}`}>
            <Layers className="w-3 h-3" />
            <span>Review</span>
         </div>
         <ArrowRight className="w-3 h-3 text-slate-200 dark:text-zinc-700" />
         <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${isChair ? 'bg-purple-50 text-purple-700 font-bold border border-purple-100' : 'text-slate-400'}`}>
            <Gavel className="w-3 h-3" />
            <span>Chair</span>
         </div>
         <div className="flex-1" />
         {isDone && (
            <div className="flex items-center gap-1.5 text-emerald-600 font-bold px-3 py-0.5 bg-emerald-50 rounded-full border border-emerald-100">
               <CheckCircle2 className="w-3.5 h-3.5" />
               <span>Success</span>
            </div>
         )}
      </div>
    </div>
  );
};
