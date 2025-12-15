import React, { useState } from 'react';
import { Plus, Folder, Layout, Settings, Github, PanelLeftClose, PanelLeftOpen, FolderOpen, Sun, Moon, Wrench, BookOpen, Pencil } from 'lucide-react';
import { Project } from '../types';

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

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
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
  onOpenSettings
}) => {
  const [editingId, setEditingId] = useState<string>('');
  const [draftName, setDraftName] = useState<string>('');

  const startEditing = (id: string, name: string) => {
    setEditingId(id);
    setDraftName(name);
  };

  const commitEdit = () => {
    if (!onRenameProject) return;
    const trimmed = draftName.trim();
    if (!trimmed) {
      setEditingId('');
      return;
    }
    onRenameProject(editingId, trimmed);
    setEditingId('');
  };

  const cancelEdit = () => {
    setEditingId('');
    setDraftName('');
  };

  return (
    <div 
      className={`
        h-full bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 flex flex-col border-r border-slate-200 dark:border-slate-800 flex-shrink-0 z-40 transition-all duration-300 ease-in-out
        ${collapsed ? 'w-[64px]' : 'w-[300px]'}
      `}
    >
      {/* 1. Unified App Header (Logo + Controls) */}
      <div 
        className={`
          ${collapsed ? 'flex flex-col items-center py-4 gap-4 h-auto' : 'grid grid-cols-[auto,1fr,auto] items-center h-12 px-3'}
          shrink-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-zinc-900/50 transition-all duration-300
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
                  <button onClick={onOpenDocs} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" title="Product Guide">
                    <BookOpen className="w-3.5 h-3.5" />
                 </button>
                 <button onClick={() => window.open('https://github.com', '_blank')} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" title="GitHub">
                    <Github className="w-3.5 h-3.5" />
                 </button>
                 <button onClick={onToggleTheme} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" title="Toggle Theme">
                    {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                 </button>
                 <button onClick={onOpenSettings} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" title="Settings">
                    <Settings className="w-3.5 h-3.5" />
                 </button>
                 <div className="w-px h-3 bg-slate-300 dark:bg-slate-700 mx-1" />
                 <button 
                   onClick={onToggleCollapse} 
                   className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1 rounded-md transition-colors"
                   title="Collapse Sidebar"
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
                  title="Expand Sidebar"
                >
                    <PanelLeftOpen className="w-5 h-5" />
                </button>
                
                <div className="w-8 h-px bg-slate-200 dark:bg-slate-800" />
                
                <div className="flex flex-col gap-3">
                   <button onClick={onOpenDocs} className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="User Guide">
                      <BookOpen className="w-4 h-4" />
                   </button>
                   <button onClick={onOpenSettings} className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Settings">
                      <Settings className="w-4 h-4" />
                   </button>
                   <button onClick={onToggleTheme} className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Theme">
                      {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                   </button>
                </div>
            </>
         )}
      </div>

      {/* 2. Projects Header + Add Button */}
      <div className={`flex items-center ${collapsed ? 'justify-center py-3 border-b border-slate-200 dark:border-slate-800' : 'justify-between px-3 py-2'} shrink-0`}>
         {!collapsed ? (
            <>
               <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Projects</span>
               <button 
                 onClick={onCreateProject}
                 className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
                 title="Create New Project"
               >
                 <Plus className="w-3.5 h-3.5" />
               </button>
            </>
         ) : (
            <button 
              onClick={onCreateProject}
              className="w-8 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 transition-all active:scale-95 group"
              title="New Project"
            >
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
            </button>
         )}
      </div>

      {/* 3. Project List */}
      <div className="flex-1 overflow-y-auto px-2 custom-scrollbar space-y-0.5 py-2">
         {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className={`
                w-full text-left rounded-md transition-all duration-200 group relative
                ${collapsed ? 'p-2 flex justify-center' : 'px-3 py-2 flex items-center gap-2.5'}
                ${activeProjectId === project.id
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/50'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 border border-transparent'}
              `}
            >
               {activeProjectId === project.id ? (
                 <FolderOpen className={`shrink-0 ${collapsed ? 'w-4 h-4' : 'w-3.5 h-3.5'} ${activeProjectId === project.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
               ) : (
                 <Folder className={`shrink-0 ${collapsed ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-slate-400 group-hover:text-slate-500`} />
               )}
               
               {!collapsed && (
                 <div className="flex-1 min-w-0 overflow-hidden flex items-center gap-2">
                    {editingId === project.id ? (
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
                          className="px-2 py-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                          className="px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="text-xs font-medium truncate text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white">
                            {project.name}
                          </div>
                          <div className="text-[9px] text-slate-400 truncate mt-0.5 font-medium opacity-80" title={new Date(project.updatedAt).toLocaleString()}>
                            {getRelativeTime(project.updatedAt)}
                          </div>
                        </div>
                        {onRenameProject && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(project.id, project.name);
                            }}
                            className="ml-auto p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="Rename project"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                 </div>
               )}
               
               {/* Tooltip for collapsed state */}
               {collapsed && (
                 <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-slate-800 text-white text-[10px] px-3 py-2 rounded-md shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 animate-in fade-in slide-in-from-left-1 duration-200">
                    <div className="font-bold mb-0.5">{project.name}</div>
                    <div className="text-slate-400 font-normal text-[9px]">{getRelativeTime(project.updatedAt)}</div>
                 </div>
               )}
            </button>
         ))}
      </div>
    </div>
  );
};
