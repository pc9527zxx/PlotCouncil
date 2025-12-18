import React, { useState } from 'react';
import { Key, Cpu, Moon, Sun, Globe, Plus, Trash2, Check, Pencil, Zap, Loader2, ChevronLeft, X } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { ModelConfig } from '../services/projectStore';
import { Language, t } from '../services/i18n';

interface SettingsPanelProps {
  onBack: () => void;
  selectedConfigId: string;
  setSelectedConfigId: (id: string) => void;
  modelConfigs: ModelConfig[];
  setModelConfigs: (configs: ModelConfig[]) => void;
  darkMode: boolean;
  toggleTheme: () => void;
  language: Language;
  toggleLanguage: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  onBack,
  selectedConfigId,
  setSelectedConfigId,
  modelConfigs,
  setModelConfigs,
  darkMode,
  toggleTheme,
  language,
  toggleLanguage,
}) => {
  const [editModelId, setEditModelId] = useState('');
  const [editBaseUrl, setEditBaseUrl] = useState('');
  const [editApiKey, setEditApiKey] = useState('');
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [testingConfigId, setTestingConfigId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ configId: string; success: boolean; message: string } | null>(null);

  const resetForm = () => {
    setEditModelId('');
    setEditBaseUrl('');
    setEditApiKey('');
    setEditingConfigId(null);
    setShowForm(false);
  };

  const startAddNew = () => {
    setEditModelId('');
    setEditBaseUrl('');
    setEditApiKey('');
    setEditingConfigId(null);
    setShowForm(true);
  };

  const startEdit = (config: ModelConfig) => {
    setEditModelId(config.modelId);
    setEditBaseUrl(config.baseUrl);
    setEditApiKey(config.apiKey);
    setEditingConfigId(config.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!editModelId.trim()) return;

    if (editingConfigId) {
      const updated = modelConfigs.map(c => 
        c.id === editingConfigId 
          ? { ...c, modelId: editModelId.trim(), baseUrl: editBaseUrl.trim(), apiKey: editApiKey.trim() }
          : c
      );
      setModelConfigs(updated);
    } else {
      const configId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const newConfig: ModelConfig = {
        id: configId,
        modelId: editModelId.trim(),
        baseUrl: editBaseUrl.trim(),
        apiKey: editApiKey.trim(),
      };
      setModelConfigs([...modelConfigs, newConfig]);
      setSelectedConfigId(configId);
    }
    resetForm();
  };

  const handleDeleteConfig = (configId: string) => {
    const updated = modelConfigs.filter(c => c.id !== configId);
    setModelConfigs(updated);
    if (selectedConfigId === configId) {
      setSelectedConfigId(updated.length > 0 ? updated[0].id : '');
    }
    if (editingConfigId === configId) {
      resetForm();
    }
  };

  const handleSelectConfig = (configId: string) => {
    setSelectedConfigId(configId);
  };

  const isOpenAICompatible = (baseUrl?: string): boolean => {
    if (!baseUrl) return false;
    const url = baseUrl.toLowerCase();
    if (url.includes('googleapis.com') || url.includes('generativelanguage')) {
      return false;
    }
    const hasV1 = url.includes('/v1/') || url.endsWith('/v1') || url.includes('/v1?');
    return hasV1 || 
           url.includes('openai') || 
           url.includes('siliconflow') ||
           url.includes('openrouter') ||
           url.includes('together') ||
           url.includes('groq') ||
           url.includes('deepseek');
  };

  const getProxyUrl = (): string => {
    const envUrl = (import.meta as any).env?.VITE_RENDER_API_URL;
    if (envUrl) return envUrl.replace(/\/+$/, '');
    if (typeof window !== 'undefined') return window.location.origin;
    return 'http://localhost:8000';
  };

  const testConnection = async (config: ModelConfig) => {
    if (!config.apiKey) {
      setTestResult({ configId: config.id, success: false, message: 'No API Key set' });
      return;
    }
    setTestingConfigId(config.id);
    setTestResult(null);
    
    try {
      if (isOpenAICompatible(config.baseUrl)) {
        let text = '';
        let usedProxy = false;
        
        try {
          let baseUrl = config.baseUrl?.replace(/\/+$/, '') || '';
          const endpoint = baseUrl.includes('/chat/completions') 
            ? baseUrl 
            : `${baseUrl}/chat/completions`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
              model: config.modelId,
              messages: [{ role: 'user', content: 'Say "Hello" in one word only.' }],
              max_tokens: 10,
            }),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`API Error ${response.status}: ${errorText.slice(0, 100)}`);
          }

          const data = await response.json();
          text = data.choices?.[0]?.message?.content || '';
        } catch (directErr: any) {
          if (directErr.message === 'Failed to fetch' || directErr.name === 'AbortError') {
            usedProxy = true;
            const proxyUrl = getProxyUrl();
            const proxyResponse = await fetch(`${proxyUrl}/api/llm/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                base_url: config.baseUrl,
                api_key: config.apiKey,
                model: config.modelId,
                messages: [{ role: 'user', content: 'Say "Hello" in one word only.' }],
                max_tokens: 10,
                temperature: 0.1,
              }),
            });
            
            if (!proxyResponse.ok) {
              const errData = await proxyResponse.json().catch(() => ({ detail: 'Proxy error' }));
              throw new Error(errData.detail || 'Proxy failed');
            }
            
            const proxyData = await proxyResponse.json();
            text = proxyData.content || '';
          } else {
            throw directErr;
          }
        }

        if (text) {
          setTestResult({ 
            configId: config.id, 
            success: true, 
            message: `✓ ${usedProxy ? '(via proxy) ' : ''}"${text.slice(0, 20)}..."` 
          });
        } else {
          setTestResult({ configId: config.id, success: false, message: 'No response received' });
        }
      } else {
        const clientOptions: { apiKey: string; baseURL?: string } = { apiKey: config.apiKey };
        if (config.baseUrl?.trim()) {
          clientOptions.baseURL = config.baseUrl.trim();
        }
        const client = new GoogleGenAI(clientOptions);
        const response = await client.models.generateContent({
          model: config.modelId,
          contents: 'Say "Hello" in one word only.',
        });
        const text = response?.text || '';
        if (text) {
          setTestResult({ configId: config.id, success: true, message: `✓ "${text.slice(0, 20)}..."` });
        } else {
          setTestResult({ configId: config.id, success: false, message: 'No response received' });
        }
      }
    } catch (err: any) {
      let message = 'Connection failed';
      if (err?.message?.includes('403')) message = 'Access Denied: Invalid API Key';
      else if (err?.message?.includes('404')) message = 'Model Not Found';
      else if (err?.message?.includes('429')) message = 'Rate Limit Exceeded';
      else if (err?.message?.includes('proxy') || err?.message?.includes('Proxy')) {
        message = 'Direct call failed (CORS). Start backend: uvicorn server.main:app --reload';
      }
      else if (err?.message) message = err.message.slice(0, 80);
      setTestResult({ configId: config.id, success: false, message });
    } finally {
      setTestingConfigId(null);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-slate-400 transition-colors"
          title={language === 'zh' ? '返回' : 'Back'}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-bold text-slate-800 dark:text-white">
          {language === 'zh' ? '设置' : 'Settings'}
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        
        {/* Model Configs Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5" /> 
              {language === 'zh' ? '模型配置' : 'Model Configurations'}
            </label>
            <button
              onClick={startAddNew}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> {language === 'zh' ? '添加' : 'Add'}
            </button>
          </div>

          {/* Add/Edit Form */}
          {showForm && (
            <div className="p-3 bg-slate-100 dark:bg-zinc-800 rounded-lg space-y-2 border border-slate-200 dark:border-zinc-700">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  {editingConfigId 
                    ? (language === 'zh' ? '编辑配置' : 'Edit Configuration')
                    : (language === 'zh' ? '新建配置' : 'New Configuration')
                  }
                </span>
                <button onClick={resetForm} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Cpu className="w-3 h-3 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={editModelId}
                  onChange={(e) => setEditModelId(e.target.value)}
                  placeholder={language === 'zh' ? '模型 ID (如 gemini-2.5-flash)' : 'Model ID (e.g., gemini-2.5-flash)'}
                  className="flex-1 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded text-xs text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={editBaseUrl}
                  onChange={(e) => setEditBaseUrl(e.target.value)}
                  placeholder={language === 'zh' ? 'Base URL (可选)' : 'Base URL (optional)'}
                  className="flex-1 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded text-xs text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <Key className="w-3 h-3 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={editApiKey}
                  onChange={(e) => setEditApiKey(e.target.value)}
                  placeholder="API Key"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  className="flex-1 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded text-xs text-slate-800 dark:text-slate-200 font-mono"
                  style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties}
                />
              </div>
              <button
                onClick={handleSave}
                disabled={!editModelId.trim()}
                className="w-full px-3 py-2 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingConfigId 
                  ? (language === 'zh' ? '保存更改' : 'Save Changes')
                  : (language === 'zh' ? '添加配置' : 'Add Configuration')
                }
              </button>
            </div>
          )}

          {/* Config List */}
          {modelConfigs.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500">
              <Cpu className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">{language === 'zh' ? '暂无配置' : 'No configurations'}</p>
              <p className="text-[10px] mt-1">{language === 'zh' ? '点击"添加"创建新配置' : 'Click "Add" to create one'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {modelConfigs.map((config) => (
                <div
                  key={config.id}
                  onClick={() => handleSelectConfig(config.id)}
                  className={`
                    flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all group
                    ${selectedConfigId === config.id
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-500/20'
                      : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-zinc-700'}
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {selectedConfigId === config.id && (
                        <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      )}
                      <span className={`text-xs font-bold truncate ${selectedConfigId === config.id ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {config.modelId}
                      </span>
                    </div>
                    {config.baseUrl && (
                      <span className="text-[9px] text-slate-400 mt-0.5 block truncate pl-5">
                        {config.baseUrl}
                      </span>
                    )}
                    <div className="flex items-center gap-1 mt-0.5 pl-5">
                      <div className={`w-1.5 h-1.5 rounded-full ${config.apiKey ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                      <span className="text-[9px] text-slate-400">
                        {config.apiKey 
                          ? (language === 'zh' ? '已设置 API Key' : 'API Key set')
                          : (language === 'zh' ? '未设置 API Key' : 'No API Key')
                        }
                      </span>
                    </div>
                    {testResult?.configId === config.id && (
                      <div className={`text-[9px] mt-0.5 pl-5 ${testResult.success ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {testResult.message}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        testConnection(config);
                      }}
                      disabled={testingConfigId === config.id}
                      className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded disabled:opacity-50"
                      title={language === 'zh' ? '测试连接' : 'Test connection'}
                    >
                      {testingConfigId === config.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(config);
                      }}
                      className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded"
                      title={language === 'zh' ? '编辑' : 'Edit'}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConfig(config.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded"
                      title={language === 'zh' ? '删除' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Appearance Section */}
        <section className="space-y-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {language === 'zh' ? '外观' : 'Appearance'}
          </label>
          
          {/* Theme */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg">
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {language === 'zh' ? '主题' : 'Theme'}
            </span>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-300 transition-colors"
            >
              {darkMode ? (
                <>
                  <Moon className="w-3.5 h-3.5" /> {language === 'zh' ? '深色' : 'Dark'}
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5" /> {language === 'zh' ? '浅色' : 'Light'}
                </>
              )}
            </button>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg">
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {language === 'zh' ? '语言' : 'Language'}
            </span>
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-300 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" /> {language === 'zh' ? '中文' : 'English'}
            </button>
          </div>
        </section>

        {/* About Section */}
        <section className="space-y-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {language === 'zh' ? '关于' : 'About'}
          </label>
          <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg space-y-2">
            <div className="flex items-center gap-3">
              <img src="/plotcouncil-logo.jpeg" alt="PlotCouncil" className="w-10 h-10 rounded-lg" />
              <div>
                <div className="text-sm font-bold text-slate-700 dark:text-slate-200">PlotCouncil</div>
                <div className="text-[10px] text-slate-400">v1.0.0</div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {language === 'zh' 
                ? '科研绘图复刻助手 · 多智能体复核 · Matplotlib 渲染'
                : 'Scientific Plot Reproduction with Multi-Agent Review'
              }
            </p>
            <a 
              href="https://github.com/pc9527zxx/PlotCouncil" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              GitHub →
            </a>
          </div>
        </section>

      </div>
    </div>
  );
};
