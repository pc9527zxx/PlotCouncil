import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnalysisView } from './components/AnalysisView';
import { OutputPanel } from './components/OutputPanel';
import { ProjectSidebar } from './components/ProjectSidebar';
import { SourcePanel } from './components/SourcePanel';
import { SettingsModal } from './components/SettingsModal';
import { DocsPanel } from './components/DocsPanel';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Toast, ToastItem, ToastType } from './components/Toast';
import { analyzePlotImage, refinePlotAnalysis, quickFixError } from './services/geminiService';
import { PlotImage, AnalysisResult, AnalysisStatus, AnalysisUpdate, Project, ProjectGroup, PlotSnapshot, CodeVersion, WorkflowLogEntry } from './types';
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
  loadProjectGroups,
  saveProjectGroups,
  ModelConfig
} from './services/projectStore';
import { Language, t } from './services/i18n';
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
  const [language, setLanguage] = useState<Language>('zh');
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
  
  // Project Groups (Discord-style folders)
  const [groups, setGroups] = useState<ProjectGroup[]>([]);

  // Per-project running tasks tracking (to allow concurrent generation)
  const runningTasksRef = useRef<Map<string, AbortController>>(new Map());

  // Derived state from active project (for UI display) - memoized to avoid repeated lookups
  const activeProject = useMemo(() => 
    projects.find(p => p.id === activeProjectId), 
    [projects, activeProjectId]
  );
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

  // Helper to add workflow log entry (with deduplication)
  const lastLogRef = useRef<{ message: string; agent?: string; timestamp: number } | null>(null);
  
  const addWorkflowLog = useCallback((
    projectId: string,
    type: WorkflowLogEntry['type'],
    message: string,
    agent?: string,
    details?: string
  ) => {
    // Quick dedup check using ref (more reliable than state-based check)
    const now = Date.now();
    if (lastLogRef.current && 
        lastLogRef.current.message === message && 
        lastLogRef.current.agent === agent &&
        now - lastLogRef.current.timestamp < 3000) {
      return; // Skip duplicate
    }
    lastLogRef.current = { message, agent, timestamp: now };
    
    const entry: WorkflowLogEntry = {
      timestamp: now,
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
  
  // Refs to track latest values for async functions (避免闭包捕获旧值)
  const runModeRef = useRef<RunMode>(runMode);
  const reviewPresetRef = useRef<ReviewPreset>(reviewPreset);
  useEffect(() => { runModeRef.current = runMode; }, [runMode]);
  useEffect(() => { reviewPresetRef.current = reviewPreset; }, [reviewPreset]);

  // Auto-Refine State
  const [autoRefineEnabled, setAutoRefineEnabled] = useState(false);
  const [isFirstPass, setIsFirstPass] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false); 
  const [maxAutoLoops, setMaxAutoLoops] = useState(2);
  const [loopBudget, setLoopBudget] = useState(0);
  const loopBudgetRef = useRef(0);
  const pendingAutoRef = useRef(false);
  const isRefiningRef = useRef(false);  // Lock to prevent duplicate refinements
  const loggedItemsRef = useRef<Set<string>>(new Set());  // Track logged items to avoid duplicates
  const lastRenderedHashRef = useRef<string>('');  // Track last rendered image to prevent duplicate callbacks
  
  // Refs for auto-refinement trigger (避免回调闭包捕获旧值)
  const autoRefineEnabledRef = useRef(autoRefineEnabled);
  const isFirstPassRef = useRef(isFirstPass);
  useEffect(() => { autoRefineEnabledRef.current = autoRefineEnabled; }, [autoRefineEnabled]);
  useEffect(() => { isFirstPassRef.current = isFirstPass; }, [isFirstPass]);

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

  // Initialize theme and language
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
    // Load saved language preference
    const savedLang = localStorage.getItem('plotcouncil-language') as Language | null;
    if (savedLang === 'en' || savedLang === 'zh') {
      setLanguage(savedLang);
    }
  }, []);

  // Save language preference
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('plotcouncil-language', language);
  }, [language]);

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

  // Save model configs to IndexedDB (debounced for slider performance)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!modelConfigsLoaded) return; // Don't save until initial load is complete
    const timer = setTimeout(() => {
      saveModelConfigs(modelConfigs, selectedConfigId || null, maxAutoLoops).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
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
        
        // Load groups
        const loadedGroups = await loadProjectGroups();
        if (!cancelled) {
          setGroups(loadedGroups);
        }
        
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

  // Auto-save projects (debounced to reduce IDB writes)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!activeProjectId) return;
    if (!projects.length) return;
    const handle = window.setTimeout(() => {
      saveProjectsSnapshot(projects, activeProjectId).catch(() => {});
    }, 1000); // Increased debounce for better performance
    return () => window.clearTimeout(handle);
  }, [projects, activeProjectId]);

  // Auto-save groups (debounced)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handle = window.setTimeout(() => {
      saveProjectGroups(groups).catch(() => {});
    }, 1000);
    return () => window.clearTimeout(handle);
  }, [groups]);

  // switchProject now just changes the activeProjectId - no state copying needed!
  // The UI will automatically reflect the new project's state through derived values
  const switchProject = useCallback((projectId: string) => {
    setProjects(prev => {
      const next = prev.find(p => p.id === projectId);
      if (!next) return prev;
      return prev; // No modification needed, just validates existence
    });
    // Just switch the active project - don't interrupt any running tasks
    setActiveProjectId(projectId);
    // Reset UI-only state
    setIsFirstPass(false);
    updateLoopBudget(0);
    errorFixCountRef.current = 0;
  }, []);

  const createNewProject = useCallback(() => {
    setProjects(prev => {
      const nextIndex = prev.length + 1;
      const project = createEmptyProject(`Project ${nextIndex}`);
      setActiveProjectId(project.id);
      setIsFirstPass(false);
      updateLoopBudget(0);
      errorFixCountRef.current = 0;
      addToast('New project created', 'success');
      return [project, ...prev];
    });
  }, [addToast]);

  const renameProject = useCallback((projectId: string, name: string) => {
    const nextName = name.trim();
    if (!nextName) return;
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      if (p.name === nextName) return p;
      return { ...p, name: nextName };
    }));
    addToast('Project renamed', 'success');
  }, [addToast]);

  // === Group Management Functions (memoized for performance) ===
  const createGroup = useCallback(() => {
    const newGroup: ProjectGroup = {
      id: crypto.randomUUID(),
      name: `分组 ${groups.length + 1}`,
      collapsed: false,
      createdAt: Date.now()
    };
    setGroups(prev => [...prev, newGroup]);
    addToast('分组已创建', 'success');
  }, [groups.length, addToast]);

  const deleteGroup = useCallback((groupId: string) => {
    // Move all projects in this group to ungrouped
    setProjects(prev => prev.map(p => 
      p.groupId === groupId ? { ...p, groupId: undefined } : p
    ));
    setGroups(prev => prev.filter(g => g.id !== groupId));
    addToast('分组已删除', 'success');
  }, [addToast]);

  const renameGroup = useCallback((groupId: string, name: string) => {
    const nextName = name.trim();
    if (!nextName) return;
    setGroups(prev => prev.map(g => 
      g.id === groupId ? { ...g, name: nextName } : g
    ));
  }, []);

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setGroups(prev => prev.map(g => 
      g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
    ));
  }, []);

  const moveProjectToGroup = useCallback((projectId: string, groupId: string | null) => {
    setProjects(prev => prev.map(p => 
      p.id === projectId ? { ...p, groupId: groupId ?? undefined } : p
    ));
  }, []);

  const batchDeleteProjects = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    
    setProjects(prev => {
      const remaining = prev.filter(p => !ids.includes(p.id));
      // If active project is being deleted, switch to another
      if (ids.includes(activeProjectId)) {
        if (remaining.length > 0) {
          setActiveProjectId(remaining[0].id);
        } else {
          setActiveProjectId('');
        }
      }
      return remaining;
    });
    addToast(`已删除 ${ids.length} 个项目`, 'success');
  }, [activeProjectId, addToast]);

  const batchMoveProjects = useCallback((ids: string[], groupId: string | null) => {
    setProjects(prev => prev.map(p => 
      ids.includes(p.id) ? { ...p, groupId: groupId ?? undefined } : p
    ));
    const groupName = groupId ? groups.find(g => g.id === groupId)?.name : '未分组';
    addToast(`已移动 ${ids.length} 个项目到 ${groupName}`, 'success');
  }, [groups, addToast]);

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
      errorFixCountRef.current = 0;
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage || !activeProjectId) {
        addToast("Please upload an image first", "error");
        return;
    }

    // Capture project ID and current mode settings to use throughout the async operation
    const projectId = activeProjectId;
    const projectImage = selectedImage;
    const currentRunMode = runModeRef.current;  // 使用 ref 获取最新值
    const currentReviewPreset = reviewPresetRef.current;  // 使用 ref 获取最新值

    // Clear logs and start fresh
    clearWorkflowLogs(projectId);
    addWorkflowLog(projectId, 'info', '开始分析流程', undefined, `运行模式: ${currentRunMode}, 审查预设: ${currentReviewPreset}`);
    addWorkflowLog(projectId, 'info', `使用模型: ${currentConfig?.modelId || '默认'}`);

    // 重要：清除旧的渲染结果，确保新代码会触发渲染
    updateProject(projectId, {
      status: AnalysisStatus.ANALYZING,
      errorMessage: '',
      result: null,
      codeHistory: [],  // Clear code history on new analysis
      generatedPlotBase64: null,  // 清除旧图片，确保 autorun 生效
      generatedSvgBase64: null,  // Clear SVG
      renderLogs: '',  // 清除旧日志
      renderError: '',  // 清除旧错误
    });
    errorFixCountRef.current = 0;
    autoTriggerPendingRef.current = false;  // Reset auto-trigger flag
    lastRenderedHashRef.current = '';  // Reset render hash for new analysis
    
    const initialBudget = currentRunMode === 'simple' 
      ? 0 
      : (currentRunMode === 'complex' ? 1 : maxAutoLoops);
      
    updateLoopBudget(initialBudget);
    
    const shouldAutoRefine = currentRunMode !== 'simple';
    setIsFirstPass(shouldAutoRefine);
    isFirstPassRef.current = shouldAutoRefine;  // 同步更新 ref
    setAutoRefineEnabled(shouldAutoRefine);
    autoRefineEnabledRef.current = shouldAutoRefine;  // 同步更新 ref
    
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
    
    // Prevent duplicate refinements
    if (isRefiningRef.current) {
      console.log('[handleRefine] Skipped - already refining');
      addWorkflowLog(activeProjectId, 'warning', '跳过重复的审查请求');
      return;
    }
    isRefiningRef.current = true;
    loggedItemsRef.current.clear();  // Clear logged items for this refinement session
    console.log('[handleRefine] Started');
    
    // Capture project context and current settings for async operation
    const projectId = activeProjectId;
    const projectImage = selectedImage;
    const projectResult = result;
    const currentReviewPreset = reviewPresetRef.current;  // 使用 ref 获取最新值
    
    const codeMatch = projectResult.markdown.match(/```python([\s\S]*?)```/);
    const currentCode = codeMatch ? codeMatch[1].trim() : (projectResult.markdown.includes('import matplotlib') ? projectResult.markdown : '');
    const triggeredByAuto = pendingAutoRef.current;

    addWorkflowLog(projectId, 'info', `开始审查流程 (${currentReviewPreset === 'lite' ? 'Lite' : 'Full'} 模式)`, undefined, 
      feedbackType === 'image' ? '渲染成功，进入审查' : '渲染出错，错误诊断模式');

    updateProject(projectId, {
      status: currentReviewPreset === 'lite' ? AnalysisStatus.CHAIR_QA : AnalysisStatus.TEACHER_STYLE_REVIEW,
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
            // Log when partial results arrive - use a ref to track logged items
            if (update.partialResult.teacherReviews?.length) {
              const lastReview = update.partialResult.teacherReviews[update.partialResult.teacherReviews.length - 1];
              const logKey = `teacher-${lastReview.role}-${update.partialResult.teacherReviews.length}`;
              if (!loggedItemsRef.current.has(logKey)) {
                loggedItemsRef.current.add(logKey);
                addWorkflowLog(projectId, 'success', `${lastReview.role} Teacher 审查完成`, `${lastReview.role} Teacher`);
              }
            }
            if (update.partialResult.chairFindings?.length) {
              const lastFinding = update.partialResult.chairFindings[update.partialResult.chairFindings.length - 1];
              const logKey = `chair-${lastFinding.role}-${update.partialResult.chairFindings.length}`;
              if (!loggedItemsRef.current.has(logKey)) {
                loggedItemsRef.current.add(logKey);
                addWorkflowLog(projectId, 'success', `${lastFinding.role} Chair 评估完成`, `${lastFinding.role} Chair`);
              }
            }
          }
        },
        { preset: currentReviewPreset },
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
      isRefiningRef.current = false;  // Release the lock
    }
  };

  // Callbacks for Automation
  const autoTriggerPendingRef = useRef(false);  // Prevent duplicate auto-trigger calls
  
  const handleAutoRefinementTrigger = async (renderedImageBase64: string) => {
    if (runModeRef.current === 'simple') return;  // 使用 ref
    
    if (!currentConfig?.apiKey) return;
    
    // 使用 refs 获取最新值，避免闭包问题
    if (!autoRefineEnabledRef.current || !isFirstPassRef.current || loopBudgetRef.current <= 0) {
      console.log('[handleAutoRefinementTrigger] Skipped - conditions not met:', {
        autoRefineEnabled: autoRefineEnabledRef.current,
        isFirstPass: isFirstPassRef.current,
        loopBudget: loopBudgetRef.current
      });
      return;
    }
    
    // Prevent duplicate triggers
    if (autoTriggerPendingRef.current) {
      console.log('[handleAutoRefinementTrigger] Skipped - already pending');
      return;
    }
    autoTriggerPendingRef.current = true;
    
    setIsFirstPass(false);
    isFirstPassRef.current = false;  // 同步更新 ref
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
          autoTriggerPendingRef.current = false;  // Release after refinement completes
        }
    }, 800);
  };

  // Quick fix for runtime errors - uses simplified prompt without full teacher review
  const errorFixCountRef = useRef(0);
  const MAX_ERROR_FIX_ATTEMPTS = 3;

  const handleAutoRefinementErrorTrigger = async (errorText: string) => {
    if (runModeRef.current === 'simple') return;  // 使用 ref

    if (!currentConfig?.apiKey) return;
    if (!selectedImage || !result || !activeProjectId) return;
    
    // Limit error fix attempts to avoid infinite loops
    if (errorFixCountRef.current >= MAX_ERROR_FIX_ATTEMPTS) {
      addWorkflowLog(activeProjectId, 'error', `已达到最大错误修复次数 (${MAX_ERROR_FIX_ATTEMPTS})，请手动检查代码`);
      // Still allow entering teacher review for manual guidance
      return;
    }
    
    errorFixCountRef.current += 1;
    setIsCapturing(true);
    
    addWorkflowLog(activeProjectId, 'agent', `渲染出错，Student 自动修复中 (${errorFixCountRef.current}/${MAX_ERROR_FIX_ATTEMPTS})...`, 'Student');
    addWorkflowLog(activeProjectId, 'warning', '错误信息', undefined, errorText.slice(0, 300));
    
    try {
      updateActiveProject({ 
        status: AnalysisStatus.REFINING,
        renderError: '',
        renderLogs: '' 
      });
      
      const fixResult = await quickFixError(
        {
          apiKey: currentConfig.apiKey,
          baseUrl: currentConfig.baseUrl || undefined,
          modelId: currentConfig.modelId || 'gemini-2.0-flash',
        },
        selectedImage.base64,
        selectedImage.mimeType,
        currentPythonCode,
        errorText,
        (update) => {
          if (update.status) {
            updateActiveProject({ status: update.status });
          }
        }
      );
      
      // Save to code history
      const newVersion: CodeVersion = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        code: extractPythonCode(fixResult.markdown),
        timestamp: Date.now(),
        source: 'revision',
      };
      
      // Update project - this will trigger PyodidePlot to re-render
      // If re-render succeeds, handleAutoRefinementTrigger will be called
      // If re-render fails again, this function will be called again (up to MAX_ERROR_FIX_ATTEMPTS)
      updateActiveProject({
        result: fixResult,
        status: AnalysisStatus.SUCCESS,
        codeHistory: [...(activeProject?.codeHistory || []), newVersion],
        renderError: '',
        renderLogs: '',
        generatedPlotBase64: null,  // Clear to trigger re-render
        generatedSvgBase64: null,
      });
      
      addWorkflowLog(activeProjectId, 'success', '错误已修复，正在重新渲染...', 'Student');
      
    } catch (e: any) {
      addWorkflowLog(activeProjectId, 'error', `自动修复失败: ${e.message || '未知错误'}`);
      updateActiveProject({ status: AnalysisStatus.SUCCESS });
    } finally {
      setIsCapturing(false);
    }
  };

  const handleQuickErrorFix = async (errorText: string) => {
    if (!selectedImage || !result) return;
    if (!currentConfig?.apiKey) return;
    if (!activeProjectId) return;
    
    // Limit error fix attempts to avoid infinite loops
    if (errorFixCountRef.current >= MAX_ERROR_FIX_ATTEMPTS) {
      addWorkflowLog(activeProjectId, 'error', `已达到最大错误修复次数 (${MAX_ERROR_FIX_ATTEMPTS})，请手动检查代码`);
      return;
    }
    
    errorFixCountRef.current += 1;
    setIsCapturing(true);
    pendingAutoRef.current = true;
    
    addWorkflowLog(activeProjectId, 'agent', `检测到运行时错误，正在自动修复 (${errorFixCountRef.current}/${MAX_ERROR_FIX_ATTEMPTS})...`, 'Student');
    addWorkflowLog(activeProjectId, 'warning', '错误信息', undefined, errorText.slice(0, 300));
    
    try {
      updateActiveProject({ 
        status: AnalysisStatus.REFINING,
        renderError: '',
        renderLogs: '' 
      });
      
      const fixResult = await quickFixError(
        {
          apiKey: currentConfig.apiKey,
          baseUrl: currentConfig.baseUrl || undefined,
          modelId: currentConfig.modelId || 'gemini-2.0-flash',
        },
        selectedImage.base64,
        selectedImage.mimeType,
        currentPythonCode,
        errorText,
        (update) => {
          if (update.status) {
            updateActiveProject({ status: update.status });
          }
        }
      );
      
      // Save to code history
      const newVersion: CodeVersion = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        code: extractPythonCode(fixResult.markdown),
        timestamp: Date.now(),
        source: 'revision',
      };
      
      updateActiveProject({
        result: fixResult,
        status: AnalysisStatus.SUCCESS,
        codeHistory: [...(activeProject?.codeHistory || []), newVersion],
        renderError: '',
        renderLogs: '',
      });
      
      addWorkflowLog(activeProjectId, 'success', '错误已自动修复，正在重新渲染...', 'Student');
      
    } catch (e: any) {
      addWorkflowLog(activeProjectId, 'error', `自动修复失败: ${e.message || '未知错误'}`);
      updateActiveProject({ status: AnalysisStatus.SUCCESS });
    } finally {
      setIsCapturing(false);
      setIsManualFixing(false);
    }
  };

  // Manual fix - user provides error description
  const [isManualFixing, setIsManualFixing] = useState(false);
  
  const handleManualFix = async (errorDescription: string) => {
    if (!selectedImage || !result) {
      addToast("请先上传图片并生成代码", "error");
      return;
    }
    if (!currentConfig?.apiKey) {
      addToast("请先配置API Key", "error");
      return;
    }
    if (!activeProjectId) return;
    
    setIsManualFixing(true);
    addWorkflowLog(activeProjectId, 'agent', '收到手动修复请求...', 'Student');
    addWorkflowLog(activeProjectId, 'info', '问题描述', undefined, errorDescription.slice(0, 300));
    
    // Use the quick fix function with the user-provided description
    try {
      updateActiveProject({ 
        status: AnalysisStatus.REFINING,
        renderError: '',
        renderLogs: '' 
      });
      
      const fixResult = await quickFixError(
        {
          apiKey: currentConfig.apiKey,
          baseUrl: currentConfig.baseUrl || undefined,
          modelId: currentConfig.modelId || 'gemini-2.0-flash',
        },
        selectedImage.base64,
        selectedImage.mimeType,
        currentPythonCode,
        errorDescription,
        (update) => {
          if (update.status) {
            updateActiveProject({ status: update.status });
          }
        }
      );
      
      // Save to code history
      const newVersion: CodeVersion = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        code: extractPythonCode(fixResult.markdown),
        timestamp: Date.now(),
        source: 'revision',
      };
      
      updateActiveProject({
        result: fixResult,
        status: AnalysisStatus.SUCCESS,
        codeHistory: [...(activeProject?.codeHistory || []), newVersion],
        renderError: '',
        renderLogs: '',
      });
      
      addWorkflowLog(activeProjectId, 'success', '手动修复完成，正在重新渲染...', 'Student');
      
    } catch (e: any) {
      addWorkflowLog(activeProjectId, 'error', `手动修复失败: ${e.message || '未知错误'}`);
      updateActiveProject({ status: AnalysisStatus.SUCCESS });
    } finally {
      setIsManualFixing(false);
    }
  };

  // Reset error fix counter when starting a new analysis
  const resetErrorFixCounter = () => {
    errorFixCountRef.current = 0;
  };

  // --- Resizing Logic (optimized with RAF throttle) ---
  const rafRef = useRef<number | null>(null);
  const pendingMousePos = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (type: 'horizontal' | 'vertical') => (e: React.MouseEvent) => {
    setIsResizing(type);
    e.preventDefault();
  };

  useEffect(() => {
    const processResize = () => {
      if (!pendingMousePos.current || !mainRef.current) {
        rafRef.current = null;
        return;
      }
      
      const { x, y } = pendingMousePos.current;
      
      if (isResizing === 'horizontal') {
        const containerRect = mainRef.current.getBoundingClientRect();
        const newWidth = ((x - containerRect.left) / containerRect.width) * 100;
        const constrainedWidth = Math.max(20, Math.min(80, newWidth));
        setLeftPanelWidth(constrainedWidth);
      } else if (isResizing === 'vertical' && leftColRef.current) {
        const containerRect = leftColRef.current.getBoundingClientRect();
        const newHeight = ((y - containerRect.top) / containerRect.height) * 100;
        const constrainedHeight = Math.max(20, Math.min(80, newHeight));
        setSourcePanelHeight(constrainedHeight);
      }
      
      pendingMousePos.current = null;
      rafRef.current = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      pendingMousePos.current = { x: e.clientX, y: e.clientY };
      
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(processResize);
      }
    };

    const handleMouseUp = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingMousePos.current = null;
      setIsResizing(null);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isResizing]);

  const isWorkflowBusy = status === AnalysisStatus.ANALYZING || status === AnalysisStatus.REFINING || isCapturing;

  // Helper to extract python code from markdown
  const extractPythonCode = (markdown: string): string => {
    if (!markdown) return '';
    const match = markdown.match(/```python([\s\S]*?)```/i);
    return match ? match[1].trim() : (markdown.includes('import matplotlib') ? markdown : '');
  };

  // Extract python code for OutputPanel
  const currentPythonCode = React.useMemo(() => {
    return extractPythonCode(result?.markdown || '');
  }, [result]);

  return (
    // FIX 1: h-screen and overflow-hidden on root
    <div 
      className={`h-screen w-screen overflow-hidden font-sans flex ${darkMode ? 'dark bg-zinc-950 text-slate-200' : 'bg-slate-50 text-slate-900'}`}
      style={{ contain: 'layout' }}
    >
      
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
        // Group management
        groups={groups}
        onCreateGroup={createGroup}
        onDeleteGroup={deleteGroup}
        onRenameGroup={renameGroup}
        onToggleGroupCollapse={toggleGroupCollapse}
        onMoveProjectToGroup={moveProjectToGroup}
        onBatchDeleteProjects={batchDeleteProjects}
        onBatchMoveProjects={batchMoveProjects}
        // Language
        language={language}
        onToggleLanguage={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
      />

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full transform-gpu" style={{ contain: 'strict' }}>
        
        {projects.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 dark:text-slate-500">
             <Layout className="w-16 h-16 mb-4 opacity-20" />
             <p className="text-lg font-medium">Select or create a project to begin.</p>
          </div>
        ) : (
          <div 
            ref={mainRef}
            className="flex-1 flex overflow-hidden relative"
            style={{ contain: 'layout style' }}
          >
             
             {/* LEFT COLUMN: Visuals (Source + Output) */}
             <div 
               ref={leftColRef}
               style={{ width: `${leftPanelWidth}%`, contain: 'layout' }} 
               className="flex flex-col min-w-[300px] h-full bg-slate-50 dark:bg-zinc-950 border-r border-slate-200 dark:border-zinc-800 shrink-0 relative"
             >
                {/* Top: Source Image */}
                <div style={{ height: `${sourcePanelHeight}%`, contain: 'layout' }} className="flex-shrink-0 min-h-[200px] flex flex-col">
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
                  className="h-1.5 w-full cursor-row-resize bg-slate-100 dark:bg-zinc-800 hover:bg-indigo-500 hover:scale-y-110 transition-transform z-20 flex items-center justify-center group -mt-[1px]"
                  onMouseDown={handleMouseDown('vertical')}
                >
                   <div className="w-8 h-1 bg-slate-300 dark:bg-zinc-700 rounded-full group-hover:bg-white/50" />
                </div>

                {/* Bottom: Output Plot */}
                <div className="flex-1 min-h-0 flex flex-col border-t border-slate-200 dark:border-zinc-800" style={{ contain: 'layout' }}>
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
                      // Prevent duplicate callbacks for the same render
                      const hash = base64.slice(-100);  // Use last 100 chars as simple hash
                      if (hash === lastRenderedHashRef.current) {
                        console.log('[onPlotRendered] Skipped - duplicate render');
                        return;
                      }
                      lastRenderedHashRef.current = hash;
                      
                      // Save rendered image to the latest code version
                      if (activeProjectId) {
                        saveRenderedImageToHistory(activeProjectId, base64, svgBase64);
                      }
                      // Reset error fix counter on successful render
                      errorFixCountRef.current = 0;
                      if (runModeRef.current !== 'simple') handleAutoRefinementTrigger(base64);
                    }}
                    onPlotRuntimeError={(errorText) => {
                      if (runModeRef.current !== 'simple') {
                        handleAutoRefinementErrorTrigger(errorText);
                        return;
                      }
                      // In simple mode, use quick error fix
                      handleQuickErrorFix(errorText);
                    }}
                    pythonCode={currentPythonCode}
                    selectedImage={selectedImage}
                    onShowToast={addToast}
                    projectName={activeProject?.name || 'plot'}
                    codeIteration={(activeProject?.codeHistory?.length || 0)}
                    plotHistory={plotHistory}
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
             <div className="flex-1 min-w-0 h-full bg-white dark:bg-zinc-900 flex flex-col" style={{ contain: 'layout' }}>
                <AnalysisView 
                  key={activeProjectId}
                  status={status}
                  result={result}
                  renderLogs={renderLogs}
                  renderError={renderError}
                  workflowLogs={workflowLogs}
                  onShowToast={addToast}
                  codeHistory={activeProject?.codeHistory || []}
                  plotHistory={plotHistory}
                  projectName={activeProject?.name || 'plot'}
                  onManualFix={handleManualFix}
                  isFixing={isManualFixing}
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
