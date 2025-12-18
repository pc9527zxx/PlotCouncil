import { useCallback, useRef } from 'react';
import { WorkflowLogEntry, Project } from '../types';

// Deduplication window in milliseconds
const DEDUP_WINDOW_MS = 3000;

export const useWorkflowLog = (
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>
) => {
  const lastLogRef = useRef<{ key: string; timestamp: number } | null>(null);

  const addWorkflowLog = useCallback((
    projectId: string,
    type: WorkflowLogEntry['type'],
    message: string,
    agent?: string,
    details?: string
  ) => {
    // Deduplication: skip if same message within window
    const logKey = `${type}-${agent || ''}-${message}`;
    const now = Date.now();
    if (lastLogRef.current && 
        lastLogRef.current.key === logKey && 
        now - lastLogRef.current.timestamp < DEDUP_WINDOW_MS) {
      return;
    }
    lastLogRef.current = { key: logKey, timestamp: now };

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
        updatedAt: now
      };
    }));
  }, [setProjects]);

  const clearWorkflowLogs = useCallback((projectId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        workflowLogs: [],
        updatedAt: Date.now()
      };
    }));
  }, [setProjects]);

  return { addWorkflowLog, clearWorkflowLogs };
};
