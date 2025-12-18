import { useEffect, useCallback } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;  // Cmd on Mac
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[], enabled = true) => {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;
    
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : true;
      const metaMatch = shortcut.meta ? e.metaKey : true;
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = shortcut.alt ? e.altKey : !e.altKey;
      
      if (e.key.toLowerCase() === shortcut.key.toLowerCase() && 
          ctrlMatch && metaMatch && shiftMatch && altMatch) {
        e.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

// Common shortcuts
export const createCommonShortcuts = (actions: {
  analyze?: () => void;
  newProject?: () => void;
  toggleDarkMode?: () => void;
  openSettings?: () => void;
  downloadCode?: () => void;
}): KeyboardShortcut[] => {
  const shortcuts: KeyboardShortcut[] = [];
  
  if (actions.analyze) {
    shortcuts.push({
      key: 'Enter',
      ctrl: true,
      action: actions.analyze,
      description: 'Run analysis (Ctrl+Enter)'
    });
  }
  
  if (actions.newProject) {
    shortcuts.push({
      key: 'n',
      ctrl: true,
      action: actions.newProject,
      description: 'New project (Ctrl+N)'
    });
  }
  
  if (actions.toggleDarkMode) {
    shortcuts.push({
      key: 'd',
      ctrl: true,
      shift: true,
      action: actions.toggleDarkMode,
      description: 'Toggle dark mode (Ctrl+Shift+D)'
    });
  }
  
  if (actions.openSettings) {
    shortcuts.push({
      key: ',',
      ctrl: true,
      action: actions.openSettings,
      description: 'Open settings (Ctrl+,)'
    });
  }
  
  if (actions.downloadCode) {
    shortcuts.push({
      key: 's',
      ctrl: true,
      action: actions.downloadCode,
      description: 'Download code (Ctrl+S)'
    });
  }
  
  return shortcuts;
};
