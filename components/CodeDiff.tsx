import React, { useMemo } from 'react';
import { CodeVersion } from '../types';
import { GitCompare, History } from 'lucide-react';

interface CodeDiffProps {
  codeHistory: CodeVersion[];
  currentCode: string;
  selectedVersionIndex: number | null;
  onSelectVersion: (index: number | null) => void;
  showDiff: boolean;
  onToggleDiff: () => void;
  // For diff: select two versions to compare
  diffLeftVersion: number | null;
  diffRightVersion: number | null;
  onDiffLeftChange: (index: number | null) => void;
  onDiffRightChange: (index: number | null) => void;
}

interface UnifiedDiffLine {
  type: 'added' | 'removed' | 'context';
  content: string;
  oldLineNum: number | null;
  newLineNum: number | null;
}

// GitHub-style unified diff with context
const computeUnifiedDiff = (oldCode: string, newCode: string): UnifiedDiffLine[] => {
  const oldLines = oldCode.split('\n');
  const newLines = newCode.split('\n');
  const result: UnifiedDiffLine[] = [];

  // LCS-based diff
  const lcs = computeLCS(oldLines, newLines);
  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (lcsIdx < lcs.length && oldIdx < oldLines.length && newIdx < newLines.length) {
      // Removed lines (in old but not matching LCS)
      while (oldIdx < oldLines.length && oldLines[oldIdx] !== lcs[lcsIdx]) {
        result.push({ type: 'removed', content: oldLines[oldIdx], oldLineNum: oldIdx + 1, newLineNum: null });
        oldIdx++;
      }
      // Added lines (in new but not matching LCS)
      while (newIdx < newLines.length && newLines[newIdx] !== lcs[lcsIdx]) {
        result.push({ type: 'added', content: newLines[newIdx], oldLineNum: null, newLineNum: newIdx + 1 });
        newIdx++;
      }
      // Context line (matching)
      if (oldIdx < oldLines.length && newIdx < newLines.length && oldLines[oldIdx] === lcs[lcsIdx]) {
        result.push({ type: 'context', content: oldLines[oldIdx], oldLineNum: oldIdx + 1, newLineNum: newIdx + 1 });
        oldIdx++;
        newIdx++;
        lcsIdx++;
      }
    } else {
      // Remaining old lines
      while (oldIdx < oldLines.length) {
        result.push({ type: 'removed', content: oldLines[oldIdx], oldLineNum: oldIdx + 1, newLineNum: null });
        oldIdx++;
      }
      // Remaining new lines
      while (newIdx < newLines.length) {
        result.push({ type: 'added', content: newLines[newIdx], oldLineNum: null, newLineNum: newIdx + 1 });
        newIdx++;
      }
    }
  }

  return result;
};

// Compute longest common subsequence
const computeLCS = (a: string[], b: string[]): string[] => {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
};

export const CodeDiff: React.FC<CodeDiffProps> = ({
  codeHistory,
  currentCode,
  selectedVersionIndex,
  onSelectVersion,
  showDiff,
  onToggleDiff,
  diffLeftVersion,
  diffRightVersion,
  onDiffLeftChange,
  onDiffRightChange,
}) => {
  const hasHistory = codeHistory.length > 0;

  // Compute unified diff
  const diffResult = useMemo(() => {
    if (!showDiff) return null;
    
    const leftCode = diffLeftVersion !== null && codeHistory[diffLeftVersion]
      ? codeHistory[diffLeftVersion].code
      : '';
    const rightCode = diffRightVersion !== null && codeHistory[diffRightVersion]
      ? codeHistory[diffRightVersion].code
      : currentCode;
    
    if (!leftCode && !rightCode) return null;
    
    return computeUnifiedDiff(leftCode, rightCode);
  }, [showDiff, diffLeftVersion, diffRightVersion, codeHistory, currentCode]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getSourceLabel = (source: 'student' | 'revision') => {
    return source === 'student' ? '初始' : '修订';
  };

  const getVersionLabel = (idx: number | null): string => {
    if (idx === null) return '当前代码';
    const v = codeHistory[idx];
    if (!v) return '当前代码';
    return `v${idx + 1} ${getSourceLabel(v.source)}`;
  };

  if (!hasHistory) {
    return null;
  }

  // Count diff stats
  const addedCount = diffResult?.filter(l => l.type === 'added').length || 0;
  const removedCount = diffResult?.filter(l => l.type === 'removed').length || 0;

  return (
    <div className={`border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 ${showDiff ? 'flex flex-col flex-1 min-h-0' : ''}`}>
      {/* Compact Navigation Bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 flex-wrap">
        <History className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        
        {/* Version Selector (for viewing) */}
        <select
          value={selectedVersionIndex ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            onSelectVersion(val === '' ? null : parseInt(val));
          }}
          className="text-[10px] bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded px-2 py-1 text-slate-600 dark:text-slate-300 cursor-pointer min-w-[100px]"
        >
          <option value="">当前代码</option>
          {codeHistory.map((v, idx) => (
            <option key={v.id} value={idx}>
              v{idx + 1} {getSourceLabel(v.source)} ({formatTime(v.timestamp)})
            </option>
          ))}
        </select>

        <span className="text-slate-300 dark:text-zinc-600">|</span>

        {/* Diff Toggle */}
        <button
          onClick={onToggleDiff}
          disabled={codeHistory.length < 1}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-all border
            ${showDiff
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-white dark:bg-zinc-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-zinc-700 hover:text-indigo-600'}
            ${codeHistory.length < 1 ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <GitCompare className="w-3 h-3" />
          Diff
        </button>

        {/* Diff Version Selectors: 当前代码在左边 */}
        {showDiff && (
          <>
            <select
              value={diffRightVersion ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                onDiffRightChange(val === '' ? null : parseInt(val));
              }}
              className="text-[10px] bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded px-2 py-1 text-emerald-700 dark:text-emerald-300 cursor-pointer"
            >
              <option value="">当前代码</option>
              {codeHistory.map((v, idx) => (
                <option key={v.id} value={idx}>
                  v{idx + 1} {getSourceLabel(v.source)}
                </option>
              ))}
            </select>

            <span className="text-[10px] text-slate-400">vs</span>

            <select
              value={diffLeftVersion ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                onDiffLeftChange(val === '' ? null : parseInt(val));
              }}
              className="text-[10px] bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded px-2 py-1 text-rose-700 dark:text-rose-300 cursor-pointer"
            >
              <option value="">选择旧版本</option>
              {codeHistory.map((v, idx) => (
                <option key={v.id} value={idx}>
                  v{idx + 1} {getSourceLabel(v.source)}
                </option>
              ))}
            </select>

            {diffResult && (
              <span className="text-[10px] text-slate-500 ml-auto">
                <span className="text-emerald-600">+{addedCount}</span>
                {' / '}
                <span className="text-rose-600">-{removedCount}</span>
              </span>
            )}
          </>
        )}
      </div>

      {/* GitHub-style Unified Diff View */}
      {showDiff && diffResult && diffResult.length > 0 && (
        <div className="border-t border-slate-200 dark:border-zinc-800 overflow-auto flex-1">
          {/* Diff Header */}
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-700 text-[10px] font-mono sticky top-0 z-10">
            <span className="text-slate-500 dark:text-slate-400">
              {getVersionLabel(diffRightVersion)} vs {getVersionLabel(diffLeftVersion)}
            </span>
          </div>
          
          {/* Diff Content */}
          <table className="w-full font-mono text-xs border-collapse">
            <tbody>
              {diffResult.map((line, i) => (
                <tr 
                  key={i}
                  className={`
                    ${line.type === 'added' ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}
                    ${line.type === 'removed' ? 'bg-rose-50 dark:bg-rose-900/20' : ''}
                    ${line.type === 'context' ? 'bg-white dark:bg-zinc-900' : ''}
                  `}
                >
                  {/* New line number (当前代码) */}
                  <td className="w-10 text-right pr-2 pl-2 py-0.5 select-none text-slate-400 dark:text-zinc-600 border-r border-slate-200 dark:border-zinc-700/50 bg-slate-50/50 dark:bg-zinc-900/50">
                    {line.newLineNum ?? ''}
                  </td>
                  {/* Old line number (旧版本) */}
                  <td className="w-10 text-right pr-2 pl-2 py-0.5 select-none text-slate-400 dark:text-zinc-600 border-r border-slate-200 dark:border-zinc-700/50 bg-slate-50/50 dark:bg-zinc-900/50">
                    {line.oldLineNum ?? ''}
                  </td>
                  {/* Diff indicator */}
                  <td className={`w-5 text-center py-0.5 select-none font-bold
                    ${line.type === 'added' ? 'text-emerald-600 dark:text-emerald-400' : ''}
                    ${line.type === 'removed' ? 'text-rose-600 dark:text-rose-400' : ''}
                    ${line.type === 'context' ? 'text-slate-300 dark:text-zinc-600' : ''}
                  `}>
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </td>
                  {/* Code content */}
                  <td className={`py-0.5 pr-4 whitespace-pre leading-6
                    ${line.type === 'added' ? 'text-emerald-800 dark:text-emerald-200' : ''}
                    ${line.type === 'removed' ? 'text-rose-800 dark:text-rose-200' : ''}
                    ${line.type === 'context' ? 'text-slate-700 dark:text-slate-300' : ''}
                  `}>
                    {line.content}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
