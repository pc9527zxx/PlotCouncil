import { openDB, type DBSchema } from 'idb';
import { Project, PlotSnapshot, PlotImage, AnalysisResult } from '../types';

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
    renderCount: 0,
    generatedPlotBase64: null,
    renderLogs: '',
    renderError: '',
  };
};

const normalizeProject = (raw: any): Project | null => {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  const now = Date.now();
  const plotHistory = normalizePlotHistory(raw.plotHistory);
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
    renderCount,
    generatedPlotBase64: typeof raw.generatedPlotBase64 === 'string' ? raw.generatedPlotBase64 : null,
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
