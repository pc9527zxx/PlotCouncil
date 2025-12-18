import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, FolderPlus, Save, Download, Upload, Settings, 
  Sun, Moon, BookOpen, Languages, HelpCircle, Info,
  Play, Square, RotateCcw, Zap, Users, Code, Image,
  ChevronDown, Check, ExternalLink, Cpu
} from 'lucide-react';
import { Language, t } from '../services/i18n';
import { ModelConfig } from '../services/projectStore';

interface MenuBarProps {
  // File operations
  onNewProject: () => void;
  onNewGroup?: () => void;
  onOpenSettings: () => void;
  onOpenDocs: () => void;
  // Theme
  darkMode: boolean;
  onToggleTheme: () => void;
  // Language
  language: Language;
  onToggleLanguage: () => void;
  // Model
  modelConfigs?: ModelConfig[];
  selectedConfigId?: string;
  onSelectConfig?: (id: string) => void;
  // Run controls
  onStartAnalysis?: () => void;
  onStopAnalysis?: () => void;
  isRunning?: boolean;
  canRun?: boolean;
  // Project info
  projectName?: string;
}

interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  shortcut?: string;
  divider?: boolean;
  disabled?: boolean;
  submenu?: MenuItem[];
  checked?: boolean;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  onNewProject,
  onNewGroup,
  onOpenSettings,
  onOpenDocs,
  darkMode,
  onToggleTheme,
  language,
  onToggleLanguage,
  modelConfigs = [],
  selectedConfigId,
  onSelectConfig,
  onStartAnalysis,
  onStopAnalysis,
  isRunning,
  canRun,
  projectName,
}) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentModel = modelConfigs.find(c => c.id === selectedConfigId);

  const menus: { id: string; label: string; items: MenuItem[] }[] = [
    {
      id: 'file',
      label: language === 'zh' ? '文件' : 'File',
      items: [
        { 
          label: language === 'zh' ? '新建项目' : 'New Project', 
          icon: <FileText className="w-3.5 h-3.5" />, 
          onClick: onNewProject,
          shortcut: '⌘N'
        },
        ...(onNewGroup ? [{ 
          label: language === 'zh' ? '新建分组' : 'New Group', 
          icon: <FolderPlus className="w-3.5 h-3.5" />, 
          onClick: onNewGroup 
        }] : []),
        { divider: true, label: '' },
        { 
          label: language === 'zh' ? '设置' : 'Settings', 
          icon: <Settings className="w-3.5 h-3.5" />, 
          onClick: onOpenSettings,
          shortcut: '⌘,'
        },
      ]
    },
    {
      id: 'view',
      label: language === 'zh' ? '视图' : 'View',
      items: [
        { 
          label: darkMode ? (language === 'zh' ? '浅色模式' : 'Light Mode') : (language === 'zh' ? '深色模式' : 'Dark Mode'),
          icon: darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />,
          onClick: onToggleTheme 
        },
        { 
          label: language === 'zh' ? 'English' : '中文',
          icon: <Languages className="w-3.5 h-3.5" />,
          onClick: onToggleLanguage 
        },
      ]
    },
    {
      id: 'run',
      label: language === 'zh' ? '运行' : 'Run',
      items: [
        { 
          label: language === 'zh' ? '开始分析' : 'Start Analysis', 
          icon: <Play className="w-3.5 h-3.5" />, 
          onClick: onStartAnalysis,
          shortcut: '⌘⏎',
          disabled: !canRun || isRunning
        },
        { 
          label: language === 'zh' ? '停止' : 'Stop', 
          icon: <Square className="w-3.5 h-3.5" />, 
          onClick: onStopAnalysis,
          disabled: !isRunning
        },
      ]
    },
    {
      id: 'help',
      label: language === 'zh' ? '帮助' : 'Help',
      items: [
        { 
          label: language === 'zh' ? '使用文档' : 'Documentation', 
          icon: <BookOpen className="w-3.5 h-3.5" />, 
          onClick: onOpenDocs 
        },
        { divider: true, label: '' },
        { 
          label: language === 'zh' ? '关于' : 'About',
          icon: <Info className="w-3.5 h-3.5" />,
          onClick: () => window.open('https://github.com/pc9527zxx/PlotCouncil', '_blank')
        },
      ]
    },
  ];

  const handleMenuClick = (menuId: string) => {
    setOpenMenu(openMenu === menuId ? null : menuId);
  };

  const handleItemClick = (item: MenuItem) => {
    if (item.disabled) return;
    item.onClick?.();
    setOpenMenu(null);
  };

  return (
    <div 
      ref={menuBarRef}
      className="h-8 bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center px-2 select-none shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center gap-1.5 px-1 mr-2">
        <img 
          src="/plotcouncil-logo.jpeg" 
          alt="PlotCouncil" 
          className="w-5 h-5 rounded object-cover"
        />
        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 tracking-tight">
          PlotCouncil
        </span>
      </div>

      {/* Menu Items */}
      <div className="flex items-center">
        {menus.map(menu => (
          <div key={menu.id} className="relative">
            <button
              onClick={() => handleMenuClick(menu.id)}
              onMouseEnter={() => openMenu && setOpenMenu(menu.id)}
              className={`px-2.5 py-1 text-[12px] transition-colors ${
                openMenu === menu.id 
                  ? 'bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-white' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-zinc-800/50'
              }`}
            >
              {menu.label}
            </button>
            
            {/* Dropdown */}
            {openMenu === menu.id && (
              <div className="absolute left-0 top-full mt-0.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-xl z-50 min-w-[180px] py-1">
                {menu.items.map((item, idx) => 
                  item.divider ? (
                    <div key={idx} className="h-px bg-slate-200 dark:bg-zinc-700 my-1" />
                  ) : (
                    <button
                      key={idx}
                      onClick={() => handleItemClick(item)}
                      disabled={item.disabled}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors ${
                        item.disabled 
                          ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed' 
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {item.icon && <span className="w-4 flex justify-center">{item.icon}</span>}
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{item.shortcut}</span>
                      )}
                      {item.checked && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Right side: Quick actions & Model selector */}
      <div className="ml-auto flex items-center gap-0.5">
        {/* Current Project Name */}
        {projectName && (
          <span className="text-[11px] text-slate-500 dark:text-slate-500 truncate max-w-[120px] mr-2">
            {projectName}
          </span>
        )}

        {/* Divider */}
        <div className="w-px h-4 bg-slate-300 dark:bg-zinc-700 mx-1" />

        {/* Quick Action Buttons */}
        <button
          onClick={onOpenDocs}
          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-zinc-800/50 transition-colors"
          title={language === 'zh' ? '使用文档' : 'Documentation'}
        >
          <BookOpen className="w-4 h-4" />
        </button>
        
        <button
          onClick={onToggleLanguage}
          className="px-1.5 py-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-zinc-800/50 transition-colors"
          title={language === 'zh' ? '切换语言' : 'Toggle Language'}
        >
          {language === 'zh' ? 'EN' : '中'}
        </button>

        <button
          onClick={onToggleTheme}
          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-zinc-800/50 transition-colors"
          title={darkMode ? (language === 'zh' ? '浅色模式' : 'Light Mode') : (language === 'zh' ? '深色模式' : 'Dark Mode')}
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={onOpenSettings}
          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-zinc-800/50 transition-colors"
          title={language === 'zh' ? '设置' : 'Settings'}
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-slate-300 dark:bg-zinc-700 mx-1" />

        {/* Model Indicator */}
        {modelConfigs.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === 'model' ? null : 'model')}
              className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${currentModel?.apiKey ? 'bg-emerald-500' : 'bg-rose-400'}`} />
              <Cpu className="w-3 h-3" />
              <span className="max-w-[100px] truncate">{currentModel?.modelId || 'No Model'}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${openMenu === 'model' ? 'rotate-180' : ''}`} />
            </button>

            {openMenu === 'model' && (
              <div className="absolute right-0 top-full mt-0.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-xl z-50 min-w-[200px] py-1">
                {modelConfigs.map(config => (
                  <button
                    key={config.id}
                    onClick={() => {
                      onSelectConfig?.(config.id);
                      setOpenMenu(null);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800 ${
                      selectedConfigId === config.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${config.apiKey ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                    <span className={`flex-1 truncate ${selectedConfigId === config.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {config.modelId}
                    </span>
                    {selectedConfigId === config.id && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                  </button>
                ))}
                <div className="h-px bg-slate-200 dark:bg-zinc-700 my-1" />
                <button
                  onClick={() => {
                    onOpenSettings();
                    setOpenMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>{language === 'zh' ? '管理模型' : 'Manage Models'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Run Status */}
        {isRunning && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[11px]">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span>{language === 'zh' ? '运行中' : 'Running'}</span>
          </div>
        )}
      </div>
    </div>
  );
};
