import React, { useState, useEffect, memo, useMemo, useCallback } from 'react';
import { AnalysisResult, AnalysisStatus, CodeVersion, WorkflowLogEntry, PlotSnapshot } from '../types';
import { Terminal, Layers, Copy, FileJson, Bug, Gavel, Download, Loader2, Clock, CheckCircle, AlertCircle, AlertTriangle, Bot, Wrench, Send } from 'lucide-react';
import { ToastType } from './Toast';
import { CodeDiff } from './CodeDiff';

interface AnalysisViewProps {
  status: AnalysisStatus;
  result: AnalysisResult | null;
  renderLogs?: string;
  renderError?: string;
  workflowLogs?: WorkflowLogEntry[];
  onShowToast: (msg: string, type: ToastType) => void;
  codeHistory?: CodeVersion[];
  plotHistory?: PlotSnapshot[];
  projectName?: string;
  onManualFix?: (errorDescription: string) => void;
  isFixing?: boolean;
}

type TabType = 'code' | 'review' | 'logs';

export const AnalysisView: React.FC<AnalysisViewProps> = memo(({
  status,
  result,
  renderLogs,
  renderError,
  workflowLogs = [],
  onShowToast,
  codeHistory = [],
  plotHistory = [],
  projectName = 'plot',
  onManualFix,
  isFixing = false,
}) => {
  const [pythonCode, setPythonCode] = useState<string>('');
  const [manualErrorInput, setManualErrorInput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('code');
  const [chairRawOpen, setChairRawOpen] = useState<Record<number, boolean>>({});
  const [teacherRawOpen, setTeacherRawOpen] = useState<Record<number, boolean>>({});
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [diffLeftVersion, setDiffLeftVersion] = useState<number | null>(null);
  const [diffRightVersion, setDiffRightVersion] = useState<number | null>(null);

  const extractJson = (raw?: string): any | null => {
    if (!raw) return null;
    
    // Try multiple patterns for JSON extraction
    const blockMatch = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
    let text = blockMatch?.[1]?.trim() ?? raw;
    
    // If no code block found, try to find JSON object directly
    if (!blockMatch) {
      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        text = raw.substring(firstBrace, lastBrace + 1);
      }
    }
    
    // Helper to attempt parse with various cleanups
    const tryParse = (str: string): any | null => {
      try {
        return JSON.parse(str);
      } catch {
        return null;
      }
    };
    
    // Try direct parse first
    let result = tryParse(text);
    if (result) return result;
    
    // Clean up common issues step by step
    let cleaned = text
      // Replace smart quotes with regular quotes
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      // Remove BOM and zero-width chars
      .replace(/[\uFEFF\u200B\u200C\u200D]/g, '')
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    
    result = tryParse(cleaned);
    if (result) return result;
    
    // Remove trailing commas before } or ]
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
    result = tryParse(cleaned);
    if (result) return result;
    
    // Remove single-line comments
    cleaned = cleaned.replace(/([^\\:]|^)\/\/.*$/gm, '$1');
    result = tryParse(cleaned);
    if (result) return result;
    
    // Remove multi-line comments
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    result = tryParse(cleaned);
    if (result) return result;
    
    // Try to fix unescaped newlines in string values
    // This regex finds strings and ensures newlines inside are escaped
    try {
      cleaned = cleaned.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
        return match.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
      });
      result = tryParse(cleaned);
      if (result) return result;
    } catch {
      // Regex failed, continue
    }
    
    // Last resort: try to eval as JS object (only for simple cases)
    // This handles unquoted keys, single quotes, etc.
    try {
      // Sanitize: only allow JSON-like structures
      if (/^[\s\n]*\{[\s\S]*\}[\s\n]*$/.test(cleaned)) {
        // Convert single quotes to double quotes for string values
        const jsFixed = cleaned
          .replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"');
        result = tryParse(jsFixed);
        if (result) return result;
      }
    } catch {
      // Continue
    }
    
    return null;
  };

  // Format raw string as pretty JSON if possible
  const formatAsPrettyJson = (raw?: string): string => {
    if (!raw) return '';
    const parsed = extractJson(raw);
    if (parsed) {
      return JSON.stringify(parsed, null, 2);
    }
    // Try to parse the raw string directly
    try {
      const directParsed = JSON.parse(raw);
      return JSON.stringify(directParsed, null, 2);
    } catch {
      return raw;
    }
  };

  const stripCodeFence = (raw?: string) => {
    if (!raw) return '';
    return raw.replace(/```[a-zA-Z]*\s*/g, '').replace(/```/g, '').trim();
  };

  const ColorDots: React.FC<{ colors?: string[] }> = ({ colors }) => {
    if (!colors || colors.length === 0) return null;
    return (
      <div className="flex flex-wrap items-center gap-1">
        {colors.slice(0, 8).map((c, idx) => (
          <div key={idx} className="w-3 h-3 rounded-full border border-slate-200 dark:border-zinc-700" style={{ backgroundColor: c }} title={c} />
        ))}
      </div>
    );
  };

  // Helper to get current agent label from status
  const getAgentLabel = (status: AnalysisStatus): string | null => {
    switch (status) {
      case AnalysisStatus.TEACHER_STYLE_REVIEW: return 'Style Teacher';
      case AnalysisStatus.TEACHER_LAYOUT_REVIEW: return 'Layout Teacher';
      case AnalysisStatus.TEACHER_DATA_REVIEW: return 'Data Teacher';
      case AnalysisStatus.CHAIR_QA: return 'QA Chair';
      case AnalysisStatus.CHAIR_STRATEGY: return 'Strategy Chair';
      case AnalysisStatus.REFINING: return 'Student (Revising)';
      default: return null;
    }
  };

  const isReviewInProgress = [
    AnalysisStatus.TEACHER_STYLE_REVIEW,
    AnalysisStatus.TEACHER_LAYOUT_REVIEW,
    AnalysisStatus.TEACHER_DATA_REVIEW,
    AnalysisStatus.CHAIR_QA,
    AnalysisStatus.CHAIR_STRATEGY,
    AnalysisStatus.REFINING,
  ].includes(status);

  // Auto-switch tabs based on status
  useEffect(() => {
    if (status.includes('TEACHER') || status.includes('CHAIR')) setActiveTab('review');
    if (renderError) setActiveTab('logs');
    if (status === AnalysisStatus.SUCCESS && !renderError) setActiveTab('code');
  }, [status, renderError]);

  // Parse code from result
  useEffect(() => {
    if (result?.markdown) {
      const codeMatch = result.markdown.match(/```python([\s\S]*?)```/i);
      const code = codeMatch ? codeMatch[1].trim() : (result.markdown.includes('import matplotlib') ? result.markdown : '');
      setPythonCode(code);
    }
  }, [result]);

  const copyText = async (text: string, label: string) => {
    if (!text) return;
    
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        onShowToast(`${label} copied to clipboard`, "success");
        return;
      } catch (err) {
        // Fall through to legacy method
      }
    }
    
    // Fallback: use textarea + execCommand (works without permissions)
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const success = document.execCommand('copy');
      if (success) {
        onShowToast(`${label} copied to clipboard`, "success");
      } else {
        onShowToast(`Failed to copy ${label}`, "error");
      }
    } catch (err) {
      onShowToast(`Failed to copy ${label}`, "error");
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const copyCode = () => {
    copyText(pythonCode, "Code");
  };

  // Generate filename with timestamp and iteration
  const generateFilename = (ext: string) => {
    const safeName = projectName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').slice(0, 30);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const iteration = codeHistory.length > 0 ? `_v${codeHistory.length}` : '';
    return `${safeName}${iteration}_${timestamp}.${ext}`;
  };

  const downloadCode = () => {
    if (!pythonCode) return;
    const element = document.createElement("a");
    const file = new Blob([pythonCode], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = generateFilename('py');
    document.body.appendChild(element);
    element.click();
    onShowToast("Script downloaded", "success");
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 shadow-xl z-30">
       {/* 1. Header (Tabs) */}
       <div className="flex border-b border-slate-200 dark:border-zinc-800 h-10 shrink-0">
          <div className="flex-1 flex">
            <button 
              onClick={() => setActiveTab('code')}
              className={`flex-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors border-b-2
                ${activeTab === 'code' ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800'}
              `}
            >
               <Terminal className="w-3.5 h-3.5" /> Code
            </button>
            <button 
              onClick={() => setActiveTab('review')}
              className={`flex-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors border-b-2
                ${activeTab === 'review' ? 'border-amber-500 text-amber-600 bg-amber-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800'}
              `}
            >
               <Layers className="w-3.5 h-3.5" /> Review
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              className={`flex-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors border-b-2
                ${activeTab === 'logs' ? 'border-slate-500 text-slate-700 bg-slate-100' : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800'}
              `}
            >
               {renderError ? <Bug className="w-3.5 h-3.5 text-rose-500"/> : <FileJson className="w-3.5 h-3.5" />}
               Logs
            </button>
          </div>
          
          {/* Header Utilities */}
          {activeTab === 'code' && (
             <div className="flex items-center px-2 gap-1 border-l border-slate-100 dark:border-zinc-800">
                <button onClick={copyCode} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all" title="Copy Code">
                   <Copy className="w-3.5 h-3.5" />
                </button>
                <button onClick={downloadCode} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all" title="Download .py">
                   <Download className="w-3.5 h-3.5" />
                </button>
             </div>
          )}
       </div>

       {/* 2. Content Area */}
       <div className="flex-1 overflow-hidden bg-slate-50/30 dark:bg-black/20 p-0 relative flex flex-col">
          
          {/* CODE TAB */}
          {activeTab === 'code' && (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
               {/* Version Navigation Bar - moved up */}
               <div className={`flex flex-col ${showDiff ? 'flex-1 min-h-0' : ''}`}>
                 <CodeDiff
                   codeHistory={codeHistory}
                   currentCode={pythonCode}
                   selectedVersionIndex={selectedVersionIndex}
                   onSelectVersion={setSelectedVersionIndex}
                   showDiff={showDiff}
                   onToggleDiff={() => setShowDiff(!showDiff)}
                   diffLeftVersion={diffLeftVersion}
                   diffRightVersion={diffRightVersion}
                   onDiffLeftChange={setDiffLeftVersion}
                   onDiffRightChange={setDiffRightVersion}
                 />
               </div>

               {/* Code Display - 行号和代码一起滚动 */}
               {!showDiff && (
                 <div className="flex-1 overflow-auto">
                   <div className="flex min-w-max">
                     {/* Line Numbers Gutter - sticky left */}
                     <div className="flex-none w-10 py-4 bg-slate-100 dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 text-right pr-3 select-none sticky left-0">
                        <pre className="text-xs font-mono text-slate-400 dark:text-zinc-600 leading-6">
                          {(selectedVersionIndex !== null && codeHistory[selectedVersionIndex]
                            ? codeHistory[selectedVersionIndex].code
                            : pythonCode
                          ).split('\n').map((_, i) => i + 1).join('\n') || "1"}
                        </pre>
                     </div>
                     
                     {/* Code Content */}
                     <div className="flex-1 py-4 px-4">
                        <pre className="font-mono text-xs leading-6 text-slate-700 dark:text-slate-300 whitespace-pre tab-4">
                           {selectedVersionIndex !== null && codeHistory[selectedVersionIndex]
                             ? codeHistory[selectedVersionIndex].code
                             : (pythonCode || <span className="text-slate-400 italic"># No code generated yet.</span>)
                           }
                        </pre>
                     </div>
                   </div>
                 </div>
               )}
            </div>
          )}

          {/* REVIEW TAB */}
          {activeTab === 'review' && (
            <div className="p-4 space-y-4 overflow-auto flex-1">
              {/* Progress Indicator */}
              {isReviewInProgress && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-lg p-3 flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                      {getAgentLabel(status)} is working...
                    </div>
                    <div className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 mt-0.5">
                      Reviews will appear as each agent completes
                    </div>
                  </div>
                </div>
              )}

              {(result?.teacherReviews || []).length === 0 && !result?.teacherCritique && (!result?.chairFindings || result.chairFindings.length === 0) && !isReviewInProgress ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                     <Layers className="w-8 h-8 mb-2 opacity-20" />
                     <p className="text-xs">No reviews available yet.</p>
                  </div>
               ) : (
                 <>
                   {/* Teacher Reviews */}
                   {(result?.teacherReviews || []).map((review, i) => (
                    <div key={i} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-3 shadow-sm">
                       {(() => {
                         const parsed = extractJson(review.findings);
                         const statusLabel = typeof parsed?.status === 'string' ? parsed.status : (typeof parsed?.overall_status === 'string' ? parsed.overall_status : undefined);
                         const issues = Array.isArray(parsed?.issues) ? parsed.issues : [];
                         const palette = Array.isArray(parsed?.palette_summary) ? parsed.palette_summary : (Array.isArray(parsed?.palette_summary?.colors) ? parsed.palette_summary.colors : undefined);
                         const cleaned = stripCodeFence(review.findings);
                         const isData = review.role === 'DATA';
                         const isLayout = review.role === 'LAYOUT';
                         const dataMatch = parsed?.plot_type_match;
                         const distFindings = Array.isArray(parsed?.distribution_findings) ? parsed.distribution_findings : [];
                         const blankCheck = parsed?.blank_plot_check;
                         // Layout agent fields
                         const gridAssessment = parsed?.grid_assessment;
                         const axisFindings = Array.isArray(parsed?.axis_findings) ? parsed.axis_findings : [];
                         const annotationFindings = Array.isArray(parsed?.annotation_findings) ? parsed.annotation_findings : [];
                         const layoutFindings = [...axisFindings, ...annotationFindings];
                         
                         const hasStructured = isData
                           ? (dataMatch || distFindings.length > 0 || statusLabel || blankCheck)
                           : isLayout
                             ? (gridAssessment || layoutFindings.length > 0)
                             : (palette && palette.length > 0) || issues.length > 0;
                         const prettyJson = parsed ? JSON.stringify(parsed, null, 2) : '';

                         return (
                           <>
                             <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-50 dark:border-zinc-800">
                                <div className={`w-2 h-2 rounded-full ${review.role === 'STYLE' ? 'bg-pink-500' : review.role === 'LAYOUT' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                                <span className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">{review.role} Agent</span>
                                {statusLabel && (
                                  <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-slate-50 text-slate-600 dark:bg-zinc-800 dark:text-slate-300 border-slate-200 dark:border-zinc-700">
                                    {statusLabel}
                                  </span>
                                )}
                             </div>

                             <div className="space-y-2">
                              {!isData && !isLayout && palette && (
                                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                  <span className="font-semibold uppercase">Palette</span>
                                  <ColorDots colors={palette as string[]} />
                                </div>
                              )}

                              {!isData && !isLayout && issues.length > 0 && (
                                <div className="space-y-1">
                                  {issues.map((iss: any, idx: number) => (
                                    <div key={idx} className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50/60 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 rounded p-2">
                                      {iss.severity && (
                                        <span className={`text-[10px] font-bold mr-2 ${String(iss.severity).toUpperCase().includes('CRIT') ? 'text-rose-600' : 'text-amber-600'}`}>{iss.severity}</span>
                                      )}
                                      <div className="whitespace-pre-wrap">
                                        {iss.description || JSON.stringify(iss)}
                                      </div>
                                      {iss.fix_suggestion && (
                                        <div className="mt-1 text-[10px] text-indigo-600 dark:text-indigo-300 whitespace-pre-wrap">{iss.fix_suggestion}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Layout Agent structured view */}
                              {isLayout && (
                                <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                  {gridAssessment && (
                                    <div className="bg-blue-50/60 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded p-2 space-y-1">
                                      <div className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Grid Assessment</div>
                                      <div className="flex items-center gap-4 text-[11px]">
                                        <span>Rows: <strong>{gridAssessment.rows}</strong></span>
                                        <span>Cols: <strong>{gridAssessment.cols}</strong></span>
                                        {gridAssessment.student_matches !== undefined && (
                                          <span className={gridAssessment.student_matches ? 'text-emerald-600' : 'text-rose-600'}>
                                            {gridAssessment.student_matches ? '✓ Matches' : '✗ Mismatch'}
                                          </span>
                                        )}
                                      </div>
                                      {gridAssessment.notes && (
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 italic">{gridAssessment.notes}</div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {layoutFindings.length > 0 && (
                                    <div className="space-y-1">
                                      {layoutFindings.map((finding: any, idx: number) => (
                                        <div key={idx} className="bg-slate-50/60 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 rounded p-2">
                                          {finding.severity && (
                                            <span className={`text-[10px] font-bold mr-2 ${
                                              String(finding.severity).toUpperCase().includes('CRIT') ? 'text-rose-600' : 
                                              String(finding.severity).toUpperCase().includes('MAJOR') ? 'text-amber-600' : 'text-blue-600'
                                            }`}>{finding.severity}</span>
                                          )}
                                          <div className="whitespace-pre-wrap">
                                            {finding.issue || finding.description || JSON.stringify(finding)}
                                          </div>
                                          {finding.fix_suggestion && (
                                            <div className="mt-1 text-[10px] text-indigo-600 dark:text-indigo-300 whitespace-pre-wrap">{finding.fix_suggestion}</div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {isData && (
                                <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                  {statusLabel && (
                                    <div className="flex items-center gap-2 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                                      Status: <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800/50">{statusLabel}</span>
                                    </div>
                                  )}
                                  {dataMatch && (
                                    <div className="bg-slate-50/60 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 rounded p-2 space-y-1">
                                      <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Plot Type Match</div>
                                      <div>Original: {dataMatch.original}</div>
                                      <div>Student: {dataMatch.student}</div>
                                      {dataMatch.status && <div className="text-[11px] text-emerald-600 dark:text-emerald-300">Status: {dataMatch.status}</div>}
                                    </div>
                                  )}
                                  {distFindings.length > 0 && (
                                    <div className="space-y-1">
                                      <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Distribution Findings</div>
                                      {distFindings.map((df: any, idx: number) => (
                                        <div key={idx} className="bg-slate-50/60 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 rounded p-2 space-y-1">
                                          {df.severity && <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">{df.severity}</span>}
                                          <div className="whitespace-pre-wrap">{df.issue || df.description || JSON.stringify(df)}</div>
                                          {df.fix_suggestion && (
                                            <div className="text-[10px] text-indigo-600 dark:text-indigo-300 whitespace-pre-wrap">{df.fix_suggestion}</div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {blankCheck && (
                                    <div className="text-[11px] text-slate-600 dark:text-slate-300">Blank plot check: {blankCheck}</div>
                                  )}
                                </div>
                              )}
                               {!hasStructured && parsed && (
                                 <pre className="text-[11px] leading-5 text-slate-700 dark:text-slate-300 bg-slate-50/70 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded p-2 whitespace-pre-wrap break-words">
                                   {prettyJson}
                                 </pre>
                               )}
                               {!parsed && (
                                 <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                   {cleaned}
                                 </div>
                               )}
                             </div>

                             <div className="mt-2 border-t border-slate-100 dark:border-zinc-800 pt-2">
                               <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                 <button
                                   onClick={() => setTeacherRawOpen(prev => ({ ...prev, [i]: !prev[i] }))}
                                   className="hover:text-indigo-600 flex items-center gap-1"
                                 >
                                   {teacherRawOpen[i] ? 'Hide raw JSON' : 'Show raw JSON'}
                                 </button>
                                 {teacherRawOpen[i] && (
                                   <button
                                     onClick={() => copyText(review.findings, 'Raw JSON')}
                                     className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                                     title="Copy raw JSON"
                                   >
                                     <Copy className="w-3 h-3" /> Copy
                                   </button>
                                 )}
                               </div>
                               {teacherRawOpen[i] && (
                                 <pre className="mt-1 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded p-2 text-[10px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words overflow-auto max-h-[300px]">
                                   {prettyJson || review.findings}
                                 </pre>
                               )}
                             </div>
                           </>
                         );
                       })()}
                    </div>
                   ))}
                   
                  {/* Chair / Summary */}
                  {result?.teacherCritique && (() => {
                    const parsed = extractJson(result.teacherCritique);
                    const statusLabel = parsed?.overall_status;
                    const riskScore = parsed?.risk_score;
                    const priorityFixes = Array.isArray(parsed?.priority_fixes) ? parsed.priority_fixes : [];
                    const blockingIssues = Array.isArray(parsed?.blocking_issues) ? parsed.blocking_issues : [];
                    const teacherDigest = parsed?.teacher_digest;
                    const prettyJson = parsed ? JSON.stringify(parsed, null, 2) : '';
                    const hasStructured = priorityFixes.length > 0 || blockingIssues.length > 0 || teacherDigest;
                    
                    return (
                    <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-lg p-3 shadow-sm">
                       <div className="flex items-center gap-2 mb-2 pb-2 border-b border-indigo-100/50 dark:border-indigo-800/30">
                          <Gavel className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">Chair Synthesis</span>
                          {statusLabel && (
                            <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold border
                              ${statusLabel === 'APPROVED' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' 
                                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800'}`}>
                              {statusLabel}
                            </span>
                          )}
                          {typeof riskScore === 'number' && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border
                              ${riskScore >= 0.7 ? 'bg-rose-50 text-rose-700 border-rose-200' : riskScore >= 0.4 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                              Risk: {(riskScore * 100).toFixed(0)}%
                            </span>
                          )}
                       </div>
                       
                       {hasStructured ? (
                         <div className="space-y-3">
                           {/* Blocking Issues */}
                           {blockingIssues.length > 0 && (
                             <div className="space-y-1">
                               <div className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">🚫 Blocking Issues</div>
                               {blockingIssues.map((issue: string, idx: number) => (
                                 <div key={idx} className="bg-rose-50/80 dark:bg-rose-900/20 border-l-2 border-rose-400 pl-2 py-1 text-xs text-rose-800 dark:text-rose-200">
                                   {issue}
                                 </div>
                               ))}
                             </div>
                           )}
                           
                           {/* Priority Fixes */}
                           {priorityFixes.length > 0 && (
                             <div className="space-y-1">
                               <div className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">⚡ Priority Fixes</div>
                               {priorityFixes.map((fix: string, idx: number) => (
                                 <div key={idx} className="bg-amber-50/80 dark:bg-amber-900/20 border-l-2 border-amber-400 pl-2 py-1 text-xs text-amber-800 dark:text-amber-200">
                                   {fix}
                                 </div>
                               ))}
                             </div>
                           )}
                           
                           {/* Teacher Digest */}
                           {teacherDigest && (
                             <div className="space-y-1">
                               <div className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">📋 Teacher Summary</div>
                               <div className="grid gap-1 text-xs">
                                 {teacherDigest.style && (
                                   <div className="bg-indigo-50/50 dark:bg-indigo-900/20 rounded px-2 py-1">
                                     <span className="font-semibold text-indigo-700 dark:text-indigo-300">Style:</span>{' '}
                                     <span className="text-indigo-900/80 dark:text-indigo-200/80">{teacherDigest.style}</span>
                                   </div>
                                 )}
                                 {teacherDigest.layout && (
                                   <div className="bg-indigo-50/50 dark:bg-indigo-900/20 rounded px-2 py-1">
                                     <span className="font-semibold text-indigo-700 dark:text-indigo-300">Layout:</span>{' '}
                                     <span className="text-indigo-900/80 dark:text-indigo-200/80">{teacherDigest.layout}</span>
                                   </div>
                                 )}
                                 {teacherDigest.data && (
                                   <div className="bg-indigo-50/50 dark:bg-indigo-900/20 rounded px-2 py-1">
                                     <span className="font-semibold text-indigo-700 dark:text-indigo-300">Data:</span>{' '}
                                     <span className="text-indigo-900/80 dark:text-indigo-200/80">{teacherDigest.data}</span>
                                   </div>
                                 )}
                               </div>
                             </div>
                           )}
                         </div>
                       ) : (
                         <pre className="text-xs text-indigo-900/80 dark:text-indigo-200/80 leading-relaxed whitespace-pre-wrap break-words">
                            {prettyJson || result.teacherCritique}
                         </pre>
                       )}
                    </div>
                    );
                  })()}

                  {/* Chair Findings (QA + Strategy) */}
                  {(result?.chairFindings || []).map((finding, i) => {
                     const parsed = extractJson(finding.summary);
                     const actionItems = Array.isArray(parsed?.action_items) ? parsed.action_items : undefined;
                     const acceptance = Array.isArray(parsed?.acceptance_tests) ? parsed.acceptance_tests : undefined;
                     const statusLabel = typeof parsed?.overall_status === 'string' ? parsed.overall_status : undefined;
                     const loopOk = parsed?.loop_ok === true;
                     const cleanedSummary = stripCodeFence(finding.summary);
                     const hasStructured = (actionItems && actionItems.length > 0) || (acceptance && acceptance.length > 0) || (finding.priorityFixes && finding.priorityFixes.length > 0);
                     const prettyJson = parsed ? JSON.stringify(parsed, null, 2) : '';

                     return (
                     <div key={i} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-3 shadow-sm">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-50 dark:border-zinc-800">
                          <div className={`w-2 h-2 rounded-full ${finding.role === 'QA' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                          <span className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">{finding.role} Chair</span>
                          {statusLabel && (
                            <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-slate-50 text-slate-600 dark:bg-zinc-800 dark:text-slate-300 border-slate-200 dark:border-zinc-700">
                              {statusLabel}
                            </span>
                          )}
                          {loopOk && (
                            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                              Loop OK
                            </span>
                          )}
                        </div>
                        {!hasStructured && parsed && (
                          <pre className="text-[11px] leading-5 text-slate-700 dark:text-slate-300 bg-slate-50/70 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded p-2 whitespace-pre-wrap break-words">
                            {prettyJson}
                          </pre>
                        )}
                        {!parsed && (
                          <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {cleanedSummary}
                          </div>
                        )}
                        {actionItems && actionItems.length > 0 && (
                          <div className="mt-2 border-t border-slate-100 dark:border-zinc-800 pt-2">
                             <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Action Items</div>
                             <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                               {actionItems.map((item: any, idx: number) => (
                                 <li key={idx}>{typeof item === 'string' ? item : item?.detail || JSON.stringify(item)}</li>
                               ))}
                             </ul>
                          </div>
                        )}
                        {acceptance && acceptance.length > 0 && (
                          <div className="mt-2 border-t border-slate-100 dark:border-zinc-800 pt-2">
                             <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Acceptance Tests</div>
                             <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                               {acceptance.map((line: any, idx: number) => (
                                 <li key={idx}>{typeof line === 'string' ? line : JSON.stringify(line)}</li>
                               ))}
                             </ul>
                          </div>
                        )}
                        {finding.priorityFixes && finding.priorityFixes.length > 0 && (
                          <div className="mt-2 border-t border-slate-100 dark:border-zinc-800 pt-2">
                             <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Priority Fixes</div>
                             <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                               {finding.priorityFixes.map((fix, idx) => (
                                 <li key={idx}>{fix}</li>
                               ))}
                             </ul>
                          </div>
                        )}

                        <div className="mt-2 border-t border-slate-100 dark:border-zinc-800 pt-2">
                           <div className="flex items-center gap-2 text-[10px] text-slate-500">
                             <button
                               onClick={() => setChairRawOpen(prev => ({ ...prev, [i]: !prev[i] }))}
                               className="hover:text-indigo-600 flex items-center gap-1"
                             >
                               {chairRawOpen[i] ? 'Hide raw JSON' : 'Show raw JSON'}
                             </button>
                             {chairRawOpen[i] && (
                               <button
                                 onClick={() => copyText(finding.summary, 'Raw JSON')}
                                 className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                                 title="Copy raw JSON"
                               >
                                 <Copy className="w-3 h-3" /> Copy
                               </button>
                             )}
                           </div>
                           {chairRawOpen[i] && (
                             <pre className="mt-1 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded p-2 text-[10px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">
                               {formatAsPrettyJson(finding.summary)}
                             </pre>
                           )}
                        </div>
                     </div>
                     );
                  })}
                 </>
               )}
            </div>
          )}

          {/* LOGS TAB */}
          {activeTab === 'logs' && (
            <div className="p-4 space-y-4">
               {/* Workflow Timeline */}
               {workflowLogs.length > 0 && (
                 <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                      <h4 className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> 工作流日志
                      </h4>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                      <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {workflowLogs.map((log, i) => {
                          const iconMap = {
                            info: <Clock className="w-3 h-3 text-blue-500" />,
                            success: <CheckCircle className="w-3 h-3 text-emerald-500" />,
                            warning: <AlertTriangle className="w-3 h-3 text-amber-500" />,
                            error: <AlertCircle className="w-3 h-3 text-rose-500" />,
                            agent: <Bot className="w-3 h-3 text-indigo-500" />,
                          };
                          const bgMap = {
                            info: '',
                            success: 'bg-emerald-50/50 dark:bg-emerald-900/10',
                            warning: 'bg-amber-50/50 dark:bg-amber-900/10',
                            error: 'bg-rose-50/50 dark:bg-rose-900/10',
                            agent: 'bg-indigo-50/30 dark:bg-indigo-900/10',
                          };
                          const time = new Date(log.timestamp).toLocaleTimeString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          });
                          return (
                            <div key={i} className={`px-3 py-2 flex items-start gap-2 ${bgMap[log.type]}`}>
                              <div className="flex-none pt-0.5">{iconMap[log.type]}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{time}</span>
                                  {log.agent && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-slate-300 font-semibold">
                                      {log.agent}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5">
                                  {log.message}
                                </div>
                                {log.details && (
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono break-all">
                                    {log.details}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                 </div>
               )}

               {renderError && (
                 <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-lg p-3">
                    <h4 className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase mb-1 flex items-center gap-1">
                      <Bug className="w-3 h-3" /> Runtime Error
                    </h4>
                    <pre className="text-[10px] text-rose-800 dark:text-rose-300 font-mono whitespace-pre-wrap break-all">
                      {renderError}
                    </pre>
                 </div>
               )}

               {/* Manual Fix Section */}
               {onManualFix && (
                 <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3">
                    <h4 className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase mb-2 flex items-center gap-1">
                      <Wrench className="w-3 h-3" /> 手动修复
                    </h4>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-2">
                      描述代码问题或粘贴错误信息，让AI自动修复
                    </p>
                    <textarea
                      value={manualErrorInput}
                      onChange={(e) => setManualErrorInput(e.target.value)}
                      placeholder="例如：图表标题字体太大，或粘贴错误信息..."
                      className="w-full h-20 text-xs p-2 border border-amber-200 dark:border-amber-800 rounded bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                      disabled={isFixing}
                    />
                    <div className="flex justify-end mt-2 gap-2">
                      {renderError && (
                        <button
                          onClick={() => setManualErrorInput(renderError)}
                          className="text-[10px] px-2 py-1 rounded bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/50"
                          disabled={isFixing}
                        >
                          使用运行时错误
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (manualErrorInput.trim()) {
                            onManualFix(manualErrorInput.trim());
                            setManualErrorInput('');
                          }
                        }}
                        disabled={!manualErrorInput.trim() || isFixing}
                        className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isFixing ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            修复中...
                          </>
                        ) : (
                          <>
                            <Send className="w-3 h-3" />
                            发送修复请求
                          </>
                        )}
                      </button>
                    </div>
                 </div>
               )}
               
               <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-3 text-slate-600 dark:text-slate-300 font-mono text-[10px] overflow-x-auto">
                  <div className="opacity-50 mb-2 border-b border-slate-200 dark:border-zinc-700 pb-1 font-bold">STDOUT / STDERR</div>
                  <pre className="whitespace-pre-wrap">{renderLogs || "No output logs."}</pre>
               </div>
            </div>
          )}
       </div>
    </div>
  );
});

AnalysisView.displayName = 'AnalysisView';