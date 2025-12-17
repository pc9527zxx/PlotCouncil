import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnalysisView } from './components/AnalysisView';
import { OutputPanel } from './components/OutputPanel';
import { ProjectSidebar } from './components/ProjectSidebar';
import { SourcePanel } from './components/SourcePanel';
import { SettingsModal } from './components/SettingsModal';
import { DocsPanel } from './components/DocsPanel';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Toast, ToastItem, ToastType } from './components/Toast';
import { analyzePlotImage, refinePlotAnalysis } from './services/geminiService';
import { PlotImage, AnalysisResult, AnalysisStatus, AnalysisUpdate, Project, PlotSnapshot, CodeVersion, WorkflowLogEntry } from './types';
import { 
  loadProjectsSnapshot, 
  migrateLegacyLocalStorageToIDB, 
  migrateLegacyIndexedDBToPlotCouncil,
  saveProjectsSnapshot, 
  createEmptyProject, 
  normalizePlotHistory,
  loadModelConfigs,
  saveModelConfigs,
  migrateModelConfigsFromLocalStorage,
  ModelConfig
} from './services/projectStore';
import { Layout, ChevronLeft, ChevronRight } from 'lucide-react';

// ModelConfig is now imported from projectStore

const RISK_LOOP_THRESHOLD = 0.6;
// Legacy localStorage keys to clean up during migration
const LEGACY_STORAGE_KEYS = {
  apiKey: 'sciplot-api-key',
  model: 'sciplot-model',
  maxLoops: 'sciplot-max-loops',
  // Old keys to clean up
  oldApiKey: 'plotcouncil-api-key',
  oldModel: 'plotcouncil-model',
  oldBaseUrl: 'plotcouncil-base-url',
  oldCustomModels: 'plotcouncil-custom-models',
  // Keys that are now in IndexedDB
  modelConfigs: 'plotcouncil-model-configs',
  selectedConfigId: 'plotcouncil-selected-config-id',
  maxLoopsNew: 'plotcouncil-max-loops',
};

type RunMode = 'simple' | 'complex' | 'manual';
type ReviewPreset = 'lite' | 'full';

export default function App() {
  // Theme & Settings State
  const [darkMode, setDarkMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');

  // Derived: get current config
  const currentConfig = modelConfigs.find(c => c.id === selectedConfigId) || null;

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

  // Delete Confirmation Dialog State
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; projectId: string | null }>({
    isOpen: false,
    projectId: null,
  });

  // Project State
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');

  // Per-project running tasks tracking (to allow concurrent generation)
  const runningTasksRef = useRef<Map<string, AbortController>>(new Map());

  // Derived state from active project (for UI display)
  const activeProject = projects.find(p => p.id === activeProjectId);
  const selectedImage = activeProject?.selectedImage ?? null;
  const status = activeProject?.status ?? AnalysisStatus.IDLE;
  const result = activeProject?.result ?? null;
  const errorMessage = activeProject?.errorMessage ?? '';
  const plotHistory = activeProject?.plotHistory ?? [];
  const workflowLogs = activeProject?.workflowLogs ?? [];
  const renderCount = activeProject?.renderCount ?? 0;
  const generatedPlotBase64 = activeProject?.generatedPlotBase64 ?? null;
  const generatedSvgBase64 = activeProject?.generatedSvgBase64 ?? null;
  const renderLogs = activeProject?.renderLogs ?? '';
  const renderError = activeProject?.renderError ?? '';

  // Update helpers for active project
  const updateActiveProject = useCallback((updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => 
      p.id === activeProjectId ? { ...p, ...updates, updatedAt: Date.now() } : p
    ));
  }, [activeProjectId]);

  // Update a specific project (for background tasks)
  const updateProject = useCallback((projectId: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => 
      p.id === projectId ? { ...p, ...updates, updatedAt: Date.now() } : p
    ));
  }, []);

  // Setters that update active project
  const setSelectedImage = useCallback((image: PlotImage | null) => {
    updateActiveProject({ selectedImage: image });
  }, [updateActiveProject]);

  const setStatus = useCallback((newStatus: AnalysisStatus) => {
    updateActiveProject({ status: newStatus });
  }, [updateActiveProject]);

  const setResult = useCallback((newResult: AnalysisResult | null) => {
    updateActiveProject({ result: newResult });
  }, [updateActiveProject]);

  const setErrorMessage = useCallback((msg: string) => {
    updateActiveProject({ errorMessage: msg });
  }, [updateActiveProject]);

  const setPlotHistory = useCallback((history: PlotSnapshot[] | ((prev: PlotSnapshot[]) => PlotSnapshot[])) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const newHistory = typeof history === 'function' ? history(p.plotHistory) : history;
      return { ...p, plotHistory: newHistory, updatedAt: Date.now() };
    }));
  }, [activeProjectId]);

  const setRenderCount = useCallback((count: number | ((prev: number) => number)) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const newCount = typeof count === 'function' ? count(p.renderCount) : count;
      return { ...p, renderCount: newCount, updatedAt: Date.now() };
    }));
  }, [activeProjectId]);

  const setGeneratedPlotBase64 = useCallback((base64: string | null) => {
    updateActiveProject({ generatedPlotBase64: base64 });
  }, [updateActiveProject]);

  const setGeneratedSvgBase64 = useCallback((base64: string | null) => {
    updateActiveProject({ generatedSvgBase64: base64 });
  }, [updateActiveProject]);

  const setRenderLogs = useCallback((logs: string) => {
    updateActiveProject({ renderLogs: logs });
  }, [updateActiveProject]);

  const setRenderError = useCallback((err: string) => {
    updateActiveProject({ renderError: err });
  }, [updateActiveProject]);

  // Helper to extract code and save to history
  const extractAndSaveCode = useCallback((
    projectId: string, 
    markdown: string, 
    source: 'student' | 'revision'
  ) => {
    const codeMatch = markdown.match(/```python([\s\S]*?)```/i);
    const code = codeMatch ? codeMatch[1].trim() : '';
    if (!code) return;

    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const iteration = p.codeHistory.length;
      const newVersion: CodeVersion = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        code,
        timestamp: Date.now(),
        source,
        iteration,
      };
      return { 
        ...p, 
        codeHistory: [...p.codeHistory, newVersion],
        updatedAt: Date.now() 
      };
    }));
  }, []);

  // Helper to save rendered image to the latest code version
  const saveRenderedImageToHistory = useCallback((
    projectId: string,
    pngBase64: string,
    svgBase64?: string
  ) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      if (p.codeHistory.length === 0) return p;
      
      const updatedHistory = [...p.codeHistory];
      const lastIndex = updatedHistory.length - 1;
      updatedHistory[lastIndex] = {
        ...updatedHistory[lastIndex],
        renderedImage: pngBase64,
        renderedSvg: svgBase64,
      };
      
      return {
        ...p,
        codeHistory: updatedHistory,
        updatedAt: Date.now()
      };
    }));
  }, []);

  // Helper to add workflow log entry
  const addWorkflowLog = useCallback((
    projectId: string,
    type: WorkflowLogEntry['type'],
    message: string,
    agent?: string,
    details?: string
  ) => {
    const entry: WorkflowLogEntry = {
      timestamp: Date.now(),
      type,
      message,
      agent,
      details,
    };
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        workflowLogs: [...(p.workflowLogs || []), entry],
        updatedAt: Date.now()
      };
    }));
  }, []);

  // Helper to clear workflow logs
  const clearWorkflowLogs = useCallback((projectId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        workflowLogs: [],
        updatedAt: Date.now()
      };
    }));
  }, []);
  
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

  // Initialize theme
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []);

  // Load model configs from IndexedDB
  const [modelConfigsLoaded, setModelConfigsLoaded] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (async () => {
      // First, migrate from localStorage if needed
      await migrateModelConfigsFromLocalStorage();
      // Then load from IndexedDB
      const { configs, selectedConfigId: storedSelectedId, maxLoops } = await loadModelConfigs();
      setModelConfigs(configs);
      if (storedSelectedId) setSelectedConfigId(storedSelectedId);
      setMaxAutoLoops(clampLoops(maxLoops));
      setModelConfigsLoaded(true);
      // Clean up legacy keys
      Object.values(LEGACY_STORAGE_KEYS).forEach(key => window.localStorage.removeItem(key));
    })();
  }, []);

  // Save model configs to IndexedDB
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!modelConfigsLoaded) return; // Don't save until initial load is complete
    saveModelConfigs(modelConfigs, selectedConfigId || null, maxAutoLoops).catch(() => {});
  }, [modelConfigs, selectedConfigId, maxAutoLoops, modelConfigsLoaded]);

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

        // Normalize projects on load
        const normalizedProjects = initialProjects.map(p => ({
          ...p,
          plotHistory: normalizePlotHistory(p.plotHistory),
          status: p.result ? AnalysisStatus.SUCCESS : AnalysisStatus.IDLE,
        }));

        setProjects(normalizedProjects);
        setActiveProjectId(initialActive);
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

  // switchProject now just changes the activeProjectId - no state copying needed!
  // The UI will automatically reflect the new project's state through derived values
  const switchProject = (projectId: string) => {
    const next = projects.find(p => p.id === projectId);
    if (!next) return;
    // Just switch the active project - don't interrupt any running tasks
    setActiveProjectId(projectId);
    // Reset UI-only state
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
    if (!activeProjectId) return;
    
    updateActiveProject({ 
      selectedImage: image,
      ...(image ? {} : {
        status: AnalysisStatus.IDLE,
        result: null,
        errorMessage: '',
        plotHistory: [],
        workflowLogs: [],
        renderCount: 0,
        generatedPlotBase64: null,
        renderLogs: '',
        renderError: '',
      })
    });
    
    if (image) {
      addWorkflowLog(activeProjectId, 'info', '图片已上传', undefined, `类型: ${image.mimeType}`);
    }
    
    if (!image) {
      setIsFirstPass(false);
      updateLoopBudget(0);
      crashRecoveryUsedRef.current = false;
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage || !activeProjectId) {
        addToast("Please upload an image first", "error");
        return;
    }

    // Capture project ID to use throughout the async operation
    const projectId = activeProjectId;
    const projectImage = selectedImage;

    // Clear logs and start fresh
    clearWorkflowLogs(projectId);
    addWorkflowLog(projectId, 'info', '开始分析流程', undefined, `运行模式: ${runMode}, 审查预设: ${reviewPreset}`);
    addWorkflowLog(projectId, 'info', `使用模型: ${currentConfig?.modelId || '默认'}`);

    updateProject(projectId, {
      status: AnalysisStatus.ANALYZING,
      errorMessage: '',
      result: null,
      codeHistory: [],  // Clear code history on new analysis
      generatedSvgBase64: null,  // Clear SVG
    });
    crashRecoveryUsedRef.current = false;
    
    const initialBudget = runMode === 'simple' 
      ? 0 
      : (runMode === 'complex' ? 1 : maxAutoLoops);
      
    updateLoopBudget(initialBudget);
    
    setIsFirstPass(runMode !== 'simple'); 
    setAutoRefineEnabled(runMode !== 'simple');
    
    setIsCapturing(false);

    try {
      addWorkflowLog(projectId, 'agent', 'Student Agent 开始生成代码...', 'Student');
      const analysisData = await analyzePlotImage(
        projectImage.base64, 
        projectImage.mimeType,
        currentConfig?.modelId || '',
        currentConfig?.apiKey || undefined,
        (update: AnalysisUpdate) => {
          if (update.status) {
            updateProject(projectId, { status: update.status });
            // Log status changes
            const statusLabels: Record<string, string> = {
              [AnalysisStatus.ANALYZING]: 'Student Agent 分析中...',
            };
            if (statusLabels[update.status]) {
              addWorkflowLog(projectId, 'agent', statusLabels[update.status], 'Student');
            }
          }
          if (update.partialResult) {
            setProjects(prev => prev.map(p => {
              if (p.id !== projectId) return p;
              const mergedResult: AnalysisResult = {
                ...(p.result || { markdown: '', timestamp: Date.now() }),
                ...update.partialResult,
              };
              return { ...p, result: mergedResult, updatedAt: Date.now() };
            }));
          }
        },
        currentConfig?.baseUrl || undefined
      );
      updateProject(projectId, {
        result: analysisData,
        status: AnalysisStatus.SUCCESS,
      });
      // Save initial code to history
      extractAndSaveCode(projectId, analysisData.markdown, 'student');
      addWorkflowLog(projectId, 'success', 'Student Agent 代码生成完成', 'Student');
      addToast("Code generated successfully", "success");
    } catch (e: any) {
      console.error("App Level Error:", e);
      updateProject(projectId, {
        status: AnalysisStatus.ERROR,
        errorMessage: e.message || "Unknown error occurred.",
      });
      addWorkflowLog(projectId, 'error', `分析失败: ${e.message || '未知错误'}`, undefined);
      addToast(e.message || "Analysis failed", "error");
      setIsFirstPass(false);
    }
  };

  const handleRefine = async (feedbackType: 'image' | 'error', data: string, mimeType?: string) => {
    if (!selectedImage || !result || !activeProjectId) return;
    
    // Capture project context for async operation
    const projectId = activeProjectId;
    const projectImage = selectedImage;
    const projectResult = result;
    
    const codeMatch = projectResult.markdown.match(/```python([\s\S]*?)```/);
    const currentCode = codeMatch ? codeMatch[1].trim() : (projectResult.markdown.includes('import matplotlib') ? projectResult.markdown : '');
    const triggeredByAuto = pendingAutoRef.current;

    addWorkflowLog(projectId, 'info', `开始审查流程 (${reviewPreset === 'lite' ? 'Lite' : 'Full'} 模式)`, undefined, 
      feedbackType === 'image' ? '渲染成功，进入审查' : '渲染出错，错误诊断模式');

    updateProject(projectId, {
      status: reviewPreset === 'lite' ? AnalysisStatus.CHAIR_QA : AnalysisStatus.TEACHER_STYLE_REVIEW,
      errorMessage: '',
    });

    try {
      const refinedData = await refinePlotAnalysis(
        projectImage.base64,
        projectImage.mimeType,
        currentCode,
        { type: feedbackType, data, mimeType },
        currentConfig?.modelId || '',
        currentConfig?.apiKey || undefined,
        (update: AnalysisUpdate) => {
          if (update.status) {
            updateProject(projectId, { status: update.status });
            // Log agent activities
            const statusLabels: Record<string, { msg: string; agent: string }> = {
              [AnalysisStatus.TEACHER_STYLE_REVIEW]: { msg: 'Style Teacher 审查中...', agent: 'Style Teacher' },
              [AnalysisStatus.TEACHER_LAYOUT_REVIEW]: { msg: 'Layout Teacher 审查中...', agent: 'Layout Teacher' },
              [AnalysisStatus.TEACHER_DATA_REVIEW]: { msg: 'Data Teacher 审查中...', agent: 'Data Teacher' },
              [AnalysisStatus.CHAIR_QA]: { msg: 'QA Chair 综合评估中...', agent: 'QA Chair' },
              [AnalysisStatus.CHAIR_STRATEGY]: { msg: 'Strategy Chair 制定修订策略...', agent: 'Strategy Chair' },
              [AnalysisStatus.REFINING]: { msg: 'Student Agent 修订代码中...', agent: 'Student' },
            };
            const label = statusLabels[update.status];
            if (label) {
              addWorkflowLog(projectId, 'agent', label.msg, label.agent);
            }
          }
          if (update.partialResult) {
            setProjects(prev => prev.map(p => {
              if (p.id !== projectId) return p;
              // Merge partial result with existing result, preserving markdown
              const existingResult = p.result || { markdown: currentCode ? `\`\`\`python\n${currentCode}\n\`\`\`` : '', timestamp: Date.now() };
              const mergedResult: AnalysisResult = {
                ...existingResult,
                ...update.partialResult,
                // Merge arrays instead of replacing
                teacherReviews: update.partialResult.teacherReviews || existingResult.teacherReviews,
                chairFindings: update.partialResult.chairFindings || existingResult.chairFindings,
              };
              return { ...p, result: mergedResult, updatedAt: Date.now() };
            }));
            // Log when partial results arrive
            if (update.partialResult.teacherReviews?.length) {
              const lastReview = update.partialResult.teacherReviews[update.partialResult.teacherReviews.length - 1];
              addWorkflowLog(projectId, 'success', `${lastReview.role} Teacher 审查完成`, `${lastReview.role} Teacher`);
            }
            if (update.partialResult.chairFindings?.length) {
              const lastFinding = update.partialResult.chairFindings[update.partialResult.chairFindings.length - 1];
              addWorkflowLog(projectId, 'success', `${lastFinding.role} Chair 评估完成`, `${lastFinding.role} Chair`);
            }
          }
        },
        { preset: reviewPreset },
        currentConfig?.baseUrl || undefined
      );
      // Refresh downstream render with new code
      updateProject(projectId, {
        generatedPlotBase64: null,
        generatedSvgBase64: null,
        renderLogs: '',
        renderError: '',
        result: refinedData,
        status: AnalysisStatus.SUCCESS,
      });
      // Save revised code to history
      extractAndSaveCode(projectId, refinedData.markdown, 'revision');
      addWorkflowLog(projectId, 'success', 'Student Agent 修订完成', 'Student', 
        `QA状态: ${refinedData.qaStatus || '未知'}, 风险分数: ${refinedData.riskScore?.toFixed(2) || 'N/A'}`);

      const riskValue = refinedData.riskScore;
      const effectiveRisk = typeof riskValue === 'number' && Number.isFinite(riskValue)
        ? riskValue
        : (refinedData.qaStatus === 'NEEDS_REVISION' ? 1 : 0);
      const shouldAutoLoop = autoRefineEnabled 
        && triggeredByAuto 
        && loopBudgetRef.current > 0
        && effectiveRisk > RISK_LOOP_THRESHOLD;
      if (shouldAutoLoop) {
        addWorkflowLog(projectId, 'info', `风险分数 ${effectiveRisk.toFixed(2)} > ${RISK_LOOP_THRESHOLD}，继续下一轮迭代...`);
        setIsFirstPass(true);
      } else {
        if (effectiveRisk <= RISK_LOOP_THRESHOLD) {
          addWorkflowLog(projectId, 'success', `风险分数 ${effectiveRisk.toFixed(2)} ≤ ${RISK_LOOP_THRESHOLD}，审查通过！`);
        }
        setIsFirstPass(false);
        updateLoopBudget(0);
      }
    } catch (e: any) {
      console.error("Refinement Error:", e);
      updateProject(projectId, {
        status: AnalysisStatus.ERROR,
        errorMessage: e.message || "Refinement failed.",
      });
      addWorkflowLog(projectId, 'error', `审查失败: ${e.message || '未知错误'}`);
      addToast("Refinement failed", "error");
    } finally {
      pendingAutoRef.current = false;
    }
  };

  // Callbacks for Automation
  const handleAutoRefinementTrigger = async (renderedImageBase64: string) => {
    if (runMode === 'simple') return;
    
    if (!currentConfig?.apiKey) return;
    if (!autoRefineEnabled || !isFirstPass || !selectedImage || !result || loopBudgetRef.current <= 0) return;
    
    setIsFirstPass(false); 
    setIsCapturing(true); 
    addToast(`Auto-refining... (${loopBudgetRef.current} loops left)`, "info");
    if (activeProjectId) {
      addWorkflowLog(activeProjectId, 'info', `渲染完成，自动进入审查 (剩余 ${loopBudgetRef.current} 轮)`);
    }
    
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

    if (!currentConfig?.apiKey) return;
    if (!autoRefineEnabled || !isFirstPass || !selectedImage || !result || loopBudgetRef.current <= 0) return;
    setIsFirstPass(false); 
    setIsCapturing(true);
    pendingAutoRef.current = true;
    updateLoopBudget(prev => Math.max(prev - 1, 0));
    if (activeProjectId) {
      addWorkflowLog(activeProjectId, 'warning', `渲染出错，进入错误诊断模式`, undefined, errorText.slice(0, 200));
    }
    try {
      await handleRefine('error', errorText);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCrashRecoveryOnce = async (errorText: string) => {
    if (!selectedImage || !result) return;
    if (!currentConfig?.apiKey) return;
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
        selectedConfigId={selectedConfigId}
        setSelectedConfigId={setSelectedConfigId}
        modelConfigs={modelConfigs}
        setModelConfigs={setModelConfigs}
        darkMode={darkMode}
        toggleTheme={() => setDarkMode(!darkMode)}
      />

      <DocsPanel 
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
        darkMode={darkMode}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, projectId: null })}
        onConfirm={() => {
          const id = deleteConfirm.projectId;
          if (!id) return;
          setProjects(prev => prev.filter(p => p.id !== id));
          if (activeProjectId === id) {
            const remaining = projects.filter(p => p.id !== id);
            if (remaining.length > 0) switchProject(remaining[0].id);
            else createNewProject();
          }
          addToast('Project deleted', 'success');
        }}
        title="Delete Project"
        message="Are you sure you want to delete this project? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* 1. Sidebar */}
      <ProjectSidebar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={switchProject}
        onCreateProject={createNewProject}
        onDeleteProject={(id) => {
          setDeleteConfirm({ isOpen: true, projectId: id });
        }}
        onRenameProject={renameProject}
        onOpenDocs={() => setIsDocsOpen(true)}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode(!darkMode)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        modelConfigs={modelConfigs}
        selectedConfigId={selectedConfigId}
        onSelectConfig={setSelectedConfigId}
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
                    onShowToast={addToast}
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
                    generatedSvgBase64={generatedSvgBase64}
                    setGeneratedPlotBase64={setGeneratedPlotBase64}
                    setGeneratedSvgBase64={setGeneratedSvgBase64}
                    renderLogs={renderLogs}
                    setRenderLogs={setRenderLogs}
                    renderError={renderError}
                    setRenderError={setRenderError}
                    onPlotRendered={(base64, svgBase64) => {
                      // Save rendered image to the latest code version
                      if (activeProjectId) {
                        saveRenderedImageToHistory(activeProjectId, base64, svgBase64);
                      }
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
                    projectName={activeProject?.name || 'plot'}
                    codeIteration={(activeProject?.codeHistory?.length || 0)}
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
                  key={activeProjectId}
                  status={status}
                  result={result}
                  renderLogs={renderLogs}
                  renderError={renderError}
                  workflowLogs={workflowLogs}
                  onShowToast={addToast}
                  codeHistory={projects.find(p => p.id === activeProjectId)?.codeHistory || []}
                  projectName={activeProject?.name || 'plot'}
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
