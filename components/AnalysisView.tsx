import React, { useState, useEffect } from 'react';
import { AnalysisResult, AnalysisStatus } from '../types';
import { Terminal, Layers, Copy, FileJson, Bug, Gavel, Download } from 'lucide-react';
import { ToastType } from './Toast';

interface AnalysisViewProps {
  status: AnalysisStatus;
  result: AnalysisResult | null;
  renderLogs?: string;
  renderError?: string;
  onShowToast: (msg: string, type: ToastType) => void;
}

type TabType = 'code' | 'review' | 'logs';

export const AnalysisView: React.FC<AnalysisViewProps> = ({
  status,
  result,
  renderLogs,
  renderError,
  onShowToast
}) => {
  const [pythonCode, setPythonCode] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('code');
  const [chairRawOpen, setChairRawOpen] = useState<Record<number, boolean>>({});
  const [teacherRawOpen, setTeacherRawOpen] = useState<Record<number, boolean>>({});

  const extractJson = (raw?: string): any | null => {
    if (!raw) return null;
    const blockMatch = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
    const text = blockMatch?.[1] ?? raw;
    try {
      return JSON.parse(text);
    } catch {
      return null;
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

  const copyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    onShowToast(`${label} copied to clipboard`, "success");
  };

  const copyCode = () => {
    copyText(pythonCode, "Code");
  };

  const downloadCode = () => {
    if (!pythonCode) return;
    const element = document.createElement("a");
    const file = new Blob([pythonCode], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "plot_script.py";
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
       <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-black/20 p-0 relative">
          
          {/* CODE TAB */}
          {activeTab === 'code' && (
            <div className="flex min-w-full min-h-full">
               {/* Line Numbers Gutter */}
               <div className="flex-none w-10 py-4 bg-slate-100 dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 text-right pr-3 select-none">
                  <pre className="text-xs font-mono text-slate-400 dark:text-zinc-600 leading-6">
                    {pythonCode ? pythonCode.split('\n').map((_, i) => i + 1).join('\n') : "1"}
                  </pre>
               </div>
               
               {/* Code Content */}
               <div className="flex-1 py-4 px-4">
                  <pre className="font-mono text-xs leading-6 text-slate-700 dark:text-slate-300 whitespace-pre tab-4">
                     {pythonCode || <span className="text-slate-400 italic"># No code generated yet.</span>}
                  </pre>
               </div>
            </div>
          )}

          {/* REVIEW TAB */}
          {activeTab === 'review' && (
            <div className="p-4 space-y-4">
              {(result?.teacherReviews || []).length === 0 && !result?.teacherCritique && (!result?.chairFindings || result.chairFindings.length === 0) ? (
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
                         const dataMatch = parsed?.plot_type_match;
                         const distFindings = Array.isArray(parsed?.distribution_findings) ? parsed.distribution_findings : [];
                         const blankCheck = parsed?.blank_plot_check;
                         const hasStructured = isData
                           ? (dataMatch || distFindings.length > 0 || statusLabel || blankCheck)
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
                              {!isData && palette && (
                                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                  <span className="font-semibold uppercase">Palette</span>
                                  <ColorDots colors={palette as string[]} />
                                </div>
                              )}

                              {!isData && issues.length > 0 && (
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
                                 <pre className="mt-1 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded p-2 text-[10px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">
                                   {review.findings}
                                 </pre>
                               )}
                             </div>
                           </>
                         );
                       })()}
                    </div>
                   ))}
                   
                  {/* Chair / Summary */}
                  {result?.teacherCritique && (
                    <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-lg p-3 shadow-sm">
                       <div className="flex items-center gap-2 mb-2 pb-2 border-b border-indigo-100/50 dark:border-indigo-800/30">
                          <Gavel className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">Chair Synthesis</span>
                       </div>
                       <div className="text-xs text-indigo-900/80 dark:text-indigo-200/80 leading-relaxed">
                          {result.teacherCritique}
                       </div>
                    </div>
                  )}

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
                               {finding.summary}
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
               
               <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-3 text-slate-600 dark:text-slate-300 font-mono text-[10px] overflow-x-auto">
                  <div className="opacity-50 mb-2 border-b border-slate-200 dark:border-zinc-700 pb-1 font-bold">STDOUT / STDERR</div>
                  <pre className="whitespace-pre-wrap">{renderLogs || "No output logs."}</pre>
               </div>
            </div>
          )}
       </div>
    </div>
  );
};