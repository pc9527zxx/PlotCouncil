import { openDB, type DBSchema } from 'idb';
import { Project, PlotSnapshot, PlotImage, AnalysisResult, CodeVersion, WorkflowLogEntry } from '../types';

export interface ModelConfig {
  id: string;
  modelId: string;
  baseUrl: string;
  apiKey: string;
}

interface PlotCouncilDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
  };
  meta: {
    key: string;
    value: { key: string; value: unknown };
  };
}

const DB_NAME = 'plotcouncil';
const LEGACY_DB_NAME = 'sciplot-analyst';
const DB_VERSION = 1;
const META_ACTIVE_PROJECT_ID = 'activeProjectId';
const META_MODEL_CONFIGS = 'modelConfigs';
const META_SELECTED_CONFIG_ID = 'selectedConfigId';
const META_MAX_LOOPS = 'maxLoops';

// Legacy localStorage keys (from earlier implementation)
const LEGACY_PROJECTS_STORAGE_KEY = 'sciplot-projects-v1';
const LEGACY_ACTIVE_PROJECT_STORAGE_KEY = 'sciplot-active-project-id-v1';

const dbPromise = openDB<PlotCouncilDB>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('projects')) {
      db.createObjectStore('projects', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('meta')) {
      db.createObjectStore('meta', { keyPath: 'key' });
    }
  },
});

export const normalizePlotHistory = (items: any): PlotSnapshot[] => {
  if (!Array.isArray(items)) return [];
  return items
    .filter(Boolean)
    .map((shot: any, index: number) => {
      const created = typeof shot?.created === 'number' ? shot.created : Date.now();
      const base64 = typeof shot?.base64 === 'string' ? shot.base64 : '';
      const seq = typeof shot?.seq === 'number' ? shot.seq : index + 1;
      const id = typeof shot?.id === 'string'
        ? shot.id
        : `${created}-${Math.random().toString(16).slice(2)}`;
      return { id, created, base64, seq };
    })
    .filter(shot => Boolean(shot.base64));
};

export const createEmptyProject = (name: string): Project => {
  const now = Date.now();
  return {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    name,
    createdAt: now,
    updatedAt: now,
    selectedImage: null,
    result: null,
    errorMessage: '',
    plotHistory: [],
    codeHistory: [],
    workflowLogs: [],
    renderCount: 0,
    generatedPlotBase64: null,
    generatedSvgBase64: null,
    renderLogs: '',
    renderError: '',
  };
};

const normalizeCodeHistory = (items: any): CodeVersion[] => {
  if (!Array.isArray(items)) return [];
  return items
    .filter(Boolean)
    .map((v: any, index: number) => ({
      id: typeof v?.id === 'string' ? v.id : `${Date.now()}-${index}`,
      code: typeof v?.code === 'string' ? v.code : '',
      timestamp: typeof v?.timestamp === 'number' ? v.timestamp : Date.now(),
      source: v?.source === 'revision' ? 'revision' : 'student',
      iteration: typeof v?.iteration === 'number' ? v.iteration : index,
    } as CodeVersion))
    .filter(v => Boolean(v.code));
};

const normalizeWorkflowLogs = (items: any): WorkflowLogEntry[] => {
  if (!Array.isArray(items)) return [];
  return items
    .filter(Boolean)
    .map((v: any) => ({
      timestamp: typeof v?.timestamp === 'number' ? v.timestamp : Date.now(),
      type: ['info', 'success', 'warning', 'error', 'agent'].includes(v?.type) ? v.type : 'info',
      agent: typeof v?.agent === 'string' ? v.agent : undefined,
      message: typeof v?.message === 'string' ? v.message : '',
      details: typeof v?.details === 'string' ? v.details : undefined,
    } as WorkflowLogEntry))
    .filter(v => Boolean(v.message));
};

const normalizeProject = (raw: any): Project | null => {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  const now = Date.now();
  const plotHistory = normalizePlotHistory(raw.plotHistory);
  const codeHistory = normalizeCodeHistory(raw.codeHistory);
  const workflowLogs = normalizeWorkflowLogs(raw.workflowLogs);
  const maxSeq = plotHistory.reduce((acc, s) => Math.max(acc, s.seq || 0), 0);
  const renderCount = typeof raw.renderCount === 'number' && Number.isFinite(raw.renderCount)
    ? Math.max(raw.renderCount, maxSeq)
    : maxSeq;

  return {
    id: raw.id,
    name: raw.name,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
    selectedImage: raw.selectedImage ?? null,
    result: raw.result ?? null,
    errorMessage: typeof raw.errorMessage === 'string' ? raw.errorMessage : '',
    plotHistory,
    codeHistory,
    workflowLogs,
    renderCount,
    generatedPlotBase64: typeof raw.generatedPlotBase64 === 'string' ? raw.generatedPlotBase64 : null,
    generatedSvgBase64: typeof raw.generatedSvgBase64 === 'string' ? raw.generatedSvgBase64 : null,
    renderLogs: typeof raw.renderLogs === 'string' ? raw.renderLogs : '',
    renderError: typeof raw.renderError === 'string' ? raw.renderError : '',
  };
};

export const loadProjectsSnapshot = async (): Promise<{ projects: Project[]; activeProjectId: string | null }> => {
  const db = await dbPromise;
  const projects = await db.getAll('projects');
  projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const meta = await db.get('meta', META_ACTIVE_PROJECT_ID);
  const activeProjectId = (meta?.value as any) ?? null;

  return { projects, activeProjectId: typeof activeProjectId === 'string' ? activeProjectId : null };
};

export const saveProjectsSnapshot = async (projects: Project[], activeProjectId: string): Promise<void> => {
  const db = await dbPromise;
  const tx = db.transaction(['projects', 'meta'], 'readwrite');
  await tx.objectStore('projects').clear();
  for (const p of projects) {
    await tx.objectStore('projects').put(p);
  }
  await tx.objectStore('meta').put({ key: META_ACTIVE_PROJECT_ID, value: activeProjectId });
  await tx.done;
};

export const deleteProject = async (projectId: string): Promise<void> => {
  const db = await dbPromise;
  await db.delete('projects', projectId);
};

// === Model Configuration Storage ===

export const loadModelConfigs = async (): Promise<{ configs: ModelConfig[]; selectedConfigId: string | null; maxLoops: number }> => {
  const db = await dbPromise;
  const configsMeta = await db.get('meta', META_MODEL_CONFIGS);
  const selectedMeta = await db.get('meta', META_SELECTED_CONFIG_ID);
  const loopsMeta = await db.get('meta', META_MAX_LOOPS);

  const configs = Array.isArray(configsMeta?.value) ? configsMeta.value as ModelConfig[] : [];
  const selectedConfigId = typeof selectedMeta?.value === 'string' ? selectedMeta.value : null;
  const maxLoops = typeof loopsMeta?.value === 'number' ? loopsMeta.value : 3;

  return { configs, selectedConfigId, maxLoops };
};

export const saveModelConfigs = async (configs: ModelConfig[], selectedConfigId: string | null, maxLoops: number): Promise<void> => {
  const db = await dbPromise;
  const tx = db.transaction('meta', 'readwrite');
  await tx.store.put({ key: META_MODEL_CONFIGS, value: configs });
  await tx.store.put({ key: META_SELECTED_CONFIG_ID, value: selectedConfigId });
  await tx.store.put({ key: META_MAX_LOOPS, value: maxLoops });
  await tx.done;
};

export const migrateModelConfigsFromLocalStorage = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  
  // Check if already migrated
  const db = await dbPromise;
  const existingConfigs = await db.get('meta', META_MODEL_CONFIGS);
  if (existingConfigs?.value && Array.isArray(existingConfigs.value) && existingConfigs.value.length > 0) {
    return false; // Already have configs in IDB
  }

  // Try to load from localStorage
  const STORAGE_KEYS = {
    modelConfigs: 'plotcouncil-model-configs',
    selectedConfigId: 'plotcouncil-selected-config-id',
    maxLoops: 'plotcouncil-max-loops',
  };

  const storedConfigs = window.localStorage.getItem(STORAGE_KEYS.modelConfigs);
  const storedSelectedId = window.localStorage.getItem(STORAGE_KEYS.selectedConfigId);
  const storedLoops = window.localStorage.getItem(STORAGE_KEYS.maxLoops);

  if (!storedConfigs) return false;

  try {
    const configs = JSON.parse(storedConfigs);
    if (!Array.isArray(configs) || configs.length === 0) return false;

    const selectedConfigId = storedSelectedId || null;
    const maxLoops = storedLoops ? parseInt(storedLoops, 10) : 3;

    await saveModelConfigs(configs, selectedConfigId, maxLoops);

    // Remove from localStorage after successful migration
    window.localStorage.removeItem(STORAGE_KEYS.modelConfigs);
    window.localStorage.removeItem(STORAGE_KEYS.selectedConfigId);
    window.localStorage.removeItem(STORAGE_KEYS.maxLoops);

    console.log('Migrated model configs from localStorage to IndexedDB');
    return true;
  } catch {
    return false;
  }
};

export const migrateLegacyLocalStorageToIDB = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  const legacy = window.localStorage.getItem(LEGACY_PROJECTS_STORAGE_KEY);
  if (!legacy) return false;

  try {
    const parsed = JSON.parse(legacy);
    const legacyProjects: any[] = Array.isArray(parsed) ? parsed : [];
    const projects = legacyProjects.map(normalizeProject).filter(Boolean) as Project[];
    const fallback = projects.length ? projects : [createEmptyProject('Project 1')];

    const legacyActive = window.localStorage.getItem(LEGACY_ACTIVE_PROJECT_STORAGE_KEY);
    const activeProjectId = legacyActive && fallback.some(p => p.id === legacyActive)
      ? legacyActive
      : fallback[0].id;

    await saveProjectsSnapshot(fallback, activeProjectId);

    // Keep other localStorage keys but remove the legacy project keys.
    window.localStorage.removeItem(LEGACY_PROJECTS_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_ACTIVE_PROJECT_STORAGE_KEY);

    return true;
  } catch {
    return false;
  }
};

export const migrateLegacyIndexedDBToPlotCouncil = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  if (DB_NAME === LEGACY_DB_NAME) return false;

  try {
    const db = await dbPromise;
    const existingCount = await db.count('projects');
    if (existingCount > 0) return false;

    const legacyDb = await openDB<PlotCouncilDB>(LEGACY_DB_NAME, DB_VERSION).catch(() => null);
    if (!legacyDb) return false;

    const legacyProjects = await legacyDb.getAll('projects');
    if (!legacyProjects.length) {
      legacyDb.close();
      return false;
    }

    const normalizedProjects = legacyProjects.map(normalizeProject).filter(Boolean) as Project[];
    if (!normalizedProjects.length) {
      legacyDb.close();
      return false;
    }

    const legacyMeta = await legacyDb.get('meta', META_ACTIVE_PROJECT_ID).catch(() => null);
    const legacyActive = typeof legacyMeta?.value === 'string' ? legacyMeta.value : null;
    const activeProjectId = legacyActive && normalizedProjects.some(p => p.id === legacyActive)
      ? legacyActive
      : normalizedProjects[0].id;

    await saveProjectsSnapshot(normalizedProjects, activeProjectId);
    legacyDb.close();

    if (typeof indexedDB !== 'undefined' && typeof indexedDB.deleteDatabase === 'function') {
      indexedDB.deleteDatabase(LEGACY_DB_NAME);
    }
    return true;
  } catch {
    return false;
  }
};
