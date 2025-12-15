import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnalysisView } from './components/AnalysisView';
import { OutputPanel } from './components/OutputPanel';
import { ProjectSidebar } from './components/ProjectSidebar';
import { SourcePanel } from './components/SourcePanel';
import { SettingsModal } from './components/SettingsModal';
import { DocsPanel } from './components/DocsPanel';
import { Toast, ToastItem, ToastType } from './components/Toast';
import { analyzePlotImage, refinePlotAnalysis } from './services/geminiService';
import { PlotImage, AnalysisResult, AnalysisStatus, Project, PlotSnapshot } from './types';
import { 
  loadProjectsSnapshot, 
  migrateLegacyLocalStorageToIDB, 
  migrateLegacyIndexedDBToPlotCouncil,
  saveProjectsSnapshot, 
  createEmptyProject, 
  normalizePlotHistory 
} from './services/projectStore';
import { Layout, ChevronLeft, ChevronRight } from 'lucide-react';

const MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro', desc: 'Best for Precision' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Fast Speed' },
];
const RISK_LOOP_THRESHOLD = 0.6;
const STORAGE_KEYS = {
  apiKey: 'plotcouncil-api-key',
  model: 'plotcouncil-model',
  maxLoops: 'plotcouncil-max-loops',
};
const LEGACY_STORAGE_KEYS = {
  apiKey: 'sciplot-api-key',
  model: 'sciplot-model',
  maxLoops: 'sciplot-max-loops',
};

type RunMode = 'simple' | 'complex' | 'manual';
type ReviewPreset = 'lite' | 'full';

export default function App() {
  // Theme & Settings State
  const [darkMode, setDarkMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [model, setModel] = useState<string>(MODELS[0].id);

  // Layout State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Percentage
  // FIX 1 & 2: Default height reduced to 35% for Input Source
  const [sourcePanelHeight, setSourcePanelHeight] = useState(35); // Percentage of left panel
  const [isResizing, setIsResizing] = useState<'horizontal' | 'vertical' | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);

  // Toast State
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Project State
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');

  const [selectedImage, setSelectedImage] = useState<PlotImage | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [plotHistory, setPlotHistory] = useState<PlotSnapshot[]>([]);
  const [renderCount, setRenderCount] = useState(0);
  const [generatedPlotBase64, setGeneratedPlotBase64] = useState<string | null>(null);
  const [renderLogs, setRenderLogs] = useState('');
  const [renderError, setRenderError] = useState('');
  
  // Execution Config
  const [runMode, setRunMode] = useState<RunMode>('simple');
  const [reviewPreset, setReviewPreset] = useState<ReviewPreset>('lite');

  // Auto-Refine State
  const [autoRefineEnabled, setAutoRefineEnabled] = useState(false);
  const [isFirstPass, setIsFirstPass] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false); 
  const [maxAutoLoops, setMaxAutoLoops] = useState(2);
  const [loopBudget, setLoopBudget] = useState(0);
  const loopBudgetRef = useRef(0);
  const pendingAutoRef = useRef(false);
  const crashRecoveryUsedRef = useRef(false);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const updateLoopBudget = (value: number | ((prev: number) => number)) => {
    if (typeof value === 'function') {
      setLoopBudget(prev => {
        const next = (value as (prev: number) => number)(prev);
        loopBudgetRef.current = next;
        return next;
      });
    } else {
      loopBudgetRef.current = value;
      setLoopBudget(value);
    }
  };

  useEffect(() => {
    loopBudgetRef.current = loopBudget;
  }, [loopBudget]);

  const clampLoops = (value: number) => Math.max(0, Math.min(8, value));

  // Initialize
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Theme init
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }

    // Load persisted settings
    const storedApiKey = window.localStorage.getItem(STORAGE_KEYS.apiKey) 
      ?? window.localStorage.getItem(LEGACY_STORAGE_KEYS.apiKey);
    if (storedApiKey) setApiKey(storedApiKey);
    
    const storedModel = window.localStorage.getItem(STORAGE_KEYS.model) 
      ?? window.localStorage.getItem(LEGACY_STORAGE_KEYS.model);
    if (storedModel) setModel(storedModel);

    const storedLoops = window.localStorage.getItem(STORAGE_KEYS.maxLoops) 
      ?? window.localStorage.getItem(LEGACY_STORAGE_KEYS.maxLoops);
    if (storedLoops !== null) {
      const parsed = parseInt(storedLoops, 10);
      if (!Number.isNaN(parsed)) setMaxAutoLoops(clampLoops(parsed));
    }
  }, []);

  // Save Settings Persistently
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (apiKey) {
      window.localStorage.setItem(STORAGE_KEYS.apiKey, apiKey);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.apiKey);
    }
    window.localStorage.setItem(STORAGE_KEYS.model, model);
    window.localStorage.setItem(STORAGE_KEYS.maxLoops, String(maxAutoLoops));
    Object.values(LEGACY_STORAGE_KEYS).forEach(key => window.localStorage.removeItem(key));
  }, [apiKey, model, maxAutoLoops]);

  // Load projects
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === 'undefined') return;
      try {
        await migrateLegacyLocalStorageToIDB();
        await migrateLegacyIndexedDBToPlotCouncil();
        const snapshot = await loadProjectsSnapshot();
        const initialProjects = snapshot.projects.length ? snapshot.projects : [];
        
        if (initialProjects.length === 0) {
           if (cancelled) return;
           setProjects([]);
           setActiveProjectId('');
           return;
        }

        const initialActive = snapshot.activeProjectId && initialProjects.some(p => p.id === snapshot.activeProjectId)
          ? snapshot.activeProjectId
          : initialProjects[0].id;
        if (cancelled) return;

        setProjects(initialProjects);
        setActiveProjectId(initialActive);

        const active = initialProjects.find(p => p.id === initialActive) || initialProjects[0];
        setSelectedImage(active.selectedImage);
        setResult(active.result);
        setErrorMessage(active.errorMessage);
        const normalizedHistory = normalizePlotHistory(active.plotHistory);
        setPlotHistory(normalizedHistory);
        const maxSeq = normalizedHistory.reduce((acc, s) => Math.max(acc, s.seq || 0), 0);
        const normalizedRenderCount = typeof active.renderCount === 'number' && Number.isFinite(active.renderCount)
          ? Math.max(active.renderCount, maxSeq)
          : maxSeq;
        setRenderCount(normalizedRenderCount);
        setGeneratedPlotBase64(active.generatedPlotBase64 ?? null);
        setRenderLogs(typeof (active as any).renderLogs === 'string' ? (active as any).renderLogs : '');
        setRenderError(typeof (active as any).renderError === 'string' ? (active as any).renderError : '');
        setStatus(active.result ? AnalysisStatus.SUCCESS : AnalysisStatus.IDLE);
      } catch {
        if (cancelled) return;
        setProjects([]);
        setActiveProjectId('');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-save
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!activeProjectId) return;
    if (!projects.length) return;
    const handle = window.setTimeout(() => {
      saveProjectsSnapshot(projects, activeProjectId).catch(() => {});
    }, 250);
    return () => window.clearTimeout(handle);
  }, [projects, activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      return {
        ...p,
        selectedImage,
        result,
        errorMessage,
        plotHistory,
        renderCount,
        generatedPlotBase64,
        renderLogs,
        renderError,
        updatedAt: Date.now(),
      };
    }));
  }, [activeProjectId, selectedImage, result, errorMessage, plotHistory, renderCount, generatedPlotBase64, renderLogs, renderError]);

  const switchProject = (projectId: string) => {
    const next = projects.find(p => p.id === projectId);
    if (!next) return;
    setActiveProjectId(projectId);
    setSelectedImage(next.selectedImage);
    setResult(next.result);
    setErrorMessage(next.errorMessage);
    const normalizedHistory = normalizePlotHistory(next.plotHistory);
    setPlotHistory(normalizedHistory);
    const maxSeq = normalizedHistory.reduce((acc, s) => Math.max(acc, s.seq || 0), 0);
    const normalizedRenderCount = typeof next.renderCount === 'number' && Number.isFinite(next.renderCount)
      ? Math.max(next.renderCount, maxSeq)
      : maxSeq;
    setRenderCount(normalizedRenderCount);
    setGeneratedPlotBase64(next.generatedPlotBase64 ?? null);
    setRenderLogs(typeof (next as any).renderLogs === 'string' ? (next as any).renderLogs : '');
    setRenderError(typeof (next as any).renderError === 'string' ? (next as any).renderError : '');
    setStatus(next.result ? AnalysisStatus.SUCCESS : AnalysisStatus.IDLE);
    setIsFirstPass(false);
    updateLoopBudget(0);
    crashRecoveryUsedRef.current = false;
  };

  const createNewProject = () => {
    const nextIndex = projects.length + 1;
    const project = createEmptyProject(`Project ${nextIndex}`);
    setProjects(prev => [project, ...prev]);
    switchProject(project.id);
    addToast('New project created', 'success');
  };

  const renameProject = (projectId: string, name: string) => {
    const nextName = name.trim();
    if (!nextName) return;
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      if (p.name === nextName) return p;
      return { ...p, name: nextName };
    }));
    addToast('Project renamed', 'success');
  };

  const handleImageSelected = (image: PlotImage | null) => {
    setSelectedImage(image);
    if (!image) {
      setStatus(AnalysisStatus.IDLE);
      setResult(null);
      setErrorMessage('');
      setPlotHistory([]);
      setRenderCount(0);
      setGeneratedPlotBase64(null);
      setRenderLogs('');
      setRenderError('');
      setIsFirstPass(false);
      updateLoopBudget(0);
      crashRecoveryUsedRef.current = false;
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage) {
        addToast("Please upload an image first", "error");
        return;
    }

    setStatus(AnalysisStatus.ANALYZING);
    setErrorMessage('');
    setResult(null);
    crashRecoveryUsedRef.current = false;
    
    const initialBudget = runMode === 'simple' 
      ? 0 
      : (runMode === 'complex' ? 1 : maxAutoLoops);
      
    updateLoopBudget(initialBudget);
    
    setIsFirstPass(runMode !== 'simple'); 
    setAutoRefineEnabled(runMode !== 'simple');
    
    setIsCapturing(false);

    try {
      const analysisData = await analyzePlotImage(
        selectedImage.base64, 
        selectedImage.mimeType,
        model,
        apiKey || undefined,
        (newStatus) => setStatus(newStatus)
      );
      setResult(analysisData);
      setStatus(AnalysisStatus.SUCCESS); 
      addToast("Code generated successfully", "success");
    } catch (e: any) {
      console.error("App Level Error:", e);
      setStatus(AnalysisStatus.ERROR);
      setErrorMessage(e.message || "Unknown error occurred.");
      addToast(e.message || "Analysis failed", "error");
      setIsFirstPass(false);
    }
  };

  const handleRefine = async (feedbackType: 'image' | 'error', data: string, mimeType?: string) => {
    if (!selectedImage || !result) return;
    
    const codeMatch = result.markdown.match(/```python([\s\S]*?)```/);
    const currentCode = codeMatch ? codeMatch[1].trim() : (result.markdown.includes('import matplotlib') ? result.markdown : '');
    const triggeredByAuto = pendingAutoRef.current;

    setStatus(reviewPreset === 'lite' ? AnalysisStatus.CHAIR_QA : AnalysisStatus.TEACHER_STYLE_REVIEW);
    setErrorMessage('');

    try {
      const refinedData = await refinePlotAnalysis(
        selectedImage.base64,
        selectedImage.mimeType,
        currentCode,
        { type: feedbackType, data, mimeType },
        model,
        apiKey || undefined,
        (newStatus) => setStatus(newStatus),
        { preset: reviewPreset }
      );
      // Refresh downstream render with new code
      setGeneratedPlotBase64(null);
      setRenderLogs('');
      setRenderError('');

      setResult(refinedData);
      setStatus(AnalysisStatus.SUCCESS);
      const riskValue = refinedData.riskScore;
      const effectiveRisk = typeof riskValue === 'number' && Number.isFinite(riskValue)
        ? riskValue
        : (refinedData.qaStatus === 'NEEDS_REVISION' ? 1 : 0);
      const shouldAutoLoop = autoRefineEnabled 
        && triggeredByAuto 
        && loopBudgetRef.current > 0
        && effectiveRisk > RISK_LOOP_THRESHOLD;
      if (shouldAutoLoop) {
        setIsFirstPass(true);
      } else {
        setIsFirstPass(false);
        updateLoopBudget(0);
      }
    } catch (e: any) {
      console.error("Refinement Error:", e);
      setStatus(AnalysisStatus.ERROR);
      setErrorMessage(e.message || "Refinement failed.");
      addToast("Refinement failed", "error");
    } finally {
      pendingAutoRef.current = false;
    }
  };

  // Callbacks for Automation
  const handleAutoRefinementTrigger = async (renderedImageBase64: string) => {
    if (runMode === 'simple') return;
    
    if (!apiKey) return;
    if (!autoRefineEnabled || !isFirstPass || !selectedImage || !result || loopBudgetRef.current <= 0) return;
    
    setIsFirstPass(false); 
    setIsCapturing(true); 
    addToast(`Auto-refining... (${loopBudgetRef.current} loops left)`, "info");
    
    setTimeout(async () => {
        pendingAutoRef.current = true;
        updateLoopBudget(prev => Math.max(prev - 1, 0));
        try {
          await handleRefine('image', renderedImageBase64, 'image/png');
        } finally {
          setIsCapturing(false);
        }
    }, 800);
  };

  const handleAutoRefinementErrorTrigger = async (errorText: string) => {
    if (runMode === 'simple') return;

    if (!apiKey) return;
    if (!autoRefineEnabled || !isFirstPass || !selectedImage || !result || loopBudgetRef.current <= 0) return;
    setIsFirstPass(false); 
    setIsCapturing(true);
    pendingAutoRef.current = true;
    updateLoopBudget(prev => Math.max(prev - 1, 0));
    try {
      await handleRefine('error', errorText);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCrashRecoveryOnce = async (errorText: string) => {
    if (!selectedImage || !result) return;
    if (!apiKey) return;
    if (crashRecoveryUsedRef.current) return;
    crashRecoveryUsedRef.current = true;
    setIsCapturing(true);
    pendingAutoRef.current = true;
    try {
      await handleRefine('error', errorText);
    } finally {
      setIsCapturing(false);
    }
  };

  // --- Resizing Logic ---
  const handleMouseDown = (type: 'horizontal' | 'vertical') => (e: React.MouseEvent) => {
    setIsResizing(type);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !mainRef.current) return;
      
      if (isResizing === 'horizontal') {
        const containerRect = mainRef.current.getBoundingClientRect();
        const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        const constrainedWidth = Math.max(20, Math.min(80, newWidth));
        setLeftPanelWidth(constrainedWidth);
      } else if (isResizing === 'vertical' && leftColRef.current) {
        const containerRect = leftColRef.current.getBoundingClientRect();
        const newHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100;
        const constrainedHeight = Math.max(20, Math.min(80, newHeight));
        setSourcePanelHeight(constrainedHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(null);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const isWorkflowBusy = status === AnalysisStatus.ANALYZING || status === AnalysisStatus.REFINING || isCapturing;

  // Extract python code for OutputPanel
  const currentPythonCode = React.useMemo(() => {
    if (!result?.markdown) return '';
    const match = result.markdown.match(/```python([\s\S]*?)```/i);
    return match ? match[1].trim() : (result.markdown.includes('import matplotlib') ? result.markdown : '');
  }, [result]);

  return (
    // FIX 1: h-screen and overflow-hidden on root
    <div className={`h-screen w-screen overflow-hidden font-sans flex ${darkMode ? 'dark bg-zinc-950 text-slate-200' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Toast Layer */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast {...toast} onClose={removeToast} />
          </div>
        ))}
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        setApiKey={setApiKey}
        model={model}
        setModel={setModel}
        darkMode={darkMode}
        toggleTheme={() => setDarkMode(!darkMode)}
      />

      <DocsPanel 
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
        darkMode={darkMode}
      />

      {/* 1. Sidebar */}
      <ProjectSidebar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={switchProject}
        onCreateProject={createNewProject}
        onDeleteProject={(id) => {
          if (window.confirm('Delete project?')) {
            setProjects(prev => prev.filter(p => p.id !== id));
            if (activeProjectId === id) {
              const remaining = projects.filter(p => p.id !== id);
              if (remaining.length > 0) switchProject(remaining[0].id);
              else createNewProject();
            }
          }
        }}
        onRenameProject={renameProject}
        onOpenDocs={() => setIsDocsOpen(true)}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode(!darkMode)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        
        {projects.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 dark:text-slate-500">
             <Layout className="w-16 h-16 mb-4 opacity-20" />
             <p className="text-lg font-medium">Select or create a project to begin.</p>
          </div>
        ) : (
          <div 
            ref={mainRef}
            className="flex-1 flex overflow-hidden relative"
          >
             
             {/* LEFT COLUMN: Visuals (Source + Output) */}
             <div 
               ref={leftColRef}
               style={{ width: `${leftPanelWidth}%` }} 
               className="flex flex-col min-w-[300px] h-full bg-slate-50 dark:bg-zinc-950 border-r border-slate-200 dark:border-zinc-800 shrink-0 transition-all duration-75 relative"
             >
                {/* Top: Source Image */}
                <div style={{ height: `${sourcePanelHeight}%` }} className="flex-shrink-0 min-h-[200px] flex flex-col">
                  <SourcePanel 
                    selectedImage={selectedImage}
                    onImageSelected={handleImageSelected}
                    status={status}
                    onStartAnalysis={handleAnalyze}
                    isBusy={isWorkflowBusy}
                    runMode={runMode}
                    setRunMode={setRunMode}
                    reviewPreset={reviewPreset}
                    setReviewPreset={setReviewPreset}
                    maxAutoLoops={maxAutoLoops}
                    setMaxAutoLoops={setMaxAutoLoops}
                  />
                </div>

                {/* Vertical Splitter Handle */}
                <div 
                  className="h-1.5 w-full cursor-row-resize bg-slate-100 dark:bg-zinc-800 hover:bg-indigo-500 hover:scale-y-110 transition-all z-20 flex items-center justify-center group -mt-[1px]"
                  onMouseDown={handleMouseDown('vertical')}
                >
                   <div className="w-8 h-1 bg-slate-300 dark:bg-zinc-700 rounded-full group-hover:bg-white/50" />
                </div>

                {/* Bottom: Output Plot */}
                <div className="flex-1 min-h-0 flex flex-col border-t border-slate-200 dark:border-zinc-800">
                  <OutputPanel 
                    status={status}
                    generatedPlotBase64={generatedPlotBase64}
                    setGeneratedPlotBase64={setGeneratedPlotBase64}
                    renderLogs={renderLogs}
                    setRenderLogs={setRenderLogs}
                    renderError={renderError}
                    setRenderError={setRenderError}
                    onPlotRendered={(base64) => {
                      if (runMode !== 'simple') handleAutoRefinementTrigger(base64);
                    }}
                    onPlotRuntimeError={(errorText) => {
                      if (runMode !== 'simple') {
                        handleAutoRefinementErrorTrigger(errorText);
                        return;
                      }
                      handleCrashRecoveryOnce(errorText);
                    }}
                    pythonCode={currentPythonCode}
                    selectedImage={selectedImage}
                    onShowToast={addToast}
                  />
                </div>
             </div>

             {/* Horizontal Splitter Handle */}
             <div
               className="w-1.5 h-full cursor-col-resize hover:bg-indigo-500 transition-colors bg-slate-200 dark:bg-zinc-800 z-30 flex flex-col justify-center items-center group relative -ml-[1px]"
               onMouseDown={handleMouseDown('horizontal')}
             >
                <div className="h-8 w-1 bg-slate-400/50 rounded-full group-hover:bg-indigo-300 absolute" />
                
                {/* Quick Collapse Button on Handle */}
                <button 
                  onClick={() => setLeftPanelWidth(leftPanelWidth < 10 ? 50 : 0)}
                  className="absolute top-1/2 -translate-y-1/2 left-2 p-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-auto"
                  title={leftPanelWidth < 10 ? "Expand Visuals" : "Collapse Visuals"}
                >
                   {leftPanelWidth < 10 ? <ChevronRight className="w-3 h-3"/> : <ChevronLeft className="w-3 h-3"/>}
                </button>
             </div>

             {/* RIGHT COLUMN: Inspector (Code/Review/Logs) */}
             <div className="flex-1 min-w-0 h-full bg-white dark:bg-zinc-900 flex flex-col">
                <AnalysisView 
                  status={status}
                  result={result}
                  renderLogs={renderLogs}
                  renderError={renderError}
                  onShowToast={addToast}
                />
             </div>

             {isResizing && (
               <div className="absolute inset-0 bg-transparent z-50 cursor-col-resize" />
             )}

          </div>
        )}
      </main>
    </div>
  );
}
