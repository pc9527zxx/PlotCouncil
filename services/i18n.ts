// Internationalization (i18n) service for PlotCouncil
// Supports Chinese (zh) and English (en)

export type Language = 'zh' | 'en';

export const translations = {
  // App / General
  'app.name': { zh: 'PlotCouncil', en: 'PlotCouncil' },
  'app.selectOrCreate': { zh: '请选择或创建一个项目开始', en: 'Select or create a project to begin' },
  
  // Sidebar
  'sidebar.projects': { zh: '项目', en: 'Projects' },
  'sidebar.newProject': { zh: '新建项目', en: 'New Project' },
  'sidebar.newGroup': { zh: '新建分组', en: 'New Group' },
  'sidebar.rename': { zh: '重命名', en: 'Rename' },
  'sidebar.delete': { zh: '删除', en: 'Delete' },
  'sidebar.deleteProject': { zh: '删除项目', en: 'Delete Project' },
  'sidebar.moveToGroup': { zh: '移动到分组', en: 'Move to Group' },
  'sidebar.removeFromGroup': { zh: '取消分组', en: 'Remove from Group' },
  'sidebar.ungrouped': { zh: '未分组', en: 'Ungrouped' },
  'sidebar.multiSelect': { zh: '多选模式', en: 'Multi-select Mode' },
  'sidebar.exitMultiSelect': { zh: '退出多选', en: 'Exit Multi-select' },
  'sidebar.selectAll': { zh: '全选', en: 'Select All' },
  'sidebar.allSelected': { zh: '已全选', en: 'All Selected' },
  'sidebar.selected': { zh: '已选', en: 'Selected' },
  'sidebar.batchMove': { zh: '批量移动', en: 'Batch Move' },
  'sidebar.batchDelete': { zh: '批量删除', en: 'Batch Delete' },
  'sidebar.dropToAdd': { zh: '释放以添加到此分组', en: 'Drop to add to this group' },
  'sidebar.dropToUngroup': { zh: '释放以取消分组', en: 'Drop to remove from group' },
  'sidebar.collapse': { zh: '收起侧边栏', en: 'Collapse Sidebar' },
  'sidebar.expand': { zh: '展开侧边栏', en: 'Expand Sidebar' },
  'sidebar.productGuide': { zh: '产品指南', en: 'Product Guide' },
  'sidebar.settings': { zh: '设置', en: 'Settings' },
  'sidebar.theme': { zh: '主题', en: 'Theme' },
  'sidebar.manageModels': { zh: '管理模型...', en: 'Manage Models...' },
  'sidebar.selectModel': { zh: '选择模型', en: 'Select Model' },
  'sidebar.configureModel': { zh: '配置模型', en: 'Configure Model' },
  'sidebar.renameGroup': { zh: '重命名分组', en: 'Rename Group' },
  'sidebar.deleteGroup': { zh: '删除分组', en: 'Delete Group' },
  'sidebar.confirmSave': { zh: '确认保存', en: 'Confirm' },
  'sidebar.cancelEdit': { zh: '取消编辑', en: 'Cancel' },
  
  // Time
  'time.justNow': { zh: '刚刚', en: 'Just now' },
  'time.minutesAgo': { zh: '分钟前', en: 'm ago' },
  'time.hoursAgo': { zh: '小时前', en: 'h ago' },
  'time.yesterday': { zh: '昨天', en: 'Yesterday' },
  'time.daysAgo': { zh: '天前', en: 'd ago' },
  'time.running': { zh: '运行中...', en: 'Running...' },
  
  // Source Panel
  'source.title': { zh: '输入源', en: 'Input Source' },
  'source.uploadHint': { zh: '上传或粘贴图片', en: 'Upload or paste image' },
  'source.dragDrop': { zh: '拖放图片到此处', en: 'Drag and drop image here' },
  'source.or': { zh: '或', en: 'or' },
  'source.browse': { zh: '选择文件', en: 'Browse Files' },
  'source.paste': { zh: '粘贴图片 (Ctrl+V)', en: 'Paste Image (Ctrl+V)' },
  
  // Output Panel
  'output.title': { zh: '输出结果', en: 'Output Result' },
  'output.renderedPlot': { zh: '渲染图表', en: 'Rendered Plot' },
  'output.logs': { zh: '日志', en: 'Logs' },
  'output.noOutput': { zh: '暂无输出', en: 'No output yet' },
  'output.copyCode': { zh: '复制代码', en: 'Copy Code' },
  'output.downloadPng': { zh: '下载 PNG', en: 'Download PNG' },
  'output.downloadSvg': { zh: '下载 SVG', en: 'Download SVG' },
  
  // Analysis View
  'analysis.title': { zh: '分析结果', en: 'Analysis Result' },
  'analysis.codeGen': { zh: '代码生成', en: 'Code Generation' },
  'analysis.review': { zh: '评审', en: 'Review' },
  'analysis.run': { zh: '运行', en: 'Run' },
  'analysis.stop': { zh: '停止', en: 'Stop' },
  'analysis.refine': { zh: '优化', en: 'Refine' },
  'analysis.iteration': { zh: '迭代', en: 'Iteration' },
  
  // Run modes
  'mode.simple': { zh: '简单', en: 'Simple' },
  'mode.complex': { zh: '复杂', en: 'Complex' },
  'mode.manual': { zh: '手动', en: 'Manual' },
  'mode.lite': { zh: '精简', en: 'Lite' },
  'mode.full': { zh: '完整', en: 'Full' },
  
  // Status
  'status.idle': { zh: '就绪', en: 'Ready' },
  'status.analyzing': { zh: '分析中', en: 'Analyzing' },
  'status.refining': { zh: '优化中', en: 'Refining' },
  'status.success': { zh: '完成', en: 'Complete' },
  'status.error': { zh: '错误', en: 'Error' },
  
  // Confirm Dialog
  'dialog.deleteTitle': { zh: '删除项目', en: 'Delete Project' },
  'dialog.deleteMessage': { zh: '确定要删除这个项目吗？此操作无法撤销。', en: 'Are you sure you want to delete this project? This action cannot be undone.' },
  'dialog.confirm': { zh: '确认', en: 'Confirm' },
  'dialog.cancel': { zh: '取消', en: 'Cancel' },
  'dialog.delete': { zh: '删除', en: 'Delete' },
  
  // Toast
  'toast.projectDeleted': { zh: '项目已删除', en: 'Project deleted' },
  'toast.copied': { zh: '已复制', en: 'Copied' },
  'toast.saved': { zh: '已保存', en: 'Saved' },
  
  // Settings
  'settings.title': { zh: '设置', en: 'Settings' },
  'settings.apiKey': { zh: 'API 密钥', en: 'API Key' },
  'settings.model': { zh: '模型', en: 'Model' },
  'settings.maxLoops': { zh: '最大循环次数', en: 'Max Loops' },
  'settings.language': { zh: '语言', en: 'Language' },
  
  // Language
  'lang.zh': { zh: '中文', en: 'Chinese' },
  'lang.en': { zh: 'English', en: 'English' },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Language): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] || entry['en'] || key;
}

// Relative time formatter
export function formatRelativeTime(timestamp: number, lang: Language): string {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t('time.justNow', lang);
  if (minutes < 60) return lang === 'zh' ? `${minutes} ${t('time.minutesAgo', lang)}` : `${minutes}${t('time.minutesAgo', lang)}`;
  if (hours < 24) return lang === 'zh' ? `${hours} ${t('time.hoursAgo', lang)}` : `${hours}${t('time.hoursAgo', lang)}`;
  if (days === 1) return t('time.yesterday', lang);
  if (days < 7) return lang === 'zh' ? `${days} ${t('time.daysAgo', lang)}` : `${days}${t('time.daysAgo', lang)}`;
  return new Date(timestamp).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
}
