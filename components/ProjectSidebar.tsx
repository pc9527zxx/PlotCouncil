import React, { useState, useMemo, useCallback, memo } from 'react';
import { 
  Plus, Folder, Settings, Github, PanelLeftClose, PanelLeftOpen, FolderOpen, Sun, Moon, 
  BookOpen, Pencil, Trash2, Cpu, ChevronDown, Check, Loader2, X, CheckSquare, Square,
  FolderPlus, ChevronRight, FolderInput, Minus, MinusSquare, Languages
} from 'lucide-react';
import { Project, ProjectGroup, AnalysisStatus } from '../types';
import { ModelConfig } from '../services/projectStore';
import { Language, t, formatRelativeTime } from '../services/i18n';

// Helper to check if a project is running
const isProjectRunning = (status?: AnalysisStatus): boolean => {
  if (!status) return false;
  return status !== AnalysisStatus.IDLE && 
         status !== AnalysisStatus.SUCCESS && 
         status !== AnalysisStatus.ERROR;
};

interface ProjectSidebarProps {
  projects: Project[]; 
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onDeleteProject?: (id: string) => void;
  onRenameProject?: (id: string, name: string) => void;
  onOpenDocs?: () => void;
  darkMode?: boolean;
  onToggleTheme?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSettings: () => void;
  // Model selection
  modelConfigs?: ModelConfig[];
  selectedConfigId?: string;
  onSelectConfig?: (id: string) => void;
  // Group management
  groups?: ProjectGroup[];
  onCreateGroup?: () => void;
  onDeleteGroup?: (id: string) => void;
  onRenameGroup?: (id: string, name: string) => void;
  onToggleGroupCollapse?: (id: string) => void;
  onMoveProjectToGroup?: (projectId: string, groupId: string | null) => void;
  onBatchDeleteProjects?: (ids: string[]) => void;
  onBatchMoveProjects?: (ids: string[], groupId: string | null) => void;
  // Language
  language?: Language;
  onToggleLanguage?: () => void;
}

const getRelativeTime = (timestamp: number) => {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const ProjectSidebar: React.FC<ProjectSidebarProps> = memo(({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onRenameProject,
  onOpenDocs,
  darkMode,
  onToggleTheme,
  collapsed,
  onToggleCollapse,
  onOpenSettings,
  modelConfigs = [],
  selectedConfigId = '',
  onSelectConfig,
  groups = [],
  onCreateGroup,
  onDeleteGroup,
  onRenameGroup,
  onToggleGroupCollapse,
  onMoveProjectToGroup,
  onBatchDeleteProjects,
  onBatchMoveProjects,
  language = 'zh' as Language,
  onToggleLanguage
}) => {
  const [editingId, setEditingId] = useState<string>('');
  const [editingType, setEditingType] = useState<'project' | 'group'>('project');
  const [draftName, setDraftName] = useState<string>('');
  const [showModelMenu, setShowModelMenu] = useState(false);
  
  // Multi-select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Context menu for move to group
  const [showMoveMenu, setShowMoveMenu] = useState<string | null>(null);
  
  // Drag and drop state
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null); // null means "ungrouped" area

  const currentModel = modelConfigs.find(c => c.id === selectedConfigId);

  // Organize projects by group
  const { ungroupedProjects, groupedProjects } = useMemo(() => {
    const ungrouped = projects.filter(p => !p.groupId);
    const grouped = new Map<string, Project[]>();
    
    groups.forEach(g => grouped.set(g.id, []));
    projects.forEach(p => {
      if (p.groupId && grouped.has(p.groupId)) {
        grouped.get(p.groupId)!.push(p);
      }
    });
    
    return { ungroupedProjects: ungrouped, groupedProjects: grouped };
  }, [projects, groups]);

  const startEditing = (id: string, name: string, type: 'project' | 'group' = 'project') => {
    setEditingId(id);
    setEditingType(type);
    setDraftName(name);
  };

  const commitEdit = () => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setEditingId('');
      return;
    }
    
    if (editingType === 'project' && onRenameProject) {
      onRenameProject(editingId, trimmed);
    } else if (editingType === 'group' && onRenameGroup) {
      onRenameGroup(editingId, trimmed);
    }
    setEditingId('');
  };

  const cancelEdit = () => {
    setEditingId('');
    setDraftName('');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(projects.map(p => p.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setShowMoveMenu(null);
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (onBatchDeleteProjects) {
      onBatchDeleteProjects(Array.from(selectedIds));
    } else if (onDeleteProject) {
      selectedIds.forEach(id => onDeleteProject(id));
    }
    exitSelectMode();
  };

  const handleBatchMove = (groupId: string | null) => {
    if (selectedIds.size === 0) return;
    if (onBatchMoveProjects) {
      onBatchMoveProjects(Array.from(selectedIds), groupId);
    } else if (onMoveProjectToGroup) {
      selectedIds.forEach(id => onMoveProjectToGroup(id, groupId));
    }
    setShowMoveMenu(null);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    setDraggedProjectId(projectId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', projectId);
    // Add a slight delay to show dragging state
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDraggedProjectId(null);
    setDragOverGroupId(null);
  };

  const handleDragOver = (e: React.DragEvent, groupId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverGroupId !== groupId) {
      setDragOverGroupId(groupId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only reset if leaving the actual target, not entering a child
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverGroupId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetGroupId: string | null) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData('text/plain');
    if (projectId && onMoveProjectToGroup) {
      onMoveProjectToGroup(projectId, targetGroupId);
    }
    setDraggedProjectId(null);
    setDragOverGroupId(null);
  };

  // Render a single project item
  const renderProjectItem = (project: Project, inGroup = false) => {
    const isSelected = selectedIds.has(project.id);
    const isActive = activeProjectId === project.id;
    const isEditing = editingId === project.id && editingType === 'project';
    const isDragging = draggedProjectId === project.id;

    return (
      <div
        key={project.id}
        draggable={!selectMode && !isEditing && !collapsed}
        onDragStart={(e) => handleDragStart(e, project.id)}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (selectMode) {
            toggleSelect(project.id);
          } else {
            onSelectProject(project.id);
          }
        }}
        className={`
          w-full text-left rounded-md transition-colors duration-150 group relative cursor-pointer
          ${collapsed ? 'p-2 flex justify-center' : 'px-3 py-2 flex items-center gap-2'}
          ${inGroup && !collapsed ? 'pl-7' : ''}
          ${isDragging ? 'opacity-50 ring-2 ring-indigo-400' : ''}
          ${isActive && !selectMode
            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/50'
            : isSelected
            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
            : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 border border-transparent'}
        `}
      >
        {/* Selection checkbox */}
        {selectMode && !collapsed && (
          <button onClick={(e) => { e.stopPropagation(); toggleSelect(project.id); }} className="shrink-0 mr-1">
            {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-blue-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        )}

        {/* Folder icon */}
        {isActive && !selectMode ? (
          <FolderOpen className={`shrink-0 ${collapsed ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-indigo-600 dark:text-indigo-400`} />
        ) : (
          <Folder className={`shrink-0 ${collapsed ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-slate-400 group-hover:text-slate-500`} />
        )}
        
        {!collapsed && (
          <div className="flex-1 min-w-0 overflow-hidden flex items-center gap-2">
            {isEditing ? (
              <div className="flex items-center gap-1 w-full">
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit();
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  autoFocus
                  className="flex-1 text-xs bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-700 rounded px-2 py-1 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); commitEdit(); }}
                  className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition-colors"
                  title={t('sidebar.confirmSave', language)}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                  title={t('sidebar.cancelEdit', language)}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="text-xs font-medium truncate text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white flex items-center gap-1.5">
                    {project.name}
                    {isProjectRunning(project.status) && (
                      <Loader2 className="w-3 h-3 text-indigo-500 animate-spin shrink-0" />
                    )}
                  </div>
                  <div className="text-[9px] text-slate-400 truncate mt-0.5 font-medium opacity-80" title={new Date(project.updatedAt).toLocaleString()}>
                    {isProjectRunning(project.status) 
                      ? <span className="text-indigo-500">{t('time.running', language)}</span>
                      : formatRelativeTime(project.updatedAt, language)
                    }
                  </div>
                </div>
                {!selectMode && (
                  <div className="flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100">
                    {onMoveProjectToGroup && groups.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowMoveMenu(showMoveMenu === project.id ? null : project.id); }}
                          className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                          title={t('sidebar.moveToGroup', language)}
                        >
                          <FolderInput className="w-3.5 h-3.5" />
                        </button>
                        {showMoveMenu === project.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowMoveMenu(null)} />
                            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 min-w-[140px] py-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); onMoveProjectToGroup(project.id, null); setShowMoveMenu(null); }}
                                className="w-full px-3 py-1.5 text-left text-[10px] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                              >
                                <Minus className="w-3 h-3" /> {t('sidebar.removeFromGroup', language)}
                              </button>
                              {groups.map(g => (
                                <button
                                  key={g.id}
                                  onClick={(e) => { e.stopPropagation(); onMoveProjectToGroup(project.id, g.id); setShowMoveMenu(null); }}
                                  className="w-full px-3 py-1.5 text-left text-[10px] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                                >
                                  <Folder className="w-3 h-3" /> {g.name}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {onRenameProject && (
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditing(project.id, project.name, 'project'); }}
                        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
                        title={t('sidebar.rename', language)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onDeleteProject && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                        className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded transition-colors"
                        title={t('sidebar.deleteProject', language)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        {/* Tooltip for collapsed state */}
        {collapsed && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-slate-800 text-white text-[10px] px-3 py-2 rounded-md shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 animate-in fade-in slide-in-from-left-1 duration-200">
            <div className="font-bold mb-0.5">{project.name}</div>
            <div className="text-slate-400 font-normal text-[9px]">{formatRelativeTime(project.updatedAt, language)}</div>
          </div>
        )}
      </div>
    );
  };

  // Use fixed width + negative margin for GPU-accelerated animation
  // This avoids layout thrashing compared to animating width directly
  const sidebarWidth = 300;
  const collapsedWidth = 64;
  const translateX = collapsed ? -(sidebarWidth - collapsedWidth) : 0;

  return (
    <aside 
      style={{ 
        width: sidebarWidth,
        transform: `translateX(${translateX}px)`,
        marginRight: collapsed ? -(sidebarWidth - collapsedWidth) : 0,
      }}
      className="h-full bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 flex flex-col border-r border-slate-200 dark:border-slate-800 flex-shrink-0 z-40 transform-gpu transition-[transform,margin] duration-200 ease-out will-change-transform"
    >
      {/* 1. Unified App Header (Logo + Controls) */}
      <div 
        className={`
          ${collapsed ? 'flex flex-col items-center py-4 gap-4 h-auto' : 'grid grid-cols-[auto,1fr,auto] items-center h-12 px-3'}
          shrink-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-zinc-900/50 transition-all duration-200
        `}
      >
         {!collapsed ? (
            <>
              {/* Logo */}
              <div className="flex items-center gap-2 min-w-0">
                <img 
                  src="/plotcouncil-logo.jpeg" 
                  alt="PlotCouncil logo" 
                  className="w-8 h-8 rounded-xl border border-white/60 shadow-sm shadow-indigo-500/30 object-cover"
                />
                <span className="font-bold text-slate-800 dark:text-slate-100 text-xs tracking-tight whitespace-nowrap">PlotCouncil</span>
              </div>

              {/* Spacer column to keep toolbar off the brand */}
              <div aria-hidden className="h-px" />

              {/* Right Side Tools */}
              <div className="flex items-center gap-1">
                  <button onClick={onOpenDocs} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" title={t('sidebar.productGuide', language)}>
                    <BookOpen className="w-3.5 h-3.5" />
                 </button>
                 <button onClick={() => window.open('https://github.com', '_blank')} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" title="GitHub">
                    <Github className="w-3.5 h-3.5" />
                 </button>
                 <button onClick={onToggleLanguage} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" title={language === 'zh' ? 'Switch to English' : '切换到中文'}>
                    <Languages className="w-3.5 h-3.5" />
                 </button>
                 <button onClick={onToggleTheme} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" title={t('sidebar.theme', language)}>
                    {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                 </button>
                 <button onClick={onOpenSettings} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" title={t('sidebar.settings', language)}>
                    <Settings className="w-3.5 h-3.5" />
                 </button>
                 <div className="w-px h-3 bg-slate-300 dark:bg-slate-700 mx-1" />
                 <button 
                   onClick={onToggleCollapse} 
                   className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1 rounded-md transition-colors"
                   title={t('sidebar.collapse', language)}
                 >
                   <PanelLeftClose className="w-3.5 h-3.5" />
                 </button>
              </div>
            </>
         ) : (
            <>
                <img 
                  src="/plotcouncil-logo.jpeg" 
                  alt="PlotCouncil logo" 
                  className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm object-cover" 
                />
                <button 
                  onClick={onToggleCollapse} 
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-md transition-colors"
                  title={t('sidebar.expand', language)}
                >
                    <PanelLeftOpen className="w-5 h-5" />
                </button>
                
                <div className="w-8 h-px bg-slate-200 dark:bg-slate-800" />
                
                <div className="flex flex-col gap-3">
                   <button onClick={onOpenDocs} className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title={t('sidebar.productGuide', language)}>
                      <BookOpen className="w-4 h-4" />
                   </button>
                   <button onClick={onToggleLanguage} className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title={language === 'zh' ? 'EN' : '中'}>
                      <Languages className="w-4 h-4" />
                   </button>
                   <button onClick={onOpenSettings} className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title={t('sidebar.settings', language)}>
                      <Settings className="w-4 h-4" />
                   </button>
                   <button onClick={onToggleTheme} className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title={t('sidebar.theme', language)}>
                      {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                   </button>
                </div>
            </>
         )}
      </div>

      {/* 2. Projects Header + Actions */}
      <div className={`flex items-center ${collapsed ? 'justify-center py-3 border-b border-slate-200 dark:border-slate-800' : 'justify-between px-3 py-2'} shrink-0`}>
         {!collapsed ? (
            <>
               <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                 {t('sidebar.projects', language)} {selectMode && selectedIds.size > 0 && <span className="text-blue-600">({selectedIds.size})</span>}
               </span>
               <div className="flex items-center gap-1">
                 {/* Multi-select toggle */}
                 <button 
                   onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
                   className={`p-1 rounded transition-colors ${selectMode ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600'}`}
                   title={selectMode ? t('sidebar.exitMultiSelect', language) : t('sidebar.multiSelect', language)}
                 >
                   <CheckSquare className="w-3.5 h-3.5" />
                 </button>
                 {/* Create group */}
                 {onCreateGroup && (
                   <button 
                     onClick={onCreateGroup}
                     className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                     title={t('sidebar.newGroup', language)}
                   >
                     <FolderPlus className="w-3.5 h-3.5" />
                   </button>
                 )}
                 {/* Create project */}
                 <button 
                   onClick={onCreateProject}
                   className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                   title={t('sidebar.newProject', language)}
                 >
                   <Plus className="w-3.5 h-3.5" />
                 </button>
               </div>
            </>
         ) : (
            <button 
              onClick={onCreateProject}
              className="w-8 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 transition-colors active:scale-95 group"
              title="New Project"
            >
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
            </button>
         )}
      </div>

      {/* 3. Multi-select action bar */}
      {selectMode && !collapsed && (
        <div className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-900/10 flex items-center gap-1.5">
          {/* Toggle all checkbox with text label */}
          <button 
            onClick={() => selectedIds.size === projects.length ? selectNone() : selectAll()}
            className="flex items-center gap-1.5 px-1.5 py-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
            title={t('sidebar.selectAll', language)}
          >
            {selectedIds.size === 0 ? (
              <>
                <Square className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] text-slate-500">{t('sidebar.selectAll', language)}</span>
              </>
            ) : selectedIds.size === projects.length ? (
              <>
                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[10px] text-blue-600">{t('sidebar.allSelected', language)} ({projects.length})</span>
              </>
            ) : (
              <>
                <MinusSquare className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[10px] text-blue-500">{t('sidebar.selected', language)} {selectedIds.size}/{projects.length}</span>
              </>
            )}
          </button>
          <div className="flex-1" />
          {/* Batch move */}
          {groups.length > 0 && selectedIds.size > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowMoveMenu(showMoveMenu === 'batch' ? null : 'batch')}
                className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                title={t('sidebar.batchMove', language)}
              >
                <FolderInput className="w-3.5 h-3.5" />
              </button>
              {showMoveMenu === 'batch' && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoveMenu(null)} />
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 min-w-[140px] py-1">
                    <button
                      onClick={() => handleBatchMove(null)}
                      className="w-full px-3 py-1.5 text-left text-[10px] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                    >
                      <Minus className="w-3 h-3" /> {t('sidebar.removeFromGroup', language)}
                    </button>
                    {groups.map(g => (
                      <button
                        key={g.id}
                        onClick={() => handleBatchMove(g.id)}
                        className="w-full px-3 py-1.5 text-left text-[10px] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                      >
                        <Folder className="w-3 h-3" /> {g.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {/* Batch delete */}
          {selectedIds.size > 0 && (
            <button onClick={handleBatchDelete} className="p-1 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded" title={t('sidebar.batchDelete', language)}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Exit select mode */}
          <button 
            onClick={exitSelectMode}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            title={t('sidebar.exitMultiSelect', language)}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4. Project List */}
       <div className="flex-1 overflow-y-auto px-2 custom-scrollbar space-y-0.5 py-2 transform-gpu"
         style={{ contain: 'strict', contentVisibility: 'auto' }}>
        {/* Render groups first */}
        {!collapsed && groups.map((group) => {
          const groupProjects = groupedProjects.get(group.id) || [];
          const isEditingGroup = editingId === group.id && editingType === 'group';
          const isDragOver = dragOverGroupId === group.id;
          
          return (
            <div 
              key={group.id} 
              className={`mb-1 rounded-lg transition-shadow ${isDragOver ? 'ring-2 ring-indigo-400 ring-offset-1 bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}
              onDragOver={(e) => handleDragOver(e, group.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, group.id)}
            >
              {/* Group header */}
              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer group hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors ${isDragOver ? 'bg-indigo-100 dark:bg-indigo-900/30' : ''}`}>
                <button onClick={() => onToggleGroupCollapse?.(group.id)} className="shrink-0 p-0.5 text-slate-400 hover:text-slate-600">
                  <ChevronRight className={`w-3 h-3 transition-transform ${group.collapsed ? '' : 'rotate-90'}`} />
                </button>
                
                {isEditingGroup ? (
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                      className="flex-1 text-[10px] bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-700 rounded px-2 py-0.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); commitEdit(); }}
                      className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition-colors"
                      title={t('sidebar.confirmSave', language)}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                      className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                      title={t('sidebar.cancelEdit', language)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span onClick={() => onToggleGroupCollapse?.(group.id)} className="flex-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {group.name} <span className="font-normal opacity-60">({groupProjects.length})</span>
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                      {onRenameGroup && (
                        <button onClick={(e) => { e.stopPropagation(); startEditing(group.id, group.name, 'group'); }} className="p-0.5 text-slate-400 hover:text-indigo-600 rounded" title={t('sidebar.renameGroup', language)}>
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      {onDeleteGroup && (
                        <button onClick={(e) => { e.stopPropagation(); onDeleteGroup(group.id); }} className="p-0.5 text-slate-400 hover:text-rose-500 rounded" title={t('sidebar.deleteGroup', language)}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              
              {/* Group projects */}
              {!group.collapsed && groupProjects.map((project) => renderProjectItem(project, true))}
              
              {/* Empty drop hint when dragging over collapsed or empty group */}
              {isDragOver && (group.collapsed || groupProjects.length === 0) && (
                <div className="px-7 py-2 text-[10px] text-indigo-500 border-2 border-dashed border-indigo-300 dark:border-indigo-600 rounded-md mx-2 mb-1 text-center">
                  {t('sidebar.dropToAdd', language)}
                </div>
              )}
            </div>
          );
        })}
        
        {/* Ungrouped projects area */}
        <div 
          className={`rounded-lg transition-shadow ${dragOverGroupId === 'ungrouped' ? 'ring-2 ring-slate-400 ring-offset-1 bg-slate-50 dark:bg-slate-900/50' : ''}`}
          onDragOver={(e) => handleDragOver(e, 'ungrouped')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, null)}
        >
          {/* Show "Ungrouped" label when there are groups */}
          {!collapsed && groups.length > 0 && ungroupedProjects.length > 0 && (
            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t('sidebar.ungrouped', language)}
            </div>
          )}
          {ungroupedProjects.map(p => renderProjectItem(p, false))}
          
          {/* Drop hint for ungrouped area when dragging */}
          {draggedProjectId && dragOverGroupId === 'ungrouped' && (
            <div className="px-3 py-2 text-[10px] text-slate-500 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-md text-center">
              {t('sidebar.dropToUngroup', language)}
            </div>
          )}
        </div>
      </div>

      {/* Model Selector at Bottom */}
      {modelConfigs.length > 0 && (
        <div className={`shrink-0 border-t border-slate-200 dark:border-slate-800 ${collapsed ? 'p-2' : 'p-3'}`}>
          {!collapsed ? (
            <div className="relative">
              <button
                onClick={() => setShowModelMenu(!showModelMenu)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors text-left group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${currentModel?.apiKey ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">
                    {currentModel?.modelId || t('sidebar.selectModel', language)}
                  </span>
                </div>
                <ChevronDown className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showModelMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowModelMenu(false)} />
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                    {modelConfigs.map((config) => (
                      <button
                        key={config.id}
                        onClick={() => {
                          onSelectConfig?.(config.id);
                          setShowModelMenu(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                          selectedConfigId === config.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                        }`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.apiKey ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                        <span className={`text-[10px] font-medium truncate flex-1 ${selectedConfigId === config.id ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {config.modelId}
                        </span>
                        {selectedConfigId === config.id && (
                          <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        )}
                      </button>
                    ))}
                    <div className="border-t border-slate-100 dark:border-zinc-800">
                      <button
                        onClick={() => {
                          setShowModelMenu(false);
                          onOpenSettings();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors rounded-b-lg"
                      >
                        <Settings className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{t('sidebar.manageModels', language)}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenSettings}
              className={`w-full flex justify-center p-2 rounded-lg transition-colors ${currentModel ? 'bg-slate-100 dark:bg-zinc-800' : 'bg-rose-100 dark:bg-rose-900/30'}`}
              title={currentModel?.modelId || t('sidebar.configureModel', language)}
            >
              <Cpu className={`w-4 h-4 ${currentModel?.apiKey ? 'text-emerald-600' : 'text-rose-500'}`} />
            </button>
          )}
        </div>
      )}
    </aside>
  );
});

// Display name for debugging
ProjectSidebar.displayName = 'ProjectSidebar';
