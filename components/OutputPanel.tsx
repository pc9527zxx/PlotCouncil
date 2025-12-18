import React, { useState, memo, useCallback } from 'react';
import { AnalysisStatus, PlotImage, PlotSnapshot } from '../types';
import { Download, ZoomIn, ZoomOut, Maximize2, Eye, EyeOff, Loader2, Terminal, Layers, Gavel, CheckCircle2, CheckCircle, ArrowRight, Image as ImageIcon, RefreshCw, FileImage, FileCode, History } from 'lucide-react';
import { PyodidePlot } from './PyodidePlot';
import { ToastType } from './Toast';

// Agent Step Component for the workflow pipeline
const AgentStep: React.FC<{
  name: string;
  icon: React.ReactNode;
  isActive: boolean;
  isComplete: boolean;
  colorClass: 'indigo' | 'amber' | 'orange' | 'yellow' | 'purple' | 'violet';
}> = ({ name, icon, isActive, isComplete, colorClass }) => {
  const colorMap = {
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-700' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-700' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-700' },
    yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-200 dark:border-yellow-700' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-700' },
    violet: { bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-700' },
  };
  const colors = colorMap[colorClass];
  
  if (isActive) {
    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded-md font-bold border ${colors.bg} ${colors.text} ${colors.border}`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span className="whitespace-nowrap">{name}</span>
      </div>
    );
  }
  
  if (isComplete) {
    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${colors.bg} ${colors.text} opacity-70`}>
        <CheckCircle className="w-3 h-3" />
        <span className="whitespace-nowrap">{name}</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-md text-slate-400 dark:text-slate-600">
      {icon}
      <span className="whitespace-nowrap">{name}</span>
    </div>
  );
};

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
  plotHistory?: PlotSnapshot[];
}

export const OutputPanel: React.FC<OutputPanelProps> = memo(({
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
  codeIteration = 0,
  plotHistory = []
}) => {
  const [overlayOpacity, setOverlayOpacity] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRenderRunning, setIsRenderRunning] = useState(false);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);  // null = current

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
         <div className="flex items-center gap-2">
           <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
             <ImageIcon className="w-3.5 h-3.5" /> Generated Output
           </span>
           
           {/* History Selector - like Code version selector */}
           {plotHistory.length > 0 && (
             <>
               <span className="text-slate-300 dark:text-zinc-600">|</span>
               <History className="w-3.5 h-3.5 text-slate-400" />
               <select
                 value={selectedHistoryIndex ?? ''}
                 onChange={(e) => {
                   const val = e.target.value;
                   setSelectedHistoryIndex(val === '' ? null : parseInt(val));
                 }}
                 className="text-[10px] bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded px-2 py-1 text-slate-600 dark:text-slate-300 cursor-pointer min-w-[100px]"
               >
                 <option value="">当前图片</option>
                 {plotHistory.map((snapshot, idx) => {
                   const time = new Date(snapshot.created).toLocaleTimeString('zh-CN', {
                     hour: '2-digit',
                     minute: '2-digit',
                     second: '2-digit',
                   });
                   return (
                     <option key={snapshot.id} value={idx}>
                       v{idx + 1} ({time})
                     </option>
                   );
                 })}
               </select>
             </>
           )}
         </div>
         
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
           ) : selectedHistoryIndex !== null && plotHistory[selectedHistoryIndex] ? (
              // Show historical image
              <div 
                className="relative transition-transform duration-200 ease-out origin-center select-none w-full h-full flex items-center justify-center"
                style={{ transform: `scale(${zoomLevel})` }}
              >
                <img 
                  src={`data:image/png;base64,${plotHistory[selectedHistoryIndex].base64}`}
                  alt={`History v${selectedHistoryIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
                {/* Version indicator */}
                <div className="absolute top-2 left-2 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1">
                  <History className="w-3 h-3" />
                  v{selectedHistoryIndex + 1} - 历史版本
                </div>
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

      {/* 3. Footer: Workflow Status - Six Agent Pipeline */}
      <div className="h-9 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center px-3 gap-1 text-[10px] select-none shrink-0 z-30 overflow-x-auto no-scrollbar">
         {/* Student (Generator) */}
         <AgentStep 
           name="Student" 
           icon={<Terminal className="w-3 h-3" />}
           isActive={status === AnalysisStatus.ANALYZING || status === AnalysisStatus.REFINING}
           isComplete={!([AnalysisStatus.IDLE, AnalysisStatus.ANALYZING].includes(status))}
           colorClass="indigo"
         />
         <ArrowRight className="w-2.5 h-2.5 text-slate-200 dark:text-zinc-700 shrink-0" />
         
         {/* Dr.Style */}
         <AgentStep 
           name="Dr.Style" 
           icon={<Layers className="w-3 h-3" />}
           isActive={status === AnalysisStatus.TEACHER_STYLE_REVIEW}
           isComplete={[AnalysisStatus.TEACHER_LAYOUT_REVIEW, AnalysisStatus.TEACHER_DATA_REVIEW, AnalysisStatus.CHAIR_QA, AnalysisStatus.CHAIR_STRATEGY, AnalysisStatus.SUCCESS, AnalysisStatus.REFINING].includes(status)}
           colorClass="amber"
         />
         <ArrowRight className="w-2.5 h-2.5 text-slate-200 dark:text-zinc-700 shrink-0" />
         
         {/* Dr.Layout */}
         <AgentStep 
           name="Dr.Layout" 
           icon={<Layers className="w-3 h-3" />}
           isActive={status === AnalysisStatus.TEACHER_LAYOUT_REVIEW}
           isComplete={[AnalysisStatus.TEACHER_DATA_REVIEW, AnalysisStatus.CHAIR_QA, AnalysisStatus.CHAIR_STRATEGY, AnalysisStatus.SUCCESS, AnalysisStatus.REFINING].includes(status)}
           colorClass="orange"
         />
         <ArrowRight className="w-2.5 h-2.5 text-slate-200 dark:text-zinc-700 shrink-0" />
         
         {/* Dr.Data */}
         <AgentStep 
           name="Dr.Data" 
           icon={<Layers className="w-3 h-3" />}
           isActive={status === AnalysisStatus.TEACHER_DATA_REVIEW}
           isComplete={[AnalysisStatus.CHAIR_QA, AnalysisStatus.CHAIR_STRATEGY, AnalysisStatus.SUCCESS, AnalysisStatus.REFINING].includes(status)}
           colorClass="yellow"
         />
         <ArrowRight className="w-2.5 h-2.5 text-slate-200 dark:text-zinc-700 shrink-0" />
         
         {/* Chair QA */}
         <AgentStep 
           name="Chair QA" 
           icon={<Gavel className="w-3 h-3" />}
           isActive={status === AnalysisStatus.CHAIR_QA}
           isComplete={[AnalysisStatus.CHAIR_STRATEGY, AnalysisStatus.SUCCESS, AnalysisStatus.REFINING].includes(status)}
           colorClass="purple"
         />
         <ArrowRight className="w-2.5 h-2.5 text-slate-200 dark:text-zinc-700 shrink-0" />
         
         {/* Chair Strategy */}
         <AgentStep 
           name="Chair Strategy" 
           icon={<Gavel className="w-3 h-3" />}
           isActive={status === AnalysisStatus.CHAIR_STRATEGY}
           isComplete={status === AnalysisStatus.SUCCESS}
           colorClass="violet"
         />
         
         <div className="flex-1" />
         {isDone && (
            <div className="flex items-center gap-1.5 text-emerald-600 font-bold px-3 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-full border border-emerald-100 dark:border-emerald-800">
               <CheckCircle2 className="w-3.5 h-3.5" />
               <span>Done</span>
            </div>
         )}
      </div>
    </div>
  );
});

OutputPanel.displayName = 'OutputPanel';
