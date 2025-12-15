import React from 'react';
import { X, Key, Cpu, Moon, Sun, Monitor } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  model: string;
  setModel: (model: string) => void;
  darkMode: boolean;
  toggleTheme: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  setApiKey,
  model,
  setModel,
  darkMode,
  toggleTheme
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden transform scale-100 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
          <h2 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Monitor className="w-4 h-4 text-indigo-500" />
            System Configuration
          </h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* API Key Section */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-2">
              <Key className="w-3.5 h-3.5" /> Gemini API Key
            </label>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-mono"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className={`w-2 h-2 rounded-full ${apiKey ? 'bg-emerald-500' : 'bg-rose-400'}`} />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Your key is stored locally in your browser. Leave empty to run in 
              <span className="font-bold text-amber-600 dark:text-amber-500 ml-1">Simulation Mode</span>.
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5" /> Model Engine
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'gemini-3-pro-preview', label: 'Gemini 3.0 Pro' },
                { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`
                    flex flex-col items-start p-3 rounded-lg border text-left transition-all
                    ${model === m.id
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-500/20'
                      : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-zinc-700'}
                  `}
                >
                  <span className={`text-xs font-bold ${model === m.id ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    {m.label}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">
                    {m.id.includes('pro') ? 'Reasoning optimized' : 'Speed optimized'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Appearance */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-zinc-800">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Interface Theme
            </span>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-zinc-800 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
            >
              {darkMode ? (
                <>
                  <Moon className="w-3.5 h-3.5" /> Dark Mode
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5" /> Light Mode
                </>
              )}
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-zinc-950/50 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
